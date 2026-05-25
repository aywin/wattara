import json
import math
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.crud import (
    delete_zone as crud_delete_zone,
    get_zone,
    get_zone_outage_stats,
    get_zones,
    get_zones_with_active_outages,
    update_zone_color,
)
from app.db import get_db
from app.models import OfficialOutageZone, Region, User, Zone
from app.routers.core.security import require_admin
from app.schemas import ZoneCreate, ZoneMapView, ZoneRead, ZoneReadWithRegion, ZoneUpdate

router = APIRouter()


def parse_geometry(value):
    if not value:
        return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return value


def point_in_ring(longitude: float, latitude: float, ring: list[list[float]]) -> bool:
    inside = False
    previous = ring[-1]
    for current in ring:
        x1, y1 = previous[0], previous[1]
        x2, y2 = current[0], current[1]
        intersects = (y1 > latitude) != (y2 > latitude)
        if intersects:
            x_at_latitude = (x2 - x1) * (latitude - y1) / (y2 - y1) + x1
            if longitude < x_at_latitude:
                inside = not inside
        previous = current
    return inside


def point_in_polygon(longitude: float, latitude: float, polygon: list[list[list[float]]]) -> bool:
    if not polygon or not point_in_ring(longitude, latitude, polygon[0]):
        return False
    return not any(point_in_ring(longitude, latitude, hole) for hole in polygon[1:])


def geometry_contains_point(geometry, longitude: float, latitude: float) -> bool:
    geometry = parse_geometry(geometry)
    if not geometry:
        return False

    if geometry.get("type") == "Polygon":
        return point_in_polygon(longitude, latitude, geometry.get("coordinates", []))
    if geometry.get("type") == "MultiPolygon":
        return any(point_in_polygon(longitude, latitude, polygon) for polygon in geometry.get("coordinates", []))
    if geometry.get("type") == "Point":
        point_longitude, point_latitude = geometry.get("coordinates", [None, None])
        if point_longitude is None or point_latitude is None:
            return False
        return math.dist([longitude, latitude], [point_longitude, point_latitude]) <= 0.005

    return False


@router.get("/", response_model=list[ZoneRead])
def list_zones(
    region_id: UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return [ZoneRead.model_validate(zone) for zone in get_zones(db, region_id=region_id, skip=skip, limit=limit)]


@router.get("/map", response_model=list[ZoneMapView])
def list_zones_for_map(
    region_id: UUID | None = Query(None),
    include_outages: bool = Query(True),
    db: Session = Depends(get_db),
):
    query = db.query(Zone).options(
        joinedload(Zone.outage_links).joinedload(OfficialOutageZone.outage),
        joinedload(Zone.reports),
    )
    if region_id:
        query = query.filter(Zone.region_id == region_id)

    result = []
    for zone in query.all():
        zone.geometry = parse_geometry(zone.geometry)
        result.append(ZoneMapView.from_orm_zone(zone, include_outages))
    return result


@router.get("/active-outages/list", response_model=list[ZoneRead])
def list_zones_with_active_outages(db: Session = Depends(get_db)):
    return [ZoneRead.model_validate(zone) for zone in get_zones_with_active_outages(db)]


@router.get("/search/by-name")
def search_zones_by_name(
    query: str = Query(..., min_length=2),
    region_id: UUID | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    search_query = db.query(Zone).filter(Zone.name.ilike(f"%{query}%"))
    if region_id:
        search_query = search_query.filter(Zone.region_id == region_id)

    return [
        {
            "id": str(zone.id),
            "name": zone.name,
            "sector_number": zone.sector_number,
            "region_id": str(zone.region_id),
        }
        for zone in search_query.limit(limit).all()
    ]


@router.get("/search/by-coordinates", response_model=ZoneReadWithRegion)
def find_zone_by_coordinates(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    db: Session = Depends(get_db),
):
    zones = db.query(Zone).options(joinedload(Zone.region)).all()
    for zone in zones:
        if geometry_contains_point(zone.geometry, longitude, latitude):
            return ZoneReadWithRegion.model_validate(zone)

    raise HTTPException(status_code=404, detail="Aucune zone trouvee pour ces coordonnees")


@router.post("/bulk-import")
def bulk_import_zones(
    zones: list[ZoneCreate],
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if not zones:
        return {"created": 0, "skipped_existing": 0, "created_names": []}

    region_ids = {zone.region_id for zone in zones}
    existing_regions = db.query(Region.id).filter(Region.id.in_(region_ids)).all()
    existing_region_ids = {region_id for (region_id,) in existing_regions}
    missing_regions = [str(region_id) for region_id in region_ids if region_id not in existing_region_ids]
    if missing_regions:
        raise HTTPException(status_code=404, detail=f"Region introuvable: {', '.join(missing_regions)}")

    existing_zone_keys = {
        ((zone.name or "").strip().lower(), zone.place or "")
        for zone in db.query(Zone).all()
    }
    created_names = []
    skipped_existing = 0

    for zone in zones:
        key = (zone.name.strip().lower(), zone.place or "")
        if key in existing_zone_keys:
            skipped_existing += 1
            continue
        db.add(
            Zone(
                region_id=zone.region_id,
                name=zone.name,
                place=zone.place,
                sector_number=zone.sector_number,
                geometry=json.dumps(zone.geometry) if zone.geometry else None,
                color_code=zone.color_code,
            )
        )
        existing_zone_keys.add(key)
        created_names.append(zone.name)

    db.commit()
    return {"created": len(created_names), "skipped_existing": skipped_existing, "created_names": created_names}


@router.post("/", response_model=ZoneRead, status_code=201)
def create_zone(
    zone: ZoneCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    region = db.query(Region).filter(Region.id == zone.region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region introuvable")

    db_zone = Zone(
        name=zone.name,
        place=zone.place,
        sector_number=zone.sector_number,
        geometry=json.dumps(zone.geometry) if zone.geometry else None,
        color_code=zone.color_code,
        region_id=zone.region_id,
    )
    db.add(db_zone)
    db.commit()
    db.refresh(db_zone)
    return ZoneRead.model_validate(db_zone)


@router.get("/{zone_id}", response_model=ZoneReadWithRegion)
def get_zone_by_id(zone_id: UUID, db: Session = Depends(get_db)):
    zone = db.query(Zone).options(joinedload(Zone.region)).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone introuvable")
    return ZoneReadWithRegion.model_validate(zone)


@router.get("/{zone_id}/stats")
def get_zone_statistics(zone_id: UUID, db: Session = Depends(get_db)):
    zone = get_zone(db, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone introuvable")
    return get_zone_outage_stats(db, zone_id)


@router.patch("/{zone_id}", response_model=ZoneRead)
def update_zone(
    zone_id: UUID,
    payload: ZoneUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    zone = get_zone(db, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone introuvable")

    if payload.region_id:
        region = db.query(Region).filter(Region.id == payload.region_id).first()
        if not region:
            raise HTTPException(status_code=404, detail="Region introuvable")

    update_data = payload.model_dump(exclude_unset=True)
    if "geometry" in update_data and update_data["geometry"]:
        update_data["geometry"] = json.dumps(update_data["geometry"])

    for field, value in update_data.items():
        setattr(zone, field, value)

    db.commit()
    db.refresh(zone)
    return ZoneRead.model_validate(zone)


@router.patch("/{zone_id}/color")
def update_zone_color_only(
    zone_id: UUID,
    color_code: str = Body(..., pattern=r"^#[0-9A-Fa-f]{6}$"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    zone = update_zone_color(db, zone_id, color_code)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone introuvable")
    return {"message": "Couleur mise a jour", "zone_id": str(zone_id), "color_code": color_code}


@router.delete("/{zone_id}", status_code=204)
def delete_zone(
    zone_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    success = crud_delete_zone(db, zone_id)
    if not success:
        raise HTTPException(status_code=404, detail="Zone introuvable")
    return None

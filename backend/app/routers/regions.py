import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Region, User
from app.routers.core.security import require_admin
from app.schemas import RegionCreate, RegionRead

router = APIRouter()


class RegionUpdate(BaseModel):
    name: str | None = None
    country: str | None = None
    geometry: dict | str | None = None


@router.get("/", response_model=list[RegionRead])
def list_regions(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Region).offset(skip).limit(limit).all()


@router.post("/", response_model=RegionRead, status_code=201)
def create_region(
    region: RegionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    geometry = region.geometry
    if isinstance(geometry, dict):
        geometry = json.dumps(geometry)

    db_region = Region(name=region.name, country=region.country, geometry=geometry)
    db.add(db_region)
    db.commit()
    db.refresh(db_region)
    return db_region


@router.get("/{region_id}", response_model=RegionRead)
def get_region(region_id: UUID, db: Session = Depends(get_db)):
    region = db.query(Region).filter(Region.id == region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region introuvable")
    return region


@router.patch("/{region_id}", response_model=RegionRead)
def update_region(
    region_id: UUID,
    payload: RegionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    region = db.query(Region).filter(Region.id == region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region introuvable")

    update_data = payload.model_dump(exclude_unset=True)
    if isinstance(update_data.get("geometry"), dict):
        update_data["geometry"] = json.dumps(update_data["geometry"])

    for field, value in update_data.items():
        setattr(region, field, value)

    db.commit()
    db.refresh(region)
    return region


@router.delete("/{region_id}", status_code=204)
def delete_region(
    region_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    region = db.query(Region).filter(Region.id == region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region introuvable")

    db.delete(region)
    db.commit()
    return None

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.crud import (
    create_official_outage as crud_create_outage,
    get_active_outages_count,
    get_official_outages,
    update_official_outage as crud_update_outage,
)
from app.db import get_db
from app.models import Confirmation, OfficialOutage, OfficialOutageZone, Report, User
from app.routers.core.security import require_admin
from app.schemas import OfficialOutageCreate, OfficialOutageReadFull, OfficialOutageUpdate

router = APIRouter()


@router.get("/", response_model=list[OfficialOutageReadFull])
def list_official_outages(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    active_only: bool = Query(False),
    zone_id: UUID | None = Query(None),
    db: Session = Depends(get_db),
):
    outages = get_official_outages(
        db=db,
        active_only=active_only,
        zone_id=zone_id,
        skip=skip,
        limit=limit,
    )
    for outage in outages:
        db.refresh(outage)
    return outages


@router.get("/stats/summary")
def get_outages_summary(db: Session = Depends(get_db)):
    now = datetime.now()
    return {
        "total": db.query(OfficialOutage).count(),
        "active": get_active_outages_count(db),
        "upcoming": db.query(OfficialOutage).filter(OfficialOutage.start_time > now).count(),
        "past": db.query(OfficialOutage).filter(OfficialOutage.end_time < now).count(),
    }


@router.post("/", response_model=OfficialOutageReadFull, status_code=201)
def create_official_outage(
    outage: OfficialOutageCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        db_outage = crud_create_outage(db, outage)
        db.refresh(db_outage)
        return db_outage
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/{outage_id}", response_model=OfficialOutageReadFull)
def get_official_outage(outage_id: UUID, db: Session = Depends(get_db)):
    outage = (
        db.query(OfficialOutage)
        .options(
            joinedload(OfficialOutage.reports).joinedload(Report.user),
            joinedload(OfficialOutage.confirmations).joinedload(Confirmation.user),
            joinedload(OfficialOutage.zone_links).joinedload(OfficialOutageZone.zone),
        )
        .filter(OfficialOutage.id == outage_id)
        .first()
    )
    if not outage:
        raise HTTPException(status_code=404, detail="Coupure officielle introuvable")
    return outage


@router.patch("/{outage_id}", response_model=OfficialOutageReadFull)
def update_official_outage(
    outage_id: UUID,
    payload: OfficialOutageUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        updated_outage = crud_update_outage(db, outage_id, payload)
        if not updated_outage:
            raise HTTPException(status_code=404, detail="Coupure officielle introuvable")
        db.refresh(updated_outage)
        return updated_outage
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{outage_id}", status_code=204)
def delete_official_outage(
    outage_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    outage = db.query(OfficialOutage).filter(OfficialOutage.id == outage_id).first()
    if not outage:
        raise HTTPException(status_code=404, detail="Coupure officielle introuvable")

    db.delete(outage)
    db.commit()
    return None

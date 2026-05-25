from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.crud import (
    count_reports_by_status,
    create_report as crud_create_report,
    delete_report as crud_delete_report,
    update_report as crud_update_report,
)
from app.db import get_db
from app.models import Confirmation, OfficialOutage, Report, ReportStatus, User, Zone
from app.routers.core.security import get_current_user, require_admin
from app.schemas import ReportCreate, ReportReadFull, ReportUpdate

router = APIRouter()


def load_report_full(db: Session, report_id: UUID) -> Report | None:
    return (
        db.query(Report)
        .options(
            joinedload(Report.user),
            joinedload(Report.zone),
            joinedload(Report.outage),
            joinedload(Report.confirmations).joinedload(Confirmation.user),
        )
        .filter(Report.id == report_id)
        .first()
    )


@router.get("/", response_model=list[ReportReadFull])
def list_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: ReportStatus | None = Query(None),
    zone_id: UUID | None = Query(None),
    user_id: UUID | None = Query(None),
    recent_hours: int | None = Query(None, ge=1, le=168),
    db: Session = Depends(get_db),
):
    query = db.query(Report).options(
        joinedload(Report.user),
        joinedload(Report.zone),
        joinedload(Report.outage),
        joinedload(Report.confirmations).joinedload(Confirmation.user),
    )

    if status:
        query = query.filter(Report.status == status)
    if zone_id:
        query = query.filter(Report.zone_id == zone_id)
    if user_id:
        query = query.filter(Report.user_id == user_id)
    if recent_hours:
        cutoff = datetime.now() - timedelta(hours=recent_hours)
        query = query.filter(Report.created_at >= cutoff)

    reports = query.order_by(Report.created_at.desc()).offset(skip).limit(limit).all()
    return [ReportReadFull.from_orm_with_counts(report) for report in reports]


@router.get("/stats/summary")
def get_reports_summary(db: Session = Depends(get_db)):
    last_24h = db.query(Report).filter(
        Report.created_at >= datetime.now() - timedelta(hours=24)
    ).count()
    last_7days = db.query(Report).filter(
        Report.created_at >= datetime.now() - timedelta(days=7)
    ).count()

    return {
        "by_status": count_reports_by_status(db),
        "last_24h": last_24h,
        "last_7days": last_7days,
        "total": db.query(Report).count(),
    }


@router.get("/by-zone/summary")
def get_reports_by_zone(
    status: ReportStatus | None = Query(None),
    recent_hours: int = Query(24, ge=1, le=168),
    db: Session = Depends(get_db),
):
    from sqlalchemy import func

    cutoff = datetime.now() - timedelta(hours=recent_hours)
    query = (
        db.query(Report.zone_id, Zone.name, Report.status, func.count(Report.id).label("count"))
        .join(Zone)
        .filter(Report.created_at >= cutoff)
    )

    if status:
        query = query.filter(Report.status == status)

    results = query.group_by(Report.zone_id, Zone.name, Report.status).all()
    zone_data = {}
    for zone_id, zone_name, report_status, count in results:
        zone_id_str = str(zone_id)
        if zone_id_str not in zone_data:
            zone_data[zone_id_str] = {
                "zone_name": zone_name,
                "count": 0,
                "open": 0,
                "in_progress": 0,
                "resolved": 0,
            }
        zone_data[zone_id_str]["count"] += count
        zone_data[zone_id_str][report_status.value] = count

    return zone_data


@router.get("/recent/hotspots")
def get_recent_hotspots(
    hours: int = Query(24, ge=1, le=168),
    min_reports: int = Query(3, ge=1, le=50),
    db: Session = Depends(get_db),
):
    from sqlalchemy import func

    cutoff = datetime.now() - timedelta(hours=hours)
    hotspots = (
        db.query(Zone.id, Zone.name, Zone.sector_number, func.count(Report.id).label("report_count"))
        .join(Report, Report.zone_id == Zone.id)
        .filter(Report.created_at >= cutoff, Report.status == ReportStatus.open)
        .group_by(Zone.id, Zone.name, Zone.sector_number)
        .having(func.count(Report.id) >= min_reports)
        .order_by(func.count(Report.id).desc())
        .all()
    )

    return [
        {
            "zone_id": str(zone_id),
            "zone_name": name,
            "sector_number": sector,
            "report_count": count,
        }
        for zone_id, name, sector, count in hotspots
    ]


@router.post("/", response_model=ReportReadFull, status_code=201)
def create_report(
    report: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if report.zone_id:
        zone = db.query(Zone).filter(Zone.id == report.zone_id).first()
        if not zone:
            raise HTTPException(status_code=404, detail="Zone introuvable")

    if report.outage_id:
        outage = db.query(OfficialOutage).filter(OfficialOutage.id == report.outage_id).first()
        if not outage:
            raise HTTPException(status_code=404, detail="Coupure officielle introuvable")

    db_report = crud_create_report(db, report, current_user.id)
    full_report = load_report_full(db, db_report.id)
    return ReportReadFull.from_orm_with_counts(full_report)


@router.get("/{report_id}", response_model=ReportReadFull)
def get_report_by_id(report_id: UUID, db: Session = Depends(get_db)):
    report = load_report_full(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Signalement introuvable")
    return ReportReadFull.from_orm_with_counts(report)


@router.patch("/{report_id}", response_model=ReportReadFull)
def update_report(
    report_id: UUID,
    payload: ReportUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    updated_report = crud_update_report(db, report_id, payload)
    if not updated_report:
        raise HTTPException(status_code=404, detail="Signalement introuvable")

    full_report = load_report_full(db, report_id)
    return ReportReadFull.from_orm_with_counts(full_report)


@router.delete("/{report_id}", status_code=204)
def delete_report(
    report_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    success = crud_delete_report(db, report_id)
    if not success:
        raise HTTPException(status_code=404, detail="Signalement introuvable")
    return None

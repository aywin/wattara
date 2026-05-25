from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Confirmation, OfficialOutage, Report, User
from app.routers.core.security import get_current_user, require_admin
from app.schemas import ConfirmationCreate, ConfirmationRead

router = APIRouter()


@router.post("/", response_model=ConfirmationRead)
def create_confirmation(
    confirmation: ConfirmationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if confirmation.report_id:
        report = db.query(Report).filter(Report.id == confirmation.report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail="Signalement introuvable")

    if confirmation.outage_id:
        outage = db.query(OfficialOutage).filter(OfficialOutage.id == confirmation.outage_id).first()
        if not outage:
            raise HTTPException(status_code=404, detail="Coupure officielle introuvable")

    existing = (
        db.query(Confirmation)
        .filter(
            Confirmation.user_id == current_user.id,
            Confirmation.report_id == confirmation.report_id,
            Confirmation.outage_id == confirmation.outage_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Deja confirme par cet utilisateur")

    db_confirmation = Confirmation(
        user_id=current_user.id,
        report_id=confirmation.report_id,
        outage_id=confirmation.outage_id,
    )
    db.add(db_confirmation)
    db.commit()
    db.refresh(db_confirmation)
    return db_confirmation


@router.get("/", response_model=list[ConfirmationRead])
def list_confirmations(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return db.query(Confirmation).offset(skip).limit(limit).all()


@router.get("/report/{report_id}", response_model=list[ConfirmationRead])
def get_confirmations_for_report(report_id: UUID, db: Session = Depends(get_db)):
    return db.query(Confirmation).filter(Confirmation.report_id == report_id).all()


@router.get("/outage/{outage_id}", response_model=list[ConfirmationRead])
def get_confirmations_for_outage(outage_id: UUID, db: Session = Depends(get_db)):
    return db.query(Confirmation).filter(Confirmation.outage_id == outage_id).all()


@router.get("/{confirmation_id}", response_model=ConfirmationRead)
def get_confirmation(
    confirmation_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    confirmation = db.query(Confirmation).filter(Confirmation.id == confirmation_id).first()
    if not confirmation:
        raise HTTPException(status_code=404, detail="Confirmation introuvable")
    return confirmation


@router.delete("/{confirmation_id}", status_code=204)
def delete_confirmation(
    confirmation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    confirmation = db.query(Confirmation).filter(Confirmation.id == confirmation_id).first()
    if not confirmation:
        raise HTTPException(status_code=404, detail="Confirmation introuvable")

    if confirmation.user_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Action non autorisee")

    db.delete(confirmation)
    db.commit()
    return None

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timedelta

import json

from app.models import (
    User,
    Report,
    ReportStatus,
    OfficialOutage,
    Confirmation,
    Region,
    Zone,
    OfficialOutageZone,
)
from app.schemas import (
    UserCreate,
    ReportCreate,
    ReportUpdate,
    OfficialOutageCreate,
    OfficialOutageUpdate,
    ConfirmationCreate,
    RegionCreate,
    ZoneCreate,
)


# =====================================================
# 👤 USERS
# =====================================================

def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    return db.query(User).offset(skip).limit(limit).all()


def get_user(db: Session, user_id: UUID) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def create_user(db: Session, user: UserCreate, hashed_password: str) -> User:
    db_user = User(
        email=user.email,
        username=user.username,
        role=user.role,
        password_hash=hashed_password,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def delete_user(db: Session, user_id: UUID) -> bool:
    user = get_user(db, user_id)
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True


# =====================================================
# 🌍 REGIONS
# =====================================================

def get_regions(db: Session, skip: int = 0, limit: int = 100) -> List[Region]:
    return db.query(Region).offset(skip).limit(limit).all()


def get_region(db: Session, region_id: UUID) -> Optional[Region]:
    return db.query(Region).filter(Region.id == region_id).first()


def get_region_by_name(db: Session, name: str) -> Optional[Region]:
    return db.query(Region).filter(Region.name == name).first()


def create_region(db: Session, region: RegionCreate) -> Region:
    db_region = Region(
        name=region.name,
        country=region.country,
        geometry=region.geometry
    )
    db.add(db_region)
    db.commit()
    db.refresh(db_region)
    return db_region


def delete_region(db: Session, region_id: UUID) -> bool:
    region = get_region(db, region_id)
    if not region:
        return False
    db.delete(region)
    db.commit()
    return True


# =====================================================
# 🏘️ ZONES
# =====================================================

def get_zones(
    db: Session, 
    region_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100
) -> List[Zone]:
    query = db.query(Zone)
    if region_id:
        query = query.filter(Zone.region_id == region_id)
    return query.offset(skip).limit(limit).all()


def get_zone(db: Session, zone_id: UUID) -> Optional[Zone]:
    return db.query(Zone).filter(Zone.id == zone_id).first()


def get_zone_by_name(db: Session, name: str, region_id: Optional[UUID] = None) -> Optional[Zone]:
    query = db.query(Zone).filter(Zone.name == name)
    if region_id:
        query = query.filter(Zone.region_id == region_id)
    return query.first()



def create_zone(db: Session, zone: ZoneCreate) -> Zone:
    """
    Crée une zone avec conversion automatique geometry dict → string
    """
    # Convertir geometry en string JSON si c'est un dict
    geometry_str = None
    if zone.geometry:
        if isinstance(zone.geometry, dict):
            geometry_str = json.dumps(zone.geometry)
        else:
            geometry_str = zone.geometry
    
    db_zone = Zone(
        region_id=zone.region_id,
        name=zone.name,
        place=zone.place,
        sector_number=zone.sector_number,
        geometry=geometry_str,
        color_code=zone.color_code
    )
    db.add(db_zone)
    db.commit()
    db.refresh(db_zone)
    return db_zone

def update_zone_color(db: Session, zone_id: UUID, color_code: str) -> Optional[Zone]:
    zone = get_zone(db, zone_id)
    if not zone:
        return None
    zone.color_code = color_code
    db.commit()
    db.refresh(zone)
    return zone


def delete_zone(db: Session, zone_id: UUID) -> bool:
    zone = get_zone(db, zone_id)
    if not zone:
        return False
    db.delete(zone)
    db.commit()
    return True


def get_zones_with_active_outages(db: Session) -> List[Zone]:
    """Récupère toutes les zones ayant des coupures actives"""
    now = datetime.now()
    return (
        db.query(Zone)
        .join(OfficialOutageZone)
        .join(OfficialOutage)
        .filter(
            OfficialOutage.start_time <= now,
            or_(
                OfficialOutage.end_time >= now,
                OfficialOutage.end_time.is_(None)
            )
        )
        .distinct()
        .all()
    )


# =====================================================
# 🚨 REPORTS
# =====================================================

def get_reports(
    db: Session,
    status: Optional[ReportStatus] = None,
    zone_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 50
) -> List[Report]:
    query = db.query(Report)
    
    if status:
        query = query.filter(Report.status == status)
    if zone_id:
        query = query.filter(Report.zone_id == zone_id)
    if user_id:
        query = query.filter(Report.user_id == user_id)
    
    return query.order_by(Report.created_at.desc()).offset(skip).limit(limit).all()


def get_report(db: Session, report_id: UUID) -> Optional[Report]:
    return db.query(Report).filter(Report.id == report_id).first()


def create_report(db: Session, report: ReportCreate, user_id: UUID) -> Report:
    db_report = Report(
        user_id=user_id,
        title=report.title,
        description=report.description,
        event_type=report.event_type,
        latitude=report.latitude,
        longitude=report.longitude,
        zone_id=report.zone_id,
        outage_id=report.outage_id,
        status=ReportStatus.open
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def update_report(db: Session, report_id: UUID, report_update: ReportUpdate) -> Optional[Report]:
    report = get_report(db, report_id)
    if not report:
        return None
    
    update_data = report_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(report, key, value)
    
    db.commit()
    db.refresh(report)
    return report


def delete_report(db: Session, report_id: UUID) -> bool:
    report = get_report(db, report_id)
    if not report:
        return False
    db.delete(report)
    db.commit()
    return True


def get_recent_reports(db: Session, hours: int = 24, limit: int = 50) -> List[Report]:
    """Récupère les signalements récents (dernières X heures)"""
    cutoff = datetime.now() - timedelta(hours=hours)
    return (
        db.query(Report)
        .filter(Report.created_at >= cutoff)
        .order_by(Report.created_at.desc())
        .limit(limit)
        .all()
    )


def count_reports_by_status(db: Session) -> dict:
    """Compte les signalements par statut"""
    results = db.query(
        Report.status,
        func.count(Report.id).label('count')
    ).group_by(Report.status).all()
    
    return {status.value: count for status, count in results}


# =====================================================
# ⚡ OFFICIAL OUTAGES
# =====================================================

def get_official_outages(
    db: Session,
    active_only: bool = False,
    zone_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 50
) -> List[OfficialOutage]:
    query = db.query(OfficialOutage)
    
    # Filtre coupures actives
    if active_only:
        now = datetime.now()
        query = query.filter(
            OfficialOutage.start_time <= now,
            or_(
                OfficialOutage.end_time >= now,
                OfficialOutage.end_time.is_(None)
            )
        )
    
    # Filtre par zone
    if zone_id:
        query = query.join(OfficialOutageZone).filter(
            OfficialOutageZone.zone_id == zone_id
        )
    
    return query.order_by(OfficialOutage.start_time.desc()).offset(skip).limit(limit).all()


def get_official_outage(db: Session, outage_id: UUID) -> Optional[OfficialOutage]:
    return db.query(OfficialOutage).filter(OfficialOutage.id == outage_id).first()


def create_official_outage(db: Session, outage: OfficialOutageCreate) -> OfficialOutage:
    """
    Crée une coupure officielle et lie les zones
    """
    # Extraire zone_ids avant de créer l'objet
    zone_ids = outage.zone_ids
    
    # Créer la coupure (sans zone_ids)
    db_outage = OfficialOutage(
        title=outage.title,
        description=outage.description,
        start_time=outage.start_time,
        end_time=outage.end_time,
        source=outage.source
    )
    db.add(db_outage)
    db.flush()  # Pour obtenir l'ID sans commit
    
    # Vérifier que les zones existent
    if zone_ids:
        zones = db.query(Zone).filter(Zone.id.in_(zone_ids)).all()
        if len(zones) != len(zone_ids):
            db.rollback()
            raise ValueError("Certaines zones spécifiées n'existent pas")
        
        # Créer les liaisons
        for zone_id in zone_ids:
            link = OfficialOutageZone(outage_id=db_outage.id, zone_id=zone_id)
            db.add(link)
    
    db.commit()
    db.refresh(db_outage)
    return db_outage


def update_official_outage(
    db: Session,
    outage_id: UUID,
    outage_update: OfficialOutageUpdate
) -> Optional[OfficialOutage]:
    """
    Met à jour une coupure et ses zones
    """
    outage = get_official_outage(db, outage_id)
    if not outage:
        return None
    
    # Extraire zone_ids
    update_data = outage_update.model_dump(exclude_unset=True)
    zone_ids = update_data.pop('zone_ids', None)
    
    # Mettre à jour les champs de base
    for key, value in update_data.items():
        setattr(outage, key, value)
    
    # Mettre à jour les zones si fourni
    if zone_ids is not None:
        # Vérifier que les zones existent
        zones = db.query(Zone).filter(Zone.id.in_(zone_ids)).all()
        if len(zones) != len(zone_ids):
            raise ValueError("Certaines zones spécifiées n'existent pas")
        
        # Supprimer anciennes liaisons
        db.query(OfficialOutageZone).filter(
            OfficialOutageZone.outage_id == outage_id
        ).delete()
        
        # Créer nouvelles liaisons
        for zone_id in zone_ids:
            link = OfficialOutageZone(outage_id=outage_id, zone_id=zone_id)
            db.add(link)
    
    db.commit()
    db.refresh(outage)
    return outage


def delete_official_outage(db: Session, outage_id: UUID) -> bool:
    outage = get_official_outage(db, outage_id)
    if not outage:
        return False
    db.delete(outage)
    db.commit()
    return True


def get_active_outages_count(db: Session) -> int:
    """Compte les coupures actives"""
    now = datetime.now()
    return db.query(OfficialOutage).filter(
        OfficialOutage.start_time <= now,
        or_(
            OfficialOutage.end_time >= now,
            OfficialOutage.end_time.is_(None)
        )
    ).count()


# =====================================================
# 🔗 OFFICIAL OUTAGE ↔ ZONES
# =====================================================

def link_outage_to_zone(db: Session, outage_id: UUID, zone_id: UUID) -> OfficialOutageZone:
    """Lie une coupure à une zone (si pas déjà lié)"""
    # Vérifier si déjà lié
    existing = db.query(OfficialOutageZone).filter(
        OfficialOutageZone.outage_id == outage_id,
        OfficialOutageZone.zone_id == zone_id
    ).first()
    
    if existing:
        return existing
    
    db_link = OfficialOutageZone(outage_id=outage_id, zone_id=zone_id)
    db.add(db_link)
    db.commit()
    db.refresh(db_link)
    return db_link


def get_zones_for_outage(db: Session, outage_id: UUID) -> List[Zone]:
    """Récupère toutes les zones affectées par une coupure"""
    return (
        db.query(Zone)
        .join(OfficialOutageZone)
        .filter(OfficialOutageZone.outage_id == outage_id)
        .all()
    )


def get_outages_for_zone(
    db: Session,
    zone_id: UUID,
    active_only: bool = False
) -> List[OfficialOutage]:
    """Récupère toutes les coupures affectant une zone"""
    query = (
        db.query(OfficialOutage)
        .join(OfficialOutageZone)
        .filter(OfficialOutageZone.zone_id == zone_id)
    )
    
    if active_only:
        now = datetime.now()
        query = query.filter(
            OfficialOutage.start_time <= now,
            or_(
                OfficialOutage.end_time >= now,
                OfficialOutage.end_time.is_(None)
            )
        )
    
    return query.order_by(OfficialOutage.start_time.desc()).all()


def unlink_outage_zone(db: Session, outage_id: UUID, zone_id: UUID) -> bool:
    """Délie une coupure d'une zone"""
    link = db.query(OfficialOutageZone).filter(
        OfficialOutageZone.outage_id == outage_id,
        OfficialOutageZone.zone_id == zone_id
    ).first()
    
    if not link:
        return False
    
    db.delete(link)
    db.commit()
    return True


# =====================================================
# ✅ CONFIRMATIONS
# =====================================================

def get_confirmations(
    db: Session,
    report_id: Optional[UUID] = None,
    outage_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100
) -> List[Confirmation]:
    query = db.query(Confirmation)
    
    if report_id:
        query = query.filter(Confirmation.report_id == report_id)
    if outage_id:
        query = query.filter(Confirmation.outage_id == outage_id)
    if user_id:
        query = query.filter(Confirmation.user_id == user_id)
    
    return query.offset(skip).limit(limit).all()


def get_confirmation(db: Session, confirmation_id: UUID) -> Optional[Confirmation]:
    return db.query(Confirmation).filter(Confirmation.id == confirmation_id).first()


def create_confirmation(
    db: Session,
    user_id: UUID,
    confirmation: ConfirmationCreate
) -> Confirmation:
    """Crée une confirmation (évite les doublons)"""
    # Vérifier doublon
    existing = db.query(Confirmation).filter(
        Confirmation.user_id == user_id,
        Confirmation.report_id == confirmation.report_id,
        Confirmation.outage_id == confirmation.outage_id
    ).first()
    
    if existing:
        raise ValueError("Vous avez déjà confirmé cet élément")
    
    db_confirmation = Confirmation(
        user_id=user_id,
        report_id=confirmation.report_id,
        outage_id=confirmation.outage_id
    )
    db.add(db_confirmation)
    db.commit()
    db.refresh(db_confirmation)
    return db_confirmation


def delete_confirmation(db: Session, confirmation_id: UUID) -> bool:
    confirmation = get_confirmation(db, confirmation_id)
    if not confirmation:
        return False
    db.delete(confirmation)
    db.commit()
    return True


def count_confirmations_for_report(db: Session, report_id: UUID) -> int:
    """Compte les confirmations d'un signalement"""
    return db.query(Confirmation).filter(
        Confirmation.report_id == report_id
    ).count()


def count_confirmations_for_outage(db: Session, outage_id: UUID) -> int:
    """Compte les confirmations d'une coupure"""
    return db.query(Confirmation).filter(
        Confirmation.outage_id == outage_id
    ).count()


def get_confirmations_today(db: Session) -> int:
    """Compte les confirmations du jour"""
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    return db.query(Confirmation).filter(
        Confirmation.confirmed_at >= today
    ).count()


# =====================================================
# 📊 STATISTIQUES & ANALYTICS
# =====================================================

def get_map_stats(db: Session) -> dict:
    """Statistiques globales pour la carte"""
    now = datetime.now()
    
    total_zones = db.query(Zone).count()
    
    zones_with_outages = db.query(Zone.id).join(OfficialOutageZone).join(
        OfficialOutage
    ).filter(
        OfficialOutage.start_time <= now,
        or_(
            OfficialOutage.end_time >= now,
            OfficialOutage.end_time.is_(None)
        )
    ).distinct().count()
    
    active_outages = get_active_outages_count(db)
    
    active_reports = db.query(Report).filter(
        Report.status == ReportStatus.open
    ).count()
    
    confirmations_today = get_confirmations_today(db)
    
    return {
        "total_zones": total_zones,
        "zones_with_outages": zones_with_outages,
        "active_outages": active_outages,
        "active_reports": active_reports,
        "total_confirmations_today": confirmations_today
    }


def get_zone_outage_stats(db: Session, zone_id: UUID) -> dict:
    """Statistiques des coupures pour une zone"""
    outages = get_outages_for_zone(db, zone_id, active_only=False)
    
    total_outages = len(outages)
    
    # Calculer durée totale et moyenne
    total_duration = 0
    for outage in outages:
        if outage.end_time:
            duration = (outage.end_time - outage.start_time).total_seconds() / 3600
            total_duration += duration
    
    average_duration = total_duration / total_outages if total_outages > 0 else 0
    
    # Source la plus fréquente
    sources = [o.source for o in outages if o.source]
    most_frequent_cause = max(set(sources), key=sources.count) if sources else None
    
    return {
        "zone_id": zone_id,
        "total_outages": total_outages,
        "total_duration_hours": round(total_duration, 2),
        "average_duration_hours": round(average_duration, 2),
        "most_frequent_cause": most_frequent_cause
    }

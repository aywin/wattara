from pydantic import BaseModel, EmailStr, Field, field_validator
from uuid import UUID
from datetime import datetime, timezone
from typing import Optional, List, Any
from app.models import ReportStatus, UserRole, ReportEventType
import json
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
# =====================================================
# 🧍 USER
# =====================================================
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    role: UserRole = UserRole.user

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        if not any(c.isdigit() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in v):
            raise ValueError("Le mot de passe doit contenir au moins un caractère spécial")
        return v


class UserRead(UserBase):
    id: UUID
    role: UserRole
    created_at: datetime

    model_config = {"from_attributes": True}


# =====================================================
# 🗺️ REGION
# =====================================================
class RegionBase(BaseModel):
    name: str
    country: str = "Burkina Faso"
    geometry: Optional[str] = None  # GeoJSON string


class RegionCreate(RegionBase):
    pass


class RegionRead(RegionBase):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


# =====================================================
# 🏘️ ZONE - AVEC GÉOMÉTRIE JSON
# =====================================================
class ZoneBase(BaseModel):
    name: str
    place: Optional[str] = None
    sector_number: Optional[str] = None
    geometry: Optional[dict] = None  # ✅ GeoJSON object (pas string)
    color_code: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')


class ZoneCreate(ZoneBase):
    region_id: UUID


class ZoneUpdate(BaseModel):
    """Mise à jour partielle d'une zone"""
    name: Optional[str] = None
    place: Optional[str] = None
    sector_number: Optional[str] = None
    geometry: Optional[dict] = None  # ✅ GeoJSON object
    color_code: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    region_id: Optional[UUID] = None


class ZoneRead(ZoneBase):
    id: UUID
    region_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}
    
    @classmethod
    def model_validate(cls, obj, **kwargs):
        """Désérialise automatiquement geometry depuis la DB"""
        if hasattr(obj, 'geometry') and obj.geometry:
            if isinstance(obj.geometry, str):
                try:
                    obj.geometry = json.loads(obj.geometry)
                except json.JSONDecodeError:
                    obj.geometry = None
        return super().model_validate(obj, **kwargs)


class ZoneReadWithRegion(ZoneRead):
    """Zone avec infos de sa région"""
    region: Optional[RegionRead] = None
    model_config = {"from_attributes": True}


# =====================================================
# ⚡ OFFICIAL OUTAGE
# =====================================================
class OfficialOutageBase(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    description: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    source: Optional[str] = Field(None, max_length=100)

    @field_validator('end_time')
    @classmethod
    def validate_end_time(cls, v, info):
        """Valide que end_time > start_time"""
        if v and 'start_time' in info.data and v < info.data['start_time']:
            raise ValueError('end_time doit être après start_time')
        return v


class OfficialOutageCreate(OfficialOutageBase):
    """Créer une coupure avec liste de zones"""
    zone_ids: List[UUID] = Field(default_factory=list)


class OfficialOutageUpdate(BaseModel):
    """Mettre à jour une coupure (tous champs optionnels)"""
    title: Optional[str] = Field(None, min_length=5, max_length=200)
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    source: Optional[str] = None
    zone_ids: Optional[List[UUID]] = None  # Remplace toutes les zones


class OfficialOutageRead(OfficialOutageBase):
    id: UUID
    created_at: datetime
    
    model_config = {"from_attributes": True}


class OfficialOutageReadWithZones(OfficialOutageRead):
    """
    Coupure avec liste simple de zones (RECOMMANDÉ pour API)
    Usage: GET /outages/{id}
    """
    zones: List[ZoneRead] = Field(default_factory=list)
    
    @classmethod
    def from_orm_outage(cls, outage):
        """Convertit OfficialOutage SQLAlchemy → Schema avec zones aplaties"""
        return cls(
            id=outage.id,
            title=outage.title,
            description=outage.description,
            start_time=outage.start_time,
            end_time=outage.end_time,
            source=outage.source,
            created_at=outage.created_at,
            zones=[ZoneRead.model_validate(link.zone) for link in outage.zone_links]
        )
    
    model_config = {"from_attributes": True}




# =====================================================
# 🚨 REPORT
# =====================================================
class ReportBase(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    description: Optional[str] = None
    event_type: ReportEventType = ReportEventType.outage
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    zone_id: Optional[UUID] = None


class ReportCreate(ReportBase):
    outage_id: Optional[UUID] = None  # user_id viendra du JWT


class ReportUpdate(BaseModel):
    """Mettre à jour un signalement"""
    title: Optional[str] = Field(None, min_length=5, max_length=200)
    description: Optional[str] = None
    event_type: Optional[ReportEventType] = None
    status: Optional[ReportStatus] = None


class ReportRead(ReportBase):
    id: UUID
    user_id: UUID
    status: ReportStatus
    outage_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportReadWithRelations(ReportRead):
    """Report avec user, zone, outage et confirmations"""
    user: Optional[UserRead] = None
    zone: Optional[ZoneRead] = None
    outage: Optional[OfficialOutageRead] = None
    confirmation_count: int = 0  # Nombre de confirmations
    
    @classmethod
    def from_orm_report(cls, report):
        """Convertit Report SQLAlchemy avec comptage"""
        return cls(
            id=report.id,
            user_id=report.user_id,
            title=report.title,
            description=report.description,
            event_type=report.event_type,
            latitude=report.latitude,
            longitude=report.longitude,
            zone_id=report.zone_id,
            status=report.status,
            outage_id=report.outage_id,
            created_at=report.created_at,
            user=UserRead.model_validate(report.user) if report.user else None,
            zone=ZoneRead.model_validate(report.zone) if report.zone else None,
            outage=OfficialOutageRead.model_validate(report.outage) if report.outage else None,
            confirmation_count=len(report.confirmations)
        )
    
    model_config = {"from_attributes": True}


# =====================================================
# ✅ CONFIRMATION
# =====================================================
class ConfirmationCreate(BaseModel):
    """Confirmer un signalement ou une coupure"""
    report_id: Optional[UUID] = None
    outage_id: Optional[UUID] = None

    @model_validator(mode="after")
    def validate_target_required(self):
        """Au moins un des deux doit être fourni"""
        if not self.report_id and not self.outage_id:
            raise ValueError('report_id ou outage_id requis')
        return self

    @field_validator('report_id', 'outage_id')
    @classmethod
    def validate_one_required(cls, v, info):
        """Au moins un des deux doit être fourni"""
        values = info.data
        if False and not values.get('report_id') and not values.get('outage_id'):
            raise ValueError('report_id ou outage_id requis')
        return v


class ConfirmationRead(BaseModel):
    id: UUID
    user_id: UUID
    report_id: Optional[UUID] = None
    outage_id: Optional[UUID] = None
    confirmed_at: datetime

    model_config = {"from_attributes": True}


# =====================================================
# 🗺️ MAP / CARTE (pour Next.js)
# =====================================================
class ZoneMapView(BaseModel):
    """
    Vue simplifiée pour la carte interactive
    Usage: GET /map/zones
    """
    id: UUID
    name: str
    sector_number: Optional[str] = None
    geometry: Optional[Any] = None  # GeoJSON object ou string
    color_code: Optional[str] = None
    
    # Statut en temps réel
    has_active_outage: bool = False
    active_outage_count: int = 0
    active_report_count: int = 0
    
    # Coupures actives (optionnel, pour popup)
    active_outages: List[OfficialOutageRead] = Field(default_factory=list)
    
    @classmethod
    def from_orm_zone(cls, zone, include_outages=True):
        """
        Convertit Zone → ZoneMapView avec calcul des coupures actives
        """
        def normalize_datetime(value):
            if value is None:
                return None
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value.astimezone(timezone.utc)

        now = datetime.now(timezone.utc)
        active_outages = []
        
        for link in zone.outage_links:
            outage = link.outage
            start_time = normalize_datetime(outage.start_time)
            end_time = normalize_datetime(outage.end_time)
            is_active = (
                start_time is not None and
                start_time <= now and
                (not end_time or end_time >= now)
            )
            if is_active:
                active_outages.append(OfficialOutageRead.model_validate(outage))
        
        # Compter les reports actifs dans cette zone
        active_reports = [
            r for r in zone.reports 
            if r.status == ReportStatus.open and 
            r.created_at and
            (now - normalize_datetime(r.created_at)).total_seconds() < 86400  # < 24h
        ]
        
        return cls(
            id=zone.id,
            name=zone.name,
            sector_number=zone.sector_number,
            geometry=zone.geometry,
            color_code=zone.color_code,
            has_active_outage=len(active_outages) > 0,
            active_outage_count=len(active_outages),
            active_report_count=len(active_reports),
            active_outages=active_outages if include_outages else []
        )
    
    model_config = {"from_attributes": True}


class MapStatsResponse(BaseModel):
    """
    Statistiques globales pour le dashboard
    Usage: GET /map/stats
    """
    total_zones: int
    zones_with_outages: int
    active_outages: int
    active_reports: int
    total_confirmations_today: int


# =====================================================
# 📊 ANALYTICS / HISTORIQUE
# =====================================================
class OutageHistoryQuery(BaseModel):
    """Paramètres pour requêtes historiques"""
    zone_id: Optional[UUID] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    limit: int = Field(default=100, le=1000)


class ZoneOutageStats(BaseModel):
    """
    Statistiques par zone
    Usage: GET /analytics/zones/{zone_id}/stats
    """
    zone_id: UUID
    zone_name: str
    total_outages: int
    total_duration_hours: float
    average_duration_hours: float
    most_frequent_cause: Optional[str] = None


# =====================================================
# 🔐 TOKEN (Authentication)
# =====================================================
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: UUID
    username: str
    role: UserRole


# =====================================================
# 📄 PAGINATION
# =====================================================
class PaginatedResponse(BaseModel):
    """Réponse paginée générique"""
    items: List
    total: int
    page: int
    page_size: int
    total_pages: int
    
    @classmethod
    def create(cls, items: List, total: int, page: int, page_size: int):
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size
        )
    


class OfficialOutageReadFull(OfficialOutageBase):
    id: UUID
    created_at: datetime
    
    # Relations complètes
    zones: List[ZoneRead] = Field(default_factory=list)
    reports: List[ReportRead] = Field(default_factory=list)
    confirmations: List[ConfirmationRead] = Field(default_factory=list)
    
    # Compteurs
    zone_count: int = 0
    report_count: int = 0
    confirmation_count: int = 0
    
    @classmethod
    def from_orm_with_counts(cls, outage):
        zones = [ZoneRead.model_validate(link.zone) for link in outage.zone_links]
        reports = [ReportRead.model_validate(r) for r in outage.reports] if hasattr(outage, 'reports') else []
        confirmations = [ConfirmationRead.model_validate(c) for c in outage.confirmations] if hasattr(outage, 'confirmations') else []
        
        return cls(
            id=outage.id,
            title=outage.title,
            description=outage.description,
            start_time=outage.start_time,
            end_time=outage.end_time,
            source=outage.source,
            created_at=outage.created_at,
            zones=zones,
            reports=reports,
            confirmations=confirmations,
            zone_count=len(zones),
            report_count=len(reports),
            confirmation_count=len(confirmations)
        )
    
    model_config = {"from_attributes": True}



class ReportReadFull(ReportBase):
    """Signalement avec toutes les relations"""
    id: UUID
    user_id: UUID
    status: ReportStatus
    outage_id: Optional[UUID] = None
    created_at: datetime
    
    # Relations
    user: Optional[UserRead] = None
    zone: Optional[ZoneRead] = None
    outage: Optional[OfficialOutageRead] = None
    confirmations: List[ConfirmationRead] = Field(default_factory=list)
    
    # Compteur
    confirmation_count: int = 0
    
    @classmethod
    def from_orm_with_counts(cls, report):
        confirmations = [
            ConfirmationRead.model_validate(c) 
            for c in report.confirmations
        ] if hasattr(report, 'confirmations') else []
        
        return cls(
            id=report.id,
            user_id=report.user_id,
            title=report.title,
            description=report.description,
            event_type=report.event_type,
            latitude=report.latitude,
            longitude=report.longitude,
            zone_id=report.zone_id,
            status=report.status,
            outage_id=report.outage_id,
            created_at=report.created_at,
            user=UserRead.model_validate(report.user) if hasattr(report, 'user') and report.user else None,
            zone=ZoneRead.model_validate(report.zone) if hasattr(report, 'zone') and report.zone else None,
            outage=OfficialOutageRead.model_validate(report.outage) if hasattr(report, 'outage') and report.outage else None,
            confirmations=confirmations,
            confirmation_count=len(confirmations)
        )
    
    model_config = {"from_attributes": True}

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum

from .db import Base


# --- ENUMS --------------------------------------------------------

class ReportStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"


class ReportEventType(str, enum.Enum):
    outage = "outage"
    restored = "restored"
    low_voltage = "low_voltage"
    flickering = "flickering"
    still_out = "still_out"


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


# --- UTILISATEURS -------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.user, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reports = relationship("Report", back_populates="user")
    confirmations = relationship("Confirmation", back_populates="user")


# --- VILLES / REGIONS ---------------------------------------------

class Region(Base):
    """
    Représente une grande zone géographique, comme une ville (ex: Ouagadougou).
    """
    __tablename__ = "regions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    country = Column(String, default="Burkina Faso", nullable=False)
    geometry = Column(Text, nullable=True)  # GeoJSON de la ville entière
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    zones = relationship("Zone", back_populates="region")


# --- ZONES / SECTEURS ---------------------------------------------


class Zone(Base):
    """
    Représente un quartier ou secteur de Ouagadougou, colorable sur la carte.
    Compatible avec GeoJSON point ou polygone.
    """
    __tablename__ = "zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    region_id = Column(UUID(as_uuid=True), ForeignKey("regions.id"), nullable=False)
    name = Column(String, nullable=False)
    place = Column(String, nullable=True)  # ex: neighbourhood, suburb
    sector_number = Column(String, nullable=True)
    geometry = Column(Text, nullable=True)  # GeoJSON complet (Point ou Polygon)
    color_code = Column(String, nullable=True)  # ex: "#FF0000" pour rouge
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    region = relationship("Region", back_populates="zones")
    reports = relationship("Report", back_populates="zone")
    outage_links = relationship("OfficialOutageZone", back_populates="zone")

# --- SIGNALEMENTS --------------------------------------------------

class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(Enum(ReportEventType), default=ReportEventType.outage, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=True)
    status = Column(Enum(ReportStatus), default=ReportStatus.open)
    outage_id = Column(UUID(as_uuid=True), ForeignKey("official_outages.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="reports")
    zone = relationship("Zone", back_populates="reports")
    outage = relationship("OfficialOutage", back_populates="reports")
    confirmations = relationship("Confirmation", back_populates="report", cascade="all, delete-orphan")


# --- COUPURES OFFICIELLES ------------------------------------------

class OfficialOutage(Base):
    __tablename__ = "official_outages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    source = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reports = relationship("Report", back_populates="outage")
    confirmations = relationship("Confirmation", back_populates="outage", cascade="all, delete-orphan")
    zone_links = relationship("OfficialOutageZone", back_populates="outage")


# --- TABLE DE LIAISON (panne ↔ zones) ------------------------------

class OfficialOutageZone(Base):
    """
    Lien entre une coupure officielle et les zones affectées.
    """
    __tablename__ = "official_outage_zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    outage_id = Column(UUID(as_uuid=True), ForeignKey("official_outages.id"), nullable=False)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=False)

    outage = relationship("OfficialOutage", back_populates="zone_links")
    zone = relationship("Zone", back_populates="outage_links")


# --- CONFIRMATIONS -------------------------------------------------

class Confirmation(Base):
    __tablename__ = "confirmations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    report_id = Column(UUID(as_uuid=True), ForeignKey("reports.id"), nullable=True)
    outage_id = Column(UUID(as_uuid=True), ForeignKey("official_outages.id"), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="confirmations")
    report = relationship("Report", back_populates="confirmations")
    outage = relationship("OfficialOutage", back_populates="confirmations")

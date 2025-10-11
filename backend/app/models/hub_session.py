from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import secrets
import string
from app.core.database import Base


def generate_pairing_code(length=6):
    """Generate a short pairing code (e.g., ABC123)"""
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(length))


def generate_pairing_token():
    """Generate a secure pairing token"""
    return secrets.token_urlsafe(32)


class HubSession(Base):
    """Hub dashboard session for aggregating multiple cameras"""
    __tablename__ = "hub_sessions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    # Pairing credentials
    pairing_code = Column(String(6), unique=True, nullable=False, default=generate_pairing_code)
    pairing_token = Column(String, unique=True, nullable=False, default=generate_pairing_token)

    # Status
    is_active = Column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    metadata_json = Column(JSON, nullable=True)

    # Relationships
    camera_stations = relationship("CameraStation", back_populates="hub_session", cascade="all, delete-orphan")

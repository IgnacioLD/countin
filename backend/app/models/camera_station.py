from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class CameraStation(Base):
    """Camera station that sends count data to a hub"""
    __tablename__ = "camera_stations"

    id = Column(Integer, primary_key=True, index=True)
    hub_session_id = Column(Integer, ForeignKey("hub_sessions.id"), nullable=False)

    # Camera identification
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)

    # Connection status
    is_connected = Column(Boolean, default=False, nullable=False)
    last_heartbeat = Column(DateTime(timezone=True), nullable=True)

    # Current counts (cached for quick display)
    total_in = Column(Integer, default=0, nullable=False)
    total_out = Column(Integer, default=0, nullable=False)

    # Timestamps
    paired_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Metadata
    metadata_json = Column(JSON, nullable=True)

    # Relationships
    hub_session = relationship("HubSession", back_populates="camera_stations")
    crossing_events = relationship("CrossingEvent", back_populates="camera_station", cascade="all, delete-orphan")

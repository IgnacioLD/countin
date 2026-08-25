from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class CrossingEvent(Base):
    """Individual crossing event model"""
    __tablename__ = "crossing_events"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    line_id = Column(Integer, ForeignKey("counting_lines.id"), nullable=False)
    # For hub mode
    camera_station_id = Column(Integer, ForeignKey("camera_stations.id"), nullable=True)

    # Event details
    person_id = Column(String, nullable=False)  # Tracker ID
    direction = Column(String, nullable=False)  # 'in' or 'out'

    # Position where crossing occurred
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)

    # Timestamp
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Additional metadata
    metadata_json = Column(JSON, nullable=True)

    # Relationships
    session = relationship("Session", back_populates="crossing_events")
    line = relationship("CountingLine", back_populates="crossing_events")
    camera_station = relationship("CameraStation", back_populates="crossing_events")

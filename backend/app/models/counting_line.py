from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class CountingLine(Base):
    """Counting line/area model"""
    __tablename__ = "counting_lines"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)

    # Line properties
    name = Column(String, nullable=False)
    color = Column(String, nullable=False)
    orientation = Column(String, nullable=False)  # 'horizontal', 'vertical', or 'area'

    # Coordinates (for lines)
    start_x = Column(Float, nullable=True)
    start_y = Column(Float, nullable=True)
    end_x = Column(Float, nullable=True)
    end_y = Column(Float, nullable=True)

    # Counts
    count_in = Column(Integer, default=0, nullable=False)
    count_out = Column(Integer, default=0, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Additional metadata (can store polygon points for areas)
    metadata_json = Column(JSON, nullable=True)

    # Relationships
    session = relationship("Session", back_populates="counting_lines")
    crossing_events = relationship("CrossingEvent", back_populates="line", cascade="all, delete-orphan")

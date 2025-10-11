from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Session(Base):
    """Counting session model"""
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Timestamps
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Additional metadata
    metadata_json = Column(JSON, nullable=True)

    # Relationships
    counting_lines = relationship("CountingLine", back_populates="session", cascade="all, delete-orphan")
    crossing_events = relationship("CrossingEvent", back_populates="session", cascade="all, delete-orphan")
    count_snapshots = relationship("CountSnapshot", back_populates="session", cascade="all, delete-orphan")

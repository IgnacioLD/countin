from sqlalchemy import Column, Integer, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class CountSnapshot(Base):
    """Periodic snapshot of counts for visualization"""
    __tablename__ = "count_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)

    # Total counts at this snapshot
    total_in = Column(Integer, default=0, nullable=False)
    total_out = Column(Integer, default=0, nullable=False)
    total_count = Column(Integer, default=0, nullable=False)

    # Per-line counts (JSON)
    line_counts = Column(JSON, nullable=True)

    # Timestamp
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    session = relationship("Session", back_populates="snapshots")

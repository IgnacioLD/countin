from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.session import Session as SessionModel
from app.models.counting_line import CountingLine
from app.models.crossing_event import CrossingEvent
from app.schemas.session import SessionCreate, SessionUpdate, SessionResponse, SessionStats
from datetime import datetime

router = APIRouter()


@router.post("/", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(session_data: SessionCreate, db: Session = Depends(get_db)):
    """Create a new counting session"""
    session = SessionModel(**session_data.dict())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/", response_model=List[SessionResponse])
def list_sessions(
    skip: int = 0, limit: int = 100, active_only: bool = False, db: Session = Depends(get_db)
):
    """List all counting sessions"""
    query = db.query(SessionModel)
    if active_only:
        query = query.filter(SessionModel.is_active == True)
    sessions = query.order_by(SessionModel.created_at.desc()).offset(skip).limit(limit).all()
    return sessions


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    """Get a specific session by ID"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.patch("/{session_id}", response_model=SessionResponse)
def update_session(session_id: int, session_data: SessionUpdate, db: Session = Depends(get_db)):
    """Update a session"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    update_data = session_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(session, field, value)

    db.commit()
    db.refresh(session)
    return session


@router.post("/{session_id}/end", response_model=SessionResponse)
def end_session(session_id: int, db: Session = Depends(get_db)):
    """End an active session"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.is_active = False
    session.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: int, db: Session = Depends(get_db)):
    """Delete a session"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    db.delete(session)
    db.commit()
    return None


@router.get("/{session_id}/stats", response_model=SessionStats)
def get_session_stats(session_id: int, db: Session = Depends(get_db)):
    """Get statistics for a session"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Calculate totals
    lines = db.query(CountingLine).filter(CountingLine.session_id == session_id).all()
    total_in = sum(line.count_in for line in lines)
    total_out = sum(line.count_out for line in lines)

    # Count events
    event_count = db.query(CrossingEvent).filter(CrossingEvent.session_id == session_id).count()

    # Calculate duration
    duration_minutes = None
    if session.ended_at:
        duration = session.ended_at - session.started_at
        duration_minutes = duration.total_seconds() / 60

    return SessionStats(
        session_id=session_id,
        total_in=total_in,
        total_out=total_out,
        total_count=total_in + total_out,
        line_count=len(lines),
        event_count=event_count,
        duration_minutes=duration_minutes,
    )

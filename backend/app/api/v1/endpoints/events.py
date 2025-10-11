from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.core.database import get_db
from app.models.crossing_event import CrossingEvent
from app.models.counting_line import CountingLine
from app.schemas.crossing_event import CrossingEventCreate, CrossingEventResponse

router = APIRouter()


@router.post("/", response_model=CrossingEventResponse, status_code=status.HTTP_201_CREATED)
def create_event(event_data: CrossingEventCreate, db: Session = Depends(get_db)):
    """Create a new crossing event"""
    # Verify line exists
    line = db.query(CountingLine).filter(CountingLine.id == event_data.line_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")

    # Create event
    event = CrossingEvent(**event_data.dict())
    db.add(event)

    # Update line counts
    if event_data.direction == "in":
        line.count_in += 1
    elif event_data.direction == "out":
        line.count_out += 1

    db.commit()
    db.refresh(event)
    return event


@router.get("/session/{session_id}", response_model=List[CrossingEventResponse])
def list_session_events(
    session_id: int,
    skip: int = 0,
    limit: int = 1000,
    line_id: Optional[int] = None,
    direction: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all events for a session"""
    query = db.query(CrossingEvent).filter(CrossingEvent.session_id == session_id)

    if line_id:
        query = query.filter(CrossingEvent.line_id == line_id)
    if direction:
        query = query.filter(CrossingEvent.direction == direction)

    events = query.order_by(CrossingEvent.timestamp.desc()).offset(skip).limit(limit).all()
    return events


@router.get("/{event_id}", response_model=CrossingEventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    """Get a specific event by ID"""
    event = db.query(CrossingEvent).filter(CrossingEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    """Delete an event"""
    event = db.query(CrossingEvent).filter(CrossingEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    db.delete(event)
    db.commit()
    return None

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.hub_session import HubSession
from app.models.camera_station import CameraStation
from app.schemas.hub_session import HubSessionCreate, HubSessionUpdate, HubSessionResponse, HubSessionWithToken, HubSessionStats
from datetime import datetime

router = APIRouter()


@router.post("/", response_model=HubSessionWithToken, status_code=status.HTTP_201_CREATED)
def create_hub_session(hub_data: HubSessionCreate, db: Session = Depends(get_db)):
    """Create a new hub dashboard session"""
    from app.models.hub_session import generate_pairing_code, generate_pairing_token

    hub = HubSession(
        **hub_data.dict(),
        pairing_code=generate_pairing_code(),
        pairing_token=generate_pairing_token()
    )
    db.add(hub)
    db.commit()
    db.refresh(hub)
    return hub


@router.get("/", response_model=List[HubSessionResponse])
def list_hub_sessions(
    skip: int = 0, limit: int = 100, active_only: bool = False, db: Session = Depends(get_db)
):
    """List all hub sessions"""
    query = db.query(HubSession)
    if active_only:
        query = query.filter(HubSession.is_active == True)
    hubs = query.order_by(HubSession.created_at.desc()).offset(skip).limit(limit).all()
    return hubs


@router.get("/{hub_id}", response_model=HubSessionResponse)
def get_hub_session(hub_id: int, db: Session = Depends(get_db)):
    """Get a specific hub session by ID"""
    hub = db.query(HubSession).filter(HubSession.id == hub_id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub session not found")
    return hub


@router.get("/code/{pairing_code}", response_model=HubSessionResponse)
def get_hub_by_code(pairing_code: str, db: Session = Depends(get_db)):
    """Get hub session by pairing code"""
    hub = db.query(HubSession).filter(HubSession.pairing_code == pairing_code.upper()).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub session not found")
    if not hub.is_active:
        raise HTTPException(status_code=400, detail="Hub session is no longer active")
    return hub


@router.patch("/{hub_id}", response_model=HubSessionResponse)
def update_hub_session(hub_id: int, hub_data: HubSessionUpdate, db: Session = Depends(get_db)):
    """Update a hub session"""
    hub = db.query(HubSession).filter(HubSession.id == hub_id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub session not found")

    update_data = hub_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(hub, field, value)

    db.commit()
    db.refresh(hub)
    return hub


@router.post("/{hub_id}/end", response_model=HubSessionResponse)
def end_hub_session(hub_id: int, db: Session = Depends(get_db)):
    """End an active hub session"""
    hub = db.query(HubSession).filter(HubSession.id == hub_id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub session not found")

    hub.is_active = False
    hub.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(hub)
    return hub


@router.delete("/{hub_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hub_session(hub_id: int, db: Session = Depends(get_db)):
    """Delete a hub session"""
    hub = db.query(HubSession).filter(HubSession.id == hub_id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub session not found")

    db.delete(hub)
    db.commit()
    return None


@router.get("/{hub_id}/stats", response_model=HubSessionStats)
def get_hub_stats(hub_id: int, db: Session = Depends(get_db)):
    """Get aggregated statistics for a hub session"""
    hub = db.query(HubSession).filter(HubSession.id == hub_id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub session not found")

    # Get all cameras for this hub
    cameras = db.query(CameraStation).filter(CameraStation.hub_session_id == hub_id).all()

    # Aggregate counts
    total_in = sum(camera.total_in for camera in cameras)
    total_out = sum(camera.total_out for camera in cameras)
    connected_cameras = sum(1 for camera in cameras if camera.is_connected)

    return HubSessionStats(
        hub_session_id=hub_id,
        total_cameras=len(cameras),
        connected_cameras=connected_cameras,
        total_in=total_in,
        total_out=total_out,
        total_count=total_in + total_out,
    )

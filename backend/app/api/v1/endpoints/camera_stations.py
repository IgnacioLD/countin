from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.core.database import get_db
from app.models.hub_session import HubSession
from app.models.camera_station import CameraStation
from app.schemas.camera_station import CameraStationPair, CameraStationUpdate, CameraStationResponse, CameraStationHeartbeat

router = APIRouter()


@router.post("/pair", response_model=CameraStationResponse, status_code=status.HTTP_201_CREATED)
def pair_camera_station(pair_data: CameraStationPair, db: Session = Depends(get_db)):
    """Pair a camera station with a hub using code or token"""

    # Find hub by pairing code or token
    hub = None
    if pair_data.pairing_code:
        hub = db.query(HubSession).filter(
            HubSession.pairing_code == pair_data.pairing_code.upper(),
            HubSession.is_active == True
        ).first()
    elif pair_data.pairing_token:
        hub = db.query(HubSession).filter(
            HubSession.pairing_token == pair_data.pairing_token,
            HubSession.is_active == True
        ).first()

    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found or inactive")

    # Create camera station
    camera = CameraStation(
        hub_session_id=hub.id,
        name=pair_data.camera_name,
        location=pair_data.camera_location,
        is_connected=True,
        last_heartbeat=datetime.utcnow()
    )

    db.add(camera)
    db.commit()
    db.refresh(camera)

    # Note: Camera list updates via polling on hub side
    # WebSocket notifications would require async handling

    return camera


@router.get("/hub/{hub_id}", response_model=List[CameraStationResponse])
def list_hub_cameras(hub_id: int, db: Session = Depends(get_db)):
    """List all cameras for a hub"""
    cameras = db.query(CameraStation).filter(CameraStation.hub_session_id == hub_id).all()
    return cameras


@router.get("/{camera_id}", response_model=CameraStationResponse)
def get_camera_station(camera_id: int, db: Session = Depends(get_db)):
    """Get a specific camera station"""
    camera = db.query(CameraStation).filter(CameraStation.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera station not found")
    return camera


@router.patch("/{camera_id}", response_model=CameraStationResponse)
def update_camera_station(camera_id: int, camera_data: CameraStationUpdate, db: Session = Depends(get_db)):
    """Update camera station details"""
    camera = db.query(CameraStation).filter(CameraStation.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera station not found")

    update_data = camera_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(camera, field, value)

    db.commit()
    db.refresh(camera)
    return camera


@router.post("/heartbeat", response_model=CameraStationResponse)
def camera_heartbeat(heartbeat: CameraStationHeartbeat, db: Session = Depends(get_db)):
    """Update camera connection status and timestamp"""
    camera = db.query(CameraStation).filter(CameraStation.id == heartbeat.camera_station_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera station not found")

    camera.is_connected = heartbeat.is_connected
    camera.last_heartbeat = datetime.utcnow()

    db.commit()
    db.refresh(camera)
    return camera


@router.post("/{camera_id}/increment")
def increment_camera_count(camera_id: int, direction: str, db: Session = Depends(get_db)):
    """Increment count for a camera (called by camera when detecting crossing)"""
    if direction not in ["in", "out"]:
        raise HTTPException(status_code=400, detail="Direction must be 'in' or 'out'")

    camera = db.query(CameraStation).filter(CameraStation.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera station not found")

    if direction == "in":
        camera.total_in += 1
    else:
        camera.total_out += 1

    db.commit()
    db.refresh(camera)
    return {
        "camera_id": camera_id,
        "direction": direction,
        "total_in": camera.total_in,
        "total_out": camera.total_out
    }


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_camera_station(camera_id: int, db: Session = Depends(get_db)):
    """Delete a camera station"""
    camera = db.query(CameraStation).filter(CameraStation.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera station not found")

    db.delete(camera)
    db.commit()
    return None

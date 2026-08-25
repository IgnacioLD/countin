from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.endpoints.websocket import camera_payload, hub_manager
from app.core.database import get_db
from app.models.camera_station import CameraStation
from app.models.hub_session import HubSession
from app.schemas.camera_station import (
    CameraStationPair,
    CameraStationResponse,
    CameraStationUpdate,
    CameraStationWithToken,
)

router = APIRouter()

# A camera whose last heartbeat is older than this is considered offline even
# if its WebSocket never closed cleanly (dead battery, network loss, ...).
HEARTBEAT_STALE_AFTER = timedelta(seconds=30)


def mark_stale_cameras_offline(db: Session) -> None:
    """Flag cameras with stale heartbeats as offline.

    Called from read endpoints the hub dashboard polls, so phantom "online"
    cameras disappear without any background task.
    """
    threshold = datetime.utcnow() - HEARTBEAT_STALE_AFTER
    stale = (
        db.query(CameraStation)
        .filter(
            CameraStation.is_connected.is_(True),
            CameraStation.last_heartbeat < threshold,
        )
        .all()
    )
    for camera in stale:
        camera.is_connected = False
    if stale:
        db.commit()


@router.post("/pair", response_model=CameraStationWithToken, status_code=status.HTTP_201_CREATED)
async def pair_camera_station(pair_data: CameraStationPair, db: Session = Depends(get_db)):
    """Pair a camera station with a hub using code or token"""
    hub = None
    if pair_data.pairing_code:
        hub = (
            db.query(HubSession)
            .filter(
                HubSession.pairing_code == pair_data.pairing_code.upper(),
                HubSession.is_active.is_(True),
            )
            .first()
        )
    elif pair_data.pairing_token:
        hub = (
            db.query(HubSession)
            .filter(
                HubSession.pairing_token == pair_data.pairing_token,
                HubSession.is_active.is_(True),
            )
            .first()
        )

    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found or inactive")

    # The camera counts as connected only once its WebSocket opens.
    camera = CameraStation(
        hub_session_id=hub.id,
        name=pair_data.camera_name,
        location=pair_data.camera_location,
        is_connected=False,
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)

    # Let hub dashboards show the new camera immediately
    await hub_manager.broadcast_to_hub(
        hub.id, {"type": "camera_paired", "camera": camera_payload(camera)}
    )

    return camera


@router.get("/hub/{hub_id}", response_model=list[CameraStationResponse])
def list_hub_cameras(hub_id: int, db: Session = Depends(get_db)):
    """List all cameras for a hub"""
    mark_stale_cameras_offline(db)
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
def update_camera_station(
    camera_id: int, camera_data: CameraStationUpdate, db: Session = Depends(get_db)
):
    """Update camera station details"""
    camera = db.query(CameraStation).filter(CameraStation.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera station not found")

    update_data = camera_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(camera, field, value)

    db.commit()
    db.refresh(camera)
    return camera


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_camera_station(camera_id: int, db: Session = Depends(get_db)):
    """Delete a camera station"""
    from app.api.v1.endpoints.websocket import CLOSE_UNAUTHORIZED

    camera = db.query(CameraStation).filter(CameraStation.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera station not found")

    hub_id = camera.hub_session_id
    db.delete(camera)
    db.commit()

    # Tell the connected camera its record is gone (its socket handler will
    # see close code 4401) and let hub dashboards drop it immediately.
    await hub_manager.close_camera_connection(camera_id, CLOSE_UNAUTHORIZED, "camera deleted")
    await hub_manager.broadcast_to_hub(hub_id, {"type": "camera_removed", "camera_id": camera_id})
    return None

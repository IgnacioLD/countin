from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CameraStationBase(BaseModel):
    name: str
    location: Optional[str] = None


class CameraStationPair(BaseModel):
    """Request to pair a camera with a hub"""
    pairing_code: Optional[str] = None
    pairing_token: Optional[str] = None
    camera_name: str
    camera_location: Optional[str] = None


class CameraStationUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    is_connected: Optional[bool] = None
    metadata_json: Optional[dict] = None


class CameraStationResponse(CameraStationBase):
    id: int
    hub_session_id: int
    is_connected: bool
    total_in: int
    total_out: int
    last_heartbeat: Optional[datetime]
    paired_at: datetime
    updated_at: datetime
    metadata_json: Optional[dict]

    class Config:
        from_attributes = True


class CameraStationHeartbeat(BaseModel):
    camera_station_id: int
    is_connected: bool = True

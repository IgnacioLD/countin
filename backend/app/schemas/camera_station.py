from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CameraStationBase(BaseModel):
    name: str
    location: str | None = None


class CameraStationPair(BaseModel):
    """Request to pair a camera with a hub"""
    pairing_code: str | None = None
    pairing_token: str | None = None
    camera_name: str = Field(min_length=1)
    camera_location: str | None = None


class CameraStationUpdate(BaseModel):
    name: str | None = None
    location: str | None = None
    is_connected: bool | None = None
    metadata_json: dict | None = None


class CameraStationResponse(CameraStationBase):
    id: int
    hub_session_id: int
    is_connected: bool
    total_in: int
    total_out: int
    last_heartbeat: datetime | None
    paired_at: datetime
    updated_at: datetime
    metadata_json: dict | None

    model_config = ConfigDict(from_attributes=True)


class CameraStationWithToken(CameraStationResponse):
    """Pairing response: includes the camera's secret auth token exactly once"""
    auth_token: str

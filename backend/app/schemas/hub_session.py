from datetime import datetime

from pydantic import BaseModel, ConfigDict


class HubSessionBase(BaseModel):
    name: str
    description: str | None = None


class HubSessionCreate(HubSessionBase):
    metadata_json: dict | None = None


class HubSessionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None
    metadata_json: dict | None = None


class HubSessionResponse(HubSessionBase):
    id: int
    pairing_code: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    ended_at: datetime | None
    metadata_json: dict | None

    model_config = ConfigDict(from_attributes=True)


class HubSessionWithToken(HubSessionResponse):
    """Include pairing token only on creation"""
    pairing_token: str


class HubSessionStats(BaseModel):
    hub_session_id: int
    total_cameras: int
    connected_cameras: int
    total_in: int
    total_out: int
    total_count: int

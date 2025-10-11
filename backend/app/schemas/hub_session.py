from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class HubSessionBase(BaseModel):
    name: str
    description: Optional[str] = None


class HubSessionCreate(HubSessionBase):
    metadata_json: Optional[dict] = None


class HubSessionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    metadata_json: Optional[dict] = None


class HubSessionResponse(HubSessionBase):
    id: int
    pairing_code: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    ended_at: Optional[datetime]
    metadata_json: Optional[dict]

    class Config:
        from_attributes = True


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

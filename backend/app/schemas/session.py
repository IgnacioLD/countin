from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SessionBase(BaseModel):
    name: str
    description: Optional[str] = None
    metadata_json: Optional[dict] = None


class SessionCreate(SessionBase):
    pass


class SessionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    metadata_json: Optional[dict] = None


class SessionResponse(SessionBase):
    id: int
    is_active: bool
    started_at: datetime
    ended_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SessionStats(BaseModel):
    session_id: int
    total_in: int
    total_out: int
    total_count: int
    line_count: int
    event_count: int
    duration_minutes: Optional[float]

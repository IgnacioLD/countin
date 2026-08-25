from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SessionBase(BaseModel):
    name: str
    description: str | None = None
    metadata_json: dict | None = None


class SessionCreate(SessionBase):
    pass


class SessionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None
    metadata_json: dict | None = None


class SessionResponse(SessionBase):
    id: int
    is_active: bool
    started_at: datetime
    ended_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionStats(BaseModel):
    session_id: int
    total_in: int
    total_out: int
    total_count: int
    line_count: int
    event_count: int
    duration_minutes: float | None

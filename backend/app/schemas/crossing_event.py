from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CrossingEventBase(BaseModel):
    person_id: str
    direction: str
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class CrossingEventCreate(CrossingEventBase):
    session_id: int
    line_id: int
    metadata_json: Optional[dict] = None


class CrossingEventResponse(CrossingEventBase):
    id: int
    session_id: int
    line_id: int
    timestamp: datetime
    metadata_json: Optional[dict]

    class Config:
        from_attributes = True

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CrossingEventBase(BaseModel):
    person_id: str
    direction: str
    position_x: float | None = None
    position_y: float | None = None


class CrossingEventCreate(CrossingEventBase):
    session_id: int
    line_id: int
    metadata_json: dict | None = None


class CrossingEventResponse(CrossingEventBase):
    id: int
    session_id: int
    line_id: int
    timestamp: datetime
    metadata_json: dict | None

    model_config = ConfigDict(from_attributes=True)

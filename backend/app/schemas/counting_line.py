from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CountingLineBase(BaseModel):
    name: str
    color: str
    orientation: str
    start_x: float
    start_y: float
    end_x: float
    end_y: float


class CountingLineCreate(CountingLineBase):
    session_id: int
    metadata_json: dict | None = None


class CountingLineUpdate(BaseModel):
    name: str | None = None
    count_in: int | None = None
    count_out: int | None = None
    metadata_json: dict | None = None


class CountingLineResponse(CountingLineBase):
    id: int
    session_id: int
    count_in: int
    count_out: int
    created_at: datetime
    updated_at: datetime
    metadata_json: dict | None

    model_config = ConfigDict(from_attributes=True)

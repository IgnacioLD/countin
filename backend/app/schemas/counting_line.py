from pydantic import BaseModel
from typing import Optional
from datetime import datetime


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
    metadata_json: Optional[dict] = None


class CountingLineUpdate(BaseModel):
    name: Optional[str] = None
    count_in: Optional[int] = None
    count_out: Optional[int] = None
    metadata_json: Optional[dict] = None


class CountingLineResponse(CountingLineBase):
    id: int
    session_id: int
    count_in: int
    count_out: int
    created_at: datetime
    updated_at: datetime
    metadata_json: Optional[dict]

    class Config:
        from_attributes = True

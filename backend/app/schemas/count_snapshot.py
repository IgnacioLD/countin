from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CountSnapshotBase(BaseModel):
    total_in: int
    total_out: int
    total_count: int
    line_counts: Optional[dict] = None


class CountSnapshotCreate(CountSnapshotBase):
    session_id: int


class CountSnapshotResponse(CountSnapshotBase):
    id: int
    session_id: int
    timestamp: datetime

    class Config:
        from_attributes = True

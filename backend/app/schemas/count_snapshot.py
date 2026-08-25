from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CountSnapshotBase(BaseModel):
    total_in: int
    total_out: int
    total_count: int
    line_counts: dict | None = None


class CountSnapshotCreate(CountSnapshotBase):
    session_id: int


class CountSnapshotResponse(CountSnapshotBase):
    id: int
    session_id: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

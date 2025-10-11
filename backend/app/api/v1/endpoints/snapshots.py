from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.count_snapshot import CountSnapshot
from app.schemas.count_snapshot import CountSnapshotCreate, CountSnapshotResponse

router = APIRouter()


@router.post("/", response_model=CountSnapshotResponse, status_code=status.HTTP_201_CREATED)
def create_snapshot(snapshot_data: CountSnapshotCreate, db: Session = Depends(get_db)):
    """Create a new count snapshot"""
    snapshot = CountSnapshot(**snapshot_data.dict())
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


@router.get("/session/{session_id}", response_model=List[CountSnapshotResponse])
def list_session_snapshots(session_id: int, skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    """List all snapshots for a session"""
    snapshots = (
        db.query(CountSnapshot)
        .filter(CountSnapshot.session_id == session_id)
        .order_by(CountSnapshot.timestamp.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return snapshots


@router.delete("/{snapshot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_snapshot(snapshot_id: int, db: Session = Depends(get_db)):
    """Delete a snapshot"""
    snapshot = db.query(CountSnapshot).filter(CountSnapshot.id == snapshot_id).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    db.delete(snapshot)
    db.commit()
    return None

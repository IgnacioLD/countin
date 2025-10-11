from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.counting_line import CountingLine
from app.schemas.counting_line import CountingLineCreate, CountingLineUpdate, CountingLineResponse

router = APIRouter()


@router.post("/", response_model=CountingLineResponse, status_code=status.HTTP_201_CREATED)
def create_line(line_data: CountingLineCreate, db: Session = Depends(get_db)):
    """Create a new counting line"""
    line = CountingLine(**line_data.dict())
    db.add(line)
    db.commit()
    db.refresh(line)
    return line


@router.get("/session/{session_id}", response_model=List[CountingLineResponse])
def list_session_lines(session_id: int, db: Session = Depends(get_db)):
    """List all lines for a session"""
    lines = db.query(CountingLine).filter(CountingLine.session_id == session_id).all()
    return lines


@router.get("/{line_id}", response_model=CountingLineResponse)
def get_line(line_id: int, db: Session = Depends(get_db)):
    """Get a specific line by ID"""
    line = db.query(CountingLine).filter(CountingLine.id == line_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")
    return line


@router.patch("/{line_id}", response_model=CountingLineResponse)
def update_line(line_id: int, line_data: CountingLineUpdate, db: Session = Depends(get_db)):
    """Update a counting line"""
    line = db.query(CountingLine).filter(CountingLine.id == line_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")

    update_data = line_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(line, field, value)

    db.commit()
    db.refresh(line)
    return line


@router.post("/{line_id}/increment")
def increment_line_count(line_id: int, direction: str, db: Session = Depends(get_db)):
    """Increment count for a line"""
    if direction not in ["in", "out"]:
        raise HTTPException(status_code=400, detail="Direction must be 'in' or 'out'")

    line = db.query(CountingLine).filter(CountingLine.id == line_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")

    if direction == "in":
        line.count_in += 1
    else:
        line.count_out += 1

    db.commit()
    db.refresh(line)
    return {"line_id": line_id, "direction": direction, "count_in": line.count_in, "count_out": line.count_out}


@router.delete("/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_line(line_id: int, db: Session = Depends(get_db)):
    """Delete a counting line"""
    line = db.query(CountingLine).filter(CountingLine.id == line_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")

    db.delete(line)
    db.commit()
    return None

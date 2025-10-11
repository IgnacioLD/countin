from fastapi import APIRouter
from app.api.v1.endpoints import sessions, lines, events, snapshots, websocket

api_router = APIRouter()

api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(lines.router, prefix="/lines", tags=["lines"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(snapshots.router, prefix="/snapshots", tags=["snapshots"])
api_router.include_router(websocket.router, prefix="/ws", tags=["websocket"])

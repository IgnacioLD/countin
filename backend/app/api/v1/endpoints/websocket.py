"""WebSocket endpoints connecting camera stations with hub dashboards.

Protocol summary (see docs/websocket-protocol.md):

Camera -> backend (``/api/v1/ws/camera/{camera_id}?token=...``):
    ``{"type": "ping"}``
    ``{"type": "heartbeat"}``
    ``{"type": "count_update", "direction": "in"|"out",
       "counts": {"total_in": int, "total_out": int}}``

Backend -> hub dashboards (``/api/v1/ws/hub/{hub_id}``):
    ``{"type": "pong"}``
    ``{"type": "camera_paired", "camera": {...}}``
    ``{"type": "camera_online", "camera_id": int}``
    ``{"type": "camera_offline", "camera_id": int}``
    ``{"type": "count_update", "camera_id": int, "hub_id": int,
       "direction": "in"|"out", "counts": {"total_in": int, "total_out": int}}``

The hub a camera belongs to is always resolved from the database on connect;
client-supplied ``hub_id`` fields are ignored, so a camera cannot broadcast to
another hub. Count updates carry cumulative totals which are persisted before
being relayed, making the database the single source of truth.
"""

import json
import secrets
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.database import SessionLocal
from app.models.camera_station import CameraStation

router = APIRouter()

# Sent to a camera whose id or auth token is unknown/invalid.
CLOSE_UNAUTHORIZED = 4401
# Sent to a camera socket that was replaced by a newer connection.
CLOSE_REPLACED = 4400


class HubConnectionManager:
    """Manages WebSocket connections between cameras and hub dashboards"""

    def __init__(self):
        # Hub dashboards listening for updates, by hub id
        self.hub_dashboards: dict[int, list[WebSocket]] = {}
        # Camera stations connected, by camera id
        self.camera_connections: dict[int, WebSocket] = {}

    async def connect_hub(self, websocket: WebSocket, hub_id: int):
        """Register a hub dashboard"""
        await websocket.accept()
        self.hub_dashboards.setdefault(hub_id, []).append(websocket)

    def disconnect_hub(self, websocket: WebSocket, hub_id: int):
        """Unregister a hub dashboard"""
        connections = self.hub_dashboards.get(hub_id)
        if not connections:
            return
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            del self.hub_dashboards[hub_id]

    async def connect_camera(self, websocket: WebSocket, camera_id: int):
        """Register a camera station, replacing any previous connection"""
        await websocket.accept()
        previous = self.camera_connections.get(camera_id)
        self.camera_connections[camera_id] = websocket
        if previous is not None and previous is not websocket:
            try:
                await previous.close(code=CLOSE_REPLACED, reason="replaced")
            except Exception:
                pass

    def disconnect_camera(self, websocket: WebSocket, camera_id: int):
        """Unregister a camera station unless a newer connection took over"""
        if self.camera_connections.get(camera_id) is websocket:
            del self.camera_connections[camera_id]
            return True
        return False

    async def broadcast_to_hub(self, hub_id: int, message: dict):
        """Broadcast a message to all dashboards viewing this hub.

        Sockets that fail to receive are pruned so dead connections do not
        accumulate.
        """
        connections = self.hub_dashboards.get(hub_id)
        if not connections:
            return
        dead: list[WebSocket] = []
        for connection in list(connections):
            try:
                await connection.send_json(message)
            except Exception:
                dead.append(connection)
        for connection in dead:
            self.disconnect_hub(connection, hub_id)


hub_manager = HubConnectionManager()


def camera_payload(camera: CameraStation) -> dict:
    """Serializable snapshot of a camera for hub dashboards"""
    return {
        "id": camera.id,
        "name": camera.name,
        "location": camera.location,
        "total_in": camera.total_in,
        "total_out": camera.total_out,
    }


def get_camera_or_none(db, camera_id: int) -> CameraStation | None:
    return db.query(CameraStation).filter(CameraStation.id == camera_id).first()


@router.websocket("/hub/{hub_id}")
async def hub_websocket_endpoint(websocket: WebSocket, hub_id: int):
    """WebSocket endpoint for hub dashboards to receive camera updates"""
    await hub_manager.connect_hub(websocket, hub_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        hub_manager.disconnect_hub(websocket, hub_id)
    except Exception as e:
        print(f"Hub WebSocket error: {e}")
        hub_manager.disconnect_hub(websocket, hub_id)


def is_valid_count_update(message: dict) -> bool:
    """Validate the shape of a count_update message"""
    if message.get("type") != "count_update":
        return False
    if message.get("direction") not in ("in", "out"):
        return False
    counts = message.get("counts")
    if not isinstance(counts, dict):
        return False
    for key in ("total_in", "total_out"):
        value = counts.get(key)
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            return False
    return True


@router.websocket("/camera/{camera_id}")
async def camera_websocket_endpoint(websocket: WebSocket, camera_id: int, token: str = ""):
    """WebSocket endpoint for camera stations to send count updates.

    The camera must present the auth token issued at pairing time. Its hub is
    resolved from the database so counts can only ever reach its own hub.
    """
    db = SessionLocal()
    try:
        camera = get_camera_or_none(db, camera_id)
        if camera is None or not secrets.compare_digest(camera.auth_token, token):
            await websocket.accept()
            await websocket.close(code=CLOSE_UNAUTHORIZED, reason="invalid camera or token")
            return

        hub_id = camera.hub_session_id
    finally:
        db.close()

    await hub_manager.connect_camera(websocket, camera_id)

    # Mark the camera online and notify hub dashboards
    db = SessionLocal()
    try:
        camera = get_camera_or_none(db, camera_id)
        if camera is None:
            await websocket.close(code=CLOSE_UNAUTHORIZED, reason="camera deleted")
            return
        camera.is_connected = True
        camera.last_heartbeat = datetime.utcnow()
        db.commit()
        await hub_manager.broadcast_to_hub(
            hub_id, {"type": "camera_online", "camera_id": camera_id}
        )
    finally:
        db.close()

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except (json.JSONDecodeError, TypeError):
                await websocket.send_json({"type": "error", "error": "invalid_json"})
                continue

            msg_type = message.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg_type == "heartbeat":
                db = SessionLocal()
                try:
                    camera = get_camera_or_none(db, camera_id)
                    if camera:
                        camera.last_heartbeat = datetime.utcnow()
                        db.commit()
                finally:
                    db.close()
                await websocket.send_json({"type": "heartbeat_ack"})

            elif msg_type == "count_update":
                if not is_valid_count_update(message):
                    await websocket.send_json({"type": "error", "error": "invalid_count_update"})
                    continue

                counts = message["counts"]
                db = SessionLocal()
                try:
                    camera = get_camera_or_none(db, camera_id)
                    if camera is None:
                        await websocket.close(code=CLOSE_UNAUTHORIZED, reason="camera deleted")
                        return
                    camera.total_in = counts["total_in"]
                    camera.total_out = counts["total_out"]
                    db.commit()
                finally:
                    db.close()

                await hub_manager.broadcast_to_hub(
                    hub_id,
                    {
                        "type": "count_update",
                        "camera_id": camera_id,
                        "hub_id": hub_id,
                        "direction": message["direction"],
                        "counts": dict(counts),
                    },
                )
            else:
                await websocket.send_json({"type": "error", "error": "unknown_message_type"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Camera WebSocket error: {e}")
    finally:
        if hub_manager.disconnect_camera(websocket, camera_id):
            db = SessionLocal()
            try:
                camera = get_camera_or_none(db, camera_id)
                if camera:
                    camera.is_connected = False
                    db.commit()
            finally:
                db.close()
            await hub_manager.broadcast_to_hub(
                hub_id, {"type": "camera_offline", "camera_id": camera_id}
            )

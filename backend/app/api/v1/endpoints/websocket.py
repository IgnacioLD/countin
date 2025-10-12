from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
from datetime import datetime
import json
from app.core.database import SessionLocal
from app.models.camera_station import CameraStation

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""

    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: int):
        """Connect a client to a session"""
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, websocket: WebSocket, session_id: int):
        """Disconnect a client from a session"""
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast_to_session(self, session_id: int, message: dict):
        """Broadcast a message to all clients in a session"""
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error broadcasting to client: {e}")


class HubConnectionManager:
    """Manages WebSocket connections between cameras and hub dashboards"""

    def __init__(self):
        # Hub dashboards listening for updates
        self.hub_dashboards: Dict[int, List[WebSocket]] = {}
        # Camera stations connected to hubs
        self.camera_connections: Dict[int, WebSocket] = {}

    async def connect_hub(self, websocket: WebSocket, hub_id: int):
        """Connect a hub dashboard"""
        await websocket.accept()
        if hub_id not in self.hub_dashboards:
            self.hub_dashboards[hub_id] = []
        self.hub_dashboards[hub_id].append(websocket)

    async def connect_camera(self, websocket: WebSocket, camera_id: int):
        """Connect a camera station"""
        await websocket.accept()
        self.camera_connections[camera_id] = websocket

    def disconnect_hub(self, websocket: WebSocket, hub_id: int):
        """Disconnect a hub dashboard"""
        if hub_id in self.hub_dashboards:
            self.hub_dashboards[hub_id].remove(websocket)
            if not self.hub_dashboards[hub_id]:
                del self.hub_dashboards[hub_id]

    def disconnect_camera(self, camera_id: int):
        """Disconnect a camera station"""
        if camera_id in self.camera_connections:
            del self.camera_connections[camera_id]

    async def broadcast_to_hub(self, hub_id: int, message: dict):
        """Broadcast a message to all dashboards viewing this hub"""
        if hub_id in self.hub_dashboards:
            for connection in self.hub_dashboards[hub_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error broadcasting to hub dashboard: {e}")


manager = ConnectionManager()
hub_manager = HubConnectionManager()


@router.websocket("/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: int):
    """WebSocket endpoint for real-time session updates"""
    await manager.connect(websocket, session_id)
    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_text()
            message = json.loads(data)

            # Handle different message types
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif message.get("type") == "event":
                # Broadcast event to all clients in this session
                await manager.broadcast_to_session(session_id, message)

    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, session_id)


# Helper function to broadcast from API endpoints
async def broadcast_event(session_id: int, event_type: str, data: dict):
    """Helper to broadcast events from other endpoints"""
    message = {"type": event_type, "data": data}
    await manager.broadcast_to_session(session_id, message)


@router.websocket("/hub/{hub_id}")
async def hub_websocket_endpoint(websocket: WebSocket, hub_id: int):
    """WebSocket endpoint for hub dashboard to receive camera updates"""
    await hub_manager.connect_hub(websocket, hub_id)
    try:
        while True:
            # Hub dashboards only receive, they don't send
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        hub_manager.disconnect_hub(websocket, hub_id)
    except Exception as e:
        print(f"Hub WebSocket error: {e}")
        hub_manager.disconnect_hub(websocket, hub_id)


@router.websocket("/camera/{camera_id}")
async def camera_websocket_endpoint(websocket: WebSocket, camera_id: int):
    """WebSocket endpoint for camera stations to send count updates"""
    await hub_manager.connect_camera(websocket, camera_id)

    # Mark camera as connected in database
    db = SessionLocal()
    try:
        camera = db.query(CameraStation).filter(CameraStation.id == camera_id).first()
        if camera:
            camera.is_connected = True
            camera.last_heartbeat = datetime.utcnow()
            db.commit()
    finally:
        db.close()

    try:
        while True:
            # Receive count events from camera
            data = await websocket.receive_text()
            message = json.loads(data)

            # Broadcast to hub dashboards
            if message.get("type") == "count_update":
                # Message should include: camera_id, hub_id, direction, counts
                hub_id = message.get("hub_id")
                if hub_id:
                    await hub_manager.broadcast_to_hub(hub_id, message)

            elif message.get("type") == "heartbeat":
                # Update heartbeat timestamp in database
                db = SessionLocal()
                try:
                    camera = db.query(CameraStation).filter(CameraStation.id == camera_id).first()
                    if camera:
                        camera.last_heartbeat = datetime.utcnow()
                        db.commit()
                finally:
                    db.close()

                # Acknowledge heartbeat
                await websocket.send_json({"type": "heartbeat_ack"})

    except WebSocketDisconnect:
        hub_manager.disconnect_camera(camera_id)
        # Mark camera as disconnected in database
        db = SessionLocal()
        try:
            camera = db.query(CameraStation).filter(CameraStation.id == camera_id).first()
            if camera:
                camera.is_connected = False
                db.commit()
        finally:
            db.close()
    except Exception as e:
        print(f"Camera WebSocket error: {e}")
        hub_manager.disconnect_camera(camera_id)
        # Mark camera as disconnected in database
        db = SessionLocal()
        try:
            camera = db.query(CameraStation).filter(CameraStation.id == camera_id).first()
            if camera:
                camera.is_connected = False
                db.commit()
        finally:
            db.close()


# Helper function to broadcast hub updates
async def broadcast_to_hub(hub_id: int, event_type: str, data: dict):
    """Helper to broadcast events to hub dashboards"""
    message = {"type": event_type, "data": data}
    await hub_manager.broadcast_to_hub(hub_id, message)

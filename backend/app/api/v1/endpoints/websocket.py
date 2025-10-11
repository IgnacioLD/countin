from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import json

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


manager = ConnectionManager()


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

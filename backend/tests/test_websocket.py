"""WebSocket flow between camera stations and hub dashboards."""

import time

import pytest
from starlette.websockets import WebSocketDisconnect

from app.core.database import SessionLocal
from app.models.camera_station import CameraStation


def get_camera(camera_id):
    db = SessionLocal()
    try:
        return db.query(CameraStation).filter(CameraStation.id == camera_id).first()
    finally:
        db.close()


def camera_ws(client, camera, token=None):
    token = token if token is not None else camera["auth_token"]
    return client.websocket_connect(f"/api/v1/ws/camera/{camera['id']}?token={token}")


def wait_until(condition, timeout=5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if condition():
            return True
        time.sleep(0.05)
    return condition()


def test_hub_ws_answers_ping(client, hub):
    with client.websocket_connect(f"/api/v1/ws/hub/{hub['id']}") as ws:
        ws.send_json({"type": "ping"})
        assert ws.receive_json() == {"type": "pong"}


class TestCameraAuthentication:
    def test_connect_without_token_is_rejected(self, client, hub, camera):
        # The server accepts, then immediately closes with 4401
        with camera_ws(client, camera, token="") as ws:
            with pytest.raises(WebSocketDisconnect) as exc_info:
                ws.receive_json()
        assert exc_info.value.code == 4401

    def test_connect_with_wrong_token_is_rejected(self, client, hub, camera):
        with camera_ws(client, camera, token="wrong-token") as ws:
            with pytest.raises(WebSocketDisconnect) as exc_info:
                ws.receive_json()
        assert exc_info.value.code == 4401

    def test_unknown_camera_is_rejected(self, client, hub):
        with client.websocket_connect("/api/v1/ws/camera/999?token=anything") as ws:
            with pytest.raises(WebSocketDisconnect) as exc_info:
                ws.receive_json()
        assert exc_info.value.code == 4401


class TestLifecycleEvents:
    def test_pair_notifies_hub_instantly(self, client, hub):
        with client.websocket_connect(f"/api/v1/ws/hub/{hub['id']}") as hub_ws:
            resp = client.post(
                "/api/v1/cameras/pair",
                json={"pairing_code": hub["pairing_code"], "camera_name": "Instant Cam"},
            )
            assert resp.status_code == 201

            message = hub_ws.receive_json()
            assert message["type"] == "camera_paired"
            assert message["camera"]["name"] == "Instant Cam"
            assert message["camera"]["total_in"] == 0

    def test_connect_and_disconnect_notify_hub(self, client, hub, camera):
        with client.websocket_connect(f"/api/v1/ws/hub/{hub['id']}") as hub_ws:
            with camera_ws(client, camera):
                online = hub_ws.receive_json()
                assert online == {"type": "camera_online", "camera_id": camera["id"]}
                assert get_camera(camera["id"]).is_connected is True

                wait_until(lambda: get_camera(camera["id"]).last_heartbeat is not None)

            offline = hub_ws.receive_json()
            assert offline == {"type": "camera_offline", "camera_id": camera["id"]}
            assert wait_until(lambda: get_camera(camera["id"]).is_connected is False)

    def test_replaced_connection_keeps_camera_online(self, client, hub, camera):
        with client.websocket_connect(f"/api/v1/ws/hub/{hub['id']}") as hub_ws:
            with camera_ws(client, camera) as first:
                assert hub_ws.receive_json()["type"] == "camera_online"

                # A second connection for the same camera replaces the first
                with camera_ws(client, camera):
                    assert hub_ws.receive_json()["type"] == "camera_online"

                    with pytest.raises(WebSocketDisconnect) as exc_info:
                        first.receive_json()
                    assert exc_info.value.code == 4400

                    # First socket closing must NOT take the camera offline
                    assert get_camera(camera["id"]).is_connected is True

            assert wait_until(lambda: get_camera(camera["id"]).is_connected is False)


class TestCountUpdates:
    def test_count_update_persists_and_relays_to_hub(self, client, hub, camera):
        with client.websocket_connect(f"/api/v1/ws/hub/{hub['id']}") as hub_ws:
            with camera_ws(client, camera) as cam_ws:
                hub_ws.receive_json()  # camera_online

                cam_ws.send_json(
                    {
                        "type": "count_update",
                        "direction": "in",
                        "counts": {"total_in": 3, "total_out": 1},
                    }
                )
                message = hub_ws.receive_json()
                assert message["type"] == "count_update"
                assert message["camera_id"] == camera["id"]
                assert message["hub_id"] == hub["id"]
                assert message["direction"] == "in"
                assert message["counts"] == {"total_in": 3, "total_out": 1}

        stored = get_camera(camera["id"])
        assert stored.total_in == 3
        assert stored.total_out == 1

    def test_spoofed_hub_id_is_ignored(self, client, hub, camera):
        other = client.post("/api/v1/hubs", json={"name": "Other Hub"}).json()

        with client.websocket_connect(f"/api/v1/ws/hub/{hub['id']}") as real_hub_ws:
            with client.websocket_connect(f"/api/v1/ws/hub/{other['id']}") as other_hub_ws:
                with camera_ws(client, camera) as cam_ws:
                    real_hub_ws.receive_json()  # camera_online
                    cam_ws.send_json(
                        {
                            "type": "count_update",
                            "hub_id": other["id"],  # spoof attempt
                            "direction": "in",
                            "counts": {"total_in": 1, "total_out": 0},
                        }
                    )
                    # The update lands on the camera's real hub, not the spoofed one
                    assert real_hub_ws.receive_json()["hub_id"] == hub["id"]

                    # If the spoofed hub had (wrongly) received the count, it
                    # would be queued before this pong.
                    other_hub_ws.send_json({"type": "ping"})
                    assert other_hub_ws.receive_json() == {"type": "pong"}

    def test_invalid_count_updates_are_rejected_without_persisting(self, client, hub, camera):
        invalid_payloads = [
            {
                "type": "count_update",
                "direction": "sideways",
                "counts": {"total_in": 1, "total_out": 0},
            },
            {
                "type": "count_update",
                "direction": "in",
                "counts": {"total_in": -1, "total_out": 0},
            },
            {
                "type": "count_update",
                "direction": "in",
                "counts": {"total_in": "3", "total_out": 0},
            },
            {"type": "count_update", "direction": "in"},
        ]
        with camera_ws(client, camera) as cam_ws:
            for payload in invalid_payloads:
                cam_ws.send_json(payload)
                reply = cam_ws.receive_json()
                assert reply == {"type": "error", "error": "invalid_count_update"}

        stored = get_camera(camera["id"])
        assert stored.total_in == 0
        assert stored.total_out == 0

    def test_malformed_json_gets_error_not_disconnect(self, client, hub, camera):
        with camera_ws(client, camera) as cam_ws:
            cam_ws.send_text("not json at all")
            assert cam_ws.receive_json() == {"type": "error", "error": "invalid_json"}

            # The connection still works afterwards
            cam_ws.send_json({"type": "heartbeat"})
            assert cam_ws.receive_json() == {"type": "heartbeat_ack"}

    def test_unknown_message_type_gets_error(self, client, hub, camera):
        with camera_ws(client, camera) as cam_ws:
            cam_ws.send_json({"type": "mystery"})
            assert cam_ws.receive_json() == {"type": "error", "error": "unknown_message_type"}


class TestHeartbeat:
    def test_heartbeat_is_acknowledged(self, client, hub, camera):
        with camera_ws(client, camera) as ws:
            ws.send_json({"type": "heartbeat"})
            assert ws.receive_json() == {"type": "heartbeat_ack"}

        assert get_camera(camera["id"]).last_heartbeat is not None

    def test_camera_ws_answers_ping(self, client, hub, camera):
        with camera_ws(client, camera) as ws:
            ws.send_json({"type": "ping"})
            assert ws.receive_json() == {"type": "pong"}

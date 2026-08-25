"""Camera station REST endpoints."""


class TestPairing:
    def test_pair_with_code(self, client, hub):
        resp = client.post(
            "/api/v1/cameras/pair",
            json={
                "pairing_code": hub["pairing_code"],
                "camera_name": "Entrance",
                "camera_location": "Lobby",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["hub_session_id"] == hub["id"]
        assert data["name"] == "Entrance"
        assert data["location"] == "Lobby"
        # Cameras are online only once their WebSocket connects
        assert data["is_connected"] is False
        assert data["total_in"] == 0
        assert data["total_out"] == 0

    def test_pair_returns_auth_token_exactly_once(self, client, hub):
        resp = client.post(
            "/api/v1/cameras/pair",
            json={"pairing_code": hub["pairing_code"], "camera_name": "X"},
        )
        assert resp.status_code == 201
        token = resp.json()["auth_token"]
        assert isinstance(token, str) and len(token) >= 32

        fetched = client.get(f"/api/v1/cameras/{resp.json()['id']}")
        assert "auth_token" not in fetched.json()

    def test_pair_with_token(self, client, hub):
        resp = client.post(
            "/api/v1/cameras/pair",
            json={"pairing_token": hub["pairing_token"], "camera_name": "QR Cam"},
        )
        assert resp.status_code == 201
        assert resp.json()["hub_session_id"] == hub["id"]

    def test_pair_with_lowercase_code(self, client, hub):
        resp = client.post(
            "/api/v1/cameras/pair",
            json={"pairing_code": hub["pairing_code"].lower(), "camera_name": "X"},
        )
        assert resp.status_code == 201

    def test_pair_with_unknown_code_returns_404(self, client):
        resp = client.post(
            "/api/v1/cameras/pair",
            json={"pairing_code": "ZZZZZZ", "camera_name": "X"},
        )
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Hub not found or inactive"

    def test_pair_with_unknown_token_returns_404(self, client):
        resp = client.post(
            "/api/v1/cameras/pair",
            json={"pairing_token": "bogus", "camera_name": "X"},
        )
        assert resp.status_code == 404

    def test_pair_without_code_or_token_returns_404(self, client):
        resp = client.post("/api/v1/cameras/pair", json={"camera_name": "X"})
        assert resp.status_code == 404

    def test_pair_with_ended_hub_returns_404(self, client, hub):
        client.post(f"/api/v1/hubs/{hub['id']}/end")
        resp = client.post(
            "/api/v1/cameras/pair",
            json={"pairing_code": hub["pairing_code"], "camera_name": "X"},
        )
        assert resp.status_code == 404


class TestCameraManagement:
    def test_list_hub_cameras(self, client, hub, camera):
        cams = client.get(f"/api/v1/cameras/hub/{hub['id']}").json()
        assert [c["id"] for c in cams] == [camera["id"]]

    def test_get_camera(self, client, camera):
        resp = client.get(f"/api/v1/cameras/{camera['id']}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Cam 1"

    def test_get_unknown_camera_returns_404(self, client):
        assert client.get("/api/v1/cameras/999").status_code == 404

    def test_rename_camera(self, client, camera):
        resp = client.patch(f"/api/v1/cameras/{camera['id']}", json={"name": "Gate 2"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Gate 2"

    def test_delete_camera(self, client, camera):
        assert client.delete(f"/api/v1/cameras/{camera['id']}").status_code == 204
        assert client.get(f"/api/v1/cameras/{camera['id']}").status_code == 404


class TestStaleCameras:
    def test_stale_heartbeat_marks_camera_offline(self, client, hub, camera):
        from datetime import datetime, timedelta

        from app.core.database import SessionLocal
        from app.models.camera_station import CameraStation

        camera_id = camera["id"]
        db = SessionLocal()
        try:
            db_camera = db.query(CameraStation).filter(CameraStation.id == camera_id).first()
            db_camera.is_connected = True
            db_camera.last_heartbeat = datetime.utcnow() - timedelta(minutes=5)
            db.commit()
        finally:
            db.close()

        cams = client.get(f"/api/v1/cameras/hub/{hub['id']}").json()
        assert cams[0]["is_connected"] is False

    def test_fresh_heartbeat_stays_online(self, client, hub, camera):
        from datetime import datetime

        from app.core.database import SessionLocal
        from app.models.camera_station import CameraStation

        camera_id = camera["id"]
        db = SessionLocal()
        try:
            db_camera = db.query(CameraStation).filter(CameraStation.id == camera_id).first()
            db_camera.is_connected = True
            db_camera.last_heartbeat = datetime.utcnow()
            db.commit()
        finally:
            db.close()

        cams = client.get(f"/api/v1/cameras/hub/{hub['id']}").json()
        assert cams[0]["is_connected"] is True

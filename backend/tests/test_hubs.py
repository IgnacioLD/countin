"""Hub session REST endpoints."""


def test_create_hub_returns_pairing_credentials(client):
    resp = client.post("/api/v1/hubs", json={"name": "Main Hub"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Main Hub"
    assert data["is_active"] is True
    # Pairing code is exactly 6 uppercase alphanumeric characters
    code = data["pairing_code"]
    assert len(code) == 6
    assert code.isalnum() and code.isupper()
    # Pairing token is only exposed on creation
    token = data["pairing_token"]
    assert isinstance(token, str) and len(token) >= 32


def test_pairing_token_not_exposed_after_creation(client, hub):
    resp = client.get(f"/api/v1/hubs/{hub['id']}")
    assert resp.status_code == 200
    assert "pairing_token" not in resp.json()


def test_get_hub_by_code_is_case_insensitive(client, hub):
    resp = client.get(f"/api/v1/hubs/code/{hub['pairing_code'].lower()}")
    assert resp.status_code == 200
    assert resp.json()["id"] == hub["id"]


def test_get_hub_by_unknown_code_returns_404(client):
    resp = client.get("/api/v1/hubs/code/ZZZZZZ")
    assert resp.status_code == 404


def test_get_hub_by_token(client, hub):
    resp = client.get(f"/api/v1/hubs/token/{hub['pairing_token']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == hub["id"]


def test_get_hub_by_unknown_token_returns_404(client):
    resp = client.get("/api/v1/hubs/token/not-a-real-token")
    assert resp.status_code == 404


def test_inactive_hub_rejects_code_and_token_lookups(client, hub):
    assert client.post(f"/api/v1/hubs/{hub['id']}/end").status_code == 200

    by_code = client.get(f"/api/v1/hubs/code/{hub['pairing_code']}")
    by_token = client.get(f"/api/v1/hubs/token/{hub['pairing_token']}")
    assert by_code.status_code == 400
    assert by_token.status_code == 400


def test_list_sessions_filter_active_only(client, hub):
    client.post("/api/v1/hubs", json={"name": "Second Hub"})
    client.post(f"/api/v1/hubs/{hub['id']}/end")

    resp = client.get("/api/v1/hubs", params={"active_only": True})
    assert resp.status_code == 200
    assert [h["name"] for h in resp.json()] == ["Second Hub"]

    resp = client.get("/api/v1/hubs")
    assert {h["name"] for h in resp.json()} == {"Test Hub", "Second Hub"}


def test_stats_aggregates_across_cameras(client, hub):
    cam_a = client.post(
        "/api/v1/cameras/pair",
        json={"pairing_code": hub["pairing_code"], "camera_name": "A"},
    ).json()
    cam_b = client.post(
        "/api/v1/cameras/pair",
        json={"pairing_code": hub["pairing_code"], "camera_name": "B"},
    ).json()

    def sync_counts(cam, total_in, total_out):
        with client.websocket_connect(
            f"/api/v1/ws/camera/{cam['id']}?token={cam['auth_token']}"
        ) as ws:
            ws.send_json(
                {"type": "count_update", "direction": "in",
                 "counts": {"total_in": total_in, "total_out": total_out}}
            )

    sync_counts(cam_a, 2, 0)
    sync_counts(cam_b, 0, 1)

    stats = client.get(f"/api/v1/hubs/{hub['id']}/stats").json()
    assert stats["total_cameras"] == 2
    assert stats["connected_cameras"] == 0  # no camera kept its WS open
    assert stats["total_in"] == 2
    assert stats["total_out"] == 1
    assert stats["total_count"] == 3


def test_stats_unknown_hub_returns_404(client):
    assert client.get("/api/v1/hubs/999/stats").status_code == 404


def test_pairing_code_collision_retries(client, hub, monkeypatch):
    from app.api.v1.endpoints import hub_sessions

    # First generator call collides with the existing hub, second is unique
    codes = iter([hub["pairing_code"], "ZZZZZZ"])
    monkeypatch.setattr(hub_sessions, "generate_pairing_code", lambda length=6: next(codes))

    resp = client.post("/api/v1/hubs", json={"name": "Collide Once"})
    assert resp.status_code == 201
    assert resp.json()["pairing_code"] == "ZZZZZZ"


def test_pairing_code_collision_gives_up_gracefully(client, hub, monkeypatch):
    from app.api.v1.endpoints import hub_sessions

    monkeypatch.setattr(
        hub_sessions, "generate_pairing_code", lambda length=6: hub["pairing_code"]
    )

    resp = client.post("/api/v1/hubs", json={"name": "Always Collides"})
    assert resp.status_code == 503

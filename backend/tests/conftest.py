"""Shared test fixtures.

The DATABASE_URL environment variable must be set before any ``app.*`` module
is imported: the WebSocket endpoints build their own ``SessionLocal()``
sessions instead of receiving one through dependency injection, so the entire
application (not just ``get_db``) has to agree on one database. A file-based
SQLite database keeps every connection in the same store across threads.
"""

import os
import tempfile

_TEST_DIR = tempfile.mkdtemp(prefix="countin-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DIR}/countin-test.db"
os.environ["ENV"] = "development"

import pytest
from fastapi.testclient import TestClient

from app.core.database import Base, engine
from app.main import app  # noqa: E402 (imports register models and routes)

API = "/api/v1"


@pytest.fixture(autouse=True)
def fresh_db():
    """Give every test a clean schema."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def hub(client):
    """An active hub session, as created by the hub dashboard."""
    resp = client.post(f"{API}/hubs", json={"name": "Test Hub"})
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture
def camera(client, hub):
    """A camera station paired to ``hub`` via its pairing code."""
    resp = client.post(
        f"{API}/cameras/pair",
        json={
            "pairing_code": hub["pairing_code"],
            "camera_name": "Cam 1",
            "camera_location": "Front door",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()

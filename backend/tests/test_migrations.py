"""The bootstrap migration must handle both fresh and pre-alembic databases.

Deployments that existed before Alembic have all tables (created by the old
``create_all`` startup) but no ``alembic_version`` table and no
``camera_stations.auth_token`` column. Running ``alembic upgrade head`` on
such a database used to crash on CREATE TABLE; the migration is now defensive
and must bring a legacy database up to the current schema without data loss.
"""

import sqlite3
from pathlib import Path

from alembic import command
from alembic.config import Config

BACKEND_DIR = Path(__file__).resolve().parents[1]


def run_upgrade(db_url: str) -> None:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.set_main_option("sqlalchemy.url", db_url)
    command.upgrade(cfg, "head")


def test_fresh_database_gets_full_schema(tmp_path):
    db_path = tmp_path / "fresh.db"
    run_upgrade(f"sqlite:///{db_path}")

    conn = sqlite3.connect(db_path)
    try:
        tables = {
            r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        expected = {
            "sessions",
            "hub_sessions",
            "camera_stations",
            "counting_lines",
            "crossing_events",
            "count_snapshots",
            "alembic_version",
        }
        assert expected <= tables

        cols = {r[1] for r in conn.execute("PRAGMA table_info(camera_stations)")}
        assert "auth_token" in cols
        # NOT NULL is enforced on a fresh install
        col = next(
            r for r in conn.execute("PRAGMA table_info(camera_stations)") if r[1] == "auth_token"
        )
        assert col[3] == 1  # notnull
    finally:
        conn.close()


def test_legacy_database_gets_auth_token_backfilled(tmp_path):
    """A pre-alembic DB keeps its data and gains auth_token on its cameras."""
    db_path = tmp_path / "legacy.db"
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(
            """
            CREATE TABLE hub_sessions (
                id INTEGER PRIMARY KEY,
                name VARCHAR NOT NULL,
                description VARCHAR,
                pairing_code VARCHAR(6) NOT NULL UNIQUE,
                pairing_token VARCHAR NOT NULL UNIQUE,
                is_active BOOLEAN NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                metadata_json JSON
            );
            CREATE TABLE camera_stations (
                id INTEGER PRIMARY KEY,
                hub_session_id INTEGER NOT NULL REFERENCES hub_sessions(id),
                name VARCHAR NOT NULL,
                location VARCHAR,
                is_connected BOOLEAN NOT NULL,
                last_heartbeat TIMESTAMP,
                total_in INTEGER NOT NULL,
                total_out INTEGER NOT NULL,
                paired_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                metadata_json JSON
            );
            INSERT INTO hub_sessions (name, pairing_code, pairing_token, is_active)
                VALUES ('Legacy Hub', 'AAAAAA', 'legacy-token', 1);
            INSERT INTO camera_stations (hub_session_id, name, is_connected, total_in, total_out)
                VALUES (1, 'Legacy Cam', 1, 3, 2);
            """
        )
        conn.commit()
    finally:
        conn.close()

    run_upgrade(f"sqlite:///{db_path}")

    conn = sqlite3.connect(db_path)
    try:
        tables = {
            r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        assert "alembic_version" in tables

        cols = {r[1] for r in conn.execute("PRAGMA table_info(camera_stations)")}
        assert "auth_token" in cols

        row = conn.execute(
            "SELECT auth_token, total_in, total_out, name FROM camera_stations WHERE id = 1"
        ).fetchone()
        # Existing data is preserved and the camera has a usable secret
        assert row[0] is not None and len(row[0]) >= 32
        assert row[1] == 3
        assert row[2] == 2
        assert row[3] == "Legacy Cam"
    finally:
        conn.close()

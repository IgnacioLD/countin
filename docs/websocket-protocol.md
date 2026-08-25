# WebSocket Protocol

All messages are JSON. There are two endpoints:

- **Camera station**: `WS /api/v1/ws/camera/{camera_id}?token={auth_token}`
- **Hub dashboard**: `WS /api/v1/ws/hub/{hub_id}`

## Authentication

The camera's `auth_token` is a secret issued exactly once, in the response of
`POST /api/v1/cameras/pair`. The camera must present it as the `token` query
parameter when opening its WebSocket.

| Close code | Meaning |
|---|---|
| `4400` | Connection replaced by a newer connection for the same camera |
| `4401` | Unknown camera id, invalid token, or camera deleted by the hub |

The hub a camera belongs to is resolved from the database when the camera
connects. Any `hub_id` field in client messages is ignored, so a camera cannot
route counts to another hub.

## Camera -> Backend

| Message | Purpose |
|---|---|
| `{"type": "ping"}` | Liveness check; server replies `pong` |
| `{"type": "heartbeat"}` | Keep-alive; server replies `heartbeat_ack` and refreshes `last_heartbeat` |
| `{"type": "count_update", "direction": "in" \| "out", "counts": {"total_in": int, "total_out": int}}` | Report cumulative totals after a crossing |

`count_update` carries **cumulative totals**, not deltas. The backend persists
them to the camera's row before relaying, which makes the database the single
source of truth and lets a reconnect self-heal any missed updates.

Malformed JSON, unknown message types, and invalid `count_update` payloads get
`{"type": "error", "error": "<reason>"}` back; the connection stays open.

## Backend -> Hub dashboards

| Message | Purpose |
|---|---|
| `{"type": "pong"}` | Reply to `ping` |
| `{"type": "camera_paired", "camera": {id, name, location, total_in, total_out}}` | A camera was paired to this hub |
| `{"type": "camera_online", "camera_id": int}` | A camera's WebSocket connected |
| `{"type": "camera_offline", "camera_id": int}` | A camera's WebSocket disconnected |
| `{"type": "camera_removed", "camera_id": int}` | A camera was deleted from the hub; its socket was closed with 4401 |
| `{"type": "count_update", "camera_id": int, "hub_id": int, "direction": "in" \| "out", "counts": {total_in, total_out}}` | Live count relay |

## Online status

A camera is shown online while its WebSocket is connected. If the socket dies
without a clean close (dead battery, network loss), the backend marks the
camera offline once its `last_heartbeat` is older than 30 seconds. Hub
dashboards also poll `GET /api/v1/cameras/hub/{hub_id}` every 5 seconds as a
fallback channel.

from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError

import main

client = TestClient(main.app)


def test_ready_when_redis_answers(monkeypatch):
    monkeypatch.setattr(main.redis_client, "ping", lambda: True)
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json()["checks"]["redis"]["ok"] is True


def test_503_when_redis_is_down(monkeypatch):
    def down():
        raise RedisConnectionError("refused")
    monkeypatch.setattr(main.redis_client, "ping", down)
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json() == {
        "status": "unavailable",
        "checks": {"redis": {"ok": False, "error": "ConnectionError"}},
    }


def test_ready_is_public():
    """Heartbeat probes it without a session; the auth middleware must not 401 it."""
    assert client.get("/health/ready").status_code != 401

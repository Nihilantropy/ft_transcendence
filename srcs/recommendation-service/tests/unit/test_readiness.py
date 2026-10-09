from contextlib import asynccontextmanager

import pytest
from fastapi.testclient import TestClient

import src.main as main


class FakeEngine:
    def __init__(self, error=None):
        self.error = error

    @asynccontextmanager
    async def connect(self):
        if self.error:
            raise self.error

        class Conn:
            async def execute(self, _):
                return None
        yield Conn()


@pytest.mark.unit
def test_ready_when_db_answers(monkeypatch):
    monkeypatch.setattr(main, "engine", FakeEngine())
    response = TestClient(main.app).get("/health/ready")
    assert response.status_code == 200
    assert response.json()["checks"]["db"]["ok"] is True


@pytest.mark.unit
def test_503_when_db_is_down(monkeypatch):
    monkeypatch.setattr(main, "engine", FakeEngine(OSError("connection refused")))
    response = TestClient(main.app).get("/health/ready")
    assert response.status_code == 503
    assert response.json() == {
        "status": "unavailable",
        "checks": {"db": {"ok": False, "error": "OSError"}},
    }

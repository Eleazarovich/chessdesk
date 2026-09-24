from __future__ import annotations

import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import httpx
from sqlalchemy import select, text

from backend.database import TokenORM
from backend.main import app
from backend.store import TOKEN_TTL_SECONDS, Store, get_store
from backend.tests.test_api import auth, login, request


def test_tokens_are_hashed_and_expire_for_both_auth_transports(monkeypatch) -> None:
    now = int(time.time())
    monkeypatch.setattr("backend.store.time.time", lambda: now)
    token = login()
    store = get_store()
    with store.session_factory() as db:
        stored = db.scalar(select(TokenORM))
        assert stored.token != token
        assert len(stored.token) == 64
        assert stored.expires_at == now + TOKEN_TTL_SECONDS
    path = "/api/v1/coaches/coach-001/profile"
    assert request("GET", path, headers=auth(token)).status_code == 200
    monkeypatch.setattr("backend.store.time.time", lambda: now + TOKEN_TTL_SECONDS)
    assert request("GET", path, headers=auth(token)).status_code == 401
    assert request("GET", path, cookies={"chessdesk_session": token}).status_code == 401


def test_legacy_session_migration_preserves_business_records() -> None:
    store = get_store()
    clients = store.list_clients("coach-001")
    with store.engine.begin() as connection:
        connection.execute(text("DROP TABLE auth_tokens"))
        connection.execute(text("CREATE TABLE auth_tokens (token VARCHAR(128) PRIMARY KEY, user_id VARCHAR(64))"))
        connection.execute(text("INSERT INTO auth_tokens VALUES ('legacy-token', 'coach-001')"))
    migrated = Store(store.database_url)
    assert migrated.user_id_for_token("legacy-token") is None
    assert migrated.list_clients("coach-001") == clients
    migrated.issue_token("new-token", "coach-001")
    migrated.close()
    reopened = Store(store.database_url)
    assert reopened.user_id_for_token("new-token") == "coach-001"
    reopened.close()


def test_login_account_limit_rejects_before_password_hashing(monkeypatch) -> None:
    calls = []
    monkeypatch.setattr("backend.routers.auth.verify_password", lambda *args: calls.append(1) or False)
    payload = {"email": "thabo@chessops.co.za", "password": "wrong-password"}
    for _ in range(10):
        assert request("POST", "/api/v1/auth/login", json=payload).status_code == 401
    limited = request("POST", "/api/v1/auth/login", json=payload)
    assert limited.status_code == 429
    assert int(limited.headers["retry-after"]) > 0
    assert len(calls) == 10


def test_ip_limit_cannot_be_bypassed_with_random_emails_or_forwarded_headers() -> None:
    for index in range(31):
        response = request(
            "POST", "/api/v1/auth/login",
            json={"email": f"missing{index}@example.com", "password": "wrong-password"},
            headers={"X-Forwarded-For": f"192.0.2.{index}"},
        )
        assert response.status_code == (401 if index < 30 else 429)


def test_cloudfront_uses_rightmost_viewer_address(monkeypatch) -> None:
    monkeypatch.setenv("CHESSDESK_TRUST_CLOUDFRONT", "true")
    for index in range(31):
        response = request(
            "POST", "/api/v1/auth/login",
            json={"email": f"missing{index}@example.com", "password": "wrong-password"},
            headers={"X-Forwarded-For": f"192.0.2.{index}, 198.51.100.1"},
        )
        assert response.status_code == (401 if index < 30 else 429)


def test_signup_limit() -> None:
    for index in range(6):
        response = request("POST", "/api/v1/auth/signup", json={
            "name": "Audit User", "email": f"signup{index}@example.com", "password": "secure-password",
        })
        assert response.status_code == (201 if index < 5 else 429)


def test_rate_limit_is_atomic_persistent_and_expires(monkeypatch) -> None:
    now = int(time.time())
    monkeypatch.setattr("backend.store.time.time", lambda: now)
    store = get_store()
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: store.consume_auth_limit("test-bucket", 5, now + 60), range(20)))
    assert sum(results) == 5
    reopened = Store(store.database_url)
    assert not reopened.consume_auth_limit("test-bucket", 5, now + 60)
    monkeypatch.setattr("backend.store.time.time", lambda: now + 60)
    assert reopened.consume_auth_limit("test-bucket", 5, now + 120)
    reopened.close()


def test_id_allocation_is_atomic_across_threads() -> None:
    store = get_store()
    with ThreadPoolExecutor(max_workers=8) as pool:
        ids = list(pool.map(lambda _: store.next_id("coach"), range(30)))
    assert len(set(ids)) == 30


def test_auth_request_body_limit_handles_streamed_payloads() -> None:
    async def body():
        for _ in range(20):
            yield b"x" * 1024

    async def probe():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
            response = await client.post("/api/v1/auth/login", content=body())
            assert response.status_code == 413

    asyncio.run(probe())


def test_password_hashing_does_not_block_the_event_loop(monkeypatch) -> None:
    started, release = Event(), Event()

    def slow_verify(*_args):
        started.set()
        release.wait(3)
        return False

    monkeypatch.setattr("backend.routers.auth.verify_password", slow_verify)

    async def probe():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
            task = asyncio.create_task(client.post("/api/v1/auth/login", json={
                "email": "thabo@chessops.co.za", "password": "wrong-password",
            }))
            try:
                assert await asyncio.to_thread(started.wait, 2)
                health = await asyncio.wait_for(client.get("/health"), timeout=1)
                assert health.status_code == 200
                assert not task.done()
            finally:
                release.set()
                await task

    asyncio.run(probe())

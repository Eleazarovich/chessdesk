from __future__ import annotations

import os
import time
import uuid
from collections.abc import Iterator
from datetime import date
from typing import Any

import httpx
import pytest

from integration_tests.support import CoachAuth


@pytest.fixture(scope="session")
def compose_api_url() -> str:
    """Wait for the Compose app to expose its API before running scenarios."""

    base_url = os.getenv("CHESSDESK_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
    deadline = time.monotonic() + 30
    last_result = "the API did not respond"

    while time.monotonic() < deadline:
        try:
            response = httpx.get(f"{base_url}/api/v1/openapi.json", timeout=2)
            if response.status_code == 200:
                return base_url
            last_result = f"HTTP {response.status_code}: {response.text[:200]}"
        except httpx.HTTPError as exc:
            last_result = str(exc)
        time.sleep(0.5)

    pytest.fail(
        f"ChessDesk API at {base_url} did not become ready ({last_result}). "
        "Start it with `docker compose up --build -d` or set CHESSDESK_BASE_URL.",
        pytrace=False,
    )


@pytest.fixture
def api_client(compose_api_url: str) -> Iterator[httpx.Client]:
    with httpx.Client(base_url=compose_api_url, timeout=10) as client:
        yield client


@pytest.fixture
def demo_auth(api_client: httpx.Client) -> Iterator[CoachAuth]:
    response = api_client.post(
        "/api/v1/auth/login",
        json={"email": "thabo@chessops.co.za", "password": "chess2026!"},
    )
    assert response.status_code == 200, response.text
    auth = CoachAuth(coach_id=response.json()["id"], token=response.json()["access_token"])
    # Keep requests in this fixture explicitly authenticated by their headers.
    api_client.cookies.clear()

    yield auth

    api_client.post("/api/v1/auth/logout", headers=auth.headers)
    api_client.cookies.clear()


@pytest.fixture
def individual_client(
    api_client: httpx.Client,
    demo_auth: CoachAuth,
) -> Iterator[dict[str, Any]]:
    unique = uuid.uuid4().hex
    response = api_client.post(
        "/api/v1/clients",
        headers=demo_auth.headers,
        json={
            "coach_id": demo_auth.coach_id,
            "client_type": "individual",
            "display_name": f"Integration Student {unique[:8]}",
            "email": f"integration-student-{unique}@example.com",
            "whatsapp": "+27 72 000 0000",
            "preferred_communication": "email",
            "notifications_enabled": True,
            "notes": "Created by the Compose integration suite",
            "active": True,
            "individual_details": {
                "student_name": f"Integration Student {unique[:8]}",
                "school_name": "Integration Test School",
                "parent_name": "Integration Parent",
            },
        },
    )
    assert response.status_code == 201, response.text
    client = response.json()

    yield client

    api_client.delete(f"/api/v1/clients/{client['id']}", headers=demo_auth.headers)


@pytest.fixture
def integration_expense(
    api_client: httpx.Client,
    demo_auth: CoachAuth,
) -> Iterator[dict[str, Any]]:
    response = api_client.post(
        "/api/v1/expenses",
        headers=demo_auth.headers,
        json={
            "coach_id": demo_auth.coach_id,
            "date": date.today().isoformat(),
            "amount": 75,
            "category": "food",
            "description": "Integration test expense",
        },
    )
    assert response.status_code == 201, response.text
    expense = response.json()

    yield expense

    api_client.delete(f"/api/v1/expenses/{expense['id']}", headers=demo_auth.headers)

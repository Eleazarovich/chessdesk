from __future__ import annotations

from datetime import date, timedelta
from typing import Any
from uuid import uuid4

import httpx
import pytest

from integration_tests.support import CoachAuth


pytestmark = pytest.mark.integration


def test_compose_api_seeded_auth_and_logout(api_client: httpx.Client) -> None:
    api_client.cookies.clear()

    frontend = api_client.get("/")
    assert frontend.status_code == 200
    assert frontend.headers["content-type"].startswith("text/html")

    schema = api_client.get("/api/v1/openapi.json")
    assert schema.status_code == 200
    assert schema.json()["info"]["title"] == "ChessDesk Backend API"
    assert "/api/v1/clients" in schema.json()["paths"]

    unauthenticated = api_client.get("/api/v1/clients", params={"coach_id": "coach-001"})
    assert unauthenticated.status_code == 401
    assert unauthenticated.json()["code"] == "UNAUTHORIZED"

    login = api_client.post(
        "/api/v1/auth/login",
        json={"email": "thabo@chessops.co.za", "password": "chess2026!"},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    assert login.json()["id"] == "coach-001"
    assert login.headers["x-access-token"] == token
    assert "httponly" in login.headers["set-cookie"].lower()
    assert login.cookies["chessdesk_session"] == token

    # Exercise the bearer and cookie transports independently.
    api_client.cookies.clear()
    bearer_clients = api_client.get(
        "/api/v1/clients", params={"coach_id": "coach-001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert bearer_clients.status_code == 200
    assert len(bearer_clients.json()) >= 6
    assert any(client["id"] == "client-001" for client in bearer_clients.json())

    cookie_clients = api_client.get(
        "/api/v1/clients", params={"coach_id": "coach-001"},
        cookies={"chessdesk_session": token},
    )
    assert cookie_clients.status_code == 200
    assert len(cookie_clients.json()) >= 6
    assert any(client["id"] == "client-001" for client in cookie_clients.json())

    logged_out = api_client.post(
        "/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"},
    )
    assert logged_out.status_code == 204
    assert api_client.get(
        "/api/v1/clients", params={"coach_id": "coach-001"},
        headers={"Authorization": f"Bearer {token}"},
    ).status_code == 401
    assert api_client.get(
        "/api/v1/clients", params={"coach_id": "coach-001"},
        cookies={"chessdesk_session": token},
    ).status_code == 401


def test_signup_login_duplicate_email_and_account_isolation(api_client: httpx.Client) -> None:
    api_client.cookies.clear()
    email = f"integration-{uuid4().hex}@example.com"
    password = "integration-password-2026"
    signup = api_client.post(
        "/api/v1/auth/signup",
        json={"name": "Integration Coach", "email": email, "password": password},
    )
    assert signup.status_code == 201, signup.text
    coach_id = signup.json()["id"]
    signup_token = signup.json()["access_token"]
    api_client.cookies.clear()

    own_clients = api_client.get(
        "/api/v1/clients", params={"coach_id": coach_id},
        headers={"Authorization": f"Bearer {signup_token}"},
    )
    assert own_clients.status_code == 200
    assert own_clients.json() == []

    login = api_client.post(
        "/api/v1/auth/login", json={"email": email, "password": password},
    )
    assert login.status_code == 200, login.text
    login_token = login.json()["access_token"]
    api_client.cookies.clear()

    bad_password = api_client.post(
        "/api/v1/auth/login", json={"email": email, "password": "wrong-password"},
    )
    assert bad_password.status_code == 401
    duplicate = api_client.post(
        "/api/v1/auth/signup",
        json={"name": "Duplicate Coach", "email": email, "password": password},
    )
    assert duplicate.status_code == 409

    headers = {"Authorization": f"Bearer {login_token}"}
    foreign_list = api_client.get(
        "/api/v1/clients", params={"coach_id": "coach-001"}, headers=headers,
    )
    assert foreign_list.status_code == 403
    foreign_detail = api_client.get("/api/v1/clients/client-001", headers=headers)
    assert foreign_detail.status_code == 403

    invalid_session = api_client.post(
        "/api/v1/sessions", headers=headers, json={"coach_id": coach_id},
    )
    assert invalid_session.status_code == 400
    assert invalid_session.json()["code"] == "VALIDATION_ERROR"

    api_client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {signup_token}"})
    api_client.post("/api/v1/auth/logout", headers=headers)


def test_client_session_invoice_and_expense_lifecycle(
    api_client: httpx.Client,
    demo_auth: CoachAuth,
    individual_client: dict[str, Any],
    integration_expense: dict[str, Any],
) -> None:
    headers = demo_auth.headers
    client_id = individual_client["id"]

    detail = api_client.get(f"/api/v1/clients/{client_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["individual_details"]["school_name"] == "Integration Test School"
    assert detail.json()["outstanding_amount"] == 0

    session_date = (date.today() + timedelta(days=7)).isoformat()
    created_session = api_client.post(
        "/api/v1/sessions",
        headers=headers,
        json={
            "coach_id": demo_auth.coach_id,
            "client_id": client_id,
            "date": session_date,
            "start_time": "15:00",
            "planned_duration": 60,
            "actual_duration": None,
            "session_type": "online",
            "location": "",
            "status": "scheduled",
            "notes": "Integration workflow",
        },
    )
    assert created_session.status_code == 201, created_session.text
    session_id = created_session.json()["id"]
    reread_session = api_client.get(f"/api/v1/sessions/{session_id}", headers=headers)
    assert reread_session.status_code == 200
    assert reread_session.json()["client_id"] == client_id

    updated_session = api_client.patch(
        f"/api/v1/sessions/{session_id}",
        headers=headers,
        json={"status": "completed", "actual_duration": 55, "notes": "Completed in integration test"},
    )
    assert updated_session.status_code == 200
    assert updated_session.json()["status"] == "completed"
    assert updated_session.json()["actual_duration"] == 55

    invoice_date = date.today().isoformat()
    due_date = (date.today() + timedelta(days=7)).isoformat()
    created_invoice = api_client.post(
        "/api/v1/invoices",
        headers=headers,
        json={
            "coach_id": demo_auth.coach_id,
            "client_id": client_id,
            "invoice_date": invoice_date,
            "due_date": due_date,
            "amount": 650,
            "description": "Integration test lesson",
            "status": "unpaid",
            "paid_date": None,
            "payment_method": None,
            "payment_reference": "",
            "notes": "",
            "session_ids": [session_id],
        },
    )
    assert created_invoice.status_code == 201, created_invoice.text
    invoice_id = created_invoice.json()["id"]
    linked_sessions = api_client.get(f"/api/v1/invoices/{invoice_id}/sessions", headers=headers)
    assert linked_sessions.status_code == 200
    assert linked_sessions.json() == [session_id]

    paid_invoice = api_client.patch(
        f"/api/v1/invoices/{invoice_id}",
        headers=headers,
        json={"status": "paid", "paid_date": invoice_date, "payment_method": "eft"},
    )
    assert paid_invoice.status_code == 200
    assert paid_invoice.json()["status"] == "paid"
    listed_invoices = api_client.get(
        "/api/v1/invoices", params={"coach_id": demo_auth.coach_id}, headers=headers,
    )
    assert any(invoice["id"] == invoice_id for invoice in listed_invoices.json())

    expense_id = integration_expense["id"]
    updated_expense = api_client.patch(
        f"/api/v1/expenses/{expense_id}", headers=headers, json={"amount": 80},
    )
    assert updated_expense.status_code == 200
    assert updated_expense.json()["amount"] == 80

    deleted_expense = api_client.delete(f"/api/v1/expenses/{expense_id}", headers=headers)
    assert deleted_expense.status_code == 204
    listed_expenses = api_client.get(
        "/api/v1/expenses", params={"coach_id": demo_auth.coach_id}, headers=headers,
    )
    assert all(expense["id"] != expense_id for expense in listed_expenses.json())

    # Deleting a client also removes its dependent sessions and invoices.
    deleted_client = api_client.delete(f"/api/v1/clients/{client_id}", headers=headers)
    assert deleted_client.status_code == 204
    assert api_client.get(f"/api/v1/sessions/{session_id}", headers=headers).status_code == 404
    assert api_client.get(
        f"/api/v1/invoices/{invoice_id}/sessions", headers=headers,
    ).status_code == 404

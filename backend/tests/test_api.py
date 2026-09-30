from __future__ import annotations

import asyncio
from datetime import date, timedelta
from typing import Any

import httpx

from backend.main import app
from backend.store import get_store


def request(method: str, path: str, **kwargs: Any) -> httpx.Response:
    async def send() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.request(method, path, **kwargs)

    return asyncio.run(send())


def login(email: str = "thabo@chessops.co.za", password: str = "chess2026!") -> str:
    response = request("POST", "/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_auth_issues_bearer_token_and_logout_revokes_it() -> None:
    unauthenticated = request("GET", "/api/v1/clients", params={"coach_id": "coach-001"})
    assert unauthenticated.status_code == 401
    assert unauthenticated.json()["code"] == "UNAUTHORIZED"

    response = request(
        "POST", "/api/v1/auth/login",
        json={"email": "thabo@chessops.co.za", "password": "chess2026!"},
    )
    token = response.json()["access_token"]
    assert response.status_code == 200
    assert response.json()["id"] == "coach-001"
    assert response.headers["x-access-token"] == token
    assert "chessdesk_session=" in response.headers["set-cookie"]

    protected = request(
        "GET", "/api/v1/clients", params={"coach_id": "coach-001"}, headers=auth(token),
    )
    assert protected.status_code == 200
    assert len(protected.json()) == 6
    cookie_protected = request(
        "GET", "/api/v1/clients", params={"coach_id": "coach-001"},
        cookies={"chessdesk_session": response.cookies["chessdesk_session"]},
    )
    assert cookie_protected.status_code == 200

    logged_out = request("POST", "/api/v1/auth/logout", headers=auth(token))
    assert logged_out.status_code == 204
    revoked = request(
        "GET", "/api/v1/clients", params={"coach_id": "coach-001"}, headers=auth(token),
    )
    assert revoked.status_code == 401


def test_signup_hashes_password_and_rejects_duplicate_email() -> None:
    response = request(
        "POST", "/api/v1/auth/signup",
        json={"name": "Nandi Maseko", "email": "nandi@example.com", "password": "secure-pass-1"},
    )
    assert response.status_code == 201
    new_user_id = response.json()["id"]
    assert get_store().users[new_user_id].password_hash != "secure-pass-1"
    assert get_store().users[new_user_id].password_hash.startswith("scrypt$")
    assert login("nandi@example.com", "secure-pass-1")

    duplicate = request(
        "POST", "/api/v1/auth/signup",
        json={"name": "Another Nandi", "email": "nandi@example.com", "password": "secure-pass-2"},
    )
    assert duplicate.status_code == 409


def test_client_list_is_enriched_and_crud_preserves_details() -> None:
    token = login()
    clients = request("GET", "/api/v1/clients", params={"coach_id": "coach-001"}, headers=auth(token))
    first = clients.json()[0]
    assert clients.status_code == 200
    assert first["individual_details"]["parent_name"] == "Zanele Dlamini"
    assert first["upcoming_session"] == "2026-09-08 14:00"
    assert first["outstanding_amount"] == 800

    created = request(
        "POST", "/api/v1/clients", headers=auth(token),
        json={
            "coach_id": "coach-001", "client_type": "individual", "display_name": "Kabelo Mthembu",
            "email": "kabelo@example.com", "whatsapp": "+27 72 000 0000",
            "preferred_communication": "both", "notifications_enabled": True,
            "notes": "New student", "active": True,
            "individual_details": {"student_name": "Kabelo Mthembu", "school_name": "Durban Prep", "parent_name": "Lerato Mthembu"},
        },
    )
    assert created.status_code == 201
    client_id = created.json()["id"]
    updated = request(
        "PATCH", f"/api/v1/clients/{client_id}", headers=auth(token),
        json={"notifications_enabled": False, "notes": "Prefers email"},
    )
    assert updated.status_code == 200
    assert updated.json()["notifications_enabled"] is False
    detail = request("GET", f"/api/v1/clients/{client_id}", headers=auth(token))
    assert detail.json()["individual_details"]["student_name"] == "Kabelo Mthembu"

    deleted = request("DELETE", f"/api/v1/clients/{client_id}", headers=auth(token))
    assert deleted.status_code == 204
    assert request("GET", f"/api/v1/clients/{client_id}", headers=auth(token)).status_code == 404


def test_session_lifecycle_records_only_enabled_notifications() -> None:
    token = login()
    created = request(
        "POST", "/api/v1/sessions", headers=auth(token),
        json={
            "coach_id": "coach-001", "client_id": "client-001", "date": "2026-09-20",
            "start_time": "15:00", "planned_duration": 60, "actual_duration": None,
            "session_type": "online", "location": "", "status": "scheduled", "notes": "",
        },
    )
    assert created.status_code == 201
    session_id = created.json()["id"]
    assert get_store().notifications[-1]["type"] == "scheduled"

    moved = request(
        "PATCH", f"/api/v1/sessions/{session_id}", headers=auth(token),
        json={"date": "2026-09-21", "start_time": "16:00"},
    )
    assert moved.status_code == 200
    assert get_store().notifications[-1]["type"] == "updated"

    completed = request(
        "PATCH", f"/api/v1/sessions/{session_id}", headers=auth(token),
        json={"status": "completed", "actual_duration": 55, "notes": "Endgames"},
    )
    assert completed.status_code == 200
    assert get_store().notifications[-1]["type"] == "completed"

    disabled_before = len(get_store().notifications)
    disabled = request(
        "POST", "/api/v1/sessions", headers=auth(token),
        json={
            "coach_id": "coach-001", "client_id": "client-003", "date": "2026-09-22",
            "start_time": "10:00", "planned_duration": 45, "actual_duration": None,
            "session_type": "in-person", "location": "Client home", "status": "scheduled", "notes": "",
        },
    )
    assert disabled.status_code == 201
    assert len(get_store().notifications) == disabled_before


def test_group_session_is_shared_by_students_and_can_be_invoiced_per_student() -> None:
    token = login()
    created = request(
        "POST", "/api/v1/sessions", headers=auth(token),
        json={
            "coach_id": "coach-001", "client_id": "client-001",
            "participant_ids": ["client-001", "client-002"], "date": "2026-09-20",
            "start_time": "15:00", "planned_duration": 60, "actual_duration": None,
            "session_type": "online", "location": "", "status": "scheduled", "notes": "Group tactics",
        },
    )
    assert created.status_code == 201, created.text
    group_session = created.json()
    assert group_session["client_id"] == "client-001"
    assert group_session["participant_ids"] == ["client-001", "client-002"]

    fetched = request(
        "GET", f"/api/v1/sessions/{group_session['id']}", headers=auth(token),
    )
    assert fetched.status_code == 200
    assert fetched.json()["participant_ids"] == ["client-001", "client-002"]

    store = get_store()
    assert group_session["id"] in {session.id for session in store.sessions_for_client("client-001")}
    assert group_session["id"] in {session.id for session in store.sessions_for_client("client-002")}
    notifications = [item for item in store.notifications if item["session_id"] == group_session["id"]]
    assert {item["client_id"] for item in notifications} == {"client-001", "client-002"}

    invoice = request(
        "POST", "/api/v1/invoices", headers=auth(token),
        json={
            "coach_id": "coach-001", "client_id": "client-002", "invoice_date": "2026-09-20",
            "due_date": "2026-10-04", "amount": 300, "description": "Group session",
            "status": "unpaid", "paid_date": None, "payment_method": None,
            "payment_reference": "", "notes": "", "session_ids": [group_session["id"]],
        },
    )
    assert invoice.status_code == 201, invoice.text

    second_invoice = request(
        "POST", "/api/v1/invoices", headers=auth(token),
        json={
            "coach_id": "coach-001", "client_id": "client-001", "invoice_date": "2026-09-20",
            "due_date": "2026-10-04", "amount": 300, "description": "Group session",
            "status": "unpaid", "paid_date": None, "payment_method": None,
            "payment_reference": "", "notes": "", "session_ids": [group_session["id"]],
        },
    )
    assert second_invoice.status_code == 201, second_invoice.text

    moved = request(
        "PATCH", f"/api/v1/sessions/{group_session['id']}", headers=auth(token),
        json={"participant_ids": ["client-001", "client-003"]},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["participant_ids"] == ["client-001", "client-003"]
    assert group_session["id"] not in {session.id for session in store.sessions_for_client("client-002")}
    assert group_session["id"] in {session.id for session in store.sessions_for_client("client-003")}


def test_group_session_rejects_school_clients_mixed_with_students() -> None:
    token = login()
    created = request(
        "POST", "/api/v1/sessions", headers=auth(token),
        json={
            "coach_id": "coach-001", "client_id": "client-001",
            "participant_ids": ["client-001", "client-005"], "date": "2026-09-20",
            "start_time": "15:00", "planned_duration": 60, "actual_duration": None,
            "session_type": "online", "location": "", "status": "scheduled", "notes": "",
        },
    )
    assert created.status_code == 400
    assert created.json()["code"] == "INVALID_GROUP_PARTICIPANTS"


def test_client_session_history_paginates_and_includes_shared_group_sessions() -> None:
    token = login()
    as_of_date = date(2099, 1, 1)
    group_date = as_of_date - timedelta(days=2)
    individual_date = as_of_date - timedelta(days=1)
    group_response = request(
        "POST", "/api/v1/sessions", headers=auth(token),
        json={
            "coach_id": "coach-001", "client_id": "client-001",
            "participant_ids": ["client-001", "client-002"], "date": group_date.isoformat(),
            "start_time": "15:00", "planned_duration": 60, "actual_duration": None,
            "session_type": "online", "location": "", "status": "scheduled", "notes": "Shared tactics",
        },
    )
    assert group_response.status_code == 201, group_response.text
    group_session = group_response.json()

    later_response = request(
        "POST", "/api/v1/sessions", headers=auth(token),
        json={
            "coach_id": "coach-001", "client_id": "client-001", "date": individual_date.isoformat(),
            "start_time": "10:00", "planned_duration": 60, "actual_duration": None,
            "session_type": "online", "location": "", "status": "scheduled", "notes": "One-to-one",
        },
    )
    assert later_response.status_code == 201, later_response.text

    params = {
        "direction": "previous", "as_of_date": as_of_date.isoformat(),
        "as_of_time": "00:00", "limit": 1, "offset": 0,
    }
    first_page = request(
        "GET", "/api/v1/clients/client-001/sessions", headers=auth(token), params=params,
    )
    assert first_page.status_code == 200, first_page.text
    assert [session["id"] for session in first_page.json()["sessions"]] == [later_response.json()["id"]]
    assert first_page.json()["has_more"] is True

    second_page = request(
        "GET", "/api/v1/clients/client-001/sessions", headers=auth(token),
        params={**params, "offset": 1},
    )
    assert [session["id"] for session in second_page.json()["sessions"]] == [group_session["id"]]
    assert second_page.json()["has_more"] is True

    shared_client_history = request(
        "GET", "/api/v1/clients/client-002/sessions", headers=auth(token),
        params={**params, "limit": 50},
    )
    assert shared_client_history.status_code == 200, shared_client_history.text
    matching_group_sessions = [
        session for session in shared_client_history.json()["sessions"]
        if session["id"] == group_session["id"]
    ]
    assert len(matching_group_sessions) == 1
    assert matching_group_sessions[0]["participant_ids"] == ["client-001", "client-002"]

    invalid_time = request(
        "GET", "/api/v1/clients/client-001/sessions", headers=auth(token),
        params={**params, "as_of_time": "25:00"},
    )
    assert invalid_time.status_code == 400


def test_invoice_and_expense_routes_and_ownership() -> None:
    token = login()
    invoice_sessions = request(
        "GET", "/api/v1/invoices/inv-001/sessions", headers=auth(token),
    )
    assert invoice_sessions.status_code == 200
    assert invoice_sessions.json() == ["session-005", "session-010"]

    created_invoice = request(
        "POST", "/api/v1/invoices", headers=auth(token),
        json={
            "coach_id": "coach-001", "client_id": "client-001", "invoice_date": "2026-09-06",
            "due_date": "2026-09-13", "amount": 600, "description": "September sessions",
            "status": "unpaid", "paid_date": None, "payment_method": None,
            "payment_reference": "", "notes": "", "session_ids": ["session-001"],
        },
    )
    assert created_invoice.status_code == 201
    invoice_id = created_invoice.json()["id"]
    paid = request(
        "PATCH", f"/api/v1/invoices/{invoice_id}", headers=auth(token),
        json={
            "status": "paid", "paid_date": "2026-09-06", "payment_method": "eft",
            "payment_reference": "EFT-001",
        },
    )
    assert paid.status_code == 200
    assert paid.json()["status"] == "paid"
    assert paid.json()["paid_date"] == "2026-09-06"
    assert paid.json()["payment_method"] == "eft"
    assert paid.json()["payment_reference"] == "EFT-001"

    reversed_payment = request(
        "PATCH", f"/api/v1/invoices/{invoice_id}", headers=auth(token),
        json={
            "status": "unpaid", "paid_date": None, "payment_method": None,
            "payment_reference": "",
        },
    )
    assert reversed_payment.status_code == 200
    assert reversed_payment.json()["status"] == "unpaid"
    assert reversed_payment.json()["paid_date"] is None
    assert reversed_payment.json()["payment_method"] is None
    assert reversed_payment.json()["payment_reference"] == ""

    expense = request(
        "POST", "/api/v1/expenses", headers=auth(token),
        json={"coach_id": "coach-001", "date": "2026-09-06", "amount": 75, "category": "food", "description": "Lunch"},
    )
    assert expense.status_code == 201
    expense_id = expense.json()["id"]
    changed = request("PATCH", f"/api/v1/expenses/{expense_id}", headers=auth(token), json={"amount": 80})
    assert changed.status_code == 200
    assert changed.json()["amount"] == 80

    forbidden = request(
        "GET", "/api/v1/invoices", params={"coach_id": "another-coach"}, headers=auth(token),
    )
    assert forbidden.status_code == 403


def test_dashboard_profile_validation_and_openapi() -> None:
    token = login()
    dashboard = request(
        "GET", "/api/v1/dashboard", params={"coach_id": "coach-001", "filter": "this_month"}, headers=auth(token),
    )
    assert dashboard.status_code == 200
    body = dashboard.json()
    assert body["activity"]["active_individual_students"] == 3
    assert body["activity"]["active_schools"] == 2
    assert body["activity"]["upcoming_sessions"] == 4
    assert body["financials"]["outstanding"] == 3600
    assert len(body["revenue_chart"]) == 6
    assert len(body["sessions_chart"]) == 6

    profile = request("PATCH", "/api/v1/coaches/coach-001/profile", headers=auth(token), json={"business_name": "Nkosi Chess"})
    assert profile.status_code == 200
    assert profile.json()["business_name"] == "Nkosi Chess"

    invalid = request("POST", "/api/v1/sessions", headers=auth(token), json={"coach_id": "coach-001"})
    assert invalid.status_code == 400
    assert invalid.json()["code"] == "VALIDATION_ERROR"

    openapi = request("GET", "/api/v1/openapi.json")
    assert openapi.status_code == 200
    paths = openapi.json()["paths"]
    assert "/api/v1/clients" in paths
    assert "/api/v1/notifications" in paths

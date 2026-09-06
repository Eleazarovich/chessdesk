"""Shared route helpers for ownership and consistent API errors."""

from __future__ import annotations

from fastapi import HTTPException, status

from ..auth import require_owned_coach
from ..store import UserRecord, get_store


def ensure_coach(coach_id: str, current_user: UserRecord) -> None:
    require_owned_coach(coach_id, current_user)


def ensure_client(client_id: str, current_user: UserRecord):
    client = get_store().get_client(client_id)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Client not found", "code": "NOT_FOUND"},
        )
    ensure_coach(client.coach_id, current_user)
    return client


def ensure_session(session_id: str, current_user: UserRecord):
    session = get_store().get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Session not found", "code": "NOT_FOUND"},
        )
    ensure_coach(session.coach_id, current_user)
    return session


def ensure_invoice(invoice_id: str, current_user: UserRecord):
    invoice = get_store().get_invoice(invoice_id)
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Invoice not found", "code": "NOT_FOUND"},
        )
    ensure_coach(invoice.coach_id, current_user)
    return invoice


def ensure_expense(expense_id: str, current_user: UserRecord):
    expense = get_store().get_expense(expense_id)
    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Expense not found", "code": "NOT_FOUND"},
        )
    ensure_coach(expense.coach_id, current_user)
    return expense

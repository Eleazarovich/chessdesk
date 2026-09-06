"""Invoice routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..auth import get_current_user
from ..models import Invoice, InvoiceCreateRequest, InvoiceUpdateRequest
from ..store import UserRecord, get_store
from .common import ensure_client, ensure_coach, ensure_invoice

router = APIRouter(prefix="/invoices", tags=["Invoices"])


def _validate_session_ids(session_ids: list[str], coach_id: str, client_id: str) -> None:
    store = get_store()
    for session_id in session_ids:
        session = store.get_session(session_id)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": f"Session {session_id} not found", "code": "INVALID_SESSION"},
            )
        if session.coach_id != coach_id or session.client_id != client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Invoice sessions must belong to its client", "code": "SESSION_CLIENT_MISMATCH"},
            )


@router.get("", response_model=list[Invoice], operation_id="getInvoices")
async def list_invoices(
    coach_id: str,
    current_user: UserRecord = Depends(get_current_user),
) -> list[Invoice]:
    ensure_coach(coach_id, current_user)
    return get_store().list_invoices(coach_id)


@router.post("", response_model=Invoice, status_code=status.HTTP_201_CREATED, operation_id="createInvoice")
async def create_invoice(
    payload: InvoiceCreateRequest,
    current_user: UserRecord = Depends(get_current_user),
) -> Invoice:
    ensure_coach(payload.coach_id, current_user)
    ensure_client(payload.client_id, current_user)
    _validate_session_ids(payload.session_ids, payload.coach_id, payload.client_id)
    store = get_store()
    invoice = Invoice(
        id=store.next_id("inv"),
        **payload.model_dump(exclude={"session_ids"}),
    )
    store.save_invoice(invoice, payload.session_ids)
    return invoice


@router.patch("/{invoiceId}", response_model=Invoice, operation_id="updateInvoice")
async def update_invoice(
    invoiceId: str,
    payload: InvoiceUpdateRequest,
    current_user: UserRecord = Depends(get_current_user),
) -> Invoice:
    old_invoice = ensure_invoice(invoiceId, current_user)
    updates = payload.model_dump(exclude_unset=True)
    client_id = updates.get("client_id", old_invoice.client_id)
    ensure_client(client_id, current_user)
    session_ids = updates.pop("session_ids", None)
    if session_ids is None:
        session_ids = get_store().invoice_session_ids(invoiceId)
    _validate_session_ids(session_ids, old_invoice.coach_id, client_id)
    updated = Invoice.model_validate({**old_invoice.model_dump(), **updates})
    store = get_store()
    store.save_invoice(updated, session_ids)
    return updated


@router.delete("/{invoiceId}", status_code=status.HTTP_204_NO_CONTENT, operation_id="deleteInvoice")
async def delete_invoice(
    invoiceId: str,
    response: Response,
    current_user: UserRecord = Depends(get_current_user),
) -> None:
    ensure_invoice(invoiceId, current_user)
    get_store().delete_invoice(invoiceId)
    response.status_code = status.HTTP_204_NO_CONTENT
    return None


@router.get("/{invoiceId}/sessions", response_model=list[str], operation_id="getSessionsForInvoice")
async def get_sessions_for_invoice(
    invoiceId: str,
    current_user: UserRecord = Depends(get_current_user),
) -> list[str]:
    ensure_invoice(invoiceId, current_user)
    return get_store().invoice_session_ids(invoiceId)

"""Client management routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..auth import get_current_user
from ..models import (
    Client,
    ClientCreateRequest,
    ClientUpdateRequest,
    ClientWithDetails,
    IndividualStudentDetails,
    SchoolDetails,
)
from ..store import UserRecord, get_store
from .common import ensure_client, ensure_coach

router = APIRouter(prefix="/clients", tags=["Clients"])


def enrich_client(client: Client) -> ClientWithDetails:
    store = get_store()
    upcoming = sorted(
        (
            session for session in store.sessions.values()
            if session.client_id == client.id
            and session.status.value == "scheduled"
            and session.date >= store.today()
        ),
        key=lambda session: (session.date, session.start_time),
    )
    outstanding = sum(
        invoice.amount for invoice in store.invoices.values()
        if invoice.client_id == client.id and invoice.status.value == "unpaid"
    )
    return ClientWithDetails(
        **client.model_dump(),
        individual_details=store.individual_details.get(client.id),
        school_details=store.school_details.get(client.id),
        upcoming_session=(
            f"{upcoming[0].date.isoformat()} {upcoming[0].start_time}" if upcoming else None
        ),
        outstanding_amount=outstanding,
    )


@router.get("", response_model=list[ClientWithDetails], operation_id="getClients")
async def list_clients(
    coach_id: str,
    current_user: UserRecord = Depends(get_current_user),
) -> list[ClientWithDetails]:
    ensure_coach(coach_id, current_user)
    store = get_store()
    return [enrich_client(client) for client in store.clients.values() if client.coach_id == coach_id]


@router.post("", response_model=Client, status_code=status.HTTP_201_CREATED, operation_id="createClient")
async def create_client(
    payload: ClientCreateRequest,
    current_user: UserRecord = Depends(get_current_user),
) -> Client:
    ensure_coach(payload.coach_id, current_user)
    store = get_store()
    client_id = store.next_id("client")
    client = Client(
        id=client_id,
        coach_id=payload.coach_id,
        client_type=payload.client_type,
        display_name=payload.display_name,
        email=payload.email,
        whatsapp=payload.whatsapp,
        preferred_communication=payload.preferred_communication,
        notifications_enabled=payload.notifications_enabled,
        notes=payload.notes,
        active=payload.active,
    )
    store.clients[client_id] = client
    if payload.individual_details is not None and payload.client_type.value == "individual":
        store.individual_details[client_id] = IndividualStudentDetails(
            client_id=client_id, **payload.individual_details.model_dump(),
        )
    if payload.school_details is not None and payload.client_type.value == "school":
        store.school_details[client_id] = SchoolDetails(
            client_id=client_id, **payload.school_details.model_dump(),
        )
    return client


@router.get("/{clientId}", response_model=ClientWithDetails, operation_id="getClient")
async def get_client(
    clientId: str,
    current_user: UserRecord = Depends(get_current_user),
) -> ClientWithDetails:
    return enrich_client(ensure_client(clientId, current_user))


@router.patch("/{clientId}", response_model=Client, operation_id="updateClient")
async def update_client(
    clientId: str,
    payload: ClientUpdateRequest,
    current_user: UserRecord = Depends(get_current_user),
) -> Client:
    old_client = ensure_client(clientId, current_user)
    updates = payload.model_dump(exclude_unset=True)
    updated = Client.model_validate({**old_client.model_dump(), **updates})
    get_store().clients[clientId] = updated
    return updated


@router.delete("/{clientId}", status_code=status.HTTP_204_NO_CONTENT, operation_id="deleteClient")
async def delete_client(
    clientId: str,
    response: Response,
    current_user: UserRecord = Depends(get_current_user),
) -> None:
    ensure_client(clientId, current_user)
    store = get_store()
    with store.lock:
        del store.clients[clientId]
        store.individual_details.pop(clientId, None)
        store.school_details.pop(clientId, None)
        session_ids = [sid for sid, session in store.sessions.items() if session.client_id == clientId]
        for session_id in session_ids:
            del store.sessions[session_id]
        invoice_ids = [iid for iid, invoice in store.invoices.items() if invoice.client_id == clientId]
        for invoice_id in invoice_ids:
            del store.invoices[invoice_id]
            store.invoice_sessions.pop(invoice_id, None)
    response.status_code = status.HTTP_204_NO_CONTENT
    return None

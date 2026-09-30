"""Client management routes."""

from __future__ import annotations

from datetime import date as Date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from ..auth import get_current_user
from ..models import (
    Client,
    ClientCreateRequest,
    ClientSessionPage,
    ClientUpdateRequest,
    ClientWithDetails,
    IndividualStudentDetails,
    SchoolDetails,
)
from ..store import UserRecord, get_store
from .common import ensure_client, ensure_coach

router = APIRouter(prefix="/clients", tags=["Clients"])

SESSION_TIME_PATTERN = r"^([01][0-9]|2[0-3]):[0-5][0-9]$"


def enrich_client(client: Client) -> ClientWithDetails:
    store = get_store()
    upcoming = sorted(
        (
            session for session in store.sessions_for_client(client.id)
            if session.status.value == "scheduled"
            and session.date >= store.today()
        ),
        key=lambda session: (session.date, session.start_time),
    )
    outstanding = sum(
        invoice.amount for invoice in store.invoices_for_client(client.id)
        if invoice.client_id == client.id and invoice.status.value == "unpaid"
    )
    return ClientWithDetails(
        **client.model_dump(),
        individual_details=store.get_individual_details(client.id),
        school_details=store.get_school_details(client.id),
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
    return [enrich_client(client) for client in get_store().list_clients(coach_id)]


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
    individual_details = None
    school_details = None
    if payload.individual_details is not None and payload.client_type.value == "individual":
        individual_details = IndividualStudentDetails(
            client_id=client_id, **payload.individual_details.model_dump(),
        )
    if payload.school_details is not None and payload.client_type.value == "school":
        school_details = SchoolDetails(
            client_id=client_id, **payload.school_details.model_dump(),
        )
    store.save_client(
        client,
        individual_details=individual_details,
        school_details=school_details,
    )
    return client


@router.get("/{clientId}", response_model=ClientWithDetails, operation_id="getClient")
async def get_client(
    clientId: str,
    current_user: UserRecord = Depends(get_current_user),
) -> ClientWithDetails:
    return enrich_client(ensure_client(clientId, current_user))


@router.get(
    "/{clientId}/sessions",
    response_model=ClientSessionPage,
    operation_id="getClientSessions",
)
async def get_client_sessions(
    clientId: str,
    direction: Literal["previous", "upcoming"],
    as_of_date: Date,
    as_of_time: str = Query(pattern=SESSION_TIME_PATTERN),
    limit: int = Query(default=5, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    current_user: UserRecord = Depends(get_current_user),
) -> ClientSessionPage:
    client = ensure_client(clientId, current_user)
    sessions, has_more = get_store().client_session_page(
        client.id,
        direction=direction,
        as_of_date=as_of_date,
        as_of_time=as_of_time,
        limit=limit,
        offset=offset,
    )
    return ClientSessionPage(sessions=sessions, has_more=has_more)


@router.patch("/{clientId}", response_model=Client, operation_id="updateClient")
async def update_client(
    clientId: str,
    payload: ClientUpdateRequest,
    current_user: UserRecord = Depends(get_current_user),
) -> Client:
    old_client = ensure_client(clientId, current_user)
    updates = payload.model_dump(exclude_unset=True)
    updated = Client.model_validate({**old_client.model_dump(), **updates})
    get_store().save_client(updated)
    return updated


@router.delete("/{clientId}", status_code=status.HTTP_204_NO_CONTENT, operation_id="deleteClient")
async def delete_client(
    clientId: str,
    response: Response,
    current_user: UserRecord = Depends(get_current_user),
) -> None:
    ensure_client(clientId, current_user)
    get_store().delete_client(clientId)
    response.status_code = status.HTTP_204_NO_CONTENT
    return None

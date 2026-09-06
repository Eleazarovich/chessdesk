"""Coaching session routes and notification side effects."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..auth import get_current_user
from ..models import (
    NotificationPayload,
    NotificationType,
    Session,
    SessionCreateRequest,
    SessionStatus,
    SessionUpdateRequest,
)
from ..store import UserRecord, get_store
from .common import ensure_client, ensure_coach, ensure_session

router = APIRouter(tags=["Sessions"])


def _notification(session: Session, notification_type: NotificationType) -> None:
    store = get_store()
    client = store.clients.get(session.client_id)
    if client is None:
        return
    payload = NotificationPayload(
        client_id=client.id,
        type=notification_type,
        session=session,
        client_name=client.display_name,
    )
    store.record_notification(payload)


@router.get("/sessions", response_model=list[Session], operation_id="getSessions")
async def list_sessions(
    coach_id: str,
    current_user: UserRecord = Depends(get_current_user),
) -> list[Session]:
    ensure_coach(coach_id, current_user)
    return [session for session in get_store().sessions.values() if session.coach_id == coach_id]


@router.post("/sessions", response_model=Session, status_code=status.HTTP_201_CREATED, operation_id="createSession")
async def create_session(
    payload: SessionCreateRequest,
    current_user: UserRecord = Depends(get_current_user),
) -> Session:
    ensure_coach(payload.coach_id, current_user)
    ensure_client(payload.client_id, current_user)
    store = get_store()
    session = Session(id=store.next_id("session"), **payload.model_dump())
    store.sessions[session.id] = session
    _notification(session, NotificationType.scheduled)
    return session


@router.get("/sessions/{sessionId}", response_model=Session, operation_id="getSession")
async def get_session(
    sessionId: str,
    current_user: UserRecord = Depends(get_current_user),
) -> Session:
    return ensure_session(sessionId, current_user)


@router.patch("/sessions/{sessionId}", response_model=Session, operation_id="updateSession")
async def update_session(
    sessionId: str,
    payload: SessionUpdateRequest,
    current_user: UserRecord = Depends(get_current_user),
) -> Session:
    old_session = ensure_session(sessionId, current_user)
    updates = payload.model_dump(exclude_unset=True)
    new_client_id = updates.get("client_id", old_session.client_id)
    ensure_client(new_client_id, current_user)
    updated = Session.model_validate({**old_session.model_dump(), **updates})
    get_store().sessions[sessionId] = updated

    status_changed = updated.status != old_session.status
    if status_changed and updated.status is SessionStatus.completed:
        _notification(updated, NotificationType.completed)
    elif status_changed and updated.status is SessionStatus.cancelled:
        _notification(updated, NotificationType.cancelled)
    elif any(
        getattr(old_session, field) != getattr(updated, field)
        for field in ("client_id", "date", "start_time", "planned_duration", "session_type", "location")
    ):
        _notification(updated, NotificationType.updated)
    return updated


@router.delete("/sessions/{sessionId}", status_code=status.HTTP_204_NO_CONTENT, operation_id="deleteSession")
async def delete_session(
    sessionId: str,
    response: Response,
    current_user: UserRecord = Depends(get_current_user),
) -> None:
    ensure_session(sessionId, current_user)
    store = get_store()
    with store.lock:
        del store.sessions[sessionId]
        for session_ids in store.invoice_sessions.values():
            while sessionId in session_ids:
                session_ids.remove(sessionId)
    response.status_code = status.HTTP_204_NO_CONTENT
    return None


@router.post("/notifications", status_code=status.HTTP_204_NO_CONTENT, operation_id="sendNotification", tags=["Notifications"])
async def send_notification(
    payload: NotificationPayload,
    current_user: UserRecord = Depends(get_current_user),
) -> None:
    stored_session = ensure_session(payload.session.id, current_user)
    client = ensure_client(payload.client_id, current_user)
    if (
        stored_session.client_id != client.id
        or payload.session.client_id != client.id
        or payload.session.coach_id != current_user.user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Notification client does not match the session", "code": "CLIENT_MISMATCH"},
        )
    get_store().record_notification(payload, honor_preference=False)
    return None

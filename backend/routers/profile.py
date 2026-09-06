"""Coach profile routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import get_current_user
from ..models import Coach, CoachUpdateRequest
from ..store import UserRecord, get_store
from .common import ensure_coach

router = APIRouter(prefix="/coaches", tags=["Profile"])


@router.get("/{coachId}/profile", response_model=Coach, operation_id="getProfile")
async def get_profile(
    coachId: str,
    current_user: UserRecord = Depends(get_current_user),
) -> Coach:
    ensure_coach(coachId, current_user)
    coach = get_store().get_coach(coachId)
    assert coach is not None
    return coach


@router.patch("/{coachId}/profile", response_model=Coach, operation_id="updateProfile")
async def update_profile(
    coachId: str,
    payload: CoachUpdateRequest,
    current_user: UserRecord = Depends(get_current_user),
) -> Coach:
    ensure_coach(coachId, current_user)
    store = get_store()
    existing = store.get_coach(coachId)
    assert existing is not None
    updates = payload.model_dump(exclude_unset=True)
    if "email" in updates:
        other = store.user_by_email(str(updates["email"]))
        if other is not None and other.user.id != coachId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "That email address is already in use", "code": "EMAIL_EXISTS"},
            )
    updated = Coach.model_validate({**existing.model_dump(), **updates})
    store.update_coach(updated)
    return updated

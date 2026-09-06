"""Authentication routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from ..auth import (
    SESSION_COOKIE,
    TOKEN_TTL_SECONDS,
    get_current_user,
    hash_password,
    issue_token,
    revoke_token,
    token_from_request,
    verify_password,
)
from ..models import AuthResponse, AuthUser, LoginRequest, ResetPasswordRequest, SignUpRequest
from ..store import UserRecord, get_store

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _auth_response(record: UserRecord, response: Response) -> AuthResponse:
    token = issue_token(record.user.id)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=TOKEN_TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=False,
    )
    response.headers["X-Access-Token"] = token
    return AuthResponse(**record.user.model_dump(), access_token=token)


@router.post("/login", response_model=AuthResponse, operation_id="login")
async def login(payload: LoginRequest, response: Response) -> AuthResponse:
    record = get_store().user_by_email(str(payload.email))
    if record is None or not verify_password(payload.password, record.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Invalid email or password", "code": "INVALID_CREDENTIALS"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _auth_response(record, response)


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED, operation_id="signUp")
async def signup(payload: SignUpRequest, response: Response) -> AuthResponse:
    store = get_store()
    if store.user_by_email(str(payload.email)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "An account with this email already exists", "code": "EMAIL_EXISTS"},
        )
    user = AuthUser(
        id=store.next_id("coach"), email=payload.email, name=payload.name,
    )
    store.add_user(user, hash_password(payload.password))
    return _auth_response(store.user_by_id(user.id), response)  # type: ignore[arg-type]


@router.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT, operation_id="resetPassword")
async def reset_password(payload: ResetPasswordRequest) -> None:
    # This MVP deliberately does not reveal whether the email exists and does not
    # send real mail. A production implementation would enqueue a reset message.
    _ = payload
    return None


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, operation_id="logout")
async def logout(
    request: Request,
    response: Response,
    current_user: UserRecord = Depends(get_current_user),
) -> None:
    _ = current_user
    revoke_token(token_from_request(request, None))
    response.delete_cookie(SESSION_COOKIE)
    return None

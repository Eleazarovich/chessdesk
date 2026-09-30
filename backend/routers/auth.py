"""Authentication routes."""

from __future__ import annotations

import hashlib
import logging
import os
import secrets
import time

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status

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
from ..email_service import password_reset_email_config, send_password_reset_email
from ..models import (
    AuthResponse,
    AuthUser,
    ConfirmPasswordResetRequest,
    LoginRequest,
    ResetPasswordRequest,
    SignUpRequest,
)
from ..rate_limit import enforce_auth_limits
from ..store import UserRecord, get_store

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)
PASSWORD_RESET_TTL_SECONDS = 30 * 60
COOKIE_SECURE = os.getenv("CHESSDESK_COOKIE_SECURE", "false").strip().lower() in {
    "1", "true", "yes", "on",
}


def _auth_response(record: UserRecord, response: Response) -> AuthResponse:
    token = issue_token(record.user.id)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=TOKEN_TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
    )
    response.headers["X-Access-Token"] = token
    response.headers["Cache-Control"] = "no-store"
    return AuthResponse(**record.user.model_dump(), access_token=token)


@router.post("/login", response_model=AuthResponse, operation_id="login")
def login(payload: LoginRequest, request: Request, response: Response) -> AuthResponse:
    # Synchronous routes run in FastAPI's worker pool, including password hashing.
    enforce_auth_limits(request, str(payload.email), "login")
    record = get_store().user_by_email(str(payload.email))
    if record is None or not verify_password(payload.password, record.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Invalid email or password", "code": "INVALID_CREDENTIALS"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _auth_response(record, response)


@router.post("/signup", response_model=AuthUser, status_code=status.HTTP_201_CREATED, operation_id="signUp")
def signup(payload: SignUpRequest, request: Request, response: Response) -> AuthUser:
    enforce_auth_limits(request, str(payload.email), "signup")
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

    # Account creation does not establish a session. Clear any credentials that
    # were already attached to this browser so the new account must log in.
    bearer_or_cookie = token_from_request(request, None)
    cookie_token = request.cookies.get(SESSION_COOKIE)
    revoke_token(bearer_or_cookie)
    if cookie_token != bearer_or_cookie:
        revoke_token(cookie_token)
    response.delete_cookie(
        SESSION_COOKIE,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
    )
    response.headers["Cache-Control"] = "no-store"
    return user


@router.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT, operation_id="resetPassword")
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
) -> None:
    enforce_auth_limits(request, str(payload.email), "reset")
    config = password_reset_email_config()
    if config is None:
        logger.error("Password reset email is unavailable because its delivery settings are incomplete.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "message": "Password reset email is temporarily unavailable. Please try again later.",
                "code": "RESET_EMAIL_UNAVAILABLE",
            },
        )
    background_tasks.add_task(process_password_reset_request, str(payload.email), config)
    return None


def process_password_reset_request(email: str, config: tuple[str, str, str]) -> None:
    """Create and deliver a reset link after the generic HTTP response is sent."""

    record = get_store().user_by_email(email)
    if record is None:
        return

    token = secrets.token_urlsafe(32)
    token_digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    get_store().issue_password_reset_token(
        token_digest,
        record.user.id,
        int(time.time()) + PASSWORD_RESET_TTL_SECONDS,
    )
    if not send_password_reset_email(config=config, recipient=str(record.user.email), token=token):
        get_store().revoke_password_reset_token(token_digest)


@router.post(
    "/password/reset/confirm",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="confirmPasswordReset",
)
def confirm_password_reset(payload: ConfirmPasswordResetRequest, request: Request) -> None:
    token_digest = hashlib.sha256(payload.token.encode("utf-8")).hexdigest()
    enforce_auth_limits(request, token_digest, "reset_confirm")
    if not get_store().consume_password_reset_token(token_digest, hash_password(payload.password)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "This password reset link is invalid or has expired.",
                "code": "INVALID_RESET_TOKEN",
            },
        )
    return None


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, operation_id="logout")
async def logout(
    request: Request,
    response: Response,
    current_user: UserRecord = Depends(get_current_user),
) -> None:
    _ = current_user
    revoke_token(token_from_request(request, None))
    response.delete_cookie(
        SESSION_COOKIE,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
    )
    return None

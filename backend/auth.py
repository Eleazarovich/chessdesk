"""Password hashing and bearer/cookie authentication dependencies."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .store import UserRecord, get_store

SESSION_COOKIE = "chessdesk_session"
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7

_bearer = HTTPBearer(auto_error=False, scheme_name="bearerToken")


def hash_password(password: str) -> str:
    """Hash a password with scrypt and a per-password random salt."""

    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1,
    )
    return "scrypt$16384$8$1${}${}".format(
        base64.urlsafe_b64encode(salt).decode("ascii").rstrip("="),
        base64.urlsafe_b64encode(digest).decode("ascii").rstrip("="),
    )


def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        algorithm, n, r, p, encoded_salt, encoded_digest = encoded_hash.split("$", 5)
        if algorithm != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(encoded_salt + "=" * (-len(encoded_salt) % 4))
        expected = base64.urlsafe_b64decode(encoded_digest + "=" * (-len(encoded_digest) % 4))
        actual = hashlib.scrypt(
            password.encode("utf-8"), salt=salt,
            n=int(n), r=int(r), p=int(p), dklen=len(expected),
        )
        return hmac.compare_digest(actual, expected)
    except (TypeError, ValueError):
        return False


def issue_token(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    get_store().issue_token(token, user_id)
    return token


def revoke_token(token: str | None) -> None:
    if token:
        get_store().revoke_token(token)


def _unauthorized(message: str = "Authentication is required") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"message": message, "code": "UNAUTHORIZED"},
        headers={"WWW-Authenticate": "Bearer"},
    )


def token_from_request(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    if credentials is not None and credentials.scheme.casefold() == "bearer":
        return credentials.credentials
    authorization = request.headers.get("authorization", "")
    if authorization.casefold().startswith("bearer "):
        return authorization[7:].strip() or None
    return request.cookies.get(SESSION_COOKIE)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> UserRecord:
    """Resolve either an Authorization bearer token or the contract's cookie."""

    token = token_from_request(request, credentials)
    if not token:
        raise _unauthorized()
    user_id = get_store().user_id_for_token(token)
    user = get_store().user_by_id(user_id)
    if user is None:
        raise _unauthorized("The authentication token is invalid or expired")
    return user


def require_owned_coach(coach_id: str, current_user: UserRecord) -> None:
    if coach_id != current_user.user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "The authenticated coach cannot access this resource",
                "code": "FORBIDDEN",
            },
        )
    if get_store().get_coach(coach_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Coach not found", "code": "NOT_FOUND"},
        )

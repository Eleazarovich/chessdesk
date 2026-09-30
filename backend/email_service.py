"""Transactional email delivery for ChessDesk."""

from __future__ import annotations

import html
import logging
import os
import re
from pathlib import Path
from urllib.parse import quote, urlsplit

import resend

logger = logging.getLogger(__name__)


def password_reset_email_config() -> tuple[str, str, str] | None:
    """Read Resend credentials and public sender settings from the environment."""

    api_key = os.getenv("RESEND_API_KEY", "").strip()
    key_file = os.getenv("RESEND_API_KEY_FILE", "").strip()
    if not api_key and key_file:
        try:
            api_key = Path(key_file).read_text(encoding="utf-8").strip()
        except OSError:
            logger.error("The configured Resend API key file could not be read.")
            return None

    sender = os.getenv("CHESSDESK_EMAIL_FROM", "").strip()
    public_url = os.getenv("CHESSDESK_PUBLIC_URL", "").strip().rstrip("/")
    try:
        parsed_url = urlsplit(public_url)
    except ValueError:
        return None
    if (
        not api_key
        or not sender
        or parsed_url.scheme not in {"http", "https"}
        or not parsed_url.netloc
        or parsed_url.username is not None
        or parsed_url.password is not None
        or parsed_url.query
        or parsed_url.fragment
        or parsed_url.path not in {"", "/"}
    ):
        return None

    return api_key, sender, public_url


def send_password_reset_email(
    *, config: tuple[str, str, str], recipient: str, token: str,
) -> bool:
    """Send a reset link whose token stays in the URL fragment, outside request logs."""

    api_key, sender, public_url = config
    reset_url = f"{public_url}/reset-password/#token={quote(token, safe='')}"
    safe_url = html.escape(reset_url, quote=True)

    try:
        resend.api_key = api_key
        resend.Emails.send({
            "from": sender,
            "to": [recipient],
            "subject": "Reset your ChessDesk password",
            "text": (
                "Someone requested a password reset for your ChessDesk account.\n\n"
                f"Choose a new password within 30 minutes: {reset_url}\n\n"
                "If you did not request this, you can ignore this email."
            ),
            "html": (
                "<p>Someone requested a password reset for your ChessDesk account.</p>"
                f'<p><a href="{safe_url}">Choose a new password</a>. '
                "This link expires in 30 minutes.</p>"
                "<p>If you did not request this, you can ignore this email.</p>"
            ),
        })
    except Exception as error:
        error_type = getattr(error, "error_type", type(error).__name__)
        error_code = getattr(error, "code", "unknown")
        detail = str(getattr(error, "message", error)).replace("\n", " ")
        detail = re.sub(
            r"\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b",
            r"[email]@\1",
            detail,
            flags=re.IGNORECASE,
        )
        detail = re.sub(r"https?://[^\s\"'<>]+", "[url]", detail)
        logger.warning(
            "Password reset email delivery failed (provider_error=%s, code=%s, message=%s).",
            error_type,
            error_code,
            detail[:300],
        )
        return False

    return True

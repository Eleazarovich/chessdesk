"""Persistent limits for public authentication endpoints."""

from __future__ import annotations

import hashlib
import ipaddress
import os
import time

from fastapi import HTTPException, Request

from .store import get_store

# (scope, attempts, window in seconds). IP limits run before account limits so
# random email addresses cannot create unlimited counters from one source.
AUTH_LIMITS = {
    "login": (("ip", 30, 60), ("account", 10, 900), ("global", 300, 60)),
    "signup": (("ip", 5, 3600), ("global", 50, 3600)),
    "reset": (("ip", 10, 3600), ("account", 3, 3600)),
}


def enforce_auth_limits(request: Request, email: str, action: str) -> None:
    now = int(time.time())
    client_ip = request.client.host if request.client else "unknown"
    # Enable only on the EC2 origin whose security group permits CloudFront
    # ingress exclusively. CloudFront appends the actual viewer to the right;
    # preceding addresses can be supplied by the viewer and must be ignored.
    if os.getenv("CHESSDESK_TRUST_CLOUDFRONT", "false").lower() == "true":
        forwarded = request.headers.get("x-forwarded-for", "").rsplit(",", 1)[-1].strip()
        try:
            client_ip = str(ipaddress.ip_address(forwarded))
        except ValueError:
            raise HTTPException(status_code=400, detail="Missing or invalid CloudFront viewer address")
    identities = {"ip": client_ip, "account": email.casefold(), "global": "all"}
    store = get_store()
    for scope, limit, period in AUTH_LIMITS[action]:
        window = now // period
        key = hashlib.sha256(
            f"{action}:{scope}:{identities[scope]}:{window}".encode()
        ).hexdigest()
        expires_at = (window + 1) * period
        if not store.consume_auth_limit(key, limit, expires_at):
            raise HTTPException(
                status_code=429,
                detail={"message": "Too many attempts. Please try again later.", "code": "RATE_LIMITED"},
                headers={"Retry-After": str(max(1, expires_at - now))},
            )

"""Start the API with optional local TLS and fail closed for hosted deployments."""

from __future__ import annotations

import os
import ssl

import uvicorn


def server_options() -> dict:
    certificate = os.getenv("CHESSDESK_TLS_CERTFILE")
    private_key = os.getenv("CHESSDESK_TLS_KEYFILE")
    required = os.getenv("CHESSDESK_REQUIRE_TLS", "false").lower() == "true"
    if bool(certificate) != bool(private_key) or (required and not certificate):
        raise ValueError("TLS requires both CHESSDESK_TLS_CERTFILE and CHESSDESK_TLS_KEYFILE")
    options = {"host": "0.0.0.0", "port": 8000, "proxy_headers": False}
    if certificate:
        # Detect missing files, invalid PEM, or a mismatched key before serving.
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certificate, private_key)
        options.update(ssl_certfile=certificate, ssl_keyfile=private_key, ssl_version=ssl.PROTOCOL_TLS_SERVER)
    return options


if __name__ == "__main__":
    uvicorn.run("backend.main:app", **server_options())

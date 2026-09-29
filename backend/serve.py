"""Start the API with optional local TLS and fail closed for hosted deployments."""

from __future__ import annotations

import asyncio
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


def tls_port() -> int | None:
    configured_port = os.getenv("CHESSDESK_TLS_PORT")
    if configured_port is None:
        return None
    try:
        port = int(configured_port)
    except ValueError as error:
        raise ValueError("CHESSDESK_TLS_PORT must be a valid TCP port") from error
    if not 1 <= port <= 65535 or port == 8000:
        raise ValueError("CHESSDESK_TLS_PORT must be a valid TCP port other than 8000")
    return port


async def _serve_both_protocols(tls_options: dict) -> None:
    http_server = uvicorn.Server(uvicorn.Config(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        proxy_headers=False,
    ))
    tls_server = uvicorn.Server(uvicorn.Config("backend.main:app", **tls_options))

    async def serve_and_stop_peer(server: uvicorn.Server, peer: uvicorn.Server) -> None:
        try:
            await server.serve()
        finally:
            peer.should_exit = True

    await asyncio.gather(
        serve_and_stop_peer(http_server, tls_server),
        serve_and_stop_peer(tls_server, http_server),
    )


if __name__ == "__main__":
    options = server_options()
    configured_tls_port = tls_port()
    if configured_tls_port is None:
        uvicorn.run("backend.main:app", **options)
    else:
        options["port"] = configured_tls_port
        asyncio.run(_serve_both_protocols(options))

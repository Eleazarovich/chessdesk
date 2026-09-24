"""Check the local listener while verifying its configured TLS hostname."""

from __future__ import annotations

import http.client
import os
import socket
import ssl


def check_health(port: int = 8000) -> None:
    certificate = os.getenv("CHESSDESK_TLS_CERTFILE")
    if not certificate:
        if os.getenv("CHESSDESK_REQUIRE_TLS", "false").lower() == "true":
            raise ValueError("A TLS certificate is required for the health check")
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
        try:
            connection.request("GET", "/health")
            if connection.getresponse().status != 200:
                raise RuntimeError("Health check failed")
        finally:
            connection.close()
        return

    hostname = os.environ["CHESSDESK_TLS_SERVER_NAME"]
    context = ssl.create_default_context()
    # Also supports a private CA for isolated local tests; CloudFront requires a
    # publicly trusted origin certificate. Hostname and expiry checks stay on.
    context.load_verify_locations(cafile=certificate)
    with socket.create_connection(("127.0.0.1", port), timeout=3) as connection:
        with context.wrap_socket(connection, server_hostname=hostname) as tls:
            tls.sendall(f"GET /health HTTP/1.1\r\nHost: {hostname}\r\nConnection: close\r\n\r\n".encode("ascii"))
            response = http.client.HTTPResponse(tls)
            response.begin()
            if response.status != 200:
                raise RuntimeError("Health check failed")


if __name__ == "__main__":
    check_health()

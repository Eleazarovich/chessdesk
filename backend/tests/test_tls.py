from __future__ import annotations

import ssl
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

import pytest

from backend.healthcheck import check_health
from backend.serve import server_options


@pytest.fixture
def tls_files(tmp_path, monkeypatch):
    certificate, key = tmp_path / "fullchain.pem", tmp_path / "privkey.pem"
    subprocess.run([
        "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
        "-keyout", str(key), "-out", str(certificate), "-days", "2",
        "-subj", "/CN=origin.example.test",
        "-addext", "subjectAltName=DNS:origin.example.test",
    ], check=True, capture_output=True)
    monkeypatch.setenv("CHESSDESK_REQUIRE_TLS", "true")
    monkeypatch.setenv("CHESSDESK_TLS_CERTFILE", str(certificate))
    monkeypatch.setenv("CHESSDESK_TLS_KEYFILE", str(key))
    monkeypatch.setenv("CHESSDESK_TLS_SERVER_NAME", "origin.example.test")
    return certificate, key


@pytest.mark.parametrize("hostname,valid", [("origin.example.test", True), ("wrong.example.test", False)])
def test_deployment_preflight_rejects_hostname_mismatch(tls_files, monkeypatch, hostname, valid) -> None:
    certificate, _ = tls_files
    # Trust the isolated test CA only in this local process. Hosted validation
    # uses the system CA store and requires a publicly trusted certificate.
    monkeypatch.setenv("SSL_CERT_FILE", str(certificate))
    script = Path(__file__).resolve().parents[2] / "deploy" / "validate-origin-tls.sh"
    result = subprocess.run(["bash", str(script), str(certificate.parent), hostname], capture_output=True)
    assert (result.returncode == 0) is valid


def test_deployment_preflight_rejects_mismatched_key(tls_files, monkeypatch) -> None:
    certificate, key = tls_files
    monkeypatch.setenv("SSL_CERT_FILE", str(certificate))
    subprocess.run(["openssl", "genpkey", "-algorithm", "RSA", "-out", str(key)], check=True, capture_output=True)
    script = Path(__file__).resolve().parents[2] / "deploy" / "validate-origin-tls.sh"
    result = subprocess.run(["bash", str(script), str(certificate.parent), "origin.example.test"], capture_output=True)
    assert result.returncode != 0
    assert b"certificate and private key do not match" in result.stderr


def test_hosted_listener_and_healthcheck_refuse_missing_tls(monkeypatch) -> None:
    monkeypatch.setenv("CHESSDESK_REQUIRE_TLS", "true")
    monkeypatch.delenv("CHESSDESK_TLS_CERTFILE", raising=False)
    monkeypatch.delenv("CHESSDESK_TLS_KEYFILE", raising=False)
    with pytest.raises(ValueError, match="TLS requires both"):
        server_options()
    with pytest.raises(ValueError, match="TLS certificate is required"):
        check_health()


def test_tls_listener_rejects_invalid_certificate(tls_files) -> None:
    certificate, _ = tls_files
    certificate.write_text("invalid certificate")
    with pytest.raises(ssl.SSLError):
        server_options()


def test_tls_listener_validates_certificate_and_disables_proxy_trust(tls_files) -> None:
    certificate, key = tls_files
    options = server_options()
    assert options["ssl_certfile"] == str(certificate)
    assert options["ssl_keyfile"] == str(key)
    assert options["ssl_version"] == ssl.PROTOCOL_TLS_SERVER
    assert options["proxy_headers"] is False


def test_tls_healthcheck_verifies_hostname(tls_files, monkeypatch) -> None:
    class HealthHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200 if self.path == "/health" else 404)
            self.end_headers()

        def log_message(self, *_args):
            pass

    certificate, key = tls_files
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certificate, key)
    with ThreadingHTTPServer(("127.0.0.1", 0), HealthHandler) as server:
        server.socket = context.wrap_socket(server.socket, server_side=True)
        worker = Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            check_health(server.server_port)
            monkeypatch.setenv("CHESSDESK_TLS_SERVER_NAME", "wrong.example.test")
            with pytest.raises(ssl.SSLCertVerificationError, match="Hostname mismatch"):
                check_health(server.server_port)
        finally:
            server.shutdown()
            worker.join(timeout=3)

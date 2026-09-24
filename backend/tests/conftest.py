from collections.abc import Iterator
from datetime import date

import pytest

from backend.store import Store, reset_store

TEST_TODAY = date(2026, 9, 6)


@pytest.fixture(autouse=True)
def fresh_store(monkeypatch: pytest.MonkeyPatch, tmp_path) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.sqlite3'}")
    monkeypatch.setenv("CHESSDESK_SEED_DEMO", "true")
    monkeypatch.delenv("CHESSDESK_TRUST_CLOUDFRONT", raising=False)
    # Keep the seeded September sessions upcoming for deterministic API tests.
    monkeypatch.setattr(Store, "today", lambda self: TEST_TODAY)
    reset_store()
    yield

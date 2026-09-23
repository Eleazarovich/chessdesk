from collections.abc import Iterator
from datetime import date

import pytest

from backend.store import Store, reset_store

TEST_TODAY = date(2026, 9, 6)


@pytest.fixture(autouse=True)
def fresh_store(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    # Keep the seeded September sessions upcoming for deterministic API tests.
    monkeypatch.setattr(Store, "today", lambda self: TEST_TODAY)
    reset_store()
    yield

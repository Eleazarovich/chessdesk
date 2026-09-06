from collections.abc import Iterator

import pytest

from backend.store import reset_store


@pytest.fixture(autouse=True)
def fresh_store() -> Iterator[None]:
    reset_store()
    yield


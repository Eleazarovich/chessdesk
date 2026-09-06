from __future__ import annotations

from backend.models import AuthUser
from backend.store import Store


def test_store_persists_data_and_id_counters_across_instances(tmp_path) -> None:
    database_url = f"sqlite:///{tmp_path / 'chessdesk.sqlite3'}"
    first = Store(database_url)
    user = AuthUser(id=first.next_id("coach"), email="persisted@example.com", name="Persisted User")
    first.add_user(user, "scrypt$test")
    first.issue_token("persisted-token", user.id)
    first.close()

    second = Store(database_url)
    assert len(second.list_clients("coach-001")) == 6
    assert second.user_by_email("PERSISTED@example.com").user.id == user.id
    assert second.user_id_for_token("persisted-token") == user.id
    assert second.next_id("client") == "client-007"
    second.close()

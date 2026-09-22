from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CoachAuth:
    coach_id: str
    token: str

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}

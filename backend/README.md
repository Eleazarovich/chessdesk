# ChessDesk backend

Run the API from the repository root with:

```bash
uv sync
uv run uvicorn backend.main:app --reload
```

The API is available at `http://127.0.0.1:8000/api/v1`; interactive docs are at
`/api/v1/docs`.

The seeded demo account is `thabo@chessops.co.za` / `chess2026!`. Login returns
an `access_token` for `Authorization: Bearer <token>` requests and also sets the
`chessdesk_session` HttpOnly cookie.

Run tests with:

```bash
uv run pytest
```

All persistence and notification delivery are intentionally in memory for this
MVP. Restarting the process resets the seeded data.


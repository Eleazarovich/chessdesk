# ChessDesk backend

Run the API from the repository root with:

```bash
uv sync
uv run uvicorn backend.main:app --reload
```

Persistence uses SQLAlchemy. The server reads its database connection from
`DATABASE_URL`; if it is unset, it uses `sqlite:///./chessdesk.db` in the
repository root. For example:

```bash
DATABASE_URL=sqlite:///./data/chessdesk.db uv run uvicorn backend.main:app --reload
```

`DATABASE_URL` accepts any SQLAlchemy database URL, so a PostgreSQL URL can be
used later without changing the application repository layer.

The API is available at `http://127.0.0.1:8000/api/v1`; interactive docs are at
`/api/v1/docs`.

The seeded demo account is `thabo@chessops.co.za` / `chess2026!`. Login returns
an `access_token` for `Authorization: Bearer <token>` requests and also sets the
`chessdesk_session` HttpOnly cookie.

Run tests with:

```bash
uv run pytest
```

On first startup, the database tables are created and the demo data is seeded
when the database is empty. Subsequent restarts preserve application data.

# ChessDesk backend

Run the API from the repository root with:

```bash
uv sync
uv run uvicorn backend.main:app --reload
```

Persistence uses SQLAlchemy. The server reads its database connection from
`DATABASE_URL`; if it is unset, it uses `sqlite:///./chessdesk.db` in the
repository root. SQLite remains useful for local development. To use PostgreSQL,
set `DATABASE_URL` to a standard PostgreSQL connection URL:

```bash
DATABASE_URL=postgresql://chessdesk:password@localhost:5432/chessdesk \
  uv run uvicorn backend.main:app --reload
```

The backend uses the Psycopg 3 driver for `postgresql://` and legacy
`postgres://` URLs. It creates missing tables and seeds the demo account when
the database is empty. PostgreSQL must be running and the configured database
must already exist before starting the API.

The API is available at `http://127.0.0.1:8000/api/v1`; interactive docs are at
`/api/v1/docs`.

Build and run the combined frontend and backend container from the repository
root:

```bash
docker build -t chessdesk .
docker run --rm -p 8000:8000 \
  -v chessdesk-data:/data \
  -e DATABASE_URL=sqlite:////data/chessdesk.db \
  chessdesk
```

Open `http://localhost:8000` for the frontend or `http://localhost:8000/api/v1/docs`
for the API docs. The named Docker volume keeps the SQLite database across
container restarts.

To run the API container against PostgreSQL, put it on the same Docker network
as your database and set `DATABASE_URL` to the database service hostname, for
example:

```bash
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=postgresql://chessdesk:password@postgres:5432/chessdesk \
  chessdesk
```

Replace `postgres` with the hostname reachable from the API container and use
the credentials configured for your PostgreSQL instance.

The seeded demo account is `thabo@chessops.co.za` / `chess2026!`. Login returns
an `access_token` for `Authorization: Bearer <token>` requests and also sets the
`chessdesk_session` HttpOnly cookie.

Run tests with:

```bash
uv run pytest
```

On first startup, the database tables are created and the demo data is seeded
when the database is empty. Subsequent restarts preserve application data.

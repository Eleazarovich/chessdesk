.PHONY: help install dev run test integration e2e observability-up observability-down

help:
	@printf '%s\n' \
		'make install  Install backend dependencies with uv' \
		'make dev      Start the backend with hot reload' \
		'make test     Run backend tests' \
		'make integration  Start Docker Compose and run integration tests' \
		'make e2e      Start Docker Compose and run Playwright E2E' \
		'make observability-up  Start the separate observability Compose project' \
		'make observability-down  Stop the observability Compose project'

install:
	uv sync

dev:
	uv run uvicorn backend.main:app --reload

run: dev

test:
	uv run pytest

integration:
	docker network inspect chessdesk-otel >/dev/null 2>&1 || docker network create chessdesk-otel
	docker compose up --build -d
	uv run pytest -m integration integration_tests

e2e:
	docker network inspect chessdesk-otel >/dev/null 2>&1 || docker network create chessdesk-otel
	docker compose up --build -d
	npm run e2e

observability-up:
	docker network inspect chessdesk-otel >/dev/null 2>&1 || docker network create chessdesk-otel
	docker compose -f observability/compose.yaml up -d

observability-down:
	docker compose -f observability/compose.yaml down

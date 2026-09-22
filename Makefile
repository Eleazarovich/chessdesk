.PHONY: help install dev run test integration e2e

help:
	@printf '%s\n' \
		'make install  Install backend dependencies with uv' \
		'make dev      Start the backend with hot reload' \
		'make test     Run backend tests' \
		'make integration  Start Docker Compose and run integration tests' \
		'make e2e      Start Docker Compose and run Playwright E2E'

install:
	uv sync

dev:
	uv run uvicorn backend.main:app --reload

run: dev

test:
	uv run pytest

integration:
	docker compose up --build -d
	uv run pytest -m integration integration_tests

e2e:
	docker compose up --build -d
	npm run e2e

.PHONY: help install dev run test integration

help:
	@printf '%s\n' \
		'make install  Install backend dependencies with uv' \
		'make dev      Start the backend with hot reload' \
		'make test     Run backend tests' \
		'make integration  Start Docker Compose and run integration tests'

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

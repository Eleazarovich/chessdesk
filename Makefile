.PHONY: help install dev run test

help:
	@printf '%s\n' \
		'make install  Install backend dependencies with uv' \
		'make dev      Start the backend with hot reload' \
		'make test     Run backend tests'

install:
	uv sync

dev:
	uv run uvicorn backend.main:app --reload

run: dev

test:
	uv run pytest

FROM node:22-bookworm-slim AS frontend-build

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
ARG NEXT_PUBLIC_API_BASE_URL=/api/v1
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
RUN npm run build

FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.9 /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/ ./backend/
COPY --from=frontend-build /frontend/out/ ./backend/static/

RUN useradd --create-home --uid 10001 app \
    && mkdir -p /data \
    && chown -R app:app /app /data
USER app

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"]

CMD ["uv", "run", "--no-sync", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]

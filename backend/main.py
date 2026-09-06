"""ChessDesk FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

from .routers import auth, clients, dashboard, expenses, invoices, profile, sessions

app = FastAPI(
    title="ChessDesk Backend API",
    version="0.1.0",
    description=(
        "API for managing an independent chess coach's clients, sessions, "
        "invoices, expenses, and dashboard reporting."
    ),
    openapi_url="/api/v1/openapi.json",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Access-Token"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict) and "message" in detail:
        content = detail
    else:
        content = {"message": str(detail), "code": "HTTP_ERROR"}
    return JSONResponse(status_code=exc.status_code, content=content, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    field_errors: dict[str, list[str]] = {}
    for error in exc.errors():
        location = ".".join(str(part) for part in error["loc"] if part != "body") or "request"
        field_errors.setdefault(location, []).append(error["msg"])
    return JSONResponse(
        status_code=400,
        content={
            "message": "Request validation failed",
            "code": "VALIDATION_ERROR",
            "field_errors": field_errors,
        },
    )


for route_module in (auth, dashboard, clients, sessions, invoices, expenses, profile):
    app.include_router(route_module.router, prefix="/api/v1")


def custom_openapi() -> dict:
    """Advertise both supported authentication transports in generated docs."""

    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    schemes = schema.setdefault("components", {}).setdefault("securitySchemes", {})
    schemes["sessionCookie"] = {
        "type": "apiKey",
        "in": "cookie",
        "name": "chessdesk_session",
        "description": "HttpOnly session cookie established by login or signup.",
    }
    for path_item in schema.get("paths", {}).values():
        for operation in path_item.values():
            if isinstance(operation, dict) and operation.get("security") == [{"bearerToken": []}]:
                operation["security"] = [{"bearerToken": []}, {"sessionCookie": []}]
    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi

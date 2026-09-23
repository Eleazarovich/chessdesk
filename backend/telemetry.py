"""OpenTelemetry configuration for the ChessDesk backend."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
    OTLPSpanExporter as OTLPGrpcSpanExporter,
)
from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
    OTLPSpanExporter as OTLPHttpSpanExporter,
)
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

DEFAULT_SERVICE_NAME = "chessdesk-backend"
DEFAULT_SERVICE_VERSION = "0.1.0"
DEFAULT_ENVIRONMENT = "development"


def configure_telemetry() -> TracerProvider:
    """Configure tracing and return its provider for FastAPI instrumentation.

    Resource.create reads OTEL_RESOURCE_ATTRIBUTES and OTEL_SERVICE_NAME, so
    deployment metadata follows the OpenTelemetry SDK environment convention.
    Export stays disabled unless an OTLP endpoint or console exporter is set.
    """

    resource = Resource.create(
        {SERVICE_NAME: os.getenv("OTEL_SERVICE_NAME", DEFAULT_SERVICE_NAME)}
    )
    attributes = dict(resource.attributes)
    attributes.setdefault("service.version", os.getenv("CHESSDESK_VERSION", DEFAULT_SERVICE_VERSION))
    attributes.setdefault(
        "deployment.environment.name",
        os.getenv("DEPLOYMENT_ENVIRONMENT", DEFAULT_ENVIRONMENT),
    )
    resource = Resource.create(attributes)

    provider = TracerProvider(resource=resource)
    exporter_name = os.getenv("OTEL_TRACES_EXPORTER", "otlp").lower()
    if exporter_name == "console":
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    elif exporter_name == "otlp":
        endpoint = os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT") or os.getenv(
            "OTEL_EXPORTER_OTLP_ENDPOINT"
        )
        if endpoint:
            protocol = os.getenv("OTEL_EXPORTER_OTLP_PROTOCOL", "grpc").lower()
            if protocol == "grpc":
                exporter = OTLPGrpcSpanExporter()
            elif protocol == "http/protobuf":
                exporter = OTLPHttpSpanExporter()
            else:
                raise ValueError(
                    "OTEL_EXPORTER_OTLP_PROTOCOL must be 'grpc' or 'http/protobuf'"
                )
            provider.add_span_processor(BatchSpanProcessor(exporter))
    elif exporter_name != "none":
        raise ValueError("OTEL_TRACES_EXPORTER must be 'otlp', 'console', or 'none'")

    trace.set_tracer_provider(provider)
    SQLAlchemyInstrumentor().instrument(tracer_provider=provider)
    return provider


def instrument_fastapi(app: FastAPI, tracer_provider: TracerProvider) -> None:
    """Add HTTP request tracing after the app's routes and middleware exist."""

    FastAPIInstrumentor.instrument_app(app, tracer_provider=tracer_provider)

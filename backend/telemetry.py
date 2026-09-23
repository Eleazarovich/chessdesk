"""OpenTelemetry configuration for the ChessDesk backend."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI

from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import (
    OTLPMetricExporter as OTLPGrpcMetricExporter,
)
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
    OTLPSpanExporter as OTLPGrpcSpanExporter,
)
from opentelemetry.exporter.otlp.proto.http.metric_exporter import (
    OTLPMetricExporter as OTLPHttpMetricExporter,
)
from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
    OTLPSpanExporter as OTLPHttpSpanExporter,
)
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import (
    ConsoleMetricExporter,
    PeriodicExportingMetricReader,
)
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

DEFAULT_SERVICE_NAME = "chessdesk-backend"
DEFAULT_SERVICE_VERSION = "0.1.0"
DEFAULT_ENVIRONMENT = "development"

# Use stable HTTP metric names and route/status dimensions unless deployment
# configuration explicitly selects another semantic-convention mode.
os.environ.setdefault("OTEL_SEMCONV_STABILITY_OPT_IN", "http")


@dataclass(frozen=True)
class TelemetryProviders:
    """Providers shared by application tracing and metrics instrumentation."""

    tracer_provider: TracerProvider
    meter_provider: MeterProvider

    def shutdown(self) -> None:
        """Flush and stop both telemetry providers during application shutdown."""

        try:
            self.meter_provider.shutdown()
        finally:
            self.tracer_provider.shutdown()


def _create_resource() -> Resource:
    """Build one resource so every signal carries identical deployment metadata.

    Resource.create reads OTEL_RESOURCE_ATTRIBUTES and OTEL_SERVICE_NAME, so
    deployment metadata follows the OpenTelemetry SDK environment convention.
    """

    resource = Resource.create(
        {SERVICE_NAME: os.getenv("OTEL_SERVICE_NAME", DEFAULT_SERVICE_NAME)}
    )
    attributes = dict(resource.attributes)
    attributes.setdefault(
        "service.version",
        os.getenv("CHESSDESK_VERSION", DEFAULT_SERVICE_VERSION),
    )
    attributes.setdefault(
        "deployment.environment.name",
        os.getenv("DEPLOYMENT_ENVIRONMENT", DEFAULT_ENVIRONMENT),
    )
    resource = Resource.create(attributes)
    return resource


def _otlp_endpoint_configured(signal: str) -> bool:
    return bool(
        os.getenv(f"OTEL_EXPORTER_OTLP_{signal.upper()}_ENDPOINT")
        or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    )


def _otlp_protocol() -> str:
    protocol = os.getenv("OTEL_EXPORTER_OTLP_PROTOCOL", "grpc").lower()
    if protocol not in {"grpc", "http/protobuf"}:
        raise ValueError("OTEL_EXPORTER_OTLP_PROTOCOL must be 'grpc' or 'http/protobuf'")
    return protocol


def _create_tracer_provider(resource: Resource) -> TracerProvider:
    provider = TracerProvider(resource=resource)
    exporter_name = os.getenv("OTEL_TRACES_EXPORTER", "otlp").lower()
    if exporter_name == "console":
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    elif exporter_name == "otlp" and _otlp_endpoint_configured("traces"):
        if _otlp_protocol() == "grpc":
            exporter = OTLPGrpcSpanExporter()
        else:
            exporter = OTLPHttpSpanExporter()
        provider.add_span_processor(BatchSpanProcessor(exporter))
    elif exporter_name not in {"otlp", "none"}:
        raise ValueError("OTEL_TRACES_EXPORTER must be 'otlp', 'console', or 'none'")
    return provider


def _create_meter_provider(resource: Resource) -> MeterProvider:
    exporter_name = os.getenv("OTEL_METRICS_EXPORTER", "otlp").lower()
    metric_readers = []

    if exporter_name == "console":
        metric_readers.append(
            PeriodicExportingMetricReader(ConsoleMetricExporter())
        )
    elif exporter_name == "otlp" and _otlp_endpoint_configured("metrics"):
        if _otlp_protocol() == "grpc":
            exporter = OTLPGrpcMetricExporter()
        else:
            exporter = OTLPHttpMetricExporter()
        metric_readers.append(PeriodicExportingMetricReader(exporter))
    elif exporter_name not in {"otlp", "none"}:
        raise ValueError("OTEL_METRICS_EXPORTER must be 'otlp', 'console', or 'none'")

    return MeterProvider(resource=resource, metric_readers=metric_readers)


def configure_telemetry() -> TelemetryProviders:
    """Configure shared trace and metric providers for app instrumentation.

    OTEL_RESOURCE_ATTRIBUTES and OTEL_SERVICE_NAME are applied to one shared
    resource, so metrics carry the same service, environment, and version as
    traces. Export remains disabled when no OTLP endpoint is configured.
    """

    resource = _create_resource()
    tracer_provider = _create_tracer_provider(resource)
    meter_provider = _create_meter_provider(resource)

    trace.set_tracer_provider(tracer_provider)
    metrics.set_meter_provider(meter_provider)
    SQLAlchemyInstrumentor().instrument(
        tracer_provider=tracer_provider,
        meter_provider=meter_provider,
    )
    return TelemetryProviders(tracer_provider, meter_provider)


def instrument_fastapi(
    app: FastAPI,
    telemetry: TelemetryProviders,
) -> None:
    """Add HTTP request tracing and metrics after routes and middleware exist."""

    FastAPIInstrumentor.instrument_app(
        app,
        tracer_provider=telemetry.tracer_provider,
        meter_provider=telemetry.meter_provider,
    )

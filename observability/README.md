# Local observability stack

This is a separate Compose project from the application. It runs an OpenTelemetry
Collector, Prometheus, Loki, Tempo, and Grafana. A shared external Docker network
keeps OTLP traffic private and lets either Compose project stop without deleting
the network used by the other.

Start the monitoring services and their shared network:

```bash
make observability-up
```

Then start the app from the repository root:

```bash
docker compose up --build -d
```

The root Compose file sends the backend's traces to `otel-collector:4317` by
default. The collector also accepts OTLP over HTTP on port 4318. For an app
started outside Docker, use `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317`.

Open Grafana at <http://localhost:3000> (default local login `admin` /
`chessdesk-local`). Prometheus is at <http://localhost:9090>. Both interfaces
and the host OTLP ports are bound to localhost. Set `GRAFANA_ADMIN_USER` and
`GRAFANA_ADMIN_PASSWORD` in the shell or Compose `.env` file to override the
local Grafana login.

Prometheus retains 15 days of metrics with a 2 GB size limit, Loki retains logs
for 7 days, and Tempo retains traces for 24 hours. Each backend uses its own
named Docker volume. Stop the observability project with `make
observability-down`; volumes and the shared network are retained. Remove stored
observability data only when intended with:

```bash
docker compose -f observability/compose.yaml down --volumes
```

## Current telemetry coverage

The backend currently emits FastAPI request and SQLAlchemy spans, so traces can
be explored in Grafana's Tempo data source. The collector has OTLP pipelines for
traces, metrics, and logs, but the app does not currently emit OTLP metrics or
logs. Prometheus currently shows its own and Collector health metrics; its
application metrics target will populate when the backend exports metrics. Loki
is ready for OTLP logs, but container stdout is not collected automatically.

## Fit for ChessDesk

The Collector-to-Tempo path is a good fit for the backend's existing
OpenTelemetry traces, and the Grafana data sources give one place to explore the
different signals. Prometheus and Loki will become useful after the app emits
metrics and logs; until then, they mostly add components to operate. Add request
and database metrics and decide how to ship application logs before treating
this as a complete application observability setup.

This five-service stack is suited to local development and learning. ChessDesk's
hosted topology is a single small EC2 instance, so running these storage and UI
services on that same machine would compete with the app for memory and disk
while adding patching and backup work. For AWS production, evaluate CloudWatch
Application Signals and CloudWatch Logs, which support EC2-hosted applications;
otherwise, run the self-managed backends on a separate host or choose a managed
Grafana service.

This is a local development and evaluation stack. The single-process Tempo and
filesystem storage configurations are not highly available. Do not expose these
unauthenticated endpoints publicly or use this setup as the production backend
without adding authentication, durable object storage, backups, and resource
limits.

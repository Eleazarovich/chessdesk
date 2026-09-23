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
local Grafana login. The provisioned **ChessDesk Application Metrics** dashboard
is in the **ChessDesk** folder. Its Environment and Deployed version filters
apply to every application panel; the version choices follow the selected
environment.

Prometheus also provisions the `RepeatedSessionCreationFailures` alert. It
fires when at least 3 `POST /api/v1/sessions` requests return 5xx responses in
5 minutes and the condition remains active for 2 minutes. The alert includes
the service, environment, deployed version, owner, and a dashboard URL that
opens the session-creation failure panel with the affected environment and
version selected. It excludes 4xx responses such as invalid input or expired
authentication. View its current state at <http://localhost:9090/alerts>.
For the hosted stack, use the documented SSM port-forward to Grafana; the alert
dashboard URL uses that same local port-forward.

Prometheus retains 15 days of metrics with a 2 GB size limit, Loki retains logs
for 7 days, and Tempo retains traces for 24 hours. Local data is stored under
`observability/data/` and ignored by git. Stop the observability project with
`make observability-down`; data remains on disk. Remove it only when intended
with:

```bash
rm -rf observability/data
```

## Current telemetry coverage

The backend emits FastAPI request and SQLAlchemy spans, HTTP request duration,
active-request and body-size metrics with route, method, and response-status
dimensions, and SQLAlchemy connection-usage metrics.
Traces are available in Grafana's Tempo data source; Prometheus receives the
application metrics and Collector health metrics. Metrics use the same resource
attributes as traces, so `service_name`, `deployment_environment_name`, and
`service_version` are available as Prometheus labels. The Grafana dashboard
shows request rate, p95 latency, 5xx response percentage, active requests,
request and response payload sizes, and SQLAlchemy pool connections by state.
The app does not currently export OTLP logs, and container stdout is not
collected automatically; Loki is ready for logs sent over OTLP.

## Fit for ChessDesk

The Collector-to-Tempo path is a good fit for the backend's existing
OpenTelemetry traces, and the HTTP and database metrics give useful service
health signals. Loki will become useful after the app emits structured OTLP logs
or a log collector is configured; until then, it mostly adds a component to
operate. Add log collection before treating this as a complete application
observability setup.

The AWS deployment runs this stack on a dedicated EC2 host with encrypted
persistent storage. It is a single-node setup: it does not provide high
availability, cross-AZ replication, or automated EBS backups.

## Hosted AWS access

The CloudFormation stack in `deploy/observability-ec2.yaml` creates a separate
host, private `otel.chessdesk.internal` DNS record, and restricted OTLP
ingress. Dev and production app hosts are the only security-group sources
allowed to send OTLP gRPC traffic. Grafana and Prometheus bind to host loopback;
there is no public ingress to the dashboard, query APIs, or collector.

Human access uses an IAM policy and an SSM session document restricted to
Grafana port 3000. An AWS administrator attaches the stack's
`GrafanaAccessPolicyArn` output to approved IAM roles or groups. Operators with
that policy can retrieve the generated administrator password from the
`GrafanaAdminPasswordSecretArn` output and open the dashboard through a local
port-forward. The policy is deliberately not attached to an identity by the
stack because the authorized user or role must be selected by the account
owner.

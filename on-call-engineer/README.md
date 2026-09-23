# On-call engineer

`poll_alerts.py` polls the Prometheus alert API (`/api/v1/alerts`) every 60
seconds. Each alert is sent to a headless coding agent once when it enters the
`firing` state. It is sent again if it resolves and later fires again. The
runner keeps polling while the agent works and queues agent runs one at a time
so multiple runs do not edit the checkout concurrently.

From the repository root, start it with:

```bash
python on-call-engineer/poll_alerts.py
```

By default, it reads `http://localhost:9090` and runs:

```bash
codex exec --full-auto "<prompt containing the alert details>"
```

The agent runs with the repository root as its working directory. Install and
authenticate the selected coding agent before starting the poller. Alert labels
and annotations are treated as untrusted input in the agent prompt.

## Configuration

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `PROMETHEUS_URL` | `http://localhost:9090` | Prometheus base URL |
| `PROMETHEUS_BEARER_TOKEN` | unset | Optional bearer token for the alert API |
| `ONCALL_POLL_INTERVAL_SECONDS` | `60` | Poll interval |
| `ONCALL_REQUEST_TIMEOUT_SECONDS` | `10` | Timeout for each alert API request |
| `ONCALL_AGENT_TIMEOUT_SECONDS` | `1800` | Maximum run time for one agent invocation |
| `ONCALL_AGENT_COMMAND` | `["codex", "exec", "--full-auto"]` | JSON array of the command and arguments; the runner appends the prompt as its final argument |
| `ONCALL_LOG_LEVEL` | `INFO` | Python logging level |

For example, an alternate command can be configured without a shell:

```bash
export ONCALL_AGENT_COMMAND='["codex", "exec", "--json", "--full-auto"]'
```

The local observability Compose stack binds Prometheus to localhost port 9090.
For another deployment, set `PROMETHEUS_URL` to the Prometheus base URL reachable
from the poller. The script uses only Python's standard library.

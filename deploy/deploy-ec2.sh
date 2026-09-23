#!/usr/bin/env bash
set -Eeuo pipefail

image_tag="${1:-}"
commit="${2:-}"
region="${3:-}"
deployment_environment="${4:-}"

if [[ ! "$image_tag" =~ ^[0-9]{8}-[0-9]{6}-[0-9a-f]{7}$ \
  || ! "$commit" =~ ^[0-9a-f]{40}$ \
  || "${commit:0:7}" != "${image_tag##*-}" \
  || ! "$region" =~ ^[a-z0-9-]+$ \
  || ! "$deployment_environment" =~ ^(dev|production)$ ]]; then
  echo "Usage: $0 <YYYYMMDD-HHMMSS-shortsha> <40-character commit SHA> <AWS region> <dev|production>" >&2
  exit 2
fi

repository=/opt/chessdesk
rollback_container=chessdesk-rollback

if command -v cloud-init >/dev/null 2>&1; then
  cloud-init status --wait
fi

if [[ ! -d "$repository/.git" ]]; then
  echo "The ChessDesk deployment checkout is missing at $repository." >&2
  exit 1
fi
if [[ "$(git -C "$repository" rev-parse HEAD)" != "$commit" ]]; then
  echo "The deployment checkout does not match image source commit $commit." >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  dnf install -y awscli-2
fi
account_id="$(aws sts get-caller-identity --region "$region" --query Account --output text)"
registry="$account_id.dkr.ecr.$region.amazonaws.com"
image="$registry/chessdesk:$image_tag"
aws ecr get-login-password --region "$region" \
  | docker login --username AWS --password-stdin "$registry"
docker pull "$image"

if docker container inspect "$rollback_container" >/dev/null 2>&1; then
  docker rm --force "$rollback_container"
fi

previous_container=0
rollback_deploy() {
  local status=$?
  trap - EXIT
  if (( status != 0 )); then
    docker logs chessdesk >&2 2>/dev/null || true
    if docker container inspect "$rollback_container" >/dev/null 2>&1; then
      docker rm --force chessdesk >/dev/null 2>&1 || true
      docker rename "$rollback_container" chessdesk || true
      docker start chessdesk || true
    elif (( previous_container == 0 )); then
      docker rm --force chessdesk >/dev/null 2>&1 || true
    elif [[ "$(docker inspect --format '{{.State.Status}}' chessdesk 2>/dev/null || true)" == "exited" ]]; then
      docker start chessdesk || true
    fi
  fi
  exit "$status"
}
trap rollback_deploy EXIT

if docker container inspect chessdesk >/dev/null 2>&1; then
  previous_container=1
  docker stop chessdesk
  docker rename chessdesk "$rollback_container"
fi

docker run --detach \
  --name chessdesk \
  --restart unless-stopped \
  --publish 8000:8000 \
  --volume /data/chessdesk:/data \
  --env DATABASE_URL=sqlite:////data/chessdesk.db \
  --env CHESSDESK_SEED_DEMO=false \
  --env CHESSDESK_COOKIE_SECURE=true \
  --env OTEL_EXPORTER_OTLP_ENDPOINT=http://otel.chessdesk.internal:4317 \
  --env OTEL_EXPORTER_OTLP_PROTOCOL=grpc \
  --env "OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=$deployment_environment,service.version=$commit" \
  "$image"

for attempt in {1..60}; do
  health_status="$(docker inspect --format '{{.State.Health.Status}}' chessdesk 2>/dev/null || true)"
  if [[ "$health_status" == "healthy" ]]; then
    if docker container inspect "$rollback_container" >/dev/null 2>&1; then
      docker rm --force "$rollback_container"
    fi
    trap - EXIT
    echo "Deployed $image_tag from $commit and the container health check passed."
    exit 0
  fi
  if [[ "$(docker inspect --format '{{.State.Status}}' chessdesk 2>/dev/null || true)" == "exited" ]]; then
    break
  fi
  sleep 5
done

echo "New container did not become healthy; restoring the previous container." >&2
docker logs chessdesk >&2 2>/dev/null || true
exit 1

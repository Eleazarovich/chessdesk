#!/usr/bin/env bash
set -Eeuo pipefail

repository=/opt/chessdesk
commit="${1:-}"

if [[ ! "$commit" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: $0 <40-character commit SHA>" >&2
  exit 2
fi

# CloudFormation can finish before EC2 user data has built the first image and
# started the bootstrap container. Wait before checking out source or building
# again so the first pipeline deploy cannot race that setup.
if command -v cloud-init >/dev/null 2>&1; then
  cloud-init status --wait
fi
if ! docker container inspect chessdesk >/dev/null 2>&1; then
  echo "The initial ChessDesk container is missing after EC2 bootstrap completed." >&2
  tail -n 50 /var/log/chessdesk-bootstrap.log >&2 2>/dev/null || true
  exit 1
fi

git -C "$repository" fetch --depth 1 origin "$commit"
git -C "$repository" checkout --detach --force FETCH_HEAD
if [[ "$(git -C "$repository" rev-parse HEAD)" != "$commit" ]]; then
  echo "Checked out commit did not match requested SHA $commit." >&2
  exit 1
fi

image="chessdesk:$commit"
rollback_container=chessdesk-rollback

docker build --pull --tag "$image" "$repository"

if docker container inspect "$rollback_container" >/dev/null 2>&1; then
  docker rm --force "$rollback_container"
fi

rollback_deploy() {
  local status=$?
  trap - EXIT
  if (( status != 0 )); then
    if docker container inspect "$rollback_container" >/dev/null 2>&1; then
      docker logs chessdesk >&2 2>/dev/null || true
      docker rm --force chessdesk >/dev/null 2>&1 || true
      docker rename "$rollback_container" chessdesk || true
      docker start chessdesk || true
    elif [[ "$(docker inspect --format '{{.State.Status}}' chessdesk 2>/dev/null || true)" == "exited" ]]; then
      docker start chessdesk || true
    fi
  fi
  exit "$status"
}
trap rollback_deploy EXIT

docker stop chessdesk
docker rename chessdesk "$rollback_container"

docker run --detach \
  --name chessdesk \
  --restart unless-stopped \
  --publish 8000:8000 \
  --volume /data/chessdesk:/data \
  --env DATABASE_URL=sqlite:////data/chessdesk.db \
  --env CHESSDESK_SEED_DEMO=false \
  --env CHESSDESK_COOKIE_SECURE=true \
  "$image"

for attempt in {1..60}; do
  health_status="$(docker inspect --format '{{.State.Health.Status}}' chessdesk 2>/dev/null || true)"
  if [[ "$health_status" == "healthy" ]]; then
    docker rm --force "$rollback_container"
    trap - EXIT
    echo "Deployed $commit and the container health check passed."
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

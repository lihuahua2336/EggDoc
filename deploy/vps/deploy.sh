#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$project_root"

if [ ! -f .env ]; then
  echo "Missing .env. Create it from .env.example and add the production values." >&2
  exit 1
fi

compose() {
  docker compose --env-file .env -f compose.yaml -f compose.vps.yaml "$@"
}

compose pull app
compose up -d --no-build --remove-orphans app

container_id=$(compose ps -q app)
if [ -z "$container_id" ]; then
  echo "EggDoc container did not start." >&2
  exit 1
fi

attempt=0
while [ "$attempt" -lt 30 ]; do
  health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")
  if [ "$health" = "healthy" ]; then
    echo "EggDoc is healthy at http://127.0.0.1:4322"
    exit 0
  fi
  if [ "$health" = "unhealthy" ] || [ "$health" = "exited" ]; then
    compose logs --tail 100 app
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 2
done

echo "EggDoc did not become healthy within 60 seconds." >&2
compose logs --tail 100 app
exit 1

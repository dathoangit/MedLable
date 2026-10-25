#!/bin/sh
# Deploy the MedLabel API. Run from the repo root:
#   cp .env.example .env   # once; set the real PGPASSWORD
#   ./scripts/deploy-prod.sh
# The API is published on host port 8082.
set -eu

ENV_FILE=.env
HOST_PORT=8082

fail() {
  echo "deploy-prod: $1" >&2
  exit 1
}

cd "$(dirname "$0")/.."

docker compose version >/dev/null 2>&1 || fail "docker compose is not available"

[ -f "$ENV_FILE" ] || fail "$ENV_FILE is missing (copy .env.example to .env and set PGPASSWORD)"

read_env() {
  grep -E "^${1}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '\r' || true
}

for key in PGHOST PGDATABASE PGUSER PGPASSWORD; do
  value=$(read_env "$key")
  [ -n "$value" ] || fail "$key is empty in $ENV_FILE"
done

password=$(read_env PGPASSWORD)
[ "$password" != "change-me" ] || fail "PGPASSWORD in $ENV_FILE is still the placeholder"

echo "Building image"
docker compose build --pull

echo "Starting container on port $HOST_PORT"
docker compose up -d --remove-orphans

docker compose ps

echo "Waiting for http://127.0.0.1:$HOST_PORT/health"
attempt=0
until curl -fsS "http://127.0.0.1:$HOST_PORT/health"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo
    curl -sS "http://127.0.0.1:$HOST_PORT/health" || true
    echo
    fail "API did not become healthy within 60s. HTTP 503 means HIS Postgres is unreachable. Check: docker compose logs"
  fi
  sleep 2
done

echo
echo "MedLabel API is up at http://127.0.0.1:$HOST_PORT/"

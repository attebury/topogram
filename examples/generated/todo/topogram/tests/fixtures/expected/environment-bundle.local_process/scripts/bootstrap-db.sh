#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
. "$SCRIPT_DIR/load-env.sh"

if [[ "${TOPOGRAM_ENVIRONMENT_PROFILE:-local_process}" == "local_docker" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is required for the local_docker profile, but it is not installed." >&2
    echo "Set TOPOGRAM_ENVIRONMENT_PROFILE=local_process and point DATABASE_URL at a working local database, or install Docker." >&2
    exit 1
  fi
  docker compose -f "$ROOT_DIR/docker-compose.yml" up -d db
fi
(cd "$ROOT_DIR/db" && bash ./scripts/db-bootstrap-or-migrate.sh)
if [[ "${TOPOGRAM_SEED_DEMO:-true}" != "false" ]]; then
(cd "$ROOT_DIR/server" && npm install && npm exec -- prisma db push --schema prisma/schema.prisma --skip-generate && npm run seed:demo)
fi

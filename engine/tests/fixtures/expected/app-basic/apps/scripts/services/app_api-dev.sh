#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
. "$ROOT_DIR/scripts/load-env.sh"

node "$ROOT_DIR/scripts/guard-ports.mjs" api

if [[ -n "${DATABASE_URL:-}" ]]; then export DATABASE_URL="${DATABASE_URL}"; fi
if [[ -n "${DATABASE_ADMIN_URL:-}" ]]; then export DATABASE_ADMIN_URL="${DATABASE_ADMIN_URL}"; fi
export PORT="${APP_API_PORT:-${SERVER_PORT:-3000}}"
export TOPOGRAM_CORS_ORIGINS="${TOPOGRAM_CORS_ORIGINS:-http://localhost:${WEB_PORT:-5173},http://127.0.0.1:${WEB_PORT:-5173}}"

cd "$ROOT_DIR/services/app_api"
npm install
npm exec -- prisma generate --schema prisma/schema.prisma
npm run dev

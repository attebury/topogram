#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
. "$ROOT_DIR/scripts/load-env.sh"

node "$ROOT_DIR/scripts/guard-ports.mjs" web

export PUBLIC_TOPOGRAM_API_BASE_URL="${PUBLIC_TOPOGRAM_API_BASE_URL:-http://localhost:${APP_API_PORT:-${SERVER_PORT:-3000}}}"
export TOPOGRAM_CORS_ORIGINS="${TOPOGRAM_CORS_ORIGINS:-http://localhost:${APP_SVELTEKIT_PORT:-${WEB_PORT:-5173}},http://127.0.0.1:${APP_SVELTEKIT_PORT:-${WEB_PORT:-5173}}}"

cd "$ROOT_DIR/web/app_sveltekit"
npm install
npm run dev -- --host "${WEB_HOST:-127.0.0.1}" --port "${APP_SVELTEKIT_PORT:-${WEB_PORT:-5173}}"

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
. "$ROOT_DIR/scripts/load-env.sh"

node "$ROOT_DIR/scripts/guard-ports.mjs" web

export PUBLIC_TOPOGRAM_API_BASE_URL="${PUBLIC_TOPOGRAM_API_BASE_URL:-http://localhost:${API_PORT:-${SERVER_PORT:-3000}}}"
export TOPOGRAM_CORS_ORIGINS="${TOPOGRAM_CORS_ORIGINS:-http://localhost:${WEB_PORT:-${WEB_PORT:-5173}},http://127.0.0.1:${WEB_PORT:-${WEB_PORT:-5173}}}"

cd "$ROOT_DIR/web/web"
npm install
npm run dev -- --host "${WEB_HOST:-127.0.0.1}" --port "${WEB_PORT:-${WEB_PORT:-5173}}"

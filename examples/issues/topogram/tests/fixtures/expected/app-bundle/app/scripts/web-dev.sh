#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
. "$SCRIPT_DIR/load-env.sh"

node "$SCRIPT_DIR/guard-ports.mjs" web

export PUBLIC_TOPOGRAM_API_BASE_URL="${PUBLIC_TOPOGRAM_API_BASE_URL:-http://localhost:${SERVER_PORT:-3001}}"

cd "$ROOT_DIR/web"
npm install
npm run dev -- --host 0.0.0.0 --port "${WEB_PORT:-5174}"

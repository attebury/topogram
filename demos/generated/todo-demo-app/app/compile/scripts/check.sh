#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${TOPOGRAM_ENV_FILE:-$ROOT_DIR/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

echo "Checking generated server (services/api)..."
(cd "$ROOT_DIR/services/api" && npm install && npm run check)

echo "Checking generated web (web/web)..."
(cd "$ROOT_DIR/web/web" && npm install && npm run check)

echo "Building generated web (web/web)..."
(cd "$ROOT_DIR/web/web" && npm install && npm run build)

echo "Compile checks passed."

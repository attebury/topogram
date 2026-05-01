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

echo "Checking generated server (services/app_api)..."
echo "Installing dependencies (services/app_api)..."
(cd "$ROOT_DIR/services/app_api" && npm install --no-audit --no-fund)
echo "Running npm run check (services/app_api)..."
(cd "$ROOT_DIR/services/app_api" && npm run check)

echo "Checking generated web (web/app_sveltekit)..."
echo "Installing dependencies (web/app_sveltekit)..."
(cd "$ROOT_DIR/web/app_sveltekit" && npm install --no-audit --no-fund)
echo "Running npm run check (web/app_sveltekit)..."
(cd "$ROOT_DIR/web/app_sveltekit" && npm run check)

echo "Building generated web (web/app_sveltekit)..."
echo "Installing dependencies (web/app_sveltekit)..."
(cd "$ROOT_DIR/web/app_sveltekit" && npm install --no-audit --no-fund)
echo "Running npm run build (web/app_sveltekit)..."
(cd "$ROOT_DIR/web/app_sveltekit" && npm run build)

echo "Compile checks passed."

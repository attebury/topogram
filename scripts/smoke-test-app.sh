#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMOKE_APP_DIR="$ROOT_DIR/.tmp/smoke-test-app"

cd "$ROOT_DIR"
npm --prefix ./engine ci

rm -rf "$SMOKE_APP_DIR"
npm run new -- "$SMOKE_APP_DIR" --template "$ROOT_DIR/engine/tests/fixtures/templates/hello-web"
npm --prefix "$SMOKE_APP_DIR" install
npm --prefix "$SMOKE_APP_DIR" run check
npm --prefix "$SMOKE_APP_DIR" run generate
npm --prefix "$SMOKE_APP_DIR" run verify

echo
echo "Smoke test app generated and verified at $SMOKE_APP_DIR"

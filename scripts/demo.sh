#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_DIR="$ROOT_DIR/.tmp/demo-app"

cd "$ROOT_DIR"
npm --prefix ./engine ci

rm -rf "$DEMO_DIR"
npm run new -- "$DEMO_DIR"
npm --prefix "$DEMO_DIR" install
npm --prefix "$DEMO_DIR" run status
npm --prefix "$DEMO_DIR" run build

echo
echo "Demo app generated at $DEMO_DIR"
echo "Next:"
echo "  cd .tmp/demo-app"
echo "  npm run verify"

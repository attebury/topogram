#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_NAME="${1:-todo-demo-app}"
MODE="${2:-compile}"

case "$DEMO_NAME" in
  todo-demo-app)
    DEMO_ROOT="$ROOT_DIR/demos/generated/todo-demo-app"
    ;;
  *)
    echo "Unknown generated demo: $DEMO_NAME" >&2
    echo "Usage: bash scripts/verify-generated-demo.sh <todo-demo-app> [compile|runtime]" >&2
    exit 1
    ;;
esac

if [[ "$MODE" != "compile" && "$MODE" != "runtime" ]]; then
  echo "Unknown verification mode: $MODE" >&2
  echo "Usage: bash scripts/verify-generated-demo.sh <todo-demo-app> [compile|runtime]" >&2
  exit 1
fi

if [[ ! -d "$DEMO_ROOT" ]]; then
  echo "Missing generated demo at $DEMO_ROOT" >&2
  exit 1
fi

cd "$DEMO_ROOT"

echo "Installing ${DEMO_NAME} dependencies..."
npm ci

echo "Validating ${DEMO_NAME} Topogram..."
npm run check

echo "Regenerating ${DEMO_NAME} app bundle..."
npm run generate

echo "Running ${DEMO_NAME} compile checks..."
npm run app:compile

if [[ "$MODE" == "runtime" ]]; then
  echo "Running ${DEMO_NAME} smoke checks..."
  npm run app:smoke

  echo "Running ${DEMO_NAME} runtime checks..."
  npm run app:runtime-check
fi

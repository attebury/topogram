#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE_NAME="${1:-}"
MODE="${2:-compile-smoke}"

if [[ -z "$EXAMPLE_NAME" ]]; then
  echo "Usage: bash scripts/verify-generated-example.sh <todo|issues|content-approval> [compile-smoke|full]" >&2
  exit 1
fi

case "$EXAMPLE_NAME" in
  todo)
    WEB_PATH="/tasks"
    ;;
  issues)
    WEB_PATH="/issues"
    ;;
  content-approval)
    WEB_PATH="/articles"
    ;;
  *)
    echo "Unknown example: $EXAMPLE_NAME" >&2
    exit 1
    ;;
esac

if [[ "$MODE" != "compile-smoke" && "$MODE" != "full" ]]; then
  echo "Unknown verification mode: $MODE" >&2
  exit 1
fi

EXAMPLE_ROOT="$ROOT_DIR/examples/$EXAMPLE_NAME/apps/local-stack"
if [[ ! -d "$EXAMPLE_ROOT" ]]; then
  echo "Missing generated app bundle at $EXAMPLE_ROOT" >&2
  exit 1
fi

DEFAULT_ENV_FILE="$EXAMPLE_ROOT/.env"
DEFAULT_ENV_EXAMPLE_FILE="$EXAMPLE_ROOT/.env.example"
ENV_FILE="${TOPOGRAM_ENV_FILE:-$DEFAULT_ENV_FILE}"
if [[ ! -f "$ENV_FILE" && -z "${TOPOGRAM_ENV_FILE:-}" && -f "$DEFAULT_ENV_EXAMPLE_FILE" ]]; then
  ENV_FILE="$DEFAULT_ENV_EXAMPLE_FILE"
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

if [[ "$EXAMPLE_NAME" == "todo" ]]; then
  export TOPOGRAM_ENVIRONMENT_PROFILE="${TOPOGRAM_ENVIRONMENT_PROFILE:-local_docker}"
fi

API_BASE="${TOPOGRAM_API_BASE_URL:-http://localhost:${SERVER_PORT:-3000}}"
WEB_BASE="${TOPOGRAM_WEB_BASE_URL:-http://localhost:${WEB_PORT:-5173}}"

STACK_LOG="$(mktemp -t "topogram-${EXAMPLE_NAME}-stack.XXXXXX.log")"

cleanup() {
  if [[ -n "${STACK_PID:-}" ]]; then
    kill "$STACK_PID" >/dev/null 2>&1 || true
    wait "$STACK_PID" >/dev/null 2>&1 || true
  fi
  rm -f "$STACK_LOG"
}

trap cleanup EXIT INT TERM

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempt
  for attempt in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "Timed out waiting for ${label} at ${url}" >&2
  echo "Last stack log output:" >&2
  tail -n 120 "$STACK_LOG" >&2 || true
  return 1
}

cd "$EXAMPLE_ROOT"

echo "Bootstrapping ${EXAMPLE_NAME}..."
npm run bootstrap

echo "Running compile checks for ${EXAMPLE_NAME}..."
npm run compile

echo "Starting ${EXAMPLE_NAME} local stack..."
npm run dev >"$STACK_LOG" 2>&1 &
STACK_PID=$!

wait_for_url "${API_BASE}/health" "${EXAMPLE_NAME} API health"
wait_for_url "${WEB_BASE}${WEB_PATH}" "${EXAMPLE_NAME} web route"

if [[ "$MODE" == "full" ]]; then
  echo "Running runtime checks for ${EXAMPLE_NAME}..."
  npm run runtime-check
fi

echo "Running smoke checks for ${EXAMPLE_NAME}..."
npm run smoke

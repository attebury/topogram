#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS=()

node "$SCRIPT_DIR/guard-ports.mjs" stack

if [[ "${TOPOGRAM_SKIP_STACK_BOOTSTRAP:-false}" != "true" ]]; then
  bash "$SCRIPT_DIR/bootstrap-db.sh"
fi

bash "$SCRIPT_DIR/services/app_api-dev.sh" &
PIDS+=($!)
bash "$SCRIPT_DIR/web/app_sveltekit-dev.sh" &
PIDS+=($!)

cleanup() {
  if [[ "${#PIDS[@]}" -gt 0 ]]; then
    kill "${PIDS[@]}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM
wait

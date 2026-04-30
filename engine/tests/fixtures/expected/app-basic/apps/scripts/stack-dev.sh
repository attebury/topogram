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

kill_tree() {
  local pid="$1"
  local child
  while IFS= read -r child; do
    [[ -n "$child" ]] && kill_tree "$child"
  done < <(pgrep -P "$pid" 2>/dev/null || true)
  kill "$pid" >/dev/null 2>&1 || true
}

cleanup() {
  if [[ "${#PIDS[@]}" -gt 0 ]]; then
    for pid in "${PIDS[@]}"; do
      kill_tree "$pid"
    done
  fi
}

trap cleanup EXIT INT TERM
wait

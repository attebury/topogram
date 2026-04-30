#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STACK_PID=""

. "$SCRIPT_DIR/load-env.sh"

kill_tree() {
  local pid="$1"
  local child
  while IFS= read -r child; do
    [[ -n "$child" ]] && kill_tree "$child"
  done < <(pgrep -P "$pid" 2>/dev/null || true)
  kill "$pid" >/dev/null 2>&1 || true
}

cleanup() {
  if [[ -n "$STACK_PID" ]]; then
    kill_tree "$STACK_PID"
    wait "$STACK_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

bash "$SCRIPT_DIR/bootstrap.sh"

TOPOGRAM_SKIP_STACK_BOOTSTRAP=true bash "$SCRIPT_DIR/dev.sh" &
STACK_PID=$!

node "$SCRIPT_DIR/wait-for-stack.mjs"
bash "$SCRIPT_DIR/smoke.sh"
bash "$SCRIPT_DIR/runtime-check.sh"

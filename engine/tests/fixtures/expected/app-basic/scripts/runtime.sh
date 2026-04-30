#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STACK_PID=""

. "$SCRIPT_DIR/load-env.sh"

cleanup() {
  if [[ -n "$STACK_PID" ]]; then
    kill "$STACK_PID" >/dev/null 2>&1 || true
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

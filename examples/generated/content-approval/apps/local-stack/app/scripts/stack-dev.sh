#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/guard-ports.mjs" stack

bash "$SCRIPT_DIR/bootstrap-db.sh"

bash "$SCRIPT_DIR/server-dev.sh" &
SERVER_PID=$!
bash "$SCRIPT_DIR/web-dev.sh" &
WEB_PID=$!

cleanup() {
  kill "$SERVER_PID" "$WEB_PID" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM
wait

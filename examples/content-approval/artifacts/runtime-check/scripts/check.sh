#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_ENV_FILE="$ROOT_DIR/.env"
FALLBACK_ENV_FILE="$(cd "$ROOT_DIR/.." && pwd)/.env"
ENV_FILE="${TOPOGRAM_ENV_FILE:-$DEFAULT_ENV_FILE}"

if [[ ! -f "$ENV_FILE" && -z "${TOPOGRAM_ENV_FILE:-}" && -f "$FALLBACK_ENV_FILE" ]]; then
  ENV_FILE="$FALLBACK_ENV_FILE"
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

node "$SCRIPT_DIR/check.mjs"

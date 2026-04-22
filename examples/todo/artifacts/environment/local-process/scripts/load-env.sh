#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_ENV_FILE="$ROOT_DIR/.env"
DEFAULT_ENV_EXAMPLE_FILE="$ROOT_DIR/.env.example"
FALLBACK_ENV_FILE="$(cd "$ROOT_DIR/.." && pwd)/.env"
FALLBACK_ENV_EXAMPLE_FILE="$(cd "$ROOT_DIR/.." && pwd)/.env.example"
ENV_FILE="${TOPOGRAM_ENV_FILE:-$DEFAULT_ENV_FILE}"

if [[ ! -f "$ENV_FILE" && -z "${TOPOGRAM_ENV_FILE:-}" && -f "$FALLBACK_ENV_FILE" ]]; then
  ENV_FILE="$FALLBACK_ENV_FILE"
fi

if [[ ! -f "$ENV_FILE" && -z "${TOPOGRAM_ENV_FILE:-}" && -f "$DEFAULT_ENV_EXAMPLE_FILE" ]]; then
  ENV_FILE="$DEFAULT_ENV_EXAMPLE_FILE"
fi

if [[ ! -f "$ENV_FILE" && -z "${TOPOGRAM_ENV_FILE:-}" && -f "$FALLBACK_ENV_EXAMPLE_FILE" ]]; then
  ENV_FILE="$FALLBACK_ENV_EXAMPLE_FILE"
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_ENV_FILE="$ROOT_DIR/.env"
DEFAULT_ENV_EXAMPLE_FILE="$ROOT_DIR/.env.example"
ENV_FILE="${TOPOGRAM_ENV_FILE:-$DEFAULT_ENV_FILE}"

if [[ ! -f "$ENV_FILE" && -z "${TOPOGRAM_ENV_FILE:-}" && -f "$DEFAULT_ENV_EXAMPLE_FILE" ]]; then
  ENV_FILE="$DEFAULT_ENV_EXAMPLE_FILE"
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  if [[ "$DATABASE_URL" == file:* ]]; then
    database_path="${DATABASE_URL#file:}"
    if [[ "$database_path" != /* ]]; then
      DATABASE_URL="file:$ROOT_DIR/$(printf '%s' "$database_path" | sed 's#^./##')"
      export DATABASE_URL
    fi
  elif [[ "$DATABASE_URL" != /* && "$DATABASE_URL" != postgresql:* ]]; then
    DATABASE_URL="$ROOT_DIR/$(printf '%s' "$DATABASE_URL" | sed 's#^./##')"
    export DATABASE_URL
  fi
fi

#!/usr/bin/env bash
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/db-common.sh"

generate_desired_snapshot

if [[ -f "$CURRENT_SNAPSHOT" ]]; then
  generate_migration_plan "$CURRENT_SNAPSHOT"
  cat "$PLAN_JSON"
else
  echo '{"mode":"greenfield","currentSnapshot":null}'
fi

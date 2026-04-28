#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${TOPOGRAM_DB_STATE_DIR:-$(cd "$SCRIPT_DIR/../state" && pwd)}"
CURRENT_SNAPSHOT="$STATE_DIR/current.snapshot.json"

if [[ -f "$CURRENT_SNAPSHOT" ]]; then
  exec bash "$SCRIPT_DIR/db-migrate.sh"
fi

. "$SCRIPT_DIR/db-common.sh"
if reconcile_existing_database_snapshot; then
  refresh_runtime_clients
  cp "$DESIRED_SNAPSHOT" "$CURRENT_SNAPSHOT"
  echo "Existing database already matches desired schema. Recorded current snapshot."
  exit 0
else
  status=$?
  if [[ "$status" -eq 2 ]]; then
    if infer_current_snapshot_from_live_tables; then
      echo "Existing database tables matched a subset of the desired Topogram schema. Recorded an inferred current snapshot."
      exec bash "$SCRIPT_DIR/db-migrate.sh"
    else
      infer_status=$?
      if [[ "$infer_status" -eq 3 ]]; then
        echo "Existing database tables matched a subset of the desired Topogram schema. Recorded an inferred current snapshot."
        exec bash "$SCRIPT_DIR/db-migrate.sh"
      fi
      echo "Existing database is not empty and does not match the desired Topogram schema." >&2
      echo "Create or provide a matching current snapshot before running migrations." >&2
      exit 1
    fi
  fi
fi

exec bash "$SCRIPT_DIR/db-bootstrap.sh"

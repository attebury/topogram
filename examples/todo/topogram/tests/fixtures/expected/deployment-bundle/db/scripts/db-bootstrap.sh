#!/usr/bin/env bash
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/db-common.sh"

if [[ -f "$CURRENT_SNAPSHOT" ]]; then
  echo "Current snapshot already exists at $CURRENT_SNAPSHOT. Run ./scripts/db-migrate.sh instead." >&2
  exit 1
fi

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
      echo "Create or provide a matching current snapshot before running bootstrap." >&2
      exit 1
    fi
  fi
fi

provision_database_if_needed
generate_desired_snapshot
generate_sql_migration "$EMPTY_SNAPSHOT"
apply_sql
refresh_runtime_clients
cp "$DESIRED_SNAPSHOT" "$CURRENT_SNAPSHOT"
echo "Greenfield bootstrap complete."

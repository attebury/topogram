#!/usr/bin/env bash
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/db-common.sh"

if [[ ! -f "$CURRENT_SNAPSHOT" ]]; then
  echo "No current snapshot found at $CURRENT_SNAPSHOT. Run ./scripts/db-bootstrap.sh instead." >&2
  exit 1
fi

if ! current_snapshot_matches_live_database; then
  if infer_current_snapshot_from_live_tables; then
    echo "Current snapshot did not match the live database. Replaced it with an inferred snapshot from live tables."
  else
    infer_status=$?
    if [[ "$infer_status" -eq 3 ]]; then
      echo "Current snapshot did not match the live database. Replaced it with an inferred snapshot from live tables."
    else
      echo "Current snapshot does not match the live database and could not be inferred safely." >&2
      exit 1
    fi
  fi
fi

generate_desired_snapshot
generate_migration_plan "$CURRENT_SNAPSHOT"
ensure_supported_plan
generate_sql_migration "$CURRENT_SNAPSHOT"
apply_sql
refresh_runtime_clients
cp "$DESIRED_SNAPSHOT" "$CURRENT_SNAPSHOT"
echo "Brownfield migration complete."

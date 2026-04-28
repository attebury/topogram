#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
resolve_repo_root_candidate() {
  local candidate="$1"
  local base_dir="$2"
  local resolved=""
  if [[ -z "$candidate" ]]; then
    return 1
  fi
  if [[ "$candidate" = /* ]]; then
    resolved="$candidate"
  else
    resolved="$(cd "$base_dir" && cd "$candidate" 2>/dev/null && pwd)" || return 1
  fi
  if [[ -f "$resolved/engine/src/cli.js" ]]; then
    printf '%s\n' "$resolved"
    return 0
  fi
  return 1
}
discover_repo_root() {
  if [[ -n "${TOPOGRAM_REPO_ROOT:-}" ]]; then
    local resolved=""
    if resolved="$(resolve_repo_root_candidate "$TOPOGRAM_REPO_ROOT" "$PWD")"; then
      printf '%s\n' "$resolved"
      return
    fi
    if resolved="$(resolve_repo_root_candidate "$TOPOGRAM_REPO_ROOT" "$BUNDLE_DIR")"; then
      printf '%s\n' "$resolved"
      return
    fi
    echo "TOPOGRAM_REPO_ROOT is set but does not point to a Topogram repo: $TOPOGRAM_REPO_ROOT" >&2
    exit 1
  fi
  local resolved=""
  for candidate in     "$BUNDLE_DIR/../../.."     "$BUNDLE_DIR/../../../.."     "$BUNDLE_DIR/../../../../.."     "$BUNDLE_DIR/../.."     "$BUNDLE_DIR/../../../../../../"; do
    if resolved="$(resolve_repo_root_candidate "$candidate" "$PWD")"; then
      printf '%s\n' "$resolved"
      return
    fi
  done
  echo "Unable to locate the Topogram repo root. Set TOPOGRAM_REPO_ROOT." >&2
  exit 1
}
REPO_ROOT="$(discover_repo_root)"
INPUT_PATH="${TOPOGRAM_INPUT_PATH:-$REPO_ROOT/demos/generated/todo-demo-app/topogram}"
PROJECTION_ID="proj_db_postgres"
STATE_DIR="${TOPOGRAM_DB_STATE_DIR:-$BUNDLE_DIR/state}"
CURRENT_SNAPSHOT="$STATE_DIR/current.snapshot.json"
DESIRED_SNAPSHOT="$STATE_DIR/desired.snapshot.json"
PLAN_JSON="$STATE_DIR/migration.plan.json"
MIGRATION_SQL="$STATE_DIR/migration.sql"
EMPTY_SNAPSHOT="$BUNDLE_DIR/snapshots/empty.snapshot.json"
PRISMA_SCHEMA="$BUNDLE_DIR/prisma/schema.prisma"

mkdir -p "$STATE_DIR"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

postgres_cli_url() {
  require_env DATABASE_URL
  node --input-type=module -e 'const url = new URL(process.argv[1]); url.searchParams.delete("schema"); console.log(url.toString());' "$DATABASE_URL"
}

postgres_admin_cli_url() {
  require_env DATABASE_ADMIN_URL
  node --input-type=module -e 'const url = new URL(process.argv[1]); url.searchParams.delete("schema"); console.log(url.toString());' "$DATABASE_ADMIN_URL"
}


ensure_db_cli_on_path() {
  if command -v psql >/dev/null 2>&1; then
    return
  fi
  local candidates=(
    "/opt/homebrew/opt/postgresql@18/bin"
    "/opt/homebrew/opt/postgresql@17/bin"
    "/opt/homebrew/opt/postgresql@16/bin"
    "/usr/local/opt/postgresql@18/bin"
    "/usr/local/opt/postgresql@17/bin"
    "/usr/local/opt/postgresql@16/bin"
  )
  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate/psql" ]]; then
      export PATH="$candidate:$PATH"
      return
    fi
  done
  if command -v brew >/dev/null 2>&1; then
    local prefix=""
    prefix="$(brew --prefix postgresql@18 2>/dev/null || true)"
    if [[ -n "$prefix" && -x "$prefix/bin/psql" ]]; then
      export PATH="$prefix/bin:$PATH"
      return
    fi
    prefix="$(brew --prefix postgresql@17 2>/dev/null || true)"
    if [[ -n "$prefix" && -x "$prefix/bin/psql" ]]; then
      export PATH="$prefix/bin:$PATH"
      return
    fi
    prefix="$(brew --prefix postgresql@16 2>/dev/null || true)"
    if [[ -n "$prefix" && -x "$prefix/bin/psql" ]]; then
      export PATH="$prefix/bin:$PATH"
      return
    fi
  fi
  echo "Unable to locate psql. Install PostgreSQL or add it to PATH." >&2
  exit 1
}

list_live_tables_json() {
  require_env DATABASE_URL
  ensure_db_cli_on_path
  local cli_url
  cli_url="$(postgres_cli_url)"
  psql "$cli_url" -Atqc "select coalesce(json_agg(tablename order by tablename)::text, '[]') from pg_tables where schemaname = 'public'"
}

reconcile_existing_database_snapshot() {
  generate_desired_snapshot
  local live_tables
  live_tables="$(list_live_tables_json)"
  node --input-type=module -e 'import fs from "node:fs"; const live = JSON.parse(process.argv[1] || "[]"); const desired = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).tables.map((table) => table.table).sort(); const actual = [...live].sort(); if (actual.length === 0) process.exit(1); if (JSON.stringify(actual) === JSON.stringify(desired)) process.exit(0); console.error("Existing database tables do not match the desired Topogram schema."); console.error(JSON.stringify({ actual, desired }, null, 2)); process.exit(2);' "$live_tables" "$DESIRED_SNAPSHOT"
}

current_snapshot_matches_live_database() {
  if [[ ! -f "$CURRENT_SNAPSHOT" ]]; then
    return 1
  fi
  local live_tables
  live_tables="$(list_live_tables_json)"
  node --input-type=module -e 'import fs from "node:fs"; const live = [...new Set(JSON.parse(process.argv[1] || "[]"))].sort(); const current = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).tables.map((table) => table.table).sort(); process.exit(JSON.stringify(live) === JSON.stringify(current) ? 0 : 1);' "$live_tables" "$CURRENT_SNAPSHOT"
}

infer_current_snapshot_from_live_tables() {
  generate_desired_snapshot
  local live_tables
  live_tables="$(list_live_tables_json)"
  node --input-type=module -e 'import fs from "node:fs"; const live = [...new Set(JSON.parse(process.argv[1] || "[]"))].sort(); const desiredSnapshotPath = process.argv[2]; const outputPath = process.argv[3]; const desiredSnapshot = JSON.parse(fs.readFileSync(desiredSnapshotPath, "utf8")); const desiredTables = new Map((desiredSnapshot.tables || []).map((table) => [table.table, table])); if (live.length === 0) process.exit(1); const unknown = live.filter((name) => !desiredTables.has(name)); if (unknown.length > 0) process.exit(2); const inferredTables = live.map((name) => desiredTables.get(name)).filter(Boolean); const inferredSnapshot = { ...desiredSnapshot, tables: inferredTables }; fs.writeFileSync(outputPath, JSON.stringify(inferredSnapshot, null, 2) + "\n", "utf8"); process.exit(inferredTables.length === desiredSnapshot.tables.length ? 0 : 3);' "$live_tables" "$DESIRED_SNAPSHOT" "$CURRENT_SNAPSHOT"
}

generate_desired_snapshot() {
  node "$REPO_ROOT/engine/src/cli.js" "$INPUT_PATH" --generate db-schema-snapshot --projection "$PROJECTION_ID" > "$DESIRED_SNAPSHOT"
}

generate_migration_plan() {
  local from_snapshot="$1"
  node "$REPO_ROOT/engine/src/cli.js" "$INPUT_PATH" --generate db-migration-plan --projection "$PROJECTION_ID" --from-snapshot "$from_snapshot" > "$PLAN_JSON"
}

generate_sql_migration() {
  local from_snapshot="$1"
  node "$REPO_ROOT/engine/src/cli.js" "$INPUT_PATH" --generate sql-migration --projection "$PROJECTION_ID" --from-snapshot "$from_snapshot" > "$MIGRATION_SQL"
}

ensure_supported_plan() {
  node --input-type=module -e 'import fs from "node:fs"; const plan = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if (!plan.supported) { console.error("Manual migration required."); console.error(JSON.stringify(plan.manual, null, 2)); process.exit(2); }' "$PLAN_JSON"
}

provision_database_if_needed() {
  require_env DATABASE_URL
  ensure_db_cli_on_path
  local cli_url
  cli_url="$(postgres_cli_url)"
  if psql "$cli_url" -c 'select 1' >/dev/null 2>&1; then
    return
  fi
  if [[ -z "${DATABASE_ADMIN_URL:-}" ]]; then
    echo "DATABASE_URL is not reachable and DATABASE_ADMIN_URL was not provided." >&2
    exit 1
  fi
  local admin_cli_url
  admin_cli_url="$(postgres_admin_cli_url)"
  local db_name
  db_name="$(node --input-type=module -e 'const url = new URL(process.argv[1]); console.log(url.pathname.replace(/^\//, ""));' "$DATABASE_URL")"
  if ! psql "$admin_cli_url" -Atqc "select 1 from pg_database where datname = '$db_name'" | grep -q 1; then
    psql "$admin_cli_url" -c "create database \"$db_name\""
  fi
}

apply_sql() {
  require_env DATABASE_URL
  ensure_db_cli_on_path
  local cli_url
  cli_url="$(postgres_cli_url)"
  psql "$cli_url" -v ON_ERROR_STOP=1 -f "$MIGRATION_SQL"
}

refresh_runtime_clients() {
  if [[ "${TOPOGRAM_SKIP_RUNTIME_CLIENT_REFRESH:-0}" == "1" ]]; then
    return
  fi
  local prisma_version="5.22.0"
  local runtime_server_dir="${TOPOGRAM_RUNTIME_SERVER_DIR:-}"
  if [[ -z "$runtime_server_dir" && -f "$BUNDLE_DIR/../server/package.json" ]]; then
    runtime_server_dir="$BUNDLE_DIR/../server"
  fi
  if [[ -z "$runtime_server_dir" && -d "$BUNDLE_DIR/../../services" ]]; then
    for candidate in "$BUNDLE_DIR"/../../services/*; do
      if [[ -f "$candidate/package.json" ]]; then
        runtime_server_dir="$candidate"
        break
      fi
    done
  fi
  if [[ -n "$runtime_server_dir" && -f "$runtime_server_dir/package.json" ]]; then
    (cd "$runtime_server_dir" && npm install && npm exec -- prisma db push --schema "$PRISMA_SCHEMA" --skip-generate)
    return
  fi
  npx -p "prisma@$prisma_version" prisma db push --schema "$PRISMA_SCHEMA" --skip-generate
}

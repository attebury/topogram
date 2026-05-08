import {
  buildDbProjectionContract,
  dbProfileForProjection,
  dbProjectionCandidates,
  generatorDefaultsMap,
  getProjection
} from "./shared.js";
import { normalizeDbSchemaSnapshot } from "./snapshot.js";
import { generatePostgresDrizzleSchema } from "./postgres/drizzle.js";
import { generatePostgresPrismaSchema } from "./postgres/prisma.js";
import { generateSqlitePrismaSchema } from "./sqlite/prisma.js";

function defaultInputPathForGraph(graph, options = {}) {
  if (options.topogramInputPath) {
    return options.topogramInputPath;
  }
  return ".";
}

function dbLifecyclePlan(graph, projection, options = {}) {
  const contract = buildDbProjectionContract(graph, projection);
  const snapshot = normalizeDbSchemaSnapshot(contract);
  const engine = snapshot.engine;
  const ormProfiles = engine === "postgres" ? ["prisma", "drizzle"] : ["prisma"];

  return {
    type: "db_lifecycle_plan",
    projection: snapshot.projection,
    engine,
    dbProfile: contract.profile,
    ormProfiles,
    runtimeProfile: ormProfiles.includes("prisma") ? "prisma" : null,
    inputPath: defaultInputPathForGraph(graph, options),
    state: {
      currentSnapshot: "state/current.snapshot.json",
      desiredSnapshot: "state/desired.snapshot.json",
      migrationPlan: "state/migration.plan.json",
      migrationSql: "state/migration.sql"
    },
    bundle: {
      emptySnapshot: "snapshots/empty.snapshot.json",
      prismaSchema: ormProfiles.includes("prisma") ? "prisma/schema.prisma" : null,
      drizzleSchema: engine === "postgres" ? "drizzle/schema.ts" : null
    },
    environment: {
      required: ["DATABASE_URL"],
      optional:
        engine === "postgres"
          ? ["DATABASE_ADMIN_URL", "TOPOGRAM_BIN", "TOPOGRAM_INPUT_PATH", "TOPOGRAM_DB_STATE_DIR"]
          : ["TOPOGRAM_BIN", "TOPOGRAM_INPUT_PATH", "TOPOGRAM_DB_STATE_DIR"]
    },
    greenfield: {
      detection: "missing current snapshot",
      provisioning:
        engine === "postgres"
          ? "create database when DATABASE_ADMIN_URL is available, otherwise assume DATABASE_URL already points at a provisioned database"
          : "create sqlite file if missing",
      setup: [
        "generate desired schema snapshot",
        "generate initial SQL migration from the bundled empty snapshot",
        "apply SQL to the target database",
        ...(ormProfiles.includes("prisma") ? ["run prisma generate against the bundled schema"] : []),
        "persist desired snapshot as current"
      ]
    },
    brownfield: {
      detection: "existing current snapshot",
      setup: [
        "generate desired schema snapshot",
        "diff current snapshot against desired snapshot",
        "stop if manual intervention is required",
        "generate additive SQL migration",
        "apply SQL to the target database",
        ...(ormProfiles.includes("prisma") ? ["run prisma generate against the bundled schema"] : []),
        "persist desired snapshot as current"
      ],
      safety: "manual migration required plans are never auto-applied"
    }
  };
}

function renderEmptySnapshotForProjection(projection) {
  const profile = dbProfileForProjection(projection);
  const engine = profile.startsWith("sqlite") ? "sqlite" : "postgres";
  return {
    type: "db_schema_snapshot",
    projection: {
      id: projection.id,
      name: projection.name || projection.id,
      type: projection.type || projection.type
    },
    profile,
    generatorDefaults: generatorDefaultsMap(projection),
    engine,
    enums: [],
    tables: []
  };
}

function renderDbLifecycleEnvExample(projection, plan) {
  const engine = plan.engine || (dbProfileForProjection(projection).startsWith("sqlite") ? "sqlite" : "postgres");
  const inputPath = "../../../../topogram";
  if (engine === "sqlite") {
    return `DATABASE_URL=file:./var/${projection.id}.sqlite\nTOPOGRAM_INPUT_PATH=${inputPath}\n`;
  }

  return `POSTGRES_USER=\${USER:-postgres}\nDATABASE_URL=postgresql://\${POSTGRES_USER}@localhost:5432/${projection.id}\nDATABASE_ADMIN_URL=postgresql://\${POSTGRES_USER}@localhost:5432/postgres\nTOPOGRAM_INPUT_PATH=${inputPath}\n`;
}

function renderDbLifecycleReadme(plan) {
  return `# ${plan.projection.name} Lifecycle

This bundle gives agents a repeatable database workflow for projection \`${plan.projection.id}\`.

## Modes

- Greenfield: run \`./scripts/db-bootstrap-or-migrate.sh\` with no current snapshot
- Brownfield: run \`./scripts/db-bootstrap-or-migrate.sh\` with \`state/current.snapshot.json\` already present

## Required Environment

${plan.environment.required.map((name) => `- \`${name}\``).join("\n")}

## Optional Environment

${plan.environment.optional.map((name) => `- \`${name}\``).join("\n")}

## Files

- Desired snapshot: \`${plan.state.desiredSnapshot}\`
- Current snapshot: \`${plan.state.currentSnapshot}\`
- Migration plan: \`${plan.state.migrationPlan}\`
- Migration SQL: \`${plan.state.migrationSql}\`

## Commands

- \`./scripts/db-status.sh\`
- \`./scripts/db-bootstrap.sh\`
- \`./scripts/db-migrate.sh\`
- \`./scripts/db-bootstrap-or-migrate.sh\`
`;
}

function renderDbLifecycleCommonScript(plan) {
  const engine = plan.engine;
  return `#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
resolve_path_candidate() {
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
  printf '%s\\n' "$resolved"
}
find_topogram_bin() {
  if [[ -n "\${TOPOGRAM_BIN:-}" ]]; then
    printf '%s\\n' "$TOPOGRAM_BIN"
    return
  fi
  local candidates=(
    "$BUNDLE_DIR/../../../../node_modules/.bin/topogram"
    "$BUNDLE_DIR/../../../node_modules/.bin/topogram"
    "$PWD/node_modules/.bin/topogram"
  )
  local candidate
  for candidate in "\${candidates[@]}"; do
    if [[ -x "$candidate" ]]; then
      printf '%s\\n' "$candidate"
      return
    fi
  done
  if command -v topogram >/dev/null 2>&1; then
    command -v topogram
    return
  fi
  echo "Unable to locate the Topogram CLI. Install @topogram/cli or set TOPOGRAM_BIN." >&2
  exit 1
}
discover_input_path() {
  if [[ -n "\${TOPOGRAM_INPUT_PATH:-}" ]]; then
    local resolved=""
    if resolved="$(resolve_path_candidate "$TOPOGRAM_INPUT_PATH" "$PWD")"; then
      printf '%s\\n' "$resolved"
      return
    fi
    if resolved="$(resolve_path_candidate "$TOPOGRAM_INPUT_PATH" "$BUNDLE_DIR")"; then
      printf '%s\\n' "$resolved"
      return
    fi
    echo "TOPOGRAM_INPUT_PATH is set but cannot be resolved: $TOPOGRAM_INPUT_PATH" >&2
    exit 1
  fi
  local resolved=""
  local candidates=(
    "$BUNDLE_DIR/../../../.."
    "$BUNDLE_DIR/../../.."
    "$BUNDLE_DIR/../../../../.."
    "$PWD"
  )
  local candidate
  for candidate in "\${candidates[@]}"; do
    if resolved="$(resolve_path_candidate "$candidate" "$PWD")" && [[ -d "$resolved/topogram" ]]; then
      printf '%s\\n' "$resolved/topogram"
      return
    fi
  done
  echo "Unable to locate a Topogram workspace. Set TOPOGRAM_INPUT_PATH." >&2
  exit 1
}
TOPOGRAM_BIN="$(find_topogram_bin)"
INPUT_PATH="$(discover_input_path)"
PROJECTION_ID="${plan.projection.id}"
STATE_DIR="\${TOPOGRAM_DB_STATE_DIR:-$BUNDLE_DIR/state}"
CURRENT_SNAPSHOT="$STATE_DIR/current.snapshot.json"
DESIRED_SNAPSHOT="$STATE_DIR/desired.snapshot.json"
PLAN_JSON="$STATE_DIR/migration.plan.json"
MIGRATION_SQL="$STATE_DIR/migration.sql"
EMPTY_SNAPSHOT="$BUNDLE_DIR/${plan.bundle.emptySnapshot}"
PRISMA_SCHEMA="${plan.bundle.prismaSchema ? `$BUNDLE_DIR/${plan.bundle.prismaSchema}` : ""}"

mkdir -p "$STATE_DIR"

require_env() {
  local name="$1"
  if [[ -z "\${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

${engine === "postgres" ? `postgres_cli_url() {
  require_env DATABASE_URL
  node --input-type=module -e 'const url = new URL(process.argv[1]); url.searchParams.delete("schema"); console.log(url.toString());' "$DATABASE_URL"
}

postgres_admin_cli_url() {
  require_env DATABASE_ADMIN_URL
  node --input-type=module -e 'const url = new URL(process.argv[1]); url.searchParams.delete("schema"); console.log(url.toString());' "$DATABASE_ADMIN_URL"
}
` : `normalize_sqlite_database_url() {
  require_env DATABASE_URL
  local base_dir
  base_dir="$(cd "$BUNDLE_DIR/../.." && pwd)"
  local database_path="$DATABASE_URL"
  if [[ "$database_path" == file:* ]]; then
    database_path="\${database_path#file:}"
  fi
  if [[ "$database_path" != /* ]]; then
    database_path="$base_dir/$(printf '%s' "$database_path" | sed 's#^\./##')"
  fi
  mkdir -p "$(dirname "$database_path")"
  export DATABASE_URL="file:$database_path"
}

sqlite_cli_database_path() {
  normalize_sqlite_database_url
  printf '%s\n' "\${DATABASE_URL#file:}"
}
`}

ensure_db_cli_on_path() {
${engine === "postgres" ? `  if command -v psql >/dev/null 2>&1; then
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
  for candidate in "\${candidates[@]}"; do
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
  exit 1` : `  if command -v sqlite3 >/dev/null 2>&1; then
    return
  fi
  echo "Unable to locate sqlite3. Install SQLite or add it to PATH." >&2
  exit 1`}
}

list_live_tables_json() {
  require_env DATABASE_URL
  ensure_db_cli_on_path
${engine === "postgres" ? `  local cli_url
  cli_url="$(postgres_cli_url)"
  psql "$cli_url" -Atqc "select coalesce(json_agg(tablename order by tablename)::text, '[]') from pg_tables where schemaname = 'public'"` : `  normalize_sqlite_database_url
  local database_path
  database_path="$(sqlite_cli_database_path)"
  if [[ ! -f "$database_path" ]]; then
    printf '[]\\n'
    return
  fi
  sqlite3 "$database_path" "select json_group_array(name) from (select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name)" | sed 's/^$/[]/'`}
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
  node --input-type=module -e 'import fs from "node:fs"; const live = [...new Set(JSON.parse(process.argv[1] || "[]"))].sort(); const desiredSnapshotPath = process.argv[2]; const outputPath = process.argv[3]; const desiredSnapshot = JSON.parse(fs.readFileSync(desiredSnapshotPath, "utf8")); const desiredTables = new Map((desiredSnapshot.tables || []).map((table) => [table.table, table])); if (live.length === 0) process.exit(1); const unknown = live.filter((name) => !desiredTables.has(name)); if (unknown.length > 0) process.exit(2); const inferredTables = live.map((name) => desiredTables.get(name)).filter(Boolean); const inferredSnapshot = { ...desiredSnapshot, tables: inferredTables }; fs.writeFileSync(outputPath, JSON.stringify(inferredSnapshot, null, 2) + "\\n", "utf8"); process.exit(inferredTables.length === desiredSnapshot.tables.length ? 0 : 3);' "$live_tables" "$DESIRED_SNAPSHOT" "$CURRENT_SNAPSHOT"
}

generate_desired_snapshot() {
  "$TOPOGRAM_BIN" emit db-schema-snapshot "$INPUT_PATH" --projection "$PROJECTION_ID" > "$DESIRED_SNAPSHOT"
}

generate_migration_plan() {
  local from_snapshot="$1"
  "$TOPOGRAM_BIN" emit db-migration-plan "$INPUT_PATH" --projection "$PROJECTION_ID" --from-snapshot "$from_snapshot" > "$PLAN_JSON"
}

generate_sql_migration() {
  local from_snapshot="$1"
  "$TOPOGRAM_BIN" emit sql-migration "$INPUT_PATH" --projection "$PROJECTION_ID" --from-snapshot "$from_snapshot" > "$MIGRATION_SQL"
}

ensure_supported_plan() {
  node --input-type=module -e 'import fs from "node:fs"; const plan = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if (!plan.supported) { console.error("Manual migration required."); console.error(JSON.stringify(plan.manual, null, 2)); process.exit(2); }' "$PLAN_JSON"
}

provision_database_if_needed() {
  require_env DATABASE_URL
  ensure_db_cli_on_path
${engine === "postgres" ? `  local cli_url
  cli_url="$(postgres_cli_url)"
  if psql "$cli_url" -c 'select 1' >/dev/null 2>&1; then
    return
  fi
  if [[ -z "\${DATABASE_ADMIN_URL:-}" ]]; then
    echo "DATABASE_URL is not reachable and DATABASE_ADMIN_URL was not provided." >&2
    exit 1
  fi
  local admin_cli_url
  admin_cli_url="$(postgres_admin_cli_url)"
  local db_name
  db_name="$(node --input-type=module -e 'const url = new URL(process.argv[1]); console.log(url.pathname.replace(/^\\//, ""));' "$DATABASE_URL")"
  if ! psql "$admin_cli_url" -Atqc "select 1 from pg_database where datname = '$db_name'" | grep -q 1; then
    psql "$admin_cli_url" -c "create database \\"$db_name\\""
  fi` : `  local database_path
  database_path="$(sqlite_cli_database_path)"
  mkdir -p "$(dirname "$database_path")"`}
}

apply_sql() {
  require_env DATABASE_URL
  ensure_db_cli_on_path
${engine === "postgres" ? `  local cli_url
  cli_url="$(postgres_cli_url)"
  psql "$cli_url" -v ON_ERROR_STOP=1 -f "$MIGRATION_SQL"` : `  local database_path
  database_path="$(sqlite_cli_database_path)"
  sqlite3 "$database_path" < "$MIGRATION_SQL"`}
}

refresh_runtime_clients() {
${plan.bundle.prismaSchema ? `  if [[ "\${TOPOGRAM_SKIP_RUNTIME_CLIENT_REFRESH:-0}" == "1" ]]; then
    return
  fi
  local prisma_version="5.22.0"
${engine === "sqlite" ? `  normalize_sqlite_database_url
` : ""}  local runtime_server_dir="\${TOPOGRAM_RUNTIME_SERVER_DIR:-}"
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
  npx -p "prisma@$prisma_version" prisma db push --schema "$PRISMA_SCHEMA" --skip-generate` : `  :`}
}
`;
}

function renderDbStatusScript() {
  return `#!/usr/bin/env bash
set -euo pipefail
. "$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)/db-common.sh"

generate_desired_snapshot

if [[ -f "$CURRENT_SNAPSHOT" ]]; then
  generate_migration_plan "$CURRENT_SNAPSHOT"
  cat "$PLAN_JSON"
else
  echo '{"mode":"greenfield","currentSnapshot":null}'
fi
`;
}

function renderDbBootstrapScript() {
  return `#!/usr/bin/env bash
set -euo pipefail
. "$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)/db-common.sh"

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
`;
}

function renderDbMigrateScript() {
  return `#!/usr/bin/env bash
set -euo pipefail
. "$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)/db-common.sh"

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
`;
}

function renderDbBootstrapOrMigrateScript() {
  return `#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="\${TOPOGRAM_DB_STATE_DIR:-$(cd "$SCRIPT_DIR/../state" && pwd)}"
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
`;
}

function generateDbLifecycleBundle(graph, projection, options = {}) {
  const plan = dbLifecyclePlan(graph, projection, options);
  const files = {
    "README.md": renderDbLifecycleReadme(plan),
    ".env.example": renderDbLifecycleEnvExample(projection, plan),
    "scripts/db-common.sh": renderDbLifecycleCommonScript(plan),
    "scripts/db-status.sh": renderDbStatusScript(),
    "scripts/db-bootstrap.sh": renderDbBootstrapScript(),
    "scripts/db-migrate.sh": renderDbMigrateScript(),
    "scripts/db-bootstrap-or-migrate.sh": renderDbBootstrapOrMigrateScript(),
    "snapshots/empty.snapshot.json": `${JSON.stringify(renderEmptySnapshotForProjection(projection), null, 2)}\n`,
    "state/.gitkeep": ""
  };

  if (plan.bundle.prismaSchema) {
    files[plan.bundle.prismaSchema] =
      plan.engine === "sqlite"
        ? generateSqlitePrismaSchema(graph, { projectionId: projection.id })
        : generatePostgresPrismaSchema(graph, { projectionId: projection.id });
  }
  if (plan.bundle.drizzleSchema) {
    files[plan.bundle.drizzleSchema] = generatePostgresDrizzleSchema(graph, { projectionId: projection.id });
  }

  return files;
}

export function generateDbLifecyclePlanForProjection(graph, projection, options = {}) {
  return dbLifecyclePlan(graph, projection, options);
}

export function generateDbLifecyclePlan(graph, options = {}) {
  if (options.projectionId) {
    return dbLifecyclePlan(graph, getProjection(graph, options.projectionId), options);
  }

  const output = {};
  for (const projection of dbProjectionCandidates(graph)) {
    output[projection.id] = dbLifecyclePlan(graph, projection, options);
  }
  return output;
}

export function generateDbLifecycleBundleForProjection(graph, projection, options = {}) {
  return generateDbLifecycleBundle(graph, projection, options);
}

#!/usr/bin/env bash
set -euo pipefail

CLI_PACKAGE_SPEC="${TOPOGRAM_CLI_PACKAGE_SPEC:-@topogram/cli@latest}"
TEMPLATE_ALIAS="${TOPOGRAM_FRESH_SMOKE_TEMPLATE:-hello-web}"
STARTER_NAME="${TOPOGRAM_FRESH_SMOKE_STARTER:-hello-web}"
TMP_PARENT="${TMPDIR:-/tmp}"
WORK_ROOT="${TOPOGRAM_FRESH_SMOKE_ROOT:-$(mktemp -d "${TMP_PARENT%/}/topogram-fresh-npmjs.XXXXXX")}"
NPM_CACHE_DIR="$WORK_ROOT/.npm-cache"
CONSUMER_DIR="$WORK_ROOT/consumer"
EXTRACTOR_SOURCE_DIR="$WORK_ROOT/extractor-source"
EXTRACTOR_TARGET_DIR="$WORK_ROOT/extracted-topogram"
EXTRACTOR_SCAFFOLD_DIR="$WORK_ROOT/extractor-scaffold"

mkdir -p "$CONSUMER_DIR" "$NPM_CACHE_DIR" "$EXTRACTOR_SOURCE_DIR"
export npm_config_cache="$NPM_CACHE_DIR"

echo "Fresh npmjs smoke dir: $WORK_ROOT"
echo "Installing published Topogram CLI ($CLI_PACKAGE_SPEC)..."
(
  cd "$CONSUMER_DIR"
  npm init -y >/dev/null
  npm install --save-dev "$CLI_PACKAGE_SPEC" >/dev/null
)

TOPOGRAM_BIN="$CONSUMER_DIR/node_modules/.bin/topogram"
if [[ ! -x "$TOPOGRAM_BIN" ]]; then
  echo "Expected topogram binary was not installed: $TOPOGRAM_BIN" >&2
  exit 1
fi

VERSION_JSON="$("$TOPOGRAM_BIN" version --json)"
node --input-type=module - "$VERSION_JSON" "${EXPECTED_TOPOGRAM_CLI_VERSION:-}" <<'NODE'
const payload = JSON.parse(process.argv[2]);
const expected = process.argv[3] || "";
if (payload.packageName !== "@topogram/cli") {
  throw new Error(`Expected @topogram/cli, got ${payload.packageName}`);
}
if (expected && payload.version !== expected) {
  throw new Error(`Expected Topogram CLI ${expected}, got ${payload.version}`);
}
console.log(`Using Topogram CLI ${payload.version} from ${payload.executablePath}`);
NODE

echo "Checking public package and catalog access..."
(
  cd "$CONSUMER_DIR"
  "$TOPOGRAM_BIN" doctor
  "$TOPOGRAM_BIN" template list
)

echo "Checking public extractor packages..."
(
  cd "$CONSUMER_DIR"
  npm install --save-dev @topogram/extractor-prisma-db @topogram/extractor-express-api >/dev/null
  "$TOPOGRAM_BIN" extractor show @topogram/extractor-prisma-db --json >/dev/null
  "$TOPOGRAM_BIN" extractor show @topogram/extractor-express-api --json >/dev/null
  "$TOPOGRAM_BIN" extractor check @topogram/extractor-prisma-db --json >/dev/null
  "$TOPOGRAM_BIN" extractor check @topogram/extractor-express-api --json >/dev/null
)

echo "Checking extractor scaffold command..."
"$TOPOGRAM_BIN" extractor scaffold "$EXTRACTOR_SCAFFOLD_DIR" \
  --track cli \
  --package @scope/topogram-extractor-scaffold \
  --id @scope/extractor-scaffold \
  --json > "$WORK_ROOT/extractor-scaffold-result.json"
"$TOPOGRAM_BIN" extractor check "$EXTRACTOR_SCAFFOLD_DIR" --json > "$WORK_ROOT/extractor-scaffold-check.json"
TOPOGRAM_BIN="$TOPOGRAM_BIN" npm --prefix "$EXTRACTOR_SCAFFOLD_DIR" run check > "$WORK_ROOT/extractor-scaffold-npm-check.txt"
node --input-type=module - "$WORK_ROOT" <<'NODE'
import fs from "node:fs";
import path from "node:path";

const workRoot = process.argv[2];
const scaffoldPayload = JSON.parse(fs.readFileSync(path.join(workRoot, "extractor-scaffold-result.json"), "utf8"));
if (!scaffoldPayload.ok || scaffoldPayload.track !== "cli") {
  throw new Error("Expected extractor scaffold to create a CLI extractor package.");
}
const checkPayload = JSON.parse(fs.readFileSync(path.join(workRoot, "extractor-scaffold-check.json"), "utf8"));
if (!checkPayload.ok || checkPayload.smoke?.extractors !== 1) {
  throw new Error("Expected scaffolded extractor package to pass topogram extractor check.");
}
const npmCheck = fs.readFileSync(path.join(workRoot, "extractor-scaffold-npm-check.txt"), "utf8");
if (!npmCheck.includes("Extractor package smoke passed")) {
  throw new Error("Expected scaffolded extractor package npm check to pass.");
}
NODE

mkdir -p "$EXTRACTOR_SOURCE_DIR/prisma/migrations/20260513000000_init" "$EXTRACTOR_SOURCE_DIR/src"
cat > "$EXTRACTOR_SOURCE_DIR/package.json" <<'JSON'
{
  "name": "topogram-public-extractor-smoke-source",
  "private": true,
  "dependencies": {
    "express": "^4.18.0",
    "prisma": "^5.0.0"
  }
}
JSON
cat > "$EXTRACTOR_SOURCE_DIR/prisma/schema.prisma" <<'PRISMA'
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model PackageTask {
  id        String   @id
  title     String
  status    String   @default("open")
  createdAt DateTime @default(now())

  @@index([status])
}
PRISMA
cat > "$EXTRACTOR_SOURCE_DIR/prisma/migrations/20260513000000_init/migration.sql" <<'SQL'
CREATE TABLE "PackageTask" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PackageTask_status_idx" ON "PackageTask" ("status");
SQL
cat > "$EXTRACTOR_SOURCE_DIR/src/server.js" <<'JS'
const express = require("express");

const app = express();
const router = express.Router();

router.get("/package-tasks", requireAuth, (req, res) => {
  res.json({ status: req.query.status || "open", items: [] });
});

router.post("/package-tasks", requireAuth, (req, res) => {
  res.status(201).json({ id: "task_1" });
});

function requireAuth(req, res, next) {
  next();
}

app.use("/api", router);
module.exports = app;
JS

echo "Extracting a source app with public extractor packages..."
(
  cd "$CONSUMER_DIR"
  "$TOPOGRAM_BIN" extract "$EXTRACTOR_SOURCE_DIR" \
    --out "$EXTRACTOR_TARGET_DIR" \
    --from db,api \
    --extractor @topogram/extractor-prisma-db \
    --extractor @topogram/extractor-express-api \
    --json > "$WORK_ROOT/public-extractor-smoke.json"
  "$TOPOGRAM_BIN" extract plan "$EXTRACTOR_TARGET_DIR" --json > "$WORK_ROOT/public-extractor-plan.json"
  "$TOPOGRAM_BIN" adopt --list "$EXTRACTOR_TARGET_DIR" --json > "$WORK_ROOT/public-extractor-adopt-list.json"
)
node --input-type=module - "$WORK_ROOT" "$EXTRACTOR_TARGET_DIR" <<'NODE'
import fs from "node:fs";
import path from "node:path";

const workRoot = process.argv[2];
const targetRoot = process.argv[3];
const extractPayload = JSON.parse(fs.readFileSync(path.join(workRoot, "public-extractor-smoke.json"), "utf8"));
if (!extractPayload.ok) {
  throw new Error("Expected public package-backed extraction to pass.");
}
const counts = extractPayload.candidateCounts || {};
for (const [key, minimum] of Object.entries({
  dbEntities: 1,
  dbMaintainedSeams: 1,
  apiCapabilities: 1,
  apiRoutes: 1
})) {
  if ((counts[key] || 0) < minimum) {
    throw new Error(`Expected candidateCounts.${key} >= ${minimum}, got ${counts[key] || 0}.`);
  }
}

const provenancePath = path.join(targetRoot, ".topogram-extract.json");
const provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
const packageNames = (provenance.extract?.extractorPackages || []).map((entry) => entry.packageName).sort();
for (const packageName of ["@topogram/extractor-express-api", "@topogram/extractor-prisma-db"]) {
  if (!packageNames.includes(packageName)) {
    throw new Error(`Expected extraction provenance to include ${packageName}.`);
  }
}

const dbCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "db", "candidates.json"), "utf8"));
if (!dbCandidates.entities?.some((entry) => entry.id_hint === "entity_package_task")) {
  throw new Error("Expected Prisma package extractor to emit PackageTask entity candidate.");
}
if (!dbCandidates.maintained_seams?.some((entry) => entry.tool === "prisma")) {
  throw new Error("Expected Prisma package extractor to emit a maintained DB seam candidate.");
}

const apiCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "api", "candidates.json"), "utf8"));
if (!apiCandidates.routes?.some((entry) => entry.path === "/package-tasks")) {
  throw new Error("Expected Express package extractor to emit /package-tasks route candidate.");
}
if (!apiCandidates.capabilities?.some((entry) => entry.id_hint === "cap_list_package_tasks")) {
  throw new Error("Expected Express package extractor to emit list package tasks capability candidate.");
}

const planPayload = JSON.parse(fs.readFileSync(path.join(workRoot, "public-extractor-plan.json"), "utf8"));
const planBundles = (planPayload.bundles || []).map((bundle) => bundle.bundle);
if (!planBundles.includes("database")) {
  throw new Error("Expected extract plan to include the maintained database seam review bundle.");
}
if (!planBundles.includes("package-task")) {
  throw new Error("Expected extract plan to include a package task API/model review bundle.");
}

const adoptPayload = JSON.parse(fs.readFileSync(path.join(workRoot, "public-extractor-adopt-list.json"), "utf8"));
const adoptSelectors = (adoptPayload.selectors || []).map((item) => item.selector);
if (!adoptSelectors.includes("bundle:database") || !adoptSelectors.includes("bundle:package-task")) {
  throw new Error("Expected adopt --list to expose package-backed extraction review selectors.");
}
NODE

echo "Creating starter from public catalog alias '$TEMPLATE_ALIAS'..."
(
  cd "$CONSUMER_DIR"
  "$TOPOGRAM_BIN" copy "$TEMPLATE_ALIAS" "./$STARTER_NAME"
)

STARTER_DIR="$CONSUMER_DIR/$STARTER_NAME"
if [[ ! -f "$STARTER_DIR/package.json" ]]; then
  echo "Expected generated starter package.json at $STARTER_DIR/package.json." >&2
  exit 1
fi

echo "Installing starter dependencies..."
npm --prefix "$STARTER_DIR" install >/dev/null

echo "Checking and generating starter..."
npm --prefix "$STARTER_DIR" run doctor
npm --prefix "$STARTER_DIR" run check
npm --prefix "$STARTER_DIR" run generate

if [[ ! -f "$STARTER_DIR/app/.topogram-generated.json" ]]; then
  echo "Expected generated app sentinel at $STARTER_DIR/app/.topogram-generated.json." >&2
  exit 1
fi

echo "Compiling generated app..."
npm --prefix "$STARTER_DIR/app" run compile

echo
echo "Fresh npmjs smoke passed: $WORK_ROOT"

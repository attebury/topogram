#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE_DIR="$ROOT_DIR/engine"
WORK_ROOT="$ROOT_DIR/.tmp/cli-package"
NPM_CACHE_DIR="$ROOT_DIR/.tmp/npm-cache"

mkdir -p "$WORK_ROOT" "$NPM_CACHE_DIR"
export npm_config_cache="$NPM_CACHE_DIR"
RUN_DIR="$(mktemp -d "$WORK_ROOT/run.XXXXXX")"
PACK_DIR="$RUN_DIR/pack"
CONSUMER_DIR="$RUN_DIR/consumer"
TEMPLATE_PACKAGE_DIR="$RUN_DIR/template-package"
CATALOG_FILE="$RUN_DIR/topograms.catalog.json"
mkdir -p "$PACK_DIR" "$CONSUMER_DIR" "$TEMPLATE_PACKAGE_DIR"

echo "Packing @attebury/topogram..."
PACK_NAME="$(cd "$ENGINE_DIR" && npm pack --silent --pack-destination "$PACK_DIR" | tail -n 1)"
PACKAGE_TARBALL="$PACK_DIR/$PACK_NAME"

if [[ ! -f "$PACKAGE_TARBALL" ]]; then
  echo "Expected package tarball was not created: $PACKAGE_TARBALL" >&2
  exit 1
fi

echo "Installing packed CLI into a consumer project..."
(
  cd "$CONSUMER_DIR"
  npm init -y >/dev/null
  npm install "$PACKAGE_TARBALL" >/dev/null
)

TOPOGRAM_BIN="$CONSUMER_DIR/node_modules/.bin/topogram"
if [[ ! -x "$TOPOGRAM_BIN" ]]; then
  echo "Expected topogram binary was not installed: $TOPOGRAM_BIN" >&2
  exit 1
fi

echo "Checking installed CLI help..."
"$TOPOGRAM_BIN" --help >/dev/null

echo "Checking installed CLI catalog commands..."
node --input-type=module -e '
  import fs from "node:fs";
  const catalog = {
    version: "0.1",
    entries: [
      {
        id: "smoke",
        kind: "template",
        package: "@attebury/topogram-template-smoke",
        defaultVersion: "0.1.0",
        description: "Smoke template",
        tags: ["smoke"],
        trust: {
          scope: "@attebury",
          includesExecutableImplementation: true
        }
      }
    ]
  };
  fs.writeFileSync(process.argv[1], `${JSON.stringify(catalog, null, 2)}\n`);
' "$CATALOG_FILE"
"$TOPOGRAM_BIN" catalog check "$CATALOG_FILE" >/dev/null
"$TOPOGRAM_BIN" catalog show smoke --catalog "$CATALOG_FILE" --json >/dev/null
"$TOPOGRAM_BIN" template list --catalog "$CATALOG_FILE" --json >/dev/null

echo "Packing a template pack..."
cp -R "$ENGINE_DIR/tests/fixtures/templates/web-api-db/." "$TEMPLATE_PACKAGE_DIR/"
(
  cd "$TEMPLATE_PACKAGE_DIR"
  node --input-type=module -e '
    import fs from "node:fs";
    const pkg = {
      name: "@attebury/topogram-template-smoke",
      version: "0.1.0",
      private: true,
      type: "module",
      files: ["topogram-template.json", "topogram", "topogram.project.json", "implementation"]
    };
    fs.writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
  '
)
TEMPLATE_PACK_NAME="$(cd "$TEMPLATE_PACKAGE_DIR" && npm pack --silent --pack-destination "$PACK_DIR" | tail -n 1)"
TEMPLATE_TARBALL="$PACK_DIR/$TEMPLATE_PACK_NAME"

if [[ ! -f "$TEMPLATE_TARBALL" ]]; then
  echo "Expected template tarball was not created: $TEMPLATE_TARBALL" >&2
  exit 1
fi

echo "Creating a starter with the packed CLI and local fixture template..."
(
  cd "$CONSUMER_DIR"
  TOPOGRAM_CLI_PACKAGE_SPEC="$PACKAGE_TARBALL" "$TOPOGRAM_BIN" new ./starter --template "$ENGINE_DIR/tests/fixtures/templates/hello-web"
)

echo "Creating a starter with the packed template..."
(
  cd "$CONSUMER_DIR"
  TOPOGRAM_CLI_PACKAGE_SPEC="$PACKAGE_TARBALL" "$TOPOGRAM_BIN" new ./starter-from-template --template "$TEMPLATE_TARBALL"
)

STARTER_DIR="$CONSUMER_DIR/starter"
STARTER_TEMPLATE_DIR="$CONSUMER_DIR/starter-from-template"
if [[ ! -f "$STARTER_DIR/package.json" ]]; then
  echo "Expected starter package.json was not created." >&2
  exit 1
fi
if [[ ! -f "$STARTER_TEMPLATE_DIR/package.json" ]]; then
  echo "Expected template starter package.json was not created." >&2
  exit 1
fi

echo "Installing starter dependencies from the packed CLI tarball..."
npm --prefix "$STARTER_DIR" install >/dev/null
npm --prefix "$STARTER_TEMPLATE_DIR" install >/dev/null

echo "Checking and generating the starter..."
npm --prefix "$STARTER_DIR" run doctor
npm --prefix "$STARTER_DIR" run source:status
npm --prefix "$STARTER_DIR" run template:explain
npm --prefix "$STARTER_DIR" run template:detach:dry-run
npm --prefix "$STARTER_DIR" run template:detach
npm --prefix "$STARTER_DIR" run source:status
npm --prefix "$STARTER_DIR" run template:explain
npm --prefix "$STARTER_DIR" run check
npm --prefix "$STARTER_DIR" run generate
npm --prefix "$STARTER_TEMPLATE_DIR" run doctor
npm --prefix "$STARTER_TEMPLATE_DIR" run source:status
npm --prefix "$STARTER_TEMPLATE_DIR" run template:explain
npm --prefix "$STARTER_TEMPLATE_DIR" run template:detach:dry-run
npm --prefix "$STARTER_TEMPLATE_DIR" run check
npm --prefix "$STARTER_TEMPLATE_DIR" run generate

if [[ ! -f "$STARTER_DIR/app/.topogram-generated.json" ]]; then
  echo "Expected generated app sentinel was not written." >&2
  exit 1
fi
if [[ ! -f "$STARTER_TEMPLATE_DIR/app/.topogram-generated.json" ]]; then
  echo "Expected generated template app sentinel was not written." >&2
  exit 1
fi

echo
echo "CLI package smoke passed: $PACKAGE_TARBALL"

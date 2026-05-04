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
if tar -tf "$PACKAGE_TARBALL" | grep -q '^package/templates/'; then
  echo "Packed CLI must not include product starter template directories." >&2
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

echo "Checking installed template helper imports..."
(
  cd "$CONSUMER_DIR"
  node --input-type=module -e '
    import { renderSvelteKitComponentRegion } from "@attebury/topogram/template-helpers/sveltekit.js";
    import { renderReactComponentRegion } from "@attebury/topogram/template-helpers/react.js";
    const rendered = renderSvelteKitComponentRegion(
      {
        components: [
          {
            region: "results",
            component: { id: "component_grid", name: "Grid" }
          }
        ]
      },
      "results",
      {
        componentContracts: {
          component_grid: { patterns: ["resource_table"] }
        },
        itemsExpression: "data.items",
        useTypescript: true
      }
    );
    if (!rendered.includes(`data-topogram-component="component_grid"`)) {
      throw new Error("Expected SvelteKit helper to render component marker.");
    }
    if (!rendered.includes("data.items")) {
      throw new Error("Expected SvelteKit helper to preserve items expression.");
    }
    const reactRendered = renderReactComponentRegion(
      {
        components: [
          {
            region: "results",
            component: { id: "component_react_grid", name: "React Grid" }
          }
        ]
      },
      "results",
      {
        componentContracts: {
          component_react_grid: { patterns: ["resource_table"] }
        },
        itemsExpression: "items",
        useTypescript: true
      }
    );
    if (!reactRendered.includes(`data-topogram-component="component_react_grid"`)) {
      throw new Error("Expected React helper to render component marker.");
    }
    if (!reactRendered.includes("className=\"component-card component-table\"")) {
      throw new Error("Expected React helper to render JSX className markup.");
    }
  '
)

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

echo "Checking catalog-disabled default starter guidance..."
set +e
DISABLED_OUTPUT="$(cd "$CONSUMER_DIR" && TOPOGRAM_CATALOG_SOURCE=none "$TOPOGRAM_BIN" new ./no-catalog-default 2>&1)"
DISABLED_STATUS=$?
set -e
if [[ "$DISABLED_STATUS" -eq 0 ]]; then
  echo "Expected catalog-disabled default starter creation to fail." >&2
  exit 1
fi
if [[ "$DISABLED_OUTPUT" != *"The default starter 'hello-web' is catalog-backed"* ]]; then
  echo "Expected catalog-disabled guidance to explain the catalog-backed default starter." >&2
  echo "$DISABLED_OUTPUT" >&2
  exit 1
fi
if [[ "$DISABLED_OUTPUT" == *"For the private default catalog"* ]]; then
  echo "Catalog-disabled guidance should not suggest private catalog auth before enabling a catalog." >&2
  echo "$DISABLED_OUTPUT" >&2
  exit 1
fi

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
npm --prefix "$STARTER_DIR" run query:list
npm --prefix "$STARTER_DIR" run query:show -- component-behavior
npm --prefix "$STARTER_DIR" run source:status
npm --prefix "$STARTER_DIR" run template:explain
npm --prefix "$STARTER_DIR" run template:detach:dry-run
npm --prefix "$STARTER_DIR" run template:detach
npm --prefix "$STARTER_DIR" run source:status
npm --prefix "$STARTER_DIR" run template:explain
npm --prefix "$STARTER_DIR" run check
npm --prefix "$STARTER_DIR" run generate
npm --prefix "$STARTER_TEMPLATE_DIR" run doctor
npm --prefix "$STARTER_TEMPLATE_DIR" run query:list
npm --prefix "$STARTER_TEMPLATE_DIR" run query:show -- component-behavior
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

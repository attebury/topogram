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
GENERATOR_PACKAGE_DIR="$RUN_DIR/generator-package"
CATALOG_FILE="$RUN_DIR/topograms.catalog.json"
mkdir -p "$PACK_DIR" "$CONSUMER_DIR" "$TEMPLATE_PACKAGE_DIR" "$GENERATOR_PACKAGE_DIR"

echo "Packing @topogram/cli..."
PACK_NAME="$(cd "$ENGINE_DIR" && npm pack --silent --pack-destination "$PACK_DIR" | tail -n 1)"
PACKAGE_TARBALL="$PACK_DIR/$PACK_NAME"

if [[ ! -f "$PACKAGE_TARBALL" ]]; then
  echo "Expected package tarball was not created: $PACKAGE_TARBALL" >&2
  exit 1
fi
if tar -tzf "$PACKAGE_TARBALL" | awk -F/ '{ print $NF }' | grep -E '^(\.env.*|\.npmrc|\.DS_Store|.*\.(pem|key|p8|p12|pfx)|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|secrets\..*|credentials\..*)$' >"$RUN_DIR/cli-restricted-files.txt"; then
  echo "Packed CLI must not publish restricted local or secret files:" >&2
  cat "$RUN_DIR/cli-restricted-files.txt" >&2
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
    import { renderSvelteKitWidgetRegion } from "@topogram/cli/template-helpers/sveltekit.js";
    import { renderReactWidgetRegion } from "@topogram/cli/template-helpers/react.js";
    const rendered = renderSvelteKitWidgetRegion(
      {
        widgets: [
          {
            region: "results",
            widget: { id: "widget_grid", name: "Grid" }
          }
        ]
      },
      "results",
      {
        widgetContracts: {
          widget_grid: { patterns: ["resource_table"] }
        },
        itemsExpression: "data.items",
        useTypescript: true
      }
    );
    if (!rendered.includes(`data-topogram-widget="widget_grid"`)) {
      throw new Error("Expected SvelteKit helper to render widget marker.");
    }
    if (!rendered.includes("data.items")) {
      throw new Error("Expected SvelteKit helper to preserve items expression.");
    }
    const reactRendered = renderReactWidgetRegion(
      {
        widgets: [
          {
            region: "results",
            widget: { id: "widget_react_grid", name: "React Grid" }
          }
        ]
      },
      "results",
      {
        widgetContracts: {
          widget_react_grid: { patterns: ["resource_table"] }
        },
        itemsExpression: "items",
        useTypescript: true
      }
    );
    if (!reactRendered.includes(`data-topogram-widget="widget_react_grid"`)) {
      throw new Error("Expected React helper to render widget marker.");
    }
    if (!reactRendered.includes("className=\"widget-card widget-table\"")) {
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
        package: "@topogram/template-smoke",
        defaultVersion: "0.1.0",
        description: "Smoke template",
        tags: ["smoke"],
        trust: {
          scope: "@topogram",
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

echo "Packing a package-backed generator pack..."
GENERATOR_PACKAGE_NAME="@topogram/generator-smoke-web"
cat > "$GENERATOR_PACKAGE_DIR/package.json" <<'JSON'
{
  "name": "@topogram/generator-smoke-web",
  "version": "0.1.0",
  "private": true,
  "main": "index.cjs",
  "exports": {
    ".": "./index.cjs",
    "./topogram-generator.json": "./topogram-generator.json",
    "./package.json": "./package.json"
  },
  "files": [
    "index.cjs",
    "topogram-generator.json"
  ]
}
JSON
cat > "$GENERATOR_PACKAGE_DIR/topogram-generator.json" <<'JSON'
{
  "id": "@topogram/generator-smoke-web",
  "version": "1",
  "surface": "web",
  "runtimeKinds": [
    "web_surface"
  ],
  "projectionTypes": [
    "web_surface"
  ],
  "inputs": [
    "ui-surface-contract"
  ],
  "outputs": [
    "web-app"
  ],
  "stack": {
    "runtime": "browser",
    "framework": "smoke",
    "language": "javascript"
  },
  "capabilities": {
    "routes": true,
    "coverage": true
  },
  "source": "package",
  "package": "@topogram/generator-smoke-web"
}
JSON
cat > "$GENERATOR_PACKAGE_DIR/index.cjs" <<'CJS'
const manifest = require("./topogram-generator.json");

exports.manifest = manifest;

exports.generate = function generate(context) {
  const screens = Array.isArray(context?.contracts?.uiSurface?.screens)
    ? context.contracts.uiSurface.screens
    : [];
  const runtimeId = context?.runtime?.id || "";
  const projectionId = context?.projection?.id || "";
  const html = [
    "<!doctype html>",
    "<html>",
    "<head><meta charset=\"utf-8\"><title>Topogram Generator Smoke</title></head>",
    `<body data-generator="${manifest.id}" data-runtime="${runtimeId}">`,
    "<main>",
    "<h1>Topogram package generator smoke</h1>",
    `<p data-projection="${projectionId}">Screens: ${screens.length}</p>`,
    "</main>",
    "</body>",
    "</html>"
  ].join("\n");
  return {
    files: {
      "index.html": `${html}\n`,
      "topogram-generator-context.json": `${JSON.stringify({
        generator: manifest.id,
        runtime: runtimeId,
        projection: projectionId,
        screens: screens.map((screen) => screen.id)
      }, null, 2)}\n`
    },
    artifacts: {
      coverage: {
        screens: screens.length
      }
    },
    diagnostics: []
  };
};
CJS
GENERATOR_PACK_NAME="$(cd "$GENERATOR_PACKAGE_DIR" && npm pack --silent --pack-destination "$PACK_DIR" | tail -n 1)"
GENERATOR_TARBALL="$PACK_DIR/$GENERATOR_PACK_NAME"

if [[ ! -f "$GENERATOR_TARBALL" ]]; then
  echo "Expected generator tarball was not created: $GENERATOR_TARBALL" >&2
  exit 1
fi

echo "Checking installed CLI package-backed generator commands..."
(
  cd "$CONSUMER_DIR"
  TOPOGRAM_CLI_PACKAGE_SPEC="$PACKAGE_TARBALL" "$TOPOGRAM_BIN" new ./generator-ux --template "$ENGINE_DIR/tests/fixtures/templates/hello-web"
)
GENERATOR_PROJECT_DIR="$CONSUMER_DIR/generator-ux"
npm --prefix "$GENERATOR_PROJECT_DIR" install -D "$GENERATOR_TARBALL" >/dev/null
node --input-type=module -e '
  import fs from "node:fs";
  import path from "node:path";
  const projectRoot = process.argv[1];
  const packageName = process.argv[2];
  const projectConfigPath = path.join(projectRoot, "topogram.project.json");
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
  const webRuntime = projectConfig.topology.runtimes.find((runtime) => runtime.kind === "web_surface");
  if (!webRuntime) {
    throw new Error("Expected hello-web starter to include one web runtime.");
  }
  webRuntime.generator = {
    id: packageName,
    version: "1",
    package: packageName
  };
  fs.writeFileSync(projectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`);
  fs.writeFileSync(path.join(projectRoot, "topogram.generator-policy.json"), `${JSON.stringify({
    version: "0.1",
    allowedPackageScopes: [],
    allowedPackages: [packageName],
    pinnedVersions: {
      [packageName]: "1"
    }
  }, null, 2)}\n`);
' "$GENERATOR_PROJECT_DIR" "$GENERATOR_PACKAGE_NAME"
(
  cd "$GENERATOR_PROJECT_DIR"
  "$TOPOGRAM_BIN" generator list --json > "$RUN_DIR/generator-list.json"
  "$TOPOGRAM_BIN" generator show "$GENERATOR_PACKAGE_NAME" --json > "$RUN_DIR/generator-show.json"
  "$TOPOGRAM_BIN" generator check "$GENERATOR_PACKAGE_NAME" --json > "$RUN_DIR/generator-check.json"
  "$TOPOGRAM_BIN" generator list > "$RUN_DIR/generator-list.txt"
  "$TOPOGRAM_BIN" generator show "$GENERATOR_PACKAGE_NAME" > "$RUN_DIR/generator-show.txt"
  "$TOPOGRAM_BIN" generator check "$GENERATOR_PACKAGE_NAME" > "$RUN_DIR/generator-check.txt"
  "$TOPOGRAM_BIN" generator policy status --json > "$RUN_DIR/generator-policy-status.json"
  "$TOPOGRAM_BIN" generator policy check --json > "$RUN_DIR/generator-policy-check.json"
  "$TOPOGRAM_BIN" check > "$RUN_DIR/generator-project-check.txt"
  "$TOPOGRAM_BIN" generate > "$RUN_DIR/generator-project-generate.txt"
)
npm --prefix "$GENERATOR_PROJECT_DIR" run generator:policy:status > "$RUN_DIR/generator-npm-policy-status.txt"
npm --prefix "$GENERATOR_PROJECT_DIR" run generator:policy:check > "$RUN_DIR/generator-npm-policy-check.txt"
node --input-type=module -e '
  import fs from "node:fs";
  import path from "node:path";
  const runDir = process.argv[1];
  const projectRoot = process.argv[2];
  const packageName = process.argv[3];
  const listPayload = JSON.parse(fs.readFileSync(path.join(runDir, "generator-list.json"), "utf8"));
  if (!listPayload.ok) {
    throw new Error("Expected generator list --json to pass.");
  }
  const listed = listPayload.generators.find((generator) => generator.id === packageName);
  if (!listed) {
    throw new Error(`Expected generator list to include ${packageName}.`);
  }
  if (listed.source !== "package" || listed.package !== packageName || listed.installed !== true) {
    throw new Error("Expected installed package-backed generator metadata in generator list.");
  }
  if (listed.loadsAdapter !== false || listed.executesPackageCode !== false) {
    throw new Error("generator list must not load adapters or execute package code.");
  }
  const showPayload = JSON.parse(fs.readFileSync(path.join(runDir, "generator-show.json"), "utf8"));
  if (!showPayload.ok || showPayload.generator?.id !== packageName) {
    throw new Error("Expected generator show --json to describe the package-backed generator.");
  }
  if (showPayload.generator.loadsAdapter !== false || showPayload.generator.executesPackageCode !== false) {
    throw new Error("generator show must not load adapters or execute package code.");
  }
  if (showPayload.exampleTopologyBinding?.generator?.package !== packageName) {
    throw new Error("Expected generator show to include a package-backed topology binding example.");
  }
  const checkPayload = JSON.parse(fs.readFileSync(path.join(runDir, "generator-check.json"), "utf8"));
  if (!checkPayload.ok || checkPayload.packageName !== packageName) {
    throw new Error("Expected generator check --json to pass for the installed package.");
  }
  if (checkPayload.executesPackageCode !== true) {
    throw new Error("generator check must report that it executes package code.");
  }
  if (!checkPayload.checks.some((check) => check.name === "smoke-generate" && check.ok)) {
    throw new Error("Expected generator check to run a successful smoke generate.");
  }
  if (!checkPayload.smoke || checkPayload.smoke.files < 1) {
    throw new Error("Expected generator check smoke output to include generated files.");
  }
  const listText = fs.readFileSync(path.join(runDir, "generator-list.txt"), "utf8");
  if (!listText.includes(packageName) || !listText.includes("Adapter loaded: no") || !listText.includes("Executes package code: no")) {
    throw new Error("Expected human generator list to explain non-executing discovery.");
  }
  const showText = fs.readFileSync(path.join(runDir, "generator-show.txt"), "utf8");
  if (!showText.includes(`Generator: ${packageName}@1`) || !showText.includes("Example topology binding:")) {
    throw new Error("Expected human generator show to include generator and topology details.");
  }
  const checkText = fs.readFileSync(path.join(runDir, "generator-check.txt"), "utf8");
  if (!checkText.includes("Generator check passed") || !checkText.includes("Executes package code: yes (loads adapter and runs smoke generate)")) {
    throw new Error("Expected human generator check to explain package code execution.");
  }
  const policyStatus = JSON.parse(fs.readFileSync(path.join(runDir, "generator-policy-status.json"), "utf8"));
  if (!policyStatus.ok || policyStatus.summary?.packageBackedGenerators !== 1 || policyStatus.summary.allowed !== 1) {
    throw new Error("Expected generator policy status to report one allowed package-backed generator.");
  }
  const policyCheck = JSON.parse(fs.readFileSync(path.join(runDir, "generator-policy-check.json"), "utf8"));
  if (!policyCheck.ok || policyCheck.bindings?.length !== 1 || policyCheck.bindings[0]?.packageName !== packageName) {
    throw new Error("Expected generator policy check to pass for the installed package-backed generator.");
  }
  const npmPolicyStatus = fs.readFileSync(path.join(runDir, "generator-npm-policy-status.txt"), "utf8");
  if (!npmPolicyStatus.includes("Generator policy status: allowed") || !npmPolicyStatus.includes(packageName)) {
    throw new Error("Expected generated npm generator:policy:status script to report the package-backed generator.");
  }
  const npmPolicyCheck = fs.readFileSync(path.join(runDir, "generator-npm-policy-check.txt"), "utf8");
  if (!npmPolicyCheck.includes("Generator policy check passed") || !npmPolicyCheck.includes(packageName)) {
    throw new Error("Expected generated npm generator:policy:check script to pass for the package-backed generator.");
  }
  const generatedSentinel = path.join(projectRoot, "app", ".topogram-generated.json");
  if (!fs.existsSync(generatedSentinel)) {
    throw new Error("Expected package-backed generated app sentinel was not written.");
  }
  const generatedHtml = path.join(projectRoot, "app", "apps", "web", "app_web", "index.html");
  if (!fs.existsSync(generatedHtml)) {
    throw new Error(`Expected package-backed generator output at ${generatedHtml}.`);
  }
  const html = fs.readFileSync(generatedHtml, "utf8");
  if (!html.includes(`data-generator="${packageName}"`) || !html.includes("Topogram package generator smoke")) {
    throw new Error("Expected generated app to come from the package-backed generator.");
  }
  const generatedContext = path.join(projectRoot, "app", "apps", "web", "app_web", "topogram-generator-context.json");
  if (!fs.existsSync(generatedContext)) {
    throw new Error("Expected generated context artifact from the package-backed generator.");
  }
' "$RUN_DIR" "$GENERATOR_PROJECT_DIR" "$GENERATOR_PACKAGE_NAME"

echo "Packing a template pack..."
cp -R "$ENGINE_DIR/tests/fixtures/templates/web-api-db/." "$TEMPLATE_PACKAGE_DIR/"
(
  cd "$TEMPLATE_PACKAGE_DIR"
  node --input-type=module -e '
    import fs from "node:fs";
    const pkg = {
      name: "@topogram/template-smoke",
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
npm --prefix "$STARTER_DIR" run agent:brief
npm --prefix "$STARTER_DIR" run query:list
npm --prefix "$STARTER_DIR" run query:show -- widget-behavior
npm --prefix "$STARTER_DIR" run source:status
npm --prefix "$STARTER_DIR" run template:explain
npm --prefix "$STARTER_DIR" run template:detach:dry-run
npm --prefix "$STARTER_DIR" run template:detach
npm --prefix "$STARTER_DIR" run source:status
npm --prefix "$STARTER_DIR" run template:explain
npm --prefix "$STARTER_DIR" run generator:policy:status
npm --prefix "$STARTER_DIR" run generator:policy:check
npm --prefix "$STARTER_DIR" run check
npm --prefix "$STARTER_DIR" run generate
npm --prefix "$STARTER_TEMPLATE_DIR" run doctor
npm --prefix "$STARTER_TEMPLATE_DIR" run agent:brief
npm --prefix "$STARTER_TEMPLATE_DIR" run query:list
npm --prefix "$STARTER_TEMPLATE_DIR" run query:show -- widget-behavior
npm --prefix "$STARTER_TEMPLATE_DIR" run source:status
npm --prefix "$STARTER_TEMPLATE_DIR" run template:explain
npm --prefix "$STARTER_TEMPLATE_DIR" run template:detach:dry-run
npm --prefix "$STARTER_TEMPLATE_DIR" run generator:policy:status
npm --prefix "$STARTER_TEMPLATE_DIR" run generator:policy:check
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

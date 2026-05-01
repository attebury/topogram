#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_ROOT="$ROOT_DIR/.tmp/installed-cli-first-use"
NPM_CACHE_DIR="$ROOT_DIR/.tmp/npm-cache"
CLI_PACKAGE_SPEC="${TOPOGRAM_CLI_PACKAGE_SPEC:-@attebury/topogram@latest}"

mkdir -p "$WORK_ROOT" "$NPM_CACHE_DIR"
export npm_config_cache="$NPM_CACHE_DIR"

RUN_DIR="$(mktemp -d "$WORK_ROOT/run.XXXXXX")"
CONSUMER_DIR="$RUN_DIR/consumer"
mkdir -p "$CONSUMER_DIR"

echo "Installing published Topogram CLI ($CLI_PACKAGE_SPEC)..."
(
  cd "$CONSUMER_DIR"
  npm init -y >/dev/null
  npm config set @attebury:registry https://npm.pkg.github.com --location=project
  if [[ -n "${NODE_AUTH_TOKEN:-}" ]]; then
    npm config set //npm.pkg.github.com/:_authToken "$NODE_AUTH_TOKEN" --location=project
  fi
  npm install "$CLI_PACKAGE_SPEC" >/dev/null
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
if (payload.packageName !== "@attebury/topogram") {
  throw new Error(`Expected @attebury/topogram, got ${payload.packageName}`);
}
if (expected && payload.version !== expected) {
  throw new Error(`Expected Topogram CLI ${expected}, got ${payload.version}`);
}
if (!payload.executablePath || !payload.nodeVersion) {
  throw new Error("Expected executablePath and nodeVersion in topogram version output.");
}
console.log(`Using Topogram CLI ${payload.version} from ${payload.executablePath}`);
NODE

echo "Checking installed catalog-first command surface..."
(
  cd "$CONSUMER_DIR"
  "$TOPOGRAM_BIN" --help >/dev/null
  "$TOPOGRAM_BIN" template list
)

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

echo "Creating hello-web starter..."
(
  cd "$CONSUMER_DIR"
  "$TOPOGRAM_BIN" new ./hello-web --template hello-web
)

STARTER_DIR="$CONSUMER_DIR/hello-web"
if [[ ! -f "$STARTER_DIR/package.json" ]]; then
  echo "Expected generated starter package.json." >&2
  exit 1
fi

echo "Installing, checking, and generating the starter..."
npm --prefix "$STARTER_DIR" install >/dev/null
npm --prefix "$STARTER_DIR" run check
npm --prefix "$STARTER_DIR" run generate

if [[ ! -f "$STARTER_DIR/app/.topogram-generated.json" ]]; then
  echo "Expected generated app sentinel was not written." >&2
  exit 1
fi

echo
echo "Installed CLI first-use smoke passed: $CLI_PACKAGE_SPEC"

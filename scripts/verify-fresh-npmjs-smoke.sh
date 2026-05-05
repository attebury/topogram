#!/usr/bin/env bash
set -euo pipefail

CLI_PACKAGE_SPEC="${TOPOGRAM_CLI_PACKAGE_SPEC:-@topogram/cli@latest}"
TEMPLATE_ALIAS="${TOPOGRAM_FRESH_SMOKE_TEMPLATE:-hello-web}"
STARTER_NAME="${TOPOGRAM_FRESH_SMOKE_STARTER:-hello-web}"
TMP_PARENT="${TMPDIR:-/tmp}"
WORK_ROOT="${TOPOGRAM_FRESH_SMOKE_ROOT:-$(mktemp -d "${TMP_PARENT%/}/topogram-fresh-npmjs.XXXXXX")}"
NPM_CACHE_DIR="$WORK_ROOT/.npm-cache"
CONSUMER_DIR="$WORK_ROOT/consumer"

mkdir -p "$CONSUMER_DIR" "$NPM_CACHE_DIR"
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

echo "Creating starter from public catalog alias '$TEMPLATE_ALIAS'..."
(
  cd "$CONSUMER_DIR"
  "$TOPOGRAM_BIN" new "./$STARTER_NAME" --template "$TEMPLATE_ALIAS"
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

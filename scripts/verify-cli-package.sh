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
mkdir -p "$PACK_DIR" "$CONSUMER_DIR"

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

echo "Creating a starter with the packed CLI..."
(
  cd "$CONSUMER_DIR"
  TOPOGRAM_CLI_PACKAGE_SPEC="$PACKAGE_TARBALL" "$TOPOGRAM_BIN" new ./starter
)

STARTER_DIR="$CONSUMER_DIR/starter"
if [[ ! -f "$STARTER_DIR/package.json" ]]; then
  echo "Expected starter package.json was not created." >&2
  exit 1
fi

echo "Installing starter dependencies from the packed CLI tarball..."
npm --prefix "$STARTER_DIR" install >/dev/null

echo "Checking and generating the starter..."
npm --prefix "$STARTER_DIR" run check
npm --prefix "$STARTER_DIR" run generate

if [[ ! -f "$STARTER_DIR/app/.topogram-generated.json" ]]; then
  echo "Expected generated app sentinel was not written." >&2
  exit 1
fi

echo
echo "CLI package smoke passed: $PACKAGE_TARBALL"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/check-release-version.sh"

cd "$ROOT_DIR/engine"
npm ci
npm test
npm run validate

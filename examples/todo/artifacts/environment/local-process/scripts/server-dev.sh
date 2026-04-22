#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
. "$SCRIPT_DIR/load-env.sh"

export PORT="${SERVER_PORT:-3000}"

cd "$ROOT_DIR/server"
npm install
npm exec -- prisma generate --schema prisma/schema.prisma
npm run dev

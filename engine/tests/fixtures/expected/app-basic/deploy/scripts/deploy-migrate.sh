#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR/services/app_api"
npm install
npm exec -- prisma generate --schema prisma/schema.prisma
npm exec -- prisma db push --schema prisma/schema.prisma --skip-generate

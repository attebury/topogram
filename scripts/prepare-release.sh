#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE_DIR="$ROOT_DIR/engine"
VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: npm run release:prepare -- <version>" >&2
  exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]]; then
  echo "Invalid semver version: $VERSION" >&2
  exit 1
fi

npm --prefix "$ENGINE_DIR" version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null
"$ROOT_DIR/scripts/check-release-version.sh"

echo "Prepared @attebury/topogram@$VERSION"
echo
echo "Next:"
echo "  git add engine/package.json engine/package-lock.json"
echo "  git commit -m \"Prepare Topogram CLI $VERSION\""
echo "  git tag topogram-v$VERSION"
echo "  git push origin main topogram-v$VERSION"

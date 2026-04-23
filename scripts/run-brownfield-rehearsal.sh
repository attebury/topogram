#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_ROOT="$ROOT_DIR/engine/tests/fixtures/import/incomplete-topogram/topogram"
SCENARIO="projection-impact"
OUT_DIR=""
PRINT_ROOT_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenario)
      SCENARIO="${2:?missing scenario value}"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="${2:?missing out-dir value}"
      shift 2
      ;;
    --print-root)
      PRINT_ROOT_ONLY=1
      shift
      ;;
    *)
      echo "Usage: bash ./scripts/run-brownfield-rehearsal.sh [--scenario <base|projection-impact>] [--out-dir <path>] [--print-root]" >&2
      exit 1
      ;;
  esac
done

BUILD_ARGS=("$ROOT_DIR/engine/scripts/build-adoption-plan-fixture.mjs" "$FIXTURE_ROOT" "--scenario" "$SCENARIO" "--json")
if [[ -n "$OUT_DIR" ]]; then
  BUILD_ARGS+=("--out-dir" "$OUT_DIR")
fi

fixture_json="$(
  cd "$ROOT_DIR" &&
  node "${BUILD_ARGS[@]}"
)"

staged_topogram_root="$(
  printf '%s' "$fixture_json" |
  node --input-type=module -e "let data=''; process.stdin.on('data', (chunk) => data += chunk); process.stdin.on('end', () => process.stdout.write(JSON.parse(data).staged_topogram_root));"
)"

if [[ "$PRINT_ROOT_ONLY" -eq 1 ]]; then
  printf '%s\n' "$staged_topogram_root"
  exit 0
fi

echo "Brownfield rehearsal workspace:"
echo "$staged_topogram_root"
echo

run_query() {
  local label="$1"
  shift
  echo "### $label"
  (cd "$ROOT_DIR" && node ./engine/src/cli.js "$@")
  echo
}

run_query "import-plan" query import-plan "$staged_topogram_root"
run_query "review-packet" query review-packet "$staged_topogram_root" --mode import-adopt
run_query "proceed-decision" query proceed-decision "$staged_topogram_root" --mode import-adopt
run_query "next-action" query next-action "$staged_topogram_root" --mode import-adopt

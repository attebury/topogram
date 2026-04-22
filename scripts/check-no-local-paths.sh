#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

zero_sha="0000000000000000000000000000000000000000"

is_excluded_path() {
  case "$1" in
    examples/*/artifacts/*) return 0 ;;
    examples/*/apps/*) return 0 ;;
    examples/*/topogram/tests/fixtures/expected/*) return 0 ;;
    *) return 1 ;;
  esac
}

collect_files() {
  local base_ref="${1:-}"
  local head_ref="${2:-HEAD}"

  if [[ -z "$base_ref" || "$base_ref" == "$zero_sha" ]]; then
    if git rev-parse --verify origin/main >/dev/null 2>&1; then
      local merge_base
      merge_base="$(git merge-base origin/main "$head_ref")"
      git diff --diff-filter=ACMR --name-only "$merge_base" "$head_ref"
      return
    fi
    git ls-tree -r --name-only "$head_ref"
    return
  fi

  git diff --diff-filter=ACMR --name-only "$base_ref" "$head_ref"
}

main() {
  local base_ref="${1:-}"
  local head_ref="${2:-HEAD}"
  local -a files_to_check=()

  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    if is_excluded_path "$file"; then
      continue
    fi
    files_to_check+=("$file")
  done < <(collect_files "$base_ref" "$head_ref")

  if [[ "${#files_to_check[@]}" -eq 0 ]]; then
    exit 0
  fi

  local matches
  matches="$(rg -n --no-heading -e '/Users/[[:alnum:]_.-]+' -e 'file:///Users/[[:alnum:]_.-]+' -- "${files_to_check[@]}" || true)"

  if [[ -n "$matches" ]]; then
    echo "Refusing push because changed files contain machine-specific absolute paths." >&2
    echo >&2
    echo "$matches" >&2
    echo >&2
    echo "Allowed exceptions are limited to generated example outputs and expected fixtures under examples/." >&2
    echo "If this is an intentional generated-artifact change, normalize the path or expand the allowlist deliberately." >&2
    exit 1
  fi
}

main "$@"

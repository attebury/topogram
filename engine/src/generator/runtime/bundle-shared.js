export function mergeBundleFiles(files, prefix, bundle) {
  for (const [filePath, contents] of Object.entries(bundle || {})) {
    files[`${prefix}/${filePath}`] = contents;
  }
}

export function mergeNamedBundles(files, bundles) {
  for (const [prefix, bundle] of Object.entries(bundles || {})) {
    mergeBundleFiles(files, prefix, bundle);
  }
}

export function renderLoadEnvScript(options = {}) {
  const searchParentEnv = Boolean(options.searchParentEnv);
  const rootDir = options.rootDirExpression || 'ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"';
  const base = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    rootDir,
    'DEFAULT_ENV_FILE="$ROOT_DIR/.env"',
    'DEFAULT_ENV_EXAMPLE_FILE="$ROOT_DIR/.env.example"'
  ];
  if (searchParentEnv) {
    base.push(
      'FALLBACK_ENV_FILE="$(cd "$ROOT_DIR/.." && pwd)/.env"',
      'FALLBACK_ENV_EXAMPLE_FILE="$(cd "$ROOT_DIR/.." && pwd)/.env.example"'
    );
  }
  base.push('ENV_FILE="${TOPOGRAM_ENV_FILE:-$DEFAULT_ENV_FILE}"', "");
  if (searchParentEnv) {
    base.push(
      'if [[ ! -f "$ENV_FILE" && -z "${TOPOGRAM_ENV_FILE:-}" && -f "$FALLBACK_ENV_FILE" ]]; then',
      '  ENV_FILE="$FALLBACK_ENV_FILE"',
      "fi",
      ""
    );
  }
  base.push(
    'if [[ ! -f "$ENV_FILE" && -z "${TOPOGRAM_ENV_FILE:-}" && -f "$DEFAULT_ENV_EXAMPLE_FILE" ]]; then',
    '  ENV_FILE="$DEFAULT_ENV_EXAMPLE_FILE"',
    "fi",
    ""
  );
  if (searchParentEnv) {
    base.push(
      'if [[ ! -f "$ENV_FILE" && -z "${TOPOGRAM_ENV_FILE:-}" && -f "$FALLBACK_ENV_EXAMPLE_FILE" ]]; then',
      '  ENV_FILE="$FALLBACK_ENV_EXAMPLE_FILE"',
      "fi",
      ""
    );
  }
  base.push(
    'if [[ -f "$ENV_FILE" ]]; then',
    "  set -a",
    '  . "$ENV_FILE"',
    "  set +a",
    "fi",
    "",
    'if [[ -n "${DATABASE_URL:-}" ]]; then',
    '  if [[ "$DATABASE_URL" == file:* ]]; then',
    '    database_path="${DATABASE_URL#file:}"',
    '    if [[ "$database_path" != /* ]]; then',
    `      DATABASE_URL="file:$ROOT_DIR/$(printf '%s' "$database_path" | sed 's#^./##')"`,
    "      export DATABASE_URL",
    "    fi",
    '  elif [[ "$DATABASE_URL" != /* && "$DATABASE_URL" != postgresql:* ]]; then',
    `    DATABASE_URL="$ROOT_DIR/$(printf '%s' "$DATABASE_URL" | sed 's#^./##')"`,
    "    export DATABASE_URL",
    "  fi",
    "fi",
    ""
  );
  return base.join("\n");
}

export function renderEnvAwareShellScript(bodyLines, options = {}) {
  const lines = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"',
    '. "$SCRIPT_DIR/load-env.sh"',
    "",
    ...(bodyLines || [])
  ];
  return `${lines.join("\n")}\n`;
}

export function renderRootShellScript(bodyLines, options = {}) {
  const includeScriptDir = options.includeScriptDir !== false;
  const blankLineAfterRoot = options.blankLineAfterRoot !== false;
  const rootDir = options.rootDirExpression || (includeScriptDir
    ? 'ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"'
    : 'ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"');
  const lines = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    ""
  ];
  if (includeScriptDir) {
    lines.push('SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"');
  }
  lines.push(rootDir);
  if (blankLineAfterRoot) {
    lines.push("");
  }
  lines.push(...(bodyLines || []));
  return `${lines.join("\n")}\n`;
}

export function renderRootEnvFileShellScript(bodyLines, options = {}) {
  return renderRootShellScript([
    'ENV_FILE="${TOPOGRAM_ENV_FILE:-$ROOT_DIR/.env}"',
    "",
    'if [[ -f "$ENV_FILE" ]]; then',
    "  set -a",
    '  . "$ENV_FILE"',
    "  set +a",
    "fi",
    "",
    ...(bodyLines || [])
  ], options);
}

export function renderNestedBundleShellScript(bundleDir, scriptPath, options = {}) {
  return renderEnvAwareShellScript([`(cd "$ROOT_DIR/${bundleDir}" && bash ./${scriptPath})`], options);
}

export function renderNodeScriptRunner(scriptFileName, options = {}) {
  const searchParentEnv = Boolean(options.searchParentEnv);
  const lines = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"',
    'DEFAULT_ENV_FILE="$ROOT_DIR/.env"'
  ];
  if (searchParentEnv) {
    lines.push('FALLBACK_ENV_FILE="$(cd "$ROOT_DIR/.." && pwd)/.env"');
  }
  lines.push('ENV_FILE="${TOPOGRAM_ENV_FILE:-$DEFAULT_ENV_FILE}"', "");
  if (searchParentEnv) {
    lines.push(
      'if [[ ! -f "$ENV_FILE" && -z "${TOPOGRAM_ENV_FILE:-}" && -f "$FALLBACK_ENV_FILE" ]]; then',
      '  ENV_FILE="$FALLBACK_ENV_FILE"',
      "fi",
      ""
    );
  }
  lines.push(
    'if [[ -f "$ENV_FILE" ]]; then',
    "  set -a",
    '  . "$ENV_FILE"',
    "  set +a",
    "fi",
    "",
    `node "$SCRIPT_DIR/${scriptFileName}"`,
    ""
  );
  return lines.join("\n");
}

// @ts-check

const RENAMED_CLI_ARGS = new Map([
  ["--component", "--widget"]
]);
const RENAMED_GENERATE_TARGETS = new Map([
  ["ui-component-contract", "ui-widget-contract"],
  ["component-conformance-report", "widget-conformance-report"],
  ["component-behavior-report", "widget-behavior-report"],
  ["ui-web-contract", "ui-surface-contract"],
  ["ui-web-debug", "ui-surface-debug"]
]);

/**
 * @param {string[]} args
 * @param {number} index
 * @param {string} [fallback]
 * @returns {string}
 */
function commandPath(args, index, fallback = "./topo") {
  const value = args[index];
  return value && !value.startsWith("-") ? value : fallback;
}

/**
 * @param {string[]} args
 * @returns {string|null}
 */
export function cliMigrationError(args) {
  if (args[0] === "component") {
    return "Command 'topogram component' was renamed to 'topogram widget'.";
  }
  if (args[0] === "migrate") {
    return "Command 'topogram migrate workspace-folder' was removed. Use topo/ workspaces or configure topogram.project.json workspace to a non-legacy relative path.";
  }
  for (const [oldArg, newArg] of RENAMED_CLI_ARGS) {
    if (args.includes(oldArg)) {
      return `CLI flag '${oldArg}' was renamed to '${newArg}'.`;
    }
  }
  const removedGenerateIndex = args.indexOf("--generate");
  if (removedGenerateIndex >= 0) {
    const target = args[removedGenerateIndex + 1];
    const input = args[0] === "generate" ? commandPath(args, 1) : commandPath(args, 0);
    const replacement = target && !target.startsWith("-")
      ? `topogram emit ${target} ${input}`
      : "topogram emit <target> <path>";
    return `The artifact flag '--generate' was removed. Use '${replacement}' instead.`;
  }
  return null;
}

/**
 * @param {string|null|undefined} target
 * @returns {string|null}
 */
export function artifactTargetMigrationError(target) {
  if (!target || !RENAMED_GENERATE_TARGETS.has(target)) {
    return null;
  }
  return `Artifact target '${target}' was renamed to '${RENAMED_GENERATE_TARGETS.get(target)}'.`;
}

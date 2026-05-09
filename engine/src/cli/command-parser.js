// @ts-check

/**
 * @typedef {Record<string, any> & {
 *   inputPath: string|null
 * }} SplitCommandArgs
 */

/**
 * @param {string[]} args
 * @param {number} index
 * @param {string} [fallback]
 * @returns {string}
 */
function commandPath(args, index, fallback = "./topogram") {
  const value = args[index];
  return value && !value.startsWith("-") ? value : fallback;
}

/**
 * @param {string[]} args
 * @param {number} index
 * @param {string} [fallback]
 * @returns {string}
 */
function commandOperandFrom(args, index, fallback = ".") {
  const valueFlags = new Set([
    "--accept-current",
    "--accept-candidate",
    "--delete-current",
    "--from",
    "--out",
    "--out-dir",
    "--reason",
    "--template",
    "--version"
  ]);
  for (let i = index; i < args.length; i += 1) {
    const value = args[i];
    if (!value) {
      continue;
    }
    if (!value.startsWith("-")) {
      return value;
    }
    if (valueFlags.has(value)) {
      i += 1;
    }
  }
  return fallback;
}

const QUERY_NAMES = new Set([
  "task-mode",
  "diff",
  "slice",
  "adoption-plan",
  "maintained-boundary",
  "maintained-conformance",
  "maintained-drift",
  "seam-check",
  "domain-coverage",
  "domain-list",
  "review-boundary",
  "write-scope",
  "verification-targets",
  "widget-behavior",
  "change-plan",
  "import-plan",
  "risk-summary",
  "canonical-writes",
  "proceed-decision",
  "review-packet",
  "next-action",
  "single-agent-plan",
  "multi-agent-plan",
  "resolved-workflow-context",
  "workflow-preset-activation",
  "workflow-preset-diff",
  "workflow-preset-customization",
  "work-packet",
  "lane-status",
  "handoff-status",
  "auth-hints",
  "auth-review-packet"
]);

/**
 * Parses command families that have already been split out of the CLI shim.
 *
 * Keep this deliberately narrow until the remaining command families have their
 * own modules and focused tests.
 *
 * @param {string[]} args
 * @returns {SplitCommandArgs|null}
 */
export function parseSplitCommandArgs(args) {
  if (args[0] === "new" || args[0] === "create") {
    return args.includes("--list-templates")
      ? { templateCommand: "list", inputPath: null }
      : { newProject: true, inputPath: args[1] };
  }
  if (args[0] === "generate" && args[1] === "app") {
    return { generateTarget: "app-bundle", write: true, inputPath: commandPath(args, 2), defaultOutDir: "./app" };
  }
  if (args[0] === "generate" && args[1] === "journeys") {
    return { workflowName: "generate-journeys", inputPath: args[2] };
  }
  if (args[0] === "generate" && args[1] !== "journeys") {
    return { generateTarget: "app-bundle", write: true, inputPath: commandPath(args, 1), defaultOutDir: "./app" };
  }
  if (args[0] === "emit") {
    if (!args[1] || args[1].startsWith("-")) {
      return { emitHelp: true, inputPath: null };
    }
    return { generateTarget: args[1], inputPath: commandPath(args, 2), emitArtifact: true };
  }
  if (args[0] === "version" || args[0] === "--version") {
    return { version: true, inputPath: null };
  }
  if (args[0] === "query" && args[1] === "list") {
    return { queryList: true, inputPath: null };
  }
  if (args[0] === "query" && args[1] === "show") {
    return { queryShow: true, queryShowName: args[2] || null, inputPath: null };
  }
  if (args[0] === "query" && args[1] === "workflow-preset" && args[2] === "customize") {
    return { workflowPresetCommand: "customize", inputPath: commandPath(args, 3) };
  }
  if (args[0] === "workflow-preset" && args[1] === "customize") {
    return { workflowPresetCommand: "customize", inputPath: commandPath(args, 2) };
  }
  if (args[0] === "query" && QUERY_NAMES.has(args[1])) {
    return { queryName: args[1], inputPath: commandPath(args, 2) };
  }
  if (args[0] === "doctor") {
    return { doctor: true, inputPath: args[1] && !args[1].startsWith("-") ? args[1] : null };
  }
  if (args[0] === "check") {
    return { check: true, inputPath: commandPath(args, 1) };
  }
  if (args[0] === "validate") {
    return { validate: true, inputPath: args[1] };
  }
  if (args[0] === "agent" && args[1] === "brief") {
    return { agentBrief: true, inputPath: commandPath(args, 2) };
  }
  if (args[0] === "widget" && args[1] === "check") {
    return { widgetCheck: true, inputPath: commandPath(args, 2) };
  }
  if (args[0] === "widget" && args[1] === "behavior") {
    return { widgetBehavior: true, inputPath: commandPath(args, 2) };
  }
  if (args[0] === "generator" && args[1] === "list") {
    return { generatorCommand: "list", inputPath: null };
  }
  if (args[0] === "generator" && args[1] === "show") {
    return { generatorCommand: "show", inputPath: args[2] };
  }
  if (args[0] === "generator" && args[1] === "check") {
    return { generatorCommand: "check", inputPath: args[2] };
  }
  if (args[0] === "generator" && args[1] === "policy" && args[2] === "init") {
    return { generatorPolicyCommand: "init", inputPath: commandPath(args, 3) };
  }
  if (args[0] === "generator" && args[1] === "policy" && args[2] === "status") {
    return { generatorPolicyCommand: "status", inputPath: commandPath(args, 3) };
  }
  if (args[0] === "generator" && args[1] === "policy" && args[2] === "check") {
    return { generatorPolicyCommand: "check", inputPath: commandPath(args, 3) };
  }
  if (args[0] === "generator" && args[1] === "policy" && args[2] === "explain") {
    return { generatorPolicyCommand: "explain", inputPath: commandPath(args, 3) };
  }
  if (args[0] === "generator" && args[1] === "policy" && args[2] === "pin") {
    return {
      generatorPolicyCommand: "pin",
      generatorPolicyPinSpec: args[3] && !args[3].startsWith("-") ? args[3] : null,
      inputPath: commandPath(args, 4)
    };
  }
  if (args[0] === "template" && args[1] === "list") {
    return { templateCommand: "list", inputPath: null };
  }
  if (args[0] === "template" && args[1] === "show") {
    return { templateCommand: "show", inputPath: args[2] };
  }
  if (args[0] === "template" && args[1] === "explain") {
    return { templateCommand: "explain", inputPath: commandPath(args, 2, ".") };
  }
  if (args[0] === "template" && args[1] === "status") {
    return { templateCommand: "status", inputPath: commandPath(args, 2) };
  }
  if (args[0] === "template" && args[1] === "detach") {
    return { templateCommand: "detach", inputPath: commandPath(args, 2, ".") };
  }
  if (args[0] === "template" && args[1] === "policy" && args[2] === "init") {
    return { templateCommand: "policy:init", inputPath: commandPath(args, 3) };
  }
  if (args[0] === "template" && args[1] === "policy" && args[2] === "check") {
    return { templateCommand: "policy:check", inputPath: commandPath(args, 3) };
  }
  if (args[0] === "template" && args[1] === "policy" && args[2] === "explain") {
    return { templateCommand: "policy:explain", inputPath: commandPath(args, 3) };
  }
  if (args[0] === "template" && args[1] === "policy" && args[2] === "pin") {
    return {
      templateCommand: "policy:pin",
      templatePolicyPinSpec: args[3] && !args[3].startsWith("-") ? args[3] : null,
      inputPath: commandPath(args, 4)
    };
  }
  if (args[0] === "template" && args[1] === "check") {
    return { templateCommand: "check", inputPath: args[2] };
  }
  if (args[0] === "template" && args[1] === "update") {
    return { templateCommand: "update", inputPath: commandPath(args, 2) };
  }
  if (args[0] === "source" && args[1] === "status") {
    return { sourceCommand: "status", inputPath: commandPath(args, 2, ".") };
  }
  if (args[0] === "trust" && args[1] === "template") {
    return { trustCommand: "template", force: args.includes("--force"), inputPath: commandPath(args, 2) };
  }
  if (args[0] === "trust" && args[1] === "status") {
    return { trustCommand: "status", inputPath: commandPath(args, 2) };
  }
  if (args[0] === "trust" && args[1] === "diff") {
    return { trustCommand: "diff", inputPath: commandPath(args, 2) };
  }
  if (args[0] === "release" && args[1] === "status") {
    return { releaseStatus: true, inputPath: null };
  }
  if (args[0] === "release" && args[1] === "roll-consumers") {
    return { releaseRollConsumers: true, releaseRollVersion: args[2], inputPath: null };
  }
  if (args[0] === "catalog" && args[1] === "list") {
    return { catalogCommand: "list", inputPath: args[2] && !args[2].startsWith("-") ? args[2] : null };
  }
  if (args[0] === "catalog" && args[1] === "show") {
    return { catalogCommand: "show", inputPath: args[2] };
  }
  if (args[0] === "catalog" && args[1] === "doctor") {
    return { catalogCommand: "doctor", inputPath: args[2] && !args[2].startsWith("-") ? args[2] : null };
  }
  if (args[0] === "catalog" && args[1] === "check") {
    return { catalogCommand: "check", inputPath: args[2] };
  }
  if (args[0] === "catalog" && args[1] === "copy") {
    return { catalogCommand: "copy", catalogId: args[2], inputPath: args[3] };
  }
  if (args[0] === "package" && args[1] === "update-cli") {
    return { packageCommand: "update-cli", inputPath: args.includes("--latest") ? "latest" : args[2] };
  }
  if (args[0] === "import" && args[1] === "app") {
    return { workflowName: "import-app", inputPath: args[2] };
  }
  if (args[0] === "import" && args[1] === "docs") {
    return { workflowName: "scan-docs", inputPath: args[2] };
  }
  if (args[0] === "import" && args[1] === "diff") {
    return { importCommand: "diff", inputPath: commandOperandFrom(args, 2, ".") };
  }
  if (args[0] === "import" && args[1] === "refresh") {
    return { importCommand: "refresh", inputPath: commandOperandFrom(args, 2, ".") };
  }
  if (args[0] === "import" && args[1] === "check") {
    return { importCommand: "check", inputPath: commandPath(args, 2, ".") };
  }
  if (args[0] === "import" && args[1] === "plan") {
    return { importCommand: "plan", inputPath: commandPath(args, 2, ".") };
  }
  if (args[0] === "import" && args[1] === "adopt" && (args[2] === "--list" || args[2] === "list")) {
    return { importCommand: "adopt-list", inputPath: commandPath(args, 3, ".") };
  }
  if (args[0] === "import" && args[1] === "adopt") {
    return { importCommand: "adopt", importAdoptSelector: args[2], inputPath: commandPath(args, 3, ".") };
  }
  if (args[0] === "import" && args[1] === "status") {
    return { importCommand: "status", inputPath: commandPath(args, 2, ".") };
  }
  if (args[0] === "import" && args[1] === "history") {
    return { importCommand: "history", verify: args.includes("--verify"), inputPath: commandOperandFrom(args, 2, ".") };
  }
  if (args[0] === "import" && args[1] && !args[1].startsWith("-")) {
    return { importCommand: "workspace", inputPath: args[1] };
  }
  if (args[0] === "report" && args[1] === "gaps") {
    return { workflowName: "report-gaps", inputPath: args[2] };
  }
  if (args[0] === "reconcile" && args[1] === "adopt") {
    return { workflowName: "reconcile", inputPath: args[3], adoptValue: args[2] };
  }
  if (args[0] === "reconcile") {
    return { workflowName: "reconcile", inputPath: args[1] };
  }
  if (args[0] === "adoption" && args[1] === "status") {
    return { workflowName: "adoption-status", inputPath: args[2] };
  }
  if (args[0] === "sdlc" && args[1] === "transition") {
    return {
      sdlcCommand: "transition",
      inputPath: args[4] && !args[4].startsWith("-") ? args[4] : ".",
      sdlcId: args[2],
      sdlcTargetStatus: args[3]
    };
  }
  if (args[0] === "sdlc" && args[1] === "check") {
    return { sdlcCommand: "check", inputPath: commandPath(args, 2, ".") };
  }
  if (args[0] === "sdlc" && args[1] === "explain") {
    return {
      sdlcCommand: "explain",
      sdlcId: args[2],
      inputPath: args[3] && !args[3].startsWith("-") ? args[3] : "."
    };
  }
  if (args[0] === "sdlc" && args[1] === "archive") {
    return { sdlcCommand: "archive", inputPath: commandPath(args, 2, ".") };
  }
  if (args[0] === "sdlc" && args[1] === "unarchive") {
    return { sdlcCommand: "unarchive", sdlcId: args[2], inputPath: commandPath(args, 3, ".") };
  }
  if (args[0] === "sdlc" && args[1] === "compact") {
    return { sdlcCommand: "compact", sdlcArchiveFile: args[2], inputPath: "." };
  }
  if (args[0] === "sdlc" && args[1] === "new") {
    return { sdlcCommand: "new", sdlcNewKind: args[2], sdlcNewSlug: args[3], inputPath: commandPath(args, 4, ".") };
  }
  if (args[0] === "sdlc" && args[1] === "adopt") {
    return { sdlcCommand: "adopt", inputPath: commandPath(args, 2, ".") };
  }
  if (args[0] === "release") {
    return { sdlcCommand: "release", inputPath: commandPath(args, 1, ".") };
  }
  return null;
}

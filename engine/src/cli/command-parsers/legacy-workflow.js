// @ts-check

/**
 * @param {string[]} args
 * @returns {import("./shared.js").SplitCommandArgs|null}
 */
export function parseLegacyWorkflowCommandArgs(args) {
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
  return null;
}

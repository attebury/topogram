// @ts-check

import { buildAgentBrief, formatAgentBrief, normalizeAgentTopogramPath } from "../../agent-brief.js";
import { stableStringify } from "../../format.js";
import { parsePath } from "../../parser.js";
import { formatProjectConfigErrors } from "../../project-config.js";
import { formatValidationErrors } from "../../validator.js";

/**
 * @returns {void}
 */
export function printAgentHelp() {
  console.log("Usage: topogram agent brief [path] [--json]");
  console.log("");
  console.log("Prints read-only first-run guidance for humans and agents working in a Topogram project.");
  console.log("");
  console.log("Defaults: path is ./topo. The command validates the Topogram and project config, but does not write files, generate apps, load generator adapters, or execute template implementation.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram agent brief");
  console.log("  topogram agent brief --json");
  console.log("  topogram agent brief ./topo --json");
}

/**
 * @param {string} inputPath
 * @param {{ json?: boolean }} [options]
 * @returns {number}
 */
export function runAgentBriefCommand(inputPath, options = {}) {
  const ast = parsePath(normalizeAgentTopogramPath(inputPath));
  const result = buildAgentBrief(inputPath, ast);
  if (!result.ok) {
    if (result.kind === "project") {
      console.error(formatProjectConfigErrors(result.validation, result.configPath));
    } else {
      console.error(formatValidationErrors(result.validation));
    }
    return 1;
  }
  if (options.json) {
    console.log(stableStringify(result.payload));
  } else {
    process.stdout.write(formatAgentBrief(result.payload));
  }
  return 0;
}

// @ts-check

import { commandPath } from "./shared.js";

/**
 * @param {string[]} args
 * @returns {import("./shared.js").SplitCommandArgs|null}
 */
export function parseExtractorCommandArgs(args) {
  if (args[0] === "extractor" && args[1] === "list") {
    return { extractorCommand: "list", inputPath: null };
  }
  if (args[0] === "extractor" && args[1] === "show") {
    return { extractorCommand: "show", inputPath: args[2] };
  }
  if (args[0] === "extractor" && args[1] === "check") {
    return { extractorCommand: "check", inputPath: args[2] };
  }
  if (args[0] === "extractor" && args[1] === "policy" && args[2] === "init") {
    return { extractorPolicyCommand: "init", inputPath: commandPath(args, 3, ".") };
  }
  if (args[0] === "extractor" && args[1] === "policy" && args[2] === "status") {
    return { extractorPolicyCommand: "status", inputPath: commandPath(args, 3, ".") };
  }
  if (args[0] === "extractor" && args[1] === "policy" && args[2] === "check") {
    return { extractorPolicyCommand: "check", inputPath: commandPath(args, 3, ".") };
  }
  if (args[0] === "extractor" && args[1] === "policy" && args[2] === "explain") {
    return { extractorPolicyCommand: "explain", inputPath: commandPath(args, 3, ".") };
  }
  if (args[0] === "extractor" && args[1] === "policy" && args[2] === "pin") {
    return {
      extractorPolicyCommand: "pin",
      extractorPolicyPinSpec: args[3] && !args[3].startsWith("-") ? args[3] : null,
      inputPath: commandPath(args, 4, ".")
    };
  }
  return null;
}


// @ts-check

import { commandPath } from "./shared.js";

/**
 * @param {string[]} args
 * @returns {import("./shared.js").SplitCommandArgs|null}
 */
export function parseGeneratorCommandArgs(args) {
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
  return null;
}

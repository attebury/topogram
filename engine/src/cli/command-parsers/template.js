// @ts-check

import { commandPath } from "./shared.js";

/**
 * @param {string[]} args
 * @returns {import("./shared.js").SplitCommandArgs|null}
 */
export function parseTemplateCommandArgs(args) {
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
  return null;
}

// @ts-check

import { commandPath } from "./shared.js";

/**
 * @param {string[]} args
 * @returns {import("./shared.js").SplitCommandArgs|null}
 */
export function parseProjectCommandArgs(args) {
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
    return { releaseCommand: "status", inputPath: null };
  }
  if (args[0] === "release" && args[1] === "roll-consumers") {
    return { releaseCommand: "roll-consumers", releaseRollVersion: args[2], inputPath: null };
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
  if (args[0] === "package" && args[1] === "update-cli") {
    return { packageCommand: "update-cli", inputPath: args.includes("--latest") ? "latest" : args[2] };
  }
  return null;
}

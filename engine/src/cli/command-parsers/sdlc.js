// @ts-check

import { commandPath } from "./shared.js";

/**
 * @param {string[]} args
 * @returns {import("./shared.js").SplitCommandArgs|null}
 */
export function parseSdlcCommandArgs(args) {
  if (args[0] === "sdlc" && args[1] === "policy" && ["init", "check", "explain"].includes(args[2])) {
    return {
      sdlcCommand: `policy:${args[2]}`,
      inputPath: commandPath(args, 3, ".")
    };
  }
  if (args[0] === "sdlc" && args[1] === "gate") {
    return { sdlcCommand: "gate", inputPath: commandPath(args, 2, ".") };
  }
  if (args[0] === "sdlc" && args[1] === "link") {
    return {
      sdlcCommand: "link",
      sdlcFromId: args[2],
      sdlcToId: args[3],
      inputPath: commandPath(args, 4, ".")
    };
  }
  if (args[0] === "sdlc" && args[1] === "complete") {
    return {
      sdlcCommand: "complete",
      sdlcId: args[2],
      inputPath: commandPath(args, 3, ".")
    };
  }
  if (args[0] === "sdlc" && args[1] === "plan" && args[2] === "create") {
    return {
      sdlcCommand: "plan:create",
      sdlcId: args[3],
      sdlcSlug: args[4],
      inputPath: commandPath(args, 5, ".")
    };
  }
  if (args[0] === "sdlc" && args[1] === "plan" && args[2] === "explain") {
    return {
      sdlcCommand: "plan:explain",
      sdlcId: args[3],
      inputPath: commandPath(args, 4, ".")
    };
  }
  if (args[0] === "sdlc" && args[1] === "plan" && args[2] === "step" && args[3] === "transition") {
    return {
      sdlcCommand: "plan:step:transition",
      sdlcId: args[4],
      sdlcStepId: args[5],
      sdlcTargetStatus: args[6],
      inputPath: commandPath(args, 7, ".")
    };
  }
  if (args[0] === "sdlc" && args[1] === "plan" && args[2] === "step" && ["start", "complete", "skip"].includes(args[3])) {
    /** @type {Record<string, string>} */
    const statusByAction = {
      start: "in-progress",
      complete: "done",
      skip: "skipped"
    };
    return {
      sdlcCommand: `plan:step:${args[3]}`,
      sdlcId: args[4],
      sdlcStepId: args[5],
      sdlcTargetStatus: statusByAction[args[3]],
      inputPath: commandPath(args, 6, ".")
    };
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

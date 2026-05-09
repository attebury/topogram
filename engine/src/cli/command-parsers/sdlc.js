// @ts-check

import { commandPath } from "./shared.js";

/**
 * @param {string[]} args
 * @returns {import("./shared.js").SplitCommandArgs|null}
 */
export function parseSdlcCommandArgs(args) {
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

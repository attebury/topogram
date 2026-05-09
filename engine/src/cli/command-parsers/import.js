// @ts-check

import { commandOperandFrom, commandPath } from "./shared.js";

/**
 * @param {string[]} args
 * @returns {import("./shared.js").SplitCommandArgs|null}
 */
export function parseImportCommandArgs(args) {
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
  return null;
}

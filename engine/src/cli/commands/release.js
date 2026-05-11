// @ts-check

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../../format.js";
import {
  buildReleaseRollConsumersPayload,
  printReleaseRollProgress,
  printReleaseRollConsumers
} from "./release-rollout.js";
import {
  buildReleaseStatusPayload,
  printReleaseStatus,
  renderReleaseStatusMarkdown
} from "./release-status.js";

/**
 * @returns {void}
 */
export function printReleaseHelp() {
  console.log("Usage: topogram release status [--json] [--strict] [--markdown|--write-report <path>]");
  console.log("   or: topogram release roll-consumers <version|--latest> [--json] [--no-push] [--watch]");
  console.log("");
  console.log("Checks the local CLI version, latest published package version, release tag, first-party consumer pins, and strict consumer CI state.");
  console.log("Rolls first-party consumers to a published CLI version, runs their checks, commits, pushes, and can wait for current workflow runs.");
  console.log("Rollout progress prints to stderr in human mode; JSON output stays final-only. Omit --watch to push and verify later with release status --strict.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram release status");
  console.log("  topogram release status --json");
  console.log("  topogram release status --strict");
  console.log("  topogram release status --strict --write-report ./docs/release-matrix.md");
  console.log("  topogram release roll-consumers 0.3.46 --watch");
  console.log("  topogram release roll-consumers --latest --watch");
  console.log("");
  console.log("Release preparation and publishing are repo-level tasks in the Topogram source checkout:");
  console.log("  npm run release:prepare -- <version>");
  console.log("  npm run release:check");
  console.log("  GitHub Actions: Publish CLI Package");
}

export {
  buildReleaseRollConsumersPayload,
  printReleaseRollConsumers
};
export {
  buildReleaseStatusPayload,
  printReleaseStatus,
  renderReleaseStatusMarkdown
};

/**
 * @param {{ commandArgs: Record<string, any>, args: string[], json?: boolean }} context
 * @returns {number}
 */
export function runReleaseCommand(context) {
  const { commandArgs, args, json = false } = context;
  const command = commandArgs.releaseCommand;
  const reportIndex = args.indexOf("--write-report");
  const reportPath = reportIndex >= 0 &&
    args[reportIndex + 1] &&
    !args[reportIndex + 1].startsWith("-")
    ? args[reportIndex + 1]
    : null;
  if (command === "status") {
    if (args.includes("--write-report") && !reportPath) {
      console.error("Missing required --write-report <path>.");
      printReleaseHelp();
      return 1;
    }
    const payload = buildReleaseStatusPayload({ strict: args.includes("--strict") });
    if (reportPath) {
      const target = path.resolve(reportPath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, renderReleaseStatusMarkdown(payload), "utf8");
    }
    if (json) {
      console.log(stableStringify(payload));
    } else if (args.includes("--markdown")) {
      console.log(renderReleaseStatusMarkdown(payload).trimEnd());
    } else {
      printReleaseStatus(payload);
      if (reportPath) {
        console.log(`Report: ${path.resolve(reportPath)}`);
      }
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "roll-consumers") {
    const push = !args.includes("--no-push");
    const watch = args.includes("--watch");
    if (watch && !push) {
      console.error("Use either --watch or --no-push, not both.");
      printReleaseHelp();
      return 1;
    }
    const payload = buildReleaseRollConsumersPayload(commandArgs.releaseRollVersion, {
      push,
      watch,
      onProgress: json ? null : printReleaseRollProgress
    });
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printReleaseRollConsumers(payload);
    }
    return payload.ok ? 0 : 1;
  }

  throw new Error(`Unknown release command '${command}'`);
}

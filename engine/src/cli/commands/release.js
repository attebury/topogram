// @ts-check

/**
 * @returns {void}
 */
export function printReleaseHelp() {
  console.log("Usage: topogram release status [--json] [--strict] [--markdown|--write-report <path>]");
  console.log("   or: topogram release roll-consumers <version|--latest> [--json] [--no-push] [--watch]");
  console.log("");
  console.log("Checks the local CLI version, latest published package version, release tag, first-party consumer pins, and strict consumer CI state.");
  console.log("Rolls first-party consumers to a published CLI version, runs their checks, commits, pushes, and can wait for current workflow runs.");
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
} from "./release-rollout.js";
export {
  buildReleaseStatusPayload,
  printReleaseStatus,
  renderReleaseStatusMarkdown
} from "./release-status.js";

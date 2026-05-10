// @ts-check

import { PACKAGE_UPDATE_CLI_CHECK_SCRIPTS } from "./constants.js";

/**
 * @returns {void}
 */
export function printPackageHelp() {
  console.log("Usage: topogram package update-cli <version|--latest> [--json]");
  console.log("");
  console.log("Updates a consumer project to a Topogram CLI version and runs verification when dependencies are current.");
  console.log("");
  console.log("Behavior:");
  console.log("  - npmjs package inspection confirms the requested public CLI version.");
  console.log("  - npm install updates package.json and package-lock.json.");
  console.log("  - Available consumer verification scripts run after install.");
  console.log(`  - Recognized scripts: ${PACKAGE_UPDATE_CLI_CHECK_SCRIPTS.join(", ")}.`);
  console.log("  - Verification scripts are selected by strength: verify, then pack:check, then check.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram package update-cli 0.3.5");
  console.log("  topogram package update-cli --latest");
  console.log("  topogram package update-cli --latest --json");
  console.log("");
  console.log("Auth help:");
  console.log("  topogram setup package-auth");
}

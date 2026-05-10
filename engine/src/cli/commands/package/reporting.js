// @ts-check

/**
 * @param {import("./update-cli.js").PackageUpdateCliPayload} payload
 * @returns {void}
 */
export function printPackageUpdateCli(payload) {
  for (const diagnostic of payload.diagnostics) {
    if (diagnostic.severity === "warning") {
      console.warn(`Warning: ${diagnostic.message}`);
    }
  }
  console.log(`Updated ${payload.packageName} to ^${payload.requestedVersion}.`);
  if (payload.requestedLatest) {
    console.log(`Resolved latest version: ${payload.requestedVersion}`);
  }
  console.log(`Checked package: ${payload.packageName}@${payload.checkedVersion} via ${payload.packageCheckSource}`);
  console.log(`Updated dependency: ${payload.dependencySpec} via ${payload.dependencyUpdatedBy}`);
  if (payload.lockfileSanitized) {
    console.log("Lockfile: refreshed existing @topogram/cli entry from registry metadata");
  }
  if (payload.versionConventionUpdated) {
    console.log(`Version convention: updated ${payload.versionConventionPath}`);
  }
  console.log(`Checks run: ${payload.scriptsRun.join(", ") || "none"}`);
  if (payload.skippedScripts.length > 0) {
    console.log(`Checks skipped: ${payload.skippedScripts.join(", ")}`);
  }
  console.log("");
  console.log("Next steps:");
  console.log("  git diff package.json package-lock.json");
  console.log(`  git commit -am "Update Topogram CLI to ${payload.requestedVersion}"`);
  console.log("  git push");
  console.log("  confirm the repo verification workflow passes");
}

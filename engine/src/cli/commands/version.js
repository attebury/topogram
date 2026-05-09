// @ts-check

import fs from "node:fs";

const CLI_PACKAGE_NAME = "@topogram/cli";
const PACKAGE_JSON_URL = new URL("../../../package.json", import.meta.url);

/**
 * @returns {string}
 */
function readInstalledCliPackageVersion() {
  if (!fs.existsSync(PACKAGE_JSON_URL)) {
    return "0.0.0";
  }
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_URL, "utf8"));
  return typeof pkg.version === "string" ? pkg.version : "0.0.0";
}

/**
 * @param {{ executablePath?: string }} [options]
 * @returns {{ packageName: string, version: string, executablePath: string, nodeVersion: string }}
 */
export function buildVersionPayload(options = {}) {
  return {
    packageName: CLI_PACKAGE_NAME,
    version: readInstalledCliPackageVersion(),
    executablePath: options.executablePath || process.argv[1] || "",
    nodeVersion: process.version
  };
}

/**
 * @param {ReturnType<typeof buildVersionPayload>} payload
 * @returns {void}
 */
export function printVersion(payload) {
  console.log(`Topogram CLI: ${payload.packageName}@${payload.version}`);
  console.log(`Executable: ${payload.executablePath}`);
  console.log(`Node: ${payload.nodeVersion}`);
}

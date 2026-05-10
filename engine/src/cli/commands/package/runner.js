// @ts-check

import { stableStringify } from "../../../format.js";
import { printPackageHelp } from "./help.js";
import { printPackageUpdateCli } from "./reporting.js";
import { buildPackageUpdateCliPayload } from "./update-cli.js";

/**
 * @param {{
 *   commandArgs: Record<string, any>,
 *   inputPath: string|null|undefined,
 *   json: boolean
 * }} context
 * @returns {number}
 */
export function runPackageCommand(context) {
  const { commandArgs, inputPath, json } = context;
  if (commandArgs.packageCommand !== "update-cli") {
    throw new Error(`Unknown package command '${commandArgs.packageCommand}'`);
  }
  if (!inputPath) {
    console.error("Missing required <version>.");
    printPackageHelp();
    return 1;
  }
  const payload = buildPackageUpdateCliPayload(inputPath);
  if (json) {
    console.log(stableStringify(payload));
  } else {
    printPackageUpdateCli(payload);
  }
  return 0;
}

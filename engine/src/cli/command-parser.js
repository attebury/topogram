// @ts-check

/**
 * @typedef {{
 *   version?: boolean,
 *   queryList?: boolean,
 *   queryShow?: boolean,
 *   queryShowName?: string|null,
 *   inputPath: string|null
 * }} SplitCommandArgs
 */

/**
 * Parses command families that have already been split out of the CLI shim.
 *
 * Keep this deliberately narrow until the remaining command families have their
 * own modules and focused tests.
 *
 * @param {string[]} args
 * @returns {SplitCommandArgs|null}
 */
export function parseSplitCommandArgs(args) {
  if (args[0] === "version" || args[0] === "--version") {
    return { version: true, inputPath: null };
  }
  if (args[0] === "query" && args[1] === "list") {
    return { queryList: true, inputPath: null };
  }
  if (args[0] === "query" && args[1] === "show") {
    return { queryShow: true, queryShowName: args[2] || null, inputPath: null };
  }
  return null;
}

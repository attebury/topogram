// @ts-check

/**
 * @typedef {Record<string, any> & {
 *   inputPath: string|null
 * }} SplitCommandArgs
 */

/**
 * @param {string[]} args
 * @param {number} index
 * @param {string} [fallback]
 * @returns {string}
 */
function commandPath(args, index, fallback = "./topogram") {
  const value = args[index];
  return value && !value.startsWith("-") ? value : fallback;
}

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
  if (args[0] === "doctor") {
    return { doctor: true, inputPath: args[1] && !args[1].startsWith("-") ? args[1] : null };
  }
  if (args[0] === "source" && args[1] === "status") {
    return { sourceStatus: true, inputPath: commandPath(args, 2, ".") };
  }
  if (args[0] === "trust" && args[1] === "template") {
    return { trustTemplate: true, force: args.includes("--force"), inputPath: commandPath(args, 2) };
  }
  if (args[0] === "trust" && args[1] === "status") {
    return { trustStatus: true, inputPath: commandPath(args, 2) };
  }
  if (args[0] === "trust" && args[1] === "diff") {
    return { trustDiff: true, inputPath: commandPath(args, 2) };
  }
  if (args[0] === "release" && args[1] === "status") {
    return { releaseStatus: true, inputPath: null };
  }
  if (args[0] === "release" && args[1] === "roll-consumers") {
    return { releaseRollConsumers: true, releaseRollVersion: args[2], inputPath: null };
  }
  return null;
}

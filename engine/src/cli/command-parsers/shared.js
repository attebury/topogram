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
export function commandPath(args, index, fallback = "./topogram") {
  const value = args[index];
  return value && !value.startsWith("-") ? value : fallback;
}

/**
 * @param {string[]} args
 * @param {number} index
 * @param {string} [fallback]
 * @returns {string}
 */
export function commandOperandFrom(args, index, fallback = ".") {
  const valueFlags = new Set([
    "--accept-current",
    "--accept-candidate",
    "--delete-current",
    "--from",
    "--out",
    "--out-dir",
    "--reason",
    "--template",
    "--version"
  ]);
  for (let i = index; i < args.length; i += 1) {
    const value = args[i];
    if (!value) {
      continue;
    }
    if (!value.startsWith("-")) {
      return value;
    }
    if (valueFlags.has(value)) {
      i += 1;
    }
  }
  return fallback;
}

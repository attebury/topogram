// @ts-check

import { stableStringify } from "../../../../format.js";

/**
 * @param {any} payload
 * @returns {0}
 */
export function printJson(payload) {
  console.log(stableStringify(payload));
  return 0;
}

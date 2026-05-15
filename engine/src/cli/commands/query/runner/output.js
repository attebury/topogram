// @ts-check

import { stablePublicStringify } from "../../../../public-paths.js";

/**
 * @param {any} payload
 * @returns {0}
 */
export function printJson(payload) {
  console.log(stablePublicStringify(payload, { projectRoot: process.cwd(), cwd: process.cwd() }));
  return 0;
}

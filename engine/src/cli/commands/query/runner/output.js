// @ts-check

import { sanitizePublicPayload, stablePublicStringify } from "../../../../public-paths.js";
import { formatContextSliceMarkdown } from "./markdown.js";

/**
 * @param {any} payload
 * @returns {0}
 */
export function printJson(payload) {
  console.log(stablePublicStringify(payload, { projectRoot: process.cwd(), cwd: process.cwd() }));
  return 0;
}

/**
 * @param {Record<string, any>} payload
 * @returns {0}
 */
export function printContextSliceMarkdown(payload) {
  const publicPayload = sanitizePublicPayload(payload, { projectRoot: process.cwd(), cwd: process.cwd() });
  process.stdout.write(formatContextSliceMarkdown(publicPayload));
  return 0;
}

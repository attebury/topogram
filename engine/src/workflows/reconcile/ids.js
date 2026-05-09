// @ts-check

/** @param {string} id @returns {any} */
export function dashedTopogramId(id) {
  return String(id || "").replaceAll("_", "-");
}

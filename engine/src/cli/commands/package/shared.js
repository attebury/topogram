// @ts-check

/**
 * @param {unknown} error
 * @returns {string}
 */
export function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}

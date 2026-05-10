// @ts-check

/**
 * @param {unknown} error
 * @returns {string}
 */
export function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {string} value
 * @returns {string}
 */
export function shellCommandArg(value) {
  return /^[A-Za-z0-9_./:@=-]+$/.test(value) ? value : JSON.stringify(value);
}

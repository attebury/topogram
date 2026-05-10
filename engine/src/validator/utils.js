// @ts-check

/**
 * @param {ValidationErrors} errors
 * @param {string} message
 * @param {TopogramLocation | null | undefined} [loc]
 * @returns {void}
 */
export function pushError(errors, message, loc) {
  errors.push({
    message,
    loc
  });
}

/**
 * @param {TopogramLocation | null | undefined} loc
 * @returns {string}
 */
export function formatLoc(loc) {
  const line = loc?.start?.line ?? 1;
  const column = loc?.start?.column ?? 1;
  const file = loc?.file ?? "<unknown>";
  return `${file}:${line}:${column}`;
}

/**
 * @param {TopogramToken | null | undefined} value
 * @returns {TopogramToken[]}
 */
export function valueAsArray(value) {
  if (!value) {
    return [];
  }
  if (value.type === "list") {
    return value.items;
  }
  if (value.type === "sequence") {
    return value.items;
  }
  return [value];
}

/**
 * @param {TopogramToken | null | undefined} value
 * @returns {string[]}
 */
export function symbolValues(value) {
  return valueAsArray(value).filter((item) => item.type === "symbol").map((item) => item.value);
}

/**
 * @param {TopogramStatement} statement
 * @returns {TopogramFieldMap}
 */
export function collectFieldMap(statement) {
  const map = new Map();
  for (const field of statement.fields) {
    if (!map.has(field.key)) {
      map.set(field.key, []);
    }
    map.get(field.key).push(field);
  }
  return map;
}

/**
 * @param {TopogramStatement} statement
 * @param {string} key
 * @returns {TopogramField | null}
 */
export function getField(statement, key) {
  return collectFieldMap(statement).get(key)?.[0] || null;
}

/**
 * @param {TopogramStatement} statement
 * @param {string} key
 * @returns {TopogramToken | null}
 */
export function getFieldValue(statement, key) {
  return getField(statement, key)?.value || null;
}

/**
 * @param {TopogramToken | null | undefined} value
 * @returns {string | null}
 */
export function stringValue(value) {
  return value?.type === "string" ? value.value : null;
}

/**
 * @param {TopogramToken | null | undefined} value
 * @returns {string | null}
 */
export function symbolValue(value) {
  return value?.type === "symbol" ? value.value : null;
}

/**
 * @param {TopogramToken | null | undefined} value
 * @returns {TopogramBlockEntry[]}
 */
export function blockEntries(value) {
  return value?.type === "block" ? value.entries : [];
}

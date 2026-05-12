// @ts-check

/**
 * @typedef {{
 *   key: string,
 *   value: import("./parser.js").AstValue | null,
 *   values: import("./parser.js").AstValue[],
 *   loc: import("./parser.js").AstLocation
 * }} TopogramRecordField
 *
 * @typedef {{
 *   fields: Map<string, TopogramRecordField[]>,
 *   fieldOrder: TopogramRecordField[],
 *   loc: import("./parser.js").AstLocation
 * }} TopogramRecordBlock
 */

/**
 * @param {import("./parser.js").AstValue[]} values
 * @param {import("./parser.js").AstLocation} loc
 * @returns {import("./parser.js").AstValue | null}
 */
function valuesToRecordValue(values, loc) {
  if (values.length === 0) {
    return null;
  }
  if (values.length === 1) {
    return values[0];
  }
  return {
    type: "sequence",
    items: values,
    loc
  };
}

/**
 * @param {import("./parser.js").AstBlock} block
 * @returns {TopogramRecordBlock}
 */
export function parseRecordBlock(block) {
  /** @type {Map<string, TopogramRecordField[]>} */
  const fields = new Map();
  /** @type {TopogramRecordField[]} */
  const fieldOrder = [];

  for (const entry of block.entries || []) {
    const [keyToken, ...values] = entry.items || [];
    const key = keyToken?.type === "symbol" ? keyToken.value : "";
    const field = {
      key,
      value: valuesToRecordValue(values, entry.loc),
      values,
      loc: entry.loc
    };
    if (!fields.has(key)) {
      fields.set(key, []);
    }
    fields.get(key)?.push(field);
    fieldOrder.push(field);
  }

  return {
    fields,
    fieldOrder,
    loc: block.loc
  };
}

/**
 * @param {TopogramRecordBlock} record
 * @param {string} key
 * @returns {TopogramRecordField | null}
 */
export function recordField(record, key) {
  return record.fields.get(key)?.[0] || null;
}

/**
 * @param {TopogramRecordBlock} record
 * @param {string} key
 * @returns {string | null}
 */
export function recordSymbol(record, key) {
  const value = recordField(record, key)?.value;
  return value?.type === "symbol" ? value.value : null;
}

/**
 * @param {TopogramRecordBlock} record
 * @param {string} key
 * @returns {string | null}
 */
export function recordString(record, key) {
  const value = recordField(record, key)?.value;
  return value?.type === "string" ? value.value : null;
}

/**
 * @param {TopogramRecordBlock} record
 * @param {string} key
 * @returns {string[]}
 */
export function recordStringList(record, key) {
  const value = recordField(record, key)?.value;
  if (!value) return [];
  const items = value.type === "list" ? value.items : value.type === "sequence" ? value.items : [value];
  return items
    .map((item) => item.type === "string" ? item.value : null)
    .filter(/** @param {string | null} value */ (value) => value !== null);
}

/**
 * @param {TopogramRecordBlock} record
 * @param {string} key
 * @returns {string[]}
 */
export function recordSymbolList(record, key) {
  const value = recordField(record, key)?.value;
  if (!value) return [];
  const items = value.type === "list" ? value.items : value.type === "sequence" ? value.items : [value];
  return items
    .map((item) => item.type === "symbol" ? item.value : null)
    .filter(/** @param {string | null} value */ (value) => value !== null);
}

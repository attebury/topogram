// @ts-check

import {
  blockEntries,
  getFieldValue,
  symbolValues
} from "./utils.js";

/**
 * @param {TopogramStatement} statement
 * @returns {string[]}
 */
export function statementFieldNames(statement) {
  return blockEntries(getFieldValue(statement, "fields"))
    .map((entry) => entry.items[0])
    .filter((item) => item?.type === "symbol")
    .map((item) => item.value);
}

/**
 * @param {TopogramStatement} statement
 * @param {TopogramRegistry} registry
 * @returns {string[]}
 */
export function resolveShapeBaseFieldNames(statement, registry) {
  const explicitFieldNames = statementFieldNames(statement);
  if (explicitFieldNames.length > 0) {
    return explicitFieldNames;
  }

  if (!statement.from) {
    return [];
  }

  const source = registry.get(statement.from.value);
  if (!source || source.kind !== "entity") {
    return [];
  }

  const sourceFieldNames = statementFieldNames(source);
  const includeNames = symbolValues(getFieldValue(statement, "include"));
  const excludeNames = new Set(symbolValues(getFieldValue(statement, "exclude")));
  const selectedNames = includeNames.length > 0 ? includeNames.filter((name) => sourceFieldNames.includes(name)) : sourceFieldNames;

  return selectedNames.filter((fieldName) => !excludeNames.has(fieldName));
}

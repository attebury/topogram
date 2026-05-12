// @ts-check

import {
  parseRecordBlock,
  recordString,
  recordStringList,
  recordSymbol,
  recordSymbolList
} from "../record-blocks.js";

/**
 * @param {import("../parser.js").AstStatement} statement
 * @param {string} key
 * @returns {import("../parser.js").AstField[]}
 */
function fieldsByKey(statement, key) {
  return statement.fields.filter((field) => field.key === key);
}

/**
 * @param {import("../parser.js").AstField} field
 * @returns {any}
 */
function parseStepField(field) {
  if (field.value.type !== "block") {
    return null;
  }
  const record = parseRecordBlock(field.value);
  return {
    id: recordSymbol(record, "id"),
    intent: recordString(record, "intent"),
    commands: recordStringList(record, "commands"),
    expects: recordStringList(record, "expects"),
    after: recordSymbolList(record, "after"),
    notes: recordString(record, "notes"),
    loc: field.loc
  };
}

/**
 * @param {import("../parser.js").AstField} field
 * @returns {any}
 */
function parseAlternateField(field) {
  if (field.value.type !== "block") {
    return null;
  }
  const record = parseRecordBlock(field.value);
  return {
    id: recordSymbol(record, "id"),
    from: recordSymbol(record, "from"),
    condition: recordString(record, "condition"),
    commands: recordStringList(record, "commands"),
    expects: recordStringList(record, "expects"),
    notes: recordString(record, "notes"),
    loc: field.loc
  };
}

/**
 * @param {import("../parser.js").AstStatement} statement
 * @returns {any[]}
 */
export function parseJourneySteps(statement) {
  return fieldsByKey(statement, "step").map(parseStepField).filter(Boolean);
}

/**
 * @param {import("../parser.js").AstStatement} statement
 * @returns {any[]}
 */
export function parseJourneyAlternates(statement) {
  return fieldsByKey(statement, "alternate").map(parseAlternateField).filter(Boolean);
}

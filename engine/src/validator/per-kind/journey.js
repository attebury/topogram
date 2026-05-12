// @ts-check

import {
  JOURNEY_IDENTIFIER_PATTERN
} from "../kinds.js";
import {
  pushError
} from "../utils.js";
import {
  parseRecordBlock,
  recordField,
  recordString,
  recordStringList,
  recordSymbol,
  recordSymbolList
} from "../../record-blocks.js";

const STEP_FIELDS = new Set(["id", "intent", "commands", "expects", "after", "notes"]);
const ALTERNATE_FIELDS = new Set(["id", "from", "condition", "commands", "expects", "notes"]);

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @returns {void}
 */
function validateJourneyIdentifier(errors, statement) {
  if (!JOURNEY_IDENTIFIER_PATTERN.test(statement.id)) {
    pushError(
      errors,
      `Journey identifier '${statement.id}' must match ${JOURNEY_IDENTIFIER_PATTERN.source}`,
      statement.loc
    );
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramField} field
 * @param {Set<string>} allowedFields
 * @param {string[]} requiredFields
 * @returns {import("../../record-blocks.js").TopogramRecordBlock | null}
 */
function validateRecordBlock(errors, statement, field, allowedFields, requiredFields) {
  if (field.value.type !== "block") {
    pushError(errors, `Field '${field.key}' on journey ${statement.id} must be a block`, field.loc);
    return null;
  }

  const record = parseRecordBlock(/** @type {import("../../parser.js").AstBlock} */ (/** @type {unknown} */ (field.value)));
  for (const recordFieldEntry of record.fieldOrder) {
    if (!recordFieldEntry.key) {
      pushError(errors, `Each '${field.key}' record entry on journey ${statement.id} must start with a field name`, recordFieldEntry.loc);
      continue;
    }
    if (!allowedFields.has(recordFieldEntry.key)) {
      pushError(errors, `Unsupported '${field.key}' field '${recordFieldEntry.key}' on journey ${statement.id}`, recordFieldEntry.loc);
    }
    const entries = record.fields.get(recordFieldEntry.key) || [];
    if (entries.length > 1 && entries[1] === recordFieldEntry) {
      pushError(errors, `Duplicate '${field.key}' field '${recordFieldEntry.key}' on journey ${statement.id}`, recordFieldEntry.loc);
    }
  }

  for (const required of requiredFields) {
    if (!record.fields.has(required)) {
      pushError(errors, `Journey ${statement.id} ${field.key} record requires '${required}'`, field.loc);
    }
  }

  return record;
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {import("../../record-blocks.js").TopogramRecordBlock} record
 * @param {string} fieldName
 * @param {"symbol" | "string" | "symbol_list" | "string_list"} expected
 * @returns {void}
 */
function validateRecordFieldShape(errors, statement, record, fieldName, expected) {
  const field = recordField(record, fieldName);
  if (!field || !field.value) return;
  if (expected === "symbol" && field.value.type !== "symbol") {
    pushError(errors, `Journey ${statement.id} record field '${fieldName}' must be a symbol`, field.loc);
  }
  if (expected === "string" && field.value.type !== "string") {
    pushError(errors, `Journey ${statement.id} record field '${fieldName}' must be a string`, field.loc);
  }
  if (expected === "symbol_list" && field.value.type !== "list") {
    pushError(errors, `Journey ${statement.id} record field '${fieldName}' must be a list of symbols`, field.loc);
  }
  if (expected === "string_list" && field.value.type !== "list") {
    pushError(errors, `Journey ${statement.id} record field '${fieldName}' must be a list of strings`, field.loc);
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {Set<string>}
 */
function validateStepRecords(errors, statement, fieldMap) {
  const fields = fieldMap.get("step") || [];
  /** @type {Set<string>} */
  const stepIds = new Set();
  if (fields.length === 0) {
    pushError(errors, `Journey ${statement.id} must include at least one step`, statement.loc);
    return stepIds;
  }

  for (const field of fields) {
    const record = validateRecordBlock(errors, statement, field, STEP_FIELDS, ["id", "intent"]);
    if (!record) continue;
    validateRecordFieldShape(errors, statement, record, "id", "symbol");
    validateRecordFieldShape(errors, statement, record, "intent", "string");
    validateRecordFieldShape(errors, statement, record, "commands", "string_list");
    validateRecordFieldShape(errors, statement, record, "expects", "string_list");
    validateRecordFieldShape(errors, statement, record, "after", "symbol_list");
    validateRecordFieldShape(errors, statement, record, "notes", "string");

    const stepId = recordSymbol(record, "id");
    if (!stepId) continue;
    if (!/^[a-z][a-z0-9_]*$/.test(stepId)) {
      pushError(errors, `Journey ${statement.id} step id must match /^[a-z][a-z0-9_]*$/`, recordField(record, "id")?.loc || field.loc);
    }
    if (stepIds.has(stepId)) {
      pushError(errors, `Journey ${statement.id} has duplicate step '${stepId}'`, recordField(record, "id")?.loc || field.loc);
    }
    stepIds.add(stepId);
  }

  for (const field of fields) {
    if (field.value.type !== "block") continue;
    const record = parseRecordBlock(/** @type {import("../../parser.js").AstBlock} */ (/** @type {unknown} */ (field.value)));
    const stepId = recordSymbol(record, "id") || "unknown";
    for (const afterId of recordSymbolList(record, "after")) {
      if (!stepIds.has(afterId)) {
        pushError(errors, `Journey ${statement.id} step '${stepId}' after references missing step '${afterId}'`, recordField(record, "after")?.loc || field.loc);
      }
    }
  }

  return stepIds;
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {Set<string>} stepIds
 * @returns {void}
 */
function validateAlternateRecords(errors, statement, fieldMap, stepIds) {
  const fields = fieldMap.get("alternate") || [];
  /** @type {Set<string>} */
  const alternateIds = new Set();
  for (const field of fields) {
    const record = validateRecordBlock(errors, statement, field, ALTERNATE_FIELDS, ["id", "from", "condition"]);
    if (!record) continue;
    validateRecordFieldShape(errors, statement, record, "id", "symbol");
    validateRecordFieldShape(errors, statement, record, "from", "symbol");
    validateRecordFieldShape(errors, statement, record, "condition", "string");
    validateRecordFieldShape(errors, statement, record, "commands", "string_list");
    validateRecordFieldShape(errors, statement, record, "expects", "string_list");
    validateRecordFieldShape(errors, statement, record, "notes", "string");

    const alternateId = recordSymbol(record, "id");
    if (alternateId) {
      if (!/^[a-z][a-z0-9_]*$/.test(alternateId)) {
        pushError(errors, `Journey ${statement.id} alternate id must match /^[a-z][a-z0-9_]*$/`, recordField(record, "id")?.loc || field.loc);
      }
      if (alternateIds.has(alternateId)) {
        pushError(errors, `Journey ${statement.id} has duplicate alternate '${alternateId}'`, recordField(record, "id")?.loc || field.loc);
      }
      alternateIds.add(alternateId);
    }

    const fromStep = recordSymbol(record, "from");
    if (fromStep && !stepIds.has(fromStep)) {
      pushError(errors, `Journey ${statement.id} alternate '${alternateId || "unknown"}' from references missing step '${fromStep}'`, recordField(record, "from")?.loc || field.loc);
    }
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {void}
 */
function validateTopLevelListShapes(errors, statement, fieldMap) {
  const stringListFields = ["success_signals", "failure_signals", "tags"];
  for (const key of stringListFields) {
    const field = fieldMap.get(key)?.[0];
    if (!field || field.value.type !== "list") continue;
    for (const item of field.value.items) {
      if (item.type !== "string" && key !== "tags") {
        pushError(errors, `Journey ${statement.id} field '${key}' must contain strings`, item.loc);
      }
      if (key === "tags" && item.type !== "symbol" && item.type !== "string") {
        pushError(errors, `Journey ${statement.id} field '${key}' must contain symbols or strings`, item.loc);
      }
    }
  }
}

/**
 * Keep referenced imports used by checkJs while making the expected record
 * helper vocabulary obvious to future validators.
 */
void recordString;
void recordStringList;

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
export function validateJourney(errors, statement, fieldMap, registry) {
  void registry;
  if (statement.kind !== "journey") {
    return;
  }
  validateJourneyIdentifier(errors, statement);
  validateTopLevelListShapes(errors, statement, fieldMap);
  const stepIds = validateStepRecords(errors, statement, fieldMap);
  validateAlternateRecords(errors, statement, fieldMap, stepIds);
}

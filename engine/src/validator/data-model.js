// @ts-check

import {
  blockEntries,
  blockSymbolItems,
  getFieldValue,
  pushError,
  valueAsArray
} from "./utils.js";
import {
  resolveShapeBaseFieldNames,
  statementFieldNames
} from "./model-helpers.js";

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
export function validateShapeFrom(errors, statement, registry) {
  if (statement.kind !== "shape" || !statement.from) {
    return;
  }

  const target = registry.get(statement.from.value);
  if (!target) {
    pushError(errors, `Shape ${statement.id} derives from missing statement '${statement.from.value}'`, statement.from.loc);
    return;
  }

  if (target.kind !== "entity") {
    pushError(errors, `Shape ${statement.id} can only derive from an entity, found ${target.kind} '${target.id}'`, statement.from.loc);
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
function validateEntityRelations(errors, statement, fieldMap, registry) {
  if (statement.kind !== "entity") {
    return;
  }

  const field = fieldMap.get("relations")?.[0];
  if (!field || field.value.type !== "block") {
    return;
  }

  for (const entry of field.value.entries) {
    const [left, operator, target] = entry.items;
    if (!left || !operator || !target) {
      continue;
    }

    if (left.type !== "symbol" || operator.type !== "symbol" || target.type !== "symbol") {
      pushError(errors, `Relation entries on entity ${statement.id} must use symbols`, entry.loc);
      continue;
    }

    if (operator.value !== "references") {
      pushError(errors, `Relation entries on entity ${statement.id} must use 'references'`, operator.loc);
    }

    const [entityId] = target.value.split(".");
    const related = registry.get(entityId);
    if (!related) {
      pushError(errors, `Relation on entity ${statement.id} references missing entity '${entityId}'`, target.loc);
      continue;
    }

    if (related.kind !== "entity") {
      pushError(errors, `Relation on entity ${statement.id} must target an entity, found ${related.kind} '${related.id}'`, target.loc);
    }
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
function validateShapeTransforms(errors, statement, fieldMap, registry) {
  if (statement.kind !== "shape") {
    return;
  }

  const baseFieldNames = resolveShapeBaseFieldNames(statement, registry);
  const baseFieldSet = new Set(baseFieldNames);
  const source = statement.from ? registry.get(statement.from.value) : null;
  const sourceFieldSet = new Set(source ? statementFieldNames(source) : []);
  const includeField = fieldMap.get("include")?.[0];
  const excludeField = fieldMap.get("exclude")?.[0];

  /** @type {Array<[string, TopogramField | undefined]>} */
  const inheritedFieldLists = [
    ["include", includeField],
    ["exclude", excludeField]
  ];

  for (const [fieldKey, field] of inheritedFieldLists) {
    if (!field) {
      continue;
    }

    for (const item of valueAsArray(field.value)) {
      if (item.type !== "symbol") {
        continue;
      }

      if (statement.from && !sourceFieldSet.has(item.value) && fieldKey === "include") {
        pushError(errors, `Shape ${statement.id} includes unknown field '${item.value}' from ${statement.from.value}`, item.loc);
      }

      if (statement.from && fieldKey === "exclude") {
        if (!sourceFieldSet.has(item.value)) {
          pushError(errors, `Shape ${statement.id} excludes unknown field '${item.value}' from ${statement.from.value}`, item.loc);
        }
      }
    }
  }

  const renameEntries = blockEntries(getFieldValue(statement, "rename"));
  const renameFrom = new Map();
  const renameTo = new Map();

  for (const entry of renameEntries) {
    const items = blockSymbolItems(entry);
    if (items.length !== 2) {
      pushError(errors, `Each 'rename' entry on shape ${statement.id} must be exactly '<from> <to>'`, entry.loc);
      continue;
    }

    const [fromItem, toItem] = items;
    if (!baseFieldSet.has(fromItem.value)) {
      pushError(errors, `Shape ${statement.id} renames unknown field '${fromItem.value}'`, fromItem.loc);
    }

    if (renameFrom.has(fromItem.value)) {
      pushError(errors, `Shape ${statement.id} renames field '${fromItem.value}' more than once`, fromItem.loc);
    } else {
      renameFrom.set(fromItem.value, toItem.value);
    }

    if (renameTo.has(toItem.value)) {
      pushError(errors, `Shape ${statement.id} renames multiple fields to '${toItem.value}'`, toItem.loc);
    } else {
      renameTo.set(toItem.value, fromItem.value);
    }
  }

  const finalFieldNames = baseFieldNames.map((fieldName) => renameFrom.get(fieldName) || fieldName);
  const finalFieldSet = new Set();
  for (const fieldName of finalFieldNames) {
    if (finalFieldSet.has(fieldName)) {
      pushError(errors, `Shape ${statement.id} produces duplicate projected field '${fieldName}'`, statement.loc);
      continue;
    }
    finalFieldSet.add(fieldName);
  }

  const sourceNameSet = new Set(baseFieldNames);
  const overrideEntries = blockEntries(getFieldValue(statement, "overrides"));
  const seenOverrides = new Set();

  for (const entry of overrideEntries) {
    const items = blockSymbolItems(entry);
    if (items.length < 2) {
      pushError(errors, `Each 'overrides' entry on shape ${statement.id} must include a field and at least one override`, entry.loc);
      continue;
    }

    const [fieldItem, ...rest] = items;
    if (!finalFieldSet.has(fieldItem.value) && !sourceNameSet.has(fieldItem.value)) {
      pushError(errors, `Shape ${statement.id} overrides unknown field '${fieldItem.value}'`, fieldItem.loc);
    }

    if (seenOverrides.has(fieldItem.value)) {
      pushError(errors, `Shape ${statement.id} overrides field '${fieldItem.value}' more than once`, fieldItem.loc);
    } else {
      seenOverrides.add(fieldItem.value);
    }

    let sawChange = false;
    for (let i = 0; i < rest.length; i += 1) {
      const token = rest[i];
      if (token.value === "required" || token.value === "optional") {
        sawChange = true;
        continue;
      }

      if (token.value === "type") {
        sawChange = true;
        if (!rest[i + 1]) {
          pushError(errors, `Shape ${statement.id} override for '${fieldItem.value}' is missing a type value`, token.loc);
        } else {
          i += 1;
        }
        continue;
      }

      if (token.value === "default") {
        sawChange = true;
        if (!rest[i + 1]) {
          pushError(errors, `Shape ${statement.id} override for '${fieldItem.value}' is missing a default value`, token.loc);
        } else {
          i += 1;
        }
        continue;
      }

      pushError(errors, `Shape ${statement.id} override for '${fieldItem.value}' has unknown directive '${token.value}'`, token.loc);
    }

    if (!sawChange) {
      pushError(errors, `Shape ${statement.id} override for '${fieldItem.value}' must specify at least one valid directive`, entry.loc);
    }
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
export function validateDataModelStatement(errors, statement, fieldMap, registry) {
  validateEntityRelations(errors, statement, fieldMap, registry);
  validateShapeTransforms(errors, statement, fieldMap, registry);
}

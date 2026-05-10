// @ts-check

import {
  blockSymbolItems,
  getFieldValue,
  pushError,
  symbolValues
} from "../utils.js";
import { statementFieldNames } from "../model-helpers.js";
import { parseUiDirectiveMap } from "./helpers.js";

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
function validateProjectionDbTables(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const dbTablesField = fieldMap.get("tables")?.[0];
  if (!dbTablesField || dbTablesField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  const seenTables = new Set();
  for (const entry of dbTablesField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [entityId, tableKeyword, tableName] = tokens;
    const entity = registry.get(entityId);

    if (!entity) {
      pushError(errors, `Projection ${statement.id} tables references missing entity '${entityId}'`, entry.loc);
      continue;
    }
    if (entity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} tables must target an entity, found ${entity.kind} '${entity.id}'`, entry.loc);
    }
    if (!realized.has(entityId)) {
      pushError(errors, `Projection ${statement.id} tables entity '${entityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (tableKeyword !== "table") {
      pushError(errors, `Projection ${statement.id} tables for '${entityId}' must use 'table'`, entry.loc);
    }
    if (!tableName) {
      pushError(errors, `Projection ${statement.id} tables for '${entityId}' must include a table name`, entry.loc);
    } else if (seenTables.has(tableName)) {
      pushError(errors, `Projection ${statement.id} tables has duplicate table name '${tableName}'`, entry.loc);
    }
    seenTables.add(tableName);
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
function validateProjectionDbColumns(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const dbColumnsField = fieldMap.get("columns")?.[0];
  if (!dbColumnsField || dbColumnsField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of dbColumnsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [entityId, fieldKeyword, fieldName, columnKeyword, columnName] = tokens;
    const entity = registry.get(entityId);

    if (!entity) {
      pushError(errors, `Projection ${statement.id} columns references missing entity '${entityId}'`, entry.loc);
      continue;
    }
    if (entity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} columns must target an entity, found ${entity.kind} '${entity.id}'`, entry.loc);
    }
    if (!realized.has(entityId)) {
      pushError(errors, `Projection ${statement.id} columns entity '${entityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (fieldKeyword !== "field") {
      pushError(errors, `Projection ${statement.id} columns for '${entityId}' must use 'field'`, entry.loc);
    }
    if (columnKeyword !== "column") {
      pushError(errors, `Projection ${statement.id} columns for '${entityId}' must use 'column'`, entry.loc);
    }
    const entityFieldNames = new Set(statementFieldNames(entity));
    if (fieldName && entityFieldNames.size > 0 && !entityFieldNames.has(fieldName)) {
      pushError(errors, `Projection ${statement.id} columns references unknown field '${fieldName}' on ${entityId}`, entry.loc);
    }
    if (!columnName) {
      pushError(errors, `Projection ${statement.id} columns for '${entityId}.${fieldName}' must include a column name`, entry.loc);
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
function validateProjectionDbKeys(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const dbKeysField = fieldMap.get("keys")?.[0];
  if (!dbKeysField || dbKeysField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of dbKeysField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [entityId, keyType] = tokens;
    const entity = registry.get(entityId);

    if (!entity) {
      pushError(errors, `Projection ${statement.id} keys references missing entity '${entityId}'`, entry.loc);
      continue;
    }
    if (entity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} keys must target an entity, found ${entity.kind} '${entity.id}'`, entry.loc);
    }
    if (!realized.has(entityId)) {
      pushError(errors, `Projection ${statement.id} keys entity '${entityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (!["primary", "unique"].includes(keyType || "")) {
      pushError(errors, `Projection ${statement.id} keys for '${entityId}' has invalid key type '${keyType}'`, entry.loc);
    }
    const fieldList = entry.items[2];
    if (!fieldList || fieldList.type !== "list" || fieldList.items.length === 0) {
      pushError(errors, `Projection ${statement.id} keys for '${entityId}' must include a non-empty field list`, entry.loc);
      continue;
    }
    const entityFieldNames = new Set(statementFieldNames(entity));
    for (const item of fieldList.items) {
      if (item.type === "symbol" && entityFieldNames.size > 0 && !entityFieldNames.has(item.value)) {
        pushError(errors, `Projection ${statement.id} keys references unknown field '${item.value}' on ${entityId}`, item.loc);
      }
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
function validateProjectionDbIndexes(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const dbIndexesField = fieldMap.get("indexes")?.[0];
  if (!dbIndexesField || dbIndexesField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of dbIndexesField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [entityId, indexType] = tokens;
    const entity = registry.get(entityId);

    if (!entity) {
      pushError(errors, `Projection ${statement.id} indexes references missing entity '${entityId}'`, entry.loc);
      continue;
    }
    if (entity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} indexes must target an entity, found ${entity.kind} '${entity.id}'`, entry.loc);
    }
    if (!realized.has(entityId)) {
      pushError(errors, `Projection ${statement.id} indexes entity '${entityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (!["index", "unique"].includes(indexType || "")) {
      pushError(errors, `Projection ${statement.id} indexes for '${entityId}' has invalid index type '${indexType}'`, entry.loc);
    }
    const fieldList = entry.items[2];
    if (!fieldList || fieldList.type !== "list" || fieldList.items.length === 0) {
      pushError(errors, `Projection ${statement.id} indexes for '${entityId}' must include a non-empty field list`, entry.loc);
      continue;
    }
    const entityFieldNames = new Set(statementFieldNames(entity));
    for (const item of fieldList.items) {
      if (item.type === "symbol" && entityFieldNames.size > 0 && !entityFieldNames.has(item.value)) {
        pushError(errors, `Projection ${statement.id} indexes references unknown field '${item.value}' on ${entityId}`, item.loc);
      }
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
function validateProjectionDbRelations(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const dbRelationsField = fieldMap.get("relations")?.[0];
  if (!dbRelationsField || dbRelationsField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of dbRelationsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [entityId, relationType, fieldName, referencesKeyword, targetRef, onDeleteKeyword, onDeleteValue] = tokens;
    const entity = registry.get(entityId);

    if (!entity) {
      pushError(errors, `Projection ${statement.id} relations references missing entity '${entityId}'`, entry.loc);
      continue;
    }
    if (entity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} relations must target an entity, found ${entity.kind} '${entity.id}'`, entry.loc);
    }
    if (!realized.has(entityId)) {
      pushError(errors, `Projection ${statement.id} relations entity '${entityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (relationType !== "foreign_key") {
      pushError(errors, `Projection ${statement.id} relations for '${entityId}' must use 'foreign_key'`, entry.loc);
    }
    if (referencesKeyword !== "references") {
      pushError(errors, `Projection ${statement.id} relations for '${entityId}' must use 'references'`, entry.loc);
    }
    if (onDeleteKeyword && onDeleteKeyword !== "on_delete") {
      pushError(errors, `Projection ${statement.id} relations for '${entityId}' has unexpected token '${onDeleteKeyword}'`, entry.loc);
    }
    if (onDeleteValue && !["cascade", "restrict", "set_null", "no_action"].includes(onDeleteValue)) {
      pushError(errors, `Projection ${statement.id} relations for '${entityId}' has invalid on_delete '${onDeleteValue}'`, entry.loc);
    }
    const entityFieldNames = new Set(statementFieldNames(entity));
    if (fieldName && entityFieldNames.size > 0 && !entityFieldNames.has(fieldName)) {
      pushError(errors, `Projection ${statement.id} relations references unknown field '${fieldName}' on ${entityId}`, entry.loc);
    }
    const [targetEntityId, targetFieldName] = (targetRef || "").split(".");
    const targetEntity = registry.get(targetEntityId);
    if (!targetEntity) {
      pushError(errors, `Projection ${statement.id} relations references missing target entity '${targetEntityId}'`, entry.loc);
      continue;
    }
    if (targetEntity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} relations must reference an entity target, found ${targetEntity.kind} '${targetEntity.id}'`, entry.loc);
    }
    const targetFieldNames = new Set(statementFieldNames(targetEntity));
    if (targetFieldName && targetFieldNames.size > 0 && !targetFieldNames.has(targetFieldName)) {
      pushError(errors, `Projection ${statement.id} relations references unknown target field '${targetFieldName}' on ${targetEntityId}`, entry.loc);
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
function validateProjectionDbLifecycle(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const dbLifecycleField = fieldMap.get("lifecycle")?.[0];
  if (!dbLifecycleField || dbLifecycleField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of dbLifecycleField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [entityId, lifecycleType] = tokens;
    const entity = registry.get(entityId);

    if (!entity) {
      pushError(errors, `Projection ${statement.id} lifecycle references missing entity '${entityId}'`, entry.loc);
      continue;
    }
    if (entity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} lifecycle must target an entity, found ${entity.kind} '${entity.id}'`, entry.loc);
    }
    if (!realized.has(entityId)) {
      pushError(errors, `Projection ${statement.id} lifecycle entity '${entityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = parseUiDirectiveMap(tokens, 2, errors, statement, entry, `lifecycle for '${entityId}'`);
    if (!["soft_delete", "timestamps"].includes(lifecycleType || "")) {
      pushError(errors, `Projection ${statement.id} lifecycle for '${entityId}' has invalid lifecycle '${lifecycleType}'`, entry.loc);
      continue;
    }

    const entityFieldNames = new Set(statementFieldNames(entity));
    if (lifecycleType === "soft_delete") {
      for (const requiredKey of ["field", "value"]) {
        if (!directives.has(requiredKey)) {
          pushError(errors, `Projection ${statement.id} lifecycle for '${entityId}' must include '${requiredKey}' for soft_delete`, entry.loc);
        }
      }
      const fieldName = directives.get("field");
      if (fieldName && entityFieldNames.size > 0 && !entityFieldNames.has(fieldName)) {
        pushError(errors, `Projection ${statement.id} lifecycle references unknown field '${fieldName}' on ${entityId}`, entry.loc);
      }
    }

    if (lifecycleType === "timestamps") {
      for (const requiredKey of ["created_at", "updated_at"]) {
        if (!directives.has(requiredKey)) {
          pushError(errors, `Projection ${statement.id} lifecycle for '${entityId}' must include '${requiredKey}' for timestamps`, entry.loc);
        }
        const fieldName = directives.get(requiredKey);
        if (fieldName && entityFieldNames.size > 0 && !entityFieldNames.has(fieldName)) {
          pushError(errors, `Projection ${statement.id} lifecycle references unknown field '${fieldName}' on ${entityId}`, entry.loc);
        }
      }
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
export function validateDbProjection(errors, statement, fieldMap, registry) {
  validateProjectionDbTables(errors, statement, fieldMap, registry);
  validateProjectionDbColumns(errors, statement, fieldMap, registry);
  validateProjectionDbKeys(errors, statement, fieldMap, registry);
  validateProjectionDbIndexes(errors, statement, fieldMap, registry);
  validateProjectionDbRelations(errors, statement, fieldMap, registry);
  validateProjectionDbLifecycle(errors, statement, fieldMap, registry);
}

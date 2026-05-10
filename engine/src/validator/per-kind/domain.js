// @ts-check
import {
  DOMAIN_IDENTIFIER_PATTERN,
  DOMAIN_TAGGABLE_KINDS
} from "../kinds.js";
import {
  blockEntries,
  getFieldValue,
  pushError,
  symbolValue,
  symbolValues,
  valueAsArray
} from "../utils.js";

/** @param {TopogramToken} value @returns {boolean} */
function isStringOrSymbolList(value) {
  for (const item of valueAsArray(value)) {
    if (item.type !== "string" && item.type !== "symbol") {
      return false;
    }
  }
  return true;
}

/** @param {ValidationErrors} errors @param {TopogramStatement} statement */
function validateDomainIdentifier(errors, statement) {
  if (statement.kind !== "domain") {
    return;
  }
  if (!DOMAIN_IDENTIFIER_PATTERN.test(statement.id)) {
    pushError(
      errors,
      `Domain identifier '${statement.id}' must match ${DOMAIN_IDENTIFIER_PATTERN.source}`,
      statement.loc
    );
  }
}

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap */
function validateScopeFields(errors, statement, fieldMap) {
  if (statement.kind !== "domain") {
    return;
  }
  for (const key of ["in_scope", "out_of_scope", "aliases"]) {
    const field = fieldMap.get(key)?.[0];
    if (!field) continue;
    if (!isStringOrSymbolList(field.value)) {
      pushError(
        errors,
        `Field '${key}' on domain ${statement.id} must be a list of strings or symbols`,
        field.loc
      );
    }
  }
}

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap @param {TopogramRegistry} registry */
function validateParentDomain(errors, statement, fieldMap, registry) {
  if (statement.kind !== "domain") {
    return;
  }
  const field = fieldMap.get("parent_domain")?.[0];
  if (!field) return;

  const parentId = symbolValue(field.value);
  if (!parentId) {
    pushError(
      errors,
      `Field 'parent_domain' on domain ${statement.id} must be a single symbol`,
      field.loc
    );
    return;
  }

  if (parentId === statement.id) {
    pushError(
      errors,
      `Domain ${statement.id} cannot be its own parent_domain`,
      field.loc
    );
    return;
  }

  const target = registry.get(parentId);
  if (!target) {
    pushError(
      errors,
      `Domain ${statement.id} parent_domain references missing domain '${parentId}'`,
      field.loc
    );
    return;
  }
  if (target.kind !== "domain") {
    pushError(
      errors,
      `Domain ${statement.id} parent_domain must reference a domain, found ${target.kind} '${target.id}'`,
      field.loc
    );
  }
}

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap @param {TopogramRegistry} registry */
function validateOwners(errors, statement, fieldMap, registry) {
  if (statement.kind !== "domain") {
    return;
  }
  const field = fieldMap.get("owners")?.[0];
  if (!field) return;

  for (const id of symbolValues(field.value)) {
    const target = registry.get(id);
    if (!target) {
      pushError(
        errors,
        `Domain ${statement.id} owners references missing statement '${id}'`,
        field.loc
      );
      continue;
    }
    if (target.kind !== "actor" && target.kind !== "role") {
      pushError(
        errors,
        `Domain ${statement.id} owners must reference actor or role, found ${target.kind} '${target.id}'`,
        field.loc
      );
    }
  }
}

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap @param {TopogramRegistry} registry */
function detectParentDomainCycle(errors, statement, fieldMap, registry) {
  if (statement.kind !== "domain") {
    return;
  }
  const field = fieldMap.get("parent_domain")?.[0];
  if (!field) return;

  const seen = new Set([statement.id]);
  let cursor = registry.get(symbolValue(field.value));
  while (cursor && cursor.kind === "domain") {
    if (seen.has(cursor.id)) {
      pushError(
        errors,
        `Domain ${statement.id} parent_domain chain forms a cycle through '${cursor.id}'`,
        field.loc
      );
      return;
    }
    seen.add(cursor.id);
    const parentField = cursor.fields.find((f) => f.key === "parent_domain");
    if (!parentField) break;
    cursor = registry.get(symbolValue(parentField.value));
  }
}

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap @param {TopogramRegistry} registry */
export function validateDomain(errors, statement, fieldMap, registry) {
  if (statement.kind !== "domain") {
    return;
  }
  validateDomainIdentifier(errors, statement);
  validateScopeFields(errors, statement, fieldMap);
  validateParentDomain(errors, statement, fieldMap, registry);
  validateOwners(errors, statement, fieldMap, registry);
  detectParentDomainCycle(errors, statement, fieldMap, registry);
}

// Cross-kind validator: when *any* statement carries a `domain` field, verify
// it resolves to kind=domain. Skipped on the `domain` kind itself (its own
// `parent_domain` field handles that case).
/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap @param {TopogramRegistry} registry */
export function validateDomainTag(errors, statement, fieldMap, registry) {
  if (statement.kind === "domain") {
    return;
  }
  const field = fieldMap.get("domain")?.[0];
  if (!field) return;

  if (!DOMAIN_TAGGABLE_KINDS.has(statement.kind)) {
    pushError(
      errors,
      `Field 'domain' is not allowed on ${statement.kind} ${statement.id}`,
      field.loc
    );
    return;
  }

  const id = symbolValue(field.value);
  if (!id) {
    pushError(
      errors,
      `Field 'domain' on ${statement.kind} ${statement.id} must be a single symbol`,
      field.loc
    );
    return;
  }

  const target = registry.get(id);
  if (!target) {
    pushError(
      errors,
      `${statement.kind} ${statement.id} domain references missing domain '${id}'`,
      field.loc
    );
    return;
  }
  if (target.kind !== "domain") {
    pushError(
      errors,
      `${statement.kind} ${statement.id} domain must reference a domain, found ${target.kind} '${target.id}'`,
      field.loc
    );
  }
}

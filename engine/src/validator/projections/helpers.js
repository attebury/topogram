// @ts-check

import {
  blockSymbolItems,
  getFieldValue,
  pushError,
  symbolValues
} from "../utils.js";
import {
  resolveShapeBaseFieldNames,
  statementFieldNames
} from "../model-helpers.js";

/**
 * @param {TopogramRegistry} registry
 * @param {string} capabilityId
 * @param {string} direction
 * @returns {Set<string>}
 */
export function resolveCapabilityContractFields(registry, capabilityId, direction) {
  const capability = registry.get(capabilityId);
  if (!capability || capability.kind !== "capability") {
    return new Set();
  }

  const refsField = direction === "input" ? getFieldValue(capability, "input") : getFieldValue(capability, "output");
  const shapeId = symbolValues(refsField)[0];
  if (!shapeId) {
    return new Set();
  }

  const shape = registry.get(shapeId);
  if (!shape || shape.kind !== "shape") {
    return new Set();
  }

  const explicitFields = statementFieldNames(shape);
  if (explicitFields.length > 0) {
    return new Set(explicitFields);
  }

  return new Set(resolveShapeBaseFieldNames(shape, registry));
}

/**
 * @param {TopogramRegistry} registry
 * @param {string} capabilityId
 * @returns {TopogramStatement | null}
 */
export function resolveCapabilityOutputShape(registry, capabilityId) {
  const capability = registry.get(capabilityId);
  if (!capability || capability.kind !== "capability") {
    return null;
  }

  const shapeId = symbolValues(getFieldValue(capability, "output"))[0];
  const shape = shapeId ? registry.get(shapeId) : null;
  return shape?.kind === "shape" ? shape : null;
}

/**
 * @param {string[]} tokens
 * @param {number} startIndex
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramBlockEntry} entry
 * @param {string} context
 * @returns {Map<string, string>}
 */
export function parseUiDirectiveMap(tokens, startIndex, errors, statement, entry, context) {
  const directives = new Map();

  for (let i = startIndex; i < tokens.length; i += 2) {
    const key = tokens[i];
    const value = tokens[i + 1];
    if (!key) {
      continue;
    }
    if (!value) {
      pushError(errors, `Projection ${statement.id} ${context} is missing a value for '${key}'`, entry.loc);
      continue;
    }
    directives.set(key, value);
  }

  return directives;
}

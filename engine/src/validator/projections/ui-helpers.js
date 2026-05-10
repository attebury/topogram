// @ts-check

import {
  blockEntries,
  blockSymbolItems,
  getFieldValue,
  symbolValues
} from "../utils.js";
import {
  resolveShapeBaseFieldNames,
  statementFieldNames
} from "../model-helpers.js";
import {
  parseUiDirectiveMap,
  resolveCapabilityContractFields
} from "./helpers.js";

/**
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {Map<string, TopogramBlockEntry>}
 */
export function collectProjectionUiScreens(statement, fieldMap) {
  const screensField = fieldMap.get("screens")?.[0];
  if (!screensField || screensField.value.type !== "block") {
    return new Map();
  }

  const screens = new Map();
  for (const entry of screensField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    if (tokens[0] === "screen" && tokens[1]) {
      screens.set(tokens[1], entry);
    }
  }
  return screens;
}

/**
 * @param {TopogramRegistry} registry
 * @param {TopogramBlockEntry} screenEntry
 * @param {TopogramStatement} statement
 * @returns {Set<string>}
 */

export function resolveProjectionUiScreenFieldNames(registry, screenEntry, statement) {
  const tokens = blockSymbolItems(screenEntry).map((item) => item.value);
  const directives = parseUiDirectiveMap(tokens, 2, [], statement, screenEntry, "");
  const kind = directives.get("kind");

  if (kind === "form") {
    const shapeId = directives.get("input_shape");
    const shape = shapeId ? registry.get(shapeId) : null;
    if (!shape || shape.kind !== "shape") {
      return new Set();
    }
    const explicitFields = statementFieldNames(shape);
    return new Set(explicitFields.length > 0 ? explicitFields : resolveShapeBaseFieldNames(shape, registry));
  }

  if (kind === "list") {
    const loadCapabilityId = directives.get("load");
    return loadCapabilityId ? resolveCapabilityContractFields(registry, loadCapabilityId, "input") : new Set();
  }

  if (kind === "detail" || kind === "job_status") {
    const loadCapabilityId = directives.get("load");
    return loadCapabilityId ? resolveCapabilityContractFields(registry, loadCapabilityId, "output") : new Set();
  }

  return new Set();
}

/**
 * @param {TopogramStatement} statement
 * @returns {Set<string>}
 */

export function screenIdsFromProjectionStatement(statement) {
  const screens = new Set();
  for (const entry of blockEntries(getFieldValue(statement, "screens"))) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    if (tokens[0] === "screen" && tokens[1]) {
      screens.add(tokens[1]);
    }
  }
  return screens;
}

/**
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {Set<string>}
 */

export function collectAvailableUiScreenIds(statement, fieldMap, registry) {
  const available = new Set(collectProjectionUiScreens(statement, fieldMap).keys());
  for (const targetId of symbolValues(getFieldValue(statement, "realizes"))) {
    const target = registry.get(targetId);
    if (target?.kind === "projection") {
      for (const screenId of screenIdsFromProjectionStatement(target)) {
        available.add(screenId);
      }
    }
  }
  return available;
}

/**
 * @param {TopogramStatement} statement
 * @returns {Set<string>}
 */

export function collectProjectionUiRegionKeys(statement) {
  const keys = new Set();
  for (const entry of blockEntries(getFieldValue(statement, "screen_regions"))) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    if (tokens[0] === "screen" && tokens[1] && tokens[2] === "region" && tokens[3]) {
      keys.add(`${tokens[1]}:${tokens[3]}`);
    }
  }
  return keys;
}

/**
 * @param {TopogramStatement} statement
 * @param {TopogramRegistry} registry
 * @returns {Set<string>}
 */

export function collectAvailableUiRegionKeys(statement, registry) {
  const available = collectProjectionUiRegionKeys(statement);
  for (const targetId of symbolValues(getFieldValue(statement, "realizes"))) {
    const target = registry.get(targetId);
    if (target?.kind === "projection") {
      for (const key of collectProjectionUiRegionKeys(target)) {
        available.add(key);
      }
    }
  }
  return available;
}

/**
 * @param {TopogramStatement} statement
 * @returns {Map<string, string>}
 */

export function collectProjectionUiRegionPatterns(statement) {
  const patterns = new Map();
  for (const entry of blockEntries(getFieldValue(statement, "screen_regions"))) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    if (tokens[0] !== "screen" || !tokens[1] || tokens[2] !== "region" || !tokens[3]) {
      continue;
    }
    for (let i = 4; i < tokens.length; i += 2) {
      if (tokens[i] === "pattern" && tokens[i + 1]) {
        patterns.set(`${tokens[1]}:${tokens[3]}`, tokens[i + 1]);
      }
    }
  }
  return patterns;
}

/**
 * @param {TopogramStatement} statement
 * @param {TopogramRegistry} registry
 * @returns {Map<string, string>}
 */

export function collectAvailableUiRegionPatterns(statement, registry) {
  const patterns = collectProjectionUiRegionPatterns(statement);
  for (const targetId of symbolValues(getFieldValue(statement, "realizes"))) {
    const target = registry.get(targetId);
    if (target?.kind !== "projection") {
      continue;
    }
    for (const [key, pattern] of collectProjectionUiRegionPatterns(target)) {
      if (!patterns.has(key)) {
        patterns.set(key, pattern);
      }
    }
  }
  return patterns;
}

/**
 * @param {Map<string, string>} directives
 * @param {string} key
 * @returns {string}
 */

export function directiveValue(directives, key) {
  return directives.get(key) || "";
}

export const SHARED_UI_SEMANTIC_BLOCKS = [
  "screens",
  "collection_views",
  "screen_actions",
  "visibility_rules",
  "field_lookups",
  "app_shell",
  "navigation",
  "screen_regions"
];

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {void}
 */

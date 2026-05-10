// @ts-check

import {
  IDENTIFIER_PATTERN,
  UI_APP_SHELL_KINDS,
  UI_COLLECTION_PRESENTATIONS,
  UI_DESIGN_ACCESSIBILITY_VALUES,
  UI_DESIGN_ACTION_ROLES,
  UI_DESIGN_COLOR_ROLES,
  UI_DESIGN_DENSITIES,
  UI_DESIGN_RADIUS_SCALES,
  UI_DESIGN_TONES,
  UI_DESIGN_TYPOGRAPHY_ROLES,
  UI_NAVIGATION_PATTERNS,
  UI_PATTERN_KINDS,
  UI_REGION_KINDS,
  UI_SCREEN_KINDS,
  UI_STATE_KINDS,
  UI_WINDOWING_MODES
} from "../kinds.js";
import {
  blockEntries,
  blockSymbolItems,
  getFieldValue,
  pushError,
  symbolValue,
  symbolValues
} from "../utils.js";
import {
  resolveShapeBaseFieldNames,
  statementFieldNames
} from "../model-helpers.js";
import {
  parseUiDirectiveMap,
  resolveCapabilityContractFields,
  resolveCapabilityOutputShape
} from "./helpers.js";

/**
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {Map<string, TopogramBlockEntry>}
 */
function collectProjectionUiScreens(statement, fieldMap) {
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
function resolveProjectionUiScreenFieldNames(registry, screenEntry, statement) {
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
function screenIdsFromProjectionStatement(statement) {
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
function collectAvailableUiScreenIds(statement, fieldMap, registry) {
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
function collectProjectionUiRegionKeys(statement) {
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
function collectAvailableUiRegionKeys(statement, registry) {
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
function collectProjectionUiRegionPatterns(statement) {
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
function collectAvailableUiRegionPatterns(statement, registry) {
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
function directiveValue(directives, key) {
  return directives.get(key) || "";
}

const SHARED_UI_SEMANTIC_BLOCKS = [
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
function validateProjectionUiOwnership(errors, statement, fieldMap) {
  if (statement.kind !== "projection") {
    return;
  }

  const projectionType = symbolValue(getFieldValue(statement, "type"));
  for (const key of SHARED_UI_SEMANTIC_BLOCKS) {
    const field = fieldMap.get(key)?.[0];
    if (!field || field.value.type !== "block") {
      continue;
    }
    if (projectionType !== "ui_contract") {
      pushError(
        errors,
        `Projection ${statement.id} ${key} belongs on shared UI projections; concrete UI projections may define screen_routes and surface hints only`,
        field.loc
      );
    }
  }

  const routesField = fieldMap.get("screen_routes")?.[0];
  if (routesField?.value.type === "block" && !["web_surface", "ios_surface"].includes(projectionType || "")) {
    pushError(
      errors,
      `Projection ${statement.id} screen_routes belongs on concrete UI projections; shared UI projections own semantic screens and regions`,
      routesField.loc
    );
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
function validateProjectionUiScreens(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const screensField = fieldMap.get("screens")?.[0];
  if (!screensField || screensField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  const seenScreens = new Set();

  for (const entry of screensField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [keyword, screenId] = tokens;

    if (keyword !== "screen") {
      pushError(errors, `Projection ${statement.id} screens entries must start with 'screen'`, entry.loc);
      continue;
    }
    if (!screenId) {
      pushError(errors, `Projection ${statement.id} screens entries must include a screen id`, entry.loc);
      continue;
    }
    if (!IDENTIFIER_PATTERN.test(screenId)) {
      pushError(errors, `Projection ${statement.id} screens has invalid screen id '${screenId}'`, entry.loc);
    }
    if (seenScreens.has(screenId)) {
      pushError(errors, `Projection ${statement.id} screens has duplicate screen id '${screenId}'`, entry.loc);
    }
    seenScreens.add(screenId);

    const directives = parseUiDirectiveMap(tokens, 2, errors, statement, entry, `screens for '${screenId}'`);
    const kind = directives.get("kind");
    if (!kind) {
      pushError(errors, `Projection ${statement.id} screens for '${screenId}' must include 'kind'`, entry.loc);
    }
    if (kind && !UI_SCREEN_KINDS.has(kind)) {
      pushError(errors, `Projection ${statement.id} screens for '${screenId}' has invalid kind '${kind}'`, entry.loc);
    }

    for (const key of directives.keys()) {
      if (!["kind", "title", "load", "item_shape", "view_shape", "input_shape", "submit", "detail_capability", "primary_action", "secondary_action", "destructive_action", "success_navigate", "success_refresh", "empty_title", "empty_body", "terminal_action", "loading_state", "error_state", "unauthorized_state", "not_found_state", "success_state"].includes(key)) {
        pushError(errors, `Projection ${statement.id} screens for '${screenId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    for (const [key, expectedKind] of [
      ["load", "capability"],
      ["submit", "capability"],
      ["detail_capability", "capability"],
      ["primary_action", "capability"],
      ["secondary_action", "capability"],
      ["destructive_action", "capability"],
      ["terminal_action", "capability"],
      ["item_shape", "shape"],
      ["view_shape", "shape"],
      ["input_shape", "shape"]
    ]) {
      const targetId = directives.get(key);
      if (!targetId) {
        continue;
      }
      const target = registry.get(targetId);
      if (!target) {
        pushError(errors, `Projection ${statement.id} screens for '${screenId}' references missing ${expectedKind} '${targetId}' for '${key}'`, entry.loc);
        continue;
      }
      if (target.kind !== expectedKind) {
        pushError(errors, `Projection ${statement.id} screens for '${screenId}' must reference a ${expectedKind} for '${key}', found ${target.kind} '${target.id}'`, entry.loc);
      }
      if (expectedKind === "capability" && !realized.has(targetId)) {
        pushError(errors, `Projection ${statement.id} screens for '${screenId}' capability '${targetId}' for '${key}' must also appear in 'realizes'`, entry.loc);
      }
    }

    const successNavigate = directives.get("success_navigate");
    const successRefresh = directives.get("success_refresh");
    if (successNavigate && !IDENTIFIER_PATTERN.test(successNavigate)) {
      pushError(errors, `Projection ${statement.id} screens for '${screenId}' has invalid target '${successNavigate}' for 'success_navigate'`, entry.loc);
    }
    if (successRefresh && !IDENTIFIER_PATTERN.test(successRefresh)) {
      pushError(errors, `Projection ${statement.id} screens for '${screenId}' has invalid target '${successRefresh}' for 'success_refresh'`, entry.loc);
    }

    if (kind === "list" && !directives.get("load")) {
      pushError(errors, `Projection ${statement.id} screens for '${screenId}' kind 'list' requires 'load'`, entry.loc);
    }
    if (kind === "detail") {
      if (!directives.get("load")) {
        pushError(errors, `Projection ${statement.id} screens for '${screenId}' kind 'detail' requires 'load'`, entry.loc);
      }
      if (!directives.get("view_shape")) {
        pushError(errors, `Projection ${statement.id} screens for '${screenId}' kind 'detail' requires 'view_shape'`, entry.loc);
      }
    }
    if (kind === "form") {
      if (!directives.get("input_shape")) {
        pushError(errors, `Projection ${statement.id} screens for '${screenId}' kind 'form' requires 'input_shape'`, entry.loc);
      }
      if (!directives.get("submit")) {
        pushError(errors, `Projection ${statement.id} screens for '${screenId}' kind 'form' requires 'submit'`, entry.loc);
      }
    }
  }

  for (const entry of screensField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const screenId = tokens[1];
    if (!screenId) {
      continue;
    }
    const directives = parseUiDirectiveMap(tokens, 2, [], statement, entry, "");
    for (const key of ["success_navigate", "success_refresh"]) {
      const targetScreenId = directives.get(key);
      if (targetScreenId && !seenScreens.has(targetScreenId)) {
        pushError(errors, `Projection ${statement.id} screens for '${screenId}' references unknown screen '${targetScreenId}' for '${key}'`, entry.loc);
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
function validateProjectionUiCollections(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const collectionsField = fieldMap.get("collection_views")?.[0];
  if (!collectionsField || collectionsField.value.type !== "block") {
    return;
  }

  const screens = collectProjectionUiScreens(statement, fieldMap);
  for (const entry of collectionsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [keyword, screenId, operation, value, extra] = tokens;

    if (keyword !== "screen") {
      pushError(errors, `Projection ${statement.id} collection_views entries must start with 'screen'`, entry.loc);
      continue;
    }
    const screenEntry = screens.get(screenId);
    if (!screenEntry) {
      pushError(errors, `Projection ${statement.id} collection_views references unknown screen '${screenId}'`, entry.loc);
      continue;
    }

    const screenTokens = blockSymbolItems(screenEntry).map((item) => item.value);
    const screenDirectives = parseUiDirectiveMap(screenTokens, 2, [], statement, screenEntry, "");
    if (screenDirectives.get("kind") !== "list") {
      pushError(errors, `Projection ${statement.id} collection_views may only target list screens, found '${screenId}'`, entry.loc);
    }

    if (!["filter", "search", "pagination", "sort", "group", "view", "refresh"].includes(operation)) {
      pushError(errors, `Projection ${statement.id} collection_views for '${screenId}' has invalid operation '${operation}'`, entry.loc);
      continue;
    }

    const loadCapabilityId = screenDirectives.get("load");
    const inputFields = loadCapabilityId ? resolveCapabilityContractFields(registry, loadCapabilityId, "input") : new Set();
    const outputShape = loadCapabilityId ? resolveCapabilityOutputShape(registry, loadCapabilityId) : null;
    const outputFields = outputShape
      ? new Set((statementFieldNames(outputShape).length > 0 ? statementFieldNames(outputShape) : resolveShapeBaseFieldNames(outputShape, registry)))
      : new Set();

    if (operation === "filter" || operation === "search") {
      if (!value) {
        pushError(errors, `Projection ${statement.id} collection_views for '${screenId}' must include a field for '${operation}'`, entry.loc);
      } else if (inputFields.size > 0 && !inputFields.has(value)) {
        pushError(errors, `Projection ${statement.id} collection_views references unknown input field '${value}' for '${operation}' on '${screenId}'`, entry.loc);
      }
    }

    if (operation === "pagination" && !["cursor", "paged", "none"].includes(value || "")) {
      pushError(errors, `Projection ${statement.id} collection_views for '${screenId}' has invalid pagination '${value}'`, entry.loc);
    }

    if (operation === "sort") {
      if (!value || !extra) {
        pushError(errors, `Projection ${statement.id} collection_views for '${screenId}' must use 'sort <field> <asc|desc>'`, entry.loc);
      } else {
        if (!["asc", "desc"].includes(extra)) {
          pushError(errors, `Projection ${statement.id} collection_views for '${screenId}' has invalid sort direction '${extra}'`, entry.loc);
        }
        if (outputFields.size > 0 && !outputFields.has(value)) {
          pushError(errors, `Projection ${statement.id} collection_views references unknown output field '${value}' for sort on '${screenId}'`, entry.loc);
        }
      }
    }

    if (operation === "group") {
      if (!value) {
        pushError(errors, `Projection ${statement.id} collection_views for '${screenId}' must include a field for 'group'`, entry.loc);
      } else if (outputFields.size > 0 && !outputFields.has(value)) {
        pushError(errors, `Projection ${statement.id} collection_views references unknown output field '${value}' for group on '${screenId}'`, entry.loc);
      }
    }

    if (operation === "view" && !UI_COLLECTION_PRESENTATIONS.has(value || "")) {
      pushError(errors, `Projection ${statement.id} collection_views for '${screenId}' has invalid view '${value}'`, entry.loc);
    }

    if (operation === "refresh" && !["manual", "pull_to_refresh", "auto"].includes(value || "")) {
      pushError(errors, `Projection ${statement.id} collection_views for '${screenId}' has invalid refresh '${value}'`, entry.loc);
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
function validateProjectionUiActions(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const actionsField = fieldMap.get("screen_actions")?.[0];
  if (!actionsField || actionsField.value.type !== "block") {
    return;
  }

  const screens = collectProjectionUiScreens(statement, fieldMap);
  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));

  for (const entry of actionsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [keyword, screenId, actionKeyword, capabilityId, prominenceKeyword, prominence, placementKeyword, placement] = tokens;

    if (keyword !== "screen") {
      pushError(errors, `Projection ${statement.id} screen_actions entries must start with 'screen'`, entry.loc);
      continue;
    }
    if (!screens.has(screenId)) {
      pushError(errors, `Projection ${statement.id} screen_actions references unknown screen '${screenId}'`, entry.loc);
    }
    if (actionKeyword !== "action") {
      pushError(errors, `Projection ${statement.id} screen_actions for '${screenId}' must use 'action'`, entry.loc);
    }
    const capability = registry.get(capabilityId);
    if (!capability) {
      pushError(errors, `Projection ${statement.id} screen_actions references missing capability '${capabilityId}'`, entry.loc);
    } else if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} screen_actions must reference a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    } else if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} screen_actions for '${screenId}' capability '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (prominenceKeyword !== "prominence") {
      pushError(errors, `Projection ${statement.id} screen_actions for '${screenId}' must use 'prominence'`, entry.loc);
    }
    if (!["primary", "secondary", "destructive", "contextual"].includes(prominence || "")) {
      pushError(errors, `Projection ${statement.id} screen_actions for '${screenId}' has invalid prominence '${prominence}'`, entry.loc);
    }
    if (placementKeyword && placementKeyword !== "placement") {
      pushError(errors, `Projection ${statement.id} screen_actions for '${screenId}' has unknown directive '${placementKeyword}'`, entry.loc);
    }
    if (placementKeyword === "placement" && !["toolbar", "menu", "bulk", "inline", "footer"].includes(placement || "")) {
      pushError(errors, `Projection ${statement.id} screen_actions for '${screenId}' has invalid placement '${placement}'`, entry.loc);
    }
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {void}
 */
function validateProjectionUiAppShell(errors, statement, fieldMap) {
  if (statement.kind !== "projection") {
    return;
  }

  const shellField = fieldMap.get("app_shell")?.[0];
  if (!shellField || shellField.value.type !== "block") {
    return;
  }

  const seenKeys = new Set();
  for (const entry of shellField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [key, value, extra] = tokens;
    if (!["brand", "shell", "primary_nav", "secondary_nav", "utility_nav", "footer", "global_search", "notifications", "account_menu", "workspace_switcher", "windowing"].includes(key || "")) {
      pushError(errors, `Projection ${statement.id} app_shell has unknown key '${key}'`, entry.loc);
      continue;
    }
    if (!value) {
      pushError(errors, `Projection ${statement.id} app_shell is missing a value for '${key}'`, entry.loc);
      continue;
    }
    if (extra) {
      pushError(errors, `Projection ${statement.id} app_shell '${key}' accepts exactly one value`, entry.loc);
    }
    if (seenKeys.has(key)) {
      pushError(errors, `Projection ${statement.id} app_shell has duplicate key '${key}'`, entry.loc);
    }
    seenKeys.add(key);

    if (key === "shell" && !UI_APP_SHELL_KINDS.has(value)) {
      pushError(errors, `Projection ${statement.id} app_shell has invalid shell '${value}'`, entry.loc);
    }
    if (["global_search", "notifications", "account_menu", "workspace_switcher"].includes(key) && !["true", "false"].includes(value)) {
      pushError(errors, `Projection ${statement.id} app_shell '${key}' must be true or false`, entry.loc);
    }
    if (key === "windowing" && !UI_WINDOWING_MODES.has(value)) {
      pushError(errors, `Projection ${statement.id} app_shell has invalid windowing '${value}'`, entry.loc);
    }
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {void}
 */
function validateProjectionUiDesign(errors, statement, fieldMap) {
  if (statement.kind !== "projection") {
    return;
  }

  const designField = fieldMap.get("design_tokens")?.[0];
  if (!designField || designField.value.type !== "block") {
    return;
  }

  if (symbolValue(getFieldValue(statement, "type")) !== "ui_contract") {
    pushError(errors, `Projection ${statement.id} design_tokens belongs on shared UI projections; concrete UI projections inherit semantic design intent through 'realizes'`, designField.loc);
  }

  for (const entry of designField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [key, value, extra] = tokens;

    if (key === "density") {
      if (!UI_DESIGN_DENSITIES.has(value || "")) {
        pushError(errors, `Projection ${statement.id} design_tokens density has invalid value '${value}'`, entry.loc);
      }
      if (tokens.length !== 2) {
        pushError(errors, `Projection ${statement.id} design_tokens density accepts exactly one value`, entry.loc);
      }
      continue;
    }

    if (key === "tone") {
      if (!UI_DESIGN_TONES.has(value || "")) {
        pushError(errors, `Projection ${statement.id} design_tokens tone has invalid value '${value}'`, entry.loc);
      }
      if (tokens.length !== 2) {
        pushError(errors, `Projection ${statement.id} design_tokens tone accepts exactly one value`, entry.loc);
      }
      continue;
    }

    if (key === "radius_scale") {
      if (!UI_DESIGN_RADIUS_SCALES.has(value || "")) {
        pushError(errors, `Projection ${statement.id} design_tokens radius_scale has invalid value '${value}'`, entry.loc);
      }
      if (tokens.length !== 2) {
        pushError(errors, `Projection ${statement.id} design_tokens radius_scale accepts exactly one value`, entry.loc);
      }
      continue;
    }

    if (key === "color_role") {
      if (!UI_DESIGN_COLOR_ROLES.has(value || "")) {
        pushError(errors, `Projection ${statement.id} design_tokens color_role has invalid role '${value}'`, entry.loc);
      }
      if (tokens.length !== 3) {
        pushError(errors, `Projection ${statement.id} design_tokens color_role must use 'color_role <role> <semantic-token>'`, entry.loc);
      }
      continue;
    }

    if (key === "typography_role") {
      if (!UI_DESIGN_TYPOGRAPHY_ROLES.has(value || "")) {
        pushError(errors, `Projection ${statement.id} design_tokens typography_role has invalid role '${value}'`, entry.loc);
      }
      if (tokens.length !== 3) {
        pushError(errors, `Projection ${statement.id} design_tokens typography_role must use 'typography_role <role> <semantic-token>'`, entry.loc);
      }
      continue;
    }

    if (key === "action_role") {
      if (!UI_DESIGN_ACTION_ROLES.has(value || "")) {
        pushError(errors, `Projection ${statement.id} design_tokens action_role has invalid role '${value}'`, entry.loc);
      }
      if (tokens.length !== 3) {
        pushError(errors, `Projection ${statement.id} design_tokens action_role must use 'action_role <role> <semantic-token>'`, entry.loc);
      }
      continue;
    }

    if (key === "accessibility") {
      const values = UI_DESIGN_ACCESSIBILITY_VALUES[value];
      if (tokens.length !== 3) {
        pushError(errors, `Projection ${statement.id} design_tokens accessibility must use 'accessibility <setting> <value>'`, entry.loc);
      }
      if (!values) {
        pushError(errors, `Projection ${statement.id} design_tokens accessibility has invalid setting '${value}'`, entry.loc);
      } else if (!values.has(extra || "")) {
        pushError(errors, `Projection ${statement.id} design_tokens accessibility '${value}' has invalid value '${extra}'`, entry.loc);
      }
      continue;
    }

    pushError(errors, `Projection ${statement.id} design_tokens has unknown key '${key}'`, entry.loc);
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
function validateProjectionUiNavigation(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const navigationField = fieldMap.get("navigation")?.[0];
  if (!navigationField || navigationField.value.type !== "block") {
    return;
  }

  const availableScreens = collectAvailableUiScreenIds(statement, fieldMap, registry);
  const groups = new Set();

  for (const entry of navigationField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [targetKind, targetId] = tokens;

    if (targetKind === "group") {
      if (!targetId || !IDENTIFIER_PATTERN.test(targetId)) {
        pushError(errors, `Projection ${statement.id} navigation group entries must include a valid group id`, entry.loc);
        continue;
      }
      groups.add(targetId);
      const directives = parseUiDirectiveMap(tokens, 2, errors, statement, entry, `navigation group '${targetId}'`);
      for (const key of directives.keys()) {
        if (!["label", "placement", "icon", "order", "pattern"].includes(key)) {
          pushError(errors, `Projection ${statement.id} navigation group '${targetId}' has unknown directive '${key}'`, entry.loc);
        }
      }
      if (directives.has("placement") && !["primary", "secondary", "utility"].includes(directiveValue(directives, "placement"))) {
        pushError(errors, `Projection ${statement.id} navigation group '${targetId}' has invalid placement '${directives.get("placement")}'`, entry.loc);
      }
      if (directives.has("pattern") && !UI_NAVIGATION_PATTERNS.has(directiveValue(directives, "pattern"))) {
        pushError(errors, `Projection ${statement.id} navigation group '${targetId}' has invalid pattern '${directives.get("pattern")}'`, entry.loc);
      }
      continue;
    }

    if (targetKind === "screen") {
      if (!availableScreens.has(targetId)) {
        pushError(errors, `Projection ${statement.id} navigation references unknown screen '${targetId}'`, entry.loc);
      }
      const directives = parseUiDirectiveMap(tokens, 2, errors, statement, entry, `navigation screen '${targetId}'`);
      for (const key of directives.keys()) {
        if (!["group", "label", "order", "visible", "default", "breadcrumb", "sitemap", "placement", "pattern"].includes(key)) {
          pushError(errors, `Projection ${statement.id} navigation screen '${targetId}' has unknown directive '${key}'`, entry.loc);
        }
      }
      if (directives.has("visible") && !["true", "false"].includes(directiveValue(directives, "visible"))) {
        pushError(errors, `Projection ${statement.id} navigation screen '${targetId}' has invalid visible '${directives.get("visible")}'`, entry.loc);
      }
      if (directives.has("default") && !["true", "false"].includes(directiveValue(directives, "default"))) {
        pushError(errors, `Projection ${statement.id} navigation screen '${targetId}' has invalid default '${directives.get("default")}'`, entry.loc);
      }
      if (directives.has("placement") && !["primary", "secondary", "utility"].includes(directiveValue(directives, "placement"))) {
        pushError(errors, `Projection ${statement.id} navigation screen '${targetId}' has invalid placement '${directives.get("placement")}'`, entry.loc);
      }
      if (directives.has("sitemap") && !["include", "exclude"].includes(directiveValue(directives, "sitemap"))) {
        pushError(errors, `Projection ${statement.id} navigation screen '${targetId}' has invalid sitemap '${directives.get("sitemap")}'`, entry.loc);
      }
      if (directives.has("pattern") && !UI_NAVIGATION_PATTERNS.has(directiveValue(directives, "pattern"))) {
        pushError(errors, `Projection ${statement.id} navigation screen '${targetId}' has invalid pattern '${directives.get("pattern")}'`, entry.loc);
      }
      const breadcrumb = directives.get("breadcrumb");
      if (breadcrumb && breadcrumb !== "none" && !availableScreens.has(breadcrumb)) {
        pushError(errors, `Projection ${statement.id} navigation screen '${targetId}' references unknown breadcrumb screen '${breadcrumb}'`, entry.loc);
      }
      continue;
    }

    pushError(errors, `Projection ${statement.id} navigation entries must start with 'group' or 'screen'`, entry.loc);
  }

  for (const entry of navigationField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    if (tokens[0] !== "screen") {
      continue;
    }
    const directives = parseUiDirectiveMap(tokens, 2, [], statement, entry, "");
    if (directives.has("group") && !groups.has(directives.get("group"))) {
      pushError(errors, `Projection ${statement.id} navigation screen '${tokens[1]}' references unknown group '${directives.get("group")}'`, entry.loc);
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
function validateProjectionUiScreenRegions(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const regionField = fieldMap.get("screen_regions")?.[0];
  if (!regionField || regionField.value.type !== "block") {
    return;
  }

  const availableScreens = collectAvailableUiScreenIds(statement, fieldMap, registry);
  for (const entry of regionField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [keyword, screenId, regionKeyword, regionName] = tokens;

    if (keyword !== "screen") {
      pushError(errors, `Projection ${statement.id} screen_regions entries must start with 'screen'`, entry.loc);
      continue;
    }
    if (!availableScreens.has(screenId)) {
      pushError(errors, `Projection ${statement.id} screen_regions references unknown screen '${screenId}'`, entry.loc);
    }
    if (regionKeyword !== "region") {
      pushError(errors, `Projection ${statement.id} screen_regions for '${screenId}' must use 'region'`, entry.loc);
    }
    if (!UI_REGION_KINDS.has(regionName || "")) {
      pushError(errors, `Projection ${statement.id} screen_regions for '${screenId}' has invalid region '${regionName}'`, entry.loc);
    }

    const directives = parseUiDirectiveMap(tokens, 4, errors, statement, entry, `screen_regions for '${screenId}'`);
    for (const key of directives.keys()) {
      if (!["pattern", "placement", "title", "state", "variant"].includes(key)) {
        pushError(errors, `Projection ${statement.id} screen_regions for '${screenId}' has unknown directive '${key}'`, entry.loc);
      }
    }
    if (directives.has("pattern") && !UI_PATTERN_KINDS.has(directiveValue(directives, "pattern"))) {
      pushError(errors, `Projection ${statement.id} screen_regions for '${screenId}' has invalid pattern '${directives.get("pattern")}'`, entry.loc);
    }
    if (directives.has("placement") && !["primary", "secondary", "supporting"].includes(directiveValue(directives, "placement"))) {
      pushError(errors, `Projection ${statement.id} screen_regions for '${screenId}' has invalid placement '${directives.get("placement")}'`, entry.loc);
    }
    if (directives.has("state") && !UI_STATE_KINDS.has(directiveValue(directives, "state"))) {
      pushError(errors, `Projection ${statement.id} screen_regions for '${screenId}' has invalid state '${directives.get("state")}'`, entry.loc);
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
function validateProjectionUiComponents(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const componentsField = fieldMap.get("widget_bindings")?.[0];
  if (!componentsField || componentsField.value.type !== "block") {
    return;
  }

  if (symbolValue(getFieldValue(statement, "type")) !== "ui_contract") {
    pushError(errors, `Projection ${statement.id} widget_bindings belongs on shared UI projections; concrete UI projections inherit widget placement through 'realizes'`, componentsField.loc);
  }

  const availableScreens = collectAvailableUiScreenIds(statement, fieldMap, registry);
  const availableRegions = collectAvailableUiRegionKeys(statement, registry);
  const availableRegionPatterns = collectAvailableUiRegionPatterns(statement, registry);

  for (const entry of componentsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [screenKeyword, screenId, regionKeyword, regionName, componentKeyword, componentId] = tokens;

    if (screenKeyword !== "screen") {
      pushError(errors, `Projection ${statement.id} widget_bindings entries must start with 'screen'`, entry.loc);
      continue;
    }
    if (!availableScreens.has(screenId)) {
      pushError(errors, `Projection ${statement.id} widget_bindings references unknown screen '${screenId}'`, entry.loc);
    }
    if (regionKeyword !== "region") {
      pushError(errors, `Projection ${statement.id} widget_bindings for '${screenId}' must use 'region'`, entry.loc);
    }
    if (!UI_REGION_KINDS.has(regionName || "")) {
      pushError(errors, `Projection ${statement.id} widget_bindings for '${screenId}' has invalid region '${regionName}'`, entry.loc);
    } else if (!availableRegions.has(`${screenId}:${regionName}`)) {
      pushError(errors, `Projection ${statement.id} widget_bindings for '${screenId}' references undeclared region '${regionName}'`, entry.loc);
    }
    if (componentKeyword !== "widget") {
      pushError(errors, `Projection ${statement.id} widget_bindings for '${screenId}' must use 'widget'`, entry.loc);
    }

    const widget = registry.get(componentId);
    if (!widget) {
      pushError(errors, `Projection ${statement.id} widget_bindings references missing widget '${componentId}'`, entry.loc);
      continue;
    }
    if (widget.kind !== "widget") {
      pushError(errors, `Projection ${statement.id} widget_bindings must reference a widget, found ${widget.kind} '${widget.id}'`, entry.loc);
      continue;
    }

    const propNames = new Set(blockEntries(getFieldValue(widget, "props"))
      .map((propEntry) => propEntry.items[0])
      .filter((item) => item?.type === "symbol")
      .map((item) => item.value));
    const eventNames = new Set(blockEntries(getFieldValue(widget, "events"))
      .map((eventEntry) => eventEntry.items[0])
      .filter((item) => item?.type === "symbol")
      .map((item) => item.value));
    const componentRegions = symbolValues(getFieldValue(widget, "regions"));
    const componentPatterns = symbolValues(getFieldValue(widget, "patterns"));
    if (componentRegions.length > 0 && !componentRegions.includes(regionName)) {
      pushError(
        errors,
        `Projection ${statement.id} widget_bindings uses widget '${componentId}' in region '${regionName}', but the widget supports regions [${componentRegions.join(", ")}]`,
        entry.loc
      );
    }
    const regionPattern = availableRegionPatterns.get(`${screenId}:${regionName}`) || null;
    if (regionPattern && componentPatterns.length > 0 && !componentPatterns.includes(regionPattern)) {
      pushError(
        errors,
        `Projection ${statement.id} widget_bindings uses widget '${componentId}' in '${screenId}:${regionName}' with pattern '${regionPattern}', but the widget supports patterns [${componentPatterns.join(", ")}]`,
        entry.loc
      );
    }

    for (let i = 6; i < tokens.length;) {
      const directive = tokens[i];
      if (directive === "data") {
        const propName = tokens[i + 1];
        const fromKeyword = tokens[i + 2];
        const sourceId = tokens[i + 3];
        if (!propName || fromKeyword !== "from" || !sourceId) {
          pushError(errors, `Projection ${statement.id} widget_bindings data bindings must use 'data <prop> from <source>'`, entry.loc);
          break;
        }
        if (!propNames.has(propName)) {
          pushError(errors, `Projection ${statement.id} widget_bindings references unknown prop '${propName}' on widget '${componentId}'`, entry.loc);
        }
        const source = registry.get(sourceId);
        if (!source || !["capability", "projection", "shape", "entity"].includes(source.kind)) {
          pushError(errors, `Projection ${statement.id} widget_bindings data binding for '${propName}' references missing source '${sourceId}'`, entry.loc);
        }
        i += 4;
        continue;
      }

      if (directive === "event") {
        const eventName = tokens[i + 1];
        const action = tokens[i + 2];
        const targetId = tokens[i + 3];
        if (!eventName || !action || !targetId) {
          pushError(errors, `Projection ${statement.id} widget_bindings event bindings must use 'event <event> <navigate|action> <target>'`, entry.loc);
          break;
        }
        if (!eventNames.has(eventName)) {
          pushError(errors, `Projection ${statement.id} widget_bindings references unknown event '${eventName}' on widget '${componentId}'`, entry.loc);
        }
        if (action === "navigate") {
          if (!availableScreens.has(targetId)) {
            pushError(errors, `Projection ${statement.id} widget_bindings event '${eventName}' references unknown navigation target '${targetId}'`, entry.loc);
          }
        } else if (action === "action") {
          const target = registry.get(targetId);
          if (!target || target.kind !== "capability") {
            pushError(errors, `Projection ${statement.id} widget_bindings event '${eventName}' references missing capability action '${targetId}'`, entry.loc);
          }
        } else {
          pushError(errors, `Projection ${statement.id} widget_bindings event '${eventName}' has unsupported action '${action}'`, entry.loc);
        }
        i += 4;
        continue;
      }

      pushError(errors, `Projection ${statement.id} widget_bindings has unknown directive '${directive}'`, entry.loc);
      break;
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
function validateProjectionUiVisibility(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const visibilityField = fieldMap.get("visibility_rules")?.[0];
  if (!visibilityField || visibilityField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of visibilityField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [keyword, capabilityId, predicateKeyword, predicateType, predicateValue] = tokens;

    if (keyword !== "action") {
      pushError(errors, `Projection ${statement.id} visibility_rules entries must start with 'action'`, entry.loc);
      continue;
    }

    const capability = registry.get(capabilityId);
    if (!capability) {
      pushError(errors, `Projection ${statement.id} visibility_rules references missing capability '${capabilityId}'`, entry.loc);
    } else if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} visibility_rules must reference a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    } else if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} visibility_rules action '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    if (predicateKeyword !== "visible_if") {
      pushError(errors, `Projection ${statement.id} visibility_rules for '${capabilityId}' must use 'visible_if'`, entry.loc);
    }
    if (!["permission", "ownership", "claim"].includes(predicateType || "")) {
      pushError(errors, `Projection ${statement.id} visibility_rules for '${capabilityId}' has invalid predicate '${predicateType}'`, entry.loc);
    }
    if (!predicateValue) {
      pushError(errors, `Projection ${statement.id} visibility_rules for '${capabilityId}' must include a predicate value`, entry.loc);
    }
    if (predicateType === "ownership" && !["owner", "owner_or_admin", "project_member", "none"].includes(predicateValue || "")) {
      pushError(errors, `Projection ${statement.id} visibility_rules for '${capabilityId}' has invalid ownership '${predicateValue}'`, entry.loc);
    }
    const directiveTokens = blockSymbolItems(entry).map((item) => item.value);
    const directives = new Map();
    for (let i = 5; i < directiveTokens.length; i += 2) {
      const key = directiveTokens[i];
      const value = directiveTokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} visibility_rules for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }
    for (const key of directives.keys()) {
      if (!["claim_value"].includes(key)) {
        pushError(errors, `Projection ${statement.id} visibility_rules for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }
    if (directives.get("claim_value") && predicateType !== "claim") {
      pushError(errors, `Projection ${statement.id} visibility_rules for '${capabilityId}' cannot declare claim_value without claim`, entry.loc);
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
function validateProjectionUiLookups(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const lookupsField = fieldMap.get("field_lookups")?.[0];
  if (!lookupsField || lookupsField.value.type !== "block") {
    return;
  }

  const screens = collectProjectionUiScreens(statement, fieldMap);

  for (const entry of lookupsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [keyword, screenId, fieldKeyword, fieldName, entityKeyword, entityId, labelKeyword, labelField, maybeEmptyKeyword, maybeEmptyLabel] = tokens;

    if (keyword !== "screen") {
      pushError(errors, `Projection ${statement.id} field_lookups entries must start with 'screen'`, entry.loc);
      continue;
    }

    const screenEntry = screens.get(screenId);
    if (!screenEntry) {
      pushError(errors, `Projection ${statement.id} field_lookups references unknown screen '${screenId}'`, entry.loc);
      continue;
    }

    if (fieldKeyword !== "field") {
      pushError(errors, `Projection ${statement.id} field_lookups for '${screenId}' must use 'field'`, entry.loc);
    }
    if (!fieldName) {
      pushError(errors, `Projection ${statement.id} field_lookups for '${screenId}' must include a field name`, entry.loc);
    }

    if (entityKeyword !== "entity") {
      pushError(errors, `Projection ${statement.id} field_lookups for '${screenId}' must use 'entity'`, entry.loc);
    }
    const entity = entityId ? registry.get(entityId) : null;
    if (!entity) {
      pushError(errors, `Projection ${statement.id} field_lookups for '${screenId}' references missing entity '${entityId}'`, entry.loc);
    } else if (entity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} field_lookups for '${screenId}' must reference an entity, found ${entity.kind} '${entity.id}'`, entry.loc);
    }

    if (labelKeyword !== "label_field") {
      pushError(errors, `Projection ${statement.id} field_lookups for '${screenId}' must use 'label_field'`, entry.loc);
    }
    if (!labelField) {
      pushError(errors, `Projection ${statement.id} field_lookups for '${screenId}' must include a label_field`, entry.loc);
    }

    if (maybeEmptyKeyword && maybeEmptyKeyword !== "empty_label") {
      pushError(errors, `Projection ${statement.id} field_lookups for '${screenId}' has unknown directive '${maybeEmptyKeyword}'`, entry.loc);
    }
    if (maybeEmptyKeyword === "empty_label" && !maybeEmptyLabel) {
      pushError(errors, `Projection ${statement.id} field_lookups for '${screenId}' must include a value for 'empty_label'`, entry.loc);
    }

    const availableFields = resolveProjectionUiScreenFieldNames(registry, screenEntry, statement);
    if (fieldName && availableFields.size > 0 && !availableFields.has(fieldName)) {
      pushError(errors, `Projection ${statement.id} field_lookups for '${screenId}' references unknown screen field '${fieldName}'`, entry.loc);
    }

    if (entity?.kind === "entity") {
      const entityFieldNames = new Set(statementFieldNames(entity));
      if (labelField && !entityFieldNames.has(labelField)) {
        pushError(errors, `Projection ${statement.id} field_lookups for '${screenId}' references unknown entity field '${labelField}' on '${entity.id}'`, entry.loc);
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
function validateProjectionUiRoutes(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const routesField = fieldMap.get("screen_routes")?.[0];
  if (!routesField || routesField.value.type !== "block") {
    return;
  }

  const availableScreens = collectAvailableUiScreenIds(statement, fieldMap, registry);
  const seenPaths = new Set();
  const projectionType = symbolValue(getFieldValue(statement, "type"));

  for (const entry of routesField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [keyword, screenId, pathKeyword, routePath] = tokens;

    if (keyword !== "screen") {
      pushError(errors, `Projection ${statement.id} screen_routes entries must start with 'screen'`, entry.loc);
      continue;
    }
    if (!availableScreens.has(screenId)) {
      pushError(errors, `Projection ${statement.id} screen_routes references unknown screen '${screenId}'`, entry.loc);
    }
    if (pathKeyword !== "path") {
      pushError(errors, `Projection ${statement.id} screen_routes for '${screenId}' must use 'path'`, entry.loc);
    }
    if (!routePath) {
      pushError(errors, `Projection ${statement.id} screen_routes for '${screenId}' must include a path`, entry.loc);
      continue;
    }
    if ((projectionType === "web_surface" || projectionType === "ios_surface") && !routePath.startsWith("/")) {
      pushError(errors, `Projection ${statement.id} screen_routes for '${screenId}' must use an absolute path`, entry.loc);
    }
    if (seenPaths.has(routePath)) {
      pushError(errors, `Projection ${statement.id} screen_routes has duplicate path '${routePath}'`, entry.loc);
    }
    seenPaths.add(routePath);
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @param {string} surfaceBlockKey
 * @param {string} expectedProjectionType
 * @returns {void}
 */
function validateProjectionUiSurfaceHints(errors, statement, fieldMap, registry, surfaceBlockKey, expectedProjectionType) {
  if (statement.kind !== "projection") {
    return;
  }

  const surfaceField = fieldMap.get(surfaceBlockKey)?.[0];
  if (!surfaceField || surfaceField.value.type !== "block") {
    return;
  }

  const projectionType = symbolValue(getFieldValue(statement, "type"));
  if (projectionType !== expectedProjectionType) {
    pushError(errors, `Projection ${statement.id} may only use '${surfaceBlockKey}' when projection type is '${expectedProjectionType}'`, surfaceField.loc);
    return;
  }

  const availableScreens = collectAvailableUiScreenIds(statement, fieldMap, registry);
  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of surfaceField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [targetKind, targetId, directive, value] = tokens;

    if (targetKind === "screen") {
      if (!availableScreens.has(targetId)) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} references unknown screen '${targetId}'`, entry.loc);
      }
      if (!["layout", "desktop_variant", "mobile_variant", "present", "shell", "collection", "breadcrumbs", "state_style"].includes(directive || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has unknown directive '${directive}'`, entry.loc);
      }
      if (directive === "desktop_variant" && !UI_COLLECTION_PRESENTATIONS.has(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has invalid desktop_variant '${value}'`, entry.loc);
      }
      if (directive === "mobile_variant" && !UI_COLLECTION_PRESENTATIONS.has(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has invalid mobile_variant '${value}'`, entry.loc);
      }
      if (directive === "collection" && !UI_COLLECTION_PRESENTATIONS.has(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has invalid collection '${value}'`, entry.loc);
      }
      if (directive === "shell" && !["topbar", "sidebar", "dual_nav", "workspace", "wizard", "bottom_tabs", "split_view", "menu_bar"].includes(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has invalid shell '${value}'`, entry.loc);
      }
      if (directive === "present" && !["page", "modal", "drawer", "sheet", "bottom_sheet", "popover"].includes(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has invalid present '${value}'`, entry.loc);
      }
      if (directive === "breadcrumbs" && !["visible", "hidden"].includes(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has invalid breadcrumbs '${value}'`, entry.loc);
      }
      if (directive === "state_style" && !["inline", "panel", "full_page"].includes(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has invalid state_style '${value}'`, entry.loc);
      }
      continue;
    }

    if (targetKind === "action") {
      const capability = registry.get(targetId);
      if (!capability) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} references missing capability '${targetId}'`, entry.loc);
      } else if (capability.kind !== "capability") {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} must reference a capability for action '${targetId}', found ${capability.kind} '${capability.id}'`, entry.loc);
      } else if (!realized.has(targetId)) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} action '${targetId}' must also appear in 'realizes'`, entry.loc);
      }
      if (!["confirm", "present", "placement"].includes(directive || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for action '${targetId}' has unknown directive '${directive}'`, entry.loc);
      }
      if (directive === "confirm" && !["modal", "inline", "sheet", "bottom_sheet", "popover"].includes(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for action '${targetId}' has invalid confirm mode '${value}'`, entry.loc);
      }
      if (directive === "present" && !["button", "menu_item", "split_button", "bulk_action", "drawer", "sheet", "bottom_sheet", "fab", "popover"].includes(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for action '${targetId}' has invalid present mode '${value}'`, entry.loc);
      }
      if (directive === "placement" && !["toolbar", "menu", "bulk", "inline", "footer"].includes(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for action '${targetId}' has invalid placement '${value}'`, entry.loc);
      }
      continue;
    }

    pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} entries must start with 'screen' or 'action'`, entry.loc);
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
function validateProjectionUiWeb(errors, statement, fieldMap, registry) {
  validateProjectionUiSurfaceHints(errors, statement, fieldMap, registry, "web_hints", "web_surface");
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
function validateProjectionUiIos(errors, statement, fieldMap, registry) {
  validateProjectionUiSurfaceHints(errors, statement, fieldMap, registry, "ios_hints", "ios_surface");
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
export function validateUiProjection(errors, statement, fieldMap, registry) {
  validateProjectionUiOwnership(errors, statement, fieldMap);
  validateProjectionUiScreens(errors, statement, fieldMap, registry);
  validateProjectionUiCollections(errors, statement, fieldMap, registry);
  validateProjectionUiActions(errors, statement, fieldMap, registry);
  validateProjectionUiVisibility(errors, statement, fieldMap, registry);
  validateProjectionUiLookups(errors, statement, fieldMap, registry);
  validateProjectionUiRoutes(errors, statement, fieldMap, registry);
  validateProjectionUiAppShell(errors, statement, fieldMap);
  validateProjectionUiDesign(errors, statement, fieldMap);
  validateProjectionUiNavigation(errors, statement, fieldMap, registry);
  validateProjectionUiScreenRegions(errors, statement, fieldMap, registry);
  validateProjectionUiComponents(errors, statement, fieldMap, registry);
  validateProjectionUiWeb(errors, statement, fieldMap, registry);
  validateProjectionUiIos(errors, statement, fieldMap, registry);
}

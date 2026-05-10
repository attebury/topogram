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
  blockSymbolItems,
  getFieldValue,
  pushError,
  symbolValue,
  symbolValues
} from "../utils.js";
import {
  collectAvailableUiScreenIds,
  collectProjectionUiScreens,
  resolveProjectionUiScreenFieldNames,
  SHARED_UI_SEMANTIC_BLOCKS
} from "./ui-helpers.js";
import {
  parseUiDirectiveMap,
  resolveCapabilityContractFields,
  resolveCapabilityOutputShape
} from "./helpers.js";

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {void}
 */
export function validateProjectionUiOwnership(errors, statement, fieldMap) {
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

export function validateProjectionUiScreens(errors, statement, fieldMap, registry) {
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
 * @returns {void}
 */

export function validateProjectionUiAppShell(errors, statement, fieldMap) {
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

export function validateProjectionUiDesign(errors, statement, fieldMap) {
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

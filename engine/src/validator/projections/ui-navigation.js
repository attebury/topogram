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
  directiveValue
} from "./ui-helpers.js";
import { parseUiDirectiveMap } from "./helpers.js";

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
export function validateProjectionUiNavigation(errors, statement, fieldMap, registry) {
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

export function validateProjectionUiScreenRegions(errors, statement, fieldMap, registry) {
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

export function validateProjectionUiRoutes(errors, statement, fieldMap, registry) {
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

export function validateProjectionUiSurfaceHints(errors, statement, fieldMap, registry, surfaceBlockKey, expectedProjectionType) {
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

export function validateProjectionUiWeb(errors, statement, fieldMap, registry) {
  validateProjectionUiSurfaceHints(errors, statement, fieldMap, registry, "web_hints", "web_surface");
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */

export function validateProjectionUiIos(errors, statement, fieldMap, registry) {
  validateProjectionUiSurfaceHints(errors, statement, fieldMap, registry, "ios_hints", "ios_surface");
}

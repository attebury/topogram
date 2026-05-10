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
  collectAvailableUiRegionKeys,
  collectAvailableUiRegionPatterns,
  collectAvailableUiScreenIds,
  collectProjectionUiScreens,
  resolveProjectionUiScreenFieldNames
} from "./ui-helpers.js";
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
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
export function validateProjectionUiCollections(errors, statement, fieldMap, registry) {
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

export function validateProjectionUiActions(errors, statement, fieldMap, registry) {
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
 * @param {TopogramRegistry} registry
 * @returns {void}
 */

export function validateProjectionUiComponents(errors, statement, fieldMap, registry) {
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

export function validateProjectionUiVisibility(errors, statement, fieldMap, registry) {
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

export function validateProjectionUiLookups(errors, statement, fieldMap, registry) {
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

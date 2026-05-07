import {
  UI_PATTERN_KINDS,
  UI_REGION_KINDS
} from "../kinds.js";
import {
  blockEntries,
  getFieldValue,
  pushError,
  symbolValues
} from "../utils.js";

const WIDGET_CATEGORIES = new Set([
  "collection",
  "form",
  "display",
  "navigation",
  "dialog",
  "feedback",
  "lookup",
  "layout",
  "service"
]);

const WIDGET_BEHAVIOR_KINDS = new Set([
  "selection",
  "sorting",
  "filtering",
  "search",
  "pagination",
  "grouping",
  "drag_drop",
  "inline_edit",
  "bulk_action",
  "optimistic_update",
  "realtime_update",
  "keyboard_navigation"
]);

const WIDGET_BEHAVIOR_DIRECTIVES = {
  selection: new Set(["mode", "state", "emits"]),
  sorting: new Set(["fields", "default"]),
  filtering: new Set(["fields"]),
  search: new Set(["fields"]),
  pagination: new Set(["mode", "page_size"]),
  grouping: new Set(["fields"]),
  drag_drop: new Set(["axis", "reorder"]),
  inline_edit: new Set(["fields", "submit", "emits"]),
  bulk_action: new Set(["actions", "state", "emits"]),
  optimistic_update: new Set(["actions", "rollback"]),
  realtime_update: new Set(["source", "merge"]),
  keyboard_navigation: new Set(["scope", "shortcuts"])
};

function tokenValue(token) {
  return token?.value ?? null;
}

function tokenValues(token) {
  if (!token) {
    return [];
  }
  if (token.type === "list") {
    return token.items.map((item) => item.value).filter((value) => value != null);
  }
  const value = tokenValue(token);
  return value == null ? [] : [value];
}

function widgetPropNames(statement) {
  return new Set(blockEntries(getFieldValue(statement, "props"))
    .map((entry) => entry.items[0])
    .filter((item) => item?.type === "symbol")
    .map((item) => item.value));
}

function widgetEventNames(statement) {
  return new Set(blockEntries(getFieldValue(statement, "events"))
    .map((entry) => entry.items[0])
    .filter((item) => item?.type === "symbol")
    .map((item) => item.value));
}

function validateWidgetCategory(errors, statement, fieldMap) {
  const field = fieldMap.get("category")?.[0];
  if (!field) {
    return;
  }

  if (field.value.type !== "symbol") {
    pushError(errors, `Field 'category' on widget ${statement.id} must be a symbol`, field.loc);
    return;
  }

  if (!WIDGET_CATEGORIES.has(field.value.value)) {
    pushError(errors, `Invalid widget category '${field.value.value}' on widget ${statement.id}`, field.loc);
  }
}

function validateWidgetProps(errors, statement) {
  for (const entry of blockEntries(getFieldValue(statement, "props"))) {
    const [name, type, requiredness, ...rest] = entry.items;
    if (!name || !type || !requiredness) {
      pushError(errors, `Widget ${statement.id} props entries must be '<name> <type> <required|optional> [default <value>]'`, entry.loc);
      continue;
    }

    if (name.type !== "symbol" || type.type !== "symbol" || requiredness.type !== "symbol") {
      pushError(errors, `Widget ${statement.id} props entries must start with symbols`, entry.loc);
      continue;
    }

    if (requiredness.value !== "required" && requiredness.value !== "optional") {
      pushError(errors, `Widget ${statement.id} prop '${name.value}' must use required or optional`, requiredness.loc);
    }

    for (let i = 0; i < rest.length; i += 1) {
      const token = rest[i];
      if (token.type === "symbol" && token.value === "default") {
        if (!rest[i + 1]) {
          pushError(errors, `Widget ${statement.id} prop '${name.value}' default is missing a value`, token.loc);
        }
        i += 1;
        continue;
      }
      pushError(errors, `Widget ${statement.id} prop '${name.value}' has unsupported directive '${token.value}'`, token.loc);
    }
  }
}

function validateWidgetEvents(errors, statement, registry) {
  for (const entry of blockEntries(getFieldValue(statement, "events"))) {
    const [eventName, shapeRef] = entry.items;
    if (!eventName || !shapeRef) {
      pushError(errors, `Widget ${statement.id} events entries must be '<event_name> <shape_id>'`, entry.loc);
      continue;
    }

    if (eventName.type !== "symbol" || shapeRef.type !== "symbol") {
      pushError(errors, `Widget ${statement.id} events entries must use symbols`, entry.loc);
      continue;
    }

    const target = registry.get(shapeRef.value);
    if (!target) {
      pushError(errors, `Widget ${statement.id} event '${eventName.value}' references missing shape '${shapeRef.value}'`, shapeRef.loc);
      continue;
    }
    if (target.kind !== "shape") {
      pushError(errors, `Widget ${statement.id} event '${eventName.value}' must reference a shape, found ${target.kind} '${target.id}'`, shapeRef.loc);
    }
  }
}

function validateWidgetSlots(errors, statement) {
  for (const entry of blockEntries(getFieldValue(statement, "slots"))) {
    const [slotName, description] = entry.items;
    if (!slotName || !description) {
      pushError(errors, `Widget ${statement.id} slots entries must be '<slot_name> <description>'`, entry.loc);
      continue;
    }

    if (slotName.type !== "symbol" || (description.type !== "string" && description.type !== "symbol")) {
      pushError(errors, `Widget ${statement.id} slots entries must use a symbol name and string or symbol description`, entry.loc);
    }
  }
}

function validateSymbolList(errors, statement, fieldMap, key, allowed, label) {
  const field = fieldMap.get(key)?.[0];
  if (!field) {
    return;
  }

  for (const value of symbolValues(field.value)) {
    if (!allowed.has(value)) {
      pushError(errors, `Widget ${statement.id} ${label} '${value}' is not supported`, field.loc);
    }
  }
}

function validateBehaviorActionReferences(errors, statement, registry, kind, directive, valueToken, eventNames) {
  for (const actionId of tokenValues(valueToken)) {
    if (eventNames.has(actionId)) {
      continue;
    }
    const target = registry.get(actionId);
    if (target?.kind === "capability") {
      continue;
    }
    pushError(
      errors,
      `Widget ${statement.id} behavior '${kind}' references unknown event or capability '${actionId}' for '${directive}'`,
      valueToken.loc
    );
  }
}

function validateWidgetBehaviors(errors, statement, fieldMap, registry) {
  validateSymbolList(errors, statement, fieldMap, "behavior", WIDGET_BEHAVIOR_KINDS, "behavior");

  const field = fieldMap.get("behaviors")?.[0];
  if (!field || field.value.type !== "block") {
    return;
  }

  const propNames = widgetPropNames(statement);
  const eventNames = widgetEventNames(statement);

  for (const entry of field.value.entries) {
    const [kindToken, ...rest] = entry.items;
    const kind = tokenValue(kindToken);
    if (!kind || kindToken.type !== "symbol") {
      pushError(errors, `Widget ${statement.id} behaviors entries must start with a behavior kind`, entry.loc);
      continue;
    }
    if (!WIDGET_BEHAVIOR_KINDS.has(kind)) {
      pushError(errors, `Widget ${statement.id} behavior '${kind}' is not supported`, entry.loc);
      continue;
    }

    const allowedDirectives = WIDGET_BEHAVIOR_DIRECTIVES[kind] || new Set();
    for (let i = 0; i < rest.length; i += 2) {
      const directiveToken = rest[i];
      const valueToken = rest[i + 1];
      const directive = tokenValue(directiveToken);
      if (!directive || directiveToken.type !== "symbol") {
        pushError(errors, `Widget ${statement.id} behavior '${kind}' directives must use symbol keys`, entry.loc);
        continue;
      }
      if (!valueToken) {
        pushError(errors, `Widget ${statement.id} behavior '${kind}' is missing a value for '${directive}'`, directiveToken.loc);
        continue;
      }
      if (!allowedDirectives.has(directive)) {
        pushError(errors, `Widget ${statement.id} behavior '${kind}' has unsupported directive '${directive}'`, directiveToken.loc);
        continue;
      }

      if (directive === "state" && !propNames.has(tokenValue(valueToken))) {
        pushError(errors, `Widget ${statement.id} behavior '${kind}' references unknown prop '${tokenValue(valueToken)}' for '${directive}'`, valueToken.loc);
      }
      if (directive === "emits") {
        for (const eventName of tokenValues(valueToken)) {
          if (!eventNames.has(eventName)) {
            pushError(errors, `Widget ${statement.id} behavior '${kind}' references unknown event '${eventName}' for '${directive}'`, valueToken.loc);
          }
        }
      }
      if (directive === "actions" || directive === "submit") {
        validateBehaviorActionReferences(errors, statement, registry, kind, directive, valueToken, eventNames);
      }
      if (kind === "selection" && directive === "mode" && !["single", "multi", "none"].includes(tokenValue(valueToken))) {
        pushError(errors, `Widget ${statement.id} behavior 'selection' has invalid mode '${tokenValue(valueToken)}'`, valueToken.loc);
      }
      if (kind === "pagination" && directive === "mode" && !["cursor", "paged", "infinite", "none"].includes(tokenValue(valueToken))) {
        pushError(errors, `Widget ${statement.id} behavior 'pagination' has invalid mode '${tokenValue(valueToken)}'`, valueToken.loc);
      }
    }
  }
}

export function validateWidget(errors, statement, fieldMap, registry) {
  if (statement.kind !== "widget") {
    return;
  }

  validateWidgetCategory(errors, statement, fieldMap);
  validateWidgetProps(errors, statement);
  validateWidgetEvents(errors, statement, registry);
  validateWidgetSlots(errors, statement);
  validateWidgetBehaviors(errors, statement, fieldMap, registry);
  validateSymbolList(errors, statement, fieldMap, "patterns", UI_PATTERN_KINDS, "pattern");
  validateSymbolList(errors, statement, fieldMap, "regions", UI_REGION_KINDS, "region");
}

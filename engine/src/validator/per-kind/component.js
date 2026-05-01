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

const COMPONENT_CATEGORIES = new Set([
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

function validateComponentCategory(errors, statement, fieldMap) {
  const field = fieldMap.get("category")?.[0];
  if (!field) {
    return;
  }

  if (field.value.type !== "symbol") {
    pushError(errors, `Field 'category' on component ${statement.id} must be a symbol`, field.loc);
    return;
  }

  if (!COMPONENT_CATEGORIES.has(field.value.value)) {
    pushError(errors, `Invalid component category '${field.value.value}' on component ${statement.id}`, field.loc);
  }
}

function validateComponentProps(errors, statement) {
  for (const entry of blockEntries(getFieldValue(statement, "props"))) {
    const [name, type, requiredness, ...rest] = entry.items;
    if (!name || !type || !requiredness) {
      pushError(errors, `Component ${statement.id} props entries must be '<name> <type> <required|optional> [default <value>]'`, entry.loc);
      continue;
    }

    if (name.type !== "symbol" || type.type !== "symbol" || requiredness.type !== "symbol") {
      pushError(errors, `Component ${statement.id} props entries must start with symbols`, entry.loc);
      continue;
    }

    if (requiredness.value !== "required" && requiredness.value !== "optional") {
      pushError(errors, `Component ${statement.id} prop '${name.value}' must use required or optional`, requiredness.loc);
    }

    for (let i = 0; i < rest.length; i += 1) {
      const token = rest[i];
      if (token.type === "symbol" && token.value === "default") {
        if (!rest[i + 1]) {
          pushError(errors, `Component ${statement.id} prop '${name.value}' default is missing a value`, token.loc);
        }
        i += 1;
        continue;
      }
      pushError(errors, `Component ${statement.id} prop '${name.value}' has unsupported directive '${token.value}'`, token.loc);
    }
  }
}

function validateComponentEvents(errors, statement, registry) {
  for (const entry of blockEntries(getFieldValue(statement, "events"))) {
    const [eventName, shapeRef] = entry.items;
    if (!eventName || !shapeRef) {
      pushError(errors, `Component ${statement.id} events entries must be '<event_name> <shape_id>'`, entry.loc);
      continue;
    }

    if (eventName.type !== "symbol" || shapeRef.type !== "symbol") {
      pushError(errors, `Component ${statement.id} events entries must use symbols`, entry.loc);
      continue;
    }

    const target = registry.get(shapeRef.value);
    if (!target) {
      pushError(errors, `Component ${statement.id} event '${eventName.value}' references missing shape '${shapeRef.value}'`, shapeRef.loc);
      continue;
    }
    if (target.kind !== "shape") {
      pushError(errors, `Component ${statement.id} event '${eventName.value}' must reference a shape, found ${target.kind} '${target.id}'`, shapeRef.loc);
    }
  }
}

function validateComponentSlots(errors, statement) {
  for (const entry of blockEntries(getFieldValue(statement, "slots"))) {
    const [slotName, description] = entry.items;
    if (!slotName || !description) {
      pushError(errors, `Component ${statement.id} slots entries must be '<slot_name> <description>'`, entry.loc);
      continue;
    }

    if (slotName.type !== "symbol" || (description.type !== "string" && description.type !== "symbol")) {
      pushError(errors, `Component ${statement.id} slots entries must use a symbol name and string or symbol description`, entry.loc);
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
      pushError(errors, `Component ${statement.id} ${label} '${value}' is not supported`, field.loc);
    }
  }
}

export function validateComponent(errors, statement, fieldMap, registry) {
  if (statement.kind !== "component") {
    return;
  }

  validateComponentCategory(errors, statement, fieldMap);
  validateComponentProps(errors, statement);
  validateComponentEvents(errors, statement, registry);
  validateComponentSlots(errors, statement);
  validateSymbolList(errors, statement, fieldMap, "patterns", UI_PATTERN_KINDS, "pattern");
  validateSymbolList(errors, statement, fieldMap, "regions", UI_REGION_KINDS, "region");
}

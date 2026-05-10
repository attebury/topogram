import { blockEntries, getFieldValue, symbolValues } from "../validator.js";
import { normalizeSequence, parseDefaultLiteral, parseReferenceNodes, tokenValue } from "./shared.js";

export function normalizeWidgetProps(statement) {
  return blockEntries(getFieldValue(statement, "props")).map((entry) => {
    const [name, type, requiredness, ...rest] = entry.items;
    let defaultValue = null;

    for (let i = 0; i < rest.length - 1; i += 1) {
      if (rest[i].type === "symbol" && rest[i].value === "default") {
        defaultValue = parseDefaultLiteral(rest[i + 1]);
      }
    }

    return {
      name: name?.value ?? null,
      fieldType: type?.value ?? null,
      requiredness: requiredness?.value ?? null,
      defaultValue,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

export function normalizeWidgetEvents(statement, registry) {
  return blockEntries(getFieldValue(statement, "events")).map((entry) => {
    const [eventName, shapeRef] = entry.items;
    const shapeId = tokenValue(shapeRef);
    return {
      id: tokenValue(eventName),
      shape: shapeId
        ? {
            id: shapeId,
            kind: registry.get(shapeId)?.kind || null
          }
        : null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

export function normalizeWidgetSlots(statement) {
  return blockEntries(getFieldValue(statement, "slots")).map((entry) => ({
    id: tokenValue(entry.items[0]),
    description: tokenValue(entry.items[1]),
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

export function normalizeBehaviorValue(token) {
  if (!token) {
    return null;
  }
  if (token.type === "list") {
    return token.items.map((item) => normalizeBehaviorValue(item));
  }
  return parseDefaultLiteral(token);
}

export function normalizeWidgetBehaviors(statement) {
  const structured = blockEntries(getFieldValue(statement, "behaviors")).map((entry) => {
    const kind = tokenValue(entry.items[0]);
    const directives = {};
    for (let i = 1; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      if (!key) {
        continue;
      }
      directives[key] = normalizeBehaviorValue(entry.items[i + 1]);
    }
    return {
      kind,
      directives,
      source: "structured",
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });

  const structuredKinds = new Set(structured.map((entry) => entry.kind));
  const shorthand = symbolValues(getFieldValue(statement, "behavior"))
    .filter((kind) => !structuredKinds.has(kind))
    .map((kind) => ({
      kind,
      directives: {},
      source: "shorthand",
      raw: [kind],
      loc: null
    }));

  return [...structured, ...shorthand];
}

export function buildWidgetContract(statement) {
  return {
    type: "ui_widget_contract",
    id: statement.id,
    name: statement.name || statement.id,
    description: statement.description || null,
    category: statement.category || null,
    version: statement.version || null,
    status: statement.status || null,
    props: (statement.props || []).map((prop) => ({
      name: prop.name,
      type: prop.fieldType,
      requiredness: prop.requiredness,
      defaultValue: prop.defaultValue ?? null
    })),
    events: (statement.events || []).map((event) => ({
      id: event.id,
      shape: event.shape || null
    })),
    slots: (statement.slots || []).map((slot) => ({
      id: slot.id,
      description: slot.description || null
    })),
    behavior: [...(statement.behavior || [])],
    behaviors: (statement.behaviors || []).map((behavior) => ({
      kind: behavior.kind,
      directives: { ...(behavior.directives || {}) },
      source: behavior.source || null
    })),
    patterns: [...(statement.patterns || [])],
    regions: [...(statement.regions || [])],
    approvals: [...(statement.approvals || [])],
    lookups: parseReferenceNodes(statement.lookups || []),
    dependencies: parseReferenceNodes(statement.dependencies || [])
  };
}

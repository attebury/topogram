import {
  blockEntries,
  buildRegistry,
  collectFieldMap,
  getFieldValue,
  stringValue,
  symbolValue,
  symbolValues,
  validateWorkspace,
  valueAsArray
} from "../validator.js";
import { enrichPitch } from "./enrich/pitch.js";
import { enrichRequirement } from "./enrich/requirement.js";
import { enrichAcceptanceCriterion } from "./enrich/acceptance-criterion.js";
import { enrichTask } from "./enrich/task.js";
import { enrichBug } from "./enrich/bug.js";
import { loadArchive, mergeArchivedIntoGraph } from "../archive/resolver-bridge.js";

function groupBy(items, keyFn) {
  const grouped = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!Object.hasOwn(grouped, key)) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  }
  return grouped;
}

function resolveReference(registry, id) {
  return registry.get(id) || null;
}

function toRef(target) {
  if (!target) {
    return null;
  }

  return {
    id: target.id,
    kind: target.kind
  };
}

function resolveReferenceList(registry, value) {
  return symbolValues(value).map((id) => ({
    id,
    target: toRef(resolveReference(registry, id))
  }));
}

function resolveDomainTag(statement, registry) {
  const domainField = statement.fields.find((field) => field.key === "domain");
  if (!domainField || domainField.value.type !== "symbol") {
    return null;
  }
  const id = domainField.value.value;
  return {
    id,
    target: toRef(resolveReference(registry, id))
  };
}

function normalizeDomainScopeList(statement, key) {
  const field = statement.fields.find((f) => f.key === key);
  if (!field) return [];
  const items = field.value.type === "list" || field.value.type === "sequence"
    ? field.value.items
    : [field.value];
  return items
    .map((item) => (item.type === "string" || item.type === "symbol" ? item.value : null))
    .filter((value) => value !== null);
}

function normalizeSequence(items) {
  return items.map((item) => {
    if (item.type === "symbol" || item.type === "string") {
      return item.value;
    }
    if (item.type === "list") {
      return item.items.map((nested) => nested.value);
    }
    return item.type;
  });
}

function normalizeFieldsBlock(statement, key = "fields") {
  return blockEntries(getFieldValue(statement, key)).map((entry) => {
    const [name, type, requiredness, ...rest] = entry.items;
    let defaultValue = null;

    for (let i = 0; i < rest.length - 1; i += 1) {
      if (rest[i].type === "symbol" && rest[i].value === "default") {
        defaultValue = rest[i + 1]?.value ?? null;
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

function parseDefaultLiteral(token) {
  if (!token) return null;
  if (token.type === "list") {
    return (token.items || []).map((item) => parseDefaultLiteral(item));
  }
  if (token.type === "string") {
    return token.value ?? null;
  }
  if (token.type === "symbol") {
    if (token.value === "true") return true;
    if (token.value === "false") return false;
    if (token.value === "null") return null;
    if (/^-?\d+$/.test(token.value)) return Number.parseInt(token.value, 10);
    if (/^-?\d+\.\d+$/.test(token.value)) return Number.parseFloat(token.value);
    return token.value;
  }
  return token.value ?? null;
}

function normalizeComponentProps(statement) {
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

function normalizeComponentEvents(statement, registry) {
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

function normalizeComponentSlots(statement) {
  return blockEntries(getFieldValue(statement, "slots")).map((entry) => ({
    id: tokenValue(entry.items[0]),
    description: tokenValue(entry.items[1]),
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function normalizeBehaviorValue(token) {
  if (!token) {
    return null;
  }
  if (token.type === "list") {
    return token.items.map((item) => normalizeBehaviorValue(item));
  }
  return parseDefaultLiteral(token);
}

function normalizeComponentBehaviors(statement) {
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

function normalizeGenericBlock(statement, key) {
  return blockEntries(getFieldValue(statement, key)).map((entry) => ({
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function tokenValue(token) {
  return token?.value ?? null;
}

function parseLiteralToken(token) {
  const value = tokenValue(token);
  if (value == null) {
    return null;
  }

  if (value === "true") {
    return { kind: "boolean", value: true };
  }
  if (value === "false") {
    return { kind: "boolean", value: false };
  }
  if (value === "null") {
    return { kind: "null", value: null };
  }
  if (/^-?\d+$/.test(value)) {
    return { kind: "integer", value: Number.parseInt(value, 10) };
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return { kind: "number", value: Number.parseFloat(value) };
  }

  return { kind: "symbol", value };
}

function parseComparison(left, operator, right) {
  if (!left || !operator || !right) {
    return null;
  }

  return {
    type: "comparison",
    left: tokenValue(left),
    operator,
    right: parseLiteralToken(right)
  };
}

function parseInvariantEntry(entry) {
  const tokens = entry.items;
  const values = tokens.map((item) => item.value);
  const [a, b, c, d, e, f, g] = tokens;

  if (tokenValue(b) === "requires") {
    return {
      type: "requires",
      field: tokenValue(a),
      predicate: parseComparison(c, tokenValue(d), e),
      raw: values,
      loc: entry.loc
    };
  }

  if (tokenValue(b) === "length") {
    return {
      type: "length_check",
      field: tokenValue(a),
      operator: tokenValue(c),
      value: parseLiteralToken(d),
      raw: values,
      loc: entry.loc
    };
  }

  if (tokenValue(b) === "format") {
    return {
      type: "format_check",
      field: tokenValue(a),
      operator: tokenValue(c),
      format: tokenValue(d),
      raw: values,
      loc: entry.loc
    };
  }

  if (tokenValue(d) === "implies") {
    return {
      type: "implication",
      when: parseComparison(a, tokenValue(b), c),
      then:
        tokenValue(f) === "is"
          ? {
              type: "state_check",
              field: tokenValue(e),
              operator: "is",
              value: parseLiteralToken(g)
            }
          : parseComparison(e, tokenValue(f), g),
      raw: values,
      loc: entry.loc
    };
  }

  if (["==", "!=", "<", "<=", ">", ">="].includes(tokenValue(b))) {
    return {
      type: "comparison",
      left: tokenValue(a),
      operator: tokenValue(b),
      right: parseLiteralToken(c),
      raw: values,
      loc: entry.loc
    };
  }

  return {
    type: "unknown",
    raw: values,
    loc: entry.loc
  };
}

function parseRuleExpression(value) {
  const text = valueAsArray(value).map((item) => item.value).join(" ").trim();
  const match = text.match(/^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/);
  if (!match) {
    return {
      type: "unknown",
      raw: text
    };
  }

  return {
    type: "comparison",
    left: match[1].trim(),
    operator: match[2],
    right: {
      kind: "symbol",
      value: match[3].trim()
    },
    raw: text
  };
}

function parseSymbolNode(value) {
  return {
    type: "symbol",
    id: value
  };
}

function parseSymbolNodes(values) {
  return values.map((value, index) => ({
    ...parseSymbolNode(value),
    order: index
  }));
}

function parseReferenceNodes(values) {
  return values.map((entry, index) => ({
    type: "reference",
    id: entry.id,
    target: entry.target || { id: entry.id, kind: null },
    order: index
  }));
}

function buildComponentContract(statement) {
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

function buildCapabilityFlow(statement) {
  const effects = [];

  for (const [kind, refs] of [
    ["read", statement.reads],
    ["create", statement.creates],
    ["update", statement.updates],
    ["delete", statement.deletes]
  ]) {
    for (const ref of refs) {
      effects.push({
        type: "effect",
        action: kind,
        target: ref.target || { id: ref.id, kind: null }
      });
    }
  }

  return {
    type: "capability_flow",
    actors: parseReferenceNodes(statement.actors),
    roles: parseReferenceNodes(statement.roles),
    effects,
    contracts: {
      input: statement.input.map((ref) => ref.target || { id: ref.id, kind: null }),
      output: statement.output.map((ref) => ref.target || { id: ref.id, kind: null })
    }
  };
}

function buildRulePolicy(statement) {
  return {
    type: "policy",
    appliesTo: statement.appliesTo.map((ref) => ref.target || { id: ref.id, kind: null }),
    actors: statement.actors.map((ref) => ref.target || { id: ref.id, kind: null }),
    roles: statement.roles.map((ref) => ref.target || { id: ref.id, kind: null }),
    condition: statement.conditionNode,
    requirement: statement.requirementNode,
    severity: statement.severity,
    sourceOfTruth: statement.sourceOfTruth.map((ref) => ref.target || { id: ref.id, kind: null })
  };
}

function buildDecisionRecord(statement) {
  return {
    type: "decision_record",
    context: parseSymbolNodes(statement.context),
    consequences: parseSymbolNodes(statement.consequences),
    status: statement.status
  };
}

function buildProjectionPlan(statement) {
  return {
    type: "projection_plan",
    projectionType: statement.type,
    realizes: statement.realizes.map((ref, index) => ({
      order: index,
      target: ref.target || { id: ref.id, kind: null }
    })),
    outputs: parseSymbolNodes(statement.outputs),
    endpoints: statement.http,
    errorResponses: statement.httpErrors,
    wireFields: statement.httpFields,
    responses: statement.httpResponses,
    preconditions: statement.httpPreconditions,
    idempotency: statement.httpIdempotency,
    cache: statement.httpCache,
    deleteSemantics: statement.httpDelete,
    asyncJobs: statement.httpAsync,
    asyncStatus: statement.httpStatus,
    downloads: statement.httpDownload,
    authorization: statement.httpAuthz,
    callbacks: statement.httpCallbacks,
    screens: statement.uiScreens,
    collectionViews: statement.uiCollections,
    screenActions: statement.uiActions,
    visibilityRules: statement.uiVisibility,
    fieldLookups: statement.uiLookups,
    screenRoutes: statement.uiRoutes,
    webHints: statement.uiWeb,
    iosHints: statement.uiIos,
    appShell: statement.uiAppShell,
    designTokens: statement.uiDesign,
    navigation: statement.uiNavigation,
    screenRegions: statement.uiScreenRegions,
    widgetBindings: statement.uiComponents,
    tables: statement.dbTables,
    columns: statement.dbColumns,
    keys: statement.dbKeys,
    indexes: statement.dbIndexes,
    relations: statement.dbRelations,
    lifecycle: statement.dbLifecycle,
    http: statement.http,
    httpErrors: statement.httpErrors,
    httpFields: statement.httpFields,
    httpResponses: statement.httpResponses,
    httpPreconditions: statement.httpPreconditions,
    httpIdempotency: statement.httpIdempotency,
    httpCache: statement.httpCache,
    httpDelete: statement.httpDelete,
    httpAsync: statement.httpAsync,
    httpStatus: statement.httpStatus,
    httpDownload: statement.httpDownload,
    httpAuthz: statement.httpAuthz,
    httpCallbacks: statement.httpCallbacks,
    uiScreens: statement.uiScreens,
    uiCollections: statement.uiCollections,
    uiActions: statement.uiActions,
    uiVisibility: statement.uiVisibility,
    uiRoutes: statement.uiRoutes,
    uiWeb: statement.uiWeb,
    uiDesign: statement.uiDesign,
    uiComponents: statement.uiComponents,
    dbTables: statement.dbTables,
    dbColumns: statement.dbColumns,
    dbKeys: statement.dbKeys,
    dbIndexes: statement.dbIndexes,
    dbRelations: statement.dbRelations,
    dbLifecycle: statement.dbLifecycle,
    generatorDefaults: statement.generatorDefaults
  };
}

function buildVerificationPlan(statement) {
  return {
    type: "verification_plan",
    method: statement.method,
    validates: statement.validates.map((ref, index) => ({
      order: index,
      target: ref.target || { id: ref.id, kind: null }
    })),
    scenarios: parseSymbolNodes(statement.scenarios)
  };
}

function buildOperationMonitoring(statement) {
  return {
    type: "operation_monitoring",
    observes: statement.observes.map((ref, index) => ({
      order: index,
      target: ref.target || { id: ref.id, kind: null }
    })),
    metrics: parseSymbolNodes(statement.metrics),
    alerts: parseSymbolNodes(statement.alerts)
  };
}

function buildOrchestrationPlan(statement) {
  return {
    type: "orchestration_plan",
    inputs: statement.inputs.map((ref, index) => ({
      order: index,
      target: ref.target || { id: ref.id, kind: null }
    })),
    steps: parseSymbolNodes(statement.steps),
    outputs: parseSymbolNodes(statement.outputs)
  };
}

function buildTermVocabulary(statement) {
  return {
    type: "term_vocabulary",
    aliases: parseSymbolNodes(statement.aliases),
    excludes: parseSymbolNodes(statement.excludes)
  };
}

function parseKeyBlock(statement) {
  return blockEntries(getFieldValue(statement, "keys")).map((entry) => ({
    type: tokenValue(entry.items[0]),
    fields:
      entry.items[1]?.type === "list"
        ? entry.items[1].items.map((item) => item.value)
        : [],
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseRelationBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "relations")).map((entry) => {
    const sourceField = tokenValue(entry.items[0]);
    const targetRef = tokenValue(entry.items[2]);
    const [entityId, fieldName] = (targetRef || "").split(".");
    const targetStatement = entityId ? registry.get(entityId) : null;

    return {
      type: "reference",
      sourceField,
      target: entityId
        ? {
            id: entityId,
            kind: targetStatement?.kind || null,
            field: fieldName || null
          }
        : null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseInvariantBlock(statement) {
  return blockEntries(getFieldValue(statement, "invariants")).map((entry) => parseInvariantEntry(entry));
}

function parseRenameBlock(statement) {
  return blockEntries(getFieldValue(statement, "rename")).map((entry) => ({
    from: entry.items[0]?.value ?? null,
    to: entry.items[1]?.value ?? null,
    loc: entry.loc
  }));
}

function parseOverridesBlock(statement) {
  return blockEntries(getFieldValue(statement, "overrides")).map((entry) => {
    const [fieldName, ...rest] = entry.items;
    const override = {
      field: fieldName?.value ?? null,
      requiredness: null,
      fieldType: null,
      defaultValue: undefined,
      loc: entry.loc
    };

    for (let i = 0; i < rest.length; i += 1) {
      const token = rest[i];
      if (!token || token.type !== "symbol") {
        continue;
      }

      if (token.value === "required" || token.value === "optional") {
        override.requiredness = token.value;
        continue;
      }

      if (token.value === "type") {
        override.fieldType = rest[i + 1]?.value ?? null;
        i += 1;
        continue;
      }

      if (token.value === "default") {
        override.defaultValue = rest[i + 1]?.value ?? null;
        i += 1;
      }
    }

    return override;
  });
}

function parseProjectionHttpBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "endpoints")).map((entry) => {
    const capabilityId = tokenValue(entry.items[0]);
    const directives = {};

    for (let i = 1; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "http_realization",
      capability: capabilityId
        ? {
            id: capabilityId,
            kind: registry.get(capabilityId)?.kind || null
          }
        : null,
      method: directives.method || null,
      path: directives.path || null,
      success: directives.success ? Number.parseInt(directives.success, 10) : null,
      auth: directives.auth || null,
      request: directives.request || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionHttpErrorsBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "error_responses")).map((entry) => ({
    type: "http_error_mapping",
    capability: tokenValue(entry.items[0])
      ? {
          id: tokenValue(entry.items[0]),
          kind: registry.get(tokenValue(entry.items[0]))?.kind || null
        }
      : null,
    code: tokenValue(entry.items[1]),
    status: tokenValue(entry.items[2]) ? Number.parseInt(tokenValue(entry.items[2]), 10) : null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionHttpFieldsBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "wire_fields")).map((entry) => ({
    type: "http_field_binding",
    capability: tokenValue(entry.items[0])
      ? {
          id: tokenValue(entry.items[0]),
          kind: registry.get(tokenValue(entry.items[0]))?.kind || null
        }
      : null,
    direction: tokenValue(entry.items[1]),
    field: tokenValue(entry.items[2]),
    location: tokenValue(entry.items[4]),
    wireName: tokenValue(entry.items[5]) === "as" ? tokenValue(entry.items[6]) : null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionHttpResponsesBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "responses")).map((entry) => {
    const capabilityId = tokenValue(entry.items[0]);
    const directives = parseProjectionHttpResponseDirectives(entry.items.slice(1));

    return {
      type: "http_response_realization",
      capability: capabilityId
        ? {
            id: capabilityId,
            kind: registry.get(capabilityId)?.kind || null
          }
        : null,
      mode: directives.mode || null,
      item: directives.item
        ? {
            id: directives.item,
            kind: registry.get(directives.item)?.kind || null
          }
        : null,
      cursor: directives.cursor || null,
      limit: directives.limit
        ? {
            field: directives.limit.field,
            defaultValue: directives.limit.defaultValue ? Number.parseInt(directives.limit.defaultValue, 10) : null,
            maxValue: directives.limit.maxValue ? Number.parseInt(directives.limit.maxValue, 10) : null
          }
        : null,
      sort: directives.sort
        ? {
            field: directives.sort.field,
            direction: directives.sort.direction
          }
        : null,
      total: directives.total
        ? {
            included: directives.total.included === "true"
          }
        : null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionHttpPreconditionsBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "preconditions")).map((entry) => {
    const capabilityId = tokenValue(entry.items[0]);
    const directives = {};

    for (let i = 1; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "http_precondition",
      capability: capabilityId
        ? {
            id: capabilityId,
            kind: registry.get(capabilityId)?.kind || null
          }
        : null,
      header: directives.header || null,
      required: directives.required === "true",
      error: directives.error ? Number.parseInt(directives.error, 10) : null,
      source: directives.source || null,
      code: directives.code || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionHttpIdempotencyBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "idempotency")).map((entry) => {
    const capabilityId = tokenValue(entry.items[0]);
    const directives = {};

    for (let i = 1; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "idempotency",
      capability: capabilityId
        ? {
            id: capabilityId,
            kind: registry.get(capabilityId)?.kind || null
          }
        : null,
      header: directives.header || null,
      required: directives.required === "true",
      error: directives.error ? Number.parseInt(directives.error, 10) : null,
      code: directives.code || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionHttpCacheBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "cache")).map((entry) => {
    const capabilityId = tokenValue(entry.items[0]);
    const directives = {};

    for (let i = 1; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "cache",
      capability: capabilityId
        ? {
            id: capabilityId,
            kind: registry.get(capabilityId)?.kind || null
          }
        : null,
      responseHeader: directives.response_header || null,
      requestHeader: directives.request_header || null,
      required: directives.required === "true",
      notModified: directives.not_modified ? Number.parseInt(directives.not_modified, 10) : null,
      source: directives.source || null,
      code: directives.code || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionHttpDeleteBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "delete_semantics")).map((entry) => {
    const capabilityId = tokenValue(entry.items[0]);
    const directives = {};

    for (let i = 1; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "delete_semantics",
      capability: capabilityId
        ? {
            id: capabilityId,
            kind: registry.get(capabilityId)?.kind || null
          }
        : null,
      mode: directives.mode || null,
      field: directives.field || null,
      value: directives.value || null,
      response: directives.response || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionHttpAsyncBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "async_jobs")).map((entry) => {
    const capabilityId = tokenValue(entry.items[0]);
    const directives = {};

    for (let i = 1; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "async_jobs",
      capability: capabilityId
        ? {
            id: capabilityId,
            kind: registry.get(capabilityId)?.kind || null
          }
        : null,
      mode: directives.mode || null,
      accepted: directives.accepted ? Number.parseInt(directives.accepted, 10) : null,
      locationHeader: directives.location_header || null,
      retryAfterHeader: directives.retry_after_header || null,
      statusPath: directives.status_path || null,
      statusCapability: directives.status_capability
        ? {
            id: directives.status_capability,
            kind: registry.get(directives.status_capability)?.kind || null
          }
        : null,
      job: directives.job
        ? {
            id: directives.job,
            kind: registry.get(directives.job)?.kind || null
          }
        : null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionHttpStatusBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "async_status")).map((entry) => {
    const capabilityId = tokenValue(entry.items[0]);
    const directives = {};

    for (let i = 1; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "async_status",
      capability: capabilityId
        ? {
            id: capabilityId,
            kind: registry.get(capabilityId)?.kind || null
          }
        : null,
      asyncFor: directives.async_for
        ? {
            id: directives.async_for,
            kind: registry.get(directives.async_for)?.kind || null
          }
        : null,
      stateField: directives.state_field || null,
      completed: directives.completed || null,
      failed: directives.failed || null,
      expired: directives.expired || null,
      downloadCapability: directives.download_capability
        ? {
            id: directives.download_capability,
            kind: registry.get(directives.download_capability)?.kind || null
          }
        : null,
      downloadField: directives.download_field || null,
      errorField: directives.error_field || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionHttpDownloadBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "downloads")).map((entry) => {
    const capabilityId = tokenValue(entry.items[0]);
    const directives = {};

    for (let i = 1; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "downloads",
      capability: capabilityId
        ? {
            id: capabilityId,
            kind: registry.get(capabilityId)?.kind || null
          }
        : null,
      asyncFor: directives.async_for
        ? {
            id: directives.async_for,
            kind: registry.get(directives.async_for)?.kind || null
          }
        : null,
      media: directives.media || null,
      filename: directives.filename || null,
      disposition: directives.disposition || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionHttpAuthzBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "authorization")).map((entry) => {
    const capabilityId = tokenValue(entry.items[0]);
    const directives = {};

    for (let i = 1; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "authorization",
      capability: capabilityId
        ? {
            id: capabilityId,
            kind: registry.get(capabilityId)?.kind || null
          }
        : null,
      role: directives.role || null,
      permission: directives.permission || null,
      claim: directives.claim || null,
      claimValue: directives.claim_value || null,
      ownership: directives.ownership || null,
      ownershipField: directives.ownership_field || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionHttpCallbacksBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "callbacks")).map((entry) => {
    const capabilityId = tokenValue(entry.items[0]);
    const directives = {};

    for (let i = 1; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "http_callback",
      capability: capabilityId
        ? {
            id: capabilityId,
            kind: registry.get(capabilityId)?.kind || null
          }
        : null,
      event: directives.event || null,
      targetField: directives.target_field || null,
      method: directives.method || null,
      payload: directives.payload
        ? {
            id: directives.payload,
            kind: registry.get(directives.payload)?.kind || null
          }
        : null,
      success: directives.success ? Number.parseInt(directives.success, 10) : null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionUiScreensBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "screens")).map((entry) => {
    const directives = {};

    for (let i = 2; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "ui_screen",
      id: tokenValue(entry.items[1]),
      kind: directives.kind || null,
      title: directives.title || null,
      load: directives.load ? { id: directives.load, kind: registry.get(directives.load)?.kind || null } : null,
      itemShape: directives.item_shape ? { id: directives.item_shape, kind: registry.get(directives.item_shape)?.kind || null } : null,
      viewShape: directives.view_shape ? { id: directives.view_shape, kind: registry.get(directives.view_shape)?.kind || null } : null,
      inputShape: directives.input_shape ? { id: directives.input_shape, kind: registry.get(directives.input_shape)?.kind || null } : null,
      submit: directives.submit ? { id: directives.submit, kind: registry.get(directives.submit)?.kind || null } : null,
      detailCapability: directives.detail_capability
        ? { id: directives.detail_capability, kind: registry.get(directives.detail_capability)?.kind || null }
        : null,
      primaryAction: directives.primary_action
        ? { id: directives.primary_action, kind: registry.get(directives.primary_action)?.kind || null }
        : null,
      secondaryAction: directives.secondary_action
        ? { id: directives.secondary_action, kind: registry.get(directives.secondary_action)?.kind || null }
        : null,
      destructiveAction: directives.destructive_action
        ? { id: directives.destructive_action, kind: registry.get(directives.destructive_action)?.kind || null }
        : null,
      terminalAction: directives.terminal_action
        ? { id: directives.terminal_action, kind: registry.get(directives.terminal_action)?.kind || null }
        : null,
      successNavigate: directives.success_navigate || null,
      successRefresh: directives.success_refresh || null,
      emptyTitle: directives.empty_title || null,
      emptyBody: directives.empty_body || null,
      loadingState: directives.loading_state || null,
      errorState: directives.error_state || null,
      unauthorizedState: directives.unauthorized_state || null,
      notFoundState: directives.not_found_state || null,
      successState: directives.success_state || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionUiCollectionsBlock(statement) {
  return blockEntries(getFieldValue(statement, "collection_views")).map((entry) => {
    const operation = tokenValue(entry.items[2]);
    const primaryValue = tokenValue(entry.items[3]) || null;
    const secondaryValue = tokenValue(entry.items[4]) || null;

    return {
      type: "ui_collection_binding",
      screenId: tokenValue(entry.items[1]),
      operation,
      field: ["filter", "search", "sort", "group"].includes(operation) ? primaryValue : null,
      direction: operation === "sort" ? secondaryValue : null,
      value: primaryValue,
      extra: secondaryValue,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionUiActionsBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "screen_actions")).map((entry) => ({
    type: "ui_action_binding",
    screenId: tokenValue(entry.items[1]),
    capability: tokenValue(entry.items[3])
      ? {
          id: tokenValue(entry.items[3]),
          kind: registry.get(tokenValue(entry.items[3]))?.kind || null
        }
      : null,
    prominence: tokenValue(entry.items[5]) || null,
    placement: tokenValue(entry.items[6]) === "placement" ? tokenValue(entry.items[7]) || null : null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionUiVisibilityBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "visibility_rules")).map((entry) => {
    const directives = {};
    for (let i = 5; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "visibility_rules_rule",
      capability: tokenValue(entry.items[1])
        ? {
            id: tokenValue(entry.items[1]),
            kind: registry.get(tokenValue(entry.items[1]))?.kind || null
          }
        : null,
      predicate: tokenValue(entry.items[3]) || null,
      value: tokenValue(entry.items[4]) || null,
      claimValue: directives.claim_value || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionUiLookupsBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "field_lookups")).map((entry) => ({
    type: "ui_lookup_binding",
    screenId: tokenValue(entry.items[1]),
    field: tokenValue(entry.items[3]) || null,
    entity: tokenValue(entry.items[5])
      ? {
          id: tokenValue(entry.items[5]),
          kind: registry.get(tokenValue(entry.items[5]))?.kind || null
        }
      : null,
    labelField: tokenValue(entry.items[7]) || null,
    emptyLabel: tokenValue(entry.items[9]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionUiRoutesBlock(statement) {
  return blockEntries(getFieldValue(statement, "screen_routes")).map((entry) => ({
    type: "ui_route",
    screenId: tokenValue(entry.items[1]),
    path: tokenValue(entry.items[3]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionUiIosBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "ios_hints")).map((entry) => ({
    type: "ios_hint_binding",
    targetKind: tokenValue(entry.items[0]),
    targetId: tokenValue(entry.items[1]),
    capability:
      tokenValue(entry.items[0]) === "action" && tokenValue(entry.items[1])
        ? {
            id: tokenValue(entry.items[1]),
            kind: registry.get(tokenValue(entry.items[1]))?.kind || null
          }
        : null,
    directive: tokenValue(entry.items[2]) || null,
    value: tokenValue(entry.items[3]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionUiWebBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "web_hints")).map((entry) => ({
    type: "web_hint_binding",
    targetKind: tokenValue(entry.items[0]),
    targetId: tokenValue(entry.items[1]),
    capability:
      tokenValue(entry.items[0]) === "action" && tokenValue(entry.items[1])
        ? {
            id: tokenValue(entry.items[1]),
            kind: registry.get(tokenValue(entry.items[1]))?.kind || null
          }
        : null,
    directive: tokenValue(entry.items[2]) || null,
    value: tokenValue(entry.items[3]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionUiAppShellBlock(statement) {
  return blockEntries(getFieldValue(statement, "app_shell")).map((entry) => ({
    type: "app_shell_binding",
    key: tokenValue(entry.items[0]) || null,
    value: tokenValue(entry.items[1]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionUiDesignBlock(statement) {
  return blockEntries(getFieldValue(statement, "design_tokens")).map((entry) => ({
    type: "design_tokens_token",
    key: tokenValue(entry.items[0]) || null,
    role: tokenValue(entry.items[1]) || null,
    value: tokenValue(entry.items[2]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionUiNavigationBlock(statement) {
  return blockEntries(getFieldValue(statement, "navigation")).map((entry) => {
    const directives = {};
    for (let i = 2; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "navigation_binding",
      targetKind: tokenValue(entry.items[0]) || null,
      targetId: tokenValue(entry.items[1]) || null,
      directives,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionUiScreenRegionsBlock(statement) {
  return blockEntries(getFieldValue(statement, "screen_regions")).map((entry) => {
    const directives = {};
    for (let i = 4; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "ui_screen_region_binding",
      screenId: tokenValue(entry.items[1]) || null,
      region: tokenValue(entry.items[3]) || null,
      pattern: directives.pattern || null,
      placement: directives.placement || null,
      title: directives.title || null,
      state: directives.state || null,
      variant: directives.variant || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionUiComponentsBlock(statement, registry, options = {}) {
  const includeComponentAlias = options.includeComponentAlias !== false;
  return blockEntries(getFieldValue(statement, "widget_bindings")).map((entry) => {
    const dataBindings = [];
    const eventBindings = [];

    for (let i = 6; i < entry.items.length;) {
      const directive = tokenValue(entry.items[i]);
      if (directive === "data") {
        const prop = tokenValue(entry.items[i + 1]);
        const sourceId = tokenValue(entry.items[i + 3]);
        dataBindings.push({
          prop,
          source: sourceId
            ? {
                id: sourceId,
                kind: registry.get(sourceId)?.kind || null
              }
            : null
        });
        i += 4;
        continue;
      }
      if (directive === "event") {
        const event = tokenValue(entry.items[i + 1]);
        const action = tokenValue(entry.items[i + 2]);
        const targetId = tokenValue(entry.items[i + 3]);
        eventBindings.push({
          event,
          action,
          target: targetId
            ? {
                id: targetId,
                kind: action === "navigate" ? "screen" : registry.get(targetId)?.kind || null
              }
            : null
        });
        i += 4;
        continue;
      }
      i += 1;
    }

    const widgetId = tokenValue(entry.items[5]);
    const widgetRef = widgetId
      ? {
          id: widgetId,
          kind: registry.get(widgetId)?.kind || null
        }
      : null;
    const binding = {
      type: "widget_binding",
      screenId: tokenValue(entry.items[1]) || null,
      region: tokenValue(entry.items[3]) || null,
      widget: widgetRef,
      dataBindings,
      eventBindings,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
    if (includeComponentAlias) {
      // Internal compatibility for existing generator adapters during the
      // coordinated public DSL rename. Public contracts should expose widget.
      binding.component = widgetRef;
    }
    return binding;
  });
}

function parseProjectionGeneratorDefaultsBlock(statement) {
  return blockEntries(getFieldValue(statement, "generator_defaults")).map((entry) => ({
    type: "generator_default",
    key: tokenValue(entry.items[0]),
    value: tokenValue(entry.items[1]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionDbTablesBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "tables")).map((entry) => ({
    type: "db_table_mapping",
    entity: tokenValue(entry.items[0])
      ? {
          id: tokenValue(entry.items[0]),
          kind: registry.get(tokenValue(entry.items[0]))?.kind || null
        }
      : null,
    table: tokenValue(entry.items[2]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionDbColumnsBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "columns")).map((entry) => ({
    type: "db_column_mapping",
    entity: tokenValue(entry.items[0])
      ? {
          id: tokenValue(entry.items[0]),
          kind: registry.get(tokenValue(entry.items[0]))?.kind || null
        }
      : null,
    field: tokenValue(entry.items[2]) || null,
    column: tokenValue(entry.items[4]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionDbKeysBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "keys")).map((entry) => ({
    type: "db_key",
    entity: tokenValue(entry.items[0])
      ? {
          id: tokenValue(entry.items[0]),
          kind: registry.get(tokenValue(entry.items[0]))?.kind || null
        }
      : null,
    keyType: tokenValue(entry.items[1]) || null,
    fields: entry.items[2]?.type === "list" ? entry.items[2].items.map((item) => item.value) : [],
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionDbIndexesBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "indexes")).map((entry) => ({
    type: "db_index",
    entity: tokenValue(entry.items[0])
      ? {
          id: tokenValue(entry.items[0]),
          kind: registry.get(tokenValue(entry.items[0]))?.kind || null
        }
      : null,
    indexType: tokenValue(entry.items[1]) || null,
    fields: entry.items[2]?.type === "list" ? entry.items[2].items.map((item) => item.value) : [],
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionDbRelationsBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "relations")).map((entry) => {
    const targetRef = tokenValue(entry.items[4]) || null;
    const [targetEntityId, targetField] = (targetRef || "").split(".");
    return {
      type: "db_relation",
      entity: tokenValue(entry.items[0])
        ? {
            id: tokenValue(entry.items[0]),
            kind: registry.get(tokenValue(entry.items[0]))?.kind || null
          }
        : null,
      relationType: tokenValue(entry.items[1]) || null,
      field: tokenValue(entry.items[2]) || null,
      target: targetEntityId
        ? {
            id: targetEntityId,
            kind: registry.get(targetEntityId)?.kind || null,
            field: targetField || null
          }
        : null,
      onDelete: tokenValue(entry.items[6]) || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionDbLifecycleBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "lifecycle")).map((entry) => {
    const directives = {};
    for (let i = 2; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "lifecycle",
      entity: tokenValue(entry.items[0])
        ? {
            id: tokenValue(entry.items[0]),
            kind: registry.get(tokenValue(entry.items[0]))?.kind || null
          }
        : null,
      lifecycleType: tokenValue(entry.items[1]) || null,
      field: directives.field || null,
      value: directives.value || null,
      createdAt: directives.created_at || null,
      updatedAt: directives.updated_at || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionHttpResponseDirectives(tokens) {
  const directives = {
    mode: null,
    item: null,
    cursor: null,
    limit: null,
    sort: null,
    total: null
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokenValue(tokens[i]);
    if (token === "mode") {
      directives.mode = tokenValue(tokens[i + 1]);
      i += 1;
      continue;
    }
    if (token === "item") {
      directives.item = tokenValue(tokens[i + 1]);
      i += 1;
      continue;
    }
    if (token === "cursor") {
      directives.cursor = {
        requestAfter: tokenValue(tokens[i + 1]) === "request_after" ? tokenValue(tokens[i + 2]) : null,
        responseNext: tokenValue(tokens[i + 3]) === "response_next" ? tokenValue(tokens[i + 4]) : null,
        responsePrev: tokenValue(tokens[i + 5]) === "response_prev" ? tokenValue(tokens[i + 6]) : null
      };
      i += directives.cursor.responsePrev ? 6 : 4;
      continue;
    }
    if (token === "limit") {
      directives.limit = {
        field: tokenValue(tokens[i + 1]) === "field" ? tokenValue(tokens[i + 2]) : null,
        defaultValue: tokenValue(tokens[i + 3]) === "default" ? tokenValue(tokens[i + 4]) : null,
        maxValue: tokenValue(tokens[i + 5]) === "max" ? tokenValue(tokens[i + 6]) : null
      };
      i += 6;
      continue;
    }
    if (token === "sort") {
      directives.sort = {
        field: tokenValue(tokens[i + 1]) === "by" ? tokenValue(tokens[i + 2]) : null,
        direction: tokenValue(tokens[i + 3]) === "direction" ? tokenValue(tokens[i + 4]) : null
      };
      i += 4;
      continue;
    }
    if (token === "total") {
      directives.total = {
        included: tokenValue(tokens[i + 1]) === "included" ? tokenValue(tokens[i + 2]) : null
      };
      i += 2;
    }
  }

  return directives;
}

function cloneField(field) {
  return {
    ...field,
    sourceName: field.sourceName ?? field.name
  };
}

function fieldRef(field) {
  return {
    name: field.name,
    sourceName: field.sourceName ?? field.name,
    fieldType: field.fieldType,
    requiredness: field.requiredness,
    defaultValue: field.defaultValue ?? null
  };
}

function applyRename(fields, renameRules) {
  const renameBySource = new Map(renameRules.map((rule) => [rule.from, rule.to]));
  return fields.map((field) => {
    const renamed = cloneField(field);
    const nextName = renameBySource.get(field.name);
    if (nextName) {
      renamed.name = nextName;
    }
    return renamed;
  });
}

function applyOverrides(fields, overrideRules) {
  const byCurrentName = new Map(fields.map((field) => [field.name, field]));
  const bySourceName = new Map(fields.map((field) => [field.sourceName, field]));

  for (const rule of overrideRules) {
    const target = byCurrentName.get(rule.field) || bySourceName.get(rule.field);
    if (!target) {
      continue;
    }

    if (rule.requiredness) {
      target.requiredness = rule.requiredness;
    }
    if (rule.fieldType) {
      target.fieldType = rule.fieldType;
    }
    if (rule.defaultValue !== undefined) {
      target.defaultValue = rule.defaultValue;
    }
  }

  return fields;
}

function buildShapeSelection(shape, byId) {
  const explicitFields = shape.fields.length > 0;
  const selectedFields =
    explicitFields
      ? shape.fields.map((field) => ({
          ...cloneField(field),
          sourceName: field.name
        }))
      : deriveShapeFields(shape, byId).map((field) => ({
          ...cloneField(field),
          sourceName: field.name
        }));

  return {
    type: "shape_selection",
    mode: explicitFields ? "explicit_fields" : shape.from?.id ? "derived_from_entity" : "empty",
    source: shape.from?.target || null,
    include: parseSymbolNodes(shape.include),
    exclude: parseSymbolNodes(shape.exclude),
    selectedFields: selectedFields.map((field) => fieldRef(field))
  };
}

function buildRenameTransforms(renameRules) {
  return renameRules.map((rule, index) => ({
    type: "rename_field",
    order: index,
    from: rule.from,
    to: rule.to,
    loc: rule.loc
  }));
}

function buildOverrideTransforms(overrideRules) {
  return overrideRules.map((rule, index) => ({
    type: "override_field",
    order: index,
    field: rule.field,
    changes: {
      requiredness: rule.requiredness,
      fieldType: rule.fieldType,
      defaultValue: rule.defaultValue ?? null
    },
    loc: rule.loc
  }));
}

function buildShapeTransformGraph(shape, byId) {
  const selection = buildShapeSelection(shape, byId);
  return {
    type: "shape_transform_graph",
    selection,
    transforms: [
      ...buildRenameTransforms(shape.rename),
      ...buildOverrideTransforms(shape.overrides)
    ],
    resultFields: (shape.projectedFields || []).map((field) => fieldRef(field))
  };
}

function projectShapeFields(shape, byId) {
  const baseFields =
    shape.fields.length > 0
      ? shape.fields.map((field) => ({
          ...cloneField(field),
          sourceName: field.name
        }))
      : deriveShapeFields(shape, byId).map((field) => ({
          ...cloneField(field),
          sourceName: field.name
        }));

  const renamedFields = applyRename(baseFields, shape.rename);
  const overriddenFields = applyOverrides(renamedFields, shape.overrides);

  return overriddenFields.map((field) => ({
    name: field.name,
    sourceName: field.sourceName,
    fieldType: field.fieldType,
    requiredness: field.requiredness,
    defaultValue: field.defaultValue ?? null,
    raw: field.raw,
    loc: field.loc
  }));
}

function deriveShapeFields(shape, byId) {
  if (shape.fields.length > 0) {
    return shape.fields;
  }

  if (!shape.from?.target?.id) {
    return [];
  }

  const entity = byId.get(shape.from.target.id);
  if (!entity || entity.kind !== "entity") {
    return [];
  }

  const sourceFields = new Map(entity.fields.map((field) => [field.name, field]));
  const includes = shape.include.length > 0 ? shape.include : [...sourceFields.keys()];
  const excludes = new Set(shape.exclude);

  return includes
    .filter((fieldName) => !excludes.has(fieldName))
    .map((fieldName) => sourceFields.get(fieldName))
    .filter(Boolean)
    .map((field) => cloneField(field));
}

export function normalizeStatement(statement, registry) {
  const fieldMap = collectFieldMap(statement);
  const base = {
    kind: statement.kind,
    id: statement.id,
    name: stringValue(getFieldValue(statement, "name")),
    description: stringValue(getFieldValue(statement, "description")),
    status: symbolValue(getFieldValue(statement, "status")),
    from: statement.from
      ? {
          id: statement.from.value,
          target: toRef(resolveReference(registry, statement.from.value))
        }
      : null,
    loc: statement.loc
  };

  switch (statement.kind) {
    case "enum":
      return {
        ...base,
        values: symbolValues(getFieldValue(statement, "values"))
      };
    case "actor":
    case "role":
      return base;
    case "entity":
      return {
        ...base,
        usesTerms: resolveReferenceList(registry, getFieldValue(statement, "uses_terms")),
        fields: normalizeFieldsBlock(statement),
        keys: parseKeyBlock(statement),
        relations: parseRelationBlock(statement, registry),
        invariants: parseInvariantBlock(statement),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "shape":
      return {
        ...base,
        include: symbolValues(getFieldValue(statement, "include")),
        exclude: symbolValues(getFieldValue(statement, "exclude")),
        derivedFrom: resolveReferenceList(registry, getFieldValue(statement, "derived_from")),
        fields: normalizeFieldsBlock(statement),
        rename: parseRenameBlock(statement),
        overrides: parseOverridesBlock(statement)
      };
    case "capability":
      return {
        ...base,
        actors: resolveReferenceList(registry, getFieldValue(statement, "actors")),
        roles: resolveReferenceList(registry, getFieldValue(statement, "roles")),
        reads: resolveReferenceList(registry, getFieldValue(statement, "reads")),
        creates: resolveReferenceList(registry, getFieldValue(statement, "creates")),
        updates: resolveReferenceList(registry, getFieldValue(statement, "updates")),
        deletes: resolveReferenceList(registry, getFieldValue(statement, "deletes")),
        input: resolveReferenceList(registry, getFieldValue(statement, "input")),
        output: resolveReferenceList(registry, getFieldValue(statement, "output")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "widget":
      return {
        ...base,
        category: symbolValue(getFieldValue(statement, "category")),
        props: normalizeComponentProps(statement),
        events: normalizeComponentEvents(statement, registry),
        slots: normalizeComponentSlots(statement),
        behavior: symbolValues(getFieldValue(statement, "behavior")),
        behaviors: normalizeComponentBehaviors(statement),
        patterns: symbolValues(getFieldValue(statement, "patterns")),
        regions: symbolValues(getFieldValue(statement, "regions")),
        approvals: symbolValues(getFieldValue(statement, "approvals")),
        lookups: resolveReferenceList(registry, getFieldValue(statement, "lookups")),
        dependencies: resolveReferenceList(registry, getFieldValue(statement, "dependencies")),
        version: stringValue(getFieldValue(statement, "version"))
      };
    case "rule":
      return {
        ...base,
        appliesTo: resolveReferenceList(registry, getFieldValue(statement, "applies_to")),
        actors: resolveReferenceList(registry, getFieldValue(statement, "actors")),
        roles: resolveReferenceList(registry, getFieldValue(statement, "roles")),
        condition: valueAsArray(getFieldValue(statement, "condition")).map((item) => item.value),
        conditionNode: getFieldValue(statement, "condition") ? parseRuleExpression(getFieldValue(statement, "condition")) : null,
        requirement: valueAsArray(getFieldValue(statement, "requirement")).map((item) => item.value),
        requirementNode: getFieldValue(statement, "requirement") ? parseRuleExpression(getFieldValue(statement, "requirement")) : null,
        fromRequirement: getFieldValue(statement, "from_requirement")
          ? {
              id: symbolValue(getFieldValue(statement, "from_requirement")),
              target: toRef(resolveReference(registry, symbolValue(getFieldValue(statement, "from_requirement"))))
            }
          : null,
        severity: symbolValue(getFieldValue(statement, "severity")),
        sourceOfTruth: resolveReferenceList(registry, getFieldValue(statement, "source_of_truth")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "decision":
      return {
        ...base,
        context: symbolValues(getFieldValue(statement, "context")),
        consequences: symbolValues(getFieldValue(statement, "consequences")),
        pitch: getFieldValue(statement, "pitch")
          ? {
              id: symbolValue(getFieldValue(statement, "pitch")),
              target: toRef(resolveReference(registry, symbolValue(getFieldValue(statement, "pitch"))))
            }
          : null,
        supersedes: resolveReferenceList(registry, getFieldValue(statement, "supersedes")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "projection":
      return {
        ...base,
        type: symbolValue(getFieldValue(statement, "type")),
        // Internal compatibility for existing generator adapters during the
        // coordinated public DSL rename. Public contracts should expose type.
        platform: symbolValue(getFieldValue(statement, "type")),
        realizes: resolveReferenceList(registry, getFieldValue(statement, "realizes")),
        outputs: symbolValues(getFieldValue(statement, "outputs")),
        endpoints: parseProjectionHttpBlock(statement, registry),
        errorResponses: parseProjectionHttpErrorsBlock(statement, registry),
        wireFields: parseProjectionHttpFieldsBlock(statement, registry),
        responses: parseProjectionHttpResponsesBlock(statement, registry),
        preconditions: parseProjectionHttpPreconditionsBlock(statement, registry),
        idempotency: parseProjectionHttpIdempotencyBlock(statement, registry),
        cache: parseProjectionHttpCacheBlock(statement, registry),
        deleteSemantics: parseProjectionHttpDeleteBlock(statement, registry),
        asyncJobs: parseProjectionHttpAsyncBlock(statement, registry),
        asyncStatus: parseProjectionHttpStatusBlock(statement, registry),
        downloads: parseProjectionHttpDownloadBlock(statement, registry),
        authorization: parseProjectionHttpAuthzBlock(statement, registry),
        callbacks: parseProjectionHttpCallbacksBlock(statement, registry),
        http: parseProjectionHttpBlock(statement, registry),
        httpErrors: parseProjectionHttpErrorsBlock(statement, registry),
        httpFields: parseProjectionHttpFieldsBlock(statement, registry),
        httpResponses: parseProjectionHttpResponsesBlock(statement, registry),
        httpPreconditions: parseProjectionHttpPreconditionsBlock(statement, registry),
        httpIdempotency: parseProjectionHttpIdempotencyBlock(statement, registry),
        httpCache: parseProjectionHttpCacheBlock(statement, registry),
        httpDelete: parseProjectionHttpDeleteBlock(statement, registry),
        httpAsync: parseProjectionHttpAsyncBlock(statement, registry),
        httpStatus: parseProjectionHttpStatusBlock(statement, registry),
        httpDownload: parseProjectionHttpDownloadBlock(statement, registry),
        httpAuthz: parseProjectionHttpAuthzBlock(statement, registry),
        httpCallbacks: parseProjectionHttpCallbacksBlock(statement, registry),
        uiScreens: parseProjectionUiScreensBlock(statement, registry),
        screens: parseProjectionUiScreensBlock(statement, registry),
        uiCollections: parseProjectionUiCollectionsBlock(statement),
        collectionViews: parseProjectionUiCollectionsBlock(statement),
        uiActions: parseProjectionUiActionsBlock(statement, registry),
        screenActions: parseProjectionUiActionsBlock(statement, registry),
        uiVisibility: parseProjectionUiVisibilityBlock(statement, registry),
        visibilityRules: parseProjectionUiVisibilityBlock(statement, registry),
        uiLookups: parseProjectionUiLookupsBlock(statement, registry),
        fieldLookups: parseProjectionUiLookupsBlock(statement, registry),
        uiRoutes: parseProjectionUiRoutesBlock(statement),
        screenRoutes: parseProjectionUiRoutesBlock(statement),
        uiWeb: parseProjectionUiWebBlock(statement, registry),
        webHints: parseProjectionUiWebBlock(statement, registry),
        uiIos: parseProjectionUiIosBlock(statement, registry),
        iosHints: parseProjectionUiIosBlock(statement, registry),
        uiAppShell: parseProjectionUiAppShellBlock(statement),
        appShell: parseProjectionUiAppShellBlock(statement),
        uiDesign: parseProjectionUiDesignBlock(statement),
        designTokens: parseProjectionUiDesignBlock(statement),
        uiNavigation: parseProjectionUiNavigationBlock(statement),
        navigation: parseProjectionUiNavigationBlock(statement),
        uiScreenRegions: parseProjectionUiScreenRegionsBlock(statement),
        screenRegions: parseProjectionUiScreenRegionsBlock(statement),
        uiComponents: parseProjectionUiComponentsBlock(statement, registry),
        widgetBindings: parseProjectionUiComponentsBlock(statement, registry, { includeComponentAlias: false }),
        dbTables: parseProjectionDbTablesBlock(statement, registry),
        tables: parseProjectionDbTablesBlock(statement, registry),
        dbColumns: parseProjectionDbColumnsBlock(statement, registry),
        columns: parseProjectionDbColumnsBlock(statement, registry),
        dbKeys: parseProjectionDbKeysBlock(statement, registry),
        keys: parseProjectionDbKeysBlock(statement, registry),
        dbIndexes: parseProjectionDbIndexesBlock(statement, registry),
        indexes: parseProjectionDbIndexesBlock(statement, registry),
        dbRelations: parseProjectionDbRelationsBlock(statement, registry),
        relations: parseProjectionDbRelationsBlock(statement, registry),
        dbLifecycle: parseProjectionDbLifecycleBlock(statement, registry),
        lifecycle: parseProjectionDbLifecycleBlock(statement, registry),
        generatorDefaults: parseProjectionGeneratorDefaultsBlock(statement)
      };
    case "orchestration":
      return {
        ...base,
        inputs: resolveReferenceList(registry, getFieldValue(statement, "inputs")),
        steps: symbolValues(getFieldValue(statement, "steps")),
        outputs: symbolValues(getFieldValue(statement, "outputs")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "verification":
      return {
        ...base,
        validates: resolveReferenceList(registry, getFieldValue(statement, "validates")),
        method: symbolValue(getFieldValue(statement, "method")),
        scenarios: symbolValues(getFieldValue(statement, "scenarios")),
        requirementRefs: resolveReferenceList(registry, getFieldValue(statement, "requirement_refs")),
        acceptanceRefs: resolveReferenceList(registry, getFieldValue(statement, "acceptance_refs")),
        fixesBugs: resolveReferenceList(registry, getFieldValue(statement, "fixes_bugs")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "operation":
      return {
        ...base,
        observes: resolveReferenceList(registry, getFieldValue(statement, "observes")),
        metrics: symbolValues(getFieldValue(statement, "metrics")),
        alerts: symbolValues(getFieldValue(statement, "alerts")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "term":
      return {
        ...base,
        aliases: symbolValues(getFieldValue(statement, "aliases")),
        excludes: symbolValues(getFieldValue(statement, "excludes"))
      };
    case "domain":
      return {
        ...base,
        inScope: normalizeDomainScopeList(statement, "in_scope"),
        outOfScope: normalizeDomainScopeList(statement, "out_of_scope"),
        owners: resolveReferenceList(registry, getFieldValue(statement, "owners")),
        parentDomain: getFieldValue(statement, "parent_domain")
          ? {
              id: symbolValue(getFieldValue(statement, "parent_domain")),
              target: toRef(resolveReference(registry, symbolValue(getFieldValue(statement, "parent_domain"))))
            }
          : null,
        aliases: normalizeDomainScopeList(statement, "aliases")
      };
    case "pitch":
      return {
        ...base,
        priority: symbolValue(getFieldValue(statement, "priority")),
        appetite: stringValue(getFieldValue(statement, "appetite")) || symbolValue(getFieldValue(statement, "appetite")),
        problem: stringValue(getFieldValue(statement, "problem")),
        solutionSketch: stringValue(getFieldValue(statement, "solution_sketch")),
        rabbitHoles: stringValue(getFieldValue(statement, "rabbit_holes")) || symbolValues(getFieldValue(statement, "rabbit_holes")),
        noGoAreas: stringValue(getFieldValue(statement, "no_go_areas")) || symbolValues(getFieldValue(statement, "no_go_areas")),
        affects: resolveReferenceList(registry, getFieldValue(statement, "affects")),
        decisions: resolveReferenceList(registry, getFieldValue(statement, "decisions")),
        updated: stringValue(getFieldValue(statement, "updated")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "requirement":
      return {
        ...base,
        priority: symbolValue(getFieldValue(statement, "priority")),
        pitch: getFieldValue(statement, "pitch")
          ? {
              id: symbolValue(getFieldValue(statement, "pitch")),
              target: toRef(resolveReference(registry, symbolValue(getFieldValue(statement, "pitch"))))
            }
          : null,
        affects: resolveReferenceList(registry, getFieldValue(statement, "affects")),
        introducesRules: resolveReferenceList(registry, getFieldValue(statement, "introduces_rules")),
        respectsRules: resolveReferenceList(registry, getFieldValue(statement, "respects_rules")),
        supersedes: resolveReferenceList(registry, getFieldValue(statement, "supersedes")),
        updated: stringValue(getFieldValue(statement, "updated")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "acceptance_criterion":
      return {
        ...base,
        requirement: getFieldValue(statement, "requirement")
          ? {
              id: symbolValue(getFieldValue(statement, "requirement")),
              target: toRef(resolveReference(registry, symbolValue(getFieldValue(statement, "requirement"))))
            }
          : null,
        supersedes: resolveReferenceList(registry, getFieldValue(statement, "supersedes")),
        updated: stringValue(getFieldValue(statement, "updated"))
      };
    case "task":
      return {
        ...base,
        priority: symbolValue(getFieldValue(statement, "priority")),
        workType: symbolValue(getFieldValue(statement, "work_type")),
        affects: resolveReferenceList(registry, getFieldValue(statement, "affects")),
        satisfies: resolveReferenceList(registry, getFieldValue(statement, "satisfies")),
        acceptanceRefs: resolveReferenceList(registry, getFieldValue(statement, "acceptance_refs")),
        blocks: resolveReferenceList(registry, getFieldValue(statement, "blocks")),
        blockedBy: resolveReferenceList(registry, getFieldValue(statement, "blocked_by")),
        claimedBy: resolveReferenceList(registry, getFieldValue(statement, "claimed_by")),
        introducesDecisions: resolveReferenceList(registry, getFieldValue(statement, "introduces_decisions")),
        modifies: resolveReferenceList(registry, getFieldValue(statement, "modifies")),
        introduces: resolveReferenceList(registry, getFieldValue(statement, "introduces")),
        removes: resolveReferenceList(registry, getFieldValue(statement, "removes")),
        updated: stringValue(getFieldValue(statement, "updated")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "bug":
      return {
        ...base,
        priority: symbolValue(getFieldValue(statement, "priority")),
        severity: symbolValue(getFieldValue(statement, "severity")),
        affects: resolveReferenceList(registry, getFieldValue(statement, "affects")),
        violates: resolveReferenceList(registry, getFieldValue(statement, "violates")),
        surfacesRule: resolveReferenceList(registry, getFieldValue(statement, "surfaces_rule")),
        introducedIn: resolveReferenceList(registry, getFieldValue(statement, "introduced_in")),
        fixedIn: resolveReferenceList(registry, getFieldValue(statement, "fixed_in")),
        fixedInRelease: stringValue(getFieldValue(statement, "fixed_in_release")) || symbolValue(getFieldValue(statement, "fixed_in_release")),
        fixedInVerification: resolveReferenceList(registry, getFieldValue(statement, "fixed_in_verification")),
        reproduction: stringValue(getFieldValue(statement, "reproduction")),
        modifies: resolveReferenceList(registry, getFieldValue(statement, "modifies")),
        introduces: resolveReferenceList(registry, getFieldValue(statement, "introduces")),
        removes: resolveReferenceList(registry, getFieldValue(statement, "removes")),
        updated: stringValue(getFieldValue(statement, "updated")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    default:
      return {
        ...base,
        fields: [...fieldMap.keys()]
      };
  }
}

function normalizeDoc(doc) {
  return {
    id: doc.metadata.id,
    kind: doc.metadata.kind,
    title: doc.metadata.title,
    status: doc.metadata.status,
    summary: doc.metadata.summary || null,
    successOutcome: doc.metadata.success_outcome || null,
    aliases: [...(doc.metadata.aliases || [])],
    actors: [...(doc.metadata.actors || [])],
    relatedEntities: [...(doc.metadata.related_entities || [])],
    relatedCapabilities: [...(doc.metadata.related_capabilities || [])],
    relatedActors: [...(doc.metadata.related_actors || [])],
    relatedRoles: [...(doc.metadata.related_roles || [])],
    relatedRules: [...(doc.metadata.related_rules || [])],
    relatedWorkflows: [...(doc.metadata.related_workflows || [])],
    relatedShapes: [...(doc.metadata.related_shapes || [])],
    relatedProjections: [...(doc.metadata.related_projections || [])],
    relatedDocs: [...(doc.metadata.related_docs || [])],
    sourceOfTruth: doc.metadata.source_of_truth || null,
    confidence: doc.metadata.confidence || null,
    reviewRequired: doc.metadata.review_required ?? false,
    provenance: [...(doc.metadata.provenance || [])],
    tags: [...(doc.metadata.tags || [])],
    domain: doc.metadata.domain || null,
    appVersion: doc.metadata.app_version || null,
    audience: doc.metadata.audience || null,
    priority: doc.metadata.priority || null,
    version: doc.metadata.version || null,
    affects: [...(doc.metadata.affects || [])],
    satisfies: [...(doc.metadata.satisfies || [])],
    approvals: [...(doc.metadata.approvals || [])],
    file: doc.file,
    relativePath: doc.relativePath,
    body: doc.body
  };
}

export function resolveWorkspace(workspaceAst) {
  const validation = validateWorkspace(workspaceAst);
  if (!validation.ok) {
    return {
      ok: false,
      validation
    };
  }

  const archive = loadArchive(workspaceAst.root);
  if (archive.errors.length > 0) {
    const archiveErrors = archive.errors.map((message) => ({
      message: `Invalid SDLC archive: ${message}`,
      loc: {
        file: workspaceAst.root,
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 1, offset: 0 }
      }
    }));
    return {
      ok: false,
      validation: {
        ...validation,
        ok: false,
        errorCount: validation.errorCount + archiveErrors.length,
        errors: [...validation.errors, ...archiveErrors]
      }
    };
  }

  const errors = [];
  const registry = buildRegistry(workspaceAst, errors);
  const statements = workspaceAst.files.flatMap((file) => file.statements);
  const resolvedStatements = statements.map((statement) => normalizeStatement(statement, registry));
  const byId = new Map(resolvedStatements.map((statement) => [statement.id, statement]));

  // Build domain.members back-links by reverse-indexing tagged statements.
  // Members are grouped per kind so consumers can ask for `domain.members.capabilities`
  // without re-walking the registry. Phase 2 extends with SDLC kinds; documents
  // are folded in below from workspaceAst.docs[].metadata.domain.
  const domainMembersById = new Map();
  for (const statement of resolvedStatements) {
    if (statement.kind === "domain") {
      domainMembersById.set(statement.id, {
        capabilities: [],
        entities: [],
        rules: [],
        verifications: [],
        orchestrations: [],
        operations: [],
        decisions: [],
        pitches: [],
        requirements: [],
        tasks: [],
        bugs: [],
        documents: []
      });
    }
  }
  const memberKindToBucket = {
    capability: "capabilities",
    entity: "entities",
    rule: "rules",
    verification: "verifications",
    orchestration: "orchestrations",
    operation: "operations",
    decision: "decisions",
    pitch: "pitches",
    requirement: "requirements",
    task: "tasks",
    bug: "bugs"
  };
  for (const statement of resolvedStatements) {
    const bucketKey = memberKindToBucket[statement.kind];
    if (!bucketKey || !statement.resolvedDomain) {
      continue;
    }
    const members = domainMembersById.get(statement.resolvedDomain.id);
    if (members) {
      members[bucketKey].push(statement.id);
    }
  }
  // Fold tagged documents into domain.members.documents.
  for (const doc of workspaceAst.docs || []) {
    if (doc.parseError) continue;
    const domainId = doc.metadata?.domain;
    if (!domainId) continue;
    const members = domainMembersById.get(domainId);
    if (members && doc.metadata.id) {
      members.documents.push(doc.metadata.id);
    }
  }
  for (const members of domainMembersById.values()) {
    for (const bucket of Object.values(members)) {
      bucket.sort();
    }
  }

  // Phase 2: build SDLC back-link indices in a single pass over the resolved
  // statements. Each index maps `targetId -> [sourceId,...]`.
  const sdlcIndex = {
    requirementsByPitch: new Map(),
    decisionsByPitch: new Map(),
    acsByRequirement: new Map(),
    tasksBySatisfiedRequirement: new Map(),
    tasksByAcceptanceRef: new Map(),
    verificationsByRequirementRef: new Map(),
    verificationsByAcceptanceRef: new Map(),
    verificationsFixingBug: new Map(),
    supersededByRequirements: new Map(),
    supersededByAcs: new Map(),
    documentsBySatisfies: new Map(),
    rulesByFromRequirement: new Map(),
    tasksThatBlockTarget: new Map(),
    tasksBlockedByTarget: new Map(),
    affectedByPitches: new Map(),
    affectedByRequirements: new Map(),
    affectedByTasks: new Map(),
    affectedByBugs: new Map(),
    introducedRulesByRequirement: new Map(),
    respectedRulesByRequirement: new Map(),
    rulesViolatedByBug: new Map(),
    rulesSurfacedByBug: new Map(),
    decisionsIntroducedByTask: new Map()
  };
  function pushIndex(map, key, value) {
    if (!key || !value) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  }
  function pushIndexFromList(map, list, value) {
    if (!Array.isArray(list)) return;
    for (const ref of list) {
      const key = typeof ref === "string" ? ref : ref?.id;
      pushIndex(map, key, value);
    }
  }
  for (const statement of resolvedStatements) {
    switch (statement.kind) {
      case "requirement":
        pushIndex(sdlcIndex.requirementsByPitch, statement.pitch?.id, statement.id);
        pushIndexFromList(sdlcIndex.affectedByRequirements, statement.affects, statement.id);
        pushIndexFromList(sdlcIndex.introducedRulesByRequirement, statement.introducesRules, statement.id);
        pushIndexFromList(sdlcIndex.respectedRulesByRequirement, statement.respectsRules, statement.id);
        pushIndexFromList(sdlcIndex.supersededByRequirements, statement.supersedes, statement.id);
        break;
      case "acceptance_criterion":
        pushIndex(sdlcIndex.acsByRequirement, statement.requirement?.id, statement.id);
        pushIndexFromList(sdlcIndex.supersededByAcs, statement.supersedes, statement.id);
        break;
      case "decision":
        pushIndex(sdlcIndex.decisionsByPitch, statement.pitch?.id, statement.id);
        break;
      case "rule":
        pushIndex(sdlcIndex.rulesByFromRequirement, statement.fromRequirement?.id, statement.id);
        break;
      case "pitch":
        pushIndexFromList(sdlcIndex.affectedByPitches, statement.affects, statement.id);
        break;
      case "task":
        pushIndexFromList(sdlcIndex.affectedByTasks, statement.affects, statement.id);
        pushIndexFromList(sdlcIndex.tasksBySatisfiedRequirement, statement.satisfies, statement.id);
        pushIndexFromList(sdlcIndex.tasksByAcceptanceRef, statement.acceptanceRefs, statement.id);
        pushIndexFromList(sdlcIndex.decisionsIntroducedByTask, statement.introducesDecisions, statement.id);
        pushIndexFromList(sdlcIndex.tasksThatBlockTarget, statement.blocks, statement.id);
        pushIndexFromList(sdlcIndex.tasksBlockedByTarget, statement.blockedBy, statement.id);
        break;
      case "bug":
        pushIndexFromList(sdlcIndex.affectedByBugs, statement.affects, statement.id);
        pushIndexFromList(sdlcIndex.rulesViolatedByBug, statement.violates, statement.id);
        pushIndexFromList(sdlcIndex.rulesSurfacedByBug, statement.surfacesRule, statement.id);
        break;
      case "verification":
        pushIndexFromList(sdlcIndex.verificationsByRequirementRef, statement.requirementRefs, statement.id);
        pushIndexFromList(sdlcIndex.verificationsByAcceptanceRef, statement.acceptanceRefs, statement.id);
        pushIndexFromList(sdlcIndex.verificationsFixingBug, statement.fixesBugs, statement.id);
        break;
      default:
        break;
    }
  }
  // Documents `satisfies` frontmatter is folded in from workspaceAst.docs.
  for (const doc of workspaceAst.docs || []) {
    if (doc.parseError) continue;
    const satisfies = doc.metadata?.satisfies;
    if (!satisfies || !doc.metadata.id) continue;
    const ids = Array.isArray(satisfies) ? satisfies : [satisfies];
    for (const id of ids) {
      pushIndex(sdlcIndex.documentsBySatisfies, id, doc.metadata.id);
    }
  }

  const enrichedStatements = resolvedStatements.map((statement) => {
    switch (statement.kind) {
      case "shape":
        return {
          ...statement,
          projectedFields: projectShapeFields(statement, byId)
        };
      case "capability":
        return {
          ...statement,
          flow: buildCapabilityFlow(statement)
        };
    case "widget":
      return {
        ...statement,
          widgetContract: buildComponentContract(statement),
          // Internal compatibility for existing generator adapters during the
          // coordinated public DSL rename. Public contracts should expose widgetContract.
          componentContract: buildComponentContract(statement)
        };
      case "rule":
        return {
          ...statement,
          policy: buildRulePolicy(statement)
        };
      case "decision":
        return {
          ...statement,
          record: buildDecisionRecord(statement)
        };
      case "projection":
        return {
          ...statement,
          plan: buildProjectionPlan(statement)
        };
      case "orchestration":
        return {
          ...statement,
          plan: buildOrchestrationPlan(statement)
        };
      case "verification":
        return {
          ...statement,
          plan: buildVerificationPlan(statement)
        };
      case "operation":
        return {
          ...statement,
          monitoring: buildOperationMonitoring(statement)
        };
      case "term":
        return {
          ...statement,
          vocabulary: buildTermVocabulary(statement)
        };
      case "domain":
        return {
          ...statement,
          members: domainMembersById.get(statement.id) || {
            capabilities: [],
            entities: [],
            rules: [],
            verifications: [],
            orchestrations: [],
            operations: [],
            decisions: [],
            pitches: [],
            requirements: [],
            tasks: [],
            bugs: [],
            documents: []
          }
        };
      case "pitch":
        return {
          ...statement,
          ...enrichPitch(statement, sdlcIndex)
        };
      case "requirement":
        return {
          ...statement,
          ...enrichRequirement(statement, sdlcIndex)
        };
      case "acceptance_criterion":
        return {
          ...statement,
          ...enrichAcceptanceCriterion(statement, sdlcIndex)
        };
      case "task":
        return {
          ...statement,
          ...enrichTask(statement, sdlcIndex)
        };
      case "bug":
        return {
          ...statement,
          ...enrichBug(statement, sdlcIndex)
        };
      default:
        return statement;
    }
  });

  // After per-kind enrichment, add `affectedBy*` lists onto the targets
  // (capability/entity/rule/projection/widget/orchestration/operation) and
  // the change-tracking lists onto the carrier kinds (rule, decision).
  const affectedByPitches = sdlcIndex.affectedByPitches;
  const affectedByRequirements = sdlcIndex.affectedByRequirements;
  const affectedByTasks = sdlcIndex.affectedByTasks;
  const affectedByBugs = sdlcIndex.affectedByBugs;
  const introducedRulesByRequirement = sdlcIndex.introducedRulesByRequirement;
  const respectedRulesByRequirement = sdlcIndex.respectedRulesByRequirement;
  const rulesViolatedByBug = sdlcIndex.rulesViolatedByBug;
  const rulesSurfacedByBug = sdlcIndex.rulesSurfacedByBug;
  const decisionsIntroducedByTask = sdlcIndex.decisionsIntroducedByTask;
  const sortedOr = (map, key) => (map.get(key) || []).slice().sort();
  const enrichedWithAffected = enrichedStatements.map((statement) => {
    switch (statement.kind) {
      case "capability":
      case "entity":
      case "projection":
      case "widget":
      case "orchestration":
      case "operation":
        return {
          ...statement,
          affectedByPitches: sortedOr(affectedByPitches, statement.id),
          affectedByRequirements: sortedOr(affectedByRequirements, statement.id),
          affectedByTasks: sortedOr(affectedByTasks, statement.id),
          affectedByBugs: sortedOr(affectedByBugs, statement.id)
        };
      case "rule":
        return {
          ...statement,
          affectedByPitches: sortedOr(affectedByPitches, statement.id),
          affectedByRequirements: sortedOr(affectedByRequirements, statement.id),
          affectedByTasks: sortedOr(affectedByTasks, statement.id),
          affectedByBugs: sortedOr(affectedByBugs, statement.id),
          introducedByRequirements: sortedOr(introducedRulesByRequirement, statement.id),
          respectedByRequirements: sortedOr(respectedRulesByRequirement, statement.id),
          violatedByBugs: sortedOr(rulesViolatedByBug, statement.id),
          surfacedByBugs: sortedOr(rulesSurfacedByBug, statement.id)
        };
      case "decision":
        return {
          ...statement,
          introducedByTasks: sortedOr(decisionsIntroducedByTask, statement.id)
        };
      default:
        return statement;
    }
  });
  const byKind = groupBy(enrichedWithAffected, (statement) => statement.kind);
  const finalStatements = enrichedWithAffected.map((statement) => {
    if (statement.kind !== "shape") {
      return statement;
    }

    return {
      ...statement,
      transformGraph: buildShapeTransformGraph(statement, byId)
    };
  });
  const finalByKind = groupBy(finalStatements, (statement) => statement.kind);
  if (finalByKind.widget && !finalByKind.component) {
    // Internal compatibility for existing generator/context modules while the
    // public DSL moves from component to widget in one coordinated release.
    finalByKind.component = finalByKind.widget;
  }

  const graph = mergeArchivedIntoGraph({
    root: workspaceAst.root,
    statements: finalStatements,
    byKind: finalByKind,
    docs: (workspaceAst.docs || []).filter((doc) => !doc.parseError).map(normalizeDoc)
  }, archive);

  return {
    ok: true,
    validation,
    graph
  };
}

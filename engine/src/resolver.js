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
} from "./validator.js";

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

function normalizeFieldsBlock(statement) {
  return blockEntries(getFieldValue(statement, "fields")).map((entry) => {
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
    platform: statement.platform,
    realizes: statement.realizes.map((ref, index) => ({
      order: index,
      target: ref.target || { id: ref.id, kind: null }
    })),
    outputs: parseSymbolNodes(statement.outputs),
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
  return blockEntries(getFieldValue(statement, "http")).map((entry) => {
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
  return blockEntries(getFieldValue(statement, "http_errors")).map((entry) => ({
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
  return blockEntries(getFieldValue(statement, "http_fields")).map((entry) => ({
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
  return blockEntries(getFieldValue(statement, "http_responses")).map((entry) => {
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
  return blockEntries(getFieldValue(statement, "http_preconditions")).map((entry) => {
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
  return blockEntries(getFieldValue(statement, "http_idempotency")).map((entry) => {
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
      type: "http_idempotency",
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
  return blockEntries(getFieldValue(statement, "http_cache")).map((entry) => {
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
      type: "http_cache",
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
  return blockEntries(getFieldValue(statement, "http_delete")).map((entry) => {
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
      type: "http_delete",
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
  return blockEntries(getFieldValue(statement, "http_async")).map((entry) => {
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
      type: "http_async",
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
  return blockEntries(getFieldValue(statement, "http_status")).map((entry) => {
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
      type: "http_status",
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
  return blockEntries(getFieldValue(statement, "http_download")).map((entry) => {
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
      type: "http_download",
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
  return blockEntries(getFieldValue(statement, "http_authz")).map((entry) => {
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
      type: "http_authz",
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
  return blockEntries(getFieldValue(statement, "http_callbacks")).map((entry) => {
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
  return blockEntries(getFieldValue(statement, "ui_screens")).map((entry) => {
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
  return blockEntries(getFieldValue(statement, "ui_collections")).map((entry) => {
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
  return blockEntries(getFieldValue(statement, "ui_actions")).map((entry) => ({
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
  return blockEntries(getFieldValue(statement, "ui_visibility")).map((entry) => {
    const directives = {};
    for (let i = 5; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "ui_visibility_rule",
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
  return blockEntries(getFieldValue(statement, "ui_lookups")).map((entry) => ({
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
  return blockEntries(getFieldValue(statement, "ui_routes")).map((entry) => ({
    type: "ui_route",
    screenId: tokenValue(entry.items[1]),
    path: tokenValue(entry.items[3]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionUiIosBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "ui_ios")).map((entry) => ({
    type: "ui_ios_binding",
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
  return blockEntries(getFieldValue(statement, "ui_web")).map((entry) => ({
    type: "ui_web_binding",
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
  return blockEntries(getFieldValue(statement, "ui_app_shell")).map((entry) => ({
    type: "ui_app_shell_binding",
    key: tokenValue(entry.items[0]) || null,
    value: tokenValue(entry.items[1]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

function parseProjectionUiNavigationBlock(statement) {
  return blockEntries(getFieldValue(statement, "ui_navigation")).map((entry) => {
    const directives = {};
    for (let i = 2; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "ui_navigation_binding",
      targetKind: tokenValue(entry.items[0]) || null,
      targetId: tokenValue(entry.items[1]) || null,
      directives,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

function parseProjectionUiScreenRegionsBlock(statement) {
  return blockEntries(getFieldValue(statement, "ui_screen_regions")).map((entry) => {
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
  return blockEntries(getFieldValue(statement, "db_tables")).map((entry) => ({
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
  return blockEntries(getFieldValue(statement, "db_columns")).map((entry) => ({
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
  return blockEntries(getFieldValue(statement, "db_keys")).map((entry) => ({
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
  return blockEntries(getFieldValue(statement, "db_indexes")).map((entry) => ({
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
  return blockEntries(getFieldValue(statement, "db_relations")).map((entry) => {
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
  return blockEntries(getFieldValue(statement, "db_lifecycle")).map((entry) => {
    const directives = {};
    for (let i = 2; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "db_lifecycle",
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

function normalizeStatement(statement, registry) {
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
        invariants: parseInvariantBlock(statement)
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
        output: resolveReferenceList(registry, getFieldValue(statement, "output"))
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
        severity: symbolValue(getFieldValue(statement, "severity")),
        sourceOfTruth: resolveReferenceList(registry, getFieldValue(statement, "source_of_truth"))
      };
    case "decision":
      return {
        ...base,
        context: symbolValues(getFieldValue(statement, "context")),
        consequences: symbolValues(getFieldValue(statement, "consequences"))
      };
    case "projection":
      return {
        ...base,
        platform: symbolValue(getFieldValue(statement, "platform")),
        realizes: resolveReferenceList(registry, getFieldValue(statement, "realizes")),
        outputs: symbolValues(getFieldValue(statement, "outputs")),
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
        uiCollections: parseProjectionUiCollectionsBlock(statement),
        uiActions: parseProjectionUiActionsBlock(statement, registry),
        uiVisibility: parseProjectionUiVisibilityBlock(statement, registry),
        uiLookups: parseProjectionUiLookupsBlock(statement, registry),
        uiRoutes: parseProjectionUiRoutesBlock(statement),
        uiWeb: parseProjectionUiWebBlock(statement, registry),
        uiIos: parseProjectionUiIosBlock(statement, registry),
        uiAppShell: parseProjectionUiAppShellBlock(statement),
        uiNavigation: parseProjectionUiNavigationBlock(statement),
        uiScreenRegions: parseProjectionUiScreenRegionsBlock(statement),
        dbTables: parseProjectionDbTablesBlock(statement, registry),
        dbColumns: parseProjectionDbColumnsBlock(statement, registry),
        dbKeys: parseProjectionDbKeysBlock(statement, registry),
        dbIndexes: parseProjectionDbIndexesBlock(statement, registry),
        dbRelations: parseProjectionDbRelationsBlock(statement, registry),
        dbLifecycle: parseProjectionDbLifecycleBlock(statement, registry),
        generatorDefaults: parseProjectionGeneratorDefaultsBlock(statement)
      };
    case "orchestration":
      return {
        ...base,
        inputs: resolveReferenceList(registry, getFieldValue(statement, "inputs")),
        steps: symbolValues(getFieldValue(statement, "steps")),
        outputs: symbolValues(getFieldValue(statement, "outputs"))
      };
    case "verification":
      return {
        ...base,
        validates: resolveReferenceList(registry, getFieldValue(statement, "validates")),
        method: symbolValue(getFieldValue(statement, "method")),
        scenarios: symbolValues(getFieldValue(statement, "scenarios"))
      };
    case "operation":
      return {
        ...base,
        observes: resolveReferenceList(registry, getFieldValue(statement, "observes")),
        metrics: symbolValues(getFieldValue(statement, "metrics")),
        alerts: symbolValues(getFieldValue(statement, "alerts"))
      };
    case "term":
      return {
        ...base,
        aliases: symbolValues(getFieldValue(statement, "aliases")),
        excludes: symbolValues(getFieldValue(statement, "excludes"))
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

  const errors = [];
  const registry = buildRegistry(workspaceAst, errors);
  const statements = workspaceAst.files.flatMap((file) => file.statements);
  const resolvedStatements = statements.map((statement) => normalizeStatement(statement, registry));
  const byId = new Map(resolvedStatements.map((statement) => [statement.id, statement]));
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
      default:
        return statement;
    }
  });
  const byKind = groupBy(enrichedStatements, (statement) => statement.kind);
  const finalStatements = enrichedStatements.map((statement) => {
    if (statement.kind !== "shape") {
      return statement;
    }

    return {
      ...statement,
      transformGraph: buildShapeTransformGraph(statement, byId)
    };
  });
  const finalByKind = groupBy(finalStatements, (statement) => statement.kind);

  return {
    ok: true,
    validation,
    graph: {
      root: workspaceAst.root,
      statements: finalStatements,
      byKind: finalByKind,
      docs: (workspaceAst.docs || []).filter((doc) => !doc.parseError).map(normalizeDoc)
    }
  };
}

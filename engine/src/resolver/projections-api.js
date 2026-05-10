import { blockEntries, getFieldValue } from "../validator.js";
import { normalizeSequence, tokenValue } from "./shared.js";

export function parseProjectionHttpBlock(statement, registry) {
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

export function parseProjectionHttpErrorsBlock(statement, registry) {
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

export function parseProjectionHttpFieldsBlock(statement, registry) {
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

export function parseProjectionHttpResponsesBlock(statement, registry) {
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

export function parseProjectionHttpPreconditionsBlock(statement, registry) {
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

export function parseProjectionHttpIdempotencyBlock(statement, registry) {
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

export function parseProjectionHttpCacheBlock(statement, registry) {
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

export function parseProjectionHttpDeleteBlock(statement, registry) {
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

export function parseProjectionHttpAsyncBlock(statement, registry) {
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

export function parseProjectionHttpStatusBlock(statement, registry) {
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

export function parseProjectionHttpDownloadBlock(statement, registry) {
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

export function parseProjectionHttpAuthzBlock(statement, registry) {
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

export function parseProjectionHttpCallbacksBlock(statement, registry) {
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

export function parseProjectionHttpResponseDirectives(tokens) {
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

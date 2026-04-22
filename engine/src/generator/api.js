import { fieldSignature, symbolList } from "./shared.js";

const JSON_SCHEMA_DRAFT = "https://json-schema.org/draft/2020-12/schema";

function indexStatements(graph) {
  const byId = new Map();
  for (const statement of graph.statements) {
    byId.set(statement.id, statement);
  }
  return byId;
}

function scalarSchema(typeName, byId) {
  switch (typeName) {
    case "string":
    case "text":
      return { type: "string" };
    case "integer":
      return { type: "integer" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "datetime":
      return { type: "string", format: "date-time" };
    case "uuid":
      return { type: "string", format: "uuid" };
    default: {
      const target = byId.get(typeName);
      if (target?.kind === "enum") {
        return { type: "string", enum: target.values };
      }
      return { type: "string", "x-topogram-type": typeName };
    }
  }
}

function coerceDefaultValue(value, schema) {
  if (value == null) {
    return undefined;
  }

  if (schema.type === "integer") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? value : parsed;
  }

  if (schema.type === "number") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? value : parsed;
  }

  if (schema.type === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
  }

  return value;
}

function schemaForField(field, byId) {
  const schema = scalarSchema(field.fieldType, byId);
  const defaultValue = coerceDefaultValue(field.defaultValue, schema);
  return defaultValue === undefined ? schema : { ...schema, default: defaultValue };
}

function generateShapeJsonSchema(shape, byId) {
  const fields = shape.projectedFields || shape.fields || [];
  const properties = {};
  const required = [];

  for (const field of fields) {
    properties[field.name] = schemaForField(field, byId);
    if (field.requiredness === "required") {
      required.push(field.name);
    }
  }

  const schema = {
    $schema: JSON_SCHEMA_DRAFT,
    $id: `topogram:shape:${shape.id}`,
    title: shape.name || shape.id,
    description: shape.description || undefined,
    type: "object",
    properties,
    additionalProperties: false
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

function getCapability(graph, capabilityId) {
  const byId = indexStatements(graph);
  const capability = byId.get(capabilityId);
  if (!capability || capability.kind !== "capability") {
    throw new Error(`No capability found with id '${capabilityId}'`);
  }
  return capability;
}

function routeSegmentFromCapabilityId(id) {
  return id.replace(/^cap_/, "").replace(/_/g, "-");
}

function methodFromCapability(capability) {
  if (capability.creates.length > 0) return "POST";
  if (capability.updates.length > 0) return "PATCH";
  if (capability.deletes.length > 0) return "DELETE";
  return "GET";
}

function pathFromCapability(capability) {
  const resourceRef =
    capability.creates[0]?.target ||
    capability.updates[0]?.target ||
    capability.deletes[0]?.target ||
    capability.reads[0]?.target;

  const resourceSegment = resourceRef?.id ? resourceRef.id.replace(/^entity_/, "").replace(/_/g, "-") : "resource";
  const opSegment = routeSegmentFromCapabilityId(capability.id);

  if (capability.creates.length > 0) {
    return `/${resourceSegment}`;
  }
  if (capability.updates.length > 0 || capability.deletes.length > 0) {
    return `/${resourceSegment}/{id}`;
  }
  if (capability.id.startsWith("cap_list_")) {
    return `/${resourceSegment}`;
  }
  return `/${resourceSegment}/${opSegment}`;
}

function normalizeResponseMetadata(responseEntry) {
  return {
    mode: responseEntry?.mode || null,
    itemShapeId: responseEntry?.item?.id || null,
    ordering: responseEntry?.sort
      ? {
          field: responseEntry.sort.field,
          direction: responseEntry.sort.direction
        }
      : null,
    cursor: responseEntry?.cursor
      ? {
          requestAfter: responseEntry.cursor.requestAfter,
          responseNext: responseEntry.cursor.responseNext,
          responsePrev: responseEntry.cursor.responsePrev || null
        }
      : null,
    limit: responseEntry?.limit
      ? {
          field: responseEntry.limit.field,
          defaultValue: responseEntry.limit.defaultValue,
          maxValue: responseEntry.limit.maxValue
        }
      : null,
    total: responseEntry?.total
      ? {
          included: responseEntry.total.included
        }
      : null
  };
}

function apiMetadataForCapability(graph, capability) {
  const projections = graph.byKind.projection || [];

  for (const projection of projections) {
    const httpEntry = (projection.http || []).find((entry) => entry.capability?.id === capability.id);
    if (!httpEntry) continue;

    const responseEntry = (projection.httpResponses || []).find((entry) => entry.capability?.id === capability.id);
    return {
      projection: {
        id: projection.id,
        name: projection.name || projection.id
      },
      method: httpEntry.method || methodFromCapability(capability),
      path: httpEntry.path || pathFromCapability(capability),
      success: httpEntry.success || (capability.creates.length > 0 ? 201 : 200),
      auth: httpEntry.auth || "none",
      request: httpEntry.request || (capability.input.length > 0 ? "body" : "none"),
      errorMappings: (projection.httpErrors || [])
        .filter((entry) => entry.capability?.id === capability.id)
        .map((entry) => ({
          code: entry.code,
          status: entry.status
        })),
      fieldBindings: (projection.httpFields || []).filter((entry) => entry.capability?.id === capability.id),
      preconditions: (projection.httpPreconditions || [])
        .filter((entry) => entry.capability?.id === capability.id)
        .map((entry) => ({
          header: entry.header,
          required: entry.required,
          error: entry.error,
          source: entry.source,
          code: entry.code
        })),
      idempotency: (projection.httpIdempotency || [])
        .filter((entry) => entry.capability?.id === capability.id)
        .map((entry) => ({
          header: entry.header,
          required: entry.required,
          error: entry.error,
          code: entry.code
        })),
      cache: (projection.httpCache || [])
        .filter((entry) => entry.capability?.id === capability.id)
        .map((entry) => ({
          responseHeader: entry.responseHeader,
          requestHeader: entry.requestHeader,
          required: entry.required,
          notModified: entry.notModified,
          source: entry.source,
          code: entry.code
        })),
      delete: (projection.httpDelete || [])
        .filter((entry) => entry.capability?.id === capability.id)
        .map((entry) => ({
          mode: entry.mode,
          field: entry.field,
          value: entry.value,
          response: entry.response
        })),
      async: (projection.httpAsync || [])
        .filter((entry) => entry.capability?.id === capability.id)
        .map((entry) => ({
          mode: entry.mode,
          accepted: entry.accepted,
          locationHeader: entry.locationHeader,
          retryAfterHeader: entry.retryAfterHeader,
          statusPath: entry.statusPath,
          statusCapability: entry.statusCapability,
          job: entry.job
        })),
      status: (projection.httpStatus || [])
        .filter((entry) => entry.capability?.id === capability.id)
        .map((entry) => ({
          asyncFor: entry.asyncFor,
          stateField: entry.stateField,
          completed: entry.completed,
          failed: entry.failed,
          expired: entry.expired,
          downloadCapability: entry.downloadCapability,
          downloadField: entry.downloadField,
          errorField: entry.errorField
        })),
      download: (projection.httpDownload || [])
        .filter((entry) => entry.capability?.id === capability.id)
        .map((entry) => ({
          asyncFor: entry.asyncFor,
          media: entry.media,
          filename: entry.filename,
          disposition: entry.disposition
        })),
      authz: (projection.httpAuthz || [])
        .filter((entry) => entry.capability?.id === capability.id)
        .map((entry) => ({
          role: entry.role,
          permission: entry.permission,
          claim: entry.claim,
          claimValue: entry.claimValue,
          ownership: entry.ownership,
          ownershipField: entry.ownershipField
        })),
      callbacks: (projection.httpCallbacks || [])
        .filter((entry) => entry.capability?.id === capability.id)
        .map((entry) => ({
          event: entry.event,
          targetField: entry.targetField,
          method: entry.method,
          payload: entry.payload,
          success: entry.success
        })),
      response: normalizeResponseMetadata(responseEntry)
    };
  }

  return {
    projection: null,
    method: methodFromCapability(capability),
    path: pathFromCapability(capability),
    success: capability.creates.length > 0 ? 201 : 200,
    auth: "none",
    request: capability.input.length > 0 ? "body" : "none",
    errorMappings: [],
    fieldBindings: [],
    preconditions: [],
    idempotency: [],
    cache: [],
    delete: [],
    async: [],
    status: [],
    download: [],
    authz: [],
    callbacks: [],
    response: normalizeResponseMetadata(null)
  };
}

function fieldTransportBindings(contract, apiMetadata, direction) {
  const bindings = (apiMetadata.fieldBindings || []).filter((binding) => binding.direction === direction);
  const byField = new Map(bindings.map((binding) => [binding.field, binding]));
  const inferredBindings = new Map();

  if (direction === "input" && apiMetadata.response?.cursor?.requestAfter) {
    inferredBindings.set(apiMetadata.response.cursor.requestAfter, { location: "query", wireName: "after" });
  }
  if (direction === "input" && apiMetadata.response?.limit?.field) {
    inferredBindings.set(apiMetadata.response.limit.field, { location: "query", wireName: "limit" });
  }

  return contract.fields.map((field) => {
    const binding = byField.get(field.name) || byField.get(field.sourceName) || inferredBindings.get(field.name);
    return {
      ...field,
      transport: {
        location: binding?.location || (direction === "input" ? apiMetadata.request : "body"),
        wireName: binding?.wireName || field.name
      }
    };
  });
}

function splitFieldsByLocation(fields) {
  return {
    path: fields.filter((field) => field.transport.location === "path"),
    query: fields.filter((field) => field.transport.location === "query"),
    header: fields.filter((field) => field.transport.location === "header"),
    body: fields.filter((field) => field.transport.location === "body")
  };
}

function fieldContract(field, byId) {
  return {
    name: field.name,
    sourceName: field.sourceName ?? field.name,
    required: field.requiredness === "required",
    schema: schemaForField(field, byId)
  };
}

function contractFromShape(shape, byId, direction) {
  const fields = (shape.projectedFields || shape.fields || []).map((field) => fieldContract(field, byId));
  return {
    type: direction === "request" ? "api_request_contract" : "api_response_contract",
    shape: {
      id: shape.id,
      name: shape.name || shape.id
    },
    fields,
    required: fields.filter((field) => field.required).map((field) => field.name),
    jsonSchema: generateShapeJsonSchema(shape, byId)
  };
}

function isCollectionCapability(capability, apiMetadata) {
  if (["collection", "paged", "cursor"].includes(apiMetadata?.response?.mode)) return true;
  if (apiMetadata?.response?.mode === "item") return false;
  if ((apiMetadata?.method || "").toUpperCase() !== "GET") return false;
  return capability.id.startsWith("cap_list_");
}

function policyConstraintsForCapability(graph, capability) {
  const rules = graph.byKind.rule || [];
  return rules
    .filter((rule) => rule.appliesTo.some((target) => target.id === capability.id))
    .map((rule) => ({
      type: "api_policy_constraint",
      rule: {
        id: rule.id,
        name: rule.name || rule.id
      },
      requirement: rule.requirementNode || null,
      condition: rule.conditionNode || null,
      severity: rule.severity
    }));
}

function apiErrorCasesForCapability(capability, policyConstraints, apiMetadata) {
  const errors = [];
  const overrideMap = new Map((apiMetadata.errorMappings || []).map((mapping) => [mapping.code, mapping.status]));

  for (const policy of policyConstraints) {
    errors.push({
      type: "api_error_case",
      code: policy.rule.id,
      status: overrideMap.get(policy.rule.id) || (policy.severity === "error" ? 400 : 422),
      source: "policy"
    });
  }

  if (capability.input.length > 0) {
    errors.push({
      type: "api_error_case",
      code: `${capability.id}_invalid_request`,
      status: overrideMap.get(`${capability.id}_invalid_request`) || 400,
      source: "request_contract"
    });
  }

  if (apiMetadata.response?.mode === "cursor") {
    errors.push({
      type: "api_error_case",
      code: `${capability.id}_invalid_cursor`,
      status: overrideMap.get(`${capability.id}_invalid_cursor`) || 400,
      source: "cursor_contract"
    });
    errors.push({
      type: "api_error_case",
      code: `${capability.id}_invalid_limit`,
      status: overrideMap.get(`${capability.id}_invalid_limit`) || 400,
      source: "cursor_contract"
    });
  }

  for (const precondition of apiMetadata.preconditions || []) {
    errors.push({
      type: "api_error_case",
      code: precondition.code,
      status: precondition.error || 412,
      source: "precondition"
    });
  }

  for (const idempotency of apiMetadata.idempotency || []) {
    errors.push({
      type: "api_error_case",
      code: idempotency.code,
      status: idempotency.error || 409,
      source: "idempotency"
    });
  }

  const seenCodes = new Set(errors.map((error) => error.code));
  for (const mapping of apiMetadata.errorMappings || []) {
    if (seenCodes.has(mapping.code)) continue;
    errors.push({
      type: "api_error_case",
      code: mapping.code,
      status: mapping.status,
      source: "projection_mapping"
    });
  }

  return errors;
}

function cloneSchema(value) {
  return JSON.parse(JSON.stringify(value));
}

function responseContractForCapability(shape, byId, capability, apiMetadata) {
  const baseContract = contractFromShape(shape, byId, "response");
  const responseMode = apiMetadata?.response?.mode || (isCollectionCapability(capability, apiMetadata) ? "collection" : "item");

  if (responseMode === "item") {
    return { ...baseContract, mode: "item", collection: false, itemJsonSchema: null, pagination: null };
  }

  if (responseMode === "paged") {
    return {
      ...baseContract,
      mode: "paged",
      collection: true,
      itemJsonSchema: baseContract.jsonSchema,
      pagination: {
        itemsProperty: "items",
        pageProperty: "page",
        pageSizeProperty: "page_size",
        totalProperty: "total"
      },
      jsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["items", "page", "page_size", "total"],
        properties: {
          items: { type: "array", items: cloneSchema(baseContract.jsonSchema) },
          page: { type: "integer" },
          page_size: { type: "integer" },
          total: { type: "integer" }
        }
      }
    };
  }

  if (responseMode === "cursor") {
    const totalIncluded = apiMetadata.response.total?.included === true;
    return {
      ...baseContract,
      mode: "cursor",
      collection: true,
      itemJsonSchema: baseContract.jsonSchema,
      pagination: null,
      itemShape: { id: shape.id, name: shape.name || shape.id },
      ordering: apiMetadata.response.ordering,
      cursor: apiMetadata.response.cursor,
      limit: apiMetadata.response.limit,
      total: apiMetadata.response.total,
      jsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["items", apiMetadata.response.cursor?.responseNext || "next_cursor"],
        properties: {
          items: { type: "array", items: cloneSchema(baseContract.jsonSchema) },
          [apiMetadata.response.cursor?.responseNext || "next_cursor"]: { type: "string" },
          ...(apiMetadata.response.cursor?.responsePrev
            ? { [apiMetadata.response.cursor.responsePrev]: { type: "string" } }
            : {}),
          ...(totalIncluded ? { total: { type: "integer" } } : {})
        }
      }
    };
  }

  return {
    ...baseContract,
    mode: "collection",
    collection: true,
    itemJsonSchema: baseContract.jsonSchema,
    pagination: null,
    jsonSchema: { type: "array", items: cloneSchema(baseContract.jsonSchema) }
  };
}

function buildApiContractForCapability(graph, capability, byId) {
  const inputShape = capability.input[0]?.id ? byId.get(capability.input[0].id) : null;
  const policyConstraints = policyConstraintsForCapability(graph, capability);
  const apiMetadata = apiMetadataForCapability(graph, capability);
  const outputShapeId = apiMetadata.response.itemShapeId || capability.output[0]?.id || null;
  const outputShape = outputShapeId ? byId.get(outputShapeId) : null;
  const requestContract = inputShape ? contractFromShape(inputShape, byId, "request") : null;
  const responseContract = outputShape ? responseContractForCapability(outputShape, byId, capability, apiMetadata) : null;
  const requestFields = requestContract ? fieldTransportBindings(requestContract, apiMetadata, "input") : [];
  const responseFields = responseContract ? fieldTransportBindings(responseContract, apiMetadata, "output") : [];

  return {
    type: "api_contract_graph",
    capability: {
      id: capability.id,
      name: capability.name || capability.id,
      description: capability.description || null
    },
    endpoint: {
      type: "api_endpoint",
      operationId: capability.id,
      method: apiMetadata.method,
      path: apiMetadata.path,
      successStatus: apiMetadata.success,
      auth: apiMetadata.auth,
      requestPlacement: apiMetadata.request,
      projection: apiMetadata.projection,
      preconditions: apiMetadata.preconditions || [],
      idempotency: apiMetadata.idempotency || [],
      cache: apiMetadata.cache || [],
      delete: apiMetadata.delete || [],
      async: apiMetadata.async || [],
      status: apiMetadata.status || [],
      download: apiMetadata.download || [],
      authz: apiMetadata.authz || [],
      callbacks: apiMetadata.callbacks || [],
      actors: capability.actors.map((actor, index) => ({
        type: "api_actor",
        id: actor.id,
        kind: actor.target?.kind || null,
        order: index
      }))
    },
    requestContract: requestContract
      ? { ...requestContract, fields: requestFields, transport: splitFieldsByLocation(requestFields) }
      : null,
    responseContract: responseContract
      ? { ...responseContract, fields: responseFields, transport: splitFieldsByLocation(responseFields) }
      : null,
    policy: policyConstraints,
    errors: apiErrorCasesForCapability(capability, policyConstraints, apiMetadata)
  };
}

export function generateApiContractGraph(graph, options = {}) {
  const byId = indexStatements(graph);
  const capabilities = graph.byKind.capability || [];

  if (options.capabilityId) {
    return buildApiContractForCapability(graph, getCapability(graph, options.capabilityId), byId);
  }

  const output = {};
  for (const capability of capabilities) {
    output[capability.id] = buildApiContractForCapability(graph, capability, byId);
  }
  return output;
}

export function generateApiContractDebug(graph, options = {}) {
  const capabilities = options.capabilityId ? [getCapability(graph, options.capabilityId)] : graph.byKind.capability || [];
  const byId = indexStatements(graph);
  const lines = [];

  lines.push("# API Contract Debug");
  lines.push("");
  lines.push(`Generated from \`${graph.root}\``);
  lines.push("");

  for (const capability of capabilities) {
    const contract = buildApiContractForCapability(graph, capability, byId);
    lines.push(`## \`${capability.id}\` - ${capability.name || capability.id}`);
    lines.push("");
    if (capability.description) {
      lines.push(capability.description);
      lines.push("");
    }
    lines.push(`Endpoint: \`${contract.endpoint.method} ${contract.endpoint.path}\``);
    lines.push(`Success: \`${contract.endpoint.successStatus}\``);
    lines.push(`Auth: \`${contract.endpoint.auth}\``);
    lines.push(`Request placement: \`${contract.endpoint.requestPlacement}\``);
    if (contract.endpoint.projection?.id) {
      lines.push(`Projection: \`${contract.endpoint.projection.id}\``);
    }
    if (contract.endpoint.preconditions?.length > 0) {
      lines.push(`Preconditions: ${contract.endpoint.preconditions.map((precondition) => `\`${precondition.header}\``).join(", ")}`);
    }
    if (contract.endpoint.idempotency?.length > 0) {
      lines.push(`Idempotency: ${contract.endpoint.idempotency.map((rule) => `\`${rule.header}\``).join(", ")}`);
    }
    if (contract.endpoint.cache?.length > 0) {
      lines.push(`Cache: ${contract.endpoint.cache.map((rule) => `\`${rule.responseHeader}\` via \`${rule.requestHeader}\` -> ${rule.notModified}`).join(", ")}`);
    }
    if (contract.endpoint.delete?.length > 0) {
      lines.push(`Delete: ${contract.endpoint.delete.map((rule) => `\`${rule.mode}\`${rule.field ? ` via \`${rule.field}=${rule.value}\`` : ""} response \`${rule.response}\``).join(", ")}`);
    }
    if (contract.endpoint.async?.length > 0) {
      lines.push(`Async: ${contract.endpoint.async.map((rule) => `\`${rule.mode}\` accepted ${rule.accepted} status \`${rule.statusPath}\`${rule.statusCapability?.id ? ` via \`${rule.statusCapability.id}\`` : ""}`).join(", ")}`);
    }
    if (contract.endpoint.status?.length > 0) {
      lines.push(`Status: ${contract.endpoint.status.map((rule) => `state \`${rule.stateField}\` complete \`${rule.completed}\` fail \`${rule.failed}\`${rule.downloadCapability?.id ? ` download \`${rule.downloadCapability.id}\`` : ""}`).join(", ")}`);
    }
    if (contract.endpoint.download?.length > 0) {
      lines.push(`Download: ${contract.endpoint.download.map((rule) => `\`${rule.media}\` ${rule.disposition}${rule.filename ? ` filename \`${rule.filename}\`` : ""}`).join(", ")}`);
    }
    if (contract.endpoint.authz?.length > 0) {
      lines.push(`Authorization: ${contract.endpoint.authz.map((rule) => [
        rule.role ? `role \`${rule.role}\`` : null,
        rule.permission ? `permission \`${rule.permission}\`` : null,
        rule.claim ? `claim \`${rule.claim}\`${rule.claimValue ? ` = \`${rule.claimValue}\`` : ""}` : null,
        rule.ownership ? `ownership \`${rule.ownership}\`` : null
      ].filter(Boolean).join(", ")).join(" | ")}`);
    }
    if (contract.endpoint.callbacks?.length > 0) {
      lines.push(`Callbacks: ${contract.endpoint.callbacks.map((rule) => `\`${rule.event}\` -> \`${rule.method}\` via \`${rule.targetField}\``).join(", ")}`);
    }
    lines.push(`Actors: ${symbolList(capability.actors)}`);
    lines.push("");

    lines.push("Request contract:");
    if (!contract.requestContract) {
      lines.push("- _none_");
    } else {
      lines.push(`- shape: \`${contract.requestContract.shape.id}\``);
      for (const field of contract.requestContract.fields) {
        lines.push(`- ${fieldSignature({
          name: field.transport?.wireName || field.name,
          sourceName: field.sourceName,
          fieldType: field.schema["x-topogram-type"] || field.schema.type || "unknown",
          requiredness: field.required ? "required" : "optional",
          defaultValue: field.schema.default ?? null
        })} in \`${field.transport?.location}\``);
      }
    }
    lines.push("");

    lines.push("Response contract:");
    if (!contract.responseContract) {
      lines.push("- _none_");
    } else {
      lines.push(`- shape: \`${contract.responseContract.shape.id}\``);
      lines.push(`- mode: \`${contract.responseContract.mode}\``);
      if (contract.responseContract.pagination) {
        lines.push(`- envelope: \`${contract.responseContract.pagination.itemsProperty}\`, \`${contract.responseContract.pagination.pageProperty}\`, \`${contract.responseContract.pagination.pageSizeProperty}\`, \`${contract.responseContract.pagination.totalProperty}\``);
      }
      if (contract.responseContract.cursor) {
        lines.push(`- cursor: request \`${contract.responseContract.cursor.requestAfter}\`, next \`${contract.responseContract.cursor.responseNext}\`${contract.responseContract.cursor.responsePrev ? `, prev \`${contract.responseContract.cursor.responsePrev}\`` : ""}`);
      }
      if (contract.responseContract.limit) {
        lines.push(`- limit: field \`${contract.responseContract.limit.field}\`, default ${contract.responseContract.limit.defaultValue}, max ${contract.responseContract.limit.maxValue}`);
      }
      if (contract.responseContract.ordering) {
        lines.push(`- sort: \`${contract.responseContract.ordering.field} ${contract.responseContract.ordering.direction}\``);
      }
      if (contract.responseContract.total) {
        lines.push(`- total included: \`${contract.responseContract.total.included}\``);
      }
      for (const field of contract.responseContract.fields) {
        lines.push(`- ${fieldSignature({
          name: field.transport?.wireName || field.name,
          sourceName: field.sourceName,
          fieldType: field.schema["x-topogram-type"] || field.schema.type || "unknown",
          requiredness: field.required ? "required" : "optional",
          defaultValue: field.schema.default ?? null
        })} in \`${field.transport?.location}\``);
      }
    }
    lines.push("");

    lines.push("Policy constraints:");
    if (contract.policy.length === 0) {
      lines.push("- _none_");
    } else {
      for (const policy of contract.policy) {
        lines.push(`- \`${policy.rule.id}\` (${policy.severity})`);
      }
    }
    lines.push("");

    lines.push("Error cases:");
    for (const error of contract.errors) {
      lines.push(`- \`${error.code}\` -> ${error.status}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function componentNameFromShape(shapeId, suffix) {
  const base = shapeId.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  return `${base}${suffix}`;
}

function componentNameFromErrorCode(code, suffix = "Error") {
  const base = code
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return `${base}${suffix}`;
}

function refSchema(name) {
  return { $ref: `#/components/schemas/${name}` };
}

function openApiParameter(field, location) {
  return {
    name: field.transport?.wireName || field.name,
    in: location,
    required: location === "path" ? true : field.required,
    schema: cloneSchema(field.schema)
  };
}

function requestBodySchema(contract) {
  const requestFields = contract.requestContract?.transport?.body || [];
  const schema = { type: "object", properties: {}, additionalProperties: false };
  const required = [];

  for (const field of requestFields) {
    schema.properties[field.transport?.wireName || field.name] = cloneSchema(field.schema);
    if (field.required) {
      required.push(field.transport?.wireName || field.name);
    }
  }

  if (required.length > 0) {
    schema.required = required;
  }
  return schema;
}

function responseSchemaForContract(contract, componentNames) {
  if (!contract.responseContract) return null;

  if (contract.responseContract.mode === "paged" || contract.responseContract.mode === "cursor") {
    const envelopeSchemaName = componentNames.responseEnvelope.get(contract.capability.id);
    if (envelopeSchemaName) return refSchema(envelopeSchemaName);
  }

  const responseSchemaName = componentNames.response.get(contract.responseContract.shape.id);
  if (!responseSchemaName) return cloneSchema(contract.responseContract.jsonSchema);

  if (contract.responseContract.collection) {
    return { type: "array", items: refSchema(responseSchemaName) };
  }

  return refSchema(responseSchemaName);
}

function successHeadersForContract(contract) {
  const headerEntries = [
    ...(contract.endpoint.cache || []).map((rule) => [rule.responseHeader, { schema: { type: "string" } }]),
    ...(contract.endpoint.async || []).flatMap((rule) => [
      [rule.locationHeader, { schema: { type: "string" } }],
      [rule.retryAfterHeader, { schema: { type: "integer" } }]
    ]),
    ...(contract.endpoint.download || []).flatMap((rule) =>
      rule.disposition ? [["Content-Disposition", { schema: { type: "string" } }]] : []
    )
  ].filter(([name]) => Boolean(name));

  return headerEntries.length > 0 ? Object.fromEntries(headerEntries) : undefined;
}

function asyncLinksForContract(contract) {
  const links = {};
  for (const rule of contract.endpoint.async || []) {
    if (!rule.statusCapability?.id) continue;
    links[`${rule.statusCapability.id}Status`] = {
      operationId: rule.statusCapability.id,
      parameters: { job_id: "$response.body#/job_id" },
      description: `Follow ${rule.statusCapability.id} to monitor the async job`
    };
  }
  return Object.keys(links).length > 0 ? links : undefined;
}

function statusLinksForContract(contract) {
  const links = {};
  for (const rule of contract.endpoint.status || []) {
    if (!rule.downloadCapability?.id) continue;
    links[`${rule.downloadCapability.id}Download`] = {
      operationId: rule.downloadCapability.id,
      parameters: { job_id: "$response.body#/job_id" },
      description: `Use ${rule.downloadCapability.id} when the job is complete`
    };
  }
  return Object.keys(links).length > 0 ? links : undefined;
}

function authorizationExtension(contract) {
  if (!contract.endpoint.authz || contract.endpoint.authz.length === 0) return undefined;
  return contract.endpoint.authz.map((rule) => ({
    ...(rule.role ? { role: rule.role } : {}),
    ...(rule.permission ? { permission: rule.permission } : {}),
    ...(rule.claim ? { claim: rule.claim } : {}),
    ...(rule.claimValue ? { claimValue: rule.claimValue } : {}),
    ...(rule.ownership ? { ownership: rule.ownership } : {}),
    ...(rule.ownershipField ? { ownershipField: rule.ownershipField } : {})
  }));
}

function callbackExpressionForField(contract, callback) {
  const field = contract.requestContract?.fields?.find(
    (item) => item.name === callback.targetField || item.sourceName === callback.targetField
  );
  const location = field?.transport?.location || contract.endpoint.requestPlacement;
  const wireName = field?.transport?.wireName || callback.targetField;

  if (location === "query") return `{$request.query.${wireName}}`;
  if (location === "header") return `{$request.header.${wireName}}`;
  return `{$request.body#/${wireName}}`;
}

function callbackRequestBodySchema(callback, componentNames) {
  const payloadShapeId = callback.payload?.id || null;
  if (!payloadShapeId) return { type: "object" };
  const schemaName = componentNames.response.get(payloadShapeId);
  return schemaName ? refSchema(schemaName) : { type: "object" };
}

function callbacksObjectForContract(contract, componentNames) {
  if (!contract.endpoint.callbacks || contract.endpoint.callbacks.length === 0) return undefined;
  const callbacks = {};
  for (const callback of contract.endpoint.callbacks) {
    callbacks[callback.event] = {
      [callbackExpressionForField(contract, callback)]: {
        [callback.method.toLowerCase()]: {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: callbackRequestBodySchema(callback, componentNames)
              }
            }
          },
          responses: {
            [String(callback.success || 202)]: { description: "Callback accepted" }
          }
        }
      }
    };
  }
  return callbacks;
}

function operationFromContract(contract, componentNames) {
  const operation = {
    operationId: contract.endpoint.operationId,
    summary: contract.capability.name,
    responses: {}
  };

  if (contract.capability.description) {
    operation.description = contract.capability.description;
  }

  const authzExtension = authorizationExtension(contract);
  if (authzExtension) {
    operation["x-topogram-authorization"] = authzExtension;
  }

  if (contract.endpoint.auth && contract.endpoint.auth !== "none") {
    operation.security = [{ bearerAuth: [] }];
  }

  const requestFields = contract.requestContract?.transport || { path: [], query: [], header: [], body: [] };
  const parameters = [
    ...requestFields.path.map((field) => openApiParameter(field, "path")),
    ...requestFields.query.map((field) => openApiParameter(field, "query")),
    ...requestFields.header.map((field) => openApiParameter(field, "header")),
    ...(contract.endpoint.preconditions || []).map((precondition) => ({
      name: precondition.header,
      in: "header",
      required: precondition.required,
      schema: { type: "string" }
    })),
    ...(contract.endpoint.idempotency || []).map((rule) => ({
      name: rule.header,
      in: "header",
      required: rule.required,
      schema: { type: "string" }
    })),
    ...(contract.endpoint.cache || []).map((rule) => ({
      name: rule.requestHeader,
      in: "header",
      required: rule.required,
      schema: { type: "string" }
    }))
  ];
  if (parameters.length > 0) operation.parameters = parameters;

  const callbacks = callbacksObjectForContract(contract, componentNames);
  if (callbacks) {
    operation.callbacks = callbacks;
  }

  if (requestFields.body.length > 0 && contract.requestContract) {
    const requestSchemaName = componentNames.request.get(contract.capability.id);
    operation.requestBody = {
      required: requestFields.body.some((field) => field.required),
      content: {
        "application/json": {
          schema: requestSchemaName ? refSchema(requestSchemaName) : { type: "object" }
        }
      }
    };
  }

  if (contract.endpoint.download?.length > 0) {
    const rule = contract.endpoint.download[0];
    operation.responses[String(contract.endpoint.successStatus)] = {
      description: "Success",
      headers: successHeadersForContract(contract),
      content: {
        [rule.media || "application/octet-stream"]: {
          schema: { type: "string", format: "binary" }
        }
      }
    };
  } else if (contract.responseContract) {
    operation.responses[String(contract.endpoint.successStatus)] = {
      description: contract.endpoint.async?.length > 0 ? "Accepted" : "Success",
      headers: successHeadersForContract(contract),
      content: {
        "application/json": {
          schema: responseSchemaForContract(contract, componentNames) || { type: "object" }
        }
      },
      ...(contract.endpoint.async?.length > 0 ? { links: asyncLinksForContract(contract) } : {}),
      ...(contract.endpoint.status?.length > 0 ? { links: statusLinksForContract(contract) } : {})
    };
  } else {
    operation.responses[String(contract.endpoint.successStatus)] = {
      description: contract.endpoint.async?.length > 0 ? "Accepted" : "Success",
      headers: successHeadersForContract(contract)
    };
  }

  for (const cacheRule of contract.endpoint.cache || []) {
    const status = String(cacheRule.notModified || 304);
    operation.responses[status] = {
      description: "Not Modified",
      headers: {
        [cacheRule.responseHeader]: { schema: { type: "string" } }
      }
    };
  }

  for (const [status, errors] of groupedErrorsByStatus(contract.errors)) {
    if (operation.responses[status]) continue;
    if (errors.length === 1) {
      operation.responses[status] = { $ref: `#/components/responses/${errorResponseComponentName(errors[0])}` };
      continue;
    }
    operation.responses[status] = {
      description: `Error (${status})`,
      content: {
        "application/json": {
          schema: { oneOf: errors.map((error) => refSchema(errorSchemaComponentName(error))) }
        }
      }
    };
  }

  return operation;
}

function errorResponseComponentName(error) {
  return `${componentNameFromErrorCode(error.code)}Response`;
}

function errorSchemaComponentName(error) {
  return componentNameFromErrorCode(error.code);
}

function titleFromIdentifier(id) {
  return id.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function errorResponseDescription(error) {
  return `${titleFromIdentifier(error.code)} (${error.status})`;
}

function groupedErrorsByStatus(errors) {
  const grouped = new Map();
  for (const error of errors) {
    const status = String(error.status);
    if (!grouped.has(status)) grouped.set(status, []);
    grouped.get(status).push(error);
  }
  return grouped;
}

export function generateOpenApi(graph, options = {}) {
  const contractGraph = generateApiContractGraph(graph, options);
  const contracts = options.capabilityId ? [contractGraph] : Object.values(contractGraph);
  const byId = indexStatements(graph);
  const document = {
    openapi: "3.1.0",
    info: {
      title: "Topogram API",
      version: "0.1.0"
    },
    paths: {},
    components: {
      schemas: {
        ErrorResponse: {
          type: "object",
          additionalProperties: false,
          required: ["code", "message"],
          properties: {
            code: { type: "string" },
            message: { type: "string" },
            details: { type: "object", additionalProperties: true }
          }
        }
      },
      responses: {},
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" }
      }
    }
  };

  const componentNames = {
    request: new Map(),
    response: new Map(),
    responseEnvelope: new Map()
  };

  for (const contract of contracts) {
    if (contract.requestContract && contract.requestContract.transport.body.length > 0) {
      const requestSchemaName = componentNameFromShape(contract.requestContract.shape.id, "Request");
      componentNames.request.set(contract.capability.id, requestSchemaName);
      document.components.schemas[requestSchemaName] = requestBodySchema(contract);
    }

    if (contract.responseContract) {
      const responseSchemaName = componentNameFromShape(contract.responseContract.shape.id, "Response");
      componentNames.response.set(contract.responseContract.shape.id, responseSchemaName);
      if (!document.components.schemas[responseSchemaName]) {
        document.components.schemas[responseSchemaName] = cloneSchema(
          contract.responseContract.collection ? contract.responseContract.itemJsonSchema : contract.responseContract.jsonSchema
        );
      }

      if (
        (contract.responseContract.mode === "paged" || contract.responseContract.mode === "cursor") &&
        (contract.responseContract.pagination || contract.responseContract.cursor)
      ) {
        const envelopeSuffix = contract.responseContract.mode === "cursor" ? "CursorPageResponse" : "PageResponse";
        const envelopeSchemaName = componentNameFromShape(contract.responseContract.shape.id, envelopeSuffix);
        componentNames.responseEnvelope.set(contract.capability.id, envelopeSchemaName);
        if (!document.components.schemas[envelopeSchemaName]) {
          if (contract.responseContract.mode === "paged") {
            const pagination = contract.responseContract.pagination;
            document.components.schemas[envelopeSchemaName] = {
              type: "object",
              additionalProperties: false,
              required: [
                pagination.itemsProperty,
                pagination.pageProperty,
                pagination.pageSizeProperty,
                pagination.totalProperty
              ],
              properties: {
                [pagination.itemsProperty]: { type: "array", items: refSchema(responseSchemaName) },
                [pagination.pageProperty]: { type: "integer" },
                [pagination.pageSizeProperty]: { type: "integer" },
                [pagination.totalProperty]: { type: "integer" }
              }
            };
          } else {
            const cursor = contract.responseContract.cursor;
            const includeTotal = contract.responseContract.total?.included === true;
            document.components.schemas[envelopeSchemaName] = {
              type: "object",
              additionalProperties: false,
              required: ["items", cursor.responseNext],
              properties: {
                items: { type: "array", items: refSchema(responseSchemaName) },
                [cursor.responseNext]: { type: "string" },
                ...(cursor.responsePrev ? { [cursor.responsePrev]: { type: "string" } } : {}),
                ...(includeTotal ? { total: { type: "integer" } } : {})
              }
            };
          }
        }
      }
    }

    for (const callback of contract.endpoint.callbacks || []) {
      const payloadShapeId = callback.payload?.id || null;
      if (!payloadShapeId) continue;
      const payloadShape = byId.get(payloadShapeId);
      if (!payloadShape) continue;
      const responseSchemaName = componentNameFromShape(payloadShapeId, "Response");
      componentNames.response.set(payloadShapeId, responseSchemaName);
      if (!document.components.schemas[responseSchemaName]) {
        document.components.schemas[responseSchemaName] = cloneSchema(generateShapeJsonSchema(payloadShape, byId));
      }
    }

    for (const error of contract.errors) {
      const schemaName = errorSchemaComponentName(error);
      if (!document.components.schemas[schemaName]) {
        document.components.schemas[schemaName] = {
          allOf: [
            refSchema("ErrorResponse"),
            {
              type: "object",
              properties: {
                code: { type: "string", const: error.code }
              }
            }
          ],
          title: titleFromIdentifier(error.code)
        };
      }

      const componentName = errorResponseComponentName(error);
      if (!document.components.responses[componentName]) {
        document.components.responses[componentName] = {
          description: errorResponseDescription(error),
          content: {
            "application/json": {
              schema: refSchema(schemaName)
            }
          }
        };
      }
    }
  }

  for (const contract of contracts) {
    const pathKey = contract.endpoint.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    if (!document.paths[pathKey]) {
      document.paths[pathKey] = {};
    }
    document.paths[pathKey][contract.endpoint.method.toLowerCase()] = operationFromContract(contract, componentNames);
  }

  const needsSecurity = contracts.some((contract) => contract.endpoint.auth && contract.endpoint.auth !== "none");
  if (!needsSecurity) {
    delete document.components.securitySchemes;
    if (Object.keys(document.components.schemas || {}).length === 0) delete document.components.schemas;
    if (Object.keys(document.components.responses || {}).length === 0) delete document.components.responses;
    if (Object.keys(document.components).length === 0) delete document.components;
  }

  return document;
}

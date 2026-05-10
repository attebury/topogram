import { fieldSignature, symbolList } from "../shared.js";
import { apiMetadataForCapability } from "./metadata.js";
import { cloneSchema, generateShapeJsonSchema, indexStatements, schemaForField } from "./schema.js";

/**
 * @param {import("./types.d.ts").ApiGraph} graph
 * @param {string} capabilityId
 * @returns {any}
 */
export function getCapability(graph, capabilityId) {
  const byId = indexStatements(graph);
  const capability = byId.get(capabilityId);
  if (!capability || capability.kind !== "capability") {
    throw new Error(`No capability found with id '${capabilityId}'`);
  }
  return capability;
}

/**
 * @param {import("./types.d.ts").ApiContract} contract
 * @param {import("./types.d.ts").ApiMetadata} apiMetadata
 * @param {any} direction
 * @returns {any}
 */
export function fieldTransportBindings(contract, apiMetadata, direction) {
  const bindings = (apiMetadata.fieldBindings || []).filter(/** @param {any} binding */ (binding) => binding.direction === direction);
  const byField = new Map(bindings.map(/** @param {any} binding */ (binding) => [binding.field, binding]));
  const inferredBindings = new Map();

  if (direction === "input" && apiMetadata.response?.cursor?.requestAfter) {
    inferredBindings.set(apiMetadata.response.cursor.requestAfter, { location: "query", wireName: "after" });
  }
  if (direction === "input" && apiMetadata.response?.limit?.field) {
    inferredBindings.set(apiMetadata.response.limit.field, { location: "query", wireName: "limit" });
  }

  return contract.fields.map(/** @param {import("./types.d.ts").ApiField} field */ (field) => {
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

/**
 * @param {import("./types.d.ts").ApiField[]} fields
 * @returns {any}
 */
export function splitFieldsByLocation(fields) {
  return {
    path: fields.filter(/** @param {import("./types.d.ts").ApiField} field */ (field) => field.transport.location === "path"),
    query: fields.filter(/** @param {import("./types.d.ts").ApiField} field */ (field) => field.transport.location === "query"),
    header: fields.filter(/** @param {import("./types.d.ts").ApiField} field */ (field) => field.transport.location === "header"),
    body: fields.filter(/** @param {import("./types.d.ts").ApiField} field */ (field) => field.transport.location === "body")
  };
}

/**
 * @param {import("./types.d.ts").ApiField} field
 * @param {any} byId
 * @returns {any}
 */
export function fieldContract(field, byId) {
  return {
    name: field.name,
    sourceName: field.sourceName ?? field.name,
    required: field.requiredness === "required",
    schema: schemaForField(field, byId)
  };
}

/**
 * @param {import("./types.d.ts").ApiShape} shape
 * @param {any} byId
 * @param {any} direction
 * @returns {any}
 */
export function contractFromShape(shape, byId, direction) {
  const fields = (shape.projectedFields || shape.fields || []).map(/** @param {import("./types.d.ts").ApiField} field */ (field) => fieldContract(field, byId));
  return {
    type: direction === "request" ? "api_request_contract" : "api_response_contract",
    shape: {
      id: shape.id,
      name: shape.name || shape.id
    },
    fields,
    required: fields.filter(/** @param {import("./types.d.ts").ApiField} field */ (field) => field.required).map(/** @param {import("./types.d.ts").ApiField} field */ (field) => field.name),
    jsonSchema: generateShapeJsonSchema(shape, byId)
  };
}

/**
 * @param {import("./types.d.ts").ApiCapability} capability
 * @param {import("./types.d.ts").ApiMetadata} apiMetadata
 * @returns {any}
 */
export function isCollectionCapability(capability, apiMetadata) {
  if (["collection", "paged", "cursor"].includes(apiMetadata?.response?.mode)) return true;
  if (apiMetadata?.response?.mode === "item") return false;
  if ((apiMetadata?.method || "").toUpperCase() !== "GET") return false;
  return capability.id.startsWith("cap_list_");
}

/**
 * @param {import("./types.d.ts").ApiGraph} graph
 * @param {import("./types.d.ts").ApiCapability} capability
 * @returns {any}
 */
export function policyConstraintsForCapability(graph, capability) {
  const rules = graph.byKind.rule || [];
  return rules
    .filter(/** @param {any} rule */ (rule) => rule.appliesTo.some(/** @param {any} target */ (target) => target.id === capability.id))
    .map(/** @param {any} rule */ (rule) => ({
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

/**
 * @param {import("./types.d.ts").ApiCapability} capability
 * @param {any} policyConstraints
 * @param {import("./types.d.ts").ApiMetadata} apiMetadata
 * @returns {any}
 */
export function apiErrorCasesForCapability(capability, policyConstraints, apiMetadata) {
  const errors = [];
  const overrideMap = new Map((apiMetadata.errorMappings || []).map(/** @param {any} mapping */ (mapping) => [mapping.code, mapping.status]));

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

  const seenCodes = new Set(errors.map(/** @param {any} error */ (error) => error.code));
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

/**
 * @param {import("./types.d.ts").ApiShape} shape
 * @param {any} byId
 * @param {import("./types.d.ts").ApiCapability} capability
 * @param {import("./types.d.ts").ApiMetadata} apiMetadata
 * @returns {any}
 */
export function responseContractForCapability(shape, byId, capability, apiMetadata) {
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

/**
 * @param {import("./types.d.ts").ApiGraph} graph
 * @param {import("./types.d.ts").ApiCapability} capability
 * @param {any} byId
 * @returns {any}
 */
export function buildApiContractForCapability(graph, capability, byId) {
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
      actors: capability.actors.map(/** @param {any} actor @param {any} index */ (actor, index) => ({
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

/**
 * @param {import("./types.d.ts").ApiGraph} graph
 * @param {import("./types.d.ts").ApiOptions} options
 * @returns {any}
 */
export function generateApiContractGraph(graph, options = {}) {
  const byId = indexStatements(graph);
  const capabilities = graph.byKind.capability || [];

  if (options.capabilityId) {
    return buildApiContractForCapability(graph, getCapability(graph, options.capabilityId), byId);
  }

  const output = /** @type {Record<string, any>} */ ({});
  for (const capability of capabilities) {
    output[capability.id] = buildApiContractForCapability(graph, capability, byId);
  }
  return output;
}

/**
 * @param {import("./types.d.ts").ApiGraph} graph
 * @param {import("./types.d.ts").ApiOptions} options
 * @returns {any}
 */
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
      lines.push(`Preconditions: ${contract.endpoint.preconditions.map(/** @param {any} precondition */ (precondition) => `\`${precondition.header}\``).join(", ")}`);
    }
    if (contract.endpoint.idempotency?.length > 0) {
      lines.push(`Idempotency: ${contract.endpoint.idempotency.map(/** @param {any} rule */ (rule) => `\`${rule.header}\``).join(", ")}`);
    }
    if (contract.endpoint.cache?.length > 0) {
      lines.push(`Cache: ${contract.endpoint.cache.map(/** @param {any} rule */ (rule) => `\`${rule.responseHeader}\` via \`${rule.requestHeader}\` -> ${rule.notModified}`).join(", ")}`);
    }
    if (contract.endpoint.delete?.length > 0) {
      lines.push(`Delete: ${contract.endpoint.delete.map(/** @param {any} rule */ (rule) => `\`${rule.mode}\`${rule.field ? ` via \`${rule.field}=${rule.value}\`` : ""} response \`${rule.response}\``).join(", ")}`);
    }
    if (contract.endpoint.async?.length > 0) {
      lines.push(`Async: ${contract.endpoint.async.map(/** @param {any} rule */ (rule) => `\`${rule.mode}\` accepted ${rule.accepted} status \`${rule.statusPath}\`${rule.statusCapability?.id ? ` via \`${rule.statusCapability.id}\`` : ""}`).join(", ")}`);
    }
    if (contract.endpoint.status?.length > 0) {
      lines.push(`Status: ${contract.endpoint.status.map(/** @param {any} rule */ (rule) => `state \`${rule.stateField}\` complete \`${rule.completed}\` fail \`${rule.failed}\`${rule.downloadCapability?.id ? ` download \`${rule.downloadCapability.id}\`` : ""}`).join(", ")}`);
    }
    if (contract.endpoint.download?.length > 0) {
      lines.push(`Download: ${contract.endpoint.download.map(/** @param {any} rule */ (rule) => `\`${rule.media}\` ${rule.disposition}${rule.filename ? ` filename \`${rule.filename}\`` : ""}`).join(", ")}`);
    }
    if (contract.endpoint.authz?.length > 0) {
      lines.push(`Authorization: ${contract.endpoint.authz.map(/** @param {any} rule */ (rule) => [
        rule.role ? `role \`${rule.role}\`` : null,
        rule.permission ? `permission \`${rule.permission}\`` : null,
        rule.claim ? `claim \`${rule.claim}\`${rule.claimValue ? ` = \`${rule.claimValue}\`` : ""}` : null,
        rule.ownership ? `ownership \`${rule.ownership}\`` : null
      ].filter(Boolean).join(", ")).join(" | ")}`);
    }
    if (contract.endpoint.callbacks?.length > 0) {
      lines.push(`Callbacks: ${contract.endpoint.callbacks.map(/** @param {any} rule */ (rule) => `\`${rule.event}\` -> \`${rule.method}\` via \`${rule.targetField}\``).join(", ")}`);
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

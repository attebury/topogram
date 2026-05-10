import { generateApiContractGraph } from "./contracts.js";
import { cloneSchema, generateShapeJsonSchema, indexStatements } from "./schema.js";

/**
 * @param {any} shapeId
 * @param {any} suffix
 * @returns {any}
 */
export function componentNameFromShape(shapeId, suffix) {
  const base = shapeId.split("_").map(/** @param {any} part */ (part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  return `${base}${suffix}`;
}

/**
 * @param {any} code
 * @param {any} suffix
 * @returns {any}
 */
export function componentNameFromErrorCode(code, suffix = "Error") {
  const base = code
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(/** @param {any} part */ (part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return `${base}${suffix}`;
}

/**
 * @param {any} name
 * @returns {any}
 */
export function refSchema(name) {
  return { $ref: `#/components/schemas/${name}` };
}

/**
 * @param {any} field
 * @param {any} location
 * @returns {any}
 */
export function openApiParameter(field, location) {
  return {
    name: field.transport?.wireName || field.name,
    in: location,
    required: location === "path" ? true : field.required,
    schema: cloneSchema(field.schema)
  };
}

/**
 * @param {any} contract
 * @returns {any}
 */
export function requestBodySchema(contract) {
  const requestFields = contract.requestContract?.transport?.body || [];
  const schema = /** @type {any} */ ({ type: "object", properties: {}, additionalProperties: false });
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

/**
 * @param {any} contract
 * @param {any} componentNames
 * @returns {any}
 */
export function responseSchemaForContract(contract, componentNames) {
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

/**
 * @param {any} contract
 * @returns {any}
 */
export function successHeadersForContract(contract) {
  const headerEntries = [
    ...(contract.endpoint.cache || []).map(/** @param {any} rule */ (rule) => [rule.responseHeader, { schema: { type: "string" } }]),
    ...(contract.endpoint.async || []).flatMap(/** @param {any} rule */ (rule) => [
      [rule.locationHeader, { schema: { type: "string" } }],
      [rule.retryAfterHeader, { schema: { type: "integer" } }]
    ]),
    ...(contract.endpoint.download || []).flatMap(/** @param {any} rule */ (rule) =>
      rule.disposition ? [["Content-Disposition", { schema: { type: "string" } }]] : []
    )
  ].filter(([name]) => Boolean(name));

  return headerEntries.length > 0 ? Object.fromEntries(headerEntries) : undefined;
}

/**
 * @param {any} contract
 * @returns {any}
 */
export function asyncLinksForContract(contract) {
  const links = /** @type {Record<string, any>} */ ({});
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

/**
 * @param {any} contract
 * @returns {any}
 */
export function statusLinksForContract(contract) {
  const links = /** @type {Record<string, any>} */ ({});
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

/**
 * @param {any} contract
 * @returns {any}
 */
export function authorizationExtension(contract) {
  if (!contract.endpoint.authz || contract.endpoint.authz.length === 0) return undefined;
  return contract.endpoint.authz.map(/** @param {any} rule */ (rule) => ({
    ...(rule.role ? { role: rule.role } : {}),
    ...(rule.permission ? { permission: rule.permission } : {}),
    ...(rule.claim ? { claim: rule.claim } : {}),
    ...(rule.claimValue ? { claimValue: rule.claimValue } : {}),
    ...(rule.ownership ? { ownership: rule.ownership } : {}),
    ...(rule.ownershipField ? { ownershipField: rule.ownershipField } : {})
  }));
}

/**
 * @param {any} contract
 * @param {any} callback
 * @returns {any}
 */
export function callbackExpressionForField(contract, callback) {
  const field = contract.requestContract?.fields?.find(
    /** @param {any} item */ (item) => item.name === callback.targetField || item.sourceName === callback.targetField
  );
  const location = field?.transport?.location || contract.endpoint.requestPlacement;
  const wireName = field?.transport?.wireName || callback.targetField;

  if (location === "query") return `{$request.query.${wireName}}`;
  if (location === "header") return `{$request.header.${wireName}}`;
  return `{$request.body#/${wireName}}`;
}

/**
 * @param {any} callback
 * @param {any} componentNames
 * @returns {any}
 */
export function callbackRequestBodySchema(callback, componentNames) {
  const payloadShapeId = callback.payload?.id || null;
  if (!payloadShapeId) return { type: "object" };
  const schemaName = componentNames.response.get(payloadShapeId);
  return schemaName ? refSchema(schemaName) : { type: "object" };
}

/**
 * @param {any} contract
 * @param {any} componentNames
 * @returns {any}
 */
export function callbacksObjectForContract(contract, componentNames) {
  if (!contract.endpoint.callbacks || contract.endpoint.callbacks.length === 0) return undefined;
  const callbacks = /** @type {Record<string, any>} */ ({});
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

/**
 * @param {any} contract
 * @param {any} componentNames
 * @returns {any}
 */
export function operationFromContract(contract, componentNames) {
  const operation = /** @type {any} */ ({
    operationId: contract.endpoint.operationId,
    summary: contract.capability.name,
    responses: {}
  });

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
    ...requestFields.path.map(/** @param {any} field */ (field) => openApiParameter(field, "path")),
    ...requestFields.query.map(/** @param {any} field */ (field) => openApiParameter(field, "query")),
    ...requestFields.header.map(/** @param {any} field */ (field) => openApiParameter(field, "header")),
    ...(contract.endpoint.preconditions || []).map(/** @param {any} precondition */ (precondition) => ({
      name: precondition.header,
      in: "header",
      required: precondition.required,
      schema: { type: "string" }
    })),
    ...(contract.endpoint.idempotency || []).map(/** @param {any} rule */ (rule) => ({
      name: rule.header,
      in: "header",
      required: rule.required,
      schema: { type: "string" }
    })),
    ...(contract.endpoint.cache || []).map(/** @param {any} rule */ (rule) => ({
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
      required: requestFields.body.some(/** @param {any} field */ (field) => field.required),
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
          schema: { oneOf: errors.map(/** @param {any} error */ (error) => refSchema(errorSchemaComponentName(error))) }
        }
      }
    };
  }

  return operation;
}

/**
 * @param {any} error
 * @returns {any}
 */
export function errorResponseComponentName(error) {
  return `${componentNameFromErrorCode(error.code)}Response`;
}

/**
 * @param {any} error
 * @returns {any}
 */
export function errorSchemaComponentName(error) {
  return componentNameFromErrorCode(error.code);
}

/**
 * @param {any} id
 * @returns {any}
 */
export function titleFromIdentifier(id) {
  return id.replace(/[_-]+/g, " ").replace(/\b\w/g, /** @param {any} char */ (char) => char.toUpperCase());
}

/**
 * @param {any} error
 * @returns {any}
 */
export function errorResponseDescription(error) {
  return `${titleFromIdentifier(error.code)} (${error.status})`;
}

/**
 * @param {any} errors
 * @returns {any}
 */
export function groupedErrorsByStatus(errors) {
  const grouped = new Map();
  for (const error of errors) {
    const status = String(error.status);
    if (!grouped.has(status)) grouped.set(status, []);
    grouped.get(status).push(error);
  }
  return grouped;
}

/**
 * @param {any} graph
 * @param {any} options
 * @returns {any}
 */
export function generateOpenApi(graph, options = {}) {
  const contractGraph = generateApiContractGraph(graph, options);
  const contracts = options.capabilityId ? [contractGraph] : Object.values(contractGraph);
  const byId = indexStatements(graph);
  const document = /** @type {any} */ ({
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
  });

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

  const needsSecurity = contracts.some(/** @param {any} contract */ (contract) => contract.endpoint.auth && contract.endpoint.auth !== "none");
  if (!needsSecurity) {
    delete document.components.securitySchemes;
    if (Object.keys(document.components.schemas || {}).length === 0) delete document.components.schemas;
    if (Object.keys(document.components.responses || {}).length === 0) delete document.components.responses;
    if (Object.keys(document.components).length === 0) delete document.components;
  }

  return document;
}

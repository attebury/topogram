// @ts-check

import { slugify, titleCase } from "../../../text-helpers.js";
import { makeCandidateRecord } from "../shared.js";

/** @param {WorkflowRecord} document @param {any} provenance @param {string} sourceKind @returns {any} */
export function parseOpenApiDocument(document, provenance, sourceKind = "openapi") {
  /** @type {any[]} */
  const capabilities = [];
  /** @type {any[]} */
  const routes = [];
  const pathsObject = document.paths || {};
  for (const [endpointPath, operations] of Object.entries(pathsObject)) {
    for (const [method, operation] of Object.entries(operations || {})) {
      const normalizedMethod = method.toUpperCase();
      const operationId = operation.operationId || `candidate_${normalizedMethod.toLowerCase()}_${slugify(endpointPath)}`;
      const requestSchema =
        operation.requestBody?.content?.["application/json"]?.schema?.$ref ||
        operation.requestBody?.content?.["application/json"]?.schema?.type ||
        null;
      const successResponse = Object.entries(operation.responses || {}).find((/** @type {any} */ [status]) => /^2/.test(status));
      const responseSchema =
        successResponse?.[1]?.content?.["application/json"]?.schema?.$ref ||
        successResponse?.[1]?.content?.["application/json"]?.schema?.type ||
        null;
      const parameterHints = extractOpenApiParameterHints(document, endpointPath, operation);
      const requestFieldHints = extractOpenApiSchemaFieldHints(document, operation.requestBody?.content?.["application/json"]?.schema);
      const responseFieldHints = extractOpenApiSchemaFieldHints(document, successResponse?.[1]?.content?.["application/json"]?.schema);
      const securitySchemes = extractOpenApiSecuritySchemes(document, operation);
      capabilities.push(
        makeCandidateRecord({
          kind: "capability",
          idHint: operationId,
          label: operation.summary || titleCase(operationId.replace(/^cap_/, "")),
          confidence: "high",
          sourceKind,
          provenance: `${provenance}#${normalizedMethod} ${endpointPath}`,
          endpoint: {
            method: normalizedMethod,
            path: endpointPath
          },
          input_hint: requestSchema,
          output_hint: responseSchema,
          input_fields: requestFieldHints.body_fields,
          output_fields: responseFieldHints.body_fields,
          path_params: parameterHints.path,
          query_params: parameterHints.query,
          header_params: parameterHints.header,
          security_schemes: securitySchemes,
          auth_hint: securitySchemes.length > 0 ? "secured" : "unknown"
        })
      );
      routes.push({
        path: endpointPath,
        method: normalizedMethod,
        source_kind: sourceKind,
        provenance: `${provenance}#${normalizedMethod} ${endpointPath}`
      });
    }
  }
  return { capabilities, routes };
}

/** @param {string} ref @returns {any} */
function openApiRefName(ref) {
  if (!ref || typeof ref !== "string") {
    return null;
  }
  return ref.split("/").pop() || null;
}

/** @param {WorkflowRecord} document @param {WorkflowRecord} schema @param {Set<any>} seen @returns {any} */
function resolveOpenApiSchema(document, schema, seen = new Set()) {
  if (!schema || typeof schema !== "object") {
    return null;
  }
  if (schema.$ref) {
    if (seen.has(schema.$ref)) {
      return null;
    }
    seen.add(schema.$ref);
    if (!schema.$ref.startsWith("#/")) {
      return null;
    }
    const segments = schema.$ref.slice(2).split("/");
    let current = document;
    for (const segment of segments) {
      current = current?.[segment];
      if (current == null) {
        return null;
      }
    }
    return resolveOpenApiSchema(document, current, seen) || current;
  }
  return schema;
}

/** @param {WorkflowRecord} document @param {WorkflowRecord} schema @param {Set<any>} fields @param {Set<any>} seen @returns {any} */
function collectOpenApiObjectFields(document, schema, fields = new Set(), seen = new Set()) {
  const resolved = resolveOpenApiSchema(document, schema, seen);
  if (!resolved || typeof resolved !== "object") {
    return fields;
  }
  if (resolved.type === "array" && resolved.items) {
    collectOpenApiObjectFields(document, resolved.items, fields, seen);
    return fields;
  }
  for (const propertyName of Object.keys(resolved.properties || {})) {
    fields.add(propertyName);
  }
  for (const entry of resolved.allOf || []) {
    collectOpenApiObjectFields(document, entry, fields, seen);
  }
  for (const entry of resolved.oneOf || []) {
    collectOpenApiObjectFields(document, entry, fields, seen);
  }
  for (const entry of resolved.anyOf || []) {
    collectOpenApiObjectFields(document, entry, fields, seen);
  }
  return fields;
}

/** @param {WorkflowRecord} document @param {WorkflowRecord} schema @returns {any} */
function extractOpenApiSchemaFieldHints(document, schema) {
  const fieldNames = [...collectOpenApiObjectFields(document, schema)].sort();
  return {
    schema_ref: openApiRefName(schema?.$ref || null),
    body_fields: fieldNames
  };
}

/** @param {string} endpointPath @param {WorkflowRecord} operation @returns {any} */
function collectOpenApiParameters(endpointPath, operation) {
  const pathParams = [...String(endpointPath || "").matchAll(/\{([^}]+)\}/g)].map((/** @type {any} */ match) => ({
    name: match[1],
    in: "path",
    required: true
  }));
  return [...pathParams, ...((operation.parameters || []).filter(Boolean))];
}

/** @param {WorkflowRecord} document @param {string} endpointPath @param {WorkflowRecord} operation @returns {any} */
function extractOpenApiParameterHints(document, endpointPath, operation) {
  /** @type {WorkflowRecord} */
  const grouped = {
    path: [],
    query: [],
    header: []
  };
  for (const parameter of collectOpenApiParameters(endpointPath, operation)) {
    const schema = resolveOpenApiSchema(document, parameter.schema || null);
    const target = parameter.in === "query" ? "query" : parameter.in === "header" ? "header" : "path";
    grouped[target].push({
      name: parameter.name,
      required: Boolean(parameter.required),
      type: schema?.type || null
    });
  }
  for (const key of Object.keys(grouped)) {
    grouped[key] = grouped[key].sort((/** @type {any} */ a, /** @type {any} */ b) => a.name.localeCompare(b.name));
  }
  return grouped;
}

/** @param {WorkflowRecord} document @param {WorkflowRecord} operation @returns {any} */
function extractOpenApiSecuritySchemes(document, operation) {
  const securityEntries = [...(operation.security || []), ...(document.security || [])];
  const schemes = new Set();
  for (const entry of securityEntries) {
    for (const key of Object.keys(entry || {})) {
      schemes.add(key);
    }
  }
  return [...schemes].sort();
}

/** @param {string} text @returns {any} */
export function parseOpenApiYaml(text) {
  /** @type {WorkflowRecord} */
  const doc = { paths: {} };
  let currentPath = null;
  let currentMethod = null;
  let inRequestBody = false;
  let inResponses = false;
  let currentResponseStatus = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "");
    if (!line.trim()) {
      continue;
    }
    const pathMatch = line.match(/^\s{2}(\/[^:]+):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      currentMethod = null;
      doc.paths[currentPath] = doc.paths[currentPath] || {};
      inRequestBody = false;
      inResponses = false;
      currentResponseStatus = null;
      continue;
    }
    const methodMatch = line.match(/^\s{4}(get|post|put|patch|delete):\s*$/i);
    if (methodMatch && currentPath) {
      currentMethod = methodMatch[1].toLowerCase();
      doc.paths[currentPath][currentMethod] = { responses: {} };
      inRequestBody = false;
      inResponses = false;
      currentResponseStatus = null;
      continue;
    }
    if (!currentPath || !currentMethod) {
      continue;
    }
    const operation = doc.paths[currentPath][currentMethod];
    const operationIdMatch = line.match(/^\s{6}operationId:\s*(.+)$/);
    if (operationIdMatch) {
      operation.operationId = operationIdMatch[1].trim().replace(/^["']|["']$/g, "");
      continue;
    }
    const summaryMatch = line.match(/^\s{6}summary:\s*(.+)$/);
    if (summaryMatch) {
      operation.summary = summaryMatch[1].trim().replace(/^["']|["']$/g, "");
      continue;
    }
    if (/^\s{6}requestBody:\s*$/.test(line)) {
      inRequestBody = true;
      inResponses = false;
      currentResponseStatus = null;
      continue;
    }
    if (/^\s{6}responses:\s*$/.test(line)) {
      inResponses = true;
      inRequestBody = false;
      currentResponseStatus = null;
      continue;
    }
    const responseStatusMatch = line.match(/^\s{8}['"]?([0-9Xx]{3})['"]?:\s*$/);
    if (inResponses && responseStatusMatch) {
      currentResponseStatus = responseStatusMatch[1];
      operation.responses[currentResponseStatus] = operation.responses[currentResponseStatus] || {};
      continue;
    }
    const refMatch = line.match(/^\s+\$ref:\s*(.+)$/);
    if (refMatch) {
      const ref = refMatch[1].trim().replace(/^["']|["']$/g, "");
      if (inRequestBody) {
        operation.requestBody = operation.requestBody || { content: { "application/json": { schema: {} } } };
        operation.requestBody.content["application/json"].schema.$ref = ref;
      } else if (inResponses && currentResponseStatus) {
        operation.responses[currentResponseStatus].content = operation.responses[currentResponseStatus].content || { "application/json": { schema: {} } };
        operation.responses[currentResponseStatus].content["application/json"].schema.$ref = ref;
      }
    }
  }

  return doc;
}

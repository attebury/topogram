import { findImportFiles, makeCandidateRecord, normalizeOpenApiPath, relativeTo, selectPreferredImportFiles, slugify, titleCase } from "../../core/shared.js";

function openApiRefName(ref) {
  return typeof ref === "string" ? ref.split("/").pop() || null : null;
}

function resolveOpenApiSchema(document, schema, seen = new Set()) {
  if (!schema || typeof schema !== "object") return null;
  if (schema.$ref) {
    if (seen.has(schema.$ref) || !schema.$ref.startsWith("#/")) return null;
    seen.add(schema.$ref);
    let current = document;
    for (const segment of schema.$ref.slice(2).split("/")) {
      current = current?.[segment];
      if (current == null) return null;
    }
    return resolveOpenApiSchema(document, current, seen) || current;
  }
  return schema;
}

function collectOpenApiObjectFields(document, schema, fields = new Set(), seen = new Set()) {
  const resolved = resolveOpenApiSchema(document, schema, seen);
  if (!resolved || typeof resolved !== "object") return fields;
  if (resolved.type === "array" && resolved.items) {
    collectOpenApiObjectFields(document, resolved.items, fields, seen);
    return fields;
  }
  for (const propertyName of Object.keys(resolved.properties || {})) fields.add(propertyName);
  for (const entry of resolved.allOf || []) collectOpenApiObjectFields(document, entry, fields, seen);
  for (const entry of resolved.oneOf || []) collectOpenApiObjectFields(document, entry, fields, seen);
  for (const entry of resolved.anyOf || []) collectOpenApiObjectFields(document, entry, fields, seen);
  return fields;
}

function extractOpenApiSchemaFieldHints(document, schema) {
  return {
    schema_ref: openApiRefName(schema?.$ref || null),
    body_fields: [...collectOpenApiObjectFields(document, schema)].sort()
  };
}

function collectOpenApiParameters(endpointPath, operation) {
  const pathParams = [...String(endpointPath || "").matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: "path",
    required: true
  }));
  return [...pathParams, ...((operation.parameters || []).filter(Boolean))];
}

function extractOpenApiParameterHints(document, endpointPath, operation) {
  const grouped = { path: [], query: [], header: [] };
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
    grouped[key] = grouped[key].sort((a, b) => a.name.localeCompare(b.name));
  }
  return grouped;
}

function extractOpenApiSecuritySchemes(document, operation) {
  const schemes = new Set();
  for (const entry of [...(operation.security || []), ...(document.security || [])]) {
    for (const key of Object.keys(entry || {})) schemes.add(key);
  }
  return [...schemes].sort();
}

function parseOpenApiYaml(text) {
  const doc = { paths: {} };
  let currentPath = null;
  let currentMethod = null;
  let inRequestBody = false;
  let inResponses = false;
  let currentResponseStatus = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "");
    if (!line.trim()) continue;
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
    if (!currentPath || !currentMethod) continue;
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

function parseOpenApiDocument(document, provenance, sourceKind = "openapi") {
  const capabilities = [];
  const routes = [];
  for (const [endpointPath, operations] of Object.entries(document.paths || {})) {
    for (const [method, operation] of Object.entries(operations || {})) {
      const normalizedMethod = method.toUpperCase();
      const operationId = operation.operationId || `candidate_${normalizedMethod.toLowerCase()}_${slugify(endpointPath)}`;
      const successResponse = Object.entries(operation.responses || {}).find(([status]) => /^2/.test(status));
      const requestFieldHints = extractOpenApiSchemaFieldHints(document, operation.requestBody?.content?.["application/json"]?.schema);
      const responseFieldHints = extractOpenApiSchemaFieldHints(document, successResponse?.[1]?.content?.["application/json"]?.schema);
      const parameterHints = extractOpenApiParameterHints(document, endpointPath, operation);
      const securitySchemes = extractOpenApiSecuritySchemes(document, operation);
      capabilities.push(makeCandidateRecord({
        kind: "capability",
        idHint: operationId,
        label: operation.summary || titleCase(operationId.replace(/^cap_/, "")),
        confidence: "high",
        sourceKind,
        provenance: `${provenance}#${normalizedMethod} ${endpointPath}`,
        endpoint: { method: normalizedMethod, path: endpointPath },
        input_hint: operation.requestBody?.content?.["application/json"]?.schema?.$ref || operation.requestBody?.content?.["application/json"]?.schema?.type || null,
        output_hint: successResponse?.[1]?.content?.["application/json"]?.schema?.$ref || successResponse?.[1]?.content?.["application/json"]?.schema?.type || null,
        input_fields: requestFieldHints.body_fields,
        output_fields: responseFieldHints.body_fields,
        path_params: parameterHints.path,
        query_params: parameterHints.query,
        header_params: parameterHints.header,
        security_schemes: securitySchemes,
        auth_hint: securitySchemes.length > 0 ? "secured" : "unknown",
        track: "api"
      }));
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

export const openApiExtractor = {
  id: "api.openapi",
  track: "api",
  detect(context) {
    const files = selectPreferredImportFiles(
      context.paths,
      findImportFiles(context.paths, (filePath) => /(openapi|swagger)\.(json|ya?ml)$/i.test(filePath)),
      "openapi"
    );
    return {
      score: files.length > 0 ? 100 : 0,
      reasons: files.length > 0 ? ["Found OpenAPI source"] : []
    };
  },
  extract(context) {
    const openApiFiles = selectPreferredImportFiles(
      context.paths,
      findImportFiles(context.paths, (filePath) => /(openapi|swagger)\.(json|ya?ml)$/i.test(filePath)),
      "openapi"
    );
    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };
    for (const filePath of openApiFiles) {
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      const text = context.helpers.readTextIfExists(filePath) || "";
      const document = filePath.endsWith(".json") ? JSON.parse(text) : parseOpenApiYaml(text);
      const parsed = parseOpenApiDocument(document, provenance, "openapi");
      findings.push({ kind: "openapi", file: provenance, capability_count: parsed.capabilities.length });
      candidates.capabilities.push(...parsed.capabilities);
      candidates.routes.push(...parsed.routes.map((route) => ({
        path: route.path,
        method: route.method,
        confidence: "high",
        source_kind: route.source_kind,
        provenance: route.provenance
      })));
    }
    return { findings, candidates };
  }
};

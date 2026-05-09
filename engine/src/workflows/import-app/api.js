// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

import { relativeTo } from "../../path-helpers.js";
import { canonicalCandidateTerm, idHintify, slugify, titleCase } from "../../text-helpers.js";
import { listFilesRecursive, readTextIfExists } from "../shared.js";
import { inferReactRoutes, inferSvelteRoutes, routeSegments } from "./ui.js";
import { dedupeCandidateRecords, findImportFiles, makeCandidateRecord, normalizeOpenApiPath, selectPreferredImportFiles } from "./shared.js";

export function discoverApiSources(paths) {
  const allOpenApiFiles = findImportFiles(
    paths,
    (filePath) =>
      /(openapi|swagger)\.(json|ya?ml)$/i.test(path.basename(filePath))
  );
  const openApiFiles = selectPreferredImportFiles(paths, allOpenApiFiles, "openapi");
  const routeFiles = findImportFiles(
    paths,
    (filePath) =>
      /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) &&
      /(server|api|routes|src)/i.test(filePath)
  );
  return { openApiFiles, routeFiles };
}

function parseOpenApiDocument(document, provenance, sourceKind = "openapi") {
  const capabilities = [];
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
      const successResponse = Object.entries(operation.responses || {}).find(([status]) => /^2/.test(status));
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

function openApiRefName(ref) {
  if (!ref || typeof ref !== "string") {
    return null;
  }
  return ref.split("/").pop() || null;
}

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

function extractOpenApiSchemaFieldHints(document, schema) {
  const fieldNames = [...collectOpenApiObjectFields(document, schema)].sort();
  return {
    schema_ref: openApiRefName(schema?.$ref || null),
    body_fields: fieldNames
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
    grouped[key] = grouped[key].sort((a, b) => a.name.localeCompare(b.name));
  }
  return grouped;
}

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

function parseOpenApiYaml(text) {
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

function inferServerRoutes(paths) {
  const routes = [];
  const routeFiles = findImportFiles(
    paths,
    (filePath) =>
      /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) &&
      /(server|api|routes|src)/i.test(filePath)
  );
  for (const filePath of routeFiles) {
    const text = readTextIfExists(filePath) || "";
    for (const match of text.matchAll(/\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]\s*,([\s\S]*?)\)\s*;?/gi)) {
      const handlerTokens = [...match[3].matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g)].map((entry) => entry[1]);
      const handlerHint = handlerTokens.length > 0 ? handlerTokens[handlerTokens.length - 1] : null;
      const pathParams = [...normalizeOpenApiPath(match[2]).matchAll(/\{([^}]+)\}/g)].map((entry) => entry[1]);
      const handlerContext = handlerHint ? extractHandlerContext(text, handlerHint) : "";
      const queryParams = inferRouteQueryParams(handlerContext);
      const authHint = inferRouteAuthHint(match[3], handlerContext);
      routes.push({
        file: filePath,
        method: match[1].toUpperCase(),
        path: match[2],
        handler_hint: handlerHint,
        path_params: pathParams,
        query_params: queryParams,
        auth_hint: authHint
      });
    }
  }
  return routes;
}

function inferNextApiRoutes(paths) {
  const apiRoot = path.join(paths.workspaceRoot, "app", "api");
  if (!fs.existsSync(apiRoot)) {
    return [];
  }
  const routeFiles = listFilesRecursive(
    apiRoot,
    (child) => /\/route\.(tsx|ts|jsx|js)$/.test(child) || /^route\.(tsx|ts|jsx|js)$/.test(path.basename(child))
  );
  const routes = [];
  for (const filePath of routeFiles) {
    const text = readTextIfExists(filePath) || "";
    const relative = relativeTo(apiRoot, filePath);
    const routePath = `/${relative}`
      .replace(/\/route\.(tsx|ts|jsx|js)$/, "")
      .replace(/\[(\.\.\.)?([^\]]+)\]/g, (_match, catchAll, name) => catchAll ? `:${name}*` : `:${name}`);
    for (const match of text.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(([^)]*)\)/g)) {
      const method = match[1].toUpperCase();
      const handlerContext = extractNamedExportBlock(text, match[1]) || "";
      const queryParams = inferNextRequestSearchParams(handlerContext);
      const outputFields = inferNextJsonFields(handlerContext);
      const authHint = inferRouteAuthHint(match[0], handlerContext);
      routes.push({
        file: filePath,
        method,
        path: routePath === "" ? "/" : routePath,
        handler_hint: match[1].toLowerCase(),
        path_params: [...normalizeOpenApiPath(routePath).matchAll(/\{([^}]+)\}/g)].map((entry) => entry[1]),
        query_params: queryParams,
        output_fields: outputFields,
        auth_hint: authHint,
        source_kind: "route_code"
      });
    }
  }
  return routes;
}

function nextAppRoutePathFromFile(appRoot, filePath) {
  const relative = relativeTo(appRoot, filePath);
  return `/${relative}`
    .replace(/\/actions\.(tsx|ts|jsx|js)$/, "")
    .replace(/\/page\.(tsx|ts|jsx|js|mdx)$/, "")
    .replace(/\[(\.\.\.)?([^\]]+)\]/g, (_match, catchAll, name) => catchAll ? `:${name}*` : `:${name}`)
    .replace(/\/index$/, "")
    .replace(/^\/$/, "/") || "/";
}

function inferFormDataFields(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/formData\.get\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    fields.add(match[1]);
  }
  return [...fields].sort();
}

function inferInputNames(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/\bname=["'`]([^"'`]+)["'`]/g)) {
    fields.add(match[1]);
  }
  return [...fields].sort();
}

function inferNextAuthCapabilities(paths) {
  const authConfigPath = path.join(paths.workspaceRoot, "auth.ts");
  const authConfigText = readTextIfExists(authConfigPath) || "";
  const hasCredentialsProvider = /CredentialsProvider\s*\(/.test(authConfigText);
  const createsUserOnAuthorize = /prisma\.user\.create\s*\(/.test(authConfigText);
  const loginPagePath = path.join(paths.workspaceRoot, "app", "login", "page.tsx");
  const registerPagePath = path.join(paths.workspaceRoot, "app", "register", "page.tsx");
  const pages = [
    {
      file: loginPagePath,
      path: "/login",
      id_hint: "cap_sign_in_user",
      label: "Sign In User",
      target_state: "authenticated"
    },
    {
      file: registerPagePath,
      path: "/register",
      id_hint: "cap_register_user",
      label: "Register User",
      target_state: createsUserOnAuthorize ? "registered" : "created"
    }
  ];
  const capabilities = [];
  for (const page of pages) {
    const text = readTextIfExists(page.file) || "";
    if (!text || !/signIn\(\s*["'`]credentials["'`]/.test(text)) {
      continue;
    }
    const inputFields = inferInputNames(text);
    capabilities.push({
      file: page.file,
      function_name: page.id_hint.replace(/^cap_/, ""),
      method: "POST",
      path: page.path,
      id_hint: page.id_hint,
      label: page.label,
      input_fields: inputFields,
      output_fields: [],
      path_params: [],
      auth_hint: "public",
      entity_id: "entity_user",
      target_state: page.target_state,
      provenance: [
        relativeTo(paths.repoRoot, page.file),
        ...(hasCredentialsProvider ? [relativeTo(paths.repoRoot, authConfigPath)] : [])
      ],
      source_kind: "route_code"
    });
  }
  return capabilities.sort((a, b) => a.id_hint.localeCompare(b.id_hint));
}

function inferNextServerActionCapabilities(paths) {
  const appRoot = path.join(paths.workspaceRoot, "app");
  if (!fs.existsSync(appRoot)) {
    return [];
  }
  const actionFiles = listFilesRecursive(
    appRoot,
    (child) =>
      /\/actions\.(tsx|ts|jsx|js)$/.test(child) ||
      /\/page\.(tsx|ts|jsx|js|mdx)$/.test(child) ||
      /^page\.(tsx|ts|jsx|js|mdx)$/.test(path.basename(child))
  );
  const capabilities = [];
  for (const filePath of actionFiles) {
    const text = readTextIfExists(filePath) || "";
    const routePath = nextAppRoutePathFromFile(appRoot, filePath);
    for (const match of text.matchAll(/(?:export\s+)?async\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{([\s\S]{0,2400}?)\n\}/g)) {
      const functionName = match[1];
      const body = match[3] || "";
      const trimmedBody = body.trimStart();
      const isServerAction =
        /\/actions\.(tsx|ts|jsx|js)$/.test(filePath) ||
        trimmedBody.startsWith('"use server"') ||
        trimmedBody.startsWith("'use server'");
      if (!isServerAction) {
        continue;
      }
      const routeLike = {
        file: filePath,
        method: "POST",
        path: routePath,
        handler_hint: functionName,
        auth_hint: inferRouteAuthHint(functionName, body)
      };
      capabilities.push({
        file: filePath,
        function_name: functionName,
        method: "POST",
        path: routePath,
        id_hint: inferRouteCapabilityId(routeLike),
        input_fields: inferFormDataFields(body),
        output_fields: [],
        path_params: [...normalizeOpenApiPath(routePath).matchAll(/\{([^}]+)\}/g)].map((entry) => entry[1]),
        auth_hint: routeLike.auth_hint,
        entity_id: inferCapabilityEntityId({ endpoint: { path: routePath }, id_hint: inferRouteCapabilityId(routeLike) }),
        source_kind: "route_code"
      });
    }
  }
  return capabilities.sort((a, b) => a.id_hint.localeCompare(b.id_hint) || a.path.localeCompare(b.path));
}

function extractNamedExportBlock(text, exportName) {
  const escapedName = exportName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`export\\s+async\\s+function\\s+${escapedName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,2000}?)\\n\\}`, "m"));
  return match ? match[1] : "";
}

function inferNextRequestSearchParams(text) {
  const params = new Set();
  for (const match of String(text || "").matchAll(/searchParams\.get\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    params.add(match[1]);
  }
  return [...params].sort();
}

function inferNextJsonFields(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/NextResponse\.json\(\s*\{([\s\S]{0,400}?)\}\s*\)/g)) {
    for (const fieldMatch of match[1].matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b\s*[:,]/g)) {
      fields.add(fieldMatch[1]);
    }
  }
  return [...fields].sort();
}

function extractHandlerContext(text, handlerName) {
  if (!handlerName) {
    return "";
  }
  const escapedName = handlerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`function\\s+${escapedName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,1200}?)\\n\\}`, "m"),
    new RegExp(`const\\s+${escapedName}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{([\\s\\S]{0,1200}?)\\n\\}`, "m")
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return "";
}

function inferRouteQueryParams(text) {
  const params = new Set();
  for (const match of String(text || "").matchAll(/\bquery\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    params.add(match[1]);
  }
  for (const match of String(text || "").matchAll(/\bquery\.([A-Za-z_][A-Za-z0-9_]*)\b/g)) {
    params.add(match[1]);
  }
  return [...params].sort();
}

function inferRouteAuthHint(routeArguments, handlerContext) {
  const combined = `${routeArguments || ""}\n${handlerContext || ""}`.toLowerCase();
  return /\b(auth|session|permission|guard|protected|require_auth|requireauth|ensureauth)\b/.test(combined)
    ? "secured"
    : "unknown";
}

function inferRouteCapabilityId(route) {
  if (route.handler_hint) {
    const genericHttpHandler = /^(get|post|put|patch|delete)$/i.test(route.handler_hint);
    if (!genericHttpHandler) {
      const normalizedHandler = route.handler_hint
        .replace(/^(handle|on)/i, "")
        .replace(/(handler|route|controller|action)$/i, "");
      const handlerTokens = normalizedHandler
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((token) => token.toLowerCase());
      if (handlerTokens.length > 0) {
        return `cap_${handlerTokens.join("_")}`;
      }
    }
  }
  const method = String(route.method || "").toUpperCase();
  const segments = routeSegments(normalizeOpenApiPath(route.path));
  const resource = canonicalCandidateTerm(segments[0] || "item");
  if (method === "GET" && segments.length <= 1) {
    return `cap_list_${resource}s`;
  }
  if (method === "GET" && segments.length > 1) {
    return `cap_get_${resource}`;
  }
  if (method === "POST") {
    return `cap_create_${resource}`;
  }
  if (method === "PATCH" || method === "PUT") {
    return `cap_update_${resource}`;
  }
  if (method === "DELETE") {
    return `cap_delete_${resource}`;
  }
  return `candidate_${route.method.toLowerCase()}_${slugify(route.path)}`;
}

export function collectApiImport(paths) {
  const findings = [];
  const candidates = {
    capabilities: [],
    routes: [],
    stacks: []
  };
  const { openApiFiles } = discoverApiSources(paths);
  let usedOpenApi = false;

  for (const filePath of openApiFiles) {
    const provenance = relativeTo(paths.repoRoot, filePath);
    const text = readTextIfExists(filePath) || "";
    const document = filePath.endsWith(".json") ? JSON.parse(text) : parseOpenApiYaml(text);
    const parsed = parseOpenApiDocument(document, provenance, "openapi");
    usedOpenApi = true;
    findings.push({
      kind: "openapi",
      file: provenance,
      capability_count: parsed.capabilities.length
    });
    candidates.capabilities.push(...parsed.capabilities);
    candidates.routes.push(...parsed.routes.map((route) => ({
      path: route.path,
      method: route.method,
      confidence: "high",
      source_kind: route.source_kind,
      provenance: route.provenance
    })));
  }

  if (!usedOpenApi) {
    const inferredRoutes = [
      ...inferNextApiRoutes(paths),
      ...inferServerRoutes(paths)
    ];
    const inferredServerActions = inferNextServerActionCapabilities(paths);
    const inferredAuthCapabilities = inferNextAuthCapabilities(paths);
    if (inferredRoutes.length > 0) {
      findings.push({
        kind: "route_inventory",
        files: [...new Set(inferredRoutes.map((route) => relativeTo(paths.repoRoot, route.file)))],
        route_count: inferredRoutes.length
      });
      candidates.capabilities.push(
        ...inferredRoutes.map((route) =>
          makeCandidateRecord({
            kind: "capability",
            idHint: inferRouteCapabilityId(route),
            label: `${route.method} ${route.path}`,
            confidence: "medium",
            sourceKind: "route_code",
            provenance: `${relativeTo(paths.repoRoot, route.file)}#${route.method} ${route.path}`,
            endpoint: {
              method: route.method,
              path: normalizeOpenApiPath(route.path)
            },
            path_params: (route.path_params || []).map((name) => ({ name, required: true, type: null })),
            query_params: (route.query_params || []).map((name) => ({ name, required: false, type: null })),
            header_params: [],
            input_fields: [],
            output_fields: route.output_fields || [],
            auth_hint: route.auth_hint || "unknown"
          })
        )
      );
      candidates.routes.push(
        ...inferredRoutes.map((route) => ({
          path: normalizeOpenApiPath(route.path),
          method: route.method,
          confidence: "medium",
          source_kind: "route_code",
          provenance: `${relativeTo(paths.repoRoot, route.file)}#${route.method} ${route.path}`
        }))
      );
    }
    if (inferredServerActions.length > 0) {
      findings.push({
        kind: "next_server_actions",
        files: [...new Set(inferredServerActions.map((action) => relativeTo(paths.repoRoot, action.file)))],
        action_count: inferredServerActions.length
      });
      candidates.capabilities.push(
        ...inferredServerActions.map((action) =>
          makeCandidateRecord({
            kind: "capability",
            idHint: action.id_hint,
            label: titleCase(action.id_hint.replace(/^cap_/, "")),
            confidence: "medium",
            sourceKind: action.source_kind,
            provenance: `${relativeTo(paths.repoRoot, action.file)}#${action.function_name}`,
            endpoint: {
              method: action.method,
              path: normalizeOpenApiPath(action.path)
            },
            path_params: (action.path_params || []).map((name) => ({ name, required: true, type: null })),
            query_params: [],
            header_params: [],
            input_fields: action.input_fields || [],
            output_fields: action.output_fields || [],
            auth_hint: action.auth_hint || "unknown"
          })
        )
      );
      candidates.routes.push(
        ...inferredServerActions.map((action) => ({
          path: normalizeOpenApiPath(action.path),
          method: action.method,
          confidence: "medium",
          source_kind: action.source_kind,
          provenance: `${relativeTo(paths.repoRoot, action.file)}#${action.function_name}`
        }))
      );
    }
    if (inferredAuthCapabilities.length > 0) {
      findings.push({
        kind: "next_auth_flows",
        files: [...new Set(inferredAuthCapabilities.flatMap((capability) => capability.provenance || []))],
        capability_count: inferredAuthCapabilities.length
      });
      candidates.capabilities.push(
        ...inferredAuthCapabilities.map((capability) =>
          makeCandidateRecord({
            kind: "capability",
            idHint: capability.id_hint,
            label: capability.label,
            confidence: "medium",
            sourceKind: capability.source_kind,
            provenance: capability.provenance,
            endpoint: {
              method: capability.method,
              path: normalizeOpenApiPath(capability.path)
            },
            path_params: [],
            query_params: [],
            header_params: [],
            input_fields: capability.input_fields || [],
            output_fields: capability.output_fields || [],
            auth_hint: capability.auth_hint || "unknown",
            entity_id: capability.entity_id,
            target_state: capability.target_state || null
          })
        )
      );
      candidates.routes.push(
        ...inferredAuthCapabilities.map((capability) => ({
          path: normalizeOpenApiPath(capability.path),
          method: capability.method,
          confidence: "medium",
          source_kind: capability.source_kind,
          provenance: capability.provenance
        }))
      );
    }
  }

  const reactRoutes = inferReactRoutes(path.join(paths.workspaceRoot, "apps", "web"));
  if (reactRoutes.length > 0) {
    findings.push({
      kind: "react_routes",
      file: relativeTo(paths.repoRoot, path.join(paths.workspaceRoot, "apps", "web", "src", "App.tsx")),
      routes: reactRoutes
    });
    candidates.routes.push(...reactRoutes.map((route) => ({
      path: route,
      method: "GET",
      confidence: "medium",
      source_kind: "generated_artifact",
      provenance: relativeTo(paths.repoRoot, path.join(paths.workspaceRoot, "apps", "web", "src", "App.tsx"))
    })));
    candidates.stacks.push("react_web");
  }

  const svelteRoutes = inferSvelteRoutes(path.join(paths.workspaceRoot, "apps", "web-sveltekit"));
  if (svelteRoutes.length > 0) {
    findings.push({
      kind: "sveltekit_routes",
      file: relativeTo(paths.repoRoot, path.join(paths.workspaceRoot, "apps", "web-sveltekit", "src", "routes")),
      routes: svelteRoutes
    });
    candidates.routes.push(...svelteRoutes.map((route) => ({
      path: route,
      method: "GET",
      confidence: "medium",
      source_kind: "generated_artifact",
      provenance: relativeTo(paths.repoRoot, path.join(paths.workspaceRoot, "apps", "web-sveltekit", "src", "routes"))
    })));
    candidates.stacks.push("sveltekit_web");
  }

  candidates.capabilities = dedupeCandidateRecords(candidates.capabilities, (record) => record.id_hint);
  candidates.routes = dedupeCandidateRecords(
    candidates.routes.map((route) => ({
      ...route,
      id_hint: route.id_hint || `${route.method}_${route.path}`
    })),
    (record) => `${record.method}:${record.path}:${record.source_kind}`
  ).map(({ id_hint, ...route }) => route);

  return { findings, candidates };
}

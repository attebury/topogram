import path from "node:path";

import {
  dedupeCandidateRecords,
  findImportFiles,
  inferApiEntityIdFromPath,
  inferRouteAuthHint,
  inferRouteCapabilityId,
  inferRouteQueryParams,
  makeCandidateRecord,
  normalizeOpenApiPath,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function parseApiRoutesMap(text) {
  const match = text.match(/export\s+const\s+API_ROUTES\s*=\s*\{([\s\S]*?)\}\s*as\s+const/);
  if (!match) return {};
  const entries = {};
  for (const entry of match[1].split(/\r?\n/)) {
    const line = entry.trim().replace(/,$/, "");
    const routeMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*["'`]([^"'`]+)["'`]$/);
    if (routeMatch) {
      entries[routeMatch[1]] = routeMatch[2];
    }
  }
  return entries;
}

function parsePermissionsMetadata(text) {
  const entries = new Map();
  for (const match of text.matchAll(/permissions\.set\(\s*API_ROUTES\.([A-Za-z_][A-Za-z0-9_]*)\s*,\s*\{([\s\S]*?)\}\s*\)/g)) {
    const routeKey = match[1];
    const body = match[2];
    entries.set(routeKey, {
      authenticated: /authenticated:\s*true/.test(body),
      super: /super:\s*true/.test(body)
    });
  }
  return entries;
}

function extractHandlerContext(text, handlerName) {
  if (!handlerName) return "";
  const escaped = handlerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const pattern of [
    new RegExp(`function\\s+${escaped}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,1200}?)\\n\\}`, "m"),
    new RegExp(`const\\s+${escaped}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{([\\s\\S]{0,1200}?)\\n\\}`, "m")
  ]) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return "";
}

function parseExpressRouteCalls(filePath, text, apiRoutes, permissionMeta) {
  const routes = [];
  for (const match of text.matchAll(/app\.(get|post|put|patch|delete)\(\s*([^,]+?)\s*,([\s\S]*?)\)\s*;?/g)) {
    const method = match[1].toUpperCase();
    const rawPath = match[2].trim();
    const args = match[3];
    let routePath = null;
    let routeKey = null;
    const apiRouteRef = rawPath.match(/^API_ROUTES\.([A-Za-z_][A-Za-z0-9_]*)$/);
    if (apiRouteRef) {
      routeKey = apiRouteRef[1];
      routePath = apiRoutes[routeKey] || null;
    } else {
      routePath = rawPath.replace(/^["'`]|["'`]$/g, "");
    }
    if (!routePath) continue;
    const handlerNames = [...args.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g)].map((entry) => entry[1]);
    const filtered = handlerNames.filter((name) => !["app", "get", "post", "put", "patch", "delete"].includes(name));
    const handlerHint = filtered.length > 0 ? filtered[filtered.length - 1] : null;
    const handlerContext = extractHandlerContext(text, handlerHint);
    const meta = routeKey ? permissionMeta.get(routeKey) : null;
    routes.push({
      file: filePath,
      method,
      path: routePath,
      handler_hint: handlerHint,
      path_params: [...routePath.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((entry) => entry[1]),
      query_params: inferRouteQueryParams(handlerContext),
      auth_hint:
        meta?.super || meta?.authenticated
          ? "secured"
          : inferRouteAuthHint(args, handlerContext)
    });
  }
  return routes;
}

export const expressExtractor = {
  id: "api.express",
  track: "api",
  detect(context) {
    const routeFiles = findImportFiles(context.paths, (filePath) => /src\/routes\/.+\.(ts|js|mjs|cjs)$/i.test(filePath));
    return {
      score: routeFiles.length > 0 ? 85 : 0,
      reasons: routeFiles.length > 0 ? ["Found Express route modules"] : []
    };
  },
  extract(context) {
    const permissionsFile = findImportFiles(context.paths, (filePath) => /src\/helpers\/permissions\.(ts|js|mjs|cjs)$/i.test(filePath))[0];
    const permissionsText = permissionsFile ? context.helpers.readTextIfExists(permissionsFile) || "" : "";
    const apiRoutes = parseApiRoutesMap(permissionsText);
    const permissionMeta = parsePermissionsMetadata(permissionsText);
    const routeFiles = findImportFiles(context.paths, (filePath) => /src\/routes\/.+\.(ts|js|mjs|cjs)$/i.test(filePath));
    const routes = routeFiles.flatMap((filePath) =>
      parseExpressRouteCalls(filePath, context.helpers.readTextIfExists(filePath) || "", apiRoutes, permissionMeta)
    );
    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };
    if (routes.length > 0) {
      findings.push({
        kind: "express_routes",
        files: [...new Set(routes.map((route) => relativeTo(context.paths.repoRoot, route.file)))],
        route_count: routes.length
      });
      candidates.capabilities.push(...routes.map((route) => makeCandidateRecord({
        kind: "capability",
        idHint: inferRouteCapabilityId(route),
        label: route.handler_hint ? titleCase(route.handler_hint) : `${route.method} ${route.path}`,
        confidence: "high",
        sourceKind: "route_code",
        provenance: `${relativeTo(context.paths.repoRoot, route.file)}#${route.method} ${route.path}`,
        endpoint: { method: route.method, path: normalizeOpenApiPath(route.path) },
        path_params: (route.path_params || []).map((name) => ({ name, required: true, type: null })),
        query_params: (route.query_params || []).map((name) => ({ name, required: false, type: null })),
        header_params: [],
        input_fields: [],
        output_fields: [],
        auth_hint: route.auth_hint || "unknown",
        entity_id: inferApiEntityIdFromPath(route.path),
        track: "api"
      })));
      candidates.routes.push(...routes.map((route) => ({
        path: normalizeOpenApiPath(route.path),
        method: route.method,
        confidence: "high",
        source_kind: "route_code",
        provenance: `${relativeTo(context.paths.repoRoot, route.file)}#${route.method} ${route.path}`
      })));
      candidates.stacks.push("express");
    }
    candidates.capabilities = dedupeCandidateRecords(candidates.capabilities, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(
      candidates.routes.map((route) => ({ ...route, id_hint: `${route.method}_${route.path}` })),
      (record) => `${record.method}:${record.path}:${record.source_kind}`
    ).map(({ id_hint, ...route }) => route);
    candidates.stacks = [...new Set(candidates.stacks)].sort();
    return { findings, candidates };
  }
};

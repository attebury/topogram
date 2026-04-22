import { findImportFiles, inferRouteAuthHint, inferRouteCapabilityId, inferRouteQueryParams, makeCandidateRecord, normalizeOpenApiPath, relativeTo } from "../../core/shared.js";

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

function inferServerRoutes(context) {
  const routes = [];
  const routeFiles = findImportFiles(
    context.paths,
    (filePath) =>
      /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) &&
      /(server|api|routes|src)/i.test(filePath)
  );
  for (const filePath of routeFiles) {
    const text = context.helpers.readTextIfExists(filePath) || "";
    for (const match of text.matchAll(/\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]\s*,([\s\S]*?)\)\s*;?/gi)) {
      const handlerTokens = [...match[3].matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g)].map((entry) => entry[1]);
      const handlerHint = handlerTokens.length > 0 ? handlerTokens[handlerTokens.length - 1] : null;
      const handlerContext = handlerHint ? extractHandlerContext(text, handlerHint) : "";
      routes.push({
        file: filePath,
        method: match[1].toUpperCase(),
        path: match[2],
        handler_hint: handlerHint,
        path_params: [...normalizeOpenApiPath(match[2]).matchAll(/\{([^}]+)\}/g)].map((entry) => entry[1]),
        query_params: inferRouteQueryParams(handlerContext),
        auth_hint: inferRouteAuthHint(match[3], handlerContext)
      });
    }
  }
  return routes;
}

export const genericRouteFallbackExtractor = {
  id: "api.generic-route-fallback",
  track: "api",
  detect(context) {
    const routes = inferServerRoutes(context);
    return {
      score: routes.length > 0 ? 35 : 0,
      reasons: routes.length > 0 ? ["Found generic server route handlers"] : []
    };
  },
  extract(context) {
    const routes = inferServerRoutes(context);
    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };
    if (routes.length > 0) {
      findings.push({
        kind: "route_inventory",
        files: [...new Set(routes.map((route) => relativeTo(context.paths.repoRoot, route.file)))],
        route_count: routes.length
      });
      candidates.capabilities.push(...routes.map((route) => makeCandidateRecord({
        kind: "capability",
        idHint: inferRouteCapabilityId(route),
        label: `${route.method} ${route.path}`,
        confidence: "medium",
        sourceKind: "route_code",
        provenance: `${relativeTo(context.paths.repoRoot, route.file)}#${route.method} ${route.path}`,
        endpoint: { method: route.method, path: normalizeOpenApiPath(route.path) },
        path_params: (route.path_params || []).map((name) => ({ name, required: true, type: null })),
        query_params: (route.query_params || []).map((name) => ({ name, required: false, type: null })),
        header_params: [],
        input_fields: [],
        output_fields: [],
        auth_hint: route.auth_hint || "unknown",
        track: "api"
      })));
      candidates.routes.push(...routes.map((route) => ({
        path: normalizeOpenApiPath(route.path),
        method: route.method,
        confidence: "medium",
        source_kind: "route_code",
        provenance: `${relativeTo(context.paths.repoRoot, route.file)}#${route.method} ${route.path}`
      })));
    }
    return { findings, candidates };
  }
};

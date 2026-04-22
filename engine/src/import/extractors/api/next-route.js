import { inferNextApiRoutes, inferRouteCapabilityId, makeCandidateRecord, normalizeOpenApiPath, relativeTo } from "../../core/shared.js";

export const nextRouteExtractor = {
  id: "api.next-route",
  track: "api",
  detect(context) {
    const routes = inferNextApiRoutes(context.paths.workspaceRoot, context.helpers);
    return {
      score: routes.length > 0 ? 95 : 0,
      reasons: routes.length > 0 ? ["Found Next.js app/api route handlers"] : []
    };
  },
  extract(context) {
    const routes = inferNextApiRoutes(context.paths.workspaceRoot, context.helpers);
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
        output_fields: route.output_fields || [],
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
      candidates.stacks.push("next_app_router");
    }
    return { findings, candidates };
  }
};

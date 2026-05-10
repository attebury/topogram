// @ts-check

import path from "node:path";

import { relativeTo } from "../../../path-helpers.js";
import { titleCase } from "../../../text-helpers.js";
import { readTextIfExists } from "../../shared.js";
import { dedupeCandidateRecords, makeCandidateRecord, normalizeOpenApiPath } from "../shared.js";
import { inferReactRoutes, inferSvelteRoutes } from "../ui.js";
import { parseOpenApiDocument, parseOpenApiYaml } from "./openapi.js";
import {
  inferNextApiRoutes,
  inferNextAuthCapabilities,
  inferNextServerActionCapabilities,
  inferRouteCapabilityId,
  inferServerRoutes
} from "./routes.js";
import { discoverApiSources } from "./sources.js";

/** @param {WorkspacePaths} paths @returns {any} */
export function collectApiImport(paths) {
  /** @type {any[]} */
  const findings = [];
  /** @type {WorkflowRecord} */
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
    candidates.routes.push(...parsed.routes.map((/** @type {any} */ route) => ({
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
        files: [...new Set(inferredRoutes.map((/** @type {any} */ route) => relativeTo(paths.repoRoot, route.file)))],
        route_count: inferredRoutes.length
      });
      candidates.capabilities.push(
        ...inferredRoutes.map((/** @type {any} */ route) =>
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
            path_params: (route.path_params || []).map((/** @type {any} */ name) => ({ name, required: true, type: null })),
            query_params: (route.query_params || []).map((/** @type {any} */ name) => ({ name, required: false, type: null })),
            header_params: [],
            input_fields: [],
            output_fields: route.output_fields || [],
            auth_hint: route.auth_hint || "unknown"
          })
        )
      );
      candidates.routes.push(
        ...inferredRoutes.map((/** @type {any} */ route) => ({
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
        files: [...new Set(inferredServerActions.map((/** @type {any} */ action) => relativeTo(paths.repoRoot, action.file)))],
        action_count: inferredServerActions.length
      });
      candidates.capabilities.push(
        ...inferredServerActions.map((/** @type {any} */ action) =>
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
            path_params: (action.path_params || []).map((/** @type {any} */ name) => ({ name, required: true, type: null })),
            query_params: [],
            header_params: [],
            input_fields: action.input_fields || [],
            output_fields: action.output_fields || [],
            auth_hint: action.auth_hint || "unknown"
          })
        )
      );
      candidates.routes.push(
        ...inferredServerActions.map((/** @type {any} */ action) => ({
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
        files: [...new Set(inferredAuthCapabilities.flatMap((/** @type {any} */ capability) => capability.provenance || []))],
        capability_count: inferredAuthCapabilities.length
      });
      candidates.capabilities.push(
        ...inferredAuthCapabilities.map((/** @type {any} */ capability) =>
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
        ...inferredAuthCapabilities.map((/** @type {any} */ capability) => ({
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
    candidates.routes.push(...reactRoutes.map((/** @type {any} */ route) => ({
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
    candidates.routes.push(...svelteRoutes.map((/** @type {any} */ route) => ({
      path: route,
      method: "GET",
      confidence: "medium",
      source_kind: "generated_artifact",
      provenance: relativeTo(paths.repoRoot, path.join(paths.workspaceRoot, "apps", "web-sveltekit", "src", "routes"))
    })));
    candidates.stacks.push("sveltekit_web");
  }
  candidates.capabilities = dedupeCandidateRecords(candidates.capabilities, (/** @type {any} */ record) => record.id_hint);
  candidates.routes = dedupeCandidateRecords(
    candidates.routes.map((/** @type {any} */ route) => ({
      ...route,
      id_hint: route.id_hint || `${route.method}_${route.path}`
    })),
    (/** @type {any} */ record) => `${record.method}:${record.path}:${record.source_kind}`
  ).map((/** @type {any} */ record) => {
    const { id_hint, ...route } = record;
    return route;
  });

  return { findings, candidates };
}

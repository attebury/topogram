import path from "node:path";

import {
  dedupeCandidateRecords,
  findImportFiles,
  inferApiEntityIdFromPath,
  inferRouteCapabilityId,
  makeCandidateRecord,
  normalizeOpenApiPath,
  relativeTo,
  titleCase
} from "../../core/shared.js";

const RESOURCE_ACTIONS = {
  index: "GET",
  create: "POST",
  show: "GET",
  update: "PUT",
  destroy: "DELETE"
};

function singularControllerName(resourceName) {
  return String(resourceName || "")
    .replace(/ies$/, "y")
    .replace(/s$/, "");
}

function parseOnlyActions(rawOptions) {
  if (!rawOptions) return null;
  const arrayMatch = rawOptions.match(/only:\s*(\[[^\]]+\]|:[A-Za-z_][A-Za-z0-9_]*)/);
  if (!arrayMatch) return null;
  const rawValue = arrayMatch[1];
  if (rawValue.startsWith(":")) {
    return [rawValue.slice(1)];
  }
  return [...rawValue.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((entry) => entry[1]);
}

function parseParamName(rawOptions) {
  const match = String(rawOptions || "").match(/param:\s*:([A-Za-z_][A-Za-z0-9_]*)/);
  return match ? match[1] : "id";
}

function joinRoutePath(...parts) {
  const normalized = parts
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function buildResourceRoutes(state, resourceName, rawOptions = "") {
  const onlyActions = parseOnlyActions(rawOptions) || ["index", "create", "show", "update", "destroy"];
  const paramName = parseParamName(rawOptions);
  const parentBasePath = state.controller ? (state.memberPath || state.collectionPath) : state.collectionPath;
  const collectionPath = joinRoutePath(parentBasePath, resourceName);
  const memberPath = joinRoutePath(collectionPath, `:${paramName}`);
  const controllerName = resourceName;
  const routes = [];

  for (const action of onlyActions) {
    const method = RESOURCE_ACTIONS[action];
    if (!method) continue;
    routes.push({
      method,
      path: action === "index" || action === "create" ? collectionPath : memberPath,
      handler_hint: null,
      controller: controllerName,
      action,
      auth_hint: "unknown"
    });
  }

  return {
    routes,
    nextState: {
      collectionPath,
      memberPath,
      controller: controllerName,
      singular: singularControllerName(resourceName)
    }
  };
}

function buildExplicitRoute(state, method, rawPath, rawOptions = "") {
  const pathValue = rawPath.startsWith(":") ? rawPath.slice(1) : rawPath.replace(/^["']|["']$/g, "");
  const collectionScoped = /on:\s*:collection/.test(rawOptions);
  const memberScoped = /on:\s*:member/.test(rawOptions);
  const basePath = collectionScoped
    ? (state.collectionPath || state.memberPath || "")
    : memberScoped
      ? (state.memberPath || state.collectionPath || "")
      : (state.memberPath || state.collectionPath || "");
  const pathValueWithLeadingSlash = pathValue.startsWith("/") ? pathValue : `/${pathValue}`;
  const combinedPath = state.controller && !/^\//.test(rawPath)
    ? joinRoutePath(basePath, pathValue)
    : joinRoutePath(state.collectionPath, pathValueWithLeadingSlash);

  const toMatch = String(rawOptions || "").match(/to:\s*["']([^#"']+)#([^"']+)["']/);
  const controllerName = toMatch ? toMatch[1] : state.controller;
  const actionName = toMatch ? toMatch[2] : pathValue;
  const singular = singularControllerName(controllerName || state.singular || "item");
  const preferPathInference = new Set(["index", "show", "create", "update", "destroy", "login", "current", "custom_update"]);
  const handlerHint = actionName && !preferPathInference.has(actionName)
    ? `${actionName}_${singular}`
    : null;

  return {
    method: method.toUpperCase(),
    path: combinedPath,
    handler_hint: handlerHint,
    controller: controllerName,
    action: actionName,
    auth_hint: /auth\/login/.test(combinedPath) ? "public" : "unknown"
  };
}

function parseRailsRoutes(routesText) {
  const routes = [];
  const stack = [{ collectionPath: "", memberPath: "", controller: null, singular: null }];
  const lines = String(routesText || "").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line === "Rails.application.routes.draw do") continue;

    if (line === "end") {
      if (stack.length > 1) stack.pop();
      continue;
    }

    const state = stack[stack.length - 1];

    const scopeMatch = line.match(/^scope\s+:([A-Za-z_][A-Za-z0-9_]*)\s+do$/);
    if (scopeMatch) {
      const segment = scopeMatch[1];
      stack.push({
        ...state,
        collectionPath: joinRoutePath(state.collectionPath, segment),
        memberPath: joinRoutePath(state.memberPath || state.collectionPath, segment)
      });
      continue;
    }

    const resourcesMatch = line.match(/^resources\s+:([A-Za-z_][A-Za-z0-9_]*)(?:,\s*(.*?))?\s*(do)?$/);
    if (resourcesMatch) {
      const [, resourceName, rawOptions = "", hasBlock] = resourcesMatch;
      const built = buildResourceRoutes(state, resourceName, rawOptions);
      routes.push(...built.routes);
      if (hasBlock) {
        stack.push(built.nextState);
      }
      continue;
    }

    const explicitRouteMatch = line.match(/^(get|post|put|patch|delete)\s+(:[A-Za-z_][A-Za-z0-9_]*|["'][^"']+["'])(?:,\s*(.*))?$/);
    if (explicitRouteMatch) {
      const [, method, rawPath, rawOptions = ""] = explicitRouteMatch;
      routes.push(buildExplicitRoute(state, method, rawPath, rawOptions));
    }
  }

  return routes;
}

export const railsRoutesExtractor = {
  id: "api.rails-routes",
  track: "api",
  detect(context) {
    const routeFiles = findImportFiles(context.paths, (filePath) => /config\/routes\.rb$/i.test(filePath));
    return {
      score: routeFiles.length > 0 ? 90 : 0,
      reasons: routeFiles.length > 0 ? ["Found Rails routes.rb"] : []
    };
  },
  extract(context) {
    const routeFiles = findImportFiles(context.paths, (filePath) => /config\/routes\.rb$/i.test(filePath));
    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };

    for (const filePath of routeFiles) {
      let routes = parseRailsRoutes(context.helpers.readTextIfExists(filePath) || "");
      if (routes.some((route) => normalizeOpenApiPath(route.path).startsWith("/api/"))) {
        routes = routes.filter((route) => normalizeOpenApiPath(route.path).startsWith("/api/"));
      }

      const provenanceBase = relativeTo(context.paths.repoRoot, filePath);
      findings.push({
        kind: "rails_routes",
        file: provenanceBase,
        route_count: routes.length
      });

      candidates.capabilities.push(...routes.map((route) => makeCandidateRecord({
        kind: "capability",
        idHint: inferRouteCapabilityId(route),
        label: route.handler_hint ? titleCase(route.handler_hint) : `${route.method} ${route.path}`,
        confidence: "high",
        sourceKind: "route_code",
        provenance: `${provenanceBase}#${route.method} ${route.path}`,
        endpoint: { method: route.method, path: normalizeOpenApiPath(route.path) },
        path_params: [...normalizeOpenApiPath(route.path).matchAll(/\{([^}]+)\}/g)].map((entry) => ({ name: entry[1], required: true, type: null })),
        query_params: [],
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
        provenance: `${provenanceBase}#${route.method} ${route.path}`
      })));
    }

    candidates.capabilities = dedupeCandidateRecords(candidates.capabilities, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(
      candidates.routes.map((route) => ({ ...route, id_hint: `${route.method}_${route.path}` })),
      (record) => `${record.method}:${record.path}:${record.source_kind}`
    ).map(({ id_hint, ...route }) => route);
    candidates.stacks = ["rails"];

    return { findings, candidates };
  }
};

import path from "node:path";

import {
  dedupeCandidateRecords,
  findImportFiles,
  inferApiEntityIdFromPath,
  inferRouteCapabilityId,
  makeCandidateRecord,
  normalizeOpenApiPath,
  readTextIfExists,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function splitClassBlocks(text) {
  const lines = String(text || "").split(/\r?\n/);
  const blocks = [];
  let current = null;
  let headerLines = null;

  for (const line of lines) {
    if (headerLines) {
      headerLines.push(line);
      if (line.includes("):")) {
        const header = headerLines.join(" ");
        const match = header.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*:/);
        if (match) {
          if (current) blocks.push(current);
          current = {
            name: match[1],
            bases: match[2],
            lines: [...headerLines]
          };
        }
        headerLines = null;
      }
      continue;
    }

    const match = line.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:/);
    if (match) {
      if (current) blocks.push(current);
      current = {
        name: match[1],
        bases: match[2],
        lines: [line]
      };
      continue;
    }

    if (/^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.test(line)) {
      headerLines = [line];
      continue;
    }

    if (current) current.lines.push(line);
  }

  if (current) blocks.push(current);
  return blocks;
}

function moduleNameForFile(repoRoot, filePath) {
  return relativeTo(repoRoot, filePath)
    .replace(/\.py$/i, "")
    .replace(/\//g, ".");
}

function routeRegexToPath(regexText) {
  const normalized = String(regexText || "")
    .replace(/^\^/, "")
    .replace(/\$$/, "")
    .replace(/\/\?\$$/, "")
    .replace(/\(\?P<([A-Za-z_][A-Za-z0-9_]*)>[^)]+\)/g, "{$1}")
    .replace(/\/\?/g, "/")
    .replace(/\?/g, "")
    .replace(/\\\//g, "/");
  const trimmed = normalized.replace(/\/+$/, "");
  return trimmed.startsWith("/") ? (trimmed || "/") : `/${trimmed || ""}`.replace(/\/+$/, "") || "/";
}

function permissionAuthHint(permissionText, method) {
  const raw = String(permissionText || "");
  if (/AllowAny/.test(raw)) return "public";
  if (/IsAuthenticatedOrReadOnly/.test(raw)) {
    return method === "GET" ? "public" : "secured";
  }
  if (/IsAuthenticated/.test(raw)) return "secured";
  return "unknown";
}

function buildViewIndex(paths) {
  const viewFiles = findImportFiles(paths, (filePath) => /\/views\.py$/i.test(filePath));
  const index = new Map();

  for (const filePath of viewFiles) {
    const text = readTextIfExists(filePath);
    for (const block of splitClassBlocks(text)) {
      const body = block.lines.join("\n");
      index.set(block.name, {
        name: block.name,
        filePath,
        body,
        bases: block.bases,
        serializer_class: body.match(/serializer_class\s*=\s*([A-Za-z_][A-Za-z0-9_]*)/)?.[1] || null,
        lookup_field: body.match(/lookup_field\s*=\s*['"]([^'"]+)['"]/)?.[1] || "id",
        permission_classes: body.match(/permission_classes\s*=\s*\(([\s\S]{0,120}?)\)/)?.[1] || "",
        methods: [...body.matchAll(/^\s+def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)].map((entry) => entry[1]),
        moduleDir: path.dirname(filePath)
      });
    }
  }

  return index;
}

function viewClassRoutes(basePath, viewMeta) {
  const routes = [];
  const methods = new Set(viewMeta.methods || []);
  const baseNames = String(viewMeta.bases || "");
  const authFor = (method) => permissionAuthHint(viewMeta.permission_classes, method);

  if (/RetrieveUpdateAPIView/.test(baseNames)) {
    routes.push({ method: "GET", path: basePath, auth_hint: authFor("GET") });
    routes.push({ method: "PUT", path: basePath, auth_hint: authFor("PUT") });
    return routes;
  }
  if (/ListCreateAPIView/.test(baseNames)) {
    routes.push({ method: "GET", path: basePath, auth_hint: authFor("GET") });
    routes.push({ method: "POST", path: basePath, auth_hint: authFor("POST") });
    return routes;
  }
  if (/DestroyAPIView/.test(baseNames)) {
    routes.push({ method: "DELETE", path: basePath, auth_hint: authFor("DELETE") });
    return routes;
  }
  if (/ListAPIView/.test(baseNames)) {
    routes.push({ method: "GET", path: basePath, auth_hint: authFor("GET") });
    return routes;
  }
  if (/RetrieveAPIView/.test(baseNames)) {
    routes.push({ method: "GET", path: basePath, auth_hint: authFor("GET") });
    return routes;
  }
  for (const [methodName, httpMethod] of [["get", "GET"], ["post", "POST"], ["put", "PUT"], ["patch", "PATCH"], ["delete", "DELETE"]]) {
    if (methods.has(methodName)) {
      routes.push({ method: httpMethod, path: basePath, auth_hint: authFor(httpMethod) });
    }
  }
  return routes;
}

function viewSetRoutes(prefix, viewMeta) {
  const routes = [];
  const body = viewMeta.body || "";
  const lookupField = viewMeta.lookup_field || "id";
  const collectionPath = `${prefix}`.replace(/\/+$/, "") || "/";
  const memberPath = `${collectionPath}/{${lookupField}}`.replace(/\/+$/, "") || "/";
  const authFor = (method) => permissionAuthHint(viewMeta.permission_classes, method);

  if (/ListModelMixin/.test(viewMeta.bases) || /\bdef\s+list\s*\(/.test(body)) {
    routes.push({ method: "GET", path: collectionPath, auth_hint: authFor("GET") });
  }
  if (/CreateModelMixin/.test(viewMeta.bases) || /\bdef\s+create\s*\(/.test(body)) {
    routes.push({ method: "POST", path: collectionPath, auth_hint: authFor("POST") });
  }
  if (/RetrieveModelMixin/.test(viewMeta.bases) || /\bdef\s+retrieve\s*\(/.test(body)) {
    routes.push({ method: "GET", path: memberPath, auth_hint: authFor("GET") });
  }
  if (/UpdateModelMixin/.test(viewMeta.bases) || /\bdef\s+update\s*\(/.test(body)) {
    routes.push({ method: "PUT", path: memberPath, auth_hint: authFor("PUT") });
  }
  if (/DestroyModelMixin/.test(viewMeta.bases) || /\bdef\s+destroy\s*\(/.test(body)) {
    routes.push({ method: "DELETE", path: memberPath, auth_hint: authFor("DELETE") });
  }
  return routes;
}

function explicitHandlerHint(viewClassName, method, routePath) {
  if (viewClassName === "ProfileFollowAPIView") {
    return method === "POST" ? "follow_profile" : method === "DELETE" ? "unfollow_profile" : null;
  }
  if (viewClassName === "ArticlesFavoriteAPIView") {
    return method === "POST" ? "favorite_article" : method === "DELETE" ? "unfavorite_article" : null;
  }
  if (viewClassName === "ArticlesFeedAPIView") {
    return "feed_article";
  }
  if (viewClassName === "LoginAPIView") {
    return "sign_in_account";
  }
  return null;
}

function parseUrlModule(filePath, repoRoot, moduleMap, viewIndex, prefix = "", visited = new Set()) {
  const moduleName = moduleNameForFile(repoRoot, filePath);
  const visitKey = `${moduleName}:${prefix}`;
  if (visited.has(visitKey)) return [];
  visited.add(visitKey);

  const text = readTextIfExists(filePath) || "";
  const routes = [];
  const routerRegistrations = [...text.matchAll(/router\.register\(\s*r?['"]([^'"]+)['"]\s*,\s*([A-Za-z_][A-Za-z0-9_]*)/g)]
    .map((entry) => ({ resource: entry[1], viewClass: entry[2] }));

  for (const match of text.matchAll(/url\(\s*r['"]([^'"]+)['"]\s*,\s*include\(\s*['"]([^'"]+)['"]/g)) {
    const routePrefix = routeRegexToPath(match[1]);
    const includeModule = match[2];
    const includedFile = moduleMap.get(includeModule);
    if (!includedFile) continue;
    routes.push(...parseUrlModule(includedFile, repoRoot, moduleMap, viewIndex, `${prefix}${routePrefix}`, visited));
  }

  if (/include\(\s*router\.urls\s*\)/.test(text)) {
    for (const registration of routerRegistrations) {
      const viewMeta = viewIndex.get(registration.viewClass);
      if (!viewMeta) continue;
      for (const route of viewSetRoutes(`${prefix}/${registration.resource}`.replace(/\/+/g, "/"), viewMeta)) {
        routes.push({
          ...route,
          view_class: registration.viewClass,
          serializer_class: viewMeta.serializer_class,
          handler_hint: null,
          provenance: `${relativeTo(repoRoot, filePath)}#${route.method} ${route.path}`
        });
      }
    }
  }

  for (const match of text.matchAll(/url\(\s*r['"]([^'"]+)['"]\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\.as_view\(\)\s*\)/g)) {
    const routePath = `${prefix}${routeRegexToPath(match[1])}`.replace(/\/+/g, "/").replace(/\/+$/, "") || "/";
    const viewClassName = match[2];
    const viewMeta = viewIndex.get(viewClassName);
    if (!viewMeta) continue;
    for (const route of viewClassRoutes(routePath, viewMeta)) {
      routes.push({
        ...route,
        view_class: viewClassName,
        serializer_class: viewMeta.serializer_class,
        handler_hint: explicitHandlerHint(viewClassName, route.method, route.path),
        provenance: `${relativeTo(repoRoot, filePath)}#${route.method} ${route.path}`
      });
    }
  }

  return routes;
}

export const djangoRoutesExtractor = {
  id: "api.django-routes",
  track: "api",
  detect(context) {
    const manageFiles = findImportFiles(context.paths, (filePath) => /\/manage\.py$/i.test(filePath));
    const urlFiles = findImportFiles(context.paths, (filePath) => /\/urls\.py$/i.test(filePath));
    const score = manageFiles.length > 0 && urlFiles.length > 0 ? 90 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found Django manage.py and urls.py routing files"] : []
    };
  },
  extract(context) {
    const urlFiles = findImportFiles(context.paths, (filePath) => /\/urls\.py$/i.test(filePath));
    const moduleMap = new Map(urlFiles.map((filePath) => [moduleNameForFile(context.paths.repoRoot, filePath), filePath]));
    const viewIndex = buildViewIndex(context.paths);
    const rootFiles = urlFiles.filter((filePath) => !/\/apps\//.test(filePath));
    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };

    for (const rootFile of rootFiles) {
      let routes = parseUrlModule(rootFile, context.paths.repoRoot, moduleMap, viewIndex);
      if (routes.some((route) => normalizeOpenApiPath(route.path).startsWith("/api/"))) {
        routes = routes.filter((route) => normalizeOpenApiPath(route.path).startsWith("/api/"));
      }

      findings.push({
        kind: "django_routes",
        file: relativeTo(context.paths.repoRoot, rootFile),
        route_count: routes.length
      });

      candidates.capabilities.push(...routes.map((route) => makeCandidateRecord({
        kind: "capability",
        idHint: inferRouteCapabilityId(route),
        label: route.handler_hint ? titleCase(route.handler_hint) : `${route.method} ${route.path}`,
        confidence: "high",
        sourceKind: "route_code",
        provenance: route.provenance,
        endpoint: { method: route.method, path: normalizeOpenApiPath(route.path) },
        path_params: [...normalizeOpenApiPath(route.path).matchAll(/\{([^}]+)\}/g)].map((entry) => ({ name: entry[1], required: true, type: null })),
        query_params: [],
        header_params: [],
        input_fields: [],
        output_fields: [],
        auth_hint: route.auth_hint || "unknown",
        entity_id: inferApiEntityIdFromPath(route.path),
        view_class: route.view_class,
        serializer_class: route.serializer_class,
        track: "api"
      })));

      candidates.routes.push(...routes.map((route) => ({
        path: normalizeOpenApiPath(route.path),
        method: route.method,
        confidence: "high",
        source_kind: "route_code",
        provenance: route.provenance
      })));
    }

    candidates.capabilities = dedupeCandidateRecords(candidates.capabilities, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(
      candidates.routes.map((route) => ({ ...route, id_hint: `${route.method}_${route.path}` })),
      (record) => `${record.method}:${record.path}:${record.source_kind}`
    ).map(({ id_hint, ...route }) => route);
    candidates.stacks = ["django"];
    return { findings, candidates };
  }
};

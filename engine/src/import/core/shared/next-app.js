import fs from "node:fs";
import path from "node:path";

import { relativeTo } from "../../../path-helpers.js";
import { canonicalCandidateTerm, idHintify } from "./candidates.js";
import { listFilesRecursive, readTextIfExists } from "./files.js";
import {
  inferApiCapabilityIdFromOperation,
  inferRouteCapabilityId,
  normalizeEndpointPathForMatch,
  normalizeOpenApiPath
} from "./api-routes.js";
import { entityIdForRoute, screenIdForRoute, screenKindForRoute, uiCapabilityHintsForRoute } from "./ui-routes.js";

/**
 * @param {any} rootDir
 * @returns {any}
 */
export function inferNextAppRoutes(rootDir) {
  const appDir = path.join(rootDir, "app");
  if (!fs.existsSync(appDir)) return [];
  const routeFiles = listFilesRecursive(
    appDir,
    /** @param {any} child */ (child) => /\/page\.(tsx|ts|jsx|js|mdx)$/.test(child) || /\/route\.(tsx|ts|jsx|js)$/.test(child)
  );
  const routes = [];
  for (const filePath of routeFiles) {
    const relative = relativeTo(appDir, filePath);
    const isPage = /\/page\.(tsx|ts|jsx|js|mdx)$/.test(`/${relative}`) || /^page\.(tsx|ts|jsx|js|mdx)$/.test(relative);
    const normalizedPath = `/${relative}`
      .replace(/\/page\.(tsx|ts|jsx|js|mdx)$/, "")
      .replace(/\/route\.(tsx|ts|jsx|js)$/, "")
      .replace(/\[(\.\.\.)?([^\]]+)\]/g, /** @param {any} _m @param {any} catchAll @param {any} name */ (_m, catchAll, name) => catchAll ? `:${name}*` : `:${name}`)
      .replace(/\/index$/, "")
      .replace(/^\/$/, "/");
    routes.push({
      path: normalizedPath === "" ? "/" : normalizedPath,
      kind: isPage ? "page" : "route",
      file: filePath
    });
  }
  return routes.sort(/** @param {any} a @param {any} b */ (a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind));
}

/**
 * @param {any} routePath
 * @returns {any}
 */
export function nextScreenKindForRoute(routePath) {
  const normalized = String(routePath || "");
  if (/\/(login|register|setup)$/.test(normalized)) return "flow";
  return screenKindForRoute(routePath);
}

/**
 * @param {any} routePath
 * @returns {any}
 */
export function nextScreenIdForRoute(routePath) {
  const normalized = String(routePath || "");
  if (normalized === "/") return "home";
  if (/\/login$/.test(normalized)) return "login";
  if (/\/register$/.test(normalized)) return "register";
  if (/\/setup$/.test(normalized)) return "setup";
  return screenIdForRoute(routePath);
}

/**
 * @param {any} routePath
 * @returns {any}
 */
export function entityIdForNextRoute(routePath) {
  const normalized = String(routePath || "");
  if (/^\/posts(\/|$)/.test(normalized)) return "entity_post";
  if (/^\/users(\/|$)/.test(normalized)) return "entity_user";
  return null;
}

/**
 * @param {any} routePath
 * @returns {any}
 */
export function conceptIdForNextRoute(routePath) {
  const normalized = String(routePath || "");
  if (normalized === "/") return "surface_home";
  if (/\/login$/.test(normalized)) return "flow_login";
  if (/\/register$/.test(normalized)) return "flow_register";
  if (/\/setup$/.test(normalized)) return "flow_setup";
  return entityIdForNextRoute(routePath) || entityIdForRoute(routePath);
}

/**
 * @param {any} routePath
 * @returns {any}
 */
export function uiCapabilityHintsForNextRoute(routePath) {
  const normalized = String(routePath || "");
  if (normalized === "/") return { load: null, submit: null, primary_action: null };
  if (/\/login$/.test(normalized)) return { load: null, submit: "cap_sign_in_user", primary_action: "cap_sign_in_user" };
  if (/\/register$/.test(normalized)) return { load: null, submit: "cap_register_user", primary_action: "cap_register_user" };
  if (/\/setup$/.test(normalized)) return { load: null, submit: null, primary_action: null };
  if (/^\/posts\/new$/.test(normalized)) return { load: null, submit: "cap_create_post", primary_action: "cap_create_post" };
  if (/^\/posts\/:id$/.test(normalized) || /^\/posts\/:[^/]+$/.test(normalized)) return { load: "cap_get_post", submit: null, primary_action: "cap_update_post" };
  if (/^\/posts$/.test(normalized)) return { load: "cap_list_posts", submit: null, primary_action: "cap_create_post" };
  if (/^\/users\/new$/.test(normalized)) return { load: null, submit: "cap_create_user", primary_action: "cap_create_user" };
  return uiCapabilityHintsForRoute(routePath);
}

/**
 * @param {any} text
 * @returns {any}
 */
export function inferRouteQueryParams(text) {
  const params = new Set();
  for (const match of String(text || "").matchAll(/\bquery\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) params.add(match[1]);
  for (const match of String(text || "").matchAll(/\bquery\.([A-Za-z_][A-Za-z0-9_]*)\b/g)) params.add(match[1]);
  return [...params].sort();
}

/**
 * @param {any} routeArguments
 * @param {any} handlerContext
 * @returns {any}
 */
export function inferRouteAuthHint(routeArguments, handlerContext) {
  const combined = `${routeArguments || ""}\n${handlerContext || ""}`.toLowerCase();
  if (/\b(signin|sign_in|login|register|credentialsprovider)\b/.test(combined)) {
    return "public";
  }
  return /\b(auth|session|permission|guard|protected|require_auth|requireauth|ensureauth)\b/.test(combined)
    ? "secured"
    : "unknown";
}

/**
 * @param {any} text
 * @param {any} exportName
 * @returns {any}
 */
export function extractNamedExportBlock(text, exportName) {
  const escapedName = exportName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`export\\s+async\\s+function\\s+${escapedName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,2000}?)\\n\\}`, "m"));
  return match ? match[1] : "";
}

/**
 * @param {any} text
 * @returns {any}
 */
export function inferNextRequestSearchParams(text) {
  const params = new Set();
  for (const match of String(text || "").matchAll(/searchParams\.get\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    params.add(match[1]);
  }
  return [...params].sort();
}

/**
 * @param {any} text
 * @returns {any}
 */
export function inferNextJsonFields(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/NextResponse\.json\(\s*\{([\s\S]{0,400}?)\}\s*\)/g)) {
    for (const fieldMatch of match[1].matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b\s*[:,]/g)) {
      fields.add(fieldMatch[1]);
    }
  }
  return [...fields].sort();
}

/**
 * @param {any} text
 * @param {any} handlerName
 * @returns {any}
 */
export function extractHandlerContext(text, handlerName) {
  if (!handlerName) return "";
  const escapedName = handlerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`function\\s+${escapedName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,1200}?)\\n\\}`, "m"),
    new RegExp(`const\\s+${escapedName}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{([\\s\\S]{0,1200}?)\\n\\}`, "m")
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return "";
}

/**
 * @param {any} appRoot
 * @param {any} filePath
 * @returns {any}
 */
export function nextAppRoutePathFromFile(appRoot, filePath) {
  const relative = relativeTo(appRoot, filePath);
  return `/${relative}`
    .replace(/\/actions\.(tsx|ts|jsx|js)$/, "")
    .replace(/\/page\.(tsx|ts|jsx|js|mdx)$/, "")
    .replace(/\[(\.\.\.)?([^\]]+)\]/g, /** @param {any} _match @param {any} catchAll @param {any} name */ (_match, catchAll, name) => catchAll ? `:${name}*` : `:${name}`)
    .replace(/\/index$/, "")
    .replace(/^\/$/, "/") || "/";
}

/**
 * @param {any} text
 * @returns {any}
 */
export function inferFormDataFields(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/formData\.get\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    fields.add(match[1]);
  }
  return [...fields].sort();
}

/**
 * @param {any} text
 * @returns {any}
 */
export function inferInputNames(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/\bname=["'`]([^"'`]+)["'`]/g)) {
    fields.add(match[1]);
  }
  return [...fields].sort();
}

/**
 * @param {any} workspaceRoot
 * @param {any} helpers
 * @returns {any}
 */
export function inferNextApiRoutes(workspaceRoot, helpers = { readTextIfExists }) {
  const apiRoot = path.join(workspaceRoot, "app", "api");
  if (!fs.existsSync(apiRoot)) return [];
  const routeFiles = listFilesRecursive(
    apiRoot,
    /** @param {any} child */ (child) => /\/route\.(tsx|ts|jsx|js)$/.test(child) || /^route\.(tsx|ts|jsx|js)$/.test(path.basename(child))
  );
  const routes = [];
  for (const filePath of routeFiles) {
    const text = helpers.readTextIfExists(filePath) || "";
    const relative = relativeTo(apiRoot, filePath);
    const routePath = `/${relative}`
      .replace(/\/route\.(tsx|ts|jsx|js)$/, "")
      .replace(/\[(\.\.\.)?([^\]]+)\]/g, /** @param {any} _match @param {any} catchAll @param {any} name */ (_match, catchAll, name) => catchAll ? `:${name}*` : `:${name}`);
    for (const match of text.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(([^)]*)\)/g)) {
      const method = match[1].toUpperCase();
      const handlerContext = extractNamedExportBlock(text, match[1]) || "";
      routes.push({
        file: filePath,
        method,
        path: routePath === "" ? "/" : routePath,
        handler_hint: match[1].toLowerCase(),
        path_params: [...normalizeOpenApiPath(routePath).matchAll(/\{([^}]+)\}/g)].map(/** @param {any} entry */ (entry) => entry[1]),
        query_params: inferNextRequestSearchParams(handlerContext),
        output_fields: inferNextJsonFields(handlerContext),
        auth_hint: inferRouteAuthHint(match[0], handlerContext),
        source_kind: "route_code"
      });
    }
  }
  return routes;
}

/**
 * @param {any} record
 * @returns {any}
 */
export function inferCapabilityEntityId(record) {
  if (record.entity_id) {
    return record.entity_id;
  }
  const pathSegments = normalizeEndpointPathForMatch(record.endpoint?.path || "")
    .split("/")
    .filter(Boolean)
    .filter(/** @param {any} segment */ (segment) => segment !== "{}");
  const resourceSegment = pathSegments[0] || String(record.id_hint || "").replace(/^cap_(create|update|delete|get|list)_/, "");
  return `entity_${idHintify(canonicalCandidateTerm(resourceSegment))}`;
}

/**
 * @param {any} workspaceRoot
 * @param {any} helpers
 * @returns {any}
 */
export function inferNextServerActionCapabilities(workspaceRoot, helpers = { readTextIfExists }) {
  const appRoot = path.join(workspaceRoot, "app");
  if (!fs.existsSync(appRoot)) return [];
  const actionFiles = listFilesRecursive(
    appRoot,
    /** @param {any} child */ (child) =>
      /\/actions\.(tsx|ts|jsx|js)$/.test(child) ||
      /\/page\.(tsx|ts|jsx|js|mdx)$/.test(child) ||
      /^page\.(tsx|ts|jsx|js|mdx)$/.test(path.basename(child))
  );
  const capabilities = [];
  for (const filePath of actionFiles) {
    const text = helpers.readTextIfExists(filePath) || "";
    const routePath = nextAppRoutePathFromFile(appRoot, filePath);
    for (const match of text.matchAll(/(?:export\s+)?async\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{([\s\S]{0,2400}?)\n\}/g)) {
      const functionName = match[1];
      const body = match[3] || "";
      const trimmedBody = body.trimStart();
      const isServerAction =
        /\/actions\.(tsx|ts|jsx|js)$/.test(filePath) ||
        trimmedBody.startsWith('"use server"') ||
        trimmedBody.startsWith("'use server'");
      if (!isServerAction) continue;
      const routeLike = {
        file: filePath,
        method: "POST",
        path: routePath,
        handler_hint: functionName,
        auth_hint: inferRouteAuthHint(functionName, body)
      };
      const idHint = inferRouteCapabilityId(routeLike);
      capabilities.push({
        file: filePath,
        function_name: functionName,
        method: "POST",
        path: routePath,
        id_hint: idHint,
        input_fields: inferFormDataFields(body),
        output_fields: [],
        path_params: [...normalizeOpenApiPath(routePath).matchAll(/\{([^}]+)\}/g)].map(/** @param {any} entry */ (entry) => entry[1]),
        auth_hint: routeLike.auth_hint,
        entity_id: inferCapabilityEntityId({ endpoint: { path: routePath }, id_hint: idHint }),
        source_kind: "route_code"
      });
    }
  }
  return capabilities.sort(/** @param {any} a @param {any} b */ (a, b) => a.id_hint.localeCompare(b.id_hint) || a.path.localeCompare(b.path));
}

/**
 * @param {any} paths
 * @param {any} helpers
 * @returns {any}
 */
export function inferNextAuthCapabilities(paths, helpers = { readTextIfExists }) {
  const authConfigPath = path.join(paths.workspaceRoot, "auth.ts");
  const authConfigText = helpers.readTextIfExists(authConfigPath) || "";
  const hasCredentialsProvider = /CredentialsProvider\s*\(/.test(authConfigText);
  const createsUserOnAuthorize = /prisma\.user\.create\s*\(/.test(authConfigText);
  const pages = [
    {
      file: path.join(paths.workspaceRoot, "app", "login", "page.tsx"),
      path: "/login",
      id_hint: "cap_sign_in_user",
      label: "Sign In User",
      target_state: "authenticated"
    },
    {
      file: path.join(paths.workspaceRoot, "app", "register", "page.tsx"),
      path: "/register",
      id_hint: "cap_register_user",
      label: "Register User",
      target_state: createsUserOnAuthorize ? "registered" : "created"
    }
  ];
  const capabilities = [];
  for (const page of pages) {
    const text = helpers.readTextIfExists(page.file) || "";
    if (!text || !/signIn\(\s*["'`]credentials["'`]/.test(text)) continue;
    capabilities.push({
      file: page.file,
      function_name: page.id_hint.replace(/^cap_/, ""),
      method: "POST",
      path: page.path,
      id_hint: page.id_hint,
      label: page.label,
      input_fields: inferInputNames(text),
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
  return capabilities.sort(/** @param {any} a @param {any} b */ (a, b) => a.id_hint.localeCompare(b.id_hint));
}

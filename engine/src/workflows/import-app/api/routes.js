// @ts-check

import fs from "node:fs";
import path from "node:path";

import { relativeTo } from "../../../path-helpers.js";
import { canonicalCandidateTerm, slugify } from "../../../text-helpers.js";
import { listFilesRecursive, readTextIfExists } from "../../shared.js";
import { findImportFiles, inferCapabilityEntityId, normalizeOpenApiPath } from "../shared.js";
import { routeSegments } from "../ui.js";

/** @param {WorkspacePaths} paths @returns {any} */
export function inferServerRoutes(paths) {
  /** @type {any[]} */
  const routes = [];
  const routeFiles = findImportFiles(
    paths,
    (/** @type {any} */ filePath) =>
      /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) &&
      /(server|api|routes|src)/i.test(filePath)
  );
  for (const filePath of routeFiles) {
    const text = readTextIfExists(filePath) || "";
    for (const match of text.matchAll(/\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]\s*,([\s\S]*?)\)\s*;?/gi)) {
      const handlerTokens = [...match[3].matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g)].map((/** @type {any} */ entry) => entry[1]);
      const handlerHint = handlerTokens.length > 0 ? handlerTokens[handlerTokens.length - 1] : null;
      const pathParams = [...normalizeOpenApiPath(match[2]).matchAll(/\{([^}]+)\}/g)].map((/** @type {any} */ entry) => entry[1]);
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

/** @param {WorkspacePaths} paths @returns {any} */
export function inferNextApiRoutes(paths) {
  const apiRoot = path.join(paths.workspaceRoot, "app", "api");
  if (!fs.existsSync(apiRoot)) {
    return [];
  }
  const routeFiles = listFilesRecursive(
    apiRoot,
    (/** @type {any} */ child) => /\/route\.(tsx|ts|jsx|js)$/.test(child) || /^route\.(tsx|ts|jsx|js)$/.test(path.basename(child))
  );
  /** @type {any[]} */
  const routes = [];
  for (const filePath of routeFiles) {
    const text = readTextIfExists(filePath) || "";
    const relative = relativeTo(apiRoot, filePath);
    const routePath = `/${relative}`
      .replace(/\/route\.(tsx|ts|jsx|js)$/, "")
      .replace(/\[(\.\.\.)?([^\]]+)\]/g, (/** @type {any} */ _match, /** @type {any} */ catchAll, /** @type {any} */ name) => catchAll ? `:${name}*` : `:${name}`);
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
        path_params: [...normalizeOpenApiPath(routePath).matchAll(/\{([^}]+)\}/g)].map((/** @type {any} */ entry) => entry[1]),
        query_params: queryParams,
        output_fields: outputFields,
        auth_hint: authHint,
        source_kind: "route_code"
      });
    }
  }
  return routes;
}

/** @param {any} appRoot @param {string} filePath @returns {any} */
function nextAppRoutePathFromFile(appRoot, filePath) {
  const relative = relativeTo(appRoot, filePath);
  return `/${relative}`
    .replace(/\/actions\.(tsx|ts|jsx|js)$/, "")
    .replace(/\/page\.(tsx|ts|jsx|js|mdx)$/, "")
    .replace(/\[(\.\.\.)?([^\]]+)\]/g, (/** @type {any} */ _match, /** @type {any} */ catchAll, /** @type {any} */ name) => catchAll ? `:${name}*` : `:${name}`)
    .replace(/\/index$/, "")
    .replace(/^\/$/, "/") || "/";
}

/** @param {string} text @returns {any} */
function inferFormDataFields(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/formData\.get\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    fields.add(match[1]);
  }
  return [...fields].sort();
}

/** @param {string} text @returns {any} */
function inferInputNames(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/\bname=["'`]([^"'`]+)["'`]/g)) {
    fields.add(match[1]);
  }
  return [...fields].sort();
}

/** @param {WorkspacePaths} paths @returns {any} */
export function inferNextAuthCapabilities(paths) {
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
  /** @type {any[]} */
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
  return capabilities.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id_hint.localeCompare(b.id_hint));
}

/** @param {WorkspacePaths} paths @returns {any} */
export function inferNextServerActionCapabilities(paths) {
  const appRoot = path.join(paths.workspaceRoot, "app");
  if (!fs.existsSync(appRoot)) {
    return [];
  }
  const actionFiles = listFilesRecursive(
    appRoot,
    (/** @type {any} */ child) =>
      /\/actions\.(tsx|ts|jsx|js)$/.test(child) ||
      /\/page\.(tsx|ts|jsx|js|mdx)$/.test(child) ||
      /^page\.(tsx|ts|jsx|js|mdx)$/.test(path.basename(child))
  );
  /** @type {any[]} */
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
      /** @type {WorkflowRecord} */
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
        path_params: [...normalizeOpenApiPath(routePath).matchAll(/\{([^}]+)\}/g)].map((/** @type {any} */ entry) => entry[1]),
        auth_hint: routeLike.auth_hint,
        entity_id: inferCapabilityEntityId({ endpoint: { path: routePath }, id_hint: inferRouteCapabilityId(routeLike) }),
        source_kind: "route_code"
      });
    }
  }
  return capabilities.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id_hint.localeCompare(b.id_hint) || a.path.localeCompare(b.path));
}

/** @param {string} text @param {string} exportName @returns {any} */
function extractNamedExportBlock(text, exportName) {
  const escapedName = exportName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`export\\s+async\\s+function\\s+${escapedName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,2000}?)\\n\\}`, "m"));
  return match ? match[1] : "";
}

/** @param {string} text @returns {any} */
function inferNextRequestSearchParams(text) {
  const params = new Set();
  for (const match of String(text || "").matchAll(/searchParams\.get\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    params.add(match[1]);
  }
  return [...params].sort();
}

/** @param {string} text @returns {any} */
function inferNextJsonFields(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/NextResponse\.json\(\s*\{([\s\S]{0,400}?)\}\s*\)/g)) {
    for (const fieldMatch of match[1].matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b\s*[:,]/g)) {
      fields.add(fieldMatch[1]);
    }
  }
  return [...fields].sort();
}

/** @param {string} text @param {any} handlerName @returns {any} */
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

/** @param {string} text @returns {any} */
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

/** @param {any[]} routeArguments @param {any} handlerContext @returns {any} */
function inferRouteAuthHint(routeArguments, handlerContext) {
  const combined = `${routeArguments || ""}\n${handlerContext || ""}`.toLowerCase();
  return /\b(auth|session|permission|guard|protected|require_auth|requireauth|ensureauth)\b/.test(combined)
    ? "secured"
    : "unknown";
}

/** @param {WorkflowRecord} route @returns {any} */
export function inferRouteCapabilityId(route) {
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
        .map((/** @type {any} */ token) => token.toLowerCase());
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

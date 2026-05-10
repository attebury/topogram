import { canonicalCandidateTerm, idHintify, pluralizeCandidateTerm, slugify } from "./candidates.js";

/**
 * @param {any} pathValue
 * @returns {any}
 */
export function normalizeOpenApiPath(pathValue) {
  return String(pathValue || "")
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{$1}")
    .replace(/\/+$/, "") || "/";
}

/**
 * @param {any} pathValue
 * @returns {any}
 */
export function normalizeEndpointPathForMatch(pathValue) {
  const normalizedPath = normalizeOpenApiPath(pathValue);
  const segments = normalizedPath
    .split("/")
    .filter(Boolean)
    .map(/** @param {any} segment */ (segment) => {
      if (/^\{[^}]+\}$/.test(segment)) {
        return "{}";
      }
      return segment
        .split("-")
        .map(/** @param {any} part */ (part) => canonicalCandidateTerm(part))
        .join("-");
    });
  return `/${segments.join("/")}`.replace(/\/+$/, "") || "/";
}

/**
 * @param {any} pathValue
 * @returns {any}
 */
export function nonParamEndpointSegments(pathValue) {
  return normalizeOpenApiPath(pathValue)
    .split("/")
    .filter(Boolean)
    .filter(/** @param {any} segment */ (segment) => segment !== "{}" && !/^\{[^}]+\}$/.test(segment))
    .map(/** @param {any} segment */ (segment) => canonicalCandidateTerm(segment));
}

/**
 * @param {any} pathValue
 * @returns {any}
 */
function trimmedApiSegments(pathValue) {
  const segments = nonParamEndpointSegments(pathValue);
  if (segments[0] === "api" && segments.length > 1) {
    return segments.slice(1);
  }
  if (segments[0] === "admin" && segments.length > 1) {
    return segments.slice(1);
  }
  return segments;
}

/**
 * @param {any} pathValue
 * @param {any} options
 * @returns {any}
 */
export function inferApiEntityIdFromPath(pathValue, options = {}) {
  const tags = (options.tags || []).map(/** @param {any} tag */ (tag) => canonicalCandidateTerm(tag));
  const summary = String(options.summary || "").toLowerCase();
  const normalizedPath = normalizeOpenApiPath(pathValue);
  const segments = trimmedApiSegments(normalizedPath);

  if (/\/(login|signin|sign-in|signup|register)$/.test(normalizedPath) || tags.includes("authentication")) {
    return "entity_account";
  }
  if (normalizedPath === "/me" || segments.includes("profile") || /profile/.test(summary)) {
    return "entity_profile";
  }
  if (tags.includes("member") || tags.includes("members") || segments.includes("membership") || segments.includes("memberships") || segments.includes("member") || segments.includes("members")) {
    return "entity_workspace-membership";
  }
  if (segments.includes("audit-log") || segments.includes("audit-logs")) {
    return "entity_audit-log";
  }
  if (segments.includes("account") || segments.includes("accounts")) {
    return "entity_account";
  }
  if (segments.includes("workspace") || segments.includes("workspaces")) {
    return "entity_workspace";
  }
  const nestedResourceActions = new Set(["favorite", "follow", "feed", "stats", "role", "status", "login", "signin", "sign-in", "signup", "register", "search", "payment", "delivery"]);
  const lastSegment = segments[segments.length - 1];
  const resource = segments.length > 1 && lastSegment && !nestedResourceActions.has(lastSegment)
    ? lastSegment
    : (segments[0] || "item");
  return `entity_${canonicalCandidateTerm(resource)}`;
}

/**
 * @param {any} operation
 * @returns {any}
 */
export function inferApiCapabilityIdFromOperation(operation) {
  const method = String(operation.method || "").toUpperCase();
  const pathValue = normalizeOpenApiPath(operation.path || "");
  const summary = String(operation.summary || "").toLowerCase();
  const tags = operation.tags || [];
  const segments = trimmedApiSegments(pathValue);
  const rawSegments = normalizeOpenApiPath(pathValue)
    .split("/")
    .filter(Boolean)
    .filter(/** @param {any} segment */ (segment) => !/^\{[^}]+\}$/.test(segment));
  const trimmedRawSegments = rawSegments[0] === "api" && rawSegments.length > 1
    ? rawSegments.slice(1)
    : rawSegments[0] === "admin" && rawSegments.length > 1
      ? rawSegments.slice(1)
      : rawSegments;
  const hasPathParams = /\{[^}]+\}/.test(pathValue);
  const entityStem = inferApiEntityIdFromPath(pathValue, { tags, summary }).replace(/^entity_/, "").replace(/-/g, "_");
  const last = segments[segments.length - 1] || entityStem;
  const rawLast = trimmedRawSegments[trimmedRawSegments.length - 1] || "";

  if (/(^|\/)(login|signin|sign-in)$/.test(pathValue) || /(sign in|login)/.test(summary)) {
    return `cap_sign_in_${entityStem}`;
  }
  if (/(^|\/)(signup|register)$/.test(pathValue) || /(sign up|signup|registration|register)/.test(summary)) {
    return `cap_register_${entityStem}`;
  }
  if (/(^|\/)search\/\{[^}]+\}$/.test(pathValue) || /(search)/.test(summary)) {
    return `cap_search_${pluralizeCandidateTerm(entityStem)}`;
  }
  if (pathValue === "/me") {
    return `cap_get_${entityStem}`;
  }
  if (method === "GET" && /\/feed$/.test(pathValue)) {
    return `cap_feed_${entityStem}`;
  }
  if (method === "POST" && /\/favorite$/.test(pathValue)) {
    return `cap_favorite_${entityStem}`;
  }
  if (method === "DELETE" && /\/favorite$/.test(pathValue)) {
    return `cap_unfavorite_${entityStem}`;
  }
  if (method === "POST" && /\/follow$/.test(pathValue)) {
    return `cap_follow_${entityStem}`;
  }
  if (method === "DELETE" && /\/follow$/.test(pathValue)) {
    return `cap_unfollow_${entityStem}`;
  }
  if (method === "POST" && /\/payment$/.test(pathValue)) {
    return `cap_pay_${entityStem}`;
  }
  if (method === "POST" && /\/delivery$/.test(pathValue)) {
    return `cap_delivery_${entityStem}`;
  }

  if ((method === "PATCH" || method === "PUT") && ["role", "status"].includes(last)) {
    return `cap_update_${entityStem}_${last}`;
  }
  if (method === "GET" && last === "stats") {
    return `cap_get_${entityStem}_stats`;
  }

  if (method === "GET" && segments.length <= 1 && !hasPathParams) {
    const singularPath = rawLast && canonicalCandidateTerm(rawLast) === rawLast;
    return singularPath ? `cap_get_${entityStem}` : `cap_list_${pluralizeCandidateTerm(entityStem)}`;
  }
  if (method === "GET" && segments.length <= 1 && hasPathParams) return `cap_get_${entityStem}`;
  if (method === "GET" && segments.length > 1 && !["role", "status", "stats"].includes(last)) {
    if (!/\{[^}]+\}$/.test(pathValue) && rawLast && canonicalCandidateTerm(rawLast) !== rawLast) {
      return `cap_list_${pluralizeCandidateTerm(entityStem)}`;
    }
    if (segments.includes("member") || segments.includes("membership") || segments.includes("memberships")) {
      return `cap_list_${pluralizeCandidateTerm(entityStem)}`;
    }
    return `cap_get_${entityStem}`;
  }
  if (method === "POST") return `cap_create_${entityStem}`;
  if (method === "PATCH" || method === "PUT") return `cap_update_${entityStem}`;
  if (method === "DELETE") return `cap_delete_${entityStem}`;
  return `candidate_${String(operation.method || "unknown").toLowerCase()}_${slugify(pathValue)}`;
}

/**
 * @param {any} route
 * @returns {any}
 */
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
        .map(/** @param {any} token */ (token) => token.toLowerCase());
      if (handlerTokens.length > 0) {
        return `cap_${handlerTokens.join("_")}`;
      }
    }
  }
  return inferApiCapabilityIdFromOperation(route);
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

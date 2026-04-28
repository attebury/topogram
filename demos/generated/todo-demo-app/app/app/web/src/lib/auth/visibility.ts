import { env as publicEnv } from "$env/dynamic/public";

export interface VisibilityRule {
  predicate?: string | null;
  value?: string | null;
  claimValue?: string | null;
  ownershipField?: string | null;
  capability?: { id?: string | null } | null;
}

export interface VisibilityPrincipalOverride {
  userId?: string | null;
  permissions?: string | string[] | null;
  roles?: string | string[] | null;
  claims?: Record<string, unknown> | null;
  isAdmin?: boolean | string | null;
}

interface AuthPrincipal {
  userId: string;
  permissions: Set<string>;
  roles: Set<string>;
  claims: Record<string, unknown>;
  isAdmin: boolean;
}

function authToken() {
  return publicEnv.PUBLIC_TOPOGRAM_AUTH_TOKEN || "";
}

function csvValues(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeOverrideList(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }
  if (typeof value === "string") {
    return csvValues(value);
  }
  return [];
}

function readBoolean(value: string) {
  return value === "true" || value === "1" || value === "yes";
}

function parseClaimsJson(raw: string) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function principalFromJwt(token: string): AuthPrincipal | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== "object") return null;
  return {
    userId: typeof payload.sub === "string" ? payload.sub : "",
    permissions: new Set(Array.isArray(payload.permissions) ? payload.permissions.filter((value: unknown): value is string => typeof value === "string") : []),
    roles: new Set(Array.isArray(payload.roles) ? payload.roles.filter((value: unknown): value is string => typeof value === "string") : []),
    claims: payload as Record<string, unknown>,
    isAdmin: payload.admin === true
  };
}

function currentPrincipal(overrides?: VisibilityPrincipalOverride | null): AuthPrincipal | null {
  const token = authToken();
  const jwtPrincipal = token ? principalFromJwt(token) : null;
  const envClaims = parseClaimsJson(publicEnv.PUBLIC_TOPOGRAM_AUTH_CLAIMS || "");
  const userId = overrides?.userId || publicEnv.PUBLIC_TOPOGRAM_AUTH_USER_ID || jwtPrincipal?.userId || "";
  const permissions = new Set([
    ...normalizeOverrideList(overrides?.permissions),
    ...csvValues(publicEnv.PUBLIC_TOPOGRAM_AUTH_PERMISSIONS || ""),
    ...Array.from(jwtPrincipal?.permissions || [])
  ]);
  const roles = new Set([
    ...normalizeOverrideList(overrides?.roles),
    ...csvValues(publicEnv.PUBLIC_TOPOGRAM_AUTH_ROLES || publicEnv.PUBLIC_TOPOGRAM_AUTH_ROLE || ""),
    ...Array.from(jwtPrincipal?.roles || [])
  ]);
  const isAdmin = (
    typeof overrides?.isAdmin === "boolean"
      ? overrides.isAdmin
      : readBoolean(String(overrides?.isAdmin || ""))
  ) || readBoolean(publicEnv.PUBLIC_TOPOGRAM_AUTH_ADMIN || "") || jwtPrincipal?.isAdmin === true;

  const claims = {
    ...(jwtPrincipal?.claims || {}),
    ...envClaims,
    ...(overrides?.claims || {})
  };

  if (!token && !userId && permissions.size === 0 && roles.size === 0 && Object.keys(claims).length === 0 && !isAdmin) {
    return null;
  }

  return { userId, permissions, roles, claims, isAdmin };
}

function claimMatches(principal: AuthPrincipal, claim: string | null | undefined, claimValue: string | null | undefined) {
  if (!claim) return true;
  const value = principal.claims[claim];
  if (value == null) return false;
  if (!claimValue) {
    return value !== false && value !== "";
  }
  return String(value) === claimValue;
}

function ownerIdFromResource(resource: Record<string, unknown> | null | undefined, ownershipField?: string | null) {
  if (!resource || typeof resource !== "object") {
    return "";
  }

  if (ownershipField) {
    const explicitValue = resource[ownershipField];
    return typeof explicitValue === "string" ? explicitValue : "";
  }

  for (const field of ["owner_id", "assignee_id", "author_id", "user_id", "created_by_user_id"]) {
    const value = resource[field];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return "";
}

export function canShowAction(
  rule: VisibilityRule | null | undefined,
  resource?: Record<string, unknown> | null,
  overrides?: VisibilityPrincipalOverride | null
) {
  if (!rule) return true;

  const principal = currentPrincipal(overrides);
  if (!principal) {
    return true;
  }

  if (rule.predicate === "permission") {
    if (!rule.value) return true;
    return principal.permissions.has("*") || principal.permissions.has(rule.value);
  }

  if (rule.predicate === "ownership") {
    if (!rule.value || rule.value === "none") return true;
    if (rule.value === "owner_or_admin" && principal.isAdmin) return true;
    return ownerIdFromResource(resource, rule.ownershipField) === principal.userId;
  }

  if (rule.predicate === "claim") {
    return claimMatches(principal, rule.value, rule.claimValue);
  }

  return true;
}

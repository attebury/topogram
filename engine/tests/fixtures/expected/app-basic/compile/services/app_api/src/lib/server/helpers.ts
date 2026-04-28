import crypto from "node:crypto";
import type { Context } from "hono";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message = code
  ) {
    super(message);
  }
}

export interface DownloadArtifact {
  body: BodyInit | Uint8Array | null;
  contentType?: string;
  filename?: string;
}

export interface AuthorizationContext {
  capabilityId?: string;
  input?: Record<string, unknown>;
  loadResource?: () => Promise<Record<string, unknown> | null | undefined>;
}

interface AuthPrincipal {
  userId: string;
  permissions: Set<string>;
  roles: Set<string>;
  claims: Record<string, unknown>;
  isAdmin: boolean;
}

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message
        }
      }
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "internal_server_error",
        message: "Internal server error"
      }
    }
  };
}

export function coerceValue(raw: string | undefined, schema: { type?: string; format?: string; enum?: readonly string[]; default?: unknown }) {
  if (raw == null || raw === "") {
    return schema.default;
  }
  if (schema.enum) {
    return raw;
  }
  if (schema.type === "integer" || schema.type === "number") {
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      throw new HttpError(400, "invalid_number", `Invalid numeric value: ${raw}`);
    }
    if (schema.type === "integer" && !Number.isInteger(parsed)) {
      throw new HttpError(400, "invalid_integer", `Invalid integer value: ${raw}`);
    }
    return parsed;
  }
  if (schema.type === "boolean") {
    return raw === "true";
  }
  return raw;
}

export function requireHeaders(c: Context, headers: ReadonlyArray<{ header: string; required?: boolean; code?: string; error?: number }>) {
  for (const rule of headers) {
    if (!rule.required) {
      continue;
    }
    if (!c.req.header(rule.header)) {
      throw new HttpError(rule.error || 400, rule.code || "missing_required_header", `Missing required header ${rule.header}`);
    }
  }
}

export function requireRequestFields(
  route: {
    capabilityId?: string;
    errors?: ReadonlyArray<{ code?: string; source?: string; status?: number }>;
    requestContract?: { fields?: ReadonlyArray<{ name: string; required?: boolean }> };
  },
  input: Record<string, unknown>
) {
  const missing = (route.requestContract?.fields || [])
    .filter((field) => field.required)
    .filter((field) => input[field.name] == null || input[field.name] === "")
    .map((field) => field.name);

  if (missing.length === 0) {
    return;
  }

  const requestError = (route.errors || []).find((error) => error.source === "request_contract");
  throw new HttpError(
    requestError?.status || 400,
    requestError?.code || `${route.capabilityId || "request"}_invalid_request`,
    `Missing required field(s): ${missing.join(", ")}`
  );
}

function csvValues(raw: string | undefined) {
  return new Set(
    String(raw || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function readBooleanEnv(name: string) {
  return ["1", "true", "yes", "on"].includes(String(process.env[name] || "").toLowerCase());
}

function parseClaimsJson(raw: string | undefined) {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function readBearerToken(c: Context) {
  const header = c.req.header("Authorization") || c.req.header("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function parseJsonSegment(segment: string, code: string) {
  try {
    return JSON.parse(base64UrlDecode(segment));
  } catch {
    throw new HttpError(401, code, "Invalid bearer token");
  }
}

function readHs256Secrets() {
  const plural = process.env.TOPOGRAM_AUTH_JWT_SECRETS || "";
  if (plural) {
    const list = plural.split(",").map((value) => value.trim()).filter(Boolean);
    if (list.length > 0) {
      return list;
    }
  }
  const singular = process.env.TOPOGRAM_AUTH_JWT_SECRET || "";
  return singular ? [singular] : [];
}

function readExpectedIssuer() {
  return process.env.TOPOGRAM_AUTH_JWT_ISSUER || "";
}

function readExpectedAudience() {
  return process.env.TOPOGRAM_AUTH_JWT_AUDIENCE || "";
}

function audienceMatches(claim: unknown, expected: string) {
  if (typeof claim === "string") {
    return claim === expected;
  }
  if (Array.isArray(claim)) {
    return claim.some((value) => typeof value === "string" && value === expected);
  }
  return false;
}

export function contentDisposition(disposition: string, filename: string) {
  const safeDisposition = disposition === "inline" ? "inline" : "attachment";
  const safeFilename = filename
    .replace(/[\r\n"]/g, "")
    .replace(/[\\/]/g, "_")
    .trim() || "download.bin";
  return `${safeDisposition}; filename="${safeFilename}"`;
}

function parsePrincipalClaims(payload: Record<string, unknown>): AuthPrincipal {
  const permissions = Array.isArray(payload.permissions)
    ? payload.permissions.filter((value): value is string => typeof value === "string")
    : typeof payload.permissions === "string"
      ? String(payload.permissions).split(",").map((value) => value.trim()).filter(Boolean)
      : [];
  const roles = Array.isArray(payload.roles)
    ? payload.roles.filter((value): value is string => typeof value === "string")
    : typeof payload.roles === "string"
      ? String(payload.roles).split(",").map((value) => value.trim()).filter(Boolean)
      : [];

  return {
    userId: typeof payload.sub === "string" ? payload.sub : "",
    permissions: new Set(permissions),
    roles: new Set(roles),
    claims: payload,
    isAdmin: payload.admin === true
  };
}

function principalFromEnv(): { token: string; principal: AuthPrincipal } | null {
  if ((process.env.TOPOGRAM_AUTH_PROFILE || "") !== "bearer_demo") {
    return null;
  }
  const token = process.env.TOPOGRAM_AUTH_TOKEN || "";
  if (!token) {
    return null;
  }

  return {
    token,
    principal: {
      userId: process.env.TOPOGRAM_AUTH_USER_ID || process.env.TOPOGRAM_DEMO_USER_ID || "",
      permissions: csvValues(process.env.TOPOGRAM_AUTH_PERMISSIONS),
      roles: csvValues(process.env.TOPOGRAM_AUTH_ROLES || process.env.TOPOGRAM_AUTH_ROLE),
      claims: parseClaimsJson(process.env.TOPOGRAM_AUTH_CLAIMS),
      isAdmin: readBooleanEnv("TOPOGRAM_AUTH_ADMIN")
    }
  };
}

function principalFromJwtHs256(token: string): AuthPrincipal | null {
  if ((process.env.TOPOGRAM_AUTH_PROFILE || "") !== "bearer_jwt_hs256") {
    return null;
  }

  const secrets = readHs256Secrets();
  if (secrets.length === 0) {
    throw new HttpError(500, "missing_auth_jwt_secret", "Missing TOPOGRAM_AUTH_JWT_SECRET or TOPOGRAM_AUTH_JWT_SECRETS");
  }

  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new HttpError(401, "invalid_bearer_token", "Invalid bearer token");
  }

  const [encodedHeader, encodedPayload, signature] = segments;
  const header = parseJsonSegment(encodedHeader, "invalid_bearer_token");
  const payload = parseJsonSegment(encodedPayload, "invalid_bearer_token");

  if (header?.alg !== "HS256") {
    throw new HttpError(401, "invalid_bearer_token", "Invalid bearer token");
  }

  const actualBytes = Buffer.from(signature);
  const signingInput = encodedHeader + "." + encodedPayload;
  let signatureMatched = false;
  for (const candidate of secrets) {
    const expectedSignature = crypto
      .createHmac("sha256", candidate)
      .update(signingInput)
      .digest("base64url");
    const expectedBytes = Buffer.from(expectedSignature);
    if (actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(actualBytes, expectedBytes)) {
      signatureMatched = true;
      break;
    }
  }
  if (!signatureMatched) {
    throw new HttpError(401, "invalid_bearer_signature", "Invalid bearer token signature");
  }

  if (typeof payload?.exp === "number" && payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "expired_bearer_token", "Bearer token has expired");
  }

  const expectedIssuer = readExpectedIssuer();
  if (expectedIssuer && payload?.iss !== expectedIssuer) {
    throw new HttpError(401, "invalid_bearer_issuer", "Bearer token issuer is not trusted");
  }

  const expectedAudience = readExpectedAudience();
  if (expectedAudience && !audienceMatches(payload?.aud, expectedAudience)) {
    throw new HttpError(401, "invalid_bearer_audience", "Bearer token audience does not match");
  }

  return parsePrincipalClaims(payload);
}

function hasPermission(principal: AuthPrincipal, permission: string | null | undefined) {
  if (!permission) {
    return true;
  }
  return principal.permissions.has("*") || principal.permissions.has(permission);
}

function hasRole(principal: AuthPrincipal, role: string | null | undefined) {
  if (!role) {
    return true;
  }
  return principal.roles.has(role);
}

function hasClaim(principal: AuthPrincipal, claim: string | null | undefined, claimValue: string | null | undefined) {
  if (!claim) {
    return true;
  }
  const value = principal.claims[claim];
  if (value == null) {
    return false;
  }
  if (!claimValue) {
    return value !== false && value !== "";
  }
  return String(value) === claimValue;
}

function ownerIdFromResource(
  resource: Record<string, unknown> | null | undefined,
  ownershipField: string | null | undefined,
  options: { allowHeuristicOwnership?: boolean } = {}
) {
  if (!resource || typeof resource !== "object") {
    return "";
  }

  if (ownershipField) {
    const explicitValue = resource[ownershipField];
    if (typeof explicitValue === "string" && explicitValue.length > 0) {
      return explicitValue;
    }
    return "";
  }

  if (!options.allowHeuristicOwnership) {
    return "";
  }

  for (const field of ["owner_id", "assignee_id", "author_id", "user_id", "created_by_user_id"]) {
    const value = resource[field];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return "";
}

async function satisfiesOwnership(
  principal: AuthPrincipal,
  ownership: string | null | undefined,
  ownershipField: string | null | undefined,
  authorizationContext: AuthorizationContext | undefined,
  options: { allowHeuristicOwnership?: boolean } = {}
) {
  if (!ownership || ownership === "none") {
    return true;
  }
  if (ownership === "owner_or_admin" && principal.isAdmin) {
    return true;
  }
  if (!authorizationContext?.loadResource) {
    throw new HttpError(
      500,
      "authorization_resource_loader_missing",
      `Missing authorization resource loader for ${authorizationContext?.capabilityId || "route"}`
    );
  }

  const resource = await authorizationContext.loadResource();
  return ownerIdFromResource(resource, ownershipField, options) === principal.userId;
}

async function authorizeWithPrincipal(
  principal: AuthPrincipal,
  authz: ReadonlyArray<{ role?: string | null; permission?: string | null; claim?: string | null; claimValue?: string | null; ownership?: string | null; ownershipField?: string | null }>,
  authorizationContext?: AuthorizationContext,
  options: { allowHeuristicOwnership?: boolean } = {}
) {
  if (!authz || authz.length === 0) {
    return;
  }

  for (const rule of authz) {
    const roleOk = hasRole(principal, rule.role);
    const permissionOk = hasPermission(principal, rule.permission);
    const claimOk = hasClaim(principal, rule.claim, rule.claimValue);
    const ownershipOk = await satisfiesOwnership(principal, rule.ownership, rule.ownershipField, authorizationContext, options);
    if (roleOk && permissionOk && claimOk && ownershipOk) {
      return;
    }
  }

  throw new HttpError(403, "forbidden", "Bearer token does not satisfy authorization requirements");
}

export async function authorizeWithBearerDemoProfile(
  c: Context,
  authz: ReadonlyArray<{ role?: string | null; permission?: string | null; claim?: string | null; claimValue?: string | null; ownership?: string | null; ownershipField?: string | null }>,
  authorizationContext?: AuthorizationContext
) {
  const envPrincipal = principalFromEnv();
  if (!envPrincipal) {
    throw new HttpError(500, "missing_auth_demo_token", "Missing TOPOGRAM_AUTH_TOKEN for bearer_demo auth profile");
  }

  const token = readBearerToken(c);
  if (!token) {
    throw new HttpError(401, "missing_bearer_token", "Missing bearer token");
  }
  if (token !== envPrincipal.token) {
    throw new HttpError(401, "invalid_bearer_token", "Invalid bearer token");
  }

  await authorizeWithPrincipal(envPrincipal.principal, authz, authorizationContext, { allowHeuristicOwnership: true });
}

export async function authorizeWithBearerJwtHs256Profile(
  c: Context,
  authz: ReadonlyArray<{ role?: string | null; permission?: string | null; claim?: string | null; claimValue?: string | null; ownership?: string | null; ownershipField?: string | null }>,
  authorizationContext?: AuthorizationContext
) {
  const token = readBearerToken(c);
  if (!token) {
    throw new HttpError(401, "missing_bearer_token", "Missing bearer token");
  }

  const principal = principalFromJwtHs256(token);
  if (!principal) {
    throw new HttpError(401, "invalid_bearer_token", "Invalid bearer token");
  }

  await authorizeWithPrincipal(principal, authz, authorizationContext);
}

export async function authorizeWithGeneratedAuthProfile(
  c: Context,
  authz: ReadonlyArray<{ role?: string | null; permission?: string | null; claim?: string | null; claimValue?: string | null; ownership?: string | null; ownershipField?: string | null }>,
  authorizationContext?: AuthorizationContext
) {
  if (!authz || authz.length === 0) {
    return;
  }

  const profile = process.env.TOPOGRAM_AUTH_PROFILE || "";
  if (profile === "bearer_demo") {
    await authorizeWithBearerDemoProfile(c, authz, authorizationContext);
    return;
  }
  if (profile === "bearer_jwt_hs256") {
    await authorizeWithBearerJwtHs256Profile(c, authz, authorizationContext);
    return;
  }
  throw new HttpError(
    500,
    profile ? "unsupported_auth_profile" : "missing_auth_profile",
    profile ? `Unsupported TOPOGRAM_AUTH_PROFILE: ${profile}` : "Missing TOPOGRAM_AUTH_PROFILE for protected route"
  );
}

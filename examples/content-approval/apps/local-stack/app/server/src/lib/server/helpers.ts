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

interface DemoPrincipal {
  token: string;
  userId: string;
  permissions: Set<string>;
  roles: Set<string>;
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
        message: error instanceof Error ? error.message : "Unknown error"
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
    return Number.isNaN(parsed) ? raw : parsed;
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

function readBearerToken(c: Context) {
  const header = c.req.header("Authorization") || c.req.header("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function principalFromEnv(): DemoPrincipal | null {
  if ((process.env.TOPOGRAM_AUTH_PROFILE || "") !== "bearer_demo") {
    return null;
  }
  const token = process.env.TOPOGRAM_AUTH_TOKEN || "";
  if (!token) {
    return null;
  }

  return {
    token,
    userId: process.env.TOPOGRAM_AUTH_USER_ID || process.env.TOPOGRAM_DEMO_USER_ID || "",
    permissions: csvValues(process.env.TOPOGRAM_AUTH_PERMISSIONS),
    roles: csvValues(process.env.TOPOGRAM_AUTH_ROLES || process.env.TOPOGRAM_AUTH_ROLE),
    isAdmin: readBooleanEnv("TOPOGRAM_AUTH_ADMIN")
  };
}

function hasPermission(principal: DemoPrincipal, permission: string | null | undefined) {
  if (!permission) {
    return true;
  }
  return principal.permissions.has("*") || principal.permissions.has(permission);
}

function hasRole(principal: DemoPrincipal, role: string | null | undefined) {
  if (!role) {
    return true;
  }
  return principal.roles.has(role);
}

function ownerIdFromResource(resource: Record<string, unknown> | null | undefined) {
  if (!resource || typeof resource !== "object") {
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
  principal: DemoPrincipal,
  ownership: string | null | undefined,
  authorizationContext: AuthorizationContext | undefined
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
  return ownerIdFromResource(resource) === principal.userId;
}

export async function authorizeWithBearerDemoProfile(
  c: Context,
  authz: ReadonlyArray<{ role?: string | null; permission?: string | null; ownership?: string | null }>,
  authorizationContext?: AuthorizationContext
) {
  if (!authz || authz.length === 0) {
    return;
  }

  const principal = principalFromEnv();
  if (!principal) {
    return;
  }

  const token = readBearerToken(c);
  if (!token) {
    throw new HttpError(401, "missing_bearer_token", "Missing bearer token");
  }
  if (token !== principal.token) {
    throw new HttpError(401, "invalid_bearer_token", "Invalid bearer token");
  }

  for (const rule of authz) {
    const roleOk = hasRole(principal, rule.role);
    const permissionOk = hasPermission(principal, rule.permission);
    const ownershipOk = await satisfiesOwnership(principal, rule.ownership, authorizationContext);
    if (roleOk && permissionOk && ownershipOk) {
      return;
    }
  }

  throw new HttpError(403, "forbidden", "Bearer token does not satisfy authorization requirements");
}

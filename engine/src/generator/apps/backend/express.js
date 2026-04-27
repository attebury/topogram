import { generateDbTarget } from "../../db/index.js";
import { buildBackendRuntimeRealization } from "../../../realization/backend/index.js";
import { getProjection } from "../shared.js";
import { generatePersistenceScaffold } from "./persistence-wiring.js";
import {
  renderServerContextTs,
  renderServerSeedScript,
  renderServerTsconfig,
  routeTypeNames,
} from "./runtime-helpers.js";
import { renderServerContractModule } from "./server-contract.js";
import { toPascalCase } from "../../db/shared.js";
import { getExampleImplementation } from "../../../example-implementation.js";

function renderExpressServerHelpers() {
  return `import crypto from "node:crypto";
import type { Request } from "express";

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
      throw new HttpError(400, "invalid_number", \`Invalid numeric value: \${raw}\`);
    }
    if (schema.type === "integer" && !Number.isInteger(parsed)) {
      throw new HttpError(400, "invalid_integer", \`Invalid integer value: \${raw}\`);
    }
    return parsed;
  }
  if (schema.type === "boolean") {
    return raw === "true";
  }
  return raw;
}

export function requireHeaders(req: Request, headers: ReadonlyArray<{ header: string; required?: boolean; code?: string; error?: number }>) {
  for (const rule of headers) {
    if (!rule.required) {
      continue;
    }
    if (!req.get(rule.header)) {
      throw new HttpError(rule.error || 400, rule.code || "missing_required_header", \`Missing required header \${rule.header}\`);
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
    requestError?.code || \`\${route.capabilityId || "request"}_invalid_request\`,
    \`Missing required field(s): \${missing.join(", ")}\`
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

function readBearerToken(req: Request) {
  const header = req.get("Authorization") || req.get("authorization") || "";
  const match = header.match(/^Bearer\\s+(.+)$/i);
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

function readHs256Secret() {
  return process.env.TOPOGRAM_AUTH_JWT_SECRET || "";
}

export function contentDisposition(disposition: string, filename: string) {
  const safeDisposition = disposition === "inline" ? "inline" : "attachment";
  const safeFilename = filename
    .replace(/[\\r\\n"]/g, "")
    .replace(/[\\\\/]/g, "_")
    .trim() || "download.bin";
  return \`\${safeDisposition}; filename="\${safeFilename}"\`;
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

  const secret = readHs256Secret();
  if (!secret) {
    throw new HttpError(500, "missing_auth_jwt_secret", "Missing TOPOGRAM_AUTH_JWT_SECRET");
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

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(encodedHeader + "." + encodedPayload)
    .digest("base64url");

  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expectedSignature);
  if (actualBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(actualBytes, expectedBytes)) {
    throw new HttpError(401, "invalid_bearer_signature", "Invalid bearer token signature");
  }

  if (typeof payload?.exp === "number" && payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "expired_bearer_token", "Bearer token has expired");
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
      \`Missing authorization resource loader for \${authorizationContext?.capabilityId || "route"}\`
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
  req: Request,
  authz: ReadonlyArray<{ role?: string | null; permission?: string | null; claim?: string | null; claimValue?: string | null; ownership?: string | null; ownershipField?: string | null }>,
  authorizationContext?: AuthorizationContext
) {
  const envPrincipal = principalFromEnv();
  if (!envPrincipal) {
    throw new HttpError(500, "missing_auth_demo_token", "Missing TOPOGRAM_AUTH_TOKEN for bearer_demo auth profile");
  }

  const token = readBearerToken(req);
  if (!token) {
    throw new HttpError(401, "missing_bearer_token", "Missing bearer token");
  }
  if (token !== envPrincipal.token) {
    throw new HttpError(401, "invalid_bearer_token", "Invalid bearer token");
  }

  await authorizeWithPrincipal(envPrincipal.principal, authz, authorizationContext, { allowHeuristicOwnership: true });
}

export async function authorizeWithBearerJwtHs256Profile(
  req: Request,
  authz: ReadonlyArray<{ role?: string | null; permission?: string | null; claim?: string | null; claimValue?: string | null; ownership?: string | null; ownershipField?: string | null }>,
  authorizationContext?: AuthorizationContext
) {
  const token = readBearerToken(req);
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
  req: Request,
  authz: ReadonlyArray<{ role?: string | null; permission?: string | null; claim?: string | null; claimValue?: string | null; ownership?: string | null; ownershipField?: string | null }>,
  authorizationContext?: AuthorizationContext
) {
  if (!authz || authz.length === 0) {
    return;
  }

  const profile = process.env.TOPOGRAM_AUTH_PROFILE || "";
  if (profile === "bearer_demo") {
    await authorizeWithBearerDemoProfile(req, authz, authorizationContext);
    return;
  }
  if (profile === "bearer_jwt_hs256") {
    await authorizeWithBearerJwtHs256Profile(req, authz, authorizationContext);
    return;
  }
  throw new HttpError(
    500,
    profile ? "unsupported_auth_profile" : "missing_auth_profile",
    profile ? \`Unsupported TOPOGRAM_AUTH_PROFILE: \${profile}\` : "Missing TOPOGRAM_AUTH_PROFILE for protected route"
  );
}
`;
}

function renderExpressServerContextTs(contract, graph) {
  const implementation = getExampleImplementation(graph);
  const repositoryReference = implementation.backend.repositoryReference;
  const repositoryInterfaceName = repositoryReference.repositoryInterfaceName;
  const dependencyName = repositoryReference.dependencyName;
  return `import type { Request } from "express";
import type { ${repositoryInterfaceName} } from "../persistence/repositories";
import type { AuthorizationContext } from "./helpers";
import { serverContract } from "../topogram/server-contract";

export interface ServerDependencies {
  ${dependencyName}: ${repositoryInterfaceName};
  ready?: () => Promise<void> | void;
  authorize?: (
    req: Request,
    authz: (typeof serverContract.routes)[number]["endpoint"]["authz"],
    authorizationContext?: AuthorizationContext
  ) => Promise<void> | void;
}
`;
}

function renderExpressServerIndexTs(graph) {
  const implementation = getExampleImplementation(graph);
  const backendReference = implementation.backend.reference;
  const runtimeReference = implementation.runtime.reference;
  const repositoryReference = implementation.backend.repositoryReference;
  const serviceName = backendReference.serviceName;
  const defaultPort = runtimeReference?.ports?.server || 3000;
  const prismaRepositoryClassName = repositoryReference.prismaRepositoryClassName;
  const dependencyName = repositoryReference.dependencyName;
  const dependencyDeclaration = `const ${dependencyName} = new ${prismaRepositoryClassName}(prisma);`;
  return `import { PrismaClient } from "@prisma/client";
import { createApp } from "./lib/server/app";
import { ${prismaRepositoryClassName} } from "./lib/persistence/prisma/repositories";
import { authorizeWithGeneratedAuthProfile } from "./lib/server/helpers";

export function createServer() {
  const prisma = new PrismaClient();
  ${dependencyDeclaration}
  return createApp({
    ${dependencyName},
    ready: async () => {
      await prisma.$queryRaw\`SELECT 1\`;
    },
    authorize: async (req, authz, authorizationContext) => {
      await authorizeWithGeneratedAuthProfile(req, authz, authorizationContext);
    }
  });
}

const app = createServer();
const port = Number(process.env.PORT || ${defaultPort});

app.listen(port, () => {
  console.log(\`${serviceName} listening on http://localhost:\${port}\`);
});
`;
}

function renderExpressServerPackageJson() {
  return `${JSON.stringify({
    name: "topogram-express-server",
    private: true,
    type: "module",
    scripts: {
      dev: "tsx watch src/index.ts",
      check: "tsc --noEmit",
      build: "tsc --noEmit",
      "seed:demo": "node ./scripts/seed-demo.mjs"
    },
    dependencies: {
      "@prisma/client": "^5.22.0",
      express: "^4.21.2"
    },
    devDependencies: {
      "@types/express": "^5.0.1",
      "@types/node": "^22.10.2",
      prisma: "^5.22.0",
      typescript: "^5.6.3",
      tsx: "^4.19.2"
    }
  }, null, 2)}\n`;
}

function renderExpressServerAppTs(realization) {
  const { contract, lookupRoutes } = realization;
  const lines = [];
  const typeImportNames = routeTypeNames(contract);
  const serviceName = realization.backendReference.serviceName;
  const defaultWebPort = realization.runtimeReference?.ports?.web || 5173;
  const repositoryReference = realization.repositoryReference;
  const dependencyName = repositoryReference.dependencyName;
  const preconditionCapabilityIds = repositoryReference.preconditionCapabilityIds;
  const preconditionResource = repositoryReference.preconditionResource;
  const preconditionVariableName = preconditionResource.variableName || "currentResource";
  const downloadCapabilityId = repositoryReference.downloadCapabilityId;

  lines.push('import express, { type Request, type Response } from "express";');
  lines.push('import { serverContract } from "../topogram/server-contract";');
  lines.push('import { HttpError, coerceValue, contentDisposition, jsonError, requireHeaders, requireRequestFields } from "./helpers";');
  lines.push('import type { ServerDependencies } from "./context";');
  lines.push(`import type { ${typeImportNames.join(", ")} } from "../persistence/types";`);
  lines.push("");
  lines.push("function firstQueryValue(raw: unknown): string | undefined {");
  lines.push("  if (typeof raw === \"string\") return raw;");
  lines.push("  if (Array.isArray(raw)) return typeof raw[0] === \"string\" ? raw[0] : undefined;");
  lines.push("  return undefined;");
  lines.push("}");
  lines.push("");
  lines.push("function buildInput(req: Request, route: any, body: Record<string, unknown>) {");
  lines.push("  const input: Record<string, unknown> = {};");
  lines.push("  for (const field of (route.requestContract?.transport.path || []) as any[]) {");
  lines.push("    input[field.name] = coerceValue(req.params[field.transport.wireName], field.schema);");
  lines.push("  }");
  lines.push("  for (const field of (route.requestContract?.transport.query || []) as any[]) {");
  lines.push("    input[field.name] = coerceValue(firstQueryValue(req.query[field.transport.wireName]), field.schema);");
  lines.push("  }");
  lines.push("  for (const field of (route.requestContract?.transport.header || []) as any[]) {");
  lines.push("    input[field.name] = coerceValue(req.get(field.transport.wireName), field.schema);");
  lines.push("  }");
  lines.push("  for (const field of (route.requestContract?.transport.body || []) as any[]) {");
  lines.push('    const defaultValue = field.schema && typeof field.schema === "object" && "default" in field.schema ? field.schema.default : undefined;');
  lines.push("    input[field.name] = body[field.transport.wireName] ?? defaultValue;");
  lines.push("  }");
  lines.push("  return input;");
  lines.push("}");
  lines.push("");
  lines.push("function corsOrigin(req: Request) {");
  lines.push(`  const configured = process.env.TOPOGRAM_CORS_ORIGINS || "http://localhost:${defaultWebPort},http://127.0.0.1:${defaultWebPort}";`);
  lines.push("  const allowed = new Set(configured.split(\",\").map((entry) => entry.trim()).filter(Boolean));");
  lines.push('  const origin = req.get("Origin") || "";');
  lines.push("  return allowed.has(origin) ? origin : \"\";");
  lines.push("}");
  lines.push("");
  lines.push("export function createApp(deps: ServerDependencies) {");
  lines.push("  const app = express();");
  lines.push("  app.use(express.json());");
  lines.push("  app.use((req, res, next) => {");
  lines.push('    const allowedOrigin = corsOrigin(req);');
  lines.push('    if (allowedOrigin) res.header("Access-Control-Allow-Origin", allowedOrigin);');
  lines.push('    res.header("Vary", "Origin");');
  lines.push('    res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");');
  lines.push('    res.header("Access-Control-Allow-Headers", "Content-Type,If-Match,If-None-Match,Idempotency-Key,Authorization");');
  lines.push('    res.header("Access-Control-Expose-Headers", "ETag,Location,Retry-After,Content-Disposition");');
  lines.push('    if (req.method === "OPTIONS") {');
  lines.push("      res.status(204).end();");
  lines.push("      return;");
  lines.push("    }");
  lines.push("    next();");
  lines.push("  });");
  lines.push("");
  lines.push(`  app.get("/health", (_req, res) => res.status(200).json({ ok: true, service: "${serviceName}" }));`);
  lines.push("");
  lines.push('  app.get("/ready", async (_req, res) => {');
  lines.push("    try {");
  lines.push("      await deps.ready?.();");
  lines.push(`      return res.status(200).json({ ok: true, ready: true, service: "${serviceName}" });`);
  lines.push("    } catch (error) {");
  lines.push('      const message = error instanceof Error ? error.message : "Readiness check failed";');
  lines.push(`      return res.status(503).json({ ok: false, ready: false, service: "${serviceName}", message });`);
  lines.push("    }");
  lines.push("  });");
  lines.push("");

  for (const lookup of lookupRoutes) {
    lines.push(`  app.get("${lookup.route}", async (_req, res) => {`);
    lines.push("    try {");
    lines.push(`      const result = await deps.${dependencyName}.${lookup.repositoryMethod}();`);
    lines.push("      return res.status(200).json(result);");
    lines.push("    } catch (error) {");
    lines.push("      const failure = jsonError(error);");
    lines.push("      return res.status(failure.status).json(failure.body);");
    lines.push("    }");
    lines.push("  });");
    lines.push("");
  }

  contract.routes.forEach((route, routeIndex) => {
    const method = route.method.toLowerCase();
    const routeVar = `route${routeIndex}`;
    const responseMode = route.responseContract?.mode || "item";
    const methodName = route.repositoryMethod;
    const hasOwnershipAuthz = (route.endpoint.authz || []).some((rule) => rule.ownership && rule.ownership !== "none");
    const authLoaderVar = `loadAuthorizationResource${routeIndex}`;
    lines.push(`  const ${routeVar} = serverContract.routes[${routeIndex}]!;`);
    lines.push(`  app.${method}(${routeVar}.path, async (req: Request, res: Response) => {`);
    lines.push("    try {");
    lines.push('      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};');
    lines.push(`      const input = buildInput(req, ${routeVar}, body);`);
    if ((route.endpoint.authz || []).length > 0) {
      if (hasOwnershipAuthz) {
        if (preconditionCapabilityIds.includes(route.capabilityId)) {
          lines.push(`      const ${authLoaderVar} = async () => await deps.${dependencyName}.${preconditionResource.repositoryMethod}({ ${preconditionResource.inputField}: String(input.${preconditionResource.inputField} || "") } as unknown as ${toPascalCase(preconditionResource.repositoryMethod)}Input) as unknown as Record<string, unknown>;`);
        } else if (route.method === "GET" && responseMode === "item") {
          lines.push(`      const ${authLoaderVar} = async () => await deps.${dependencyName}.${methodName}(input as unknown as ${toPascalCase(methodName)}Input) as unknown as Record<string, unknown>;`);
        } else {
          lines.push(`      const ${authLoaderVar} = undefined;`);
        }
      }
      lines.push('      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");');
      lines.push(`      await deps.authorize(req, ${routeVar}.endpoint.authz, { capabilityId: ${routeVar}.capabilityId, input, ${hasOwnershipAuthz ? `loadResource: typeof ${authLoaderVar} === "function" ? ${authLoaderVar} : undefined` : "loadResource: undefined"} });`);
    }
    if ((route.endpoint.preconditions || []).length > 0 || (route.endpoint.idempotency || []).length > 0) {
      lines.push(`      requireHeaders(req, [...${routeVar}.endpoint.preconditions, ...${routeVar}.endpoint.idempotency]);`);
    }
    lines.push(`      requireRequestFields(${routeVar}, input);`);
    if (preconditionCapabilityIds.includes(route.capabilityId)) {
      lines.push('      const ifMatch = req.get("If-Match");');
      lines.push('      if (ifMatch) {');
      lines.push(`        const ${preconditionVariableName} = await deps.${dependencyName}.${preconditionResource.repositoryMethod}({ ${preconditionResource.inputField}: String(input.${preconditionResource.inputField} || "") } as unknown as ${toPascalCase(preconditionResource.repositoryMethod)}Input);`);
      lines.push(`        if (${preconditionVariableName}.${preconditionResource.versionField} !== ifMatch) {`);
      lines.push('          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");');
      lines.push("        }");
      lines.push("      }");
    }

    if (route.capabilityId === downloadCapabilityId) {
      lines.push(`      const artifact = await deps.${dependencyName}.${methodName}(input as unknown as ${toPascalCase(methodName)}Input);`);
      lines.push(`      res.setHeader("Content-Type", artifact.contentType || "${route.endpoint.download?.[0]?.media || "application/octet-stream"}");`);
      lines.push(`      res.setHeader("Content-Disposition", contentDisposition("${route.endpoint.download?.[0]?.disposition || "attachment"}", artifact.filename || "${route.endpoint.download?.[0]?.filename || "download.bin"}"));`);
      lines.push(`      return res.status(${route.successStatus}).send(artifact.body as any);`);
    } else {
      lines.push(`      const result = await deps.${dependencyName}.${methodName}(input as unknown as ${toPascalCase(methodName)}Input);`);
      if ((route.endpoint.cache || []).length > 0) {
        const cacheRule = route.endpoint.cache[0];
        lines.push(`      const etag = (result as unknown as Record<string, unknown>)["${cacheRule.source}"];`);
        lines.push(`      if (etag && req.get("${cacheRule.requestHeader}") === String(etag)) {`);
        lines.push(`        return res.status(${cacheRule.notModified}).end();`);
        lines.push("      }");
        lines.push(`      if (etag) res.setHeader("${cacheRule.responseHeader}", String(etag));`);
      }
      if ((route.endpoint.async || []).length > 0) {
        const asyncRule = route.endpoint.async[0];
        lines.push(`      res.setHeader("${asyncRule.locationHeader}", (result as unknown as Record<string, unknown>).status_url ? String((result as unknown as Record<string, unknown>).status_url) : "${asyncRule.statusPath}".replace(":job_id", String((result as unknown as Record<string, unknown>).job_id ?? "")));`);
        lines.push(`      res.setHeader("${asyncRule.retryAfterHeader}", "5");`);
      }
      if (responseMode === "item" || responseMode === "cursor" || responseMode === "paged" || responseMode === "collection") {
        lines.push(`      return res.status(${route.successStatus}).json(result as ${toPascalCase(methodName)}Result);`);
      } else {
        lines.push(`      return res.status(${route.successStatus}).json(result);`);
      }
    }
    lines.push("    } catch (error) {");
    lines.push("      const failure = jsonError(error);");
    lines.push("      return res.status(failure.status).json(failure.body);");
    lines.push("    }");
    lines.push("  });");
    lines.push("");
  });

  lines.push("  return app;");
  lines.push("}");
  return `${lines.join("\n").trimEnd()}\n`;
}

export function generateExpressServer(graph, options = {}) {
  const projection = getProjection(graph, options.projectionId);
  const realization = buildBackendRuntimeRealization(graph, options);
  const contract = realization.contract;
  const persistenceScaffold = generatePersistenceScaffold(graph, { projectionId: realization.dbProjection.id });
  const prismaSchema = generateDbTarget("prisma-schema", graph, { projectionId: realization.dbProjection.id });

  return {
    "package.json": renderExpressServerPackageJson(),
    "tsconfig.json": renderServerTsconfig(),
    "scripts/seed-demo.mjs": renderServerSeedScript(graph),
    "src/index.ts": renderExpressServerIndexTs(graph),
    "src/lib/topogram/server-contract.ts": renderServerContractModule(graph, projection.id),
    "src/lib/server/helpers.ts": renderExpressServerHelpers(),
    "src/lib/server/context.ts": renderExpressServerContextTs(contract, graph),
    "src/lib/server/app.ts": renderExpressServerAppTs(realization),
    "src/lib/persistence/types.ts": persistenceScaffold["types.ts"],
    "src/lib/persistence/repositories.ts": persistenceScaffold["repositories.ts"],
    "src/lib/persistence/prisma/repositories.ts": persistenceScaffold["prisma/repositories.ts"],
    "prisma/schema.prisma": prismaSchema
  };
}

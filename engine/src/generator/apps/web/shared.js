function authTokenExpression(target) {
  return target === "sveltekit"
    ? 'publicEnv.PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN || ""'
    : 'readPublicEnv("PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN") || readPublicEnv("VITE_PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN")';
}

function apiBaseExpression(target, defaultApiBaseUrl) {
  return target === "sveltekit"
    ? `publicEnv.PUBLIC_TOPOGRAM_API_BASE_URL || "${defaultApiBaseUrl}"`
    : `readPublicEnv("PUBLIC_TOPOGRAM_API_BASE_URL") || readPublicEnv("VITE_PUBLIC_TOPOGRAM_API_BASE_URL") || "${defaultApiBaseUrl}"`;
}

function publicEnvPreamble(target) {
  return target === "sveltekit"
    ? 'import { env as publicEnv } from "$env/dynamic/public";\n'
    : "";
}

function publicEnvHelper(target) {
  if (target === "sveltekit") {
    return "";
  }
  return `function readPublicEnv(name: string) {
  return import.meta.env[name] || "";
}

`;
}

export function renderVisibilityModule(target) {
  const preamble = target === "sveltekit" ? `${publicEnvPreamble(target)}\n` : publicEnvPreamble(target);
  return `${preamble}export interface VisibilityRule {
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

${publicEnvHelper(target)}function authToken() {
  return ${authTokenExpression(target)};
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
    permissions: new Set(Array.isArray(payload.permissions) ? payload.permissions.filter((value: unknown) => typeof value === "string") : []),
    roles: new Set(Array.isArray(payload.roles) ? payload.roles.filter((value: unknown) => typeof value === "string") : []),
    claims: payload as Record<string, unknown>,
    isAdmin: payload.admin === true
  };
}

function currentPrincipal(overrides?: VisibilityPrincipalOverride | null): AuthPrincipal | null {
  const token = authToken();
  const jwtPrincipal = token ? principalFromJwt(token) : null;
  const envClaims = parseClaimsJson(${target === "sveltekit" ? 'publicEnv.PUBLIC_TOPOGRAM_AUTH_CLAIMS || ""' : 'readPublicEnv("PUBLIC_TOPOGRAM_AUTH_CLAIMS")'});
  const userId = overrides?.userId || ${target === "sveltekit" ? "publicEnv.PUBLIC_TOPOGRAM_AUTH_USER_ID" : 'readPublicEnv("PUBLIC_TOPOGRAM_AUTH_USER_ID")'} || jwtPrincipal?.userId || "";
  const permissions = new Set([
    ...normalizeOverrideList(overrides?.permissions),
    ...csvValues(${target === "sveltekit" ? 'publicEnv.PUBLIC_TOPOGRAM_AUTH_PERMISSIONS || ""' : 'readPublicEnv("PUBLIC_TOPOGRAM_AUTH_PERMISSIONS")'}),
    ...Array.from(jwtPrincipal?.permissions || [])
  ]);
  const roles = new Set([
    ...normalizeOverrideList(overrides?.roles),
    ...csvValues(${target === "sveltekit" ? 'publicEnv.PUBLIC_TOPOGRAM_AUTH_ROLES || publicEnv.PUBLIC_TOPOGRAM_AUTH_ROLE || ""' : 'readPublicEnv("PUBLIC_TOPOGRAM_AUTH_ROLES") || readPublicEnv("PUBLIC_TOPOGRAM_AUTH_ROLE")'}),
    ...Array.from(jwtPrincipal?.roles || [])
  ]);
  const isAdmin = (
    typeof overrides?.isAdmin === "boolean"
      ? overrides.isAdmin
      : readBoolean(String(overrides?.isAdmin || ""))
  ) || readBoolean(${target === "sveltekit" ? 'publicEnv.PUBLIC_TOPOGRAM_AUTH_ADMIN || ""' : 'readPublicEnv("PUBLIC_TOPOGRAM_AUTH_ADMIN")'}) || jwtPrincipal?.isAdmin === true;

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
`;
}

export function renderApiClientModule(target, webReference, options = {}) {
  const defaultApiBaseUrl = webReference.defaultApiBaseUrl || "http://localhost:3000";
  const supportsDownload = Boolean(options.supportsDownload);
  const contractsImportPath = target === "sveltekit" ? "$lib/topogram/api-contracts.json" : "../topogram/api-contracts.json";
  return `${publicEnvPreamble(target)}import apiContracts from "${contractsImportPath}";

type Fetcher = typeof fetch;
type ApiContract = (typeof apiContracts)[keyof typeof apiContracts];
type RequestOptions = {
  headers?: Record<string, string>;
};

${target === "react" ? "" : publicEnvHelper(target)}function apiBase() {
  return ${target === "react"
    ? `import.meta.env.PUBLIC_TOPOGRAM_API_BASE_URL || import.meta.env.VITE_PUBLIC_TOPOGRAM_API_BASE_URL || "${defaultApiBaseUrl}"`
    : apiBaseExpression(target, defaultApiBaseUrl)};
}

function authToken() {
  return ${target === "react"
    ? 'import.meta.env.PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN || import.meta.env.VITE_PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN || ""'
    : authTokenExpression(target)};
}

function buildPath(contract: ApiContract, input: Record<string, unknown>) {
  let path = contract.endpoint.path;
  for (const field of contract.requestContract?.transport.path || []) {
    const raw = input[field.name];
    path = path.replace(\`:\${field.transport.wireName}\`, encodeURIComponent(String(raw ?? "")));
  }
  const params = new URLSearchParams();
  for (const field of contract.requestContract?.transport.query || []) {
    const raw = input[field.name];
    if (raw !== undefined && raw !== null && raw !== "") {
      params.set(field.transport.wireName, String(raw));
    }
  }
  const query = params.toString();
  return query ? \`\${path}?\${query}\` : path;
}

export async function requestCapability(fetcher: Fetcher, capabilityId: keyof typeof apiContracts, input: Record<string, unknown> = {}, options: RequestOptions = {}) {
  const contract = apiContracts[capabilityId];
  const url = new URL(buildPath(contract, input), apiBase()).toString();
  const headers = new Headers();
  for (const [name, value] of Object.entries(options.headers || {})) {
    headers.set(name, value);
  }
  if ((contract.endpoint.authz || []).length > 0 && authToken() && !headers.has("Authorization")) {
    headers.set("Authorization", "Bearer " + authToken());
  }
  let body: string | undefined;
  if ((contract.requestContract?.transport.body || []).length > 0) {
    headers.set("content-type", "application/json");
    const payload: Record<string, unknown> = {};
    for (const field of contract.requestContract?.transport.body || []) {
      if (input[field.name] !== undefined) {
        payload[field.transport.wireName] = input[field.name];
      }
    }
    body = JSON.stringify(payload);
  }
  const response = await fetcher(url, { method: contract.endpoint.method, headers, body });
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(\`\${contract.endpoint.method} \${contract.endpoint.path} failed (\${response.status}): \${detail}\`) as Error & { status?: number; detail?: string };
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  if (response.status === 204) {
    return null;
  }
  ${supportsDownload ? 'if ((contract.endpoint.download || []).length > 0) {\n    return response.arrayBuffer();\n  }\n  ' : ""}return response.json();
}

export async function listPrimaryResources(fetcher: Fetcher, input: Record<string, unknown> = {}) {
  return requestCapability(fetcher, "${webReference.client.capabilityIds.list}", input);
}
export async function ${webReference.client.functionNames.list}(fetcher: Fetcher, input: Record<string, unknown> = {}) {
  return listPrimaryResources(fetcher, input);
}

export async function getPrimaryResource(fetcher: Fetcher, primary_id: string) {
  return requestCapability(fetcher, "${webReference.client.capabilityIds.get}", { ${webReference.client.primaryParam}: primary_id });
}
export async function ${webReference.client.functionNames.get}(fetcher: Fetcher, primary_id: string) {
  return getPrimaryResource(fetcher, primary_id);
}

export async function createPrimaryResource(fetcher: Fetcher, input: Record<string, unknown>, options: RequestOptions = {}) {
  return requestCapability(fetcher, "${webReference.client.capabilityIds.create}", input, options);
}
export async function ${webReference.client.functionNames.create}(fetcher: Fetcher, input: Record<string, unknown>, options: RequestOptions = {}) {
  return createPrimaryResource(fetcher, input, options);
}

export async function updatePrimaryResource(fetcher: Fetcher, primary_id: string, input: Record<string, unknown> = {}, options: RequestOptions = {}) {
  return requestCapability(fetcher, "${webReference.client.capabilityIds.update}", { ${webReference.client.primaryParam}: primary_id, ...input }, options);
}
export async function ${webReference.client.functionNames.update}(fetcher: Fetcher, primary_id: string, input: Record<string, unknown> = {}, options: RequestOptions = {}) {
  return updatePrimaryResource(fetcher, primary_id, input, options);
}

export async function terminalPrimaryAction(fetcher: Fetcher, primary_id: string, input: Record<string, unknown> = {}, options: RequestOptions = {}) {
  return requestCapability(fetcher, "${webReference.client.capabilityIds.terminal}", { ${webReference.client.primaryParam}: primary_id, ...input }, options);
}
export async function ${webReference.client.functionNames.terminal}(fetcher: Fetcher, primary_id: string, input: Record<string, unknown> = {}, options: RequestOptions = {}) {
  return terminalPrimaryAction(fetcher, primary_id, input, options);
}
${webReference.client.capabilityIds.delete && webReference.client.functionNames.delete ? `
export async function ${webReference.client.functionNames.delete}(fetcher: Fetcher, primary_id: string, options: RequestOptions = {}) {
  return requestCapability(fetcher, "${webReference.client.capabilityIds.delete}", { ${webReference.client.primaryParam}: primary_id }, options);
}
` : ""}${webReference.client.capabilityIds.export && webReference.client.functionNames.export ? `
export async function ${webReference.client.functionNames.export}(fetcher: Fetcher, input: Record<string, unknown> = {}, options: RequestOptions = {}) {
  return requestCapability(fetcher, "${webReference.client.capabilityIds.export}", input, options);
}
` : ""}${webReference.client.capabilityIds.getExportJob && webReference.client.functionNames.getExportJob ? `
export async function ${webReference.client.functionNames.getExportJob}(fetcher: Fetcher, job_id: string) {
  return requestCapability(fetcher, "${webReference.client.capabilityIds.getExportJob}", { job_id });
}
` : ""}
`;
}

export function renderLookupModule(target, defaultApiBaseUrl) {
  const preamble = target === "sveltekit" ? `${publicEnvPreamble(target)}\n` : publicEnvPreamble(target);
  const authTokenHelper = `function authToken() {
  return ${target === "react"
    ? 'import.meta.env.PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN || import.meta.env.VITE_PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN || ""'
    : authTokenExpression(target)};
}

`;
  return `${preamble}export interface LookupOption {
  value: string;
  label: string;
}

${target === "react" ? "" : publicEnvHelper(target)}function apiBase() {
  return ${target === "react"
    ? `import.meta.env.PUBLIC_TOPOGRAM_API_BASE_URL || import.meta.env.VITE_PUBLIC_TOPOGRAM_API_BASE_URL || "${defaultApiBaseUrl}"`
    : apiBaseExpression(target, defaultApiBaseUrl)};
}

${authTokenHelper}export async function listLookupOptions(fetcher: typeof fetch, route: string): Promise<LookupOption[]> {
  const headers = new Headers();
  if (authToken()) {
    headers.set("Authorization", "Bearer " + authToken());
  }
  const response = await fetcher(new URL(route, apiBase()).toString(), { headers });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(\`Lookup request failed (\${response.status}): \${detail}\`);
  }
  return response.json();
}
`;
}

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

export function requireHeaders(c: Context, headers: Array<{ header: string; required?: boolean; code?: string; error?: number }>) {
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
    errors?: Array<{ code?: string; source?: string; status?: number }>;
    requestContract?: { fields?: Array<{ name: string; required?: boolean }> };
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

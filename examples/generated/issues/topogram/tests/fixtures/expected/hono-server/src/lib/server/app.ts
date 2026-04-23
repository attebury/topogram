import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import { serverContract } from "../topogram/server-contract";
import { HttpError, coerceValue, jsonError, requireHeaders, requireRequestFields } from "./helpers";
import type { ServerDependencies } from "./context";
import type { CloseIssueInput, CloseIssueResult, CreateIssueInput, CreateIssueResult, GetIssueInput, GetIssueResult, ListIssuesInput, ListIssuesResult, ListIssuesResultItem, UpdateIssueInput, UpdateIssueResult } from "../persistence/types";

function buildInput(c: Context, route: any, body: Record<string, unknown>) {
  const input: Record<string, unknown> = {};
  for (const field of (route.requestContract?.transport.path || []) as any[]) {
    input[field.name] = coerceValue(c.req.param(field.transport.wireName), field.schema);
  }
  for (const field of (route.requestContract?.transport.query || []) as any[]) {
    input[field.name] = coerceValue(c.req.query(field.transport.wireName), field.schema);
  }
  for (const field of (route.requestContract?.transport.header || []) as any[]) {
    input[field.name] = coerceValue(c.req.header(field.transport.wireName), field.schema);
  }
  for (const field of (route.requestContract?.transport.body || []) as any[]) {
    const defaultValue = field.schema && typeof field.schema === "object" && "default" in field.schema ? field.schema.default : undefined;
    input[field.name] = body[field.transport.wireName] ?? defaultValue;
  }
  return input;
}

export function createApp(deps: ServerDependencies) {
  const app = new Hono();
  app.use("*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "If-Match", "If-None-Match", "Idempotency-Key", "Authorization"],
    exposeHeaders: ["ETag", "Location", "Retry-After", "Content-Disposition"]
  }));

  app.get("/health", (c) => c.json({ ok: true, service: "topogram-issues-server" }, 200 as any));

  app.get("/ready", async (c) => {
    try {
      await deps.ready?.();
      return c.json({ ok: true, ready: true, service: "topogram-issues-server" }, 200 as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Readiness check failed";
      return c.json({ ok: false, ready: false, service: "topogram-issues-server", message }, 503 as any);
    }
  });

  app.get("/lookups/boards", async (c) => {
    try {
      const result = await deps.issueRepository.listBoardOptions();
      return c.json(result, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  app.get("/lookups/users", async (c) => {
    try {
      const result = await deps.issueRepository.listUserOptions();
      return c.json(result, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route0 = serverContract.routes[0]!;
  app.post(route0.path, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const input = buildInput(c, route0, body);
      await deps.authorize?.(c, route0.endpoint.authz, { capabilityId: route0.capabilityId, input, loadResource: undefined });
      requireHeaders(c, [...route0.endpoint.preconditions, ...route0.endpoint.idempotency]);
      requireRequestFields(route0, input);
      const result = await deps.issueRepository.createIssue(input as unknown as CreateIssueInput);
      return c.json(result as CreateIssueResult, 201 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route1 = serverContract.routes[1]!;
  app.get(route1.path, async (c) => {
    try {
      const body = {};
      const input = buildInput(c, route1, body);
      const loadAuthorizationResource1 = async () => await deps.issueRepository.getIssue(input as unknown as GetIssueInput) as unknown as Record<string, unknown>;
      await deps.authorize?.(c, route1.endpoint.authz, { capabilityId: route1.capabilityId, input, loadResource: typeof loadAuthorizationResource1 === "function" ? loadAuthorizationResource1 : undefined });
      requireRequestFields(route1, input);
      const result = await deps.issueRepository.getIssue(input as unknown as GetIssueInput);
      const etag = (result as unknown as Record<string, unknown>)["updated_at"];
      if (etag && c.req.header("If-None-Match") === String(etag)) {
        return c.body(null, 304 as any);
      }
      if (etag) c.header("ETag", String(etag));
      return c.json(result as GetIssueResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route2 = serverContract.routes[2]!;
  app.patch(route2.path, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const input = buildInput(c, route2, body);
      const loadAuthorizationResource2 = async () => await deps.issueRepository.getIssue({ issue_id: String(input.issue_id || "") } as unknown as GetIssueInput) as unknown as Record<string, unknown>;
      await deps.authorize?.(c, route2.endpoint.authz, { capabilityId: route2.capabilityId, input, loadResource: typeof loadAuthorizationResource2 === "function" ? loadAuthorizationResource2 : undefined });
      requireHeaders(c, [...route2.endpoint.preconditions, ...route2.endpoint.idempotency]);
      requireRequestFields(route2, input);
      const ifMatch = c.req.header("If-Match");
      if (ifMatch) {
        const currentIssue = await deps.issueRepository.getIssue({ issue_id: String(input.issue_id || "") } as unknown as GetIssueInput);
        if (currentIssue.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.issueRepository.updateIssue(input as unknown as UpdateIssueInput);
      return c.json(result as UpdateIssueResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route3 = serverContract.routes[3]!;
  app.post(route3.path, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const input = buildInput(c, route3, body);
      const loadAuthorizationResource3 = async () => await deps.issueRepository.getIssue({ issue_id: String(input.issue_id || "") } as unknown as GetIssueInput) as unknown as Record<string, unknown>;
      await deps.authorize?.(c, route3.endpoint.authz, { capabilityId: route3.capabilityId, input, loadResource: typeof loadAuthorizationResource3 === "function" ? loadAuthorizationResource3 : undefined });
      requireHeaders(c, [...route3.endpoint.preconditions, ...route3.endpoint.idempotency]);
      requireRequestFields(route3, input);
      const ifMatch = c.req.header("If-Match");
      if (ifMatch) {
        const currentIssue = await deps.issueRepository.getIssue({ issue_id: String(input.issue_id || "") } as unknown as GetIssueInput);
        if (currentIssue.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.issueRepository.closeIssue(input as unknown as CloseIssueInput);
      return c.json(result as CloseIssueResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route4 = serverContract.routes[4]!;
  app.get(route4.path, async (c) => {
    try {
      const body = {};
      const input = buildInput(c, route4, body);
      await deps.authorize?.(c, route4.endpoint.authz, { capabilityId: route4.capabilityId, input, loadResource: undefined });
      requireRequestFields(route4, input);
      const result = await deps.issueRepository.listIssues(input as unknown as ListIssuesInput);
      return c.json(result as ListIssuesResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  return app;
}

export type AppType = ReturnType<typeof createApp>;

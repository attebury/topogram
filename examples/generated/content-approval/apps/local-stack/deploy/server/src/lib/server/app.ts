import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import { serverContract } from "../topogram/server-contract";
import { HttpError, coerceValue, contentDisposition, jsonError, requireHeaders, requireRequestFields } from "./helpers";
import type { ServerDependencies } from "./context";
import type { ApproveArticleInput, ApproveArticleResult, CreateArticleInput, CreateArticleResult, GetArticleInput, GetArticleResult, ListArticlesInput, ListArticlesResult, ListArticlesResultItem, RejectArticleInput, RejectArticleResult, RequestArticleRevisionInput, RequestArticleRevisionResult, UpdateArticleInput, UpdateArticleResult } from "../persistence/types";

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

function corsOrigin(origin: string) {
  const configured = process.env.TOPOGRAM_CORS_ORIGINS || "http://localhost:5175,http://127.0.0.1:5175";
  const allowed = new Set(configured.split(",").map((entry) => entry.trim()).filter(Boolean));
  return allowed.has(origin) ? origin : "";
}

export function createApp(deps: ServerDependencies) {
  const app = new Hono();
  app.use("*", cors({
    origin: corsOrigin,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "If-Match", "If-None-Match", "Idempotency-Key", "Authorization"],
    exposeHeaders: ["ETag", "Location", "Retry-After", "Content-Disposition"]
  }));

  app.get("/health", (c) => c.json({ ok: true, service: "topogram-content-approval-server" }, 200 as any));

  app.get("/ready", async (c) => {
    try {
      await deps.ready?.();
      return c.json({ ok: true, ready: true, service: "topogram-content-approval-server" }, 200 as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Readiness check failed";
      return c.json({ ok: false, ready: false, service: "topogram-content-approval-server", message }, 503 as any);
    }
  });

  app.get("/lookups/publications", async (c) => {
    try {
      const result = await deps.articleRepository.listPublicationOptions();
      return c.json(result, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  app.get("/lookups/users", async (c) => {
    try {
      const result = await deps.articleRepository.listUserOptions();
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
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route0.endpoint.authz, { capabilityId: route0.capabilityId, input, loadResource: undefined });
      requireHeaders(c, [...route0.endpoint.preconditions, ...route0.endpoint.idempotency]);
      requireRequestFields(route0, input);
      const result = await deps.articleRepository.createArticle(input as unknown as CreateArticleInput);
      return c.json(result as CreateArticleResult, 201 as any);
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
      const loadAuthorizationResource1 = async () => await deps.articleRepository.getArticle(input as unknown as GetArticleInput) as unknown as Record<string, unknown>;
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route1.endpoint.authz, { capabilityId: route1.capabilityId, input, loadResource: typeof loadAuthorizationResource1 === "function" ? loadAuthorizationResource1 : undefined });
      requireRequestFields(route1, input);
      const result = await deps.articleRepository.getArticle(input as unknown as GetArticleInput);
      const etag = (result as unknown as Record<string, unknown>)["updated_at"];
      if (etag && c.req.header("If-None-Match") === String(etag)) {
        return c.body(null, 304 as any);
      }
      if (etag) c.header("ETag", String(etag));
      return c.json(result as GetArticleResult, 200 as any);
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
      const loadAuthorizationResource2 = async () => await deps.articleRepository.getArticle({ article_id: String(input.article_id || "") } as unknown as GetArticleInput) as unknown as Record<string, unknown>;
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route2.endpoint.authz, { capabilityId: route2.capabilityId, input, loadResource: typeof loadAuthorizationResource2 === "function" ? loadAuthorizationResource2 : undefined });
      requireHeaders(c, [...route2.endpoint.preconditions, ...route2.endpoint.idempotency]);
      requireRequestFields(route2, input);
      const ifMatch = c.req.header("If-Match");
      if (ifMatch) {
        const currentArticle = await deps.articleRepository.getArticle({ article_id: String(input.article_id || "") } as unknown as GetArticleInput);
        if (currentArticle.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.articleRepository.updateArticle(input as unknown as UpdateArticleInput);
      return c.json(result as UpdateArticleResult, 200 as any);
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
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route3.endpoint.authz, { capabilityId: route3.capabilityId, input, loadResource: undefined });
      requireHeaders(c, [...route3.endpoint.preconditions, ...route3.endpoint.idempotency]);
      requireRequestFields(route3, input);
      const ifMatch = c.req.header("If-Match");
      if (ifMatch) {
        const currentArticle = await deps.articleRepository.getArticle({ article_id: String(input.article_id || "") } as unknown as GetArticleInput);
        if (currentArticle.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.articleRepository.requestArticleRevision(input as unknown as RequestArticleRevisionInput);
      return c.json(result as RequestArticleRevisionResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route4 = serverContract.routes[4]!;
  app.post(route4.path, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const input = buildInput(c, route4, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route4.endpoint.authz, { capabilityId: route4.capabilityId, input, loadResource: undefined });
      requireHeaders(c, [...route4.endpoint.preconditions, ...route4.endpoint.idempotency]);
      requireRequestFields(route4, input);
      const ifMatch = c.req.header("If-Match");
      if (ifMatch) {
        const currentArticle = await deps.articleRepository.getArticle({ article_id: String(input.article_id || "") } as unknown as GetArticleInput);
        if (currentArticle.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.articleRepository.approveArticle(input as unknown as ApproveArticleInput);
      return c.json(result as ApproveArticleResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route5 = serverContract.routes[5]!;
  app.post(route5.path, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const input = buildInput(c, route5, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route5.endpoint.authz, { capabilityId: route5.capabilityId, input, loadResource: undefined });
      requireHeaders(c, [...route5.endpoint.preconditions, ...route5.endpoint.idempotency]);
      requireRequestFields(route5, input);
      const ifMatch = c.req.header("If-Match");
      if (ifMatch) {
        const currentArticle = await deps.articleRepository.getArticle({ article_id: String(input.article_id || "") } as unknown as GetArticleInput);
        if (currentArticle.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.articleRepository.rejectArticle(input as unknown as RejectArticleInput);
      return c.json(result as RejectArticleResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route6 = serverContract.routes[6]!;
  app.get(route6.path, async (c) => {
    try {
      const body = {};
      const input = buildInput(c, route6, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route6.endpoint.authz, { capabilityId: route6.capabilityId, input, loadResource: undefined });
      requireRequestFields(route6, input);
      const result = await deps.articleRepository.listArticles(input as unknown as ListArticlesInput);
      return c.json(result as ListArticlesResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  return app;
}

export type AppType = ReturnType<typeof createApp>;

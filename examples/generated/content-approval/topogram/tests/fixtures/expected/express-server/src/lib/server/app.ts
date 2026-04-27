import express, { type Request, type Response } from "express";
import { serverContract } from "../topogram/server-contract";
import { HttpError, coerceValue, contentDisposition, jsonError, requireHeaders, requireRequestFields } from "./helpers";
import type { ServerDependencies } from "./context";
import type { ApproveArticleInput, ApproveArticleResult, CreateArticleInput, CreateArticleResult, GetArticleInput, GetArticleResult, ListArticlesInput, ListArticlesResult, ListArticlesResultItem, RejectArticleInput, RejectArticleResult, RequestArticleRevisionInput, RequestArticleRevisionResult, UpdateArticleInput, UpdateArticleResult } from "../persistence/types";

function firstQueryValue(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return typeof raw[0] === "string" ? raw[0] : undefined;
  return undefined;
}

function buildInput(req: Request, route: any, body: Record<string, unknown>) {
  const input: Record<string, unknown> = {};
  for (const field of (route.requestContract?.transport.path || []) as any[]) {
    input[field.name] = coerceValue(req.params[field.transport.wireName], field.schema);
  }
  for (const field of (route.requestContract?.transport.query || []) as any[]) {
    input[field.name] = coerceValue(firstQueryValue(req.query[field.transport.wireName]), field.schema);
  }
  for (const field of (route.requestContract?.transport.header || []) as any[]) {
    input[field.name] = coerceValue(req.get(field.transport.wireName), field.schema);
  }
  for (const field of (route.requestContract?.transport.body || []) as any[]) {
    const defaultValue = field.schema && typeof field.schema === "object" && "default" in field.schema ? field.schema.default : undefined;
    input[field.name] = body[field.transport.wireName] ?? defaultValue;
  }
  return input;
}

function corsOrigin(req: Request) {
  const configured = process.env.TOPOGRAM_CORS_ORIGINS || "http://localhost:5175,http://127.0.0.1:5175";
  const allowed = new Set(configured.split(",").map((entry) => entry.trim()).filter(Boolean));
  const origin = req.get("Origin") || "";
  return allowed.has(origin) ? origin : "";
}

export function createApp(deps: ServerDependencies) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const allowedOrigin = corsOrigin(req);
    if (allowedOrigin) res.header("Access-Control-Allow-Origin", allowedOrigin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type,If-Match,If-None-Match,Idempotency-Key,Authorization");
    res.header("Access-Control-Expose-Headers", "ETag,Location,Retry-After,Content-Disposition");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get("/health", (_req, res) => res.status(200).json({ ok: true, service: "topogram-content-approval-server" }));

  app.get("/ready", async (_req, res) => {
    try {
      await deps.ready?.();
      return res.status(200).json({ ok: true, ready: true, service: "topogram-content-approval-server" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Readiness check failed";
      return res.status(503).json({ ok: false, ready: false, service: "topogram-content-approval-server", message });
    }
  });

  app.get("/lookups/publications", async (_req, res) => {
    try {
      const result = await deps.articleRepository.listPublicationOptions();
      return res.status(200).json(result);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  app.get("/lookups/users", async (_req, res) => {
    try {
      const result = await deps.articleRepository.listUserOptions();
      return res.status(200).json(result);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route0 = serverContract.routes[0]!;
  app.post(route0.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route0, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route0.endpoint.authz, { capabilityId: route0.capabilityId, input, loadResource: undefined });
      requireHeaders(req, [...route0.endpoint.preconditions, ...route0.endpoint.idempotency]);
      requireRequestFields(route0, input);
      const result = await deps.articleRepository.createArticle(input as unknown as CreateArticleInput);
      return res.status(201).json(result as CreateArticleResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route1 = serverContract.routes[1]!;
  app.get(route1.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route1, body);
      const loadAuthorizationResource1 = async () => await deps.articleRepository.getArticle(input as unknown as GetArticleInput) as unknown as Record<string, unknown>;
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route1.endpoint.authz, { capabilityId: route1.capabilityId, input, loadResource: typeof loadAuthorizationResource1 === "function" ? loadAuthorizationResource1 : undefined });
      requireRequestFields(route1, input);
      const result = await deps.articleRepository.getArticle(input as unknown as GetArticleInput);
      const etag = (result as unknown as Record<string, unknown>)["updated_at"];
      if (etag && req.get("If-None-Match") === String(etag)) {
        return res.status(304).end();
      }
      if (etag) res.setHeader("ETag", String(etag));
      return res.status(200).json(result as GetArticleResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route2 = serverContract.routes[2]!;
  app.patch(route2.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route2, body);
      const loadAuthorizationResource2 = async () => await deps.articleRepository.getArticle({ article_id: String(input.article_id || "") } as unknown as GetArticleInput) as unknown as Record<string, unknown>;
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route2.endpoint.authz, { capabilityId: route2.capabilityId, input, loadResource: typeof loadAuthorizationResource2 === "function" ? loadAuthorizationResource2 : undefined });
      requireHeaders(req, [...route2.endpoint.preconditions, ...route2.endpoint.idempotency]);
      requireRequestFields(route2, input);
      const ifMatch = req.get("If-Match");
      if (ifMatch) {
        const currentArticle = await deps.articleRepository.getArticle({ article_id: String(input.article_id || "") } as unknown as GetArticleInput);
        if (currentArticle.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.articleRepository.updateArticle(input as unknown as UpdateArticleInput);
      return res.status(200).json(result as UpdateArticleResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route3 = serverContract.routes[3]!;
  app.post(route3.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route3, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route3.endpoint.authz, { capabilityId: route3.capabilityId, input, loadResource: undefined });
      requireHeaders(req, [...route3.endpoint.preconditions, ...route3.endpoint.idempotency]);
      requireRequestFields(route3, input);
      const ifMatch = req.get("If-Match");
      if (ifMatch) {
        const currentArticle = await deps.articleRepository.getArticle({ article_id: String(input.article_id || "") } as unknown as GetArticleInput);
        if (currentArticle.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.articleRepository.requestArticleRevision(input as unknown as RequestArticleRevisionInput);
      return res.status(200).json(result as RequestArticleRevisionResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route4 = serverContract.routes[4]!;
  app.post(route4.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route4, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route4.endpoint.authz, { capabilityId: route4.capabilityId, input, loadResource: undefined });
      requireHeaders(req, [...route4.endpoint.preconditions, ...route4.endpoint.idempotency]);
      requireRequestFields(route4, input);
      const ifMatch = req.get("If-Match");
      if (ifMatch) {
        const currentArticle = await deps.articleRepository.getArticle({ article_id: String(input.article_id || "") } as unknown as GetArticleInput);
        if (currentArticle.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.articleRepository.approveArticle(input as unknown as ApproveArticleInput);
      return res.status(200).json(result as ApproveArticleResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route5 = serverContract.routes[5]!;
  app.post(route5.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route5, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route5.endpoint.authz, { capabilityId: route5.capabilityId, input, loadResource: undefined });
      requireHeaders(req, [...route5.endpoint.preconditions, ...route5.endpoint.idempotency]);
      requireRequestFields(route5, input);
      const ifMatch = req.get("If-Match");
      if (ifMatch) {
        const currentArticle = await deps.articleRepository.getArticle({ article_id: String(input.article_id || "") } as unknown as GetArticleInput);
        if (currentArticle.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.articleRepository.rejectArticle(input as unknown as RejectArticleInput);
      return res.status(200).json(result as RejectArticleResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route6 = serverContract.routes[6]!;
  app.get(route6.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route6, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route6.endpoint.authz, { capabilityId: route6.capabilityId, input, loadResource: undefined });
      requireRequestFields(route6, input);
      const result = await deps.articleRepository.listArticles(input as unknown as ListArticlesInput);
      return res.status(200).json(result as ListArticlesResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  return app;
}

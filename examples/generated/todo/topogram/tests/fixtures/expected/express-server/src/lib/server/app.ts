import express, { type Request, type Response } from "express";
import { serverContract } from "../topogram/server-contract";
import { HttpError, coerceValue, contentDisposition, jsonError, requireHeaders, requireRequestFields } from "./helpers";
import type { ServerDependencies } from "./context";
import type { CompleteTaskInput, CompleteTaskResult, CreateProjectInput, CreateProjectResult, CreateTaskInput, CreateTaskResult, CreateUserInput, CreateUserResult, DeleteTaskInput, DeleteTaskResult, DownloadTaskExportInput, DownloadTaskExportResult, ExportTasksInput, ExportTasksResult, GetProjectInput, GetProjectResult, GetTaskExportJobInput, GetTaskExportJobResult, GetTaskInput, GetTaskResult, GetUserInput, GetUserResult, ListProjectsInput, ListProjectsResult, ListProjectsResultItem, ListTasksInput, ListTasksResult, ListTasksResultItem, ListUsersInput, ListUsersResult, ListUsersResultItem, UpdateProjectInput, UpdateProjectResult, UpdateTaskInput, UpdateTaskResult, UpdateUserInput, UpdateUserResult } from "../persistence/types";

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
  const configured = process.env.TOPOGRAM_CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173";
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

  app.get("/health", (_req, res) => res.status(200).json({ ok: true, service: "topogram-todo-server" }));

  app.get("/ready", async (_req, res) => {
    try {
      await deps.ready?.();
      return res.status(200).json({ ok: true, ready: true, service: "topogram-todo-server" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Readiness check failed";
      return res.status(503).json({ ok: false, ready: false, service: "topogram-todo-server", message });
    }
  });

  app.get("/lookups/users", async (_req, res) => {
    try {
      const result = await deps.todoRepository.listUserOptions();
      return res.status(200).json(result);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  app.get("/lookups/projects", async (_req, res) => {
    try {
      const result = await deps.todoRepository.listProjectOptions();
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
      const result = await deps.todoRepository.createTask(input as unknown as CreateTaskInput);
      return res.status(201).json(result as CreateTaskResult);
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
      const loadAuthorizationResource1 = async () => await deps.todoRepository.getTask(input as unknown as GetTaskInput) as unknown as Record<string, unknown>;
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route1.endpoint.authz, { capabilityId: route1.capabilityId, input, loadResource: typeof loadAuthorizationResource1 === "function" ? loadAuthorizationResource1 : undefined });
      requireRequestFields(route1, input);
      const result = await deps.todoRepository.getTask(input as unknown as GetTaskInput);
      const etag = (result as unknown as Record<string, unknown>)["updated_at"];
      if (etag && req.get("If-None-Match") === String(etag)) {
        return res.status(304).end();
      }
      if (etag) res.setHeader("ETag", String(etag));
      return res.status(200).json(result as GetTaskResult);
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
      const loadAuthorizationResource2 = async () => await deps.todoRepository.getTask({ task_id: String(input.task_id || "") } as unknown as GetTaskInput) as unknown as Record<string, unknown>;
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route2.endpoint.authz, { capabilityId: route2.capabilityId, input, loadResource: typeof loadAuthorizationResource2 === "function" ? loadAuthorizationResource2 : undefined });
      requireHeaders(req, [...route2.endpoint.preconditions, ...route2.endpoint.idempotency]);
      requireRequestFields(route2, input);
      const ifMatch = req.get("If-Match");
      if (ifMatch) {
        const currentTask = await deps.todoRepository.getTask({ task_id: String(input.task_id || "") } as unknown as GetTaskInput);
        if (currentTask.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.todoRepository.updateTask(input as unknown as UpdateTaskInput);
      return res.status(200).json(result as UpdateTaskResult);
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
      const loadAuthorizationResource3 = async () => await deps.todoRepository.getTask({ task_id: String(input.task_id || "") } as unknown as GetTaskInput) as unknown as Record<string, unknown>;
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route3.endpoint.authz, { capabilityId: route3.capabilityId, input, loadResource: typeof loadAuthorizationResource3 === "function" ? loadAuthorizationResource3 : undefined });
      requireHeaders(req, [...route3.endpoint.preconditions, ...route3.endpoint.idempotency]);
      requireRequestFields(route3, input);
      const ifMatch = req.get("If-Match");
      if (ifMatch) {
        const currentTask = await deps.todoRepository.getTask({ task_id: String(input.task_id || "") } as unknown as GetTaskInput);
        if (currentTask.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.todoRepository.completeTask(input as unknown as CompleteTaskInput);
      return res.status(200).json(result as CompleteTaskResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route4 = serverContract.routes[4]!;
  app.get(route4.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route4, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route4.endpoint.authz, { capabilityId: route4.capabilityId, input, loadResource: undefined });
      requireRequestFields(route4, input);
      const result = await deps.todoRepository.listTasks(input as unknown as ListTasksInput);
      return res.status(200).json(result as ListTasksResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route5 = serverContract.routes[5]!;
  app.delete(route5.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route5, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route5.endpoint.authz, { capabilityId: route5.capabilityId, input, loadResource: undefined });
      requireHeaders(req, [...route5.endpoint.preconditions, ...route5.endpoint.idempotency]);
      requireRequestFields(route5, input);
      const ifMatch = req.get("If-Match");
      if (ifMatch) {
        const currentTask = await deps.todoRepository.getTask({ task_id: String(input.task_id || "") } as unknown as GetTaskInput);
        if (currentTask.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.todoRepository.deleteTask(input as unknown as DeleteTaskInput);
      return res.status(200).json(result as DeleteTaskResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route6 = serverContract.routes[6]!;
  app.post(route6.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route6, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route6.endpoint.authz, { capabilityId: route6.capabilityId, input, loadResource: undefined });
      requireRequestFields(route6, input);
      const result = await deps.todoRepository.exportTasks(input as unknown as ExportTasksInput);
      res.setHeader("Location", (result as unknown as Record<string, unknown>).status_url ? String((result as unknown as Record<string, unknown>).status_url) : "/task-exports/:job_id".replace(":job_id", String((result as unknown as Record<string, unknown>).job_id ?? "")));
      res.setHeader("Retry-After", "5");
      return res.status(202).json(result as ExportTasksResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route7 = serverContract.routes[7]!;
  app.get(route7.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route7, body);
      const loadAuthorizationResource7 = async () => await deps.todoRepository.getTaskExportJob(input as unknown as GetTaskExportJobInput) as unknown as Record<string, unknown>;
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route7.endpoint.authz, { capabilityId: route7.capabilityId, input, loadResource: typeof loadAuthorizationResource7 === "function" ? loadAuthorizationResource7 : undefined });
      requireRequestFields(route7, input);
      const result = await deps.todoRepository.getTaskExportJob(input as unknown as GetTaskExportJobInput);
      return res.status(200).json(result as GetTaskExportJobResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route8 = serverContract.routes[8]!;
  app.get(route8.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route8, body);
      const loadAuthorizationResource8 = async () => await deps.todoRepository.downloadTaskExport(input as unknown as DownloadTaskExportInput) as unknown as Record<string, unknown>;
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route8.endpoint.authz, { capabilityId: route8.capabilityId, input, loadResource: typeof loadAuthorizationResource8 === "function" ? loadAuthorizationResource8 : undefined });
      requireRequestFields(route8, input);
      const artifact = await deps.todoRepository.downloadTaskExport(input as unknown as DownloadTaskExportInput);
      res.setHeader("Content-Type", artifact.contentType || "application/zip");
      res.setHeader("Content-Disposition", contentDisposition("attachment", artifact.filename || "task-export.zip"));
      return res.status(200).send(artifact.body as any);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route9 = serverContract.routes[9]!;
  app.get(route9.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route9, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route9.endpoint.authz, { capabilityId: route9.capabilityId, input, loadResource: undefined });
      requireRequestFields(route9, input);
      const result = await deps.todoRepository.listProjects(input as unknown as ListProjectsInput);
      return res.status(200).json(result as ListProjectsResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route10 = serverContract.routes[10]!;
  app.get(route10.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route10, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route10.endpoint.authz, { capabilityId: route10.capabilityId, input, loadResource: undefined });
      requireRequestFields(route10, input);
      const result = await deps.todoRepository.getProject(input as unknown as GetProjectInput);
      return res.status(200).json(result as GetProjectResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route11 = serverContract.routes[11]!;
  app.post(route11.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route11, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route11.endpoint.authz, { capabilityId: route11.capabilityId, input, loadResource: undefined });
      requireRequestFields(route11, input);
      const result = await deps.todoRepository.createProject(input as unknown as CreateProjectInput);
      return res.status(201).json(result as CreateProjectResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route12 = serverContract.routes[12]!;
  app.patch(route12.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route12, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route12.endpoint.authz, { capabilityId: route12.capabilityId, input, loadResource: undefined });
      requireRequestFields(route12, input);
      const result = await deps.todoRepository.updateProject(input as unknown as UpdateProjectInput);
      return res.status(200).json(result as UpdateProjectResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route13 = serverContract.routes[13]!;
  app.get(route13.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route13, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route13.endpoint.authz, { capabilityId: route13.capabilityId, input, loadResource: undefined });
      requireRequestFields(route13, input);
      const result = await deps.todoRepository.listUsers(input as unknown as ListUsersInput);
      return res.status(200).json(result as ListUsersResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route14 = serverContract.routes[14]!;
  app.get(route14.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route14, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route14.endpoint.authz, { capabilityId: route14.capabilityId, input, loadResource: undefined });
      requireRequestFields(route14, input);
      const result = await deps.todoRepository.getUser(input as unknown as GetUserInput);
      return res.status(200).json(result as GetUserResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route15 = serverContract.routes[15]!;
  app.post(route15.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route15, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route15.endpoint.authz, { capabilityId: route15.capabilityId, input, loadResource: undefined });
      requireRequestFields(route15, input);
      const result = await deps.todoRepository.createUser(input as unknown as CreateUserInput);
      return res.status(201).json(result as CreateUserResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  const route16 = serverContract.routes[16]!;
  app.patch(route16.path, async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const input = buildInput(req, route16, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(req, route16.endpoint.authz, { capabilityId: route16.capabilityId, input, loadResource: undefined });
      requireRequestFields(route16, input);
      const result = await deps.todoRepository.updateUser(input as unknown as UpdateUserInput);
      return res.status(200).json(result as UpdateUserResult);
    } catch (error) {
      const failure = jsonError(error);
      return res.status(failure.status).json(failure.body);
    }
  });

  return app;
}

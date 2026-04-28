import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import { serverContract } from "../topogram/server-contract";
import { HttpError, coerceValue, contentDisposition, jsonError, requireHeaders, requireRequestFields } from "./helpers";
import type { ServerDependencies } from "./context";
import type { CompleteTaskInput, CompleteTaskResult, CreateProjectInput, CreateProjectResult, CreateTaskInput, CreateTaskResult, CreateUserInput, CreateUserResult, DeleteTaskInput, DeleteTaskResult, DownloadTaskExportInput, DownloadTaskExportResult, ExportTasksInput, ExportTasksResult, GetProjectInput, GetProjectResult, GetTaskExportJobInput, GetTaskExportJobResult, GetTaskInput, GetTaskResult, GetUserInput, GetUserResult, ListProjectsInput, ListProjectsResult, ListProjectsResultItem, ListTasksInput, ListTasksResult, ListTasksResultItem, ListUsersInput, ListUsersResult, ListUsersResultItem, UpdateProjectInput, UpdateProjectResult, UpdateTaskInput, UpdateTaskResult, UpdateUserInput, UpdateUserResult } from "../persistence/types";

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
  const configured = process.env.TOPOGRAM_CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173";
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

  app.get("/health", (c) => c.json({ ok: true, service: "topogram-todo-server" }, 200 as any));

  app.get("/ready", async (c) => {
    try {
      await deps.ready?.();
      return c.json({ ok: true, ready: true, service: "topogram-todo-server" }, 200 as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Readiness check failed";
      return c.json({ ok: false, ready: false, service: "topogram-todo-server", message }, 503 as any);
    }
  });

  app.get("/lookups/users", async (c) => {
    try {
      const result = await deps.todoRepository.listUserOptions();
      return c.json(result, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  app.get("/lookups/projects", async (c) => {
    try {
      const result = await deps.todoRepository.listProjectOptions();
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
      const result = await deps.todoRepository.createTask(input as unknown as CreateTaskInput);
      return c.json(result as CreateTaskResult, 201 as any);
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
      const loadAuthorizationResource1 = async () => await deps.todoRepository.getTask(input as unknown as GetTaskInput) as unknown as Record<string, unknown>;
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route1.endpoint.authz, { capabilityId: route1.capabilityId, input, loadResource: typeof loadAuthorizationResource1 === "function" ? loadAuthorizationResource1 : undefined });
      requireRequestFields(route1, input);
      const result = await deps.todoRepository.getTask(input as unknown as GetTaskInput);
      const etag = (result as unknown as Record<string, unknown>)["updated_at"];
      if (etag && c.req.header("If-None-Match") === String(etag)) {
        return c.body(null, 304 as any);
      }
      if (etag) c.header("ETag", String(etag));
      return c.json(result as GetTaskResult, 200 as any);
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
      const loadAuthorizationResource2 = async () => await deps.todoRepository.getTask({ task_id: String(input.task_id || "") } as unknown as GetTaskInput) as unknown as Record<string, unknown>;
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route2.endpoint.authz, { capabilityId: route2.capabilityId, input, loadResource: typeof loadAuthorizationResource2 === "function" ? loadAuthorizationResource2 : undefined });
      requireHeaders(c, [...route2.endpoint.preconditions, ...route2.endpoint.idempotency]);
      requireRequestFields(route2, input);
      const ifMatch = c.req.header("If-Match");
      if (ifMatch) {
        const currentTask = await deps.todoRepository.getTask({ task_id: String(input.task_id || "") } as unknown as GetTaskInput);
        if (currentTask.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.todoRepository.updateTask(input as unknown as UpdateTaskInput);
      return c.json(result as UpdateTaskResult, 200 as any);
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
      const loadAuthorizationResource3 = async () => await deps.todoRepository.getTask({ task_id: String(input.task_id || "") } as unknown as GetTaskInput) as unknown as Record<string, unknown>;
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route3.endpoint.authz, { capabilityId: route3.capabilityId, input, loadResource: typeof loadAuthorizationResource3 === "function" ? loadAuthorizationResource3 : undefined });
      requireHeaders(c, [...route3.endpoint.preconditions, ...route3.endpoint.idempotency]);
      requireRequestFields(route3, input);
      const ifMatch = c.req.header("If-Match");
      if (ifMatch) {
        const currentTask = await deps.todoRepository.getTask({ task_id: String(input.task_id || "") } as unknown as GetTaskInput);
        if (currentTask.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.todoRepository.completeTask(input as unknown as CompleteTaskInput);
      return c.json(result as CompleteTaskResult, 200 as any);
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
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route4.endpoint.authz, { capabilityId: route4.capabilityId, input, loadResource: undefined });
      requireRequestFields(route4, input);
      const result = await deps.todoRepository.listTasks(input as unknown as ListTasksInput);
      return c.json(result as ListTasksResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route5 = serverContract.routes[5]!;
  app.delete(route5.path, async (c) => {
    try {
      const body = {};
      const input = buildInput(c, route5, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route5.endpoint.authz, { capabilityId: route5.capabilityId, input, loadResource: undefined });
      requireHeaders(c, [...route5.endpoint.preconditions, ...route5.endpoint.idempotency]);
      requireRequestFields(route5, input);
      const ifMatch = c.req.header("If-Match");
      if (ifMatch) {
        const currentTask = await deps.todoRepository.getTask({ task_id: String(input.task_id || "") } as unknown as GetTaskInput);
        if (currentTask.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.todoRepository.deleteTask(input as unknown as DeleteTaskInput);
      return c.json(result as DeleteTaskResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route6 = serverContract.routes[6]!;
  app.post(route6.path, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const input = buildInput(c, route6, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route6.endpoint.authz, { capabilityId: route6.capabilityId, input, loadResource: undefined });
      requireRequestFields(route6, input);
      const result = await deps.todoRepository.exportTasks(input as unknown as ExportTasksInput);
      c.header("Location", (result as unknown as Record<string, unknown>).status_url ? String((result as unknown as Record<string, unknown>).status_url) : "/task-exports/:job_id".replace(":job_id", String((result as unknown as Record<string, unknown>).job_id ?? "")));
      c.header("Retry-After", "5");
      return c.json(result as ExportTasksResult, 202 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route7 = serverContract.routes[7]!;
  app.get(route7.path, async (c) => {
    try {
      const body = {};
      const input = buildInput(c, route7, body);
      const loadAuthorizationResource7 = async () => await deps.todoRepository.getTaskExportJob(input as unknown as GetTaskExportJobInput) as unknown as Record<string, unknown>;
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route7.endpoint.authz, { capabilityId: route7.capabilityId, input, loadResource: typeof loadAuthorizationResource7 === "function" ? loadAuthorizationResource7 : undefined });
      requireRequestFields(route7, input);
      const result = await deps.todoRepository.getTaskExportJob(input as unknown as GetTaskExportJobInput);
      return c.json(result as GetTaskExportJobResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route8 = serverContract.routes[8]!;
  app.get(route8.path, async (c) => {
    try {
      const body = {};
      const input = buildInput(c, route8, body);
      const loadAuthorizationResource8 = async () => await deps.todoRepository.downloadTaskExport(input as unknown as DownloadTaskExportInput) as unknown as Record<string, unknown>;
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route8.endpoint.authz, { capabilityId: route8.capabilityId, input, loadResource: typeof loadAuthorizationResource8 === "function" ? loadAuthorizationResource8 : undefined });
      requireRequestFields(route8, input);
      const artifact = await deps.todoRepository.downloadTaskExport(input as unknown as DownloadTaskExportInput);
      const responseHeaders = new Headers();
      responseHeaders.set("Content-Type", artifact.contentType || "application/zip");
      responseHeaders.set("Content-Disposition", contentDisposition("attachment", artifact.filename || "task-export.zip"));
      return new Response(artifact.body as BodyInit | null, { status: 200, headers: responseHeaders });
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route9 = serverContract.routes[9]!;
  app.get(route9.path, async (c) => {
    try {
      const body = {};
      const input = buildInput(c, route9, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route9.endpoint.authz, { capabilityId: route9.capabilityId, input, loadResource: undefined });
      requireRequestFields(route9, input);
      const result = await deps.todoRepository.listProjects(input as unknown as ListProjectsInput);
      return c.json(result as ListProjectsResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route10 = serverContract.routes[10]!;
  app.get(route10.path, async (c) => {
    try {
      const body = {};
      const input = buildInput(c, route10, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route10.endpoint.authz, { capabilityId: route10.capabilityId, input, loadResource: undefined });
      requireRequestFields(route10, input);
      const result = await deps.todoRepository.getProject(input as unknown as GetProjectInput);
      return c.json(result as GetProjectResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route11 = serverContract.routes[11]!;
  app.post(route11.path, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const input = buildInput(c, route11, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route11.endpoint.authz, { capabilityId: route11.capabilityId, input, loadResource: undefined });
      requireRequestFields(route11, input);
      const result = await deps.todoRepository.createProject(input as unknown as CreateProjectInput);
      return c.json(result as CreateProjectResult, 201 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route12 = serverContract.routes[12]!;
  app.patch(route12.path, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const input = buildInput(c, route12, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route12.endpoint.authz, { capabilityId: route12.capabilityId, input, loadResource: undefined });
      requireRequestFields(route12, input);
      const result = await deps.todoRepository.updateProject(input as unknown as UpdateProjectInput);
      return c.json(result as UpdateProjectResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route13 = serverContract.routes[13]!;
  app.get(route13.path, async (c) => {
    try {
      const body = {};
      const input = buildInput(c, route13, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route13.endpoint.authz, { capabilityId: route13.capabilityId, input, loadResource: undefined });
      requireRequestFields(route13, input);
      const result = await deps.todoRepository.listUsers(input as unknown as ListUsersInput);
      return c.json(result as ListUsersResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route14 = serverContract.routes[14]!;
  app.get(route14.path, async (c) => {
    try {
      const body = {};
      const input = buildInput(c, route14, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route14.endpoint.authz, { capabilityId: route14.capabilityId, input, loadResource: undefined });
      requireRequestFields(route14, input);
      const result = await deps.todoRepository.getUser(input as unknown as GetUserInput);
      return c.json(result as GetUserResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route15 = serverContract.routes[15]!;
  app.post(route15.path, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const input = buildInput(c, route15, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route15.endpoint.authz, { capabilityId: route15.capabilityId, input, loadResource: undefined });
      requireRequestFields(route15, input);
      const result = await deps.todoRepository.createUser(input as unknown as CreateUserInput);
      return c.json(result as CreateUserResult, 201 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route16 = serverContract.routes[16]!;
  app.patch(route16.path, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const input = buildInput(c, route16, body);
      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");
      await deps.authorize(c, route16.endpoint.authz, { capabilityId: route16.capabilityId, input, loadResource: undefined });
      requireRequestFields(route16, input);
      const result = await deps.todoRepository.updateUser(input as unknown as UpdateUserInput);
      return c.json(result as UpdateUserResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  return app;
}

export type AppType = ReturnType<typeof createApp>;

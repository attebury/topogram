import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import { serverContract } from "../topogram/server-contract";
import { HttpError, coerceValue, jsonError, requireHeaders, requireRequestFields } from "./helpers";
import type { ServerDependencies } from "./context";
import type { CompleteTaskInput, CompleteTaskResult, CreateTaskInput, CreateTaskResult, DeleteTaskInput, DeleteTaskResult, DownloadTaskExportInput, DownloadTaskExportResult, ExportTasksInput, ExportTasksResult, GetTaskExportJobInput, GetTaskExportJobResult, GetTaskInput, GetTaskResult, ListTasksInput, ListTasksResult, ListTasksResultItem, UpdateTaskInput, UpdateTaskResult } from "../persistence/types";

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

  app.get("/lookups/projects", async (c) => {
    try {
      const result = await deps.taskRepository.listProjectOptions();
      return c.json(result, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  app.get("/lookups/users", async (c) => {
    try {
      const result = await deps.taskRepository.listUserOptions();
      return c.json(result, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route0 = serverContract.routes[0]!;
  app.post(route0.path, async (c) => {
    try {
      await deps.authorize?.(c, route0.endpoint.authz);
      requireHeaders(c, [...route0.endpoint.preconditions, ...route0.endpoint.idempotency]);
      const body = await c.req.json().catch(() => ({}));
      const input = buildInput(c, route0, body);
      requireRequestFields(route0, input);
      const result = await deps.taskRepository.createTask(input as unknown as CreateTaskInput);
      return c.json(result as CreateTaskResult, 201 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route1 = serverContract.routes[1]!;
  app.get(route1.path, async (c) => {
    try {
      await deps.authorize?.(c, route1.endpoint.authz);
      const body = {};
      const input = buildInput(c, route1, body);
      requireRequestFields(route1, input);
      const result = await deps.taskRepository.getTask(input as unknown as GetTaskInput);
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
      await deps.authorize?.(c, route2.endpoint.authz);
      requireHeaders(c, [...route2.endpoint.preconditions, ...route2.endpoint.idempotency]);
      const body = await c.req.json().catch(() => ({}));
      const input = buildInput(c, route2, body);
      requireRequestFields(route2, input);
      const ifMatch = c.req.header("If-Match");
      if (ifMatch) {
        const currentTask = await deps.taskRepository.getTask({ task_id: String(input.task_id || "") } as unknown as GetTaskInput);
        if (currentTask.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.taskRepository.updateTask(input as unknown as UpdateTaskInput);
      return c.json(result as UpdateTaskResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route3 = serverContract.routes[3]!;
  app.post(route3.path, async (c) => {
    try {
      await deps.authorize?.(c, route3.endpoint.authz);
      requireHeaders(c, [...route3.endpoint.preconditions, ...route3.endpoint.idempotency]);
      const body = await c.req.json().catch(() => ({}));
      const input = buildInput(c, route3, body);
      requireRequestFields(route3, input);
      const ifMatch = c.req.header("If-Match");
      if (ifMatch) {
        const currentTask = await deps.taskRepository.getTask({ task_id: String(input.task_id || "") } as unknown as GetTaskInput);
        if (currentTask.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.taskRepository.completeTask(input as unknown as CompleteTaskInput);
      return c.json(result as CompleteTaskResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route4 = serverContract.routes[4]!;
  app.get(route4.path, async (c) => {
    try {
      await deps.authorize?.(c, route4.endpoint.authz);
      const body = {};
      const input = buildInput(c, route4, body);
      requireRequestFields(route4, input);
      const result = await deps.taskRepository.listTasks(input as unknown as ListTasksInput);
      return c.json(result as ListTasksResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route5 = serverContract.routes[5]!;
  app.delete(route5.path, async (c) => {
    try {
      await deps.authorize?.(c, route5.endpoint.authz);
      requireHeaders(c, [...route5.endpoint.preconditions, ...route5.endpoint.idempotency]);
      const body = {};
      const input = buildInput(c, route5, body);
      requireRequestFields(route5, input);
      const ifMatch = c.req.header("If-Match");
      if (ifMatch) {
        const currentTask = await deps.taskRepository.getTask({ task_id: String(input.task_id || "") } as unknown as GetTaskInput);
        if (currentTask.updated_at !== ifMatch) {
          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");
        }
      }
      const result = await deps.taskRepository.deleteTask(input as unknown as DeleteTaskInput);
      return c.json(result as DeleteTaskResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route6 = serverContract.routes[6]!;
  app.post(route6.path, async (c) => {
    try {
      await deps.authorize?.(c, route6.endpoint.authz);
      const body = await c.req.json().catch(() => ({}));
      const input = buildInput(c, route6, body);
      requireRequestFields(route6, input);
      const result = await deps.taskRepository.exportTasks(input as unknown as ExportTasksInput);
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
      await deps.authorize?.(c, route7.endpoint.authz);
      const body = {};
      const input = buildInput(c, route7, body);
      requireRequestFields(route7, input);
      const result = await deps.taskRepository.getTaskExportJob(input as unknown as GetTaskExportJobInput);
      return c.json(result as GetTaskExportJobResult, 200 as any);
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  const route8 = serverContract.routes[8]!;
  app.get(route8.path, async (c) => {
    try {
      await deps.authorize?.(c, route8.endpoint.authz);
      const body = {};
      const input = buildInput(c, route8, body);
      requireRequestFields(route8, input);
      const artifact = await deps.taskRepository.downloadTaskExport(input as unknown as DownloadTaskExportInput);
      const responseHeaders = new Headers();
      responseHeaders.set("Content-Type", artifact.contentType || "application/zip");
      responseHeaders.set("Content-Disposition", `attachment; filename="${artifact.filename || "task-export.zip"}"`);
      return new Response(artifact.body as BodyInit | null, { status: 200, headers: responseHeaders });
    } catch (error) {
      const failure = jsonError(error);
      return c.json(failure.body, failure.status as any);
    }
  });

  return app;
}

export type AppType = ReturnType<typeof createApp>;

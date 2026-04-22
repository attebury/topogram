import { Hono } from "hono";

const app = new Hono();

app.get("/tasks", requireAuth, listTasksHandler);
app.post("/tasks", requireAuth, createTaskHandler);
app.patch("/tasks/:id", requireAuth, updateTaskHandler);

function listTasksHandler(c) {
  const status = c.req.query("status");
  const ownerId = c.req.query("ownerId");
  return c.json({ status, ownerId });
}

function createTaskHandler(c) {
  return c.json({ ok: true }, 201);
}

function updateTaskHandler(c) {
  const id = c.req.param("id");
  return c.json({ id, ok: true });
}

function requireAuth(c, next) {
  return next();
}

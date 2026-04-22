import { serve } from "@hono/node-server";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./lib/server/app";
import { PrismaTaskRepository } from "./lib/persistence/prisma/repositories";

export function createServer() {
  const prisma = new PrismaClient();
  const taskRepository = new PrismaTaskRepository(prisma);
  return createApp({
    taskRepository,
    ready: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
    authorize: async () => {
      // Plug your authz layer in here.
    }
  });
}

const app = createServer();
const port = Number(process.env.PORT || 3000);

serve({
  fetch: app.fetch,
  port
});

console.log(`topogram-todo-server listening on http://localhost:${port}`);

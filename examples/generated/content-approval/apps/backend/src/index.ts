import { serve } from "@hono/node-server";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./lib/server/app";
import { PrismaArticleRepository } from "./lib/persistence/prisma/repositories";
import { authorizeWithGeneratedAuthProfile } from "./lib/server/helpers";

export function createServer() {
  const prisma = new PrismaClient();
  const articleRepository = new PrismaArticleRepository(prisma);
  return createApp({
    articleRepository,
    ready: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
    authorize: async (ctx, authz, authorizationContext) => {
      await authorizeWithGeneratedAuthProfile(ctx, authz, authorizationContext);
    }
  });
}

const app = createServer();
const port = Number(process.env.PORT || 3002);

serve({
  fetch: app.fetch,
  port
});

console.log(`topogram-content-approval-server listening on http://localhost:${port}`);

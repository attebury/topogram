import { serve } from "@hono/node-server";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./lib/server/app";
import { PrismaIssueRepository } from "./lib/persistence/prisma/repositories";
import { authorizeWithGeneratedAuthProfile } from "./lib/server/helpers";

export function createServer() {
  const prisma = new PrismaClient();
  const issueRepository = new PrismaIssueRepository(prisma);
  return createApp({
    issueRepository,
    ready: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
    authorize: async (ctx, authz, authorizationContext) => {
      await authorizeWithGeneratedAuthProfile(ctx, authz, authorizationContext);
    }
  });
}

const app = createServer();
const port = Number(process.env.PORT || 3001);

serve({
  fetch: app.fetch,
  port
});

console.log(`topogram-issues-server listening on http://localhost:${port}`);

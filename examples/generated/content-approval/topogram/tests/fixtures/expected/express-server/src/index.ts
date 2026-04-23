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
    authorize: async (req, authz, authorizationContext) => {
      await authorizeWithGeneratedAuthProfile(req, authz, authorizationContext);
    }
  });
}

const app = createServer();
const port = Number(process.env.PORT || 3002);

app.listen(port, () => {
  console.log(`topogram-content-approval-server listening on http://localhost:${port}`);
});

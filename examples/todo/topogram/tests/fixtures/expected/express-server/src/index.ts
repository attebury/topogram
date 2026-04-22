import { PrismaClient } from "@prisma/client";
import { createApp } from "./lib/server/app";
import { PrismaTodoRepository } from "./lib/persistence/prisma/repositories";
import { authorizeWithGeneratedAuthProfile } from "./lib/server/helpers";

export function createServer() {
  const prisma = new PrismaClient();
  const todoRepository = new PrismaTodoRepository(prisma);
  return createApp({
    todoRepository,
    ready: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
    authorize: async (req, authz, authorizationContext) => {
      await authorizeWithGeneratedAuthProfile(req, authz, authorizationContext);
    }
  });
}

const app = createServer();
const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`topogram-todo-server listening on http://localhost:${port}`);
});

import type { Context } from "hono";
import type { TaskRepository } from "../persistence/repositories";
import { serverContract } from "../topogram/server-contract";

export interface ServerDependencies {
  taskRepository: TaskRepository;
  ready?: () => Promise<void> | void;
  authorize?: (ctx: Context, authz: (typeof serverContract.routes)[number]["endpoint"]["authz"]) => Promise<void> | void;
}

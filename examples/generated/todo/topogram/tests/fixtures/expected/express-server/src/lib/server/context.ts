import type { Request } from "express";
import type { TodoRepository } from "../persistence/repositories";
import type { AuthorizationContext } from "./helpers";
import { serverContract } from "../topogram/server-contract";

export interface ServerDependencies {
  todoRepository: TodoRepository;
  ready?: () => Promise<void> | void;
  authorize?: (
    req: Request,
    authz: (typeof serverContract.routes)[number]["endpoint"]["authz"],
    authorizationContext?: AuthorizationContext
  ) => Promise<void> | void;
}

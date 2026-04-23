import type { Context } from "hono";
import type { ArticleRepository } from "../persistence/repositories";
import type { AuthorizationContext } from "./helpers";
import { serverContract } from "../topogram/server-contract";

export interface ServerDependencies {
  articleRepository: ArticleRepository;
  ready?: () => Promise<void> | void;
  authorize?: (
    ctx: Context,
    authz: (typeof serverContract.routes)[number]["endpoint"]["authz"],
    authorizationContext?: AuthorizationContext
  ) => Promise<void> | void;
}

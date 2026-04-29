import { TODO_BACKEND_REFERENCE } from "./backend/reference.js";
import { TODO_BACKEND_REPOSITORY_REFERENCE } from "./backend/repository-reference.js";
import {
  renderTodoDrizzleRepositoryBody,
  renderTodoPrismaRepositoryBody
} from "./backend/repository-renderers.js";
import { TODO_RUNTIME_REFERENCE } from "./runtime/reference.js";
import { TODO_RUNTIME_CHECKS } from "./runtime/checks.js";
import {
  renderTodoRuntimeCheckCases,
  renderTodoRuntimeCheckCreatePayload,
  renderTodoRuntimeCheckHelpers,
  renderTodoRuntimeCheckState
} from "./runtime/check-renderers.js";
import { TODO_WEB_REFERENCE } from "./web/reference.js";
import { TODO_WEB_SCREEN_REFERENCE } from "./web/screens-reference.js";
import {
  renderTodoHomePage,
  renderTodoTaskRoutes
} from "./web/renderers.js";

export const WEB_API_DB_IMPLEMENTATION = {
  exampleId: "web-api-db-template",
  exampleRoot: "/topogram",
  backend: {
    reference: TODO_BACKEND_REFERENCE,
    repositoryReference: TODO_BACKEND_REPOSITORY_REFERENCE,
    repositoryRenderers: {
      renderPrismaRepositoryBody: renderTodoPrismaRepositoryBody,
      renderDrizzleRepositoryBody: renderTodoDrizzleRepositoryBody
    }
  },
  runtime: {
    reference: TODO_RUNTIME_REFERENCE,
    checks: TODO_RUNTIME_CHECKS,
    checkRenderers: {
      renderRuntimeCheckState: renderTodoRuntimeCheckState,
      renderRuntimeCheckCreatePayload: renderTodoRuntimeCheckCreatePayload,
      renderRuntimeCheckHelpers: renderTodoRuntimeCheckHelpers,
      renderRuntimeCheckCases: renderTodoRuntimeCheckCases
    }
  },
  web: {
    reference: TODO_WEB_REFERENCE,
    screenReference: TODO_WEB_SCREEN_REFERENCE,
    renderers: {
      renderHomePage: renderTodoHomePage,
      renderRoutes: renderTodoTaskRoutes
    }
  }
};

export default WEB_API_DB_IMPLEMENTATION;

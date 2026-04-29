import { HELLO_BACKEND_REFERENCE } from "./backend/reference.js";
import { HELLO_BACKEND_REPOSITORY_REFERENCE } from "./backend/repository-reference.js";
import {
  renderHelloDrizzleRepositoryBody,
  renderHelloPrismaRepositoryBody
} from "./backend/repository-renderers.js";
import { HELLO_RUNTIME_REFERENCE } from "./runtime/reference.js";
import { HELLO_RUNTIME_CHECKS } from "./runtime/checks.js";
import {
  renderHelloRuntimeCheckCases,
  renderHelloRuntimeCheckCreatePayload,
  renderHelloRuntimeCheckHelpers,
  renderHelloRuntimeCheckState
} from "./runtime/check-renderers.js";
import { HELLO_WEB_REFERENCE } from "./web/reference.js";
import { HELLO_WEB_SCREEN_REFERENCE } from "./web/screens-reference.js";
import {
  renderHelloHomePage,
  renderHelloRoutes
} from "./web/renderers.js";

export const WEB_API_DB_IMPLEMENTATION = {
  exampleId: "web-api-db-template",
  exampleRoot: "/topogram",
  backend: {
    reference: HELLO_BACKEND_REFERENCE,
    repositoryReference: HELLO_BACKEND_REPOSITORY_REFERENCE,
    repositoryRenderers: {
      renderPrismaRepositoryBody: renderHelloPrismaRepositoryBody,
      renderDrizzleRepositoryBody: renderHelloDrizzleRepositoryBody
    }
  },
  runtime: {
    reference: HELLO_RUNTIME_REFERENCE,
    checks: HELLO_RUNTIME_CHECKS,
    checkRenderers: {
      renderRuntimeCheckState: renderHelloRuntimeCheckState,
      renderRuntimeCheckCreatePayload: renderHelloRuntimeCheckCreatePayload,
      renderRuntimeCheckHelpers: renderHelloRuntimeCheckHelpers,
      renderRuntimeCheckCases: renderHelloRuntimeCheckCases
    }
  },
  web: {
    reference: HELLO_WEB_REFERENCE,
    screenReference: HELLO_WEB_SCREEN_REFERENCE,
    renderers: {
      renderHomePage: renderHelloHomePage,
      renderRoutes: renderHelloRoutes
    }
  }
};

export default WEB_API_DB_IMPLEMENTATION;

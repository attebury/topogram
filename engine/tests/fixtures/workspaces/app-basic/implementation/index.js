import { APP_BASIC_BACKEND_REFERENCE } from "./backend/reference.js";
import { APP_BASIC_BACKEND_REPOSITORY_REFERENCE } from "./backend/repository-reference.js";
import {
  renderAppBasicDrizzleRepositoryBody,
  renderAppBasicPrismaRepositoryBody
} from "./backend/repository-renderers.js";
import { APP_BASIC_RUNTIME_REFERENCE } from "./runtime/reference.js";
import { APP_BASIC_RUNTIME_CHECKS } from "./runtime/checks.js";
import {
  renderAppBasicRuntimeCheckCases,
  renderAppBasicRuntimeCheckCreatePayload,
  renderAppBasicRuntimeCheckHelpers,
  renderAppBasicRuntimeCheckState
} from "./runtime/check-renderers.js";
import { APP_BASIC_WEB_REFERENCE } from "./web/reference.js";
import { APP_BASIC_WEB_SCREEN_REFERENCE } from "./web/screens-reference.js";
import {
  renderAppBasicHomePage,
  renderAppBasicTaskRoutes
} from "./web/renderers.js";

export const APP_BASIC_IMPLEMENTATION = {
  exampleId: "app-basic-fixture",
  exampleRoot: "/engine/tests/fixtures/workspaces/app-basic",
  backend: {
    reference: APP_BASIC_BACKEND_REFERENCE,
    repositoryReference: APP_BASIC_BACKEND_REPOSITORY_REFERENCE,
    repositoryRenderers: {
      renderPrismaRepositoryBody: renderAppBasicPrismaRepositoryBody,
      renderDrizzleRepositoryBody: renderAppBasicDrizzleRepositoryBody
    }
  },
  runtime: {
    reference: APP_BASIC_RUNTIME_REFERENCE,
    checks: APP_BASIC_RUNTIME_CHECKS,
    checkRenderers: {
      renderRuntimeCheckState: renderAppBasicRuntimeCheckState,
      renderRuntimeCheckCreatePayload: renderAppBasicRuntimeCheckCreatePayload,
      renderRuntimeCheckHelpers: renderAppBasicRuntimeCheckHelpers,
      renderRuntimeCheckCases: renderAppBasicRuntimeCheckCases
    }
  },
  web: {
    reference: APP_BASIC_WEB_REFERENCE,
    screenReference: APP_BASIC_WEB_SCREEN_REFERENCE,
    renderers: {
      renderHomePage: renderAppBasicHomePage,
      renderRoutes: renderAppBasicTaskRoutes
    }
  }
};

export default APP_BASIC_IMPLEMENTATION;

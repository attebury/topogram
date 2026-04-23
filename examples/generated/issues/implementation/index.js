import { ISSUES_BACKEND_REFERENCE } from "./backend/reference.js";
import { ISSUES_BACKEND_REPOSITORY_REFERENCE } from "./backend/repository-reference.js";
import {
  renderIssuesDrizzleRepositoryBody,
  renderIssuesPrismaRepositoryBody
} from "./backend/repository-renderers.js";
import { ISSUES_RUNTIME_REFERENCE } from "./runtime/reference.js";
import { ISSUES_RUNTIME_CHECKS } from "./runtime/checks.js";
import {
  renderIssuesRuntimeCheckCases,
  renderIssuesRuntimeCheckCreatePayload,
  renderIssuesRuntimeCheckHelpers,
  renderIssuesRuntimeCheckState
} from "./runtime/check-renderers.js";
import { ISSUES_WEB_REFERENCE } from "./web/reference.js";
import { ISSUES_WEB_SCREEN_REFERENCE } from "./web/screens-reference.js";
import {
  renderIssuesHomePage,
  renderIssuesRoutes
} from "./web/renderers.js";

export const ISSUES_IMPLEMENTATION = {
  exampleId: "issues",
  exampleRoot: "/examples/generated/issues/topogram",
  backend: {
    reference: ISSUES_BACKEND_REFERENCE,
    repositoryReference: ISSUES_BACKEND_REPOSITORY_REFERENCE,
    repositoryRenderers: {
      renderPrismaRepositoryBody: renderIssuesPrismaRepositoryBody,
      renderDrizzleRepositoryBody: renderIssuesDrizzleRepositoryBody
    }
  },
  runtime: {
    reference: ISSUES_RUNTIME_REFERENCE,
    checks: ISSUES_RUNTIME_CHECKS,
    checkRenderers: {
      renderRuntimeCheckState: renderIssuesRuntimeCheckState,
      renderRuntimeCheckCreatePayload: renderIssuesRuntimeCheckCreatePayload,
      renderRuntimeCheckHelpers: renderIssuesRuntimeCheckHelpers,
      renderRuntimeCheckCases: renderIssuesRuntimeCheckCases
    }
  },
  web: {
    reference: ISSUES_WEB_REFERENCE,
    screenReference: ISSUES_WEB_SCREEN_REFERENCE,
    renderers: {
      renderHomePage: renderIssuesHomePage,
      renderRoutes: renderIssuesRoutes
    }
  }
};

export default ISSUES_IMPLEMENTATION;

import { CONTENT_APPROVAL_BACKEND_REFERENCE } from "./backend/reference.js";
import { CONTENT_APPROVAL_BACKEND_REPOSITORY_REFERENCE } from "./backend/repository-reference.js";
import {
  renderContentApprovalDrizzleRepositoryBody,
  renderContentApprovalPrismaRepositoryBody
} from "./backend/repository-renderers.js";
import { CONTENT_APPROVAL_RUNTIME_REFERENCE } from "./runtime/reference.js";
import { CONTENT_APPROVAL_RUNTIME_CHECKS } from "./runtime/checks.js";
import {
  renderContentApprovalRuntimeCheckCases,
  renderContentApprovalRuntimeCheckCreatePayload,
  renderContentApprovalRuntimeCheckHelpers,
  renderContentApprovalRuntimeCheckState
} from "./runtime/check-renderers.js";
import { CONTENT_APPROVAL_WEB_REFERENCE } from "./web/reference.js";
import { CONTENT_APPROVAL_WEB_SCREEN_REFERENCE } from "./web/screens-reference.js";
import {
  renderContentApprovalHomePage,
  renderContentApprovalRoutes
} from "./web/renderers.js";

export const CONTENT_APPROVAL_IMPLEMENTATION = {
  exampleId: "contentApproval",
  exampleRoot: "/examples/generated/content-approval/topogram",
  backend: {
    reference: CONTENT_APPROVAL_BACKEND_REFERENCE,
    repositoryReference: CONTENT_APPROVAL_BACKEND_REPOSITORY_REFERENCE,
    repositoryRenderers: {
      renderPrismaRepositoryBody: renderContentApprovalPrismaRepositoryBody,
      renderDrizzleRepositoryBody: renderContentApprovalDrizzleRepositoryBody
    }
  },
  runtime: {
    reference: CONTENT_APPROVAL_RUNTIME_REFERENCE,
    checks: CONTENT_APPROVAL_RUNTIME_CHECKS,
    checkRenderers: {
      renderRuntimeCheckState: renderContentApprovalRuntimeCheckState,
      renderRuntimeCheckCreatePayload: renderContentApprovalRuntimeCheckCreatePayload,
      renderRuntimeCheckHelpers: renderContentApprovalRuntimeCheckHelpers,
      renderRuntimeCheckCases: renderContentApprovalRuntimeCheckCases
    }
  },
  web: {
    reference: CONTENT_APPROVAL_WEB_REFERENCE,
    screenReference: CONTENT_APPROVAL_WEB_SCREEN_REFERENCE,
    renderers: {
      renderHomePage: renderContentApprovalHomePage,
      renderRoutes: renderContentApprovalRoutes
    }
  }
};

export default CONTENT_APPROVAL_IMPLEMENTATION;

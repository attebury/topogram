import assert from "node:assert/strict";
import { buildArticleDetailViewModel } from "../src/content-approval.js";
import { buildRequestRevisionAction, buildResubmitArticleAction } from "../src/content-approval-actions.js";
import {
  assessArticleWorkflowSurfaceChange,
  summarizeArticleWorkflowDecision
} from "../src/content-approval-change-guards.js";
import { buildArticleDetailPage, buildArticleEditFormModel, buildRequestRevisionFormModel } from "../src/content-approval-ui.js";
import { buildIssueCardViewModel, buildIssueDetailViewModel } from "../src/issues.js";
import {
  assessProjectOwnerRelationChange,
  summarizeProjectOwnerRelationDecision
} from "../src/todo-change-guards.js";
import {
  buildProjectDetailViewModel,
  buildTaskCardViewModel,
  buildTaskDetailViewModel
} from "../src/todo.js";
import {
  docById,
  fieldNames,
  openApiSchema,
  readContentApprovalDocsIndex,
  readContentApprovalOpenApi,
  readIssuesDocsMarkdown,
  readIssuesDocsIndex,
  readIssuesOpenApi,
  readIssuesUiWebContract,
  readTodoDbSnapshot,
  readTodoDocsIndex,
  readTodoServerContract,
  readTodoTaskCardSchema,
  readTodoUiWebContract,
  routeByCapability,
  tableWithColumns
} from "./emitted-contracts.mjs";

export function assertEmittedArtifactAlignment() {
  const contentApprovalOpenApi = readContentApprovalOpenApi();
  const contentApprovalDocsIndex = readContentApprovalDocsIndex();
  const issuesOpenApi = readIssuesOpenApi();
  const issuesDocsIndex = readIssuesDocsIndex();
  const issuesDocsMarkdown = readIssuesDocsMarkdown();
  const issuesUiWebContract = readIssuesUiWebContract();
  const articleDetailSchema = openApiSchema(contentApprovalOpenApi, "ShapeOutputArticleDetailResponse");
  const articleUpdateSchema = openApiSchema(contentApprovalOpenApi, "ShapeInputUpdateArticleRequest");
  const issueDetailSchema = openApiSchema(issuesOpenApi, "ShapeOutputIssueDetailResponse");

  const articleDetailFields = new Set(Object.keys(articleDetailSchema.properties || {}));
  for (const field of ["submitted_at", "revision_requested_at", "approved_at", "rejected_at", "reviewer_notes"]) {
    assert.ok(articleDetailFields.has(field), `Expected emitted article detail contract to include ${field}`);
  }
  assert.ok(
    (articleUpdateSchema.properties?.status?.enum || []).includes("needs_revision"),
    "Expected emitted article update contract to include needs_revision"
  );

  const articleResubmissionJourney = docById(contentApprovalDocsIndex, "article_resubmission_after_review");
  assert.equal(articleResubmissionJourney.kind, "journey");
  assert.deepEqual(
    articleResubmissionJourney.related_capabilities,
    ["cap_request_article_revision", "cap_update_article", "cap_get_article"]
  );
  assert.match(articleResubmissionJourney.body, /needs to understand why a revision was requested/i);
  assert.match(articleResubmissionJourney.body, /resubmit the same article back into review/i);
  assert.match(articleResubmissionJourney.body, /review context is no longer visible/i);

  const issueDetailFields = new Set(Object.keys(issueDetailSchema.properties || {}));
  for (const field of ["id", "title", "status", "board_id", "assignee_id", "updated_at", "closed_at", "priority"]) {
    assert.ok(issueDetailFields.has(field), `Expected emitted issue detail contract to include ${field}`);
  }

  const issueDetailScreen = (issuesUiWebContract.screens || []).find((screen) => screen.id === "issue_detail");
  assert.ok(issueDetailScreen, "Expected emitted UI contract to include issue_detail");
  assert.equal(issueDetailScreen.viewShape?.id, "shape_output_issue_detail");
  assert.deepEqual(
    issueDetailScreen.visibility,
    [
      {
        capability: { id: "cap_update_issue", kind: "capability" },
        claimValue: null,
        ownershipField: "assignee_id",
        predicate: "ownership",
        value: "owner_or_admin"
      },
      {
        capability: { id: "cap_close_issue", kind: "capability" },
        claimValue: null,
        ownershipField: "assignee_id",
        predicate: "ownership",
        value: "owner_or_admin"
      }
    ]
  );

  const issueResolutionJourney = docById(issuesDocsIndex, "issue_resolution_and_closure");
  assert.equal(issueResolutionJourney.kind, "journey");
  assert.deepEqual(
    issueResolutionJourney.related_capabilities,
    ["cap_get_issue", "cap_update_issue", "cap_close_issue"]
  );
  assert.match(issueResolutionJourney.body, /normal detail flow should not present owner-only update or close actions/i);
  assert.match(issueResolutionJourney.body, /opens the issue detail view/i);

  const issueCreationJourney = docById(issuesDocsIndex, "issue_creation_and_assignment");
  assert.equal(issueCreationJourney.kind, "journey");
  assert.deepEqual(
    issueCreationJourney.related_capabilities,
    ["cap_create_issue", "cap_get_issue", "cap_list_issues"]
  );
  assert.match(issueCreationJourney.body, /shows up immediately in the list and detail surfaces/i);
  assert.match(issueCreationJourney.body, /optional assignee and priority/i);

  const issueListScreen = (issuesUiWebContract.screens || []).find((screen) => screen.id === "issue_list");
  assert.ok(issueListScreen, "Expected emitted UI contract to include issue_list");
  assert.equal(issueListScreen.itemShape?.id, "shape_output_issue_card");
  assert.deepEqual(issueListScreen.collection?.filters, ["board_id", "assignee_id", "status"]);

  assert.match(issuesDocsMarkdown, /### `shape_output_issue_card` - Issue Card Output/);
  assert.match(issuesDocsMarkdown, /Compact issue payload for cards and lists/);
  assert.match(issuesDocsMarkdown, /rename `assignee_id` -> `assigneeId`/);
  assert.match(issuesDocsMarkdown, /`priority` - `string` - optional/);
  assert.match(issuesDocsMarkdown, /`assigneeId` - `uuid` - required - from `assignee_id`/);

  const todoServerContract = readTodoServerContract();
  const todoDbSnapshot = readTodoDbSnapshot();
  const todoDocsIndex = readTodoDocsIndex();
  const todoUiWebContract = readTodoUiWebContract();
  const todoTaskCardSchema = readTodoTaskCardSchema();
  const createTaskRoute = routeByCapability(todoServerContract, "cap_create_task");
  const getTaskRoute = routeByCapability(todoServerContract, "cap_get_task");
  const taskCreateFields = new Set(fieldNames(createTaskRoute.requestContract?.fields));
  const taskDetailFields = new Set(fieldNames(getTaskRoute.responseContract?.fields));
  assert.ok(taskCreateFields.has("priority"), "Expected emitted create-task contract to include priority");
  assert.ok(taskCreateFields.has("owner_id"), "Expected emitted create-task contract to include owner_id");
  assert.ok(taskDetailFields.has("priority"), "Expected emitted task-detail contract to include priority");
  assert.ok(taskDetailFields.has("owner_id"), "Expected emitted task-detail contract to include owner_id");

  const projectTable = tableWithColumns(todoDbSnapshot, ["name", "owner_id", "status"]);
  const taskTable = tableWithColumns(todoDbSnapshot, ["title", "priority", "owner_id", "project_id"]);
  assert.ok(
    (projectTable.relations || []).some((relation) => relation.field === "owner_id" && relation.target?.id === "entity_user"),
    "Expected emitted project DB contract to keep owner_id -> entity_user"
  );
  assert.ok(
    (taskTable.columns || []).some((column) => column.name === "priority" && column.required === true),
    "Expected emitted task DB contract to keep priority as a required field"
  );
  assert.ok(
    (taskTable.relations || []).some((relation) => relation.field === "owner_id" && relation.target?.id === "entity_user"),
    "Expected emitted task DB contract to keep owner_id -> entity_user"
  );

  const taskCreationJourney = docById(todoDocsIndex, "task_creation_and_ownership");
  assert.equal(taskCreationJourney.kind, "journey");
  assert.deepEqual(
    taskCreationJourney.related_capabilities,
    ["cap_create_task", "cap_get_task", "cap_list_tasks", "cap_update_task"]
  );
  assert.match(taskCreationJourney.body, /including priority and an optional owner/i);
  assert.match(taskCreationJourney.body, /task list and task detail surfaces/i);
  assert.match(taskCreationJourney.body, /project has already been archived/i);

  const taskListScreen = (todoUiWebContract.screens || []).find((screen) => screen.id === "task_list");
  assert.ok(taskListScreen, "Expected emitted UI contract to include task_list");
  assert.equal(taskListScreen.itemShape?.id, "shape_output_task_card");
  assert.deepEqual(taskListScreen.collection?.filters, ["project_id", "owner_id", "status"]);

  const taskCardFields = new Set(Object.keys(todoTaskCardSchema.properties || {}));
  for (const field of ["title", "status", "priority", "ownerId"]) {
    assert.ok(taskCardFields.has(field), `Expected emitted task-card schema to include ${field}`);
  }
  assert.deepEqual(todoTaskCardSchema.required, ["status", "priority", "ownerId"]);

  return { articleResubmissionJourney, issueCreationJourney, issueResolutionJourney, taskCreationJourney };
}

export function assertMaintainedAppProofScenarios({ articleResubmissionJourney, issueCreationJourney, issueResolutionJourney, taskCreationJourney }) {
  const viewModel = buildArticleDetailViewModel({
    id: "article_runtime",
    title: "Runtime Proof Article",
    status: "needs_revision",
    publication_id: "pub_runtime",
    reviewer_id: "reviewer_runtime",
    submitted_at: "2026-04-15T12:00:00.000Z",
    revision_requested_at: "2026-04-16T07:30:00.000Z",
    approved_at: null,
    rejected_at: null,
    reviewer_notes: "Needs stronger evidence before publication.",
    category: "editorial"
  });

  assert.equal(viewModel.reviewDecision.approvedAt, null);
  assert.equal(viewModel.reviewDecision.revisionRequestedAt, "2026-04-16T07:30:00.000Z");
  assert.equal(viewModel.reviewDecision.rejectedAt, null);
  assert.equal(viewModel.reviewDecision.reviewerNotes, "Needs stronger evidence before publication.");
  assert.equal(viewModel.workflowActions.canResubmit, true);
  assert.match(viewModel.summary, /Reviewer Notes: Needs stronger evidence before publication\./);
  assert.equal(viewModel.route, "/articles/article_runtime");
  assert.equal(viewModel.requestRevisionRoute, "/articles/article_runtime/request-revision");

  const unsupportedWorkflowAssessment = assessArticleWorkflowSurfaceChange({
    fromSurface: {
      canRequestRevision: false,
      canResubmit: false,
      requestRevisionRoute: null
    },
    toSurface: {
      canRequestRevision: true,
      canResubmit: false,
      requestRevisionRoute: "/articles/article_runtime/request-revision"
    }
  });

  assert.equal(unsupportedWorkflowAssessment.manualDecisionRequired, true);
  assert.match(
    summarizeArticleWorkflowDecision(unsupportedWorkflowAssessment),
    /manual decision required/i
  );
  assert.match(
    summarizeArticleWorkflowDecision(unsupportedWorkflowAssessment),
    /requestRevision=true/
  );

  const articlePage = buildArticleDetailPage({
    id: "article_runtime",
    title: "Runtime Proof Article",
    status: "needs_revision",
    publication_id: "pub_runtime",
    reviewer_id: "reviewer_runtime",
    submitted_at: "2026-04-15T12:00:00.000Z",
    revision_requested_at: "2026-04-16T07:30:00.000Z",
    approved_at: null,
    rejected_at: null,
    reviewer_notes: "Needs stronger evidence before publication.",
    category: "editorial"
  });

  assert.equal(articlePage.notices.length, 1);
  assert.equal(articlePage.actions.some((action) => action.label === "Request Revision"), false);
  assert.match(articlePage.notices[0], /resubmit/i);

  const articleEditForm = buildArticleEditFormModel(
    {
      id: "article_runtime",
      title: "Runtime Proof Article",
      status: "needs_revision",
      description: "Add stronger evidence.",
      reviewer_id: "reviewer_runtime",
      category: "editorial"
    },
    [{ value: "reviewer_runtime", label: "Runtime Reviewer" }]
  );

  assert.equal(articleEditForm.values.status, "submitted");
  assert.equal(articleEditForm.submitLabel, "Resubmit for Review");

  const requestRevisionForm = buildRequestRevisionFormModel({
    id: "article_runtime",
    reviewer_notes: "Needs stronger evidence before publication."
  });

  assert.equal(requestRevisionForm.action, "/articles/article_runtime/request-revision");
  assert.equal(requestRevisionForm.values.reviewer_notes, "Needs stronger evidence before publication.");

  const requestRevisionAction = buildRequestRevisionAction(
    {
      id: "article_runtime",
      updated_at: "2026-04-16T07:31:00.000Z"
    },
    {
      reviewer_notes: "Needs stronger evidence before publication."
    }
  );

  assert.equal(requestRevisionAction.capabilityId, "cap_request_article_revision");
  assert.equal(requestRevisionAction.payload.article_id, "article_runtime");
  assert.equal(
    articleResubmissionJourney.related_capabilities.includes("cap_get_article"),
    true,
    "Expected Content Approval journey to keep article detail visibility in scope for the maintained proof"
  );

  const resubmitAction = buildResubmitArticleAction(
    {
      id: "article_runtime",
      updated_at: "2026-04-16T07:32:00.000Z"
    },
    {
      title: "Runtime Proof Article",
      description: "Add stronger evidence.",
      reviewer_id: "reviewer_runtime",
      category: "editorial"
    }
  );

  assert.equal(resubmitAction.capabilityId, "cap_update_article");
  assert.equal(resubmitAction.payload.status, "submitted");
  assert.equal(resubmitAction.headers["If-Match"], "2026-04-16T07:32:00.000Z");
  assert.equal(
    articleResubmissionJourney.related_capabilities.includes("cap_update_article"),
    true,
    "Expected Content Approval journey to keep resubmission behavior in scope for the maintained proof"
  );

  const ownerIssueDetailViewModel = buildIssueDetailViewModel(
    {
      id: "issue_runtime",
      title: "Runtime Proof Issue",
      status: "in_progress",
      board_id: "board_runtime",
      assignee_id: "user_runtime",
      priority: "high",
      closed_at: null,
      description: "Runtime ownership proof issue"
    },
    {
      userId: "user_runtime",
      isAdmin: false
    }
  );

  assert.equal(ownerIssueDetailViewModel.route, "/issues/issue_runtime");
  assert.equal(ownerIssueDetailViewModel.editRoute, "/issues/issue_runtime/edit");
  assert.equal(ownerIssueDetailViewModel.assigneeBadge, "user_runtime");
  assert.equal(ownerIssueDetailViewModel.actionVisibility.canEdit, true);
  assert.equal(ownerIssueDetailViewModel.actionVisibility.canClose, true);
  assert.match(ownerIssueDetailViewModel.summary, /Assignee: user_runtime/);

  const nonOwnerIssueDetailViewModel = buildIssueDetailViewModel(
    {
      id: "issue_runtime",
      title: "Runtime Proof Issue",
      status: "in_progress",
      board_id: "board_runtime",
      assignee_id: "user_runtime",
      priority: "high",
      closed_at: null
    },
    {
      userId: "viewer_runtime",
      isAdmin: false
    }
  );

  assert.equal(nonOwnerIssueDetailViewModel.actionVisibility.canEdit, false);
  assert.equal(nonOwnerIssueDetailViewModel.actionVisibility.canClose, false);

  const adminIssueDetailViewModel = buildIssueDetailViewModel(
    {
      id: "issue_runtime",
      title: "Runtime Proof Issue",
      status: "in_progress",
      board_id: "board_runtime",
      assignee_id: "user_runtime",
      priority: "high",
      closed_at: null
    },
    {
      userId: "admin_runtime",
      isAdmin: true
    }
  );

  assert.equal(adminIssueDetailViewModel.actionVisibility.canEdit, true);
  assert.equal(adminIssueDetailViewModel.actionVisibility.canClose, true);
  assert.equal(
    issueResolutionJourney.related_capabilities.includes("cap_close_issue"),
    true,
    "Expected Issues journey to keep close behavior in scope for the maintained proof"
  );

  const issueCardViewModel = buildIssueCardViewModel({
    id: "issue_runtime",
    title: "Runtime Proof Issue",
    status: "open",
    priority: "medium",
    assigneeId: "user_runtime"
  });

  assert.equal(issueCardViewModel.route, "/issues/issue_runtime");
  assert.equal(issueCardViewModel.priorityBadge, "medium");
  assert.equal(issueCardViewModel.assigneeBadge, "user_runtime");
  assert.match(issueCardViewModel.summary, /Assignee: user_runtime/);
  assert.match(issueCardViewModel.summary, /Priority: medium/);
  assert.equal(
    issueCreationJourney.related_capabilities.includes("cap_list_issues"),
    true,
    "Expected Issues journey to keep issue list visibility in scope for the maintained proof"
  );

  const todoViewModel = buildTaskDetailViewModel({
    id: "task_runtime",
    title: "Runtime Proof Task",
    status: "active",
    priority: "high",
    project_id: "proj_runtime",
    owner_id: "user_runtime",
    due_at: null
  });

  assert.equal(todoViewModel.priorityBadge, "high");
  assert.match(todoViewModel.summary, /Priority: high/);
  assert.equal(todoViewModel.route, "/tasks/task_runtime");
  assert.equal(todoViewModel.editRoute, "/tasks/task_runtime/edit");
  assert.match(todoViewModel.summary, /Owner: user_runtime/);

  const todoProjectViewModel = buildProjectDetailViewModel({
    id: "project_runtime",
    name: "Runtime Proof Project",
    status: "active",
    owner_id: "user_runtime",
    created_at: "2026-04-17T12:15:00.000Z",
    description: "Runtime proof project"
  });

  assert.equal(todoProjectViewModel.ownerBadge, "user_runtime");
  assert.match(todoProjectViewModel.summary, /Owner: user_runtime/);

  const todoTaskCardViewModel = buildTaskCardViewModel({
    id: "task_runtime",
    title: "Runtime Proof Task",
    status: "active",
    priority: "high",
    ownerId: "user_runtime",
    dueAt: "2026-04-21T09:00:00.000Z"
  });

  assert.equal(todoTaskCardViewModel.route, "/tasks/task_runtime");
  assert.equal(todoTaskCardViewModel.priorityBadge, "high");
  assert.equal(todoTaskCardViewModel.ownerBadge, "user_runtime");
  assert.match(todoTaskCardViewModel.summary, /Priority: high/);
  assert.match(todoTaskCardViewModel.summary, /Owner: user_runtime/);
  assert.match(todoTaskCardViewModel.summary, /Due: 2026-04-21T09:00:00.000Z/);

  assert.equal(
    taskCreationJourney.related_capabilities.includes("cap_list_tasks"),
    true,
    "Expected Todo journey to keep list visibility in scope for the maintained proof"
  );
  assert.equal(
    taskCreationJourney.related_capabilities.includes("cap_get_task"),
    true,
    "Expected Todo journey to keep detail visibility in scope for the maintained proof"
  );

  const stableProjectOwnerRelation = {
    field: "owner_id",
    target: { id: "entity_user", field: "id" },
    onDelete: "set_null"
  };
  const retargetedProjectOwnerRelation = {
    field: "owner_id",
    target: { id: "entity_project", field: "id" },
    onDelete: "set_null"
  };

  const stableProjectOwnerAssessment = assessProjectOwnerRelationChange({
    fromRelation: stableProjectOwnerRelation,
    toRelation: stableProjectOwnerRelation
  });
  assert.equal(stableProjectOwnerAssessment.manualDecisionRequired, false);

  const unsupportedProjectOwnerAssessment = assessProjectOwnerRelationChange({
    fromRelation: retargetedProjectOwnerRelation,
    toRelation: stableProjectOwnerRelation
  });
  assert.equal(unsupportedProjectOwnerAssessment.manualDecisionRequired, true);
  assert.match(
    summarizeProjectOwnerRelationDecision(unsupportedProjectOwnerAssessment),
    /entity_project\.id/
  );
  assert.match(
    summarizeProjectOwnerRelationDecision(unsupportedProjectOwnerAssessment),
    /entity_user\.id/
  );
  assert.match(
    summarizeProjectOwnerRelationDecision(unsupportedProjectOwnerAssessment),
    /manual decision required/i
  );
}

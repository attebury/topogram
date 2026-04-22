import assert from "node:assert/strict";
import { ARTICLE_ROUTES, buildArticleDetailViewModel, summarizeArticleDetail } from "../src/content-approval.js";
import { buildRequestRevisionAction, buildResubmitArticleAction } from "../src/content-approval-actions.js";
import {
  assessArticleWorkflowSurfaceChange,
  summarizeArticleWorkflowDecision
} from "../src/content-approval-change-guards.js";
import { buildArticleDetailPage, buildArticleEditFormModel, buildRequestRevisionFormModel } from "../src/content-approval-ui.js";
import { ISSUE_ROUTES, buildIssueCardViewModel, buildIssueDetailViewModel, summarizeIssueDetail, summarizeIssueCard } from "../src/issues.js";
import {
  TODO_PROJECT_ROUTES,
  TODO_ROUTES,
  buildTaskCardViewModel,
  buildProjectDetailViewModel,
  buildTaskDetailViewModel,
  summarizeProjectDetail,
  summarizeTaskCard,
  summarizeTaskDetail
} from "../src/todo.js";
import {
  assessProjectOwnerRelationChange,
  summarizeProjectOwnerRelationDecision
} from "../src/todo-change-guards.js";

assert.equal(ARTICLE_ROUTES.list, "/articles");
assert.equal(ARTICLE_ROUTES.detail("abc"), "/articles/abc");
assert.equal(ARTICLE_ROUTES.edit("abc"), "/articles/abc/edit");
assert.equal(ARTICLE_ROUTES.requestRevision("abc"), "/articles/abc/request-revision");

const summary = summarizeArticleDetail({
  title: "Compile Check Article",
  status: "submitted",
  publication_id: "pub_123",
  reviewer_id: "user_123",
  submitted_at: "2026-04-16T12:00:00.000Z",
  revision_requested_at: null,
  approved_at: null,
  rejected_at: null,
  reviewer_notes: "Awaiting editorial review.",
  category: "workflow"
});

assert.match(summary, /Reviewer Notes:/);

const viewModel = buildArticleDetailViewModel({
  id: "article_123",
  title: "Compile Check Article",
  status: "submitted",
  publication_id: "pub_123",
  reviewer_id: "user_123",
  submitted_at: "2026-04-16T12:00:00.000Z",
  revision_requested_at: null,
  approved_at: null,
  rejected_at: null,
  reviewer_notes: "Awaiting editorial review.",
  category: "workflow"
});

assert.equal(viewModel.route, "/articles/article_123");
assert.equal(viewModel.reviewDecision.reviewerNotes, "Awaiting editorial review.");
assert.equal(viewModel.workflowActions.canRequestRevision, true);
assert.equal(viewModel.workflowActions.canResubmit, false);

const stableWorkflowAssessment = assessArticleWorkflowSurfaceChange({
  fromSurface: {
    canRequestRevision: viewModel.workflowActions.canRequestRevision,
    canResubmit: viewModel.workflowActions.canResubmit,
    requestRevisionRoute: viewModel.requestRevisionRoute
  },
  toSurface: {
    canRequestRevision: viewModel.workflowActions.canRequestRevision,
    canResubmit: viewModel.workflowActions.canResubmit,
    requestRevisionRoute: viewModel.requestRevisionRoute
  }
});

assert.equal(stableWorkflowAssessment.manualDecisionRequired, false);
assert.match(
  summarizeArticleWorkflowDecision(stableWorkflowAssessment),
  /stable enough for guided app updates/i
);

const articlePage = buildArticleDetailPage({
  id: "article_123",
  title: "Compile Check Article",
  status: "submitted",
  publication_id: "pub_123",
  reviewer_id: "user_123",
  submitted_at: "2026-04-16T12:00:00.000Z",
  revision_requested_at: null,
  approved_at: null,
  rejected_at: null,
  reviewer_notes: "Awaiting editorial review.",
  category: "workflow"
});

assert.equal(articlePage.actions.some((action) => action.label === "Request Revision"), true);

const articleEditForm = buildArticleEditFormModel(
  {
    id: "article_123",
    title: "Compile Check Article",
    status: "needs_revision",
    description: "Tighten the conclusion",
    reviewer_id: "user_123",
    category: "workflow"
  },
  [{ value: "user_123", label: "Reviewer 123" }]
);

assert.equal(articleEditForm.submitLabel, "Resubmit for Review");
assert.equal(articleEditForm.values.status, "submitted");

const requestRevisionForm = buildRequestRevisionFormModel({
  id: "article_123",
  reviewer_notes: "Please add stronger evidence."
});

assert.equal(requestRevisionForm.action, "/articles/article_123/request-revision");
assert.equal(requestRevisionForm.fields[0]?.name, "reviewer_notes");

const requestRevisionAction = buildRequestRevisionAction(
  {
    id: "article_123",
    updated_at: "2026-04-16T12:30:00.000Z"
  },
  {
    reviewer_notes: "Please add stronger evidence."
  }
);

assert.equal(requestRevisionAction.capabilityId, "cap_request_article_revision");
assert.equal(requestRevisionAction.path, "/articles/article_123/request-revision");
assert.equal(requestRevisionAction.payload.reviewer_notes, "Please add stronger evidence.");

const resubmitAction = buildResubmitArticleAction(
  {
    id: "article_123",
    updated_at: "2026-04-16T12:30:00.000Z"
  },
  {
    title: "Compile Check Article",
    description: "Updated draft",
    reviewer_id: "user_123",
    category: "workflow"
  }
);

assert.equal(resubmitAction.capabilityId, "cap_update_article");
assert.equal(resubmitAction.payload.status, "submitted");

assert.equal(ISSUE_ROUTES.list, "/issues");
assert.equal(ISSUE_ROUTES.detail("abc"), "/issues/abc");
assert.equal(ISSUE_ROUTES.edit("abc"), "/issues/abc/edit");

const issueSummary = summarizeIssueDetail({
  title: "Compile Check Issue",
  status: "in_progress",
  board_id: "board_123",
  assignee_id: "user_123",
  priority: "high",
  closed_at: null,
  description: "Compile check ownership proof"
});

assert.match(issueSummary, /Assignee: user_123/);
assert.match(issueSummary, /Priority: high/);

const issueViewModel = buildIssueDetailViewModel(
  {
    id: "issue_123",
    title: "Compile Check Issue",
    status: "in_progress",
    board_id: "board_123",
    assignee_id: "user_123",
    priority: "high",
    closed_at: null
  },
  {
    userId: "user_123",
    isAdmin: false
  }
);

assert.equal(issueViewModel.route, "/issues/issue_123");
assert.equal(issueViewModel.editRoute, "/issues/issue_123/edit");
assert.equal(issueViewModel.actionVisibility.canEdit, true);
assert.equal(issueViewModel.actionVisibility.canClose, true);

const issueCardSummary = summarizeIssueCard({
  id: "issue_123",
  title: "Compile Check Issue",
  status: "open",
  priority: "medium",
  assigneeId: "user_123"
});

assert.match(issueCardSummary, /Assignee: user_123/);
assert.match(issueCardSummary, /Priority: medium/);

const issueCardViewModel = buildIssueCardViewModel({
  id: "issue_123",
  title: "Compile Check Issue",
  status: "open",
  priority: "medium",
  assigneeId: "user_123"
});

assert.equal(issueCardViewModel.route, "/issues/issue_123");
assert.equal(issueCardViewModel.assigneeBadge, "user_123");
assert.equal(issueCardViewModel.priorityBadge, "medium");

assert.equal(TODO_ROUTES.list, "/tasks");
assert.equal(TODO_ROUTES.detail("abc"), "/tasks/abc");
assert.equal(TODO_ROUTES.edit("abc"), "/tasks/abc/edit");
assert.equal(TODO_PROJECT_ROUTES.list, "/projects");
assert.equal(TODO_PROJECT_ROUTES.detail("abc"), "/projects/abc");
assert.equal(TODO_PROJECT_ROUTES.edit("abc"), "/projects/abc/edit");

const taskSummary = summarizeTaskDetail({
  title: "Compile Check Task",
  status: "active",
  priority: "high",
  project_id: "project_123",
  owner_id: "user_123",
  due_at: null
});

assert.match(taskSummary, /Priority: high/);

const taskViewModel = buildTaskDetailViewModel({
  id: "task_123",
  title: "Compile Check Task",
  status: "active",
  priority: "high",
  project_id: "project_123",
  owner_id: "user_123",
  due_at: null
});

assert.equal(taskViewModel.route, "/tasks/task_123");
assert.equal(taskViewModel.priorityBadge, "high");

const taskCardSummary = summarizeTaskCard({
  id: "task_123",
  title: "Compile Check Task",
  status: "active",
  priority: "high",
  ownerId: "user_123",
  dueAt: "2026-04-18T12:00:00.000Z"
});

assert.match(taskCardSummary, /Owner: user_123/);
assert.match(taskCardSummary, /Due: 2026-04-18T12:00:00.000Z/);

const taskCardViewModel = buildTaskCardViewModel({
  id: "task_123",
  title: "Compile Check Task",
  status: "active",
  priority: "high",
  ownerId: "user_123"
});

assert.equal(taskCardViewModel.route, "/tasks/task_123");
assert.equal(taskCardViewModel.ownerBadge, "user_123");
assert.equal(taskCardViewModel.priorityBadge, "high");

const projectSummary = summarizeProjectDetail({
  name: "Compile Check Project",
  status: "active",
  owner_id: "user_123",
  created_at: "2026-04-17T12:00:00.000Z",
  description: "Compile check project"
});

assert.match(projectSummary, /Owner: user_123/);

const projectViewModel = buildProjectDetailViewModel({
  id: "project_123",
  name: "Compile Check Project",
  status: "active",
  owner_id: "user_123",
  created_at: "2026-04-17T12:00:00.000Z",
  description: "Compile check project"
});

assert.equal(projectViewModel.route, "/projects/project_123");
assert.equal(projectViewModel.ownerBadge, "user_123");

const stableRelationAssessment = assessProjectOwnerRelationChange({
  fromRelation: {
    field: "owner_id",
    target: { id: "entity_user", field: "id" },
    onDelete: "set_null"
  },
  toRelation: {
    field: "owner_id",
    target: { id: "entity_user", field: "id" },
    onDelete: "set_null"
  }
});

assert.equal(stableRelationAssessment.manualDecisionRequired, false);
assert.match(
  summarizeProjectOwnerRelationDecision(stableRelationAssessment),
  /stable enough for guided app updates/i
);

console.log("compile-check ok");

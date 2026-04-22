import assert from "node:assert/strict";
import { summarizeArticleDetail } from "../src/content-approval.js";
import { buildRequestRevisionAction, buildResubmitArticleAction } from "../src/content-approval-actions.js";
import {
  assessArticleWorkflowSurfaceChange,
  summarizeArticleWorkflowDecision
} from "../src/content-approval-change-guards.js";
import { buildArticleDetailPage, buildArticleEditFormModel, buildRequestRevisionFormModel } from "../src/content-approval-ui.js";
import { buildIssueCardViewModel, buildIssueDetailViewModel, summarizeIssueDetail, summarizeIssueCard } from "../src/issues.js";
import { summarizeProjectDetail, summarizeTaskCard, summarizeTaskDetail } from "../src/todo.js";
import { assessProjectOwnerRelationChange, summarizeProjectOwnerRelationDecision } from "../src/todo-change-guards.js";

const summary = summarizeArticleDetail({
  title: "Smoke Test Article",
  status: "needs_revision",
  publication_id: "pub_approval",
  reviewer_id: "reviewer_1",
  submitted_at: "2026-04-15T12:00:00.000Z",
  revision_requested_at: "2026-04-16T08:30:00.000Z",
  approved_at: null,
  rejected_at: null,
  reviewer_notes: "Please revise the introduction before resubmitting.",
  category: "release-notes"
});

assert.match(summary, /Status: needs_revision/);
assert.match(summary, /Revision Requested: 2026-04-16T08:30:00.000Z/);
assert.match(summary, /Reviewer Notes: Please revise the introduction before resubmitting\./);

const articlePage = buildArticleDetailPage({
  id: "article_smoke",
  title: "Smoke Test Article",
  status: "needs_revision",
  publication_id: "pub_approval",
  reviewer_id: "reviewer_1",
  submitted_at: "2026-04-15T12:00:00.000Z",
  revision_requested_at: "2026-04-16T08:30:00.000Z",
  approved_at: null,
  rejected_at: null,
  reviewer_notes: "Please revise the introduction before resubmitting.",
  category: "release-notes"
});

assert.equal(articlePage.notices.length, 1);
assert.match(articlePage.notices[0], /resubmit/i);

const articleEditForm = buildArticleEditFormModel({
  id: "article_smoke",
  title: "Smoke Test Article",
  status: "needs_revision",
  description: "Needs one more source",
  reviewer_id: "reviewer_1",
  category: "release-notes"
});

assert.equal(articleEditForm.submitLabel, "Resubmit for Review");

const requestRevisionForm = buildRequestRevisionFormModel({
  id: "article_smoke",
  reviewer_notes: "Please revise the introduction before resubmitting."
});

assert.match(requestRevisionForm.helperText, /resubmit/i);

const requestRevisionAction = buildRequestRevisionAction(
  {
    id: "article_smoke",
    updated_at: "2026-04-16T08:31:00.000Z"
  },
  {
    reviewer_notes: "Please revise the introduction before resubmitting."
  }
);

assert.equal(requestRevisionAction.headers["If-Match"], "2026-04-16T08:31:00.000Z");

const resubmitAction = buildResubmitArticleAction(
  {
    id: "article_smoke",
    updated_at: "2026-04-16T08:32:00.000Z"
  },
  {
    title: "Smoke Test Article",
    description: "Updated after revision request",
    reviewer_id: "reviewer_1",
    category: "release-notes"
  }
);

assert.equal(resubmitAction.payload.status, "submitted");
assert.equal(resubmitAction.successRedirect, "/articles/article_smoke");

const workflowDecision = assessArticleWorkflowSurfaceChange({
  fromSurface: {
    canRequestRevision: false,
    canResubmit: false,
    requestRevisionRoute: null
  },
  toSurface: {
    canRequestRevision: true,
    canResubmit: false,
    requestRevisionRoute: "/articles/article_smoke/request-revision"
  }
});

assert.equal(workflowDecision.manualDecisionRequired, true);
assert.match(summarizeArticleWorkflowDecision(workflowDecision), /manual decision required/i);
assert.match(summarizeArticleWorkflowDecision(workflowDecision), /placement, tone, and user guidance/i);

const issueSummary = summarizeIssueDetail({
  title: "Smoke Test Issue",
  status: "in_progress",
  board_id: "board_smoke",
  assignee_id: "user_smoke",
  priority: "medium",
  closed_at: null
});

assert.match(issueSummary, /Assignee: user_smoke/);
assert.match(issueSummary, /Priority: medium/);

const issueCardSummary = summarizeIssueCard({
  id: "issue_smoke",
  title: "Smoke Test Issue",
  status: "open",
  priority: "medium",
  assigneeId: "user_smoke"
});

assert.match(issueCardSummary, /Assignee: user_smoke/);
assert.match(issueCardSummary, /Priority: medium/);

const nonOwnerIssueViewModel = buildIssueDetailViewModel(
  {
    id: "issue_smoke",
    title: "Smoke Test Issue",
    status: "in_progress",
    board_id: "board_smoke",
    assignee_id: "user_smoke",
    priority: "medium",
    closed_at: null
  },
  {
    userId: "viewer_smoke",
    isAdmin: false
  }
);

assert.equal(nonOwnerIssueViewModel.actionVisibility.canEdit, false);
assert.equal(nonOwnerIssueViewModel.actionVisibility.canClose, false);

const issueCardViewModel = buildIssueCardViewModel({
  id: "issue_smoke",
  title: "Smoke Test Issue",
  status: "open",
  priority: "medium",
  assigneeId: "user_smoke"
});

assert.equal(issueCardViewModel.assigneeBadge, "user_smoke");
assert.equal(issueCardViewModel.priorityBadge, "medium");

const taskSummary = summarizeTaskDetail({
  title: "Smoke Test Task",
  status: "draft",
  priority: "medium",
  project_id: "proj_smoke",
  owner_id: "user_smoke",
  due_at: "2026-04-20T10:00:00.000Z"
});

assert.match(taskSummary, /Priority: medium/);
assert.match(taskSummary, /Due: 2026-04-20T10:00:00.000Z/);

const taskCardSummary = summarizeTaskCard({
  id: "task_smoke",
  title: "Smoke Test Task",
  status: "draft",
  priority: "medium",
  ownerId: "user_smoke",
  dueAt: "2026-04-20T10:00:00.000Z"
});

assert.match(taskCardSummary, /Owner: user_smoke/);
assert.match(taskCardSummary, /Due: 2026-04-20T10:00:00.000Z/);

const projectSummary = summarizeProjectDetail({
  name: "Smoke Test Project",
  status: "active",
  owner_id: "user_smoke",
  created_at: "2026-04-20T09:00:00.000Z",
  description: "Smoke test project"
});

assert.match(projectSummary, /Owner: user_smoke/);

const unsupportedRelationAssessment = assessProjectOwnerRelationChange({
  fromRelation: {
    field: "owner_id",
    target: { id: "entity_project", field: "id" },
    onDelete: "set_null"
  },
  toRelation: {
    field: "owner_id",
    target: { id: "entity_user", field: "id" },
    onDelete: "set_null"
  }
});

assert.equal(unsupportedRelationAssessment.manualDecisionRequired, true);
assert.match(
  summarizeProjectOwnerRelationDecision(unsupportedRelationAssessment),
  /manual decision required/i
);
assert.match(
  summarizeProjectOwnerRelationDecision(unsupportedRelationAssessment),
  /entity_project\.id/
);

console.log("smoke ok");

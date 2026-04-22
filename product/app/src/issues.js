export const ISSUE_ROUTES = {
  list: "/issues",
  detail: (issueId) => `/issues/${issueId}`,
  edit: (issueId) => `/issues/${issueId}/edit`
};

function canManageIssue(issue, principal = {}) {
  if (principal.isAdmin) {
    return true;
  }
  if (!principal.userId) {
    return false;
  }
  return issue.assignee_id === principal.userId;
}

export function summarizeIssueDetail(issue) {
  const lines = [
    `Title: ${issue.title}`,
    `Status: ${issue.status}`,
    `Board: ${issue.board_id}`,
    `Assignee: ${issue.assignee_id || "Unassigned"}`,
    `Priority: ${issue.priority || "Unspecified"}`,
    `Closed: ${issue.closed_at || "Open"}`
  ];

  if (issue.description) {
    lines.push(`Description: ${issue.description}`);
  }

  return lines.join("\n");
}

export function summarizeIssueCard(issue) {
  const lines = [
    `Title: ${issue.title || "Untitled issue"}`,
    `Status: ${issue.status || "open"}`,
    `Priority: ${issue.priority || "Unspecified"}`,
    `Assignee: ${issue.assigneeId || issue.assignee_id || "Unassigned"}`
  ];

  return lines.join("\n");
}

export function buildIssueCardViewModel(issue) {
  return {
    heading: issue.title || "Untitled issue",
    statusBadge: issue.status || "open",
    priorityBadge: issue.priority || "Unspecified",
    assigneeBadge: issue.assigneeId || issue.assignee_id || "Unassigned",
    route: ISSUE_ROUTES.detail(issue.id),
    summary: summarizeIssueCard(issue)
  };
}

export function buildIssueDetailViewModel(issue, principal = {}) {
  const showOwnerActions = canManageIssue(issue, principal);
  return {
    heading: issue.title,
    statusBadge: issue.status,
    assigneeBadge: issue.assignee_id || "Unassigned",
    route: ISSUE_ROUTES.detail(issue.id),
    editRoute: ISSUE_ROUTES.edit(issue.id),
    summary: summarizeIssueDetail(issue),
    actionVisibility: {
      canEdit: showOwnerActions,
      canClose: showOwnerActions
    }
  };
}

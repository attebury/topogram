export const ISSUE_ROUTES = {
  list: "/issues",
  detail: (issueId) => `/issues/${issueId}`,
  edit: (issueId) => `/issues/${issueId}/edit`
};

export const ISSUE_SURFACES = {
  list: "issue_list",
  detail: "issue_detail"
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

function normalizedIssueOwnership(issue) {
  return issue.assigneeId || issue.assignee_id || null;
}

export function buildIssueCrossSurfaceAlignment(issue, principal = {}) {
  const assigneeId = normalizedIssueOwnership(issue);
  const normalizedIssue = {
    ...issue,
    assignee_id: assigneeId
  };
  const ownerOrAdminCanManage = canManageIssue(normalizedIssue, principal);
  const detailRoute = ISSUE_ROUTES.detail(issue.id);
  const editRoute = ISSUE_ROUTES.edit(issue.id);

  return {
    seamFamilyId: "issues_cross_surface_alignment",
    seamFamilyLabel: "issues cross-surface ownership alignment",
    ownershipRule: "owner_or_admin",
    ownershipField: "assignee_id",
    assigneeId,
    summaryState: {
      assigneeBadge: assigneeId || "Unassigned",
      priorityBadge: issue.priority || "Unspecified"
    },
    detailActionState: {
      canEdit: ownerOrAdminCanManage,
      canClose: ownerOrAdminCanManage,
      visibilityState: ownerOrAdminCanManage
        ? "owner_or_admin_actions_available"
        : "read_only_detail"
    },
    routeMetadata: {
      listRoute: ISSUE_ROUTES.list,
      detailRoute,
      editRoute,
      summarySurfaceId: ISSUE_SURFACES.list,
      detailSurfaceId: ISSUE_SURFACES.detail,
      primarySurfaceId: ISSUE_SURFACES.detail
    }
  };
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
  const assigneeId = normalizedIssueOwnership(issue);
  const lines = [
    `Title: ${issue.title || "Untitled issue"}`,
    `Status: ${issue.status || "open"}`,
    `Priority: ${issue.priority || "Unspecified"}`,
    `Assignee: ${assigneeId || "Unassigned"}`
  ];

  return lines.join("\n");
}

export function buildIssueCardViewModel(issue) {
  const crossSurfaceAlignment = buildIssueCrossSurfaceAlignment(issue);
  return {
    heading: issue.title || "Untitled issue",
    statusBadge: issue.status || "open",
    priorityBadge: crossSurfaceAlignment.summaryState.priorityBadge,
    assigneeBadge: crossSurfaceAlignment.summaryState.assigneeBadge,
    route: crossSurfaceAlignment.routeMetadata.detailRoute,
    routeMetadata: crossSurfaceAlignment.routeMetadata,
    crossSurfaceAlignment,
    summary: summarizeIssueCard(issue)
  };
}

export function buildIssueDetailViewModel(issue, principal = {}) {
  const crossSurfaceAlignment = buildIssueCrossSurfaceAlignment(issue, principal);
  return {
    heading: issue.title,
    statusBadge: issue.status,
    assigneeBadge: crossSurfaceAlignment.summaryState.assigneeBadge,
    route: crossSurfaceAlignment.routeMetadata.detailRoute,
    editRoute: crossSurfaceAlignment.routeMetadata.editRoute,
    routeMetadata: crossSurfaceAlignment.routeMetadata,
    crossSurfaceAlignment,
    summary: summarizeIssueDetail(issue),
    actionVisibility: crossSurfaceAlignment.detailActionState
  };
}

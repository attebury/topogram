export const ARTICLE_ROUTES = {
  list: "/articles",
  detail: (articleId) => `/articles/${articleId}`,
  edit: (articleId) => `/articles/${articleId}/edit`,
  requestRevision: (articleId) => `/articles/${articleId}/request-revision`
};

export function summarizeArticleDetail(article) {
  const lines = [
    `Title: ${article.title}`,
    `Status: ${article.status}`,
    `Publication: ${article.publication_id}`,
    `Reviewer: ${article.reviewer_id || "Unassigned"}`,
    `Submitted: ${article.submitted_at || "Not submitted"}`,
    `Revision Requested: ${article.revision_requested_at || "No revision requested"}`,
    `Approved: ${article.approved_at || "Not approved"}`,
    `Rejected: ${article.rejected_at || "Not rejected"}`,
    `Reviewer Notes: ${article.reviewer_notes || "No review notes"}`,
    `Category: ${article.category || "uncategorized"}`
  ];

  return lines.join("\n");
}

export function buildArticleDetailViewModel(article) {
  return {
    heading: article.title,
    statusBadge: article.status,
    route: ARTICLE_ROUTES.detail(article.id),
    editRoute: ARTICLE_ROUTES.edit(article.id),
    requestRevisionRoute: ARTICLE_ROUTES.requestRevision(article.id),
    summary: summarizeArticleDetail(article),
    reviewDecision: {
      revisionRequestedAt: article.revision_requested_at || null,
      approvedAt: article.approved_at || null,
      rejectedAt: article.rejected_at || null,
      reviewerNotes: article.reviewer_notes || null
    },
    workflowActions: {
      canRequestRevision: article.status === "submitted",
      canResubmit: article.status === "needs_revision"
    }
  };
}

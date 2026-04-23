import { ARTICLE_ROUTES, buildArticleDetailViewModel } from "./content-approval.js";

export function buildArticleDetailPage(article) {
  const detail = buildArticleDetailViewModel(article);

  const facts = [
    { label: "Publication", value: article.publication_id },
    { label: "Reviewer", value: article.reviewer_id || "Unassigned" },
    { label: "Category", value: article.category || "uncategorized" },
    { label: "Submitted", value: article.submitted_at || "Not submitted" },
    { label: "Revision Requested", value: article.revision_requested_at || "No revision requested" },
    { label: "Approved", value: article.approved_at || "Not approved" },
    { label: "Rejected", value: article.rejected_at || "Not rejected" },
    { label: "Reviewer Notes", value: article.reviewer_notes || "No review notes" }
  ];

  const actions = [
    { label: "Back to Articles", href: ARTICLE_ROUTES.list, tone: "secondary" },
    { label: "Edit Article", href: detail.editRoute, tone: "primary" }
  ];

  if (detail.workflowActions.canRequestRevision) {
    actions.push(
      { label: "Approve Article", action: "approve", tone: "primary" },
      { label: "Request Revision", href: detail.requestRevisionRoute, tone: "warning" },
      { label: "Reject Article", action: "reject", tone: "destructive" }
    );
  }

  return {
    title: detail.heading,
    statusBadge: detail.statusBadge,
    summary: detail.summary,
    facts,
    actions,
    notices: detail.workflowActions.canResubmit
      ? [
          "Revisions have been requested. Update the draft, address the reviewer notes, and resubmit the article for review."
        ]
      : []
  };
}

export function buildArticleEditFormModel(article, reviewerOptions = []) {
  const isNeedsRevision = article.status === "needs_revision";
  const statusOptions = [
    { value: "draft", label: "Draft" },
    { value: "submitted", label: "Submitted" }
  ];

  return {
    title: "Edit Article",
    action: ARTICLE_ROUTES.edit(article.id),
    submitLabel: isNeedsRevision ? "Resubmit for Review" : "Save Changes",
    helperText: isNeedsRevision
      ? "This article is in needs-revision. Update the draft and submit it again for review."
      : "Update the mutable fields for this article.",
    values: {
      title: article.title || "",
      description: article.description || "",
      reviewer_id: article.reviewer_id || "",
      category: article.category || "",
      status: isNeedsRevision ? "submitted" : article.status || "draft"
    },
    fields: [
      { name: "title", type: "text", required: true },
      { name: "description", type: "textarea", required: false },
      {
        name: "reviewer_id",
        type: "select",
        required: false,
        options: [{ value: "", label: "Unassigned" }, ...reviewerOptions]
      },
      { name: "category", type: "text", required: false },
      { name: "status", type: "select", required: true, options: statusOptions }
    ]
  };
}

export function buildRequestRevisionFormModel(article) {
  const detail = buildArticleDetailViewModel(article);
  return {
    title: "Request Revision",
    action: detail.requestRevisionRoute,
    submitLabel: "Request Revision",
    helperText: "Ask the author to revise the draft and provide the notes they should address before resubmitting.",
    values: {
      reviewer_notes: article.reviewer_notes || ""
    },
    fields: [
      { name: "reviewer_notes", type: "textarea", required: true }
    ]
  };
}

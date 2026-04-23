import { ARTICLE_ROUTES } from "./content-approval.js";

function normalizeText(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

export function buildRequestRevisionAction(article, formInput) {
  const updatedAt = normalizeText(article.updated_at);
  const reviewerNotes = normalizeText(formInput?.reviewer_notes);

  if (!article?.id) {
    throw new Error("article id is required to request revisions");
  }
  if (!updatedAt) {
    throw new Error("updated_at is required to request revisions");
  }
  if (!reviewerNotes) {
    throw new Error("reviewer_notes is required to request revisions");
  }

  return {
    capabilityId: "cap_request_article_revision",
    method: "POST",
    path: ARTICLE_ROUTES.requestRevision(article.id),
    headers: {
      "If-Match": updatedAt
    },
    payload: {
      article_id: article.id,
      reviewer_notes: reviewerNotes
    },
    successRedirect: ARTICLE_ROUTES.detail(article.id)
  };
}

export function buildResubmitArticleAction(article, formInput) {
  const updatedAt = normalizeText(article.updated_at);
  const title = normalizeText(formInput?.title);

  if (!article?.id) {
    throw new Error("article id is required to resubmit");
  }
  if (!updatedAt) {
    throw new Error("updated_at is required to resubmit");
  }
  if (!title) {
    throw new Error("title is required to resubmit");
  }

  return {
    capabilityId: "cap_update_article",
    method: "PATCH",
    path: ARTICLE_ROUTES.edit(article.id),
    headers: {
      "If-Match": updatedAt
    },
    payload: {
      article_id: article.id,
      title,
      description: normalizeText(formInput?.description),
      reviewer_id: normalizeText(formInput?.reviewer_id),
      category: normalizeText(formInput?.category),
      status: "submitted"
    },
    successRedirect: ARTICLE_ROUTES.detail(article.id)
  };
}

import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getArticle, approveArticle, requestCapability } from "../lib/api/client";
import { canShowAction, type VisibilityPrincipalOverride } from "../lib/auth/visibility";

const approveArticleVisibility = {
  predicate: "claim",
  value: "reviewer",
  claimValue: "true"
};
const requestRevisionVisibility = {
  predicate: "claim",
  value: "reviewer",
  claimValue: "true"
};
const rejectArticleVisibility = {
  predicate: "claim",
  value: "reviewer",
  claimValue: "true"
};

function visibilityOverrides(search: string): VisibilityPrincipalOverride | null {
  const params = new URLSearchParams(search);
  const userId = params.get("topogram_auth_user_id");
  const permissions = params.get("topogram_auth_permissions");
  const roles = params.get("topogram_auth_roles");
  const isAdmin = params.get("topogram_auth_admin");
  const rawClaims = params.get("topogram_auth_claims");
  let claims = null;

  if (rawClaims) {
    try {
      const parsed = JSON.parse(rawClaims);
      claims = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      claims = null;
    }
  }

  if (!userId && !permissions && !roles && !isAdmin && !claims) {
    return null;
  }

  return {
    userId,
    permissions,
    roles,
    claims,
    isAdmin
  };
}

export function ArticleDetailPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [requestingRevision, setRequestingRevision] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await getArticle(fetch, id);
        if (!cancelled) {
          setArticle(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load article");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function approveCurrentArticle() {
    if (!article?.updated_at) {
      setError("updated_at is required to approve this article.");
      return;
    }
    setApproving(true);
    setError("");
    try {
      await approveArticle(fetch, id, {
        reviewer_notes: "Approved from the generated article detail page.",
        headers: {
          "If-Match": String(article.updated_at),
          "Idempotency-Key": crypto.randomUUID()
        }
      });
      navigate(`/articles/${id}`, { replace: true });
      window.location.reload();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Unable to approve article");
    } finally {
      setApproving(false);
    }
  }

  async function requestRevision() {
    if (!article?.updated_at) {
      setError("updated_at is required to request revisions for this article.");
      return;
    }
    setRequestingRevision(true);
    setError("");
    try {
      await requestCapability(fetch, "cap_request_article_revision", {
        article_id: id,
        reviewer_notes: "Please address the outstanding feedback and resubmit this article."
      }, {
        headers: {
          "If-Match": String(article.updated_at),
          "Idempotency-Key": crypto.randomUUID()
        }
      });
      navigate(`/articles/${id}`, { replace: true });
      window.location.reload();
    } catch (requestRevisionError) {
      setError(requestRevisionError instanceof Error ? requestRevisionError.message : "Unable to request revisions");
    } finally {
      setRequestingRevision(false);
    }
  }

  async function rejectArticle() {
    if (!article?.updated_at) {
      setError("updated_at is required to reject this article.");
      return;
    }
    setRejecting(true);
    setError("");
    try {
      await requestCapability(fetch, "cap_reject_article", {
        article_id: id,
        reviewer_notes: "Rejected from the generated article detail page."
      }, {
        headers: {
          "If-Match": String(article.updated_at),
          "Idempotency-Key": crypto.randomUUID()
        }
      });
      navigate(`/articles/${id}`, { replace: true });
      window.location.reload();
    } catch (rejectionError) {
      setError(rejectionError instanceof Error ? rejectionError.message : "Unable to reject article");
    } finally {
      setRejecting(false);
    }
  }

  if (loading) return <div className="card"><p className="muted">Loading article...</p></div>;
  if (error && !article) return <div className="card"><p className="error-text">{error}</p></div>;
  if (!article) return <div className="card"><p className="muted">Article not found.</p></div>;

  const principalOverride = visibilityOverrides(location.search);
  const canApproveArticle = canShowAction(approveArticleVisibility, article, principalOverride);
  const canRequestRevision = canShowAction(requestRevisionVisibility, article, principalOverride);
  const canRejectArticle = canShowAction(rejectArticleVisibility, article, principalOverride);

  return (
    <div className="stack">
      <section className="card">
        <div className="button-row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1>Article Details</h1>
            <p>This detail screen was generated from `article_detail`.</p>
          </div>
          <span className="badge">{String(article.status)}</span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <dl className="definition-list" style={{ marginTop: "1rem" }}>
          <dt>Title</dt><dd>{String(article.title)}</dd>
          <dt>Description</dt><dd>{String(article.description || "No description")}</dd>
          <dt>Publication</dt><dd>{String(article.publication_id)}</dd>
          <dt>Reviewer</dt><dd>{String(article.reviewer_id || "Unassigned")}</dd>
          <dt>Category</dt><dd>{String(article.category || "uncategorized")}</dd>
          <dt>Submitted</dt><dd>{String(article.submitted_at || "Not submitted")}</dd>
          <dt>Revision Requested</dt><dd>{String(article.revision_requested_at || "No revision requested")}</dd>
          <dt>Approved</dt><dd>{String(article.approved_at || "Not approved")}</dd>
          <dt>Rejected</dt><dd>{String(article.rejected_at || "Not rejected")}</dd>
          <dt>Reviewer Notes</dt><dd>{String(article.reviewer_notes || "No review notes")}</dd>
          <dt>Updated</dt><dd>{String(article.updated_at)}</dd>
        </dl>

        {String(article.status) === "needs_revision" ? (
          <p className="muted" style={{ marginTop: "1rem" }}>
            Revisions have been requested. Open the edit page, address the reviewer notes, and set the article back to submitted when you are ready to resubmit.
          </p>
        ) : null}

        <div className="button-row" style={{ marginTop: "1rem" }}>
          <Link className="button-link secondary" to="/articles">Back to Articles</Link>
          <Link className="button-link" to={`/articles/${id}/edit`}>Edit Article</Link>
          {String(article.status) === "submitted" ? (
            <>
              {canApproveArticle ? (
                <button type="button" onClick={() => void approveCurrentArticle()} disabled={approving}>
                  {approving ? "Approving..." : "Approve Article"}
                </button>
              ) : null}
              {canRequestRevision ? (
                <button type="button" onClick={() => void requestRevision()} disabled={requestingRevision}>
                  {requestingRevision ? "Requesting..." : "Request Revision"}
                </button>
              ) : null}
              {canRejectArticle ? (
                <button type="button" onClick={() => void rejectArticle()} disabled={rejecting}>
                  {rejecting ? "Rejecting..." : "Reject Article"}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

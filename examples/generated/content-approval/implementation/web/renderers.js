function toJson(value) {
  return JSON.stringify(value, null, 2);
}

export function renderContentApprovalHomePage({
  screens,
  projectionName,
  homeDescription,
  webReference
}) {
  return `import { Link } from "react-router-dom";

const screens = ${toJson(screens)};
const demoPrimaryId = import.meta.env.PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID || "";

export function HomePage() {
  const demoPrimaryRoute = demoPrimaryId ? \`/articles/\${demoPrimaryId}\` : null;

  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <h1>${projectionName}</h1>
          <p>${homeDescription}</p>
        </div>
        <div className="button-row">
          <Link className="button-link" to="${webReference.nav.browseRoute}">${webReference.nav.browseLabel}</Link>
          <Link className="button-link secondary" to="${webReference.nav.createRoute}">${webReference.nav.createLabel}</Link>
          {demoPrimaryRoute ? <Link className="button-link secondary" to={demoPrimaryRoute}>${webReference.home.demoTaskLabel}</Link> : null}
        </div>
      </section>

      <section className="grid two">
        {screens.map((screen) => (
          <article className="card" key={screen.id}>
            <h2>{screen.title}</h2>
            {screen.navigable ? (
              <p><Link to={screen.route}>Open screen</Link></p>
            ) : screen.route ? (
              <>
                <p className="muted">${webReference.home.dynamicRouteText}</p>
                <small>{screen.route}</small>
              </>
            ) : (
              <p className="muted">${webReference.home.noRouteText}</p>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
`;
}

export function renderContentApprovalRoutes({
  taskList,
  taskDetail,
  taskCreate,
  taskEdit,
  taskListLookups,
  taskCreateLookups,
  taskEditLookups,
  projectEnvVar,
  ownerEnvVar,
  webReference
}) {
  const publicationListRoute = taskListLookups.publication_id?.route || "/lookups/publications";
  const reviewerListRoute = taskListLookups.reviewer_id?.route || "/lookups/users";
  const createPublicationRoute = taskCreateLookups.publication_id?.route || "/lookups/publications";
  const createReviewerRoute = taskCreateLookups.reviewer_id?.route || "/lookups/users";
  const editReviewerRoute = taskEditLookups.reviewer_id?.route || "/lookups/users";
  const listPresentation = taskList.web?.collection || taskList.collection?.views?.[0] || "list";
  const listMarkup = listPresentation === "table"
    ? `          <div className="table-wrap">
            <table className="resource-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Publication</th>
                  <th>Reviewer</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((article) => (
                  <tr key={String(article.id)}>
                    <td>
                      <div className="cell-stack">
                        <Link to={\`/articles/\${article.id}\`}><strong>{String(article.title)}</strong></Link>
                        <span className="cell-secondary">{String(article.description || "No description")}</span>
                      </div>
                    </td>
                    <td><span className="badge">{String(article.status)}</span></td>
                    <td>{String(article.publication_id || "Unknown")}</td>
                    <td>{String(article.reviewer_id || "Unassigned")}</td>
                    <td>{String(article.category || "uncategorized")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>`
    : `          <ul className="task-list">
            {result.items.map((article) => (
              <li key={String(article.id)}>
                <div className="task-meta">
                  <Link to={\`/articles/\${article.id}\`}><strong>{String(article.title)}</strong></Link>
                  <span className="muted">{String(article.description || "No description")}</span>
                </div>
                <div className="button-row">
                  <span className="badge">{String(article.status)}</span>
                  <span className="muted">{String(article.category || "uncategorized")}</span>
                </div>
              </li>
            ))}
          </ul>`;

  return {
    "ArticleListPage.tsx": `import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { listLookupOptions } from "../lib/api/lookups";
import { ${webReference.client.functionNames.list} } from "../lib/api/client";

type LookupOption = { value: string; label: string };

export function ArticleListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState<{ items: Array<Record<string, unknown>>; next_cursor?: string }>({ items: [] });
  const [publicationOptions, setPublicationOptions] = useState<LookupOption[]>([]);
  const [reviewerOptions, setReviewerOptions] = useState<LookupOption[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const publicationId = searchParams.get("publication_id") || "";
  const reviewerId = searchParams.get("reviewer_id") || "";
  const status = searchParams.get("status") || "";
  const limit = searchParams.get("limit") || "";
  const after = searchParams.get("after") || "";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [articles, publications, reviewers] = await Promise.all([
          ${webReference.client.functionNames.list}(fetch, {
            publication_id: publicationId || undefined,
            reviewer_id: reviewerId || undefined,
            status: status || undefined,
            after: after || undefined,
            limit: limit ? Number(limit) : undefined
          }),
          listLookupOptions(fetch, "${publicationListRoute}"),
          listLookupOptions(fetch, "${reviewerListRoute}")
        ]);
        if (!cancelled) {
          setResult(articles);
          setPublicationOptions(publications);
          setReviewerOptions(reviewers);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load articles");
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
  }, [publicationId, reviewerId, status, limit, after]);

  const nextHref = result.next_cursor
    ? \`/articles?\${new URLSearchParams({
        ...(publicationId ? { publication_id: publicationId } : {}),
        ...(reviewerId ? { reviewer_id: reviewerId } : {}),
        ...(status ? { status } : {}),
        ...(limit ? { limit } : {}),
        after: String(result.next_cursor)
      }).toString()}\`
    : null;

  return (
    <div className="stack">
      <section className="card">
        <div className="button-row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1>${taskList.title || taskList.id}</h1>
            <p>This ${taskList.kind.replace(/_/g, " ")} screen was generated from \`${taskList.id}\`.</p>
          </div>
          <Link className="button-link" to="/articles/new">Create Article</Link>
        </div>

        <form
          className="filters"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const next = new URLSearchParams();
            for (const key of ["publication_id", "reviewer_id", "status", "limit"]) {
              const value = String(form.get(key) || "");
              if (value) next.set(key, value);
            }
            setSearchParams(next);
          }}
        >
          <label>
            Publication
            <select name="publication_id" defaultValue={publicationId}>
              <option value="">${taskListLookups.publication_id?.emptyLabel || "All publications"}</option>
              {publicationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Reviewer
            <select name="reviewer_id" defaultValue={reviewerId}>
              <option value="">${taskListLookups.reviewer_id?.emptyLabel || "All reviewers"}</option>
              {reviewerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={status}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="needs_revision">Needs Revision</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label>
            Limit
            <input name="limit" type="number" min="1" defaultValue={limit} />
          </label>
          <div className="button-row">
            <button type="submit">Apply Filters</button>
            <Link className="button-link secondary" to="/articles">Reset</Link>
          </div>
        </form>

        {error ? <p className="error-text">{error}</p> : null}
        {loading ? <p className="muted">Loading articles...</p> : null}
        {!loading && !error && result.items.length === 0 ? (
          <div className="empty-state">
            <p><strong>${taskList.emptyState?.title || "No items"}</strong></p>
            <p className="muted">${taskList.emptyState?.body || ""}</p>
          </div>
        ) : null}

        {!loading && !error && result.items.length > 0 ? (
${listMarkup}
        ) : null}

        {nextHref ? (
          <div className="button-row" style={{ marginTop: "1rem" }}>
            <Link className="button-link secondary" to={nextHref}>Load More</Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
`,
    "ArticleDetailPage.tsx": `import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ${webReference.client.functionNames.get}, ${webReference.client.functionNames.terminal}, requestCapability } from "../lib/api/client";
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
        const result = await ${webReference.client.functionNames.get}(fetch, id);
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

  async function approveArticle() {
    if (!article?.updated_at) {
      setError("updated_at is required to approve this article.");
      return;
    }
    setApproving(true);
    setError("");
    try {
      await ${webReference.client.functionNames.terminal}(fetch, id, { reviewer_notes: "Approved from the generated article detail page." }, {
        headers: {
          "If-Match": String(article.updated_at),
          "Idempotency-Key": crypto.randomUUID()
        }
      });
      navigate(\`/articles/\${id}\`, { replace: true });
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
      await requestCapability(fetch, "${webReference.client.capabilityIds.requestRevision}", {
        article_id: id,
        reviewer_notes: "Please address the outstanding feedback and resubmit this article."
      }, {
        headers: {
          "If-Match": String(article.updated_at),
          "Idempotency-Key": crypto.randomUUID()
        }
      });
      navigate(\`/articles/\${id}\`, { replace: true });
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
      await requestCapability(fetch, "${webReference.client.capabilityIds.reject}", {
        article_id: id,
        reviewer_notes: "Rejected from the generated article detail page."
      }, {
        headers: {
          "If-Match": String(article.updated_at),
          "Idempotency-Key": crypto.randomUUID()
        }
      });
      navigate(\`/articles/\${id}\`, { replace: true });
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
            <h1>${taskDetail.title || taskDetail.id}</h1>
            <p>This ${taskDetail.kind.replace(/_/g, " ")} screen was generated from \`${taskDetail.id}\`.</p>
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
          <Link className="button-link" to={\`/articles/\${id}/edit\`}>Edit Article</Link>
          {String(article.status) === "submitted" ? (
            <>
              {canApproveArticle ? (
                <button type="button" onClick={() => void approveArticle()} disabled={approving}>
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
`,
    "ArticleCreatePage.tsx": `import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { listLookupOptions } from "../lib/api/lookups";
import { ${webReference.client.functionNames.create} } from "../lib/api/client";

type LookupOption = { value: string; label: string };

export function ArticleCreatePage() {
  const navigate = useNavigate();
  const [publicationOptions, setPublicationOptions] = useState<LookupOption[]>([]);
  const [reviewerOptions, setReviewerOptions] = useState<LookupOption[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [publications, reviewers] = await Promise.all([
          listLookupOptions(fetch, "${createPublicationRoute}"),
          listLookupOptions(fetch, "${createReviewerRoute}")
        ]);
        if (!cancelled) {
          setPublicationOptions(publications);
          setReviewerOptions(reviewers);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load form options");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="stack">
      <section className="card">
        <h1>${taskCreate.title || taskCreate.id}</h1>
        <p className="muted">${webReference.createPrimary.helperText}</p>
        {error ? <p className="error-text">{error}</p> : null}

        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitting(true);
            setError("");
            const form = new FormData(event.currentTarget);
            try {
              const created = await ${webReference.client.functionNames.create}(fetch, {
                title: String(form.get("title") || ""),
                description: String(form.get("description") || "") || undefined,
                publication_id: String(form.get("publication_id") || ""),
                reviewer_id: String(form.get("reviewer_id") || "") || undefined,
                category: String(form.get("category") || "") || undefined
              }, {
                headers: {
                  "Idempotency-Key": crypto.randomUUID()
                }
              });
              navigate(\`/articles/\${created.id}\`);
            } catch (submitError) {
              setError(submitError instanceof Error ? submitError.message : "Unable to create article");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <label>
            Title
            <input name="title" required />
          </label>
          <label>
            Description
            <textarea name="description" />
          </label>
          <label>
            Publication
            <select name="publication_id" required defaultValue={import.meta.env.${projectEnvVar} || ""}>
              <option value="">${webReference.createPrimary.projectPlaceholder}</option>
              {publicationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Reviewer
            <select name="reviewer_id" defaultValue={import.meta.env.${ownerEnvVar} || ""}>
              <option value="">Unassigned</option>
              {reviewerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Category
            <input name="category" placeholder="platform, editorial, release-notes..." />
          </label>
          <div className="button-row">
            <button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "${webReference.createPrimary.submitLabel}"}
            </button>
            <Link className="button-link secondary" to="/articles">${webReference.createPrimary.cancelLabel}</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
`,
    "ArticleEditPage.tsx": `import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { listLookupOptions } from "../lib/api/lookups";
import { ${webReference.client.functionNames.get}, ${webReference.client.functionNames.update} } from "../lib/api/client";

type LookupOption = { value: string; label: string };

export function ArticleEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Record<string, unknown> | null>(null);
  const [reviewerOptions, setReviewerOptions] = useState<LookupOption[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [currentArticle, reviewers] = await Promise.all([
          ${webReference.client.functionNames.get}(fetch, id),
          listLookupOptions(fetch, "${editReviewerRoute}")
        ]);
        if (!cancelled) {
          setArticle(currentArticle);
          setReviewerOptions(reviewers);
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

  if (loading) return <div className="card"><p className="muted">Loading article...</p></div>;
  if (!article) return <div className="card"><p className="error-text">{error || "Article not found."}</p></div>;

  const values = article as Record<string, string | undefined>;

  return (
    <div className="stack">
      <section className="card">
        <h1>${taskEdit.title || taskEdit.id}</h1>
        {values.status === "needs_revision" ? (
          <p className="muted">This article is in needs-revision. Update the draft and set the status back to submitted to resubmit it for review.</p>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}

        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitting(true);
            setError("");
            const form = new FormData(event.currentTarget);
            try {
              await ${webReference.client.functionNames.update}(fetch, id, {
                title: String(form.get("title") || ""),
                description: String(form.get("description") || "") || undefined,
                reviewer_id: String(form.get("reviewer_id") || "") || undefined,
                category: String(form.get("category") || "") || undefined,
                status: String(form.get("status") || "") || undefined
              }, {
                headers: {
                  "If-Match": String(values.updated_at || "")
                }
              });
              navigate(\`/articles/\${id}\`);
            } catch (submitError) {
              setError(submitError instanceof Error ? submitError.message : "Unable to update article");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <label>
            Title
            <input name="title" defaultValue={values.title || ""} required />
          </label>
          <label>
            Description
            <textarea name="description" defaultValue={values.description || ""} />
          </label>
          <label>
            Reviewer
            <select name="reviewer_id" defaultValue={values.reviewer_id || ""}>
              <option value="">Unassigned</option>
              {reviewerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Category
            <input name="category" defaultValue={values.category || ""} />
          </label>
          <label>
            Status
            <select name="status" defaultValue={values.status === "needs_revision" ? "submitted" : (values.status || "draft")}>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
            </select>
          </label>
          <div className="button-row">
            <button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</button>
            <Link className="button-link secondary" to={\`/articles/\${id}\`}>Cancel</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
`
  };
}

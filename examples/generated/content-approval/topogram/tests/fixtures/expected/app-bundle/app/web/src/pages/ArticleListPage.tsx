import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { listLookupOptions } from "../lib/api/lookups";
import { listArticles } from "../lib/api/client";

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
          listArticles(fetch, {
            publication_id: publicationId || undefined,
            reviewer_id: reviewerId || undefined,
            status: status || undefined,
            after: after || undefined,
            limit: limit ? Number(limit) : undefined
          }),
          listLookupOptions(fetch, "/lookups/publications"),
          listLookupOptions(fetch, "/lookups/users")
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
    ? `/articles?${new URLSearchParams({
        ...(publicationId ? { publication_id: publicationId } : {}),
        ...(reviewerId ? { reviewer_id: reviewerId } : {}),
        ...(status ? { status } : {}),
        ...(limit ? { limit } : {}),
        after: String(result.next_cursor)
      }).toString()}`
    : null;

  return (
    <div className="stack">
      <section className="card">
        <div className="button-row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1>Articles</h1>
            <p>This list screen was generated from `article_list`.</p>
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
              <option value="">All publications</option>
              {publicationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Reviewer
            <select name="reviewer_id" defaultValue={reviewerId}>
              <option value="">All reviewers</option>
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
            <p><strong>No articles yet</strong></p>
            <p className="muted">Create an article to start the review workflow</p>
          </div>
        ) : null}

        {!loading && !error && result.items.length > 0 ? (
          <div className="table-wrap">
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
                        <Link to={`/articles/${article.id}`}><strong>{String(article.title)}</strong></Link>
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
          </div>
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

import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { listLookupOptions } from "../lib/api/lookups";
import { getArticle, updateArticle } from "../lib/api/client";

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
          getArticle(fetch, id),
          listLookupOptions(fetch, "/lookups/users")
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
        <h1>Edit Article</h1>
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
              await updateArticle(fetch, id, {
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
              navigate(`/articles/${id}`);
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
            <Link className="button-link secondary" to={`/articles/${id}`}>Cancel</Link>
          </div>
        </form>
      </section>
    </div>
  );
}

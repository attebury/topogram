import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { listLookupOptions } from "../lib/api/lookups";
import { createArticle } from "../lib/api/client";

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
          listLookupOptions(fetch, "/lookups/publications"),
          listLookupOptions(fetch, "/lookups/users")
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
        <h1>Create Article</h1>
        <p className="muted">A publication is required to create an article. Reviewer is optional until the article is submitted.</p>
        {error ? <p className="error-text">{error}</p> : null}

        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitting(true);
            setError("");
            const form = new FormData(event.currentTarget);
            try {
              const created = await createArticle(fetch, {
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
              navigate(`/articles/${created.id}`);
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
            <select name="publication_id" required defaultValue={import.meta.env.PUBLIC_TOPOGRAM_DEMO_CONTAINER_ID || ""}>
              <option value="">Select a publication</option>
              {publicationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Reviewer
            <select name="reviewer_id" defaultValue={import.meta.env.PUBLIC_TOPOGRAM_DEMO_USER_ID || ""}>
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
              {submitting ? "Creating..." : "Create Article"}
            </button>
            <Link className="button-link secondary" to="/articles">Cancel</Link>
          </div>
        </form>
      </section>
    </div>
  );
}

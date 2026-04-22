import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getIssue, closeIssue } from "../lib/api/client";

export function IssueDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const nextIssue = await getIssue(fetch, id);
        if (!cancelled) setIssue(nextIssue);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load issue");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleCloseIssue() {
    if (!issue?.updated_at) return;
    try {
      await closeIssue(fetch, id, { closed_at: new Date().toISOString() }, {
        headers: {
          "If-Match": String(issue.updated_at),
          "Idempotency-Key": crypto.randomUUID()
        }
      });
      navigate(`/issues/${id}`, { replace: true });
      const nextIssue = await getIssue(fetch, id);
      setIssue(nextIssue);
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "Unable to close issue");
    }
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!issue) return <p className="muted">Loading issue...</p>;

  return (
    <div className="stack">
      <section className="card">
        <div className="button-row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1>{String(issue.title || "")}</h1>
            <p>This detail screen was generated from `issue_detail`.</p>
          </div>
          <span className="badge">{String(issue.status || "")}</span>
        </div>

        {issue.description ? <p>{String(issue.description)}</p> : <p className="muted">No description was provided for this issue.</p>}
        <dl className="definition-list">
          <dt>Issue ID</dt><dd>{String(issue.id || "")}</dd>
          <dt>Board</dt><dd>{String(issue.board_id || "")}</dd>
          <dt>Assignee</dt><dd>{issue.assignee_id ? String(issue.assignee_id) : "Unassigned"}</dd>
          <dt>Priority</dt><dd>{issue.priority ? String(issue.priority) : "Unspecified"}</dd>
          <dt>Created</dt><dd>{String(issue.created_at || "")}</dd>
          <dt>Updated</dt><dd>{String(issue.updated_at || "")}</dd>
        </dl>

        <div className="button-row">
          <Link className="button-link secondary" to="/issues">Back to Issues</Link>
          <Link className="button-link" to={`/issues/${id}/edit`}>Edit Issue</Link>
          <button type="button" onClick={() => void handleCloseIssue()}>Close Issue</button>
        </div>
      </section>
    </div>
  );
}

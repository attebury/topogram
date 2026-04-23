import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { listLookupOptions } from "../lib/api/lookups";
import { getIssue, updateIssue } from "../lib/api/client";

type LookupOption = { value: string; label: string };

export function IssueEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<Record<string, unknown> | null>(null);
  const [boardOptions, setBoardOptions] = useState<LookupOption[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<LookupOption[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [nextIssue, boards, assignees] = await Promise.all([
          getIssue(fetch, id),
          listLookupOptions(fetch, "/lookups/boards"),
          listLookupOptions(fetch, "/lookups/users")
        ]);
        if (!cancelled) {
          setIssue(nextIssue);
          setBoardOptions(boards);
          setAssigneeOptions(assignees);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load issue");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <p className="error-text">{error}</p>;
  if (!issue) return <p className="muted">Loading issue...</p>;

  return (
    <div className="stack">
      <section className="card">
        <h1>Edit Issue</h1>
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const form = new FormData(event.currentTarget);
            const payload = {
              title: String(form.get("title") || ""),
              description: String(form.get("description") || "") || undefined,
              assignee_id: String(form.get("assignee_id") || "") || undefined,
              priority: String(form.get("priority") || "") || undefined,
              status: String(form.get("status") || "") || undefined
            };
            try {
              await updateIssue(fetch, id, payload, {
                headers: {
                  "If-Match": String(issue.updated_at || ""),
                  "Idempotency-Key": crypto.randomUUID()
                }
              });
              navigate(`/issues/${id}`);
            } catch (updateError) {
              setError(updateError instanceof Error ? updateError.message : "Unable to update issue");
            }
          }}
        >
          <label>Title<input name="title" required defaultValue={String(issue.title || "")} /></label>
          <label>Description<textarea name="description" defaultValue={String(issue.description || "")} /></label>
          <label>
            Board
            <select name="board_id" disabled defaultValue={String(issue.board_id || "")}>
              {boardOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Assignee
            <select name="assignee_id" defaultValue={String(issue.assignee_id || "")}>
              <option value="">Optional assignee</option>
              {assigneeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Priority
            <select name="priority" defaultValue={String(issue.priority || "medium")}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={String(issue.status || "open")}>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <div className="button-row">
            <button type="submit">Save Issue</button>
            <Link className="button-link secondary" to={`/issues/${id}`}>Cancel</Link>
          </div>
        </form>
      </section>
    </div>
  );
}

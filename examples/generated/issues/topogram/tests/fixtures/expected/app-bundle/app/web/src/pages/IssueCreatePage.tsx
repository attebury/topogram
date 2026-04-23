import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { listLookupOptions } from "../lib/api/lookups";
import { createIssue } from "../lib/api/client";

type LookupOption = { value: string; label: string };

export function IssueCreatePage() {
  const navigate = useNavigate();
  const [boardOptions, setBoardOptions] = useState<LookupOption[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<LookupOption[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [boards, assignees] = await Promise.all([
          listLookupOptions(fetch, "/lookups/boards"),
          listLookupOptions(fetch, "/lookups/users")
        ]);
        if (!cancelled) {
          setBoardOptions(boards);
          setAssigneeOptions(assignees);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load form lookups");
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
        <h1>Create Issue</h1>
        <p>A board is required to create an issue. Assignee is optional.</p>
        {error ? <p className="error-text">{error}</p> : null}
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
              board_id: String(form.get("board_id") || ""),
              priority: String(form.get("priority") || "") || undefined
            };
            try {
              const created = await createIssue(fetch, payload, {
                headers: { "Idempotency-Key": crypto.randomUUID() }
              });
              navigate(`/issues/${created.id}`);
            } catch (createError) {
              setError(createError instanceof Error ? createError.message : "Unable to create issue");
            }
          }}
        >
          <label>Title<input name="title" required /></label>
          <label>Description<textarea name="description" /></label>
          <label>
            Board
            <select name="board_id" required defaultValue={import.meta.env.PUBLIC_TOPOGRAM_DEMO_CONTAINER_ID || ""}>
              <option value="">Select a board</option>
              {boardOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Assignee
            <select name="assignee_id" defaultValue={import.meta.env.PUBLIC_TOPOGRAM_DEMO_USER_ID || ""}>
              <option value="">Optional assignee</option>
              {assigneeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Priority
            <select name="priority" defaultValue="medium">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <div className="button-row">
            <button type="submit">Create Issue</button>
            <Link className="button-link secondary" to="/issues">Cancel</Link>
          </div>
        </form>
      </section>
    </div>
  );
}

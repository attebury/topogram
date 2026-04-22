import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { listLookupOptions } from "../lib/api/lookups";
import { listIssues } from "../lib/api/client";

type LookupOption = { value: string; label: string };

export function IssueListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState<{ items: Array<Record<string, unknown>>; next_cursor?: string }>({ items: [] });
  const [boardOptions, setBoardOptions] = useState<LookupOption[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<LookupOption[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const boardId = searchParams.get("board_id") || "";
  const assigneeId = searchParams.get("assignee_id") || "";
  const status = searchParams.get("status") || "";
  const limit = searchParams.get("limit") || "";
  const after = searchParams.get("after") || "";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [issues, boards, assignees] = await Promise.all([
          listIssues(fetch, {
            board_id: boardId || undefined,
            assignee_id: assigneeId || undefined,
            status: status || undefined,
            after: after || undefined,
            limit: limit ? Number(limit) : undefined
          }),
          listLookupOptions(fetch, "/lookups/boards"),
          listLookupOptions(fetch, "/lookups/users")
        ]);
        if (!cancelled) {
          setResult(issues);
          setBoardOptions(boards);
          setAssigneeOptions(assignees);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load issues");
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
  }, [boardId, assigneeId, status, limit, after]);

  const nextHref = result.next_cursor
    ? `/issues?${new URLSearchParams({
        ...(boardId ? { board_id: boardId } : {}),
        ...(assigneeId ? { assignee_id: assigneeId } : {}),
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
            <h1>Issues</h1>
            <p>This list screen was generated from `issue_list`.</p>
          </div>
          <Link className="button-link" to="/issues/new">Create Issue</Link>
        </div>

        <form
          className="filters"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const next = new URLSearchParams();
            for (const key of ["board_id", "assignee_id", "status", "limit"]) {
              const value = String(form.get(key) || "");
              if (value) next.set(key, value);
            }
            setSearchParams(next);
          }}
        >
          <label>
            Board
            <select name="board_id" defaultValue={boardId}>
              <option value="">All boards</option>
              {boardOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Assignee
            <select name="assignee_id" defaultValue={assigneeId}>
              <option value="">All assignees</option>
              {assigneeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Status
            <input name="status" defaultValue={status} />
          </label>
          <label>
            Limit
            <input name="limit" type="number" min="1" defaultValue={limit} />
          </label>
          <div className="button-row">
            <button type="submit">Apply Filters</button>
            <Link className="button-link secondary" to="/issues">Reset</Link>
          </div>
        </form>

        {error ? <p className="error-text">{error}</p> : null}
        {loading ? <p className="muted">Loading issues...</p> : null}
        {!loading && !error && result.items.length === 0 ? (
          <div className="empty-state">
            <p><strong>No issues yet</strong></p>
            <p className="muted">Create an issue to get started</p>
          </div>
        ) : null}
        {!loading && !error && result.items.length > 0 ? (
          <>
            <p className="muted">Showing {result.items.length} issue{result.items.length === 1 ? "" : "s"}.</p>
            <div className="table-wrap data-grid-shell">
              <table className="resource-table data-grid">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Board</th>
                    <th>Assignee</th>
                    <th>Priority</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((issue) => (
                    <tr key={String(issue.id)}>
                      <td>
                        <div className="cell-stack">
                          <Link to={`/issues/${issue.id}`}><strong>{String(issue.title)}</strong></Link>
                          {issue.description ? <span className="cell-secondary">{String(issue.description)}</span> : null}
                        </div>
                      </td>
                      <td><span className="badge">{String(issue.status)}</span></td>
                      <td>{String(issue.board_id || "Unassigned")}</td>
                      <td>{String(issue.assignee_id || "Unassigned")}</td>
                      <td>{String(issue.priority || "Unspecified")}</td>
                      <td>{String(issue.updated_at || issue.created_at || "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nextHref ? <p><Link className="button-link secondary" to={nextHref}>Next Page</Link></p> : null}
          </>
        ) : null}
      </section>
    </div>
  );
}

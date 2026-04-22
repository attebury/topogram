import { renderSvelteKitRedirectingAction } from "../../../../engine/src/generator/apps/web/sveltekit-actions.js";

function toJson(value) {
  return JSON.stringify(value, null, 2);
}

function renderIssuesHomePageReact({
  screens,
  projectionName,
  homeDescription,
  webReference
}) {
  return `import { Link } from "react-router-dom";

const screens = ${toJson(screens)};
const demoPrimaryId = import.meta.env.PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID || "";

export function HomePage() {
  const demoPrimaryRoute = demoPrimaryId ? \`/issues/\${demoPrimaryId}\` : null;

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

function renderIssuesHomePageSvelte({
  useTypescript,
  demoPrimaryEnvVar,
  screens,
  projectionName,
  homeDescription,
  webReference
}) {
  return `<script${useTypescript ? ' lang="ts"' : ""}>
  import { env as publicEnv } from "$env/dynamic/public";

  const screens = ${toJson(screens)};
  const demoPrimaryRoute = publicEnv.${demoPrimaryEnvVar} ? \`/issues/\${publicEnv.${demoPrimaryEnvVar}}\` : null;
</script>

<main>
  <div class="stack">
    <section class="card hero">
      <div>
        <h1>${projectionName}</h1>
        <p>${homeDescription}</p>
      </div>
      <div class="button-row">
        <a class="button-link" href="${webReference.nav.browseRoute}">${webReference.nav.browseLabel}</a>
        <a class="button-link secondary" href="${webReference.nav.createRoute}">${webReference.nav.createLabel}</a>
        {#if demoPrimaryRoute}
          <a class="button-link secondary" href={demoPrimaryRoute}>${webReference.home.demoTaskLabel}</a>
        {/if}
      </div>
    </section>

    <section class="grid two">
      {#each screens as screen}
        <article class="card">
          <h2>{screen.title}</h2>
          {#if screen.navigable}
            <p><a href={screen.route}>Open screen</a></p>
          {:else if screen.route}
            <p class="muted">${webReference.home.dynamicRouteText}</p>
            <small class="route-hint">{screen.route}</small>
          {:else}
            <p class="muted">${webReference.home.noRouteText}</p>
          {/if}
        </article>
      {/each}
    </section>
  </div>
</main>
`;
}

export function renderIssuesHomePage(args) {
  return args.useTypescript !== undefined
    ? renderIssuesHomePageSvelte(args)
    : renderIssuesHomePageReact(args);
}

function renderIssuesRoutesReact({
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
  const listLoadRoute = taskListLookups.board_id?.route || "/lookups/boards";
  const assigneeListRoute = taskListLookups.assignee_id?.route || "/lookups/users";
  const createBoardRoute = taskCreateLookups.board_id?.route || "/lookups/boards";
  const createAssigneeRoute = taskCreateLookups.assignee_id?.route || "/lookups/users";
  const editBoardRoute = taskEditLookups.board_id?.route || "/lookups/boards";
  const editAssigneeRoute = taskEditLookups.assignee_id?.route || "/lookups/users";
  const listPresentation = taskList.web?.collection || taskList.collection?.views?.[0] || "list";
  const editIssueVisibility = taskDetail.visibility?.find((entry) => entry.capability?.id === "cap_update_issue") || null;
  const closeIssueVisibility = taskDetail.visibility?.find((entry) => entry.capability?.id === "cap_close_issue") || null;
  const reactListMarkup = listPresentation === "data_grid"
    ? `            <div className="table-wrap data-grid-shell">
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
                          <Link to={\`/issues/\${issue.id}\`}><strong>{String(issue.title)}</strong></Link>
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
            </div>`
    : `            <ul className="task-list">
              {result.items.map((issue) => (
                <li key={String(issue.id)}>
                  <div className="task-meta">
                    <Link to={\`/issues/\${issue.id}\`}><strong>{String(issue.title)}</strong></Link>
                    {issue.description ? <span className="muted">{String(issue.description)}</span> : null}
                  </div>
                  <span className="badge">{String(issue.status)}</span>
                </li>
              ))}
            </ul>`;
  return {
    "IssueListPage.tsx": `import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { listLookupOptions } from "../lib/api/lookups";
import { ${webReference.client.functionNames.list} } from "../lib/api/client";

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
          ${webReference.client.functionNames.list}(fetch, {
            board_id: boardId || undefined,
            assignee_id: assigneeId || undefined,
            status: status || undefined,
            after: after || undefined,
            limit: limit ? Number(limit) : undefined
          }),
          listLookupOptions(fetch, "${listLoadRoute}"),
          listLookupOptions(fetch, "${assigneeListRoute}")
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
    ? \`/issues?\${new URLSearchParams({
        ...(boardId ? { board_id: boardId } : {}),
        ...(assigneeId ? { assignee_id: assigneeId } : {}),
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
              <option value="">${taskListLookups.board_id?.emptyLabel || "All boards"}</option>
              {boardOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Assignee
            <select name="assignee_id" defaultValue={assigneeId}>
              <option value="">${taskListLookups.assignee_id?.emptyLabel || "All assignees"}</option>
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
            <p><strong>${taskList.emptyState?.title || "No items"}</strong></p>
            <p className="muted">${taskList.emptyState?.body || ""}</p>
          </div>
        ) : null}
        {!loading && !error && result.items.length > 0 ? (
          <>
            <p className="muted">Showing {result.items.length} issue{result.items.length === 1 ? "" : "s"}.</p>
${reactListMarkup}
            {nextHref ? <p><Link className="button-link secondary" to={nextHref}>Next Page</Link></p> : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
`,
    "IssueDetailPage.tsx": `import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ${webReference.client.functionNames.get}, ${webReference.client.functionNames.terminal} } from "../lib/api/client";
import { canShowAction, type VisibilityPrincipalOverride } from "../lib/auth/visibility";

const editIssueVisibility = ${toJson(editIssueVisibility)};
const closeIssueVisibility = ${toJson(closeIssueVisibility)};

function visibilityOverrides(search: string): VisibilityPrincipalOverride | null {
  const params = new URLSearchParams(search);
  const userId = params.get("topogram_auth_user_id");
  const permissions = params.get("topogram_auth_permissions");
  const roles = params.get("topogram_auth_roles");
  const isAdmin = params.get("topogram_auth_admin");

  if (!userId && !permissions && !roles && !isAdmin) {
    return null;
  }

  return {
    userId,
    permissions,
    roles,
    isAdmin
  };
}

export function IssueDetailPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const nextIssue = await ${webReference.client.functionNames.get}(fetch, id);
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
      await ${webReference.client.functionNames.terminal}(fetch, id, { closed_at: new Date().toISOString() }, {
        headers: {
          "If-Match": String(issue.updated_at),
          "Idempotency-Key": crypto.randomUUID()
        }
      });
      navigate(\`/issues/\${id}\`, { replace: true });
      const nextIssue = await ${webReference.client.functionNames.get}(fetch, id);
      setIssue(nextIssue);
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "Unable to close issue");
    }
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!issue) return <p className="muted">Loading issue...</p>;

  const principalOverride = visibilityOverrides(location.search);
  const canEditIssue = canShowAction(editIssueVisibility, issue, principalOverride);
  const canCloseIssue = canShowAction(closeIssueVisibility, issue, principalOverride);

  return (
    <div className="stack">
      <section className="card">
        <div className="button-row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1>{String(issue.title || "")}</h1>
            <p>This ${taskDetail.kind.replace(/_/g, " ")} screen was generated from \`${taskDetail.id}\`.</p>
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
          {canEditIssue ? <Link className="button-link" to={\`/issues/\${id}/edit\`}>Edit Issue</Link> : null}
          {canCloseIssue ? <button type="button" onClick={() => void handleCloseIssue()}>Close Issue</button> : null}
        </div>
      </section>
    </div>
  );
}
`,
    "IssueCreatePage.tsx": `import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { listLookupOptions } from "../lib/api/lookups";
import { ${webReference.client.functionNames.create} } from "../lib/api/client";

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
          listLookupOptions(fetch, "${createBoardRoute}"),
          listLookupOptions(fetch, "${createAssigneeRoute}")
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
        <h1>${taskCreate.title || taskCreate.id}</h1>
        <p>${webReference.createPrimary.helperText}</p>
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
              const created = await ${webReference.client.functionNames.create}(fetch, payload, {
                headers: { "Idempotency-Key": crypto.randomUUID() }
              });
              navigate(\`/issues/\${created.id}\`);
            } catch (createError) {
              setError(createError instanceof Error ? createError.message : "Unable to create issue");
            }
          }}
        >
          <label>Title<input name="title" required /></label>
          <label>Description<textarea name="description" /></label>
          <label>
            Board
            <select name="board_id" required defaultValue={import.meta.env.${projectEnvVar} || ""}>
              <option value="">${webReference.createPrimary.projectPlaceholder}</option>
              {boardOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Assignee
            <select name="assignee_id" defaultValue={import.meta.env.${ownerEnvVar} || ""}>
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
            <button type="submit">${webReference.createPrimary.submitLabel}</button>
            <Link className="button-link secondary" to="/issues">${webReference.createPrimary.cancelLabel}</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
`,
    "IssueEditPage.tsx": `import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { listLookupOptions } from "../lib/api/lookups";
import { ${webReference.client.functionNames.get}, ${webReference.client.functionNames.update} } from "../lib/api/client";

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
          ${webReference.client.functionNames.get}(fetch, id),
          listLookupOptions(fetch, "${editBoardRoute}"),
          listLookupOptions(fetch, "${editAssigneeRoute}")
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
        <h1>${taskEdit.title || taskEdit.id}</h1>
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
              await ${webReference.client.functionNames.update}(fetch, id, payload, {
                headers: {
                  "If-Match": String(issue.updated_at || ""),
                  "Idempotency-Key": crypto.randomUUID()
                }
              });
              navigate(\`/issues/\${id}\`);
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
            <Link className="button-link secondary" to={\`/issues/\${id}\`}>Cancel</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
`
  };
}

function renderIssuesRoutesSvelte({
  useTypescript,
  taskList,
  taskDetail,
  taskCreate,
  taskEdit,
  taskListLookups,
  taskCreateLookups,
  taskEditLookups,
  projectEnvVar,
  ownerEnvVar,
  webReference,
  prettyScreenKind
}) {
  const listLoadRoute = taskListLookups.board_id?.route || "/lookups/boards";
  const assigneeListRoute = taskListLookups.assignee_id?.route || "/lookups/users";
  const createBoardRoute = taskCreateLookups.board_id?.route || "/lookups/boards";
  const createAssigneeRoute = taskCreateLookups.assignee_id?.route || "/lookups/users";
  const editBoardRoute = taskEditLookups.board_id?.route || "/lookups/boards";
  const editAssigneeRoute = taskEditLookups.assignee_id?.route || "/lookups/users";
  const listPresentation = taskList.web?.collection || taskList.collection?.views?.[0] || "list";
  const svelteListMarkup = listPresentation === "data_grid"
    ? `        <div class="table-wrap data-grid-shell">
          <table class="resource-table data-grid">
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
              {#each data.result.items as issue}
                <tr>
                  <td>
                    <div class="cell-stack">
                      <a href={'/issues/' + issue.id}><strong>{issue.title}</strong></a>
                      {#if issue.description}<span class="cell-secondary">{issue.description}</span>{/if}
                    </div>
                  </td>
                  <td><span class="badge">{issue.status}</span></td>
                  <td>{issue.board_id || "Unassigned"}</td>
                  <td>{issue.assignee_id || "Unassigned"}</td>
                  <td>{issue.priority || "Unspecified"}</td>
                  <td>{issue.updated_at || issue.created_at || ""}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>`
    : `        <ul class="task-list">
          {#each data.result.items as issue}
            <li>
              <div class="task-meta">
                <a href={'/issues/' + issue.id}><strong>{issue.title}</strong></a>
                {#if issue.description}<span class="muted">{issue.description}</span>{/if}
              </div>
              <span class="badge">{issue.status}</span>
            </li>
          {/each}
        </ul>`;

  return {
    "issues/+page.ts": `import type { PageLoad } from "./$types";
import { listIssues } from "$lib/api/client";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch, url }) => {
  const limit = url.searchParams.get("limit");
  const [result, boardOptions, assigneeOptions] = await Promise.all([
    listIssues(fetch, {
      board_id: url.searchParams.get("board_id") ?? undefined,
      assignee_id: url.searchParams.get("assignee_id") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      after: url.searchParams.get("after") ?? undefined,
      limit: limit ? Number(limit) : undefined
    }),
    listLookupOptions(fetch, "${listLoadRoute}"),
    listLookupOptions(fetch, "${assigneeListRoute}")
  ]);
  return {
    screen: ${toJson({ id: taskList.id, title: taskList.title, kind: taskList.kind })},
    filters: {
      board_id: url.searchParams.get("board_id") ?? "",
      assignee_id: url.searchParams.get("assignee_id") ?? "",
      status: url.searchParams.get("status") ?? "",
      limit: limit ?? ""
    },
    lookups: {
      board_id: boardOptions,
      assignee_id: assigneeOptions
    },
    result
  };
};
`,
    "issues/+page.svelte": `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;

  const buildNextHref = () => {
    if (!data.result.next_cursor) return null;
    const params = new URLSearchParams();
    if (data.filters.board_id) params.set("board_id", data.filters.board_id);
    if (data.filters.assignee_id) params.set("assignee_id", data.filters.assignee_id);
    if (data.filters.status) params.set("status", data.filters.status);
    if (data.filters.limit) params.set("limit", String(data.filters.limit));
    params.set("after", data.result.next_cursor);
    return \`/issues?\${params.toString()}\`;
  };

  const nextHref = buildNextHref();
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>${taskList.title || taskList.id}</h1>
          <p>This ${prettyScreenKind(taskList.kind)} screen was generated from \`${taskList.id}\`.</p>
        </div>
        <a class="button-link" href="/issues/new">Create Issue</a>
      </div>

      <form class="filters" method="GET">
        <label>
          Board
          <select name="board_id">
            <option value="">${taskListLookups.board_id?.emptyLabel || "All boards"}</option>
            {#each data.lookups.board_id as option}
              <option value={option.value} selected={option.value === (data.filters.board_id ?? "")}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Assignee
          <select name="assignee_id">
            <option value="">${taskListLookups.assignee_id?.emptyLabel || "All assignees"}</option>
            {#each data.lookups.assignee_id as option}
              <option value={option.value} selected={option.value === (data.filters.assignee_id ?? "")}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Status
          <input name="status" value={data.filters.status ?? ""} />
        </label>
        <label>
          Limit
          <input name="limit" type="number" min="1" value={data.filters.limit ?? ""} />
        </label>
        <div class="button-row">
          <button type="submit">Apply Filters</button>
          <a class="button-link secondary" href="/issues">Reset</a>
        </div>
      </form>

      {#if data.result.items.length === 0}
        <div class="empty-state">
          <p><strong>${taskList.emptyState?.title || "No items"}</strong></p>
          <p class="muted">${taskList.emptyState?.body || ""}</p>
        </div>
      {:else}
        <p class="muted">Showing {data.result.items.length} issue{data.result.items.length === 1 ? "" : "s"}.</p>
${svelteListMarkup}
        {#if nextHref}
          <p><a class="button-link secondary" href={nextHref}>Next Page</a></p>
        {/if}
      {/if}
    </section>
  </div>
</main>
`,
    "issues/[id]/+page.ts": `import type { PageLoad } from "./$types";
import { getIssue } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  const issue = await getIssue(fetch, params.id);
  return {
    screen: ${toJson({ id: taskDetail.id, title: taskDetail.title, kind: taskDetail.kind })},
    issue
  };
};
`,
    "issues/[id]/+page.server.ts": `import { randomUUID } from "node:crypto";
import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { closeIssue } from "$lib/api/client";

export const actions: Actions = {
${renderSvelteKitRedirectingAction({
  actionName: "close",
  signature: "{ request, fetch, params }",
  prelude: `const form = await request.formData();
const updated_at = String(form.get("updated_at") || "");
if (!updated_at) {
  return fail(400, { actionError: "updated_at is required to close this issue." });
}`,
  tryStatement: `await closeIssue(fetch, params.id, { closed_at: new Date().toISOString() }, {
  headers: {
    "If-Match": updated_at,
    "Idempotency-Key": randomUUID()
  }
});`,
  catchReturn:
    'return fail(400, { actionError: error instanceof Error ? error.message : "Unable to close issue" });',
  successStatement: "throw redirect(303, `/issues/${params.id}`);"
})}
};
`,
    "issues/[id]/+page.svelte": `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
  export let form;

  const issue = data.issue;
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>{issue.title}</h1>
          <p>This ${prettyScreenKind(taskDetail.kind)} screen was generated from \`${taskDetail.id}\`.</p>
        </div>
        <span class="badge">{issue.status}</span>
      </div>

      {#if issue.description}
        <p>{issue.description}</p>
      {:else}
        <p class="muted">No description was provided for this issue.</p>
      {/if}

      <dl class="definition-list">
        <dt>Issue ID</dt><dd>{issue.id}</dd>
        <dt>Board</dt><dd>{issue.board_id}</dd>
        <dt>Assignee</dt><dd>{issue.assignee_id || "Unassigned"}</dd>
        <dt>Priority</dt><dd>{issue.priority || "Unspecified"}</dd>
        <dt>Created</dt><dd>{issue.created_at}</dd>
        <dt>Updated</dt><dd>{issue.updated_at}</dd>
      </dl>

      {#if form?.actionError}
        <p class="error-text">{form.actionError}</p>
      {/if}

      <div class="button-row">
        <a class="button-link secondary" href="/issues">Back to Issues</a>
        <a class="button-link" href={'/issues/' + issue.id + '/edit'}>Edit Issue</a>
        <form method="POST" action="?/close">
          <input type="hidden" name="updated_at" value={issue.updated_at} />
          <button type="submit">Close Issue</button>
        </form>
      </div>
    </section>
  </div>
</main>
`,
    "issues/new/+page.ts": `import type { PageLoad } from "./$types";
import { env as publicEnv } from "$env/dynamic/public";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch }) => {
  const [boardOptions, assigneeOptions] = await Promise.all([
    listLookupOptions(fetch, "${createBoardRoute}"),
    listLookupOptions(fetch, "${createAssigneeRoute}")
  ]);
  return {
    screen: ${toJson({ id: taskCreate.id, title: taskCreate.title, kind: taskCreate.kind })},
    lookups: {
      board_id: boardOptions,
      assignee_id: assigneeOptions
    },
    defaults: {
      board_id: publicEnv.${projectEnvVar} || "",
      assignee_id: publicEnv.${ownerEnvVar} || "",
      priority: "medium"
    }
  };
};
`,
    "issues/new/+page.server.ts": `import { randomUUID } from "node:crypto";
import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { createIssue } from "$lib/api/client";

export const actions: Actions = {
${renderSvelteKitRedirectingAction({
  actionName: "default",
  signature: "{ request, fetch }",
  prelude: `const form = await request.formData();
const payload = {
  title: String(form.get("title") || ""),
  description: String(form.get("description") || "") || undefined,
  assignee_id: String(form.get("assignee_id") || "") || undefined,
  board_id: String(form.get("board_id") || ""),
  priority: String(form.get("priority") || "") || undefined
};

let created;`,
  tryStatement: `created = await createIssue(fetch, payload, {
  headers: { "Idempotency-Key": randomUUID() }
});`,
  catchReturn: `return fail(400, {
  actionError: error instanceof Error ? error.message : "Unable to create issue",
  values: payload
});`,
  successStatement: "throw redirect(303, `/issues/${created.id}`);"
})}
};
`,
    "issues/new/+page.svelte": `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
  export let form;

  const values = Object.assign(
    {
      title: "",
      description: "",
      assignee_id: "",
      board_id: "",
      priority: "medium"
    },
    data.defaults || {},
    form?.values || {}
  );
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>${taskCreate.title || taskCreate.id}</h1>
      <p>${webReference.createPrimary.helperText}</p>
      {#if form?.actionError}
        <p class="error-text">{form.actionError}</p>
      {/if}
      <form class="stack" method="POST">
        <label>Title<input name="title" required value={values.title ?? ""} /></label>
        <label>Description<textarea name="description">{values.description ?? ""}</textarea></label>
        <label>
          Board
          <select name="board_id" required value={values.board_id ?? ""}>
            <option value="">${webReference.createPrimary.projectPlaceholder}</option>
            {#each data.lookups.board_id as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Assignee
          <select name="assignee_id" value={values.assignee_id ?? ""}>
            <option value="">Optional assignee</option>
            {#each data.lookups.assignee_id as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Priority
          <select name="priority" value={values.priority ?? "medium"}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <div class="button-row">
          <button type="submit">${webReference.createPrimary.submitLabel}</button>
          <a class="button-link secondary" href="/issues">${webReference.createPrimary.cancelLabel}</a>
        </div>
      </form>
    </section>
  </div>
</main>
`,
    "issues/[id]/edit/+page.ts": `import type { PageLoad } from "./$types";
import { getIssue } from "$lib/api/client";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch, params }) => {
  const [issue, boardOptions, assigneeOptions] = await Promise.all([
    getIssue(fetch, params.id),
    listLookupOptions(fetch, "${editBoardRoute}"),
    listLookupOptions(fetch, "${editAssigneeRoute}")
  ]);
  return {
    screen: ${toJson({ id: taskEdit.id, title: taskEdit.title, kind: taskEdit.kind })},
    issue,
    lookups: {
      board_id: boardOptions,
      assignee_id: assigneeOptions
    }
  };
};
`,
    "issues/[id]/edit/+page.server.ts": `import { randomUUID } from "node:crypto";
import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { updateIssue } from "$lib/api/client";

export const actions: Actions = {
${renderSvelteKitRedirectingAction({
  actionName: "default",
  signature: "{ request, fetch, params }",
  prelude: `const form = await request.formData();
const updated_at = String(form.get("updated_at") || "");
const payload = {
  title: String(form.get("title") || ""),
  description: String(form.get("description") || "") || undefined,
  assignee_id: String(form.get("assignee_id") || "") || undefined,
  priority: String(form.get("priority") || "") || undefined,
  status: String(form.get("status") || "") || undefined
};
if (!updated_at) {
  return fail(400, { actionError: "updated_at is required to update this issue.", values: payload });
}`,
  tryStatement: `await updateIssue(fetch, params.id, payload, {
  headers: {
    "If-Match": updated_at,
    "Idempotency-Key": randomUUID()
  }
});`,
  catchReturn: `return fail(400, {
  actionError: error instanceof Error ? error.message : "Unable to update issue",
  values: payload
});`,
  successStatement: "throw redirect(303, `/issues/${params.id}`);"
})}
};
`,
    "issues/[id]/edit/+page.svelte": `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
  export let form;

  const issue = data.issue;
  const values = form?.values || issue;
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>${taskEdit.title || taskEdit.id}</h1>
      {#if form?.actionError}
        <p class="error-text">{form.actionError}</p>
      {/if}
      <form class="stack" method="POST">
        <input type="hidden" name="updated_at" value={issue.updated_at} />
        <label>Title<input name="title" required value={values.title ?? ""} /></label>
        <label>Description<textarea name="description">{values.description ?? ""}</textarea></label>
        <label>
          Board
          <select name="board_id" disabled value={issue.board_id ?? ""}>
            {#each data.lookups.board_id as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Assignee
          <select name="assignee_id" value={values.assignee_id ?? ""}>
            <option value="">Optional assignee</option>
            {#each data.lookups.assignee_id as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Priority
          <select name="priority" value={values.priority ?? "medium"}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label>
          Status
          <select name="status" value={values.status ?? "open"}>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <div class="button-row">
          <button type="submit">Save Issue</button>
          <a class="button-link secondary" href={'/issues/' + issue.id}>Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>
`
  };
}

export function renderIssuesRoutes(args) {
  return args.useTypescript !== undefined
    ? renderIssuesRoutesSvelte(args)
    : renderIssuesRoutesReact(args);
}

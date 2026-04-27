<script lang="ts">
  export let data;

  const buildNextHref = () => {
    if (!data.result.next_cursor) return null;
    const params = new URLSearchParams();
    if (data.filters.board_id) params.set("board_id", data.filters.board_id);
    if (data.filters.assignee_id) params.set("assignee_id", data.filters.assignee_id);
    if (data.filters.status) params.set("status", data.filters.status);
    if (data.filters.limit) params.set("limit", String(data.filters.limit));
    params.set("after", data.result.next_cursor);
    return `/issues?${params.toString()}`;
  };

  const nextHref = buildNextHref();
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>Issues</h1>
          <p>This list screen was generated from `issue_list`.</p>
        </div>
        <a class="button-link" href="/issues/new">Create Issue</a>
      </div>

      <form class="filters" method="GET">
        <label>
          Board
          <select name="board_id">
            <option value="">All boards</option>
            {#each data.lookups.board_id as option}
              <option value={option.value} selected={option.value === (data.filters.board_id ?? "")}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Assignee
          <select name="assignee_id">
            <option value="">All assignees</option>
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
          <p><strong>No issues yet</strong></p>
          <p class="muted">Create an issue to get started</p>
        </div>
      {:else}
        <p class="muted">Showing {data.result.items.length} issue{data.result.items.length === 1 ? "" : "s"}.</p>
        <div class="table-wrap data-grid-shell">
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
        </div>
        {#if nextHref}
          <p><a class="button-link secondary" href={nextHref}>Next Page</a></p>
        {/if}
      {/if}
    </section>
  </div>
</main>

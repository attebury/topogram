<script lang="ts">
  export let data;
  export let form;

  const buildNextHref = () => {
    if (!data.result.next_cursor) return null;
    const params = new URLSearchParams();
    if (data.filters.project_id) params.set("project_id", data.filters.project_id);
    if (data.filters.owner_id) params.set("owner_id", data.filters.owner_id);
    if (data.filters.status) params.set("status", data.filters.status);
    if (data.filters.limit) params.set("limit", String(data.filters.limit));
    params.set("after", data.result.next_cursor);
    return `/tasks?${params.toString()}`;
  };

  const nextHref = buildNextHref();
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>Tasks</h1>
          <p>This list screen was generated from `task_list`.</p>
        </div>
        <a class="button-link" href="/tasks/new">Create Task</a>
      </div>

      <form class="filters" method="GET">
        <label>
          Project
          <select name="project_id">
            <option value="">All projects</option>
            {#each data.lookups.project_id as option}
              <option value={option.value} selected={option.value === (data.filters.project_id ?? "")}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Owner
          <select name="owner_id">
            <option value="">All owners</option>
            {#each data.lookups.owner_id as option}
              <option value={option.value} selected={option.value === (data.filters.owner_id ?? "")}>{option.label}</option>
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
          <a class="button-link secondary" href="/tasks">Reset</a>
        </div>
      </form>

      <form method="POST" action="?/export">
        <input type="hidden" name="project_id" value={data.filters.project_id ?? ""} />
        <input type="hidden" name="owner_id" value={data.filters.owner_id ?? ""} />
        <input type="hidden" name="status" value={data.filters.status ?? ""} />
        <div class="button-row">
          <button type="submit">Start Export</button>
          {#if form?.exportError}<span class="muted">{form.exportError}</span>{/if}
        </div>
      </form>

      {#if data.result.items.length === 0}
        <div class="empty-state">
          <p><strong>No tasks yet</strong></p>
          <p class="muted">Create a task to get started</p>
        </div>
      {:else}
        <p class="muted">Showing {data.result.items.length} task{data.result.items.length === 1 ? "" : "s"}.</p>
        <ul class="task-list">
          {#each data.result.items as task}
            <li>
              <div class="task-meta">
                <a href={'/tasks/' + task.id}><strong>{task.title}</strong></a>
                {#if task.description}<span class="muted">{task.description}</span>{/if}
                <span class="muted">Priority: {task.priority ?? "medium"}</span>
              </div>
              <div class="button-row">
                <span class="badge">{task.priority ?? "medium"}</span>
                <span class="badge">{task.status}</span>
              </div>
            </li>
          {/each}
        </ul>
        {#if nextHref}
          <p><a class="button-link secondary" href={nextHref}>Next Page</a></p>
        {/if}
      {/if}
    </section>
  </div>
</main>

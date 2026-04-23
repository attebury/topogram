<script lang="ts">
  export let data;

  const buildNextHref = () => {
    if (!data.result.next_cursor) return null;
    const params = new URLSearchParams();
    if (data.filters.limit) params.set("limit", String(data.filters.limit));
    params.set("after", data.result.next_cursor);
    return `/projects?${params.toString()}`;
  };

  const nextHref = buildNextHref();
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>Projects</h1>
          <p>This list screen was generated from `project_list`.</p>
        </div>
        <a class="button-link" href="/projects/new">Create Project</a>
      </div>

      {#if data.result.items.length === 0}
        <div class="empty-state">
          <p><strong>No projects yet</strong></p>
          <p class="muted">Create a project to organize your tasks</p>
        </div>
      {:else}
        <ul class="task-list resource-list">
          {#each data.result.items as project}
            <li>
              <div class="task-meta resource-meta">
                <a href={'/projects/' + project.id}><strong>{project.name}</strong></a>
                {#if project.description}<span class="muted">{project.description}</span>{/if}
                <span class="muted">Owner: {project.owner_id || "Unassigned"}</span>
              </div>
              <span class="badge">{project.status}</span>
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

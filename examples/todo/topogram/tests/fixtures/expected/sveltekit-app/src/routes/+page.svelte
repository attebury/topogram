<script lang="ts">
  import { PUBLIC_TOPOGRAM_DEMO_TASK_ID } from "$env/static/public";

  const screens = [
  {
    "id": "task_list",
    "title": "Tasks",
    "route": "/tasks",
    "navigable": true
  },
  {
    "id": "task_detail",
    "title": "Task Details",
    "route": "/tasks/:id",
    "navigable": false
  },
  {
    "id": "task_create",
    "title": "Create Task",
    "route": "/tasks/new",
    "navigable": true
  },
  {
    "id": "task_edit",
    "title": "Edit Task",
    "route": "/tasks/:id/edit",
    "navigable": false
  },
  {
    "id": "task_exports",
    "title": "Export Status",
    "route": "/task-exports/:job_id",
    "navigable": false
  }
];
  const demoTaskRoute = PUBLIC_TOPOGRAM_DEMO_TASK_ID ? `/tasks/${PUBLIC_TOPOGRAM_DEMO_TASK_ID}` : null;
</script>

<main>
  <div class="stack">
    <section class="card hero">
      <div>
        <h1>Todo Web UI</h1>
        <p>Generated from Topogram via the `sveltekit` profile and wired to the generated API client.</p>
      </div>
      <div class="button-row">
        <a class="button-link" href="/tasks">Browse Tasks</a>
        <a class="button-link secondary" href="/tasks/new">Create Task</a>
        {#if demoTaskRoute}
          <a class="button-link secondary" href={demoTaskRoute}>Open Demo Task</a>
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
            <p class="muted">This screen uses a dynamic route.</p>
            <small class="route-hint">{screen.route}</small>
          {:else}
            <p class="muted">No direct route is exposed for this screen.</p>
          {/if}
        </article>
      {/each}
    </section>
  </div>
</main>

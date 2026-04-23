<script lang="ts">
  import { PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID as DEMO_TASK_ID } from "$env/static/public";

  const screens = [
  {
    "id": "project_list",
    "title": "Projects",
    "route": "/projects",
    "navigable": true
  },
  {
    "id": "project_detail",
    "title": "Project Details",
    "route": "/projects/:id",
    "navigable": false
  },
  {
    "id": "project_create",
    "title": "Create Project",
    "route": "/projects/new",
    "navigable": true
  },
  {
    "id": "project_edit",
    "title": "Edit Project",
    "route": "/projects/:id/edit",
    "navigable": false
  },
  {
    "id": "user_list",
    "title": "Users",
    "route": "/users",
    "navigable": true
  },
  {
    "id": "user_detail",
    "title": "User Details",
    "route": "/users/:id",
    "navigable": false
  },
  {
    "id": "user_create",
    "title": "Create User",
    "route": "/users/new",
    "navigable": true
  },
  {
    "id": "user_edit",
    "title": "Edit User",
    "route": "/users/:id/edit",
    "navigable": false
  },
  {
    "id": "task_list",
    "title": "Tasks",
    "route": "/tasks",
    "navigable": true
  },
  {
    "id": "task_board",
    "title": "Task Board",
    "route": "/tasks/board",
    "navigable": true
  },
  {
    "id": "task_calendar",
    "title": "Task Calendar",
    "route": "/tasks/calendar",
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
  const demoTaskRoute = DEMO_TASK_ID ? `/tasks/${DEMO_TASK_ID}` : null;
</script>

<main>
  <div class="stack">
    <section class="card hero">
      <div>
        <h1>Todo Web UI</h1>
        <p>Generated from Topogram via the `sveltekit` profile and wired to a multi-resource workspace for tasks, projects, and users.</p>
      </div>
      <div class="button-row">
        <a class="button-link" href="/tasks">Tasks</a>
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

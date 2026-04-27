<script lang="ts">
  import { env as publicEnv } from "$env/dynamic/public";

  const screens = [
  {
    "id": "issue_list",
    "title": "Issues",
    "route": "/issues",
    "navigable": true
  },
  {
    "id": "issue_detail",
    "title": "Issue Details",
    "route": "/issues/:id",
    "navigable": false
  },
  {
    "id": "issue_create",
    "title": "Create Issue",
    "route": "/issues/new",
    "navigable": true
  },
  {
    "id": "issue_edit",
    "title": "Edit Issue",
    "route": "/issues/:id/edit",
    "navigable": false
  }
];
  const demoPrimaryRoute = publicEnv.PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID ? `/issues/${publicEnv.PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID}` : null;
</script>

<main>
  <div class="stack">
    <section class="card hero">
      <div>
        <h1>Issues Web UI (SvelteKit)</h1>
        <p>Generated from Topogram via the `sveltekit` profile and wired to the generated API client.</p>
      </div>
      <div class="button-row">
        <a class="button-link" href="/issues">Issues</a>
        <a class="button-link secondary" href="/issues/new">Create Issue</a>
        {#if demoPrimaryRoute}
          <a class="button-link secondary" href={demoPrimaryRoute}>Open Demo Issue</a>
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

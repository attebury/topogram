<script lang="ts">
  import { PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID as DEMO_ITEM_ID } from "$env/static/public";

  const screens = [
  {
    "id": "collection_list",
    "title": "Collections",
    "route": "/collections",
    "navigable": true
  },
  {
    "id": "collection_detail",
    "title": "Collection Details",
    "route": "/collections/:id",
    "navigable": false
  },
  {
    "id": "collection_create",
    "title": "Create Collection",
    "route": "/collections/new",
    "navigable": true
  },
  {
    "id": "collection_edit",
    "title": "Edit Collection",
    "route": "/collections/:id/edit",
    "navigable": false
  },
  {
    "id": "member_list",
    "title": "Members",
    "route": "/members",
    "navigable": true
  },
  {
    "id": "member_detail",
    "title": "Member Details",
    "route": "/members/:id",
    "navigable": false
  },
  {
    "id": "member_create",
    "title": "Create Member",
    "route": "/members/new",
    "navigable": true
  },
  {
    "id": "member_edit",
    "title": "Edit Member",
    "route": "/members/:id/edit",
    "navigable": false
  },
  {
    "id": "item_list",
    "title": "Items",
    "route": "/items",
    "navigable": true
  },
  {
    "id": "item_board",
    "title": "Item Board",
    "route": "/items/board",
    "navigable": true
  },
  {
    "id": "item_calendar",
    "title": "Item Calendar",
    "route": "/items/calendar",
    "navigable": true
  },
  {
    "id": "item_detail",
    "title": "Item Details",
    "route": "/items/:id",
    "navigable": false
  },
  {
    "id": "item_create",
    "title": "Create Item",
    "route": "/items/new",
    "navigable": true
  },
  {
    "id": "item_edit",
    "title": "Edit Item",
    "route": "/items/:id/edit",
    "navigable": false
  },
  {
    "id": "item_exports",
    "title": "Export Status",
    "route": "/item-exports/:job_id",
    "navigable": false
  }
];
  const demoItemRoute = DEMO_ITEM_ID ? `/items/${DEMO_ITEM_ID}` : null;
</script>

<main>
  <div class="stack">
    <section class="card hero">
      <div>
        <h1>Sample Workspace Web UI</h1>
        <p>Generated from Topogram via the `sveltekit` profile and wired to a multi-resource workspace for items, collections, and members.</p>
      </div>
      <div class="button-row">
        <a class="button-link" href="/items">Items</a>
        <a class="button-link secondary" href="/items/new">Create Item</a>
        {#if demoItemRoute}
          <a class="button-link secondary" href={demoItemRoute}>Open Demo Item</a>
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

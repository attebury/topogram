<script lang="ts">
  export let data;

  const buildNextHref = () => {
    if (!data.result.next_cursor) return null;
    const params = new URLSearchParams();
    if (data.filters.limit) params.set("limit", String(data.filters.limit));
    params.set("after", data.result.next_cursor);
    return `/collections?${params.toString()}`;
  };

  const nextHref = buildNextHref();
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>Collections</h1>
          <p>This list screen was generated from `collection_list`.</p>
        </div>
        <a class="button-link" href="/collections/new">Create Collection</a>
      </div>

      {#if data.result.items.length === 0}
        <div class="empty-state">
          <p><strong>No collections yet</strong></p>
          <p class="muted">Create a collection to organize your items</p>
        </div>
      {:else}
        <ul class="item-list resource-list">
          {#each data.result.items as collection}
            <li>
              <div class="item-meta resource-meta">
                <a href={'/collections/' + collection.id}><strong>{collection.name}</strong></a>
                {#if collection.description}<span class="muted">{collection.description}</span>{/if}
                <span class="muted">Owner: {collection.owner_id || "Unassigned"}</span>
              </div>
              <span class="badge">{collection.status}</span>
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

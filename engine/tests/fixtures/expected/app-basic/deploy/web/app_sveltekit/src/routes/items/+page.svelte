<script lang="ts">
  export let data;
  export let form;

  const buildNextHref = () => {
    if (!data.result.next_cursor) return null;
    const params = new URLSearchParams();
    if (data.filters.collection_id) params.set("collection_id", data.filters.collection_id);
    if (data.filters.owner_id) params.set("owner_id", data.filters.owner_id);
    if (data.filters.status) params.set("status", data.filters.status);
    if (data.filters.limit) params.set("limit", String(data.filters.limit));
    params.set("after", data.result.next_cursor);
    return `/items?${params.toString()}`;
  };

  const nextHref = buildNextHref();
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>Items</h1>
          <p>This list screen was generated from `item_list`.</p>
        </div>
        <a class="button-link" href="/items/new">Create Item</a>
      </div>


      <form class="filters" method="GET">
        <label>
          Collection
          <select name="collection_id">
            <option value="">All collections</option>
            {#each data.lookups.collection_id as option}
              <option value={option.value} selected={option.value === (data.filters.collection_id ?? "")}>{option.label}</option>
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
          <a class="button-link secondary" href="/items">Reset</a>
        </div>
      </form>

      <form method="POST" action="?/export">
        <input type="hidden" name="collection_id" value={data.filters.collection_id ?? ""} />
        <input type="hidden" name="owner_id" value={data.filters.owner_id ?? ""} />
        <input type="hidden" name="status" value={data.filters.status ?? ""} />
        <div class="button-row">
          <button type="submit">Start Export</button>
          {#if form?.exportError}<span class="muted">{form.exportError}</span>{/if}
        </div>
      </form>

      {#if data.result.items.length === 0}
        <div class="empty-state">
          <p><strong>No items yet</strong></p>
          <p class="muted">Create a item to get started</p>
        </div>
      {:else}
        <p class="muted">Showing {data.result.items.length} item{data.result.items.length === 1 ? "" : "s"}.</p>
        <div class="component-card component-table" data-topogram-component="component_ui_data_grid">
          <div class="component-header">
            <div>
              <p class="component-eyebrow">Component</p>
              <h2>Data Grid</h2>
            </div>
            <span class="badge">{data.result.items.length} items</span>
          </div>
          <div class="table-wrap component-table-wrap">
            <table class="resource-table data-grid">
              <thead>
                <tr>
                  {#each Object.keys(data.result.items[0] ?? {}).slice(0, 4) as field}
                    <th>{field}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each data.result.items as item}
                  <tr>
                    {#each Object.keys(data.result.items[0] ?? {}).slice(0, 4) as field}
                      <td>{String(item?.[field] ?? "")}</td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
        {#if nextHref}
          <p><a class="button-link secondary" href={nextHref}>Next Page</a></p>
        {/if}
      {/if}
    </section>
  </div>
</main>

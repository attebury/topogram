<script lang="ts">
  export let data;
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <p class="muted">board</p>
          <h1>Item Board</h1>
          <p>This SvelteKit page was generated from <code>item_board</code>.</p>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Sample rows</h2>
      <ul class="resource-list">
        {#each data.result.items as item}
          <li>
            <div class="resource-meta">
              <strong>{item.title ?? item.name ?? item.message ?? item.id}</strong>
              {#if item.description}<span class="muted">{item.description}</span>{/if}
            </div>
            <span class="badge">{item.status ?? "active"}</span>
          </li>
        {/each}
      </ul>
    </section>
  </div>
</main>

<script lang="ts">
  export let data;
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>{data.collection.name}</h1>
          <p>This detail screen was generated from `collection_detail`.</p>
        </div>
        <span class="badge">{data.collection.status}</span>
      </div>

      {#if data.collection.description}
        <p>{data.collection.description}</p>
      {:else}
        <p class="muted">No description was provided for this collection.</p>
      {/if}

      <dl class="definition-list">
        <dt>Collection ID</dt><dd>{data.collection.id}</dd>
        <dt>Status</dt><dd>{data.collection.status}</dd>
        <dt>Owner</dt><dd>{data.collection.owner_id || "Unassigned"}</dd>
        <dt>Created</dt><dd>{data.collection.created_at}</dd>
      </dl>

      <div class="button-row">
        <a class="button-link secondary" href="/collections">Back to Collections</a>
        <a class="button-link" href={"/collections/" + data.collection.id + "/edit"}>Edit Collection</a>
      </div>
    </section>
  </div>
</main>

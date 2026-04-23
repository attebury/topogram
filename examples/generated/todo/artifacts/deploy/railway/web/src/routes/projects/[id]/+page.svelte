<script lang="ts">
  export let data;
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>{data.project.name}</h1>
          <p>This detail screen was generated from `project_detail`.</p>
        </div>
        <span class="badge">{data.project.status}</span>
      </div>

      {#if data.project.description}
        <p>{data.project.description}</p>
      {:else}
        <p class="muted">No description was provided for this project.</p>
      {/if}

      <dl class="definition-list">
        <dt>Project ID</dt><dd>{data.project.id}</dd>
        <dt>Status</dt><dd>{data.project.status}</dd>
        <dt>Owner</dt><dd>{data.project.owner_id || "Unassigned"}</dd>
        <dt>Created</dt><dd>{data.project.created_at}</dd>
      </dl>

      <div class="button-row">
        <a class="button-link secondary" href="/projects">Back to Projects</a>
        <a class="button-link" href={"/projects/" + data.project.id + "/edit"}>Edit Project</a>
      </div>
    </section>
  </div>
</main>

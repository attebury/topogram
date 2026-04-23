<script lang="ts">
  export let data;
  export let form;
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>{data.task.title}</h1>
          <p>This detail screen was generated from `task_detail`.</p>
        </div>
        <span class="badge">{data.task.status}</span>
      </div>

      {#if data.task.description}
        <p>{data.task.description}</p>
      {:else}
        <p class="muted">No description was provided for this task.</p>
      {/if}

      {#if form?.actionError}
        <p><strong>{form.actionError}</strong></p>
      {/if}

      <dl class="definition-list">
        <dt>Task ID</dt><dd>{data.task.id}</dd>
        <dt>Project</dt><dd>{data.task.project_id}</dd>
        <dt>Owner</dt><dd>{data.task.owner_id ?? "Unassigned"}</dd>
        <dt>Created</dt><dd>{data.task.created_at}</dd>
        <dt>Updated</dt><dd>{data.task.updated_at}</dd>
      </dl>

      <div class="button-row">
        <a class="button-link secondary" href="/tasks">Back to Tasks</a>
        <a class="button-link" href={"/tasks/" + data.task.id + "/edit"}>Edit Task</a>
      </div>

      <div class="button-row">
        <form method="POST" action="?/complete">
          <input type="hidden" name="updated_at" value={data.task.updated_at} />
          <button type="submit">Complete Task</button>
        </form>
        <form method="POST" action="?/delete">
          <input type="hidden" name="updated_at" value={data.task.updated_at} />
          <button type="submit">Archive Task</button>
        </form>
      </div>
    </section>
  </div>
</main>

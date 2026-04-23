<script lang="ts">
  export let data;
  export let form;

  const issue = data.issue;
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>{issue.title}</h1>
          <p>This detail screen was generated from `issue_detail`.</p>
        </div>
        <span class="badge">{issue.status}</span>
      </div>

      {#if issue.description}
        <p>{issue.description}</p>
      {:else}
        <p class="muted">No description was provided for this issue.</p>
      {/if}

      <dl class="definition-list">
        <dt>Issue ID</dt><dd>{issue.id}</dd>
        <dt>Board</dt><dd>{issue.board_id}</dd>
        <dt>Assignee</dt><dd>{issue.assignee_id || "Unassigned"}</dd>
        <dt>Priority</dt><dd>{issue.priority || "Unspecified"}</dd>
        <dt>Created</dt><dd>{issue.created_at}</dd>
        <dt>Updated</dt><dd>{issue.updated_at}</dd>
      </dl>

      {#if form?.actionError}
        <p class="error-text">{form.actionError}</p>
      {/if}

      <div class="button-row">
        <a class="button-link secondary" href="/issues">Back to Issues</a>
        <a class="button-link" href={'/issues/' + issue.id + '/edit'}>Edit Issue</a>
        <form method="POST" action="?/close">
          <input type="hidden" name="updated_at" value={issue.updated_at} />
          <button type="submit">Close Issue</button>
        </form>
      </div>
    </section>
  </div>
</main>

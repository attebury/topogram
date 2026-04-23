<script lang="ts">
  export let data;
  export let form;

  const issue = data.issue;
  const values = form?.values || issue;
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>Edit Issue</h1>
      {#if form?.actionError}
        <p class="error-text">{form.actionError}</p>
      {/if}
      <form class="stack" method="POST">
        <input type="hidden" name="updated_at" value={issue.updated_at} />
        <label>Title<input name="title" required value={values.title ?? ""} /></label>
        <label>Description<textarea name="description">{values.description ?? ""}</textarea></label>
        <label>
          Board
          <select name="board_id" disabled value={issue.board_id ?? ""}>
            {#each data.lookups.board_id as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Assignee
          <select name="assignee_id" value={values.assignee_id ?? ""}>
            <option value="">Optional assignee</option>
            {#each data.lookups.assignee_id as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Priority
          <select name="priority" value={values.priority ?? "medium"}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label>
          Status
          <select name="status" value={values.status ?? "open"}>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <div class="button-row">
          <button type="submit">Save Issue</button>
          <a class="button-link secondary" href={'/issues/' + issue.id}>Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>

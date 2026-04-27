<script lang="ts">
  export let data;
  export let form;

  const values = Object.assign(
    {
      title: "",
      description: "",
      assignee_id: "",
      board_id: "",
      priority: "medium"
    },
    data.defaults || {},
    form?.values || {}
  );
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>Create Issue</h1>
      <p>A board is required to create an issue. Assignee is optional.</p>
      {#if form?.actionError}
        <p class="error-text">{form.actionError}</p>
      {/if}
      <form class="stack" method="POST">
        <label>Title<input name="title" required value={values.title ?? ""} /></label>
        <label>Description<textarea name="description">{values.description ?? ""}</textarea></label>
        <label>
          Board
          <select name="board_id" required value={values.board_id ?? ""}>
            <option value="">Select a board</option>
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
        <div class="button-row">
          <button type="submit">Create Issue</button>
          <a class="button-link secondary" href="/issues">Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>

<script lang="ts">
  export let data;
  export let form;

  const values = form?.values ?? data.values;
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>Edit Task</h1>
      <p>Update the mutable fields for <strong>{data.task.title}</strong>.</p>
      {#if form?.error}<p><strong>{form.error}</strong></p>{/if}
      <form class="stack" method="POST">
        <input type="hidden" name="updated_at" value={data.task.updated_at} />
        <label>Title <input name="title" value={values.title ?? ""} /></label>
        <label>Description <textarea name="description">{values.description ?? ""}</textarea></label>
        <label>
          Priority
          <select name="priority">
            <option value="low" selected={(values.priority ?? "") === "low"}>low</option>
            <option value="medium" selected={(values.priority ?? "") === "medium"}>medium</option>
            <option value="high" selected={(values.priority ?? "") === "high"}>high</option>
          </select>
        </label>
        <label>
          Owner
          <select name="owner_id">
            <option value="">Unassigned</option>
            {#each data.lookups.owner_id as option}
              <option value={option.value} selected={option.value === (values.owner_id ?? "")}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>Due At <input name="due_at" type="datetime-local" value={values.due_at ?? ""} /></label>
        <label>
          Status
          <select name="status">
            <option value="">Keep current ({data.task.status})</option>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="completed">completed</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <div class="button-row">
          <button type="submit">Save Changes</button>
          <a class="button-link secondary" href={"/tasks/" + data.task.id}>Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>

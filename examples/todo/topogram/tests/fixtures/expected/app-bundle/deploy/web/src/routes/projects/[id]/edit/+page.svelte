<script lang="ts">
  export let data;
  export let form;

  const values = form?.values ?? data.values;
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>Edit Project</h1>
      <p>Update the mutable fields for <strong>{data.project.name}</strong>.</p>
      {#if form?.error}<p><strong>{form.error}</strong></p>{/if}
      <form class="stack" method="POST">
        <label>Name <input name="name" value={values.name ?? ""} /></label>
        <label>Description <textarea name="description">{values.description ?? ""}</textarea></label>
        <label>
          Status
          <select name="status">
            <option value="active" selected={(values.status ?? data.project.status) === "active"}>active</option>
            <option value="archived" selected={(values.status ?? data.project.status) === "archived"}>archived</option>
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
        <div class="button-row">
          <button type="submit">Save Changes</button>
          <a class="button-link secondary" href={"/projects/" + data.project.id}>Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>

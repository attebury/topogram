<script lang="ts">
  export let data;
  export let form;

  const values = {
    name: form?.values?.name ?? "",
    description: form?.values?.description ?? "",
    status: form?.values?.status ?? "active",
    owner_id: form?.values?.owner_id ?? ""
  };
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>Create Project</h1>
      <p>This form screen was generated from `project_create`.</p>
      {#if form?.error}<p><strong>{form.error}</strong></p>{/if}
      <form class="stack" method="POST">
        <label>Name <input name="name" required value={values.name} /></label>
        <label>Description <textarea name="description">{values.description}</textarea></label>
        <label>
          Status
          <select name="status">
            <option value="active" selected={values.status === "active"}>active</option>
            <option value="archived" selected={values.status === "archived"}>archived</option>
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
          <button type="submit">Create Project</button>
          <a class="button-link secondary" href="/projects">Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>

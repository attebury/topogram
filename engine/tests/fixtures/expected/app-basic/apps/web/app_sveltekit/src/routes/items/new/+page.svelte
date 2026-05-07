<script lang="ts">
  import { PUBLIC_TOPOGRAM_DEMO_CONTAINER_ID as DEMO_COLLECTION_ID, PUBLIC_TOPOGRAM_AUTH_USER_ID as DEMO_MEMBER_ID } from "$env/static/public";

  export let data;
  export let form;

  const values = {
    title: form?.values?.title ?? "",
    description: form?.values?.description ?? "",
    priority: form?.values?.priority ?? "medium",
    owner_id: form?.values?.owner_id ?? DEMO_MEMBER_ID ?? "",
    collection_id: form?.values?.collection_id ?? DEMO_COLLECTION_ID ?? "",
    due_at: form?.values?.due_at ?? ""
  };
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>Create Item</h1>
      <p>This wizard screen was generated from `item_create`.</p>
      <p class="muted">A collection is required to create a item. Owner is optional.</p>
      {#if form?.error}<p><strong>{form.error}</strong></p>{/if}
      <form class="stack" method="POST">
        <label>Title <input name="title" required value={values.title} /></label>
        <label>Description <textarea name="description">{values.description}</textarea></label>
        <label>
          Priority
          <select name="priority">
            <option value="low" selected={values.priority === "low"}>low</option>
            <option value="medium" selected={values.priority === "medium"}>medium</option>
            <option value="high" selected={values.priority === "high"}>high</option>
          </select>
        </label>
        <label>
          Owner
          <select name="owner_id">
            <option value="">Unassigned</option>
            {#each data.lookups.owner_id as option}
              <option value={option.value} selected={option.value === values.owner_id}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Collection
          <select name="collection_id" required>
            <option value="">Select a collection</option>
            {#each data.lookups.collection_id as option}
              <option value={option.value} selected={option.value === values.collection_id}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>Due At <input name="due_at" type="datetime-local" value={values.due_at} /></label>
        <div class="button-row">
          <button type="submit">Create Item</button>
          <a class="button-link secondary" href="/items">Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>

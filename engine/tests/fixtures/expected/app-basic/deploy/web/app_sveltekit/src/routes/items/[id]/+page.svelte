<script lang="ts">
  import { canShowAction } from "$lib/auth/visibility";

  export let data;
  export let form;

  const editItemVisibility = {
  "capability": {
    "id": "cap_update_item",
    "kind": "capability"
  },
  "predicate": "ownership",
  "value": "owner_or_admin",
  "claimValue": null,
  "ownershipField": "owner_id"
};
  const completeItemVisibility = {
  "capability": {
    "id": "cap_complete_item",
    "kind": "capability"
  },
  "predicate": "ownership",
  "value": "owner_or_admin",
  "claimValue": null,
  "ownershipField": "owner_id"
};
  const deleteItemVisibility = {
  "capability": {
    "id": "cap_delete_item",
    "kind": "capability"
  },
  "predicate": "permission",
  "value": "items.delete",
  "claimValue": null,
  "ownershipField": null
};

  $: canEditItem = canShowAction(editItemVisibility, data?.item, data?.visibilityDebug);
  $: canCompleteItem = canShowAction(completeItemVisibility, data?.item, data?.visibilityDebug);
  $: canDeleteItem = canShowAction(deleteItemVisibility, data?.item, data?.visibilityDebug);
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>{data.item.title}</h1>
          <p>This detail screen was generated from `item_detail`.</p>
        </div>
        <span class="badge">{data.item.status}</span>
      </div>

      {#if data.item.description}
        <p>{data.item.description}</p>
      {:else}
        <p class="muted">No description was provided for this item.</p>
      {/if}

      {#if form?.actionError}
        <p><strong>{form.actionError}</strong></p>
      {/if}

      <dl class="definition-list">
        <dt>Item ID</dt><dd>{data.item.id}</dd>
        <dt>Collection</dt><dd>{data.item.collection_id}</dd>
        <dt>Owner</dt><dd>{data.item.owner_id ?? "Unassigned"}</dd>
        <dt>Priority</dt><dd>{data.item.priority ?? "medium"}</dd>
        <dt>Created</dt><dd>{data.item.created_at}</dd>
        <dt>Updated</dt><dd>{data.item.updated_at}</dd>
      </dl>

      <div class="button-row">
        <a class="button-link secondary" href="/items">Back to Items</a>
        {#if canEditItem}
          <a class="button-link" href={"/items/" + data.item.id + "/edit"}>Edit Item</a>
        {/if}
      </div>

      <div class="button-row">
        {#if canCompleteItem}
          <form method="POST" action="?/complete">
            <input type="hidden" name="updated_at" value={data.item.updated_at} />
            <button type="submit">Complete Item</button>
          </form>
        {/if}
        {#if canDeleteItem}
          <form method="POST" action="?/delete">
            <input type="hidden" name="updated_at" value={data.item.updated_at} />
            <button type="submit">Archive Item</button>
          </form>
        {/if}
      </div>
    </section>
  </div>
</main>

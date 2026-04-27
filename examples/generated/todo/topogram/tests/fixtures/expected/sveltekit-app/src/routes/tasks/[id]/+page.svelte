<script lang="ts">
  import { canShowAction } from "$lib/auth/visibility";

  export let data;
  export let form;

  const editTaskVisibility = {
  "capability": {
    "id": "cap_update_task",
    "kind": "capability"
  },
  "predicate": "ownership",
  "value": "owner_or_admin",
  "claimValue": null,
  "ownershipField": "owner_id"
};
  const completeTaskVisibility = {
  "capability": {
    "id": "cap_complete_task",
    "kind": "capability"
  },
  "predicate": "ownership",
  "value": "owner_or_admin",
  "claimValue": null,
  "ownershipField": "owner_id"
};
  const deleteTaskVisibility = {
  "capability": {
    "id": "cap_delete_task",
    "kind": "capability"
  },
  "predicate": "permission",
  "value": "tasks.delete",
  "claimValue": null,
  "ownershipField": null
};

  $: canEditTask = canShowAction(editTaskVisibility, data?.task, data?.visibilityDebug);
  $: canCompleteTask = canShowAction(completeTaskVisibility, data?.task, data?.visibilityDebug);
  $: canDeleteTask = canShowAction(deleteTaskVisibility, data?.task, data?.visibilityDebug);
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
        <dt>Priority</dt><dd>{data.task.priority ?? "medium"}</dd>
        <dt>Created</dt><dd>{data.task.created_at}</dd>
        <dt>Updated</dt><dd>{data.task.updated_at}</dd>
      </dl>

      <div class="button-row">
        <a class="button-link secondary" href="/tasks">Back to Tasks</a>
        {#if canEditTask}
          <a class="button-link" href={"/tasks/" + data.task.id + "/edit"}>Edit Task</a>
        {/if}
      </div>

      <div class="button-row">
        {#if canCompleteTask}
          <form method="POST" action="?/complete">
            <input type="hidden" name="updated_at" value={data.task.updated_at} />
            <button type="submit">Complete Task</button>
          </form>
        {/if}
        {#if canDeleteTask}
          <form method="POST" action="?/delete">
            <input type="hidden" name="updated_at" value={data.task.updated_at} />
            <button type="submit">Archive Task</button>
          </form>
        {/if}
      </div>
    </section>
  </div>
</main>

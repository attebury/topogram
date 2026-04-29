import { renderSvelteKitRedirectingAction } from "@attebury/topogram/src/generator/surfaces/web/sveltekit-actions.js";
import { TODO_WEB_SCREEN_REFERENCE } from "./screens-reference.js";

export function renderTodoHomePage({
  useTypescript,
  demoPrimaryEnvVar,
  screens,
  projectionName,
  homeDescription,
  webReference
}) {
  return `<script${useTypescript ? ' lang="ts"' : ""}>
  import { ${demoPrimaryEnvVar} as DEMO_TASK_ID } from "$env/static/public";

  const screens = ${JSON.stringify(screens, null, 2)};
  const demoTaskRoute = DEMO_TASK_ID ? \`/tasks/\${DEMO_TASK_ID}\` : null;
</script>

<main>
  <div class="stack">
    <section class="card hero">
      <div>
        <h1>${projectionName}</h1>
        <p>${homeDescription}</p>
      </div>
      <div class="button-row">
        <a class="button-link" href="${webReference.nav.browseRoute}">${webReference.nav.browseLabel}</a>
        <a class="button-link secondary" href="${webReference.nav.createRoute}">${webReference.nav.createLabel}</a>
        {#if demoTaskRoute}
          <a class="button-link secondary" href={demoTaskRoute}>${webReference.home.demoTaskLabel}</a>
        {/if}
      </div>
    </section>

    <section class="grid two">
      {#each screens as screen}
        <article class="card">
          <h2>{screen.title}</h2>
          {#if screen.navigable}
            <p><a href={screen.route}>Open screen</a></p>
          {:else if screen.route}
            <p class="muted">${webReference.home.dynamicRouteText}</p>
            <small class="route-hint">{screen.route}</small>
          {:else}
            <p class="muted">${webReference.home.noRouteText}</p>
          {/if}
        </article>
      {/each}
    </section>
  </div>
</main>
`;
}

export function renderTodoTaskRoutes({
  useTypescript,
  contract,
  taskList,
  taskDetail,
  taskCreate,
  taskEdit,
  taskExports,
  taskListLookups,
  taskCreateLookups,
  taskEditLookups,
  projectEnvVar,
  ownerEnvVar,
  webReference,
  prettyScreenKind
}) {
  const files = {};
  const editTaskVisibility = taskDetail.visibility?.find((entry) => entry.capability?.id === "cap_update_task") || null;
  const completeTaskVisibility = taskDetail.visibility?.find((entry) => entry.capability?.id === "cap_complete_task") || null;
  const deleteTaskVisibility = taskDetail.visibility?.find((entry) => entry.capability?.id === "cap_delete_task") || null;

  files["tasks/+page.server.ts"] = `import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { exportTasks } from "$lib/api/client";

export const actions: Actions = {
${renderSvelteKitRedirectingAction({
  actionName: "export",
  signature: "{ request, fetch }",
  prelude: `const form = await request.formData();
const payload = {
  project_id: String(form.get("project_id") || "") || undefined,
  owner_id: String(form.get("owner_id") || "") || undefined,
  status: String(form.get("status") || "") || undefined
};

let job;`,
  tryStatement: "job = await exportTasks(fetch, payload);",
  catchReturn:
    'return fail(400, { exportError: error instanceof Error ? error.message : "Unable to start export", exportValues: payload });',
  successStatement: "throw redirect(303, `/task-exports/${job.job_id}`);"
})}
};
`;

  files["tasks/+page.ts"] = `import type { PageLoad } from "./$types";
import { listTasks } from "$lib/api/client";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch, url }) => {
  const limit = url.searchParams.get("limit");
  const [result, projectOptions, ownerOptions] = await Promise.all([
    listTasks(fetch, {
      project_id: url.searchParams.get("project_id") ?? undefined,
      owner_id: url.searchParams.get("owner_id") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      after: url.searchParams.get("after") ?? undefined,
      limit: limit ? Number(limit) : undefined
    }),
    ${taskListLookups.project_id?.route ? `listLookupOptions(fetch, "${taskListLookups.project_id.route}")` : "Promise.resolve([])"},
    ${taskListLookups.owner_id?.route ? `listLookupOptions(fetch, "${taskListLookups.owner_id.route}")` : "Promise.resolve([])"}
  ]);
  return {
    screen: ${JSON.stringify({ id: taskList.id, title: taskList.title, collection: taskList.collection, web: taskList.web }, null, 2)},
    filters: {
      project_id: url.searchParams.get("project_id") ?? "",
      owner_id: url.searchParams.get("owner_id") ?? "",
      status: url.searchParams.get("status") ?? "",
      limit: limit ?? ""
    },
    lookups: {
      project_id: projectOptions,
      owner_id: ownerOptions
    },
    result
  };
};
`;

  files["tasks/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
  export let form;

  const buildNextHref = () => {
    if (!data.result.next_cursor) return null;
    const params = new URLSearchParams();
    if (data.filters.project_id) params.set("project_id", data.filters.project_id);
    if (data.filters.owner_id) params.set("owner_id", data.filters.owner_id);
    if (data.filters.status) params.set("status", data.filters.status);
    if (data.filters.limit) params.set("limit", String(data.filters.limit));
    params.set("after", data.result.next_cursor);
    return \`/tasks?\${params.toString()}\`;
  };

  const nextHref = buildNextHref();
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>${taskList.title || taskList.id}</h1>
          <p>This ${prettyScreenKind(taskList.kind)} screen was generated from \`${taskList.id}\`.</p>
        </div>
        <a class="button-link" href="/tasks/new">Create Task</a>
      </div>

      <form class="filters" method="GET">
        <label>
          Project
          <select name="project_id">
            <option value="">${taskListLookups.project_id?.emptyLabel || "All projects"}</option>
            {#each data.lookups.project_id as option}
              <option value={option.value} selected={option.value === (data.filters.project_id ?? "")}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Owner
          <select name="owner_id">
            <option value="">${taskListLookups.owner_id?.emptyLabel || "All owners"}</option>
            {#each data.lookups.owner_id as option}
              <option value={option.value} selected={option.value === (data.filters.owner_id ?? "")}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Status
          <input name="status" value={data.filters.status ?? ""} />
        </label>
        <label>
          Limit
          <input name="limit" type="number" min="1" value={data.filters.limit ?? ""} />
        </label>
        <div class="button-row">
          <button type="submit">Apply Filters</button>
          <a class="button-link secondary" href="/tasks">Reset</a>
        </div>
      </form>

      <form method="POST" action="?/export">
        <input type="hidden" name="project_id" value={data.filters.project_id ?? ""} />
        <input type="hidden" name="owner_id" value={data.filters.owner_id ?? ""} />
        <input type="hidden" name="status" value={data.filters.status ?? ""} />
        <div class="button-row">
          <button type="submit">Start Export</button>
          {#if form?.exportError}<span class="muted">{form.exportError}</span>{/if}
        </div>
      </form>

      {#if data.result.items.length === 0}
        <div class="empty-state">
          <p><strong>${taskList.emptyState?.title || "No items"}</strong></p>
          <p class="muted">${taskList.emptyState?.body || ""}</p>
        </div>
      {:else}
        <p class="muted">Showing {data.result.items.length} task{data.result.items.length === 1 ? "" : "s"}.</p>
        <ul class="task-list">
          {#each data.result.items as task}
            <li>
              <div class="task-meta">
                <a href={'/tasks/' + task.id}><strong>{task.title}</strong></a>
                {#if task.description}<span class="muted">{task.description}</span>{/if}
                <span class="muted">Priority: {task.priority ?? "medium"}</span>
              </div>
              <div class="button-row">
                <span class="badge">{task.priority ?? "medium"}</span>
                <span class="badge">{task.status}</span>
              </div>
            </li>
          {/each}
        </ul>
        {#if nextHref}
          <p><a class="button-link secondary" href={nextHref}>Next Page</a></p>
        {/if}
      {/if}
    </section>
  </div>
</main>
`;

  files["tasks/[id]/+page.server.ts"] = `import { randomUUID } from "node:crypto";
import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { completeTask, deleteTask } from "$lib/api/client";

export const actions: Actions = {
${renderSvelteKitRedirectingAction({
  actionName: "complete",
  signature: "{ request, fetch, params }",
  prelude: `const form = await request.formData();
const updated_at = String(form.get("updated_at") || "");
const completed_at = String(form.get("completed_at") || "") || new Date().toISOString();
if (!updated_at) {
  return fail(400, { actionError: "updated_at is required to complete this task." });
}`,
  tryStatement: `await completeTask(fetch, params.id, { completed_at }, {
  headers: {
    "If-Match": updated_at,
    "Idempotency-Key": randomUUID()
  }
});`,
  catchReturn: 'return fail(400, { actionError: error instanceof Error ? error.message : "Unable to complete task" });',
  successStatement: "throw redirect(303, `/tasks/${params.id}`);"
})},
${renderSvelteKitRedirectingAction({
  actionName: "delete",
  signature: "{ request, fetch, params }",
  prelude: `const form = await request.formData();
const updated_at = String(form.get("updated_at") || "");
if (!updated_at) {
  return fail(400, { actionError: "updated_at is required to delete this task." });
}`,
  tryStatement: `await deleteTask(fetch, params.id, {
  headers: {
    "If-Match": updated_at
  }
});`,
  catchReturn: 'return fail(400, { actionError: error instanceof Error ? error.message : "Unable to delete task" });',
  successStatement: 'throw redirect(303, "/tasks");'
})}
};
`;

  files["tasks/[id]/+page.ts"] = `import type { PageLoad } from "./$types";
import { getTask } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params, url }) => {
  return {
    screen: ${JSON.stringify({ id: taskDetail.id, title: taskDetail.title, web: taskDetail.web }, null, 2)},
    task: await getTask(fetch, params.id),
    visibilityDebug: {
      userId: url.searchParams.get("topogram_auth_user_id") ?? "",
      permissions: url.searchParams.get("topogram_auth_permissions") ?? "",
      isAdmin: url.searchParams.get("topogram_auth_admin") ?? ""
    }
  };
};
`;

  files["tasks/[id]/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  import { canShowAction } from "$lib/auth/visibility";

  export let data;
  export let form;

  const editTaskVisibility = ${JSON.stringify(editTaskVisibility, null, 2)};
  const completeTaskVisibility = ${JSON.stringify(completeTaskVisibility, null, 2)};
  const deleteTaskVisibility = ${JSON.stringify(deleteTaskVisibility, null, 2)};

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
          <p>This ${prettyScreenKind(taskDetail.kind)} screen was generated from \`${taskDetail.id}\`.</p>
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
`;

  files["tasks/new/+page.ts"] = `import type { PageLoad } from "./$types";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch }) => {
  const [projectOptions, ownerOptions] = await Promise.all([
    ${taskCreateLookups.project_id?.route ? `listLookupOptions(fetch, "${taskCreateLookups.project_id.route}")` : "Promise.resolve([])"},
    ${taskCreateLookups.owner_id?.route ? `listLookupOptions(fetch, "${taskCreateLookups.owner_id.route}")` : "Promise.resolve([])"}
  ]);

  return {
    lookups: {
      project_id: projectOptions,
      owner_id: ownerOptions
    }
  };
};
`;

  files["tasks/new/+page.server.ts"] = `import { randomUUID } from "node:crypto";
import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { createTask } from "$lib/api/client";

export const actions: Actions = {
${renderSvelteKitRedirectingAction({
  actionName: "default",
  signature: "{ request, fetch }",
  prelude: `const form = await request.formData();
const payload = {
  title: String(form.get("title") || ""),
  description: String(form.get("description") || "") || undefined,
  priority: String(form.get("priority") || "") || undefined,
  owner_id: String(form.get("owner_id") || "") || undefined,
  project_id: String(form.get("project_id") || ""),
  due_at: String(form.get("due_at") || "") || undefined
};

if (!payload.title || !payload.project_id) {
  return fail(400, { error: "Title and project are required.", values: payload });
}

let created;`,
  tryStatement: `created = await createTask(fetch, payload, {
  headers: {
    "Idempotency-Key": randomUUID()
  }
});`,
  catchReturn:
    'return fail(400, { error: error instanceof Error ? error.message : "Unable to create task", values: payload });',
  successStatement: "throw redirect(303, `/tasks/${created.id}`);"
})}
};
`;

  files["tasks/new/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  import { ${projectEnvVar} as DEMO_PROJECT_ID, ${ownerEnvVar} as DEMO_USER_ID } from "$env/static/public";

  export let data;
  export let form;

  const values = {
    title: form?.values?.title ?? "",
    description: form?.values?.description ?? "",
    priority: form?.values?.priority ?? "medium",
    owner_id: form?.values?.owner_id ?? DEMO_USER_ID ?? "",
    project_id: form?.values?.project_id ?? DEMO_PROJECT_ID ?? "",
    due_at: form?.values?.due_at ?? ""
  };
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>${taskCreate.title || taskCreate.id}</h1>
      <p>This ${prettyScreenKind(taskCreate.kind)} screen was generated from \`${taskCreate.id}\`.</p>
      <p class="muted">${webReference.createPrimary.helperText}</p>
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
            <option value="">${taskCreateLookups.owner_id?.emptyLabel || "Unassigned"}</option>
            {#each data.lookups.owner_id as option}
              <option value={option.value} selected={option.value === values.owner_id}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Project
          <select name="project_id" required>
            <option value="">${webReference.createPrimary.projectPlaceholder}</option>
            {#each data.lookups.project_id as option}
              <option value={option.value} selected={option.value === values.project_id}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>Due At <input name="due_at" type="datetime-local" value={values.due_at} /></label>
        <div class="button-row">
          <button type="submit">${webReference.createPrimary.submitLabel}</button>
          <a class="button-link secondary" href="/tasks">${webReference.createPrimary.cancelLabel}</a>
        </div>
      </form>
    </section>
  </div>
</main>
`;

  files["tasks/[id]/edit/+page.ts"] = `import type { PageLoad } from "./$types";
import { getTask } from "$lib/api/client";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch, params }) => {
  const [task, ownerOptions] = await Promise.all([
    getTask(fetch, params.id),
    ${taskEditLookups.owner_id?.route ? `listLookupOptions(fetch, "${taskEditLookups.owner_id.route}")` : "Promise.resolve([])"}
  ]);
  return {
    screen: ${JSON.stringify({ id: taskEdit.id, title: taskEdit.title, web: taskEdit.web }, null, 2)},
    task,
    lookups: {
      owner_id: ownerOptions
    },
    values: {
      title: task.title ?? "",
      description: task.description ?? "",
      priority: task.priority ?? "medium",
      owner_id: task.owner_id ?? "",
      due_at: task.due_at ? String(task.due_at).slice(0, 16) : "",
      status: task.status ?? ""
    }
  };
};
`;

  files["tasks/[id]/edit/+page.server.ts"] = `import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { updateTask } from "$lib/api/client";

export const actions: Actions = {
${renderSvelteKitRedirectingAction({
  actionName: "default",
  signature: "{ request, fetch, params }",
  prelude: `const form = await request.formData();
const updated_at = String(form.get("updated_at") || "");
const payload = {
  title: String(form.get("title") || "") || undefined,
  description: String(form.get("description") || "") || undefined,
  priority: String(form.get("priority") || "") || undefined,
  owner_id: String(form.get("owner_id") || "") || undefined,
  due_at: String(form.get("due_at") || "") || undefined,
  status: String(form.get("status") || "") || undefined
};

if (!updated_at) {
  return fail(400, { error: "updated_at is required to update this task.", values: payload });
}`,
  tryStatement: `await updateTask(fetch, params.id, payload, {
  headers: {
    "If-Match": updated_at
  }
});`,
  catchReturn:
    'return fail(400, { error: error instanceof Error ? error.message : "Unable to update task", values: payload });',
  successStatement: "throw redirect(303, `/tasks/${params.id}`);"
})}
};
`;

  files["tasks/[id]/edit/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
  export let form;

  const values = form?.values ?? data.values;
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>${taskEdit.title || "Edit Task"}</h1>
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
            <option value="">${taskEditLookups.owner_id?.emptyLabel || "Unassigned"}</option>
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
`;

  files["task-exports/[job_id]/+page.ts"] = `import type { PageLoad } from "./$types";
import { getTaskExportJob } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  try {
    return {
      screen: ${JSON.stringify({ id: taskExports.id, title: taskExports.title, web: taskExports.web }, null, 2)},
      job: await getTaskExportJob(fetch, params.job_id),
      notFound: false
    };
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      return {
        screen: ${JSON.stringify({ id: taskExports.id, title: taskExports.title, web: taskExports.web }, null, 2)},
        job: null,
        notFound: true
      };
    }
    throw error;
  }
};
`;

  files["task-exports/[job_id]/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>${taskExports.title || taskExports.id}</h1>
      <p>This ${prettyScreenKind(taskExports.kind)} screen was generated from \`${taskExports.id}\`.</p>
      {#if data.notFound}
        <p>No export job was found for this id yet.</p>
        <p class="muted">Start an export from a future generated action or revisit this page with a valid job id.</p>
      {:else}
        <dl class="definition-list">
          <dt>Status</dt><dd><span class="badge">{data.job.status}</span></dd>
          <dt>Submitted</dt><dd>{data.job.submitted_at}</dd>
          {#if data.job.completed_at}<dt>Completed</dt><dd>{data.job.completed_at}</dd>{/if}
          {#if data.job.error_message}<dt>Error</dt><dd>{data.job.error_message}</dd>{/if}
        </dl>
        {#if data.job.download_url}
          <p><a class="button-link" href={data.job.download_url}>Download Export</a></p>
        {/if}
      {/if}
    </section>
  </div>
</main>
`;

  const projectList = contract?.screens?.find((screen) => screen.id === TODO_WEB_SCREEN_REFERENCE.projectListScreenId);
  const projectDetail = contract?.screens?.find((screen) => screen.id === TODO_WEB_SCREEN_REFERENCE.projectDetailScreenId);
  const projectCreate = contract?.screens?.find((screen) => screen.id === TODO_WEB_SCREEN_REFERENCE.projectCreateScreenId);
  const projectEdit = contract?.screens?.find((screen) => screen.id === TODO_WEB_SCREEN_REFERENCE.projectEditScreenId);
  const userList = contract?.screens?.find((screen) => screen.id === TODO_WEB_SCREEN_REFERENCE.userListScreenId);
  const userDetail = contract?.screens?.find((screen) => screen.id === TODO_WEB_SCREEN_REFERENCE.userDetailScreenId);
  const userCreate = contract?.screens?.find((screen) => screen.id === TODO_WEB_SCREEN_REFERENCE.userCreateScreenId);
  const userEdit = contract?.screens?.find((screen) => screen.id === TODO_WEB_SCREEN_REFERENCE.userEditScreenId);

  if (projectList && projectDetail && projectCreate && projectEdit) {
    files["projects/+page.ts"] = `import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, url }) => {
  const limit = url.searchParams.get("limit");
  return {
    screen: ${JSON.stringify({ id: projectList.id, title: projectList.title, collection: projectList.collection, web: projectList.web }, null, 2)},
    filters: {
      limit: limit ?? ""
    },
    result: await requestCapability(fetch, "cap_list_projects", {
      after: url.searchParams.get("after") ?? undefined,
      limit: limit ? Number(limit) : undefined
    })
  };
};
`;

    files["projects/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;

  const buildNextHref = () => {
    if (!data.result.next_cursor) return null;
    const params = new URLSearchParams();
    if (data.filters.limit) params.set("limit", String(data.filters.limit));
    params.set("after", data.result.next_cursor);
    return \`/projects?\${params.toString()}\`;
  };

  const nextHref = buildNextHref();
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>${projectList.title || projectList.id}</h1>
          <p>This ${prettyScreenKind(projectList.kind)} screen was generated from \`${projectList.id}\`.</p>
        </div>
        <a class="button-link" href="/projects/new">Create Project</a>
      </div>

      {#if data.result.items.length === 0}
        <div class="empty-state">
          <p><strong>${projectList.emptyState?.title || "No projects yet"}</strong></p>
          <p class="muted">${projectList.emptyState?.body || ""}</p>
        </div>
      {:else}
        <ul class="task-list resource-list">
          {#each data.result.items as project}
            <li>
              <div class="task-meta resource-meta">
                <a href={'/projects/' + project.id}><strong>{project.name}</strong></a>
                {#if project.description}<span class="muted">{project.description}</span>{/if}
                <span class="muted">Owner: {project.owner_id || "Unassigned"}</span>
              </div>
              <span class="badge">{project.status}</span>
            </li>
          {/each}
        </ul>
        {#if nextHref}
          <p><a class="button-link secondary" href={nextHref}>Next Page</a></p>
        {/if}
      {/if}
    </section>
  </div>
</main>
`;

    files["projects/[id]/+page.ts"] = `import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  return {
    screen: ${JSON.stringify({ id: projectDetail.id, title: projectDetail.title, web: projectDetail.web }, null, 2)},
    project: await requestCapability(fetch, "cap_get_project", { project_id: params.id })
  };
};
`;

    files["projects/[id]/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>{data.project.name}</h1>
          <p>This ${prettyScreenKind(projectDetail.kind)} screen was generated from \`${projectDetail.id}\`.</p>
        </div>
        <span class="badge">{data.project.status}</span>
      </div>

      {#if data.project.description}
        <p>{data.project.description}</p>
      {:else}
        <p class="muted">No description was provided for this project.</p>
      {/if}

      <dl class="definition-list">
        <dt>Project ID</dt><dd>{data.project.id}</dd>
        <dt>Status</dt><dd>{data.project.status}</dd>
        <dt>Owner</dt><dd>{data.project.owner_id || "Unassigned"}</dd>
        <dt>Created</dt><dd>{data.project.created_at}</dd>
      </dl>

      <div class="button-row">
        <a class="button-link secondary" href="/projects">Back to Projects</a>
        <a class="button-link" href={"/projects/" + data.project.id + "/edit"}>Edit Project</a>
      </div>
    </section>
  </div>
</main>
`;

    files["projects/new/+page.ts"] = `import type { PageLoad } from "./$types";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch }) => {
  return {
    lookups: {
      owner_id: await listLookupOptions(fetch, "/lookups/users")
    }
  };
};
`;

    files["projects/new/+page.server.ts"] = `import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { requestCapability } from "$lib/api/client";

export const actions: Actions = {
${renderSvelteKitRedirectingAction({
  actionName: "default",
  signature: "{ request, fetch }",
  prelude: `const form = await request.formData();
const payload = {
  name: String(form.get("name") || ""),
  description: String(form.get("description") || "") || undefined,
  status: String(form.get("status") || "") || "active",
  owner_id: String(form.get("owner_id") || "") || undefined
};

if (!payload.name) {
  return fail(400, { error: "Name is required.", values: payload });
}

let created;`,
  tryStatement: `created = await requestCapability(fetch, "cap_create_project", payload);`,
  catchReturn:
    'return fail(400, { error: error instanceof Error ? error.message : "Unable to create project", values: payload });',
  successStatement: "throw redirect(303, `/projects/${created.id}`);"
})}
};
`;

    files["projects/new/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
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
      <h1>${projectCreate.title || projectCreate.id}</h1>
      <p>This ${prettyScreenKind(projectCreate.kind)} screen was generated from \`${projectCreate.id}\`.</p>
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
`;

    files["projects/[id]/edit/+page.ts"] = `import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch, params }) => {
  const [project, ownerOptions] = await Promise.all([
    requestCapability(fetch, "cap_get_project", { project_id: params.id }),
    listLookupOptions(fetch, "/lookups/users")
  ]);
  return {
    screen: ${JSON.stringify({ id: projectEdit.id, title: projectEdit.title, web: projectEdit.web }, null, 2)},
    project,
    lookups: {
      owner_id: ownerOptions
    },
    values: {
      name: project.name ?? "",
      description: project.description ?? "",
      status: project.status ?? "active",
      owner_id: project.owner_id ?? ""
    }
  };
};
`;

    files["projects/[id]/edit/+page.server.ts"] = `import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { requestCapability } from "$lib/api/client";

export const actions: Actions = {
${renderSvelteKitRedirectingAction({
  actionName: "default",
  signature: "{ request, fetch, params }",
  prelude: `const form = await request.formData();
const payload = {
  name: String(form.get("name") || "") || undefined,
  description: String(form.get("description") || "") || undefined,
  status: String(form.get("status") || "") || undefined,
  owner_id: String(form.get("owner_id") || "") || undefined
};`,
  tryStatement: `await requestCapability(fetch, "cap_update_project", { project_id: params.id, ...payload });`,
  catchReturn:
    'return fail(400, { error: error instanceof Error ? error.message : "Unable to update project", values: payload });',
  successStatement: "throw redirect(303, `/projects/${params.id}`);"
})}
};
`;

    files["projects/[id]/edit/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
  export let form;

  const values = form?.values ?? data.values;
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>${projectEdit.title || "Edit Project"}</h1>
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
`;
  }

  if (userList && userDetail && userCreate && userEdit) {
    files["users/+page.ts"] = `import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, url }) => {
  const limit = url.searchParams.get("limit");
  return {
    screen: ${JSON.stringify({ id: userList.id, title: userList.title, collection: userList.collection, web: userList.web }, null, 2)},
    filters: {
      limit: limit ?? ""
    },
    result: await requestCapability(fetch, "cap_list_users", {
      after: url.searchParams.get("after") ?? undefined,
      limit: limit ? Number(limit) : undefined
    })
  };
};
`;

    files["users/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;

  const buildNextHref = () => {
    if (!data.result.next_cursor) return null;
    const params = new URLSearchParams();
    if (data.filters.limit) params.set("limit", String(data.filters.limit));
    params.set("after", data.result.next_cursor);
    return \`/users?\${params.toString()}\`;
  };

  const nextHref = buildNextHref();
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>${userList.title || userList.id}</h1>
          <p>This ${prettyScreenKind(userList.kind)} screen was generated from \`${userList.id}\`.</p>
        </div>
        <a class="button-link" href="/users/new">Create User</a>
      </div>

      {#if data.result.items.length === 0}
        <div class="empty-state">
          <p><strong>${userList.emptyState?.title || "No users yet"}</strong></p>
          <p class="muted">${userList.emptyState?.body || ""}</p>
        </div>
      {:else}
        <ul class="task-list resource-list">
          {#each data.result.items as user}
            <li>
              <div class="task-meta resource-meta">
                <a href={'/users/' + user.id}><strong>{user.display_name}</strong></a>
                <span class="muted">{user.email}</span>
              </div>
              <span class="badge">{user.is_active ? "active" : "inactive"}</span>
            </li>
          {/each}
        </ul>
        {#if nextHref}
          <p><a class="button-link secondary" href={nextHref}>Next Page</a></p>
        {/if}
      {/if}
    </section>
  </div>
</main>
`;

    files["users/[id]/+page.ts"] = `import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  return {
    screen: ${JSON.stringify({ id: userDetail.id, title: userDetail.title, web: userDetail.web }, null, 2)},
    user: await requestCapability(fetch, "cap_get_user", { user_id: params.id })
  };
};
`;

    files["users/[id]/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>{data.user.display_name}</h1>
          <p>This ${prettyScreenKind(userDetail.kind)} screen was generated from \`${userDetail.id}\`.</p>
        </div>
        <span class="badge">{data.user.is_active ? "active" : "inactive"}</span>
      </div>

      <dl class="definition-list">
        <dt>User ID</dt><dd>{data.user.id}</dd>
        <dt>Email</dt><dd>{data.user.email}</dd>
        <dt>Display Name</dt><dd>{data.user.display_name}</dd>
        <dt>Created</dt><dd>{data.user.created_at}</dd>
      </dl>

      <div class="button-row">
        <a class="button-link secondary" href="/users">Back to Users</a>
        <a class="button-link" href={"/users/" + data.user.id + "/edit"}>Edit User</a>
      </div>
    </section>
  </div>
</main>
`;

    files["users/new/+page.server.ts"] = `import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { requestCapability } from "$lib/api/client";

export const actions: Actions = {
${renderSvelteKitRedirectingAction({
  actionName: "default",
  signature: "{ request, fetch }",
  prelude: `const form = await request.formData();
const payload = {
  email: String(form.get("email") || ""),
  display_name: String(form.get("display_name") || ""),
  is_active: form.get("is_active") === "true"
};

if (!payload.email || !payload.display_name) {
  return fail(400, { error: "Email and display name are required.", values: payload });
}

let created;`,
  tryStatement: `created = await requestCapability(fetch, "cap_create_user", payload);`,
  catchReturn:
    'return fail(400, { error: error instanceof Error ? error.message : "Unable to create user", values: payload });',
  successStatement: "throw redirect(303, `/users/${created.id}`);"
})}
};
`;

    files["users/new/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let form;

  const values = {
    email: form?.values?.email ?? "",
    display_name: form?.values?.display_name ?? "",
    is_active: form?.values?.is_active ?? true
  };
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>${userCreate.title || userCreate.id}</h1>
      <p>This ${prettyScreenKind(userCreate.kind)} screen was generated from \`${userCreate.id}\`.</p>
      {#if form?.error}<p><strong>{form.error}</strong></p>{/if}
      <form class="stack" method="POST">
        <label>Email <input name="email" type="email" required value={values.email} /></label>
        <label>Display Name <input name="display_name" required value={values.display_name} /></label>
        <label>
          Active
          <select name="is_active">
            <option value="true" selected={values.is_active === true}>active</option>
            <option value="false" selected={values.is_active === false}>inactive</option>
          </select>
        </label>
        <div class="button-row">
          <button type="submit">Create User</button>
          <a class="button-link secondary" href="/users">Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>
`;

    files["users/[id]/edit/+page.ts"] = `import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  const user = await requestCapability(fetch, "cap_get_user", { user_id: params.id });
  return {
    screen: ${JSON.stringify({ id: userEdit.id, title: userEdit.title, web: userEdit.web }, null, 2)},
    user,
    values: {
      email: user.email ?? "",
      display_name: user.display_name ?? "",
      is_active: user.is_active ?? true
    }
  };
};
`;

    files["users/[id]/edit/+page.server.ts"] = `import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { requestCapability } from "$lib/api/client";

export const actions: Actions = {
${renderSvelteKitRedirectingAction({
  actionName: "default",
  signature: "{ request, fetch, params }",
  prelude: `const form = await request.formData();
const payload = {
  email: String(form.get("email") || "") || undefined,
  display_name: String(form.get("display_name") || "") || undefined,
  is_active: form.get("is_active") === "true"
};`,
  tryStatement: `await requestCapability(fetch, "cap_update_user", { user_id: params.id, ...payload });`,
  catchReturn:
    'return fail(400, { error: error instanceof Error ? error.message : "Unable to update user", values: payload });',
  successStatement: "throw redirect(303, `/users/${params.id}`);"
})}
};
`;

    files["users/[id]/edit/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
  export let form;

  const values = form?.values ?? data.values;
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>${userEdit.title || "Edit User"}</h1>
      <p>Update the mutable fields for <strong>{data.user.display_name}</strong>.</p>
      {#if form?.error}<p><strong>{form.error}</strong></p>{/if}
      <form class="stack" method="POST">
        <label>Email <input name="email" type="email" value={values.email ?? ""} /></label>
        <label>Display Name <input name="display_name" value={values.display_name ?? ""} /></label>
        <label>
          Active
          <select name="is_active">
            <option value="true" selected={(values.is_active ?? data.user.is_active) === true}>active</option>
            <option value="false" selected={(values.is_active ?? data.user.is_active) === false}>inactive</option>
          </select>
        </label>
        <div class="button-row">
          <button type="submit">Save Changes</button>
          <a class="button-link secondary" href={"/users/" + data.user.id}>Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>
`;
  }

  return files;
}

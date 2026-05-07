import { renderSvelteKitRedirectingAction } from "../../../../../../src/generator/surfaces/web/sveltekit-actions.js";
import {
  renderSvelteKitComponentRegion
} from "../../../../../../src/generator/surfaces/web/sveltekit-components.js";
import { APP_BASIC_WEB_SCREEN_REFERENCE } from "./screens-reference.js";

export function renderAppBasicHomePage({
  useTypescript,
  demoPrimaryEnvVar,
  screens,
  projectionName,
  homeDescription,
  webReference
}) {
  return `<script${useTypescript ? ' lang="ts"' : ""}>
  import { ${demoPrimaryEnvVar} as DEMO_ITEM_ID } from "$env/static/public";

  const screens = ${JSON.stringify(screens, null, 2)};
  const demoItemRoute = DEMO_ITEM_ID ? \`/items/\${DEMO_ITEM_ID}\` : null;
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
        {#if demoItemRoute}
          <a class="button-link secondary" href={demoItemRoute}>${webReference.home.demoItemLabel}</a>
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

export function renderAppBasicItemRoutes({
  useTypescript,
  contract,
  primaryList: itemList,
  primaryDetail: itemDetail,
  primaryCreate: itemCreate,
  primaryEdit: itemEdit,
  primaryExports: itemExports,
  primaryListLookups: itemListLookups,
  primaryCreateLookups: itemCreateLookups,
  primaryEditLookups: itemEditLookups,
  containerEnvVar: collectionEnvVar,
  ownerEnvVar,
  webReference,
  prettyScreenKind
}) {
  const files = {};
  const editItemVisibility = itemDetail.visibility?.find((entry) => entry.capability?.id === "cap_update_item") || null;
  const completeItemVisibility = itemDetail.visibility?.find((entry) => entry.capability?.id === "cap_complete_item") || null;
  const deleteItemVisibility = itemDetail.visibility?.find((entry) => entry.capability?.id === "cap_delete_item") || null;
  const itemListHeroComponents = renderSvelteKitComponentRegion(itemList, "hero", {
    componentContracts: contract.components,
    itemsExpression: "data.result.items",
    useTypescript
  });
  const itemListResultsComponents = renderSvelteKitComponentRegion(itemList, "results", {
    componentContracts: contract.components,
    itemsExpression: "data.result.items",
    useTypescript
  });
  const itemListDefaultResults = `<ul class="item-list resource-list">
          {#each data.result.items as item}
            <li>
              <div class="item-meta resource-meta">
                <a href={'/items/' + item.id}><strong>{item.title}</strong></a>
                {#if item.description}<span class="muted">{item.description}</span>{/if}
                <span class="muted">Priority: {item.priority ?? "medium"}</span>
              </div>
              <div class="button-row">
                <span class="badge">{item.priority ?? "medium"}</span>
                <span class="badge">{item.status}</span>
              </div>
            </li>
          {/each}
        </ul>`;

  files["items/+page.server.ts"] = `import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { exportItems } from "$lib/api/client";

export const actions: Actions = {
${renderSvelteKitRedirectingAction({
  actionName: "export",
  signature: "{ request, fetch }",
  prelude: `const form = await request.formData();
const payload = {
  collection_id: String(form.get("collection_id") || "") || undefined,
  owner_id: String(form.get("owner_id") || "") || undefined,
  status: String(form.get("status") || "") || undefined
};

let job;`,
  tryStatement: "job = await exportItems(fetch, payload);",
  catchReturn:
    'return fail(400, { exportError: error instanceof Error ? error.message : "Unable to start export", exportValues: payload });',
  successStatement: "throw redirect(303, `/item-exports/${job.job_id}`);"
})}
};
`;

  files["items/+page.ts"] = `import type { PageLoad } from "./$types";
import { listItems } from "$lib/api/client";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch, url }) => {
  const limit = url.searchParams.get("limit");
  const [result, collectionOptions, ownerOptions] = await Promise.all([
    listItems(fetch, {
      collection_id: url.searchParams.get("collection_id") ?? undefined,
      owner_id: url.searchParams.get("owner_id") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      after: url.searchParams.get("after") ?? undefined,
      limit: limit ? Number(limit) : undefined
    }),
    ${itemListLookups.collection_id?.route ? `listLookupOptions(fetch, "${itemListLookups.collection_id.route}")` : "Promise.resolve([])"},
    ${itemListLookups.owner_id?.route ? `listLookupOptions(fetch, "${itemListLookups.owner_id.route}")` : "Promise.resolve([])"}
  ]);
  return {
    screen: ${JSON.stringify({ id: itemList.id, title: itemList.title, collection: itemList.collection, web: itemList.web }, null, 2)},
    filters: {
      collection_id: url.searchParams.get("collection_id") ?? "",
      owner_id: url.searchParams.get("owner_id") ?? "",
      status: url.searchParams.get("status") ?? "",
      limit: limit ?? ""
    },
    lookups: {
      collection_id: collectionOptions,
      owner_id: ownerOptions
    },
    result
  };
};
`;

  files["items/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
  export let form;

  const buildNextHref = () => {
    if (!data.result.next_cursor) return null;
    const params = new URLSearchParams();
    if (data.filters.collection_id) params.set("collection_id", data.filters.collection_id);
    if (data.filters.owner_id) params.set("owner_id", data.filters.owner_id);
    if (data.filters.status) params.set("status", data.filters.status);
    if (data.filters.limit) params.set("limit", String(data.filters.limit));
    params.set("after", data.result.next_cursor);
    return \`/items?\${params.toString()}\`;
  };

  const nextHref = buildNextHref();
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>${itemList.title || itemList.id}</h1>
          <p>This ${prettyScreenKind(itemList.kind)} screen was generated from \`${itemList.id}\`.</p>
        </div>
        <a class="button-link" href="/items/new">Create Item</a>
      </div>
${itemListHeroComponents ? `\n      ${itemListHeroComponents}\n` : ""}

      <form class="filters" method="GET">
        <label>
          Collection
          <select name="collection_id">
            <option value="">${itemListLookups.collection_id?.emptyLabel || "All collections"}</option>
            {#each data.lookups.collection_id as option}
              <option value={option.value} selected={option.value === (data.filters.collection_id ?? "")}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Owner
          <select name="owner_id">
            <option value="">${itemListLookups.owner_id?.emptyLabel || "All owners"}</option>
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
          <a class="button-link secondary" href="/items">Reset</a>
        </div>
      </form>

      <form method="POST" action="?/export">
        <input type="hidden" name="collection_id" value={data.filters.collection_id ?? ""} />
        <input type="hidden" name="owner_id" value={data.filters.owner_id ?? ""} />
        <input type="hidden" name="status" value={data.filters.status ?? ""} />
        <div class="button-row">
          <button type="submit">Start Export</button>
          {#if form?.exportError}<span class="muted">{form.exportError}</span>{/if}
        </div>
      </form>

      {#if data.result.items.length === 0}
        <div class="empty-state">
          <p><strong>${itemList.emptyState?.title || "No items"}</strong></p>
          <p class="muted">${itemList.emptyState?.body || ""}</p>
        </div>
      {:else}
        <p class="muted">Showing {data.result.items.length} item{data.result.items.length === 1 ? "" : "s"}.</p>
        ${itemListResultsComponents || itemListDefaultResults}
        {#if nextHref}
          <p><a class="button-link secondary" href={nextHref}>Next Page</a></p>
        {/if}
      {/if}
    </section>
  </div>
</main>
`;

  files["items/[id]/+page.server.ts"] = `import { randomUUID } from "node:crypto";
import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { completeItem, deleteItem } from "$lib/api/client";

export const actions: Actions = {
${renderSvelteKitRedirectingAction({
  actionName: "complete",
  signature: "{ request, fetch, params }",
  prelude: `const form = await request.formData();
const updated_at = String(form.get("updated_at") || "");
const completed_at = String(form.get("completed_at") || "") || new Date().toISOString();
if (!updated_at) {
  return fail(400, { actionError: "updated_at is required to complete this item." });
}`,
  tryStatement: `await completeItem(fetch, params.id, { completed_at }, {
  headers: {
    "If-Match": updated_at,
    "Idempotency-Key": randomUUID()
  }
});`,
  catchReturn: 'return fail(400, { actionError: error instanceof Error ? error.message : "Unable to complete item" });',
  successStatement: "throw redirect(303, `/items/${params.id}`);"
})},
${renderSvelteKitRedirectingAction({
  actionName: "delete",
  signature: "{ request, fetch, params }",
  prelude: `const form = await request.formData();
const updated_at = String(form.get("updated_at") || "");
if (!updated_at) {
  return fail(400, { actionError: "updated_at is required to delete this item." });
}`,
  tryStatement: `await deleteItem(fetch, params.id, {
  headers: {
    "If-Match": updated_at
  }
});`,
  catchReturn: 'return fail(400, { actionError: error instanceof Error ? error.message : "Unable to delete item" });',
  successStatement: 'throw redirect(303, "/items");'
})}
};
`;

  files["items/[id]/+page.ts"] = `import type { PageLoad } from "./$types";
import { getItem } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params, url }) => {
  return {
    screen: ${JSON.stringify({ id: itemDetail.id, title: itemDetail.title, web: itemDetail.web }, null, 2)},
    item: await getItem(fetch, params.id),
    visibilityDebug: {
      memberId: url.searchParams.get("topogram_auth_member_id") ?? "",
      permissions: url.searchParams.get("topogram_auth_permissions") ?? "",
      isAdmin: url.searchParams.get("topogram_auth_admin") ?? ""
    }
  };
};
`;

  files["items/[id]/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  import { canShowAction } from "$lib/auth/visibility";

  export let data;
  export let form;

  const editItemVisibility = ${JSON.stringify(editItemVisibility, null, 2)};
  const completeItemVisibility = ${JSON.stringify(completeItemVisibility, null, 2)};
  const deleteItemVisibility = ${JSON.stringify(deleteItemVisibility, null, 2)};

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
          <p>This ${prettyScreenKind(itemDetail.kind)} screen was generated from \`${itemDetail.id}\`.</p>
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
`;

  files["items/new/+page.ts"] = `import type { PageLoad } from "./$types";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch }) => {
  const [collectionOptions, ownerOptions] = await Promise.all([
    ${itemCreateLookups.collection_id?.route ? `listLookupOptions(fetch, "${itemCreateLookups.collection_id.route}")` : "Promise.resolve([])"},
    ${itemCreateLookups.owner_id?.route ? `listLookupOptions(fetch, "${itemCreateLookups.owner_id.route}")` : "Promise.resolve([])"}
  ]);

  return {
    lookups: {
      collection_id: collectionOptions,
      owner_id: ownerOptions
    }
  };
};
`;

  files["items/new/+page.server.ts"] = `import { randomUUID } from "node:crypto";
import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { createItem } from "$lib/api/client";

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
  collection_id: String(form.get("collection_id") || ""),
  due_at: String(form.get("due_at") || "") || undefined
};

if (!payload.title || !payload.collection_id) {
  return fail(400, { error: "Title and collection are required.", values: payload });
}

let created;`,
  tryStatement: `created = await createItem(fetch, payload, {
  headers: {
    "Idempotency-Key": randomUUID()
  }
});`,
  catchReturn:
    'return fail(400, { error: error instanceof Error ? error.message : "Unable to create item", values: payload });',
  successStatement: "throw redirect(303, `/items/${created.id}`);"
})}
};
`;

  files["items/new/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  import { ${collectionEnvVar} as DEMO_COLLECTION_ID, ${ownerEnvVar} as DEMO_MEMBER_ID } from "$env/static/public";

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
      <h1>${itemCreate.title || itemCreate.id}</h1>
      <p>This ${prettyScreenKind(itemCreate.kind)} screen was generated from \`${itemCreate.id}\`.</p>
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
            <option value="">${itemCreateLookups.owner_id?.emptyLabel || "Unassigned"}</option>
            {#each data.lookups.owner_id as option}
              <option value={option.value} selected={option.value === values.owner_id}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Collection
          <select name="collection_id" required>
            <option value="">${webReference.createPrimary.collectionPlaceholder}</option>
            {#each data.lookups.collection_id as option}
              <option value={option.value} selected={option.value === values.collection_id}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>Due At <input name="due_at" type="datetime-local" value={values.due_at} /></label>
        <div class="button-row">
          <button type="submit">${webReference.createPrimary.submitLabel}</button>
          <a class="button-link secondary" href="/items">${webReference.createPrimary.cancelLabel}</a>
        </div>
      </form>
    </section>
  </div>
</main>
`;

  files["items/[id]/edit/+page.ts"] = `import type { PageLoad } from "./$types";
import { getItem } from "$lib/api/client";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch, params }) => {
  const [item, ownerOptions] = await Promise.all([
    getItem(fetch, params.id),
    ${itemEditLookups.owner_id?.route ? `listLookupOptions(fetch, "${itemEditLookups.owner_id.route}")` : "Promise.resolve([])"}
  ]);
  return {
    screen: ${JSON.stringify({ id: itemEdit.id, title: itemEdit.title, web: itemEdit.web }, null, 2)},
    item,
    lookups: {
      owner_id: ownerOptions
    },
    values: {
      title: item.title ?? "",
      description: item.description ?? "",
      priority: item.priority ?? "medium",
      owner_id: item.owner_id ?? "",
      due_at: item.due_at ? String(item.due_at).slice(0, 16) : "",
      status: item.status ?? ""
    }
  };
};
`;

  files["items/[id]/edit/+page.server.ts"] = `import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { updateItem } from "$lib/api/client";

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
  return fail(400, { error: "updated_at is required to update this item.", values: payload });
}`,
  tryStatement: `await updateItem(fetch, params.id, payload, {
  headers: {
    "If-Match": updated_at
  }
});`,
  catchReturn:
    'return fail(400, { error: error instanceof Error ? error.message : "Unable to update item", values: payload });',
  successStatement: "throw redirect(303, `/items/${params.id}`);"
})}
};
`;

  files["items/[id]/edit/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
  export let form;

  const values = form?.values ?? data.values;
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>${itemEdit.title || "Edit Item"}</h1>
      <p>Update the mutable fields for <strong>{data.item.title}</strong>.</p>
      {#if form?.error}<p><strong>{form.error}</strong></p>{/if}
      <form class="stack" method="POST">
        <input type="hidden" name="updated_at" value={data.item.updated_at} />
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
            <option value="">${itemEditLookups.owner_id?.emptyLabel || "Unassigned"}</option>
            {#each data.lookups.owner_id as option}
              <option value={option.value} selected={option.value === (values.owner_id ?? "")}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>Due At <input name="due_at" type="datetime-local" value={values.due_at ?? ""} /></label>
        <label>
          Status
          <select name="status">
            <option value="">Keep current ({data.item.status})</option>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="completed">completed</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <div class="button-row">
          <button type="submit">Save Changes</button>
          <a class="button-link secondary" href={"/items/" + data.item.id}>Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>
`;

  files["item-exports/[job_id]/+page.ts"] = `import type { PageLoad } from "./$types";
import { getItemExportJob } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  try {
    return {
      screen: ${JSON.stringify({ id: itemExports.id, title: itemExports.title, web: itemExports.web }, null, 2)},
      job: await getItemExportJob(fetch, params.job_id),
      notFound: false
    };
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      return {
        screen: ${JSON.stringify({ id: itemExports.id, title: itemExports.title, web: itemExports.web }, null, 2)},
        job: null,
        notFound: true
      };
    }
    throw error;
  }
};
`;

  files["item-exports/[job_id]/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>${itemExports.title || itemExports.id}</h1>
      <p>This ${prettyScreenKind(itemExports.kind)} screen was generated from \`${itemExports.id}\`.</p>
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

  const collectionList = contract?.screens?.find((screen) => screen.id === APP_BASIC_WEB_SCREEN_REFERENCE.collectionListScreenId);
  const collectionDetail = contract?.screens?.find((screen) => screen.id === APP_BASIC_WEB_SCREEN_REFERENCE.collectionDetailScreenId);
  const collectionCreate = contract?.screens?.find((screen) => screen.id === APP_BASIC_WEB_SCREEN_REFERENCE.collectionCreateScreenId);
  const collectionEdit = contract?.screens?.find((screen) => screen.id === APP_BASIC_WEB_SCREEN_REFERENCE.collectionEditScreenId);
  const memberList = contract?.screens?.find((screen) => screen.id === APP_BASIC_WEB_SCREEN_REFERENCE.memberListScreenId);
  const memberDetail = contract?.screens?.find((screen) => screen.id === APP_BASIC_WEB_SCREEN_REFERENCE.memberDetailScreenId);
  const memberCreate = contract?.screens?.find((screen) => screen.id === APP_BASIC_WEB_SCREEN_REFERENCE.memberCreateScreenId);
  const memberEdit = contract?.screens?.find((screen) => screen.id === APP_BASIC_WEB_SCREEN_REFERENCE.memberEditScreenId);

  if (collectionList && collectionDetail && collectionCreate && collectionEdit) {
    files["collections/+page.ts"] = `import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, url }) => {
  const limit = url.searchParams.get("limit");
  return {
    screen: ${JSON.stringify({ id: collectionList.id, title: collectionList.title, collection: collectionList.collection, web: collectionList.web }, null, 2)},
    filters: {
      limit: limit ?? ""
    },
    result: await requestCapability(fetch, "cap_list_collections", {
      after: url.searchParams.get("after") ?? undefined,
      limit: limit ? Number(limit) : undefined
    })
  };
};
`;

    files["collections/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;

  const buildNextHref = () => {
    if (!data.result.next_cursor) return null;
    const params = new URLSearchParams();
    if (data.filters.limit) params.set("limit", String(data.filters.limit));
    params.set("after", data.result.next_cursor);
    return \`/collections?\${params.toString()}\`;
  };

  const nextHref = buildNextHref();
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>${collectionList.title || collectionList.id}</h1>
          <p>This ${prettyScreenKind(collectionList.kind)} screen was generated from \`${collectionList.id}\`.</p>
        </div>
        <a class="button-link" href="/collections/new">Create Collection</a>
      </div>

      {#if data.result.items.length === 0}
        <div class="empty-state">
          <p><strong>${collectionList.emptyState?.title || "No collections yet"}</strong></p>
          <p class="muted">${collectionList.emptyState?.body || ""}</p>
        </div>
      {:else}
        <ul class="item-list resource-list">
          {#each data.result.items as collection}
            <li>
              <div class="item-meta resource-meta">
                <a href={'/collections/' + collection.id}><strong>{collection.name}</strong></a>
                {#if collection.description}<span class="muted">{collection.description}</span>{/if}
                <span class="muted">Owner: {collection.owner_id || "Unassigned"}</span>
              </div>
              <span class="badge">{collection.status}</span>
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

    files["collections/[id]/+page.ts"] = `import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  return {
    screen: ${JSON.stringify({ id: collectionDetail.id, title: collectionDetail.title, web: collectionDetail.web }, null, 2)},
    collection: await requestCapability(fetch, "cap_get_collection", { collection_id: params.id })
  };
};
`;

    files["collections/[id]/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>{data.collection.name}</h1>
          <p>This ${prettyScreenKind(collectionDetail.kind)} screen was generated from \`${collectionDetail.id}\`.</p>
        </div>
        <span class="badge">{data.collection.status}</span>
      </div>

      {#if data.collection.description}
        <p>{data.collection.description}</p>
      {:else}
        <p class="muted">No description was provided for this collection.</p>
      {/if}

      <dl class="definition-list">
        <dt>Collection ID</dt><dd>{data.collection.id}</dd>
        <dt>Status</dt><dd>{data.collection.status}</dd>
        <dt>Owner</dt><dd>{data.collection.owner_id || "Unassigned"}</dd>
        <dt>Created</dt><dd>{data.collection.created_at}</dd>
      </dl>

      <div class="button-row">
        <a class="button-link secondary" href="/collections">Back to Collections</a>
        <a class="button-link" href={"/collections/" + data.collection.id + "/edit"}>Edit Collection</a>
      </div>
    </section>
  </div>
</main>
`;

    files["collections/new/+page.ts"] = `import type { PageLoad } from "./$types";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch }) => {
  return {
    lookups: {
      owner_id: await listLookupOptions(fetch, "/lookups/members")
    }
  };
};
`;

    files["collections/new/+page.server.ts"] = `import { redirect, fail } from "@sveltejs/kit";
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
  tryStatement: `created = await requestCapability(fetch, "cap_create_collection", payload);`,
  catchReturn:
    'return fail(400, { error: error instanceof Error ? error.message : "Unable to create collection", values: payload });',
  successStatement: "throw redirect(303, `/collections/${created.id}`);"
})}
};
`;

    files["collections/new/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
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
      <h1>${collectionCreate.title || collectionCreate.id}</h1>
      <p>This ${prettyScreenKind(collectionCreate.kind)} screen was generated from \`${collectionCreate.id}\`.</p>
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
          <button type="submit">Create Collection</button>
          <a class="button-link secondary" href="/collections">Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>
`;

    files["collections/[id]/edit/+page.ts"] = `import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch, params }) => {
  const [collection, ownerOptions] = await Promise.all([
    requestCapability(fetch, "cap_get_collection", { collection_id: params.id }),
    listLookupOptions(fetch, "/lookups/members")
  ]);
  return {
    screen: ${JSON.stringify({ id: collectionEdit.id, title: collectionEdit.title, web: collectionEdit.web }, null, 2)},
    collection,
    lookups: {
      owner_id: ownerOptions
    },
    values: {
      name: collection.name ?? "",
      description: collection.description ?? "",
      status: collection.status ?? "active",
      owner_id: collection.owner_id ?? ""
    }
  };
};
`;

    files["collections/[id]/edit/+page.server.ts"] = `import { redirect, fail } from "@sveltejs/kit";
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
  tryStatement: `await requestCapability(fetch, "cap_update_collection", { collection_id: params.id, ...payload });`,
  catchReturn:
    'return fail(400, { error: error instanceof Error ? error.message : "Unable to update collection", values: payload });',
  successStatement: "throw redirect(303, `/collections/${params.id}`);"
})}
};
`;

    files["collections/[id]/edit/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
  export let form;

  const values = form?.values ?? data.values;
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>${collectionEdit.title || "Edit Collection"}</h1>
      <p>Update the mutable fields for <strong>{data.collection.name}</strong>.</p>
      {#if form?.error}<p><strong>{form.error}</strong></p>{/if}
      <form class="stack" method="POST">
        <label>Name <input name="name" value={values.name ?? ""} /></label>
        <label>Description <textarea name="description">{values.description ?? ""}</textarea></label>
        <label>
          Status
          <select name="status">
            <option value="active" selected={(values.status ?? data.collection.status) === "active"}>active</option>
            <option value="archived" selected={(values.status ?? data.collection.status) === "archived"}>archived</option>
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
          <a class="button-link secondary" href={"/collections/" + data.collection.id}>Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>
`;
  }

  if (memberList && memberDetail && memberCreate && memberEdit) {
    files["members/+page.ts"] = `import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, url }) => {
  const limit = url.searchParams.get("limit");
  return {
    screen: ${JSON.stringify({ id: memberList.id, title: memberList.title, collection: memberList.collection, web: memberList.web }, null, 2)},
    filters: {
      limit: limit ?? ""
    },
    result: await requestCapability(fetch, "cap_list_members", {
      after: url.searchParams.get("after") ?? undefined,
      limit: limit ? Number(limit) : undefined
    })
  };
};
`;

    files["members/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;

  const buildNextHref = () => {
    if (!data.result.next_cursor) return null;
    const params = new URLSearchParams();
    if (data.filters.limit) params.set("limit", String(data.filters.limit));
    params.set("after", data.result.next_cursor);
    return \`/members?\${params.toString()}\`;
  };

  const nextHref = buildNextHref();
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>${memberList.title || memberList.id}</h1>
          <p>This ${prettyScreenKind(memberList.kind)} screen was generated from \`${memberList.id}\`.</p>
        </div>
        <a class="button-link" href="/members/new">Create Member</a>
      </div>

      {#if data.result.items.length === 0}
        <div class="empty-state">
          <p><strong>${memberList.emptyState?.title || "No members yet"}</strong></p>
          <p class="muted">${memberList.emptyState?.body || ""}</p>
        </div>
      {:else}
        <ul class="item-list resource-list">
          {#each data.result.items as member}
            <li>
              <div class="item-meta resource-meta">
                <a href={'/members/' + member.id}><strong>{member.display_name}</strong></a>
                <span class="muted">{member.email}</span>
              </div>
              <span class="badge">{member.is_active ? "active" : "inactive"}</span>
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

    files["members/[id]/+page.ts"] = `import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  return {
    screen: ${JSON.stringify({ id: memberDetail.id, title: memberDetail.title, web: memberDetail.web }, null, 2)},
    member: await requestCapability(fetch, "cap_get_member", { member_id: params.id })
  };
};
`;

    files["members/[id]/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>{data.member.display_name}</h1>
          <p>This ${prettyScreenKind(memberDetail.kind)} screen was generated from \`${memberDetail.id}\`.</p>
        </div>
        <span class="badge">{data.member.is_active ? "active" : "inactive"}</span>
      </div>

      <dl class="definition-list">
        <dt>Member ID</dt><dd>{data.member.id}</dd>
        <dt>Email</dt><dd>{data.member.email}</dd>
        <dt>Display Name</dt><dd>{data.member.display_name}</dd>
        <dt>Created</dt><dd>{data.member.created_at}</dd>
      </dl>

      <div class="button-row">
        <a class="button-link secondary" href="/members">Back to Members</a>
        <a class="button-link" href={"/members/" + data.member.id + "/edit"}>Edit Member</a>
      </div>
    </section>
  </div>
</main>
`;

    files["members/new/+page.server.ts"] = `import { redirect, fail } from "@sveltejs/kit";
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
  tryStatement: `created = await requestCapability(fetch, "cap_create_member", payload);`,
  catchReturn:
    'return fail(400, { error: error instanceof Error ? error.message : "Unable to create member", values: payload });',
  successStatement: "throw redirect(303, `/members/${created.id}`);"
})}
};
`;

    files["members/new/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
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
      <h1>${memberCreate.title || memberCreate.id}</h1>
      <p>This ${prettyScreenKind(memberCreate.kind)} screen was generated from \`${memberCreate.id}\`.</p>
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
          <button type="submit">Create Member</button>
          <a class="button-link secondary" href="/members">Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>
`;

    files["members/[id]/edit/+page.ts"] = `import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  const member = await requestCapability(fetch, "cap_get_member", { member_id: params.id });
  return {
    screen: ${JSON.stringify({ id: memberEdit.id, title: memberEdit.title, web: memberEdit.web }, null, 2)},
    member,
    values: {
      email: member.email ?? "",
      display_name: member.display_name ?? "",
      is_active: member.is_active ?? true
    }
  };
};
`;

    files["members/[id]/edit/+page.server.ts"] = `import { redirect, fail } from "@sveltejs/kit";
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
  tryStatement: `await requestCapability(fetch, "cap_update_member", { member_id: params.id, ...payload });`,
  catchReturn:
    'return fail(400, { error: error instanceof Error ? error.message : "Unable to update member", values: payload });',
  successStatement: "throw redirect(303, `/members/${params.id}`);"
})}
};
`;

    files["members/[id]/edit/+page.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>
  export let data;
  export let form;

  const values = form?.values ?? data.values;
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>${memberEdit.title || "Edit Member"}</h1>
      <p>Update the mutable fields for <strong>{data.member.display_name}</strong>.</p>
      {#if form?.error}<p><strong>{form.error}</strong></p>{/if}
      <form class="stack" method="POST">
        <label>Email <input name="email" type="email" value={values.email ?? ""} /></label>
        <label>Display Name <input name="display_name" value={values.display_name ?? ""} /></label>
        <label>
          Active
          <select name="is_active">
            <option value="true" selected={(values.is_active ?? data.member.is_active) === true}>active</option>
            <option value="false" selected={(values.is_active ?? data.member.is_active) === false}>inactive</option>
          </select>
        </label>
        <div class="button-row">
          <button type="submit">Save Changes</button>
          <a class="button-link secondary" href={"/members/" + data.member.id}>Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>
`;
  }

  return files;
}

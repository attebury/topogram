import type { PageLoad } from "./$types";
import { getItem } from "$lib/api/client";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch, params }) => {
  const [item, ownerOptions] = await Promise.all([
    getItem(fetch, params.id),
    listLookupOptions(fetch, "/lookups/members")
  ]);
  return {
    screen: {
  "id": "item_edit",
  "title": "Edit Item"
},
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

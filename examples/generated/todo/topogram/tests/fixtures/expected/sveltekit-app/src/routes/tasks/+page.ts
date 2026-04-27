import type { PageLoad } from "./$types";
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
    listLookupOptions(fetch, "/lookups/projects"),
    listLookupOptions(fetch, "/lookups/users")
  ]);
  return {
    screen: {
  "id": "task_list",
  "title": "Tasks",
  "collection": {
    "filters": [
      "project_id",
      "owner_id",
      "status"
    ],
    "search": [],
    "pagination": null,
    "views": [
      "table"
    ],
    "refresh": "manual",
    "groupBy": [
      "status"
    ],
    "sort": [
      {
        "field": "created_at",
        "direction": "desc"
      }
    ]
  },
  "web": {
    "shell": "bottom_tabs",
    "layout": "responsive_collection",
    "desktop_variant": "table",
    "mobile_variant": "cards",
    "collection": "table"
  }
},
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

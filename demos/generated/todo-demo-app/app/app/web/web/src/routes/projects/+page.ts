import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, url }) => {
  const limit = url.searchParams.get("limit");
  return {
    screen: {
  "id": "project_list",
  "title": "Projects",
  "collection": {
    "filters": [],
    "search": [],
    "pagination": null,
    "views": [
      "table"
    ],
    "refresh": "manual",
    "groupBy": [],
    "sort": [
      {
        "field": "created_at",
        "direction": "desc"
      }
    ]
  },
  "web": {
    "layout": "responsive_collection",
    "desktop_variant": "table",
    "mobile_variant": "cards",
    "collection": "table"
  }
},
    filters: {
      limit: limit ?? ""
    },
    result: await requestCapability(fetch, "cap_list_projects", {
      after: url.searchParams.get("after") ?? undefined,
      limit: limit ? Number(limit) : undefined
    })
  };
};

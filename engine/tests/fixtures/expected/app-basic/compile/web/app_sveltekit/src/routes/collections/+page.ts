import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, url }) => {
  const limit = url.searchParams.get("limit");
  return {
    screen: {
  "id": "collection_list",
  "title": "Collections",
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
  }
},
    filters: {
      limit: limit ?? ""
    },
    result: await requestCapability(fetch, "cap_list_collections", {
      after: url.searchParams.get("after") ?? undefined,
      limit: limit ? Number(limit) : undefined
    })
  };
};

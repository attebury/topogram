import type { PageLoad } from "./$types";
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
    listLookupOptions(fetch, "/lookups/collections"),
    listLookupOptions(fetch, "/lookups/members")
  ]);
  return {
    screen: {
  "id": "item_list",
  "title": "Items",
  "collection": {
    "filters": [
      "collection_id",
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
  }
},
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

import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch, params }) => {
  const [collection, ownerOptions] = await Promise.all([
    requestCapability(fetch, "cap_get_collection", { collection_id: params.id }),
    listLookupOptions(fetch, "/lookups/members")
  ]);
  return {
    screen: {
  "id": "collection_edit",
  "title": "Edit Collection",
  "web": {
    "present": "page"
  }
},
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

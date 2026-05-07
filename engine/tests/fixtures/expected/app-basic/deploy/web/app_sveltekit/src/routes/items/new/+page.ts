import type { PageLoad } from "./$types";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch }) => {
  const [collectionOptions, ownerOptions] = await Promise.all([
    listLookupOptions(fetch, "/lookups/collections"),
    listLookupOptions(fetch, "/lookups/members")
  ]);

  return {
    lookups: {
      collection_id: collectionOptions,
      owner_id: ownerOptions
    }
  };
};

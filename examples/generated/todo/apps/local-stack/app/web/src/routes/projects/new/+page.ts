import type { PageLoad } from "./$types";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch }) => {
  return {
    lookups: {
      owner_id: await listLookupOptions(fetch, "/lookups/users")
    }
  };
};

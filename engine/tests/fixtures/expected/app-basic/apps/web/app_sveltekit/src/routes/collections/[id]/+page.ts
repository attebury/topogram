import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  return {
    screen: {
  "id": "collection_detail",
  "title": "Collection Details",
  "web": {
    "layout": "detail_page"
  }
},
    collection: await requestCapability(fetch, "cap_get_collection", { collection_id: params.id })
  };
};

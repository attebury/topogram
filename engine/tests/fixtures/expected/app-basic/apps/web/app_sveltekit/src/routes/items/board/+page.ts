import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch }) => {
  const result = await requestCapability(fetch, "cap_list_items");
  const resultObject = result && typeof result === "object" && !Array.isArray(result) ? result : {};
  return {
    screen: {
  "id": "item_board",
  "title": "Item Board",
  "collection": {
    "filters": [],
    "search": [],
    "pagination": null,
    "views": [],
    "refresh": "manual",
    "groupBy": [],
    "sort": []
  },
  "web": {
    "layout": "responsive_collection",
    "desktop_variant": "board",
    "mobile_variant": "cards",
    "collection": "board"
  }
},
    result: Array.isArray(result) ? { items: result } : { items: resultObject.items ?? [], ...resultObject }
  };
};

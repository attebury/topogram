import type { PageLoad } from "./$types";
import { getItem } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params, url }) => {
  return {
    screen: {
  "id": "item_detail",
  "title": "Item Details"
},
    item: await getItem(fetch, params.id),
    visibilityDebug: {
      memberId: url.searchParams.get("topogram_auth_member_id") ?? "",
      permissions: url.searchParams.get("topogram_auth_permissions") ?? "",
      isAdmin: url.searchParams.get("topogram_auth_admin") ?? ""
    }
  };
};

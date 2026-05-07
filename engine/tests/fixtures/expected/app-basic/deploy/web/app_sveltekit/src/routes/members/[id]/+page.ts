import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  return {
    screen: {
  "id": "member_detail",
  "title": "Member Details",
  "web": {
    "layout": "detail_page"
  }
},
    member: await requestCapability(fetch, "cap_get_member", { member_id: params.id })
  };
};

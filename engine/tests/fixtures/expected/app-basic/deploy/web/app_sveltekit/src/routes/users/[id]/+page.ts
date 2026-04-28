import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  return {
    screen: {
  "id": "user_detail",
  "title": "User Details",
  "web": {
    "layout": "detail_page"
  }
},
    user: await requestCapability(fetch, "cap_get_user", { user_id: params.id })
  };
};

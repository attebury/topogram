import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  const user = await requestCapability(fetch, "cap_get_user", { user_id: params.id });
  return {
    screen: {
  "id": "user_edit",
  "title": "Edit User",
  "web": {
    "present": "page"
  }
},
    user,
    values: {
      email: user.email ?? "",
      display_name: user.display_name ?? "",
      is_active: user.is_active ?? true
    }
  };
};

import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  const member = await requestCapability(fetch, "cap_get_member", { member_id: params.id });
  return {
    screen: {
  "id": "member_edit",
  "title": "Edit Member"
},
    member,
    values: {
      email: member.email ?? "",
      display_name: member.display_name ?? "",
      is_active: member.is_active ?? true
    }
  };
};

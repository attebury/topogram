import type { PageLoad } from "./$types";
import { getTask } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params, url }) => {
  return {
    screen: {
  "id": "task_detail",
  "title": "Task Details",
  "web": {
    "breadcrumbs": "visible",
    "layout": "detail_page"
  }
},
    task: await getTask(fetch, params.id),
    visibilityDebug: {
      userId: url.searchParams.get("topogram_auth_user_id") ?? "",
      permissions: url.searchParams.get("topogram_auth_permissions") ?? "",
      isAdmin: url.searchParams.get("topogram_auth_admin") ?? ""
    }
  };
};

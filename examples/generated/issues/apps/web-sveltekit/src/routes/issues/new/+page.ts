import type { PageLoad } from "./$types";
import { env as publicEnv } from "$env/dynamic/public";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch }) => {
  const [boardOptions, assigneeOptions] = await Promise.all([
    listLookupOptions(fetch, "/lookups/boards"),
    listLookupOptions(fetch, "/lookups/users")
  ]);
  return {
    screen: {
  "id": "issue_create",
  "title": "Create Issue",
  "kind": "form"
},
    lookups: {
      board_id: boardOptions,
      assignee_id: assigneeOptions
    },
    defaults: {
      board_id: publicEnv.PUBLIC_TOPOGRAM_DEMO_CONTAINER_ID || "",
      assignee_id: publicEnv.PUBLIC_TOPOGRAM_DEMO_USER_ID || "",
      priority: "medium"
    }
  };
};

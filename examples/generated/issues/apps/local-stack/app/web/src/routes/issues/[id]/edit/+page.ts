import type { PageLoad } from "./$types";
import { getIssue } from "$lib/api/client";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch, params }) => {
  const [issue, boardOptions, assigneeOptions] = await Promise.all([
    getIssue(fetch, params.id),
    listLookupOptions(fetch, "/lookups/boards"),
    listLookupOptions(fetch, "/lookups/users")
  ]);
  return {
    screen: {
  "id": "issue_edit",
  "title": "Edit Issue",
  "kind": "form"
},
    issue,
    lookups: {
      board_id: boardOptions,
      assignee_id: assigneeOptions
    }
  };
};

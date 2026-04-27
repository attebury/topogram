import type { PageLoad } from "./$types";
import { listIssues } from "$lib/api/client";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch, url }) => {
  const limit = url.searchParams.get("limit");
  const [result, boardOptions, assigneeOptions] = await Promise.all([
    listIssues(fetch, {
      board_id: url.searchParams.get("board_id") ?? undefined,
      assignee_id: url.searchParams.get("assignee_id") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      after: url.searchParams.get("after") ?? undefined,
      limit: limit ? Number(limit) : undefined
    }),
    listLookupOptions(fetch, "/lookups/boards"),
    listLookupOptions(fetch, "/lookups/users")
  ]);
  return {
    screen: {
  "id": "issue_list",
  "title": "Issues",
  "kind": "list"
},
    filters: {
      board_id: url.searchParams.get("board_id") ?? "",
      assignee_id: url.searchParams.get("assignee_id") ?? "",
      status: url.searchParams.get("status") ?? "",
      limit: limit ?? ""
    },
    lookups: {
      board_id: boardOptions,
      assignee_id: assigneeOptions
    },
    result
  };
};

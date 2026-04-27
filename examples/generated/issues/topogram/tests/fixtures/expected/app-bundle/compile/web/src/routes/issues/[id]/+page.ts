import type { PageLoad } from "./$types";
import { getIssue } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  const issue = await getIssue(fetch, params.id);
  return {
    screen: {
  "id": "issue_detail",
  "title": "Issue Details",
  "kind": "detail"
},
    issue
  };
};

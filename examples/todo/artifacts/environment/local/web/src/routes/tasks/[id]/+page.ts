import type { PageLoad } from "./$types";
import { getTask } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  return {
    screen: {
  "id": "task_detail",
  "title": "Task Details",
  "web": {
    "breadcrumbs": "visible",
    "layout": "detail_page"
  }
},
    task: await getTask(fetch, params.id)
  };
};

import type { PageLoad } from "./$types";
import { getTask } from "$lib/api/client";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch, params }) => {
  const [task, ownerOptions] = await Promise.all([
    getTask(fetch, params.id),
    listLookupOptions(fetch, "/lookups/users")
  ]);
  return {
    screen: {
  "id": "task_edit",
  "title": "Edit Task",
  "web": {
    "present": "page"
  }
},
    task,
    lookups: {
      owner_id: ownerOptions
    },
    values: {
      title: task.title ?? "",
      description: task.description ?? "",
      priority: task.priority ?? "medium",
      owner_id: task.owner_id ?? "",
      due_at: task.due_at ? String(task.due_at).slice(0, 16) : "",
      status: task.status ?? ""
    }
  };
};

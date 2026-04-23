import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";
import { listLookupOptions } from "$lib/api/lookups";

export const load: PageLoad = async ({ fetch, params }) => {
  const [project, ownerOptions] = await Promise.all([
    requestCapability(fetch, "cap_get_project", { project_id: params.id }),
    listLookupOptions(fetch, "/lookups/users")
  ]);
  return {
    screen: {
  "id": "project_edit",
  "title": "Edit Project",
  "web": {
    "present": "page"
  }
},
    project,
    lookups: {
      owner_id: ownerOptions
    },
    values: {
      name: project.name ?? "",
      description: project.description ?? "",
      status: project.status ?? "active",
      owner_id: project.owner_id ?? ""
    }
  };
};

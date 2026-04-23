import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  return {
    screen: {
  "id": "project_detail",
  "title": "Project Details",
  "web": {
    "layout": "detail_page"
  }
},
    project: await requestCapability(fetch, "cap_get_project", { project_id: params.id })
  };
};

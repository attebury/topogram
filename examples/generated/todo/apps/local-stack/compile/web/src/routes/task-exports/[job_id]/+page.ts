import type { PageLoad } from "./$types";
import { getTaskExportJob } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  try {
    return {
      screen: {
  "id": "task_exports",
  "title": "Export Status",
  "web": {
    "present": "page"
  }
},
      job: await getTaskExportJob(fetch, params.job_id),
      notFound: false
    };
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      return {
        screen: {
  "id": "task_exports",
  "title": "Export Status",
  "web": {
    "present": "page"
  }
},
        job: null,
        notFound: true
      };
    }
    throw error;
  }
};

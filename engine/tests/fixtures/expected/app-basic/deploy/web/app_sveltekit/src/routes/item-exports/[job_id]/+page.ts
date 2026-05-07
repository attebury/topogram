import type { PageLoad } from "./$types";
import { getItemExportJob } from "$lib/api/client";

export const load: PageLoad = async ({ fetch, params }) => {
  try {
    return {
      screen: {
  "id": "item_exports",
  "title": "Export Status"
},
      job: await getItemExportJob(fetch, params.job_id),
      notFound: false
    };
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      return {
        screen: {
  "id": "item_exports",
  "title": "Export Status"
},
        job: null,
        notFound: true
      };
    }
    throw error;
  }
};

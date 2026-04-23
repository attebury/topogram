import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { exportTasks } from "$lib/api/client";

export const actions: Actions = {
  export: async ({ request, fetch }) => {
    const form = await request.formData();
    const payload = {
      project_id: String(form.get("project_id") || "") || undefined,
      owner_id: String(form.get("owner_id") || "") || undefined,
      status: String(form.get("status") || "") || undefined
    };

    let job;

    try {
      job = await exportTasks(fetch, payload);
    } catch (error) {
      return fail(400, { exportError: error instanceof Error ? error.message : "Unable to start export", exportValues: payload });
    }
    throw redirect(303, `/task-exports/${job.job_id}`);
  }
};

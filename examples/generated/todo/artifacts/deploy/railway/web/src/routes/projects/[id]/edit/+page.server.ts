import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { requestCapability } from "$lib/api/client";

export const actions: Actions = {
  default: async ({ request, fetch, params }) => {
    const form = await request.formData();
    const payload = {
      name: String(form.get("name") || "") || undefined,
      description: String(form.get("description") || "") || undefined,
      status: String(form.get("status") || "") || undefined,
      owner_id: String(form.get("owner_id") || "") || undefined
    };

    try {
      await requestCapability(fetch, "cap_update_project", { project_id: params.id, ...payload });
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : "Unable to update project", values: payload });
    }
    throw redirect(303, `/projects/${params.id}`);
  }
};

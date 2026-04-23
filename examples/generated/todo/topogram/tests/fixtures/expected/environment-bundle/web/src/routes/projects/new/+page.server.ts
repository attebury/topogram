import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { requestCapability } from "$lib/api/client";

export const actions: Actions = {
  default: async ({ request, fetch }) => {
    const form = await request.formData();
    const payload = {
      name: String(form.get("name") || ""),
      description: String(form.get("description") || "") || undefined,
      status: String(form.get("status") || "") || "active",
      owner_id: String(form.get("owner_id") || "") || undefined
    };

    if (!payload.name) {
      return fail(400, { error: "Name is required.", values: payload });
    }

    let created;

    try {
      created = await requestCapability(fetch, "cap_create_project", payload);
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : "Unable to create project", values: payload });
    }
    throw redirect(303, `/projects/${created.id}`);
  }
};

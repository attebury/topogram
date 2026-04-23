import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { requestCapability } from "$lib/api/client";

export const actions: Actions = {
  default: async ({ request, fetch }) => {
    const form = await request.formData();
    const payload = {
      email: String(form.get("email") || ""),
      display_name: String(form.get("display_name") || ""),
      is_active: form.get("is_active") === "true"
    };

    if (!payload.email || !payload.display_name) {
      return fail(400, { error: "Email and display name are required.", values: payload });
    }

    let created;

    try {
      created = await requestCapability(fetch, "cap_create_user", payload);
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : "Unable to create user", values: payload });
    }
    throw redirect(303, `/users/${created.id}`);
  }
};

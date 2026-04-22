import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { requestCapability } from "$lib/api/client";

export const actions: Actions = {
  default: async ({ request, fetch, params }) => {
    const form = await request.formData();
    const payload = {
      email: String(form.get("email") || "") || undefined,
      display_name: String(form.get("display_name") || "") || undefined,
      is_active: form.get("is_active") === "true"
    };

    try {
      await requestCapability(fetch, "cap_update_user", { user_id: params.id, ...payload });
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : "Unable to update user", values: payload });
    }
    throw redirect(303, `/users/${params.id}`);
  }
};

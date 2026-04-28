import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { updateTask } from "$lib/api/client";

export const actions: Actions = {
  default: async ({ request, fetch, params }) => {
    const form = await request.formData();
    const updated_at = String(form.get("updated_at") || "");
    const payload = {
      title: String(form.get("title") || "") || undefined,
      description: String(form.get("description") || "") || undefined,
      priority: String(form.get("priority") || "") || undefined,
      owner_id: String(form.get("owner_id") || "") || undefined,
      due_at: String(form.get("due_at") || "") || undefined,
      status: String(form.get("status") || "") || undefined
    };

    if (!updated_at) {
      return fail(400, { error: "updated_at is required to update this task.", values: payload });
    }

    try {
      await updateTask(fetch, params.id, payload, {
        headers: {
          "If-Match": updated_at
        }
      });
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : "Unable to update task", values: payload });
    }
    throw redirect(303, `/tasks/${params.id}`);
  }
};

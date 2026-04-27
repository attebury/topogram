import { randomUUID } from "node:crypto";
import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { createTask } from "$lib/api/client";

export const actions: Actions = {
  default: async ({ request, fetch }) => {
    const form = await request.formData();
    const payload = {
      title: String(form.get("title") || ""),
      description: String(form.get("description") || "") || undefined,
      priority: String(form.get("priority") || "") || undefined,
      owner_id: String(form.get("owner_id") || "") || undefined,
      project_id: String(form.get("project_id") || ""),
      due_at: String(form.get("due_at") || "") || undefined
    };

    if (!payload.title || !payload.project_id) {
      return fail(400, { error: "Title and project are required.", values: payload });
    }

    let created;

    try {
      created = await createTask(fetch, payload, {
        headers: {
          "Idempotency-Key": randomUUID()
        }
      });
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : "Unable to create task", values: payload });
    }
    throw redirect(303, `/tasks/${created.id}`);
  }
};

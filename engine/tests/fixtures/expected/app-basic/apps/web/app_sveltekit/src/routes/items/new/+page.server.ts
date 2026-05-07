import { randomUUID } from "node:crypto";
import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { createItem } from "$lib/api/client";

export const actions: Actions = {
  default: async ({ request, fetch }) => {
    const form = await request.formData();
    const payload = {
      title: String(form.get("title") || ""),
      description: String(form.get("description") || "") || undefined,
      priority: String(form.get("priority") || "") || undefined,
      owner_id: String(form.get("owner_id") || "") || undefined,
      collection_id: String(form.get("collection_id") || ""),
      due_at: String(form.get("due_at") || "") || undefined
    };

    if (!payload.title || !payload.collection_id) {
      return fail(400, { error: "Title and collection are required.", values: payload });
    }

    let created;

    try {
      created = await createItem(fetch, payload, {
        headers: {
          "Idempotency-Key": randomUUID()
        }
      });
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : "Unable to create item", values: payload });
    }
    throw redirect(303, `/items/${created.id}`);
  }
};

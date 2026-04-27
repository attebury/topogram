import { randomUUID } from "node:crypto";
import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { updateIssue } from "$lib/api/client";

export const actions: Actions = {
  default: async ({ request, fetch, params }) => {
    const form = await request.formData();
    const updated_at = String(form.get("updated_at") || "");
    const payload = {
      title: String(form.get("title") || ""),
      description: String(form.get("description") || "") || undefined,
      assignee_id: String(form.get("assignee_id") || "") || undefined,
      priority: String(form.get("priority") || "") || undefined,
      status: String(form.get("status") || "") || undefined
    };
    if (!updated_at) {
      return fail(400, { actionError: "updated_at is required to update this issue.", values: payload });
    }

    try {
      await updateIssue(fetch, params.id, payload, {
        headers: {
          "If-Match": updated_at,
          "Idempotency-Key": randomUUID()
        }
      });
    } catch (error) {
      return fail(400, {
        actionError: error instanceof Error ? error.message : "Unable to update issue",
        values: payload
      });
    }
    throw redirect(303, `/issues/${params.id}`);
  }
};

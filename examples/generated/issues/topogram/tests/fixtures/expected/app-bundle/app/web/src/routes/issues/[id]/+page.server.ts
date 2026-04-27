import { randomUUID } from "node:crypto";
import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { closeIssue } from "$lib/api/client";

export const actions: Actions = {
  close: async ({ request, fetch, params }) => {
    const form = await request.formData();
    const updated_at = String(form.get("updated_at") || "");
    if (!updated_at) {
      return fail(400, { actionError: "updated_at is required to close this issue." });
    }

    try {
      await closeIssue(fetch, params.id, { closed_at: new Date().toISOString() }, {
        headers: {
          "If-Match": updated_at,
          "Idempotency-Key": randomUUID()
        }
      });
    } catch (error) {
      return fail(400, { actionError: error instanceof Error ? error.message : "Unable to close issue" });
    }
    throw redirect(303, `/issues/${params.id}`);
  }
};

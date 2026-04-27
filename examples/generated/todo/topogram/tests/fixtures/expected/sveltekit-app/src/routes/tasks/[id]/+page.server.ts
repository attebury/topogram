import { randomUUID } from "node:crypto";
import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { completeTask, deleteTask } from "$lib/api/client";

export const actions: Actions = {
  complete: async ({ request, fetch, params }) => {
    const form = await request.formData();
    const updated_at = String(form.get("updated_at") || "");
    const completed_at = String(form.get("completed_at") || "") || new Date().toISOString();
    if (!updated_at) {
      return fail(400, { actionError: "updated_at is required to complete this task." });
    }

    try {
      await completeTask(fetch, params.id, { completed_at }, {
        headers: {
          "If-Match": updated_at,
          "Idempotency-Key": randomUUID()
        }
      });
    } catch (error) {
      return fail(400, { actionError: error instanceof Error ? error.message : "Unable to complete task" });
    }
    throw redirect(303, `/tasks/${params.id}`);
  },
  delete: async ({ request, fetch, params }) => {
    const form = await request.formData();
    const updated_at = String(form.get("updated_at") || "");
    if (!updated_at) {
      return fail(400, { actionError: "updated_at is required to delete this task." });
    }

    try {
      await deleteTask(fetch, params.id, {
        headers: {
          "If-Match": updated_at
        }
      });
    } catch (error) {
      return fail(400, { actionError: error instanceof Error ? error.message : "Unable to delete task" });
    }
    throw redirect(303, "/tasks");
  }
};

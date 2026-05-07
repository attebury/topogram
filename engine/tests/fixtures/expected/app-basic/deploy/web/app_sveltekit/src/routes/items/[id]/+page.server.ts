import { randomUUID } from "node:crypto";
import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { completeItem, deleteItem } from "$lib/api/client";

export const actions: Actions = {
  complete: async ({ request, fetch, params }) => {
    const form = await request.formData();
    const updated_at = String(form.get("updated_at") || "");
    const completed_at = String(form.get("completed_at") || "") || new Date().toISOString();
    if (!updated_at) {
      return fail(400, { actionError: "updated_at is required to complete this item." });
    }

    try {
      await completeItem(fetch, params.id, { completed_at }, {
        headers: {
          "If-Match": updated_at,
          "Idempotency-Key": randomUUID()
        }
      });
    } catch (error) {
      return fail(400, { actionError: error instanceof Error ? error.message : "Unable to complete item" });
    }
    throw redirect(303, `/items/${params.id}`);
  },
  delete: async ({ request, fetch, params }) => {
    const form = await request.formData();
    const updated_at = String(form.get("updated_at") || "");
    if (!updated_at) {
      return fail(400, { actionError: "updated_at is required to delete this item." });
    }

    try {
      await deleteItem(fetch, params.id, {
        headers: {
          "If-Match": updated_at
        }
      });
    } catch (error) {
      return fail(400, { actionError: error instanceof Error ? error.message : "Unable to delete item" });
    }
    throw redirect(303, "/items");
  }
};

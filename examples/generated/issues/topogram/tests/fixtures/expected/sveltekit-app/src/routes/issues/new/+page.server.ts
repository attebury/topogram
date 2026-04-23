import { randomUUID } from "node:crypto";
import { redirect, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { createIssue } from "$lib/api/client";

export const actions: Actions = {
  default: async ({ request, fetch }) => {
    const form = await request.formData();
    const payload = {
      title: String(form.get("title") || ""),
      description: String(form.get("description") || "") || undefined,
      assignee_id: String(form.get("assignee_id") || "") || undefined,
      board_id: String(form.get("board_id") || ""),
      priority: String(form.get("priority") || "") || undefined
    };

    let created;

    try {
      created = await createIssue(fetch, payload, {
        headers: { "Idempotency-Key": randomUUID() }
      });
    } catch (error) {
      return fail(400, {
        actionError: error instanceof Error ? error.message : "Unable to create issue",
        values: payload
      });
    }
    throw redirect(303, `/issues/${created.id}`);
  }
};

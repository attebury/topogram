// @ts-check

import { linkSdlcRecord } from "./link.js";
import { transitionStatement } from "./transition.js";

/**
 * @param {string} workspaceRoot
 * @param {string} taskId
 * @param {string} verificationId
 * @param {{ write?: boolean, actor?: string|null, note?: string|null }} [options]
 * @returns {Record<string, any>}
 */
export function completeTask(workspaceRoot, taskId, verificationId, options = {}) {
  if (!verificationId) {
    return { ok: false, error: "sdlc complete requires --verification <verification-id>" };
  }
  const link = linkSdlcRecord(workspaceRoot, taskId, verificationId, { write: Boolean(options.write) });
  if (!link.ok) {
    return { ok: false, taskId, verificationId, link };
  }
  if (!options.write) {
    return {
      ok: true,
      dryRun: true,
      taskId,
      verificationId,
      link,
      transition: {
        planned: true,
        to: "done"
      }
    };
  }

  const transition = transitionStatement(workspaceRoot, taskId, "done", {
    actor: options.actor || null,
    note: options.note || null
  });
  return {
    ok: Boolean(transition.ok),
    dryRun: false,
    taskId,
    verificationId,
    link,
    transition
  };
}

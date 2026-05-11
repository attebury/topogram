// @ts-check
// Resolver enrichment for tasks.
//
// Back-link arrays:
//   blockingMe   — tasks whose `blocks` references this task (reciprocal of blocked_by)
//   blockedByMe  — tasks whose `blocked_by` references this task (reciprocal of blocks)
//   plans         — implementation plans attached to this task
//
// Note: we deliberately compute *both* directions even though `blocks` and
// `blocked_by` are reciprocal, because authors only write one side. The
// resolver bridges them.

/** @param {TopogramStatement} task @param {ResolverBacklinkIndex} index */
export function enrichTask(task, index) {
  return {
    blockingMe: (index.tasksThatBlockTarget.get(task.id) || []).slice().sort(),
    blockedByMe: (index.tasksBlockedByTarget.get(task.id) || []).slice().sort(),
    plans: (index.plansByTask.get(task.id) || []).slice().sort()
  };
}

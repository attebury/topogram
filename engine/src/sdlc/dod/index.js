// Per-kind dispatch for DoD checks.

import { checkDoD as checkPitch } from "./pitch.js";
import { checkDoD as checkRequirement } from "./requirement.js";
import { checkDoD as checkAcceptanceCriterion } from "./acceptance-criterion.js";
import { checkDoD as checkTask } from "./task.js";
import { checkDoD as checkPlan } from "./plan.js";
import { checkDoD as checkBug } from "./bug.js";
import { checkDoD as checkDocument } from "./document.js";

const CHECKS = {
  pitch: checkPitch,
  requirement: checkRequirement,
  acceptance_criterion: checkAcceptanceCriterion,
  task: checkTask,
  plan: checkPlan,
  bug: checkBug,
  document: checkDocument
};

export function checkDoD(kind, statement, targetStatus, graph) {
  const check = CHECKS[kind];
  if (!check) {
    return { satisfied: true, errors: [], warnings: [] };
  }
  return check(statement, targetStatus, graph);
}

// @ts-check

import fs from "node:fs";
import path from "node:path";

import { parsePath } from "../parser.js";
import { resolveWorkspace } from "../resolver.js";
import { PLAN_STEP_STATUSES } from "../validator/kinds.js";
import { resolveTopoRoot } from "../workspace-paths.js";
import { appendTransition, lastTransition, readHistory } from "./history.js";
import { parsePlanStepEntry, planStepHistoryId } from "./plan-steps.js";

/** @type {Record<string, string[]>} */
const STEP_TRANSITIONS = {
  pending: ["in-progress", "blocked", "done", "skipped"],
  "in-progress": ["done", "blocked", "pending", "skipped"],
  blocked: ["pending", "in-progress", "skipped"],
  done: [],
  skipped: []
};

/**
 * @param {string} slug
 * @returns {string}
 */
function humanize(slug) {
  return slug
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * @param {any} ast
 * @param {string} id
 * @returns {{file: any, statement: any}|null}
 */
function findAstStatement(ast, id) {
  for (const file of ast.files) {
    for (const statement of file.statements) {
      if (statement.id === id) {
        return { file, statement };
      }
    }
  }
  return null;
}

/**
 * @param {any} statement
 * @param {string} stepId
 * @returns {{entry: any, parsed: import("./plan-steps.js").PlanStep, statusToken: any}|null}
 */
function findStepEntry(statement, stepId) {
  const stepsField = statement.fields.find(/** @param {any} field */ (field) => field.key === "steps");
  if (!stepsField || stepsField.value.type !== "block") return null;
  for (const entry of stepsField.value.entries) {
    const parsed = parsePlanStepEntry(entry);
    if (parsed.id !== stepId) continue;
    for (let index = 2; index < entry.items.length - 1; index += 2) {
      if (entry.items[index]?.type === "symbol" && entry.items[index].value === "status") {
        return { entry, parsed, statusToken: entry.items[index + 1] };
      }
    }
    return { entry, parsed, statusToken: null };
  }
  return null;
}

/**
 * @param {string} source
 * @param {any} token
 * @param {string} status
 * @returns {string}
 */
function rewriteToken(source, token, status) {
  return source.slice(0, token.loc.start.offset) + status + source.slice(token.loc.end.offset);
}

/**
 * @param {string} workspaceRoot
 * @param {string} taskId
 * @param {string} slug
 * @param {{write?: boolean}} [options]
 * @returns {any}
 */
export function createPlan(workspaceRoot, taskId, slug, options = {}) {
  if (!taskId || !/^task_[a-z][a-z0-9_]*$/.test(taskId)) {
    return { ok: false, error: `Invalid task id '${taskId}'` };
  }
  if (!slug || !/^[a-z][a-z0-9_]*$/.test(slug)) {
    return { ok: false, error: `Invalid slug '${slug}' — must match /^[a-z][a-z0-9_]*$/` };
  }

  const ast = parsePath(workspaceRoot);
  const resolved = resolveWorkspace(ast);
  if (!resolved.ok) {
    return { ok: false, error: "workspace failed validation; cannot create plan", validation: resolved.validation };
  }
  const task = resolved.graph.statements.find(/** @param {any} statement */ (statement) => statement.id === taskId && statement.kind === "task");
  if (!task) {
    return { ok: false, error: `Task '${taskId}' not found` };
  }

  const planId = `plan_${slug}`;
  if (resolved.graph.statements.some(/** @param {any} statement */ (statement) => statement.id === planId)) {
    return { ok: false, error: `Statement '${planId}' already exists` };
  }

  const targetDir = path.join(resolveTopoRoot(workspaceRoot), "plans");
  const targetFile = path.join(targetDir, `${slug}.tg`);
  const content = `plan ${planId} {
  name "${humanize(slug)}"
  description "Implementation plan for ${taskId}."
  task ${taskId}
  priority medium
  notes "Record approach notes here."
  outcome "Record what worked, what did not, and what to repeat later."
  steps {
    step inspect_current_state status pending description "Inspect current behavior and constraints."
    step implement_changes status pending description "Implement the planned changes."
    step verify_results status pending description "Run focused checks and record verification."
  }
  status draft
}
`;

  if (!options.write) {
    return { ok: true, dryRun: true, id: planId, task: taskId, file: targetFile, content };
  }
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  if (fs.existsSync(targetFile)) {
    return { ok: false, error: `Refusing to overwrite '${targetFile}'` };
  }
  fs.writeFileSync(targetFile, content, "utf8");
  return { ok: true, dryRun: false, id: planId, task: taskId, file: targetFile };
}

/**
 * @param {string} workspaceRoot
 * @param {string} planId
 * @returns {any}
 */
export function explainPlan(workspaceRoot, planId) {
  const ast = parsePath(workspaceRoot);
  const resolved = resolveWorkspace(ast);
  if (!resolved.ok) {
    return { ok: false, error: "workspace failed validation; cannot explain plan", validation: resolved.validation };
  }
  const plan = resolved.graph.statements.find(/** @param {any} statement */ (statement) => statement.id === planId && statement.kind === "plan");
  if (!plan) {
    return { ok: false, error: `Plan '${planId}' not found` };
  }
  const history = readHistory(workspaceRoot);
  const steps = (plan.steps || []).map(/** @param {any} step */ (step) => ({
    ...step,
    last_transition: lastTransition(history, planStepHistoryId(plan.id, step.id))
  }));
  const nextStep = steps.find(/** @param {any} step */ (step) => step.status !== "done" && step.status !== "skipped") || null;
  return {
    ok: true,
    type: "sdlc_plan_explain",
    id: plan.id,
    status: plan.status,
    task: plan.task?.id || null,
    summary: {
      name: plan.name,
      description: plan.description,
      notes: plan.notes || null,
      outcome: plan.outcome || null
    },
    steps,
    next_step: nextStep,
    next_action: nextStep
      ? { kind: "work", step: nextStep.id, reason: `next incomplete step is '${nextStep.id}'` }
      : { kind: "none", reason: "all steps are done or skipped" }
  };
}

/**
 * @param {string} workspaceRoot
 * @param {string} planId
 * @param {string} stepId
 * @param {string} targetStatus
 * @param {{write?: boolean, dryRun?: boolean, actor?: string|null, note?: string|null}} [options]
 * @returns {any}
 */
export function transitionPlanStep(workspaceRoot, planId, stepId, targetStatus, options = {}) {
  if (!PLAN_STEP_STATUSES.has(targetStatus)) {
    return { ok: false, error: `Invalid plan step status '${targetStatus}'` };
  }

  const ast = parsePath(workspaceRoot);
  const resolved = resolveWorkspace(ast);
  if (!resolved.ok) {
    return { ok: false, error: "workspace failed validation; cannot transition plan step", validation: resolved.validation };
  }

  const located = findAstStatement(ast, planId);
  if (!located || located.statement.kind !== "plan") {
    return { ok: false, error: `Plan '${planId}' not found` };
  }
  const step = findStepEntry(located.statement, stepId);
  if (!step) {
    return { ok: false, error: `Step '${stepId}' not found on plan '${planId}'` };
  }
  if (!step.statusToken) {
    return { ok: false, error: `Step '${stepId}' on plan '${planId}' has no status field to rewrite` };
  }

  const fromStatus = step.parsed.status;
  const allowed = STEP_TRANSITIONS[fromStatus || ""];
  if (!allowed) {
    return { ok: false, error: `Unknown plan step status '${fromStatus}'` };
  }
  if (!allowed.includes(targetStatus)) {
    return {
      ok: false,
      error: `Plan step cannot transition from '${fromStatus}' to '${targetStatus}' — allowed: ${allowed.join(", ") || "(terminal)"}`
    };
  }

  const sourcePath = located.statement.loc.file;
  const original = fs.readFileSync(sourcePath, "utf8");
  const rewritten = rewriteToken(original, step.statusToken, targetStatus);
  const shouldWrite = options.write === true && options.dryRun !== true;
  if (shouldWrite) {
    fs.writeFileSync(sourcePath, rewritten, "utf8");
    appendTransition(workspaceRoot, planStepHistoryId(planId, stepId), {
      from: fromStatus,
      to: targetStatus,
      by: options.actor || null,
      note: options.note || null
    });
  }

  return {
    ok: true,
    id: planId,
    step: stepId,
    from: fromStatus,
    to: targetStatus,
    file: sourcePath,
    dryRun: !shouldWrite
  };
}

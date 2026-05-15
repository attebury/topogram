// @ts-check

import path from "node:path";

import { stableStringify } from "../../format.js";
import { parsePath } from "../../parser.js";
import { resolveWorkspace } from "../../resolver.js";
import { formatValidationErrors } from "../../validator.js";
import { resolveTopoRoot } from "../../workspace-paths.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {string[]} args
 * @param {string} flag
 * @returns {string|null}
 */
function flagValue(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] || null : null;
}

/**
 * @param {string[]} args
 * @param {string} flag
 * @returns {string[]}
 */
function flagValues(args, flag) {
  /** @type {string[]} */
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1] && !args[index + 1].startsWith("-")) {
      values.push(args[index + 1]);
      index += 1;
    }
  }
  return values;
}

/**
 * @param {string[]} args
 * @returns {boolean}
 */
function includeHistory(args) {
  return args.includes("--history") || args.includes("--include-history");
}

/**
 * @param {Record<string, any>} payload
 * @returns {void}
 */
function printPolicyExplain(payload) {
  console.log("Topogram SDLC policy");
  console.log(`Status: ${payload.policy?.status || "not_adopted"}`);
  console.log(`Mode: ${payload.policy?.mode || "none"}`);
  console.log(`Policy: ${payload.policy?.path || "missing"}`);
  console.log(payload.enforcement || "Project has not adopted enforced SDLC.");
  if ((payload.policy?.protectedPaths || []).length > 0) {
    console.log("Protected paths:");
    for (const item of payload.policy.protectedPaths) {
      console.log(`  - ${item}`);
    }
  }
  if ((payload.nextCommands || []).length > 0) {
    console.log("Next commands:");
    for (const command of payload.nextCommands) {
      console.log(`  - ${command}`);
    }
  }
}

/**
 * @param {Record<string, any>} payload
 * @returns {void}
 */
function printCommitPrep(payload) {
  console.log("Topogram SDLC commit prep");
  console.log(`Status: ${payload.ok ? "ready" : "needs attention"}`);
  console.log(`Changed task files: ${(payload.taskFiles || []).length}`);
  if ((payload.openTasks || []).length > 0) {
    console.log("Open changed tasks:");
    for (const task of payload.openTasks) {
      console.log(`  - ${task.id} (${task.status}, ${task.disposition || "unclassified"})`);
      console.log(`    file: ${task.file}`);
    }
  }
  if ((payload.errors || []).length > 0) {
    console.log("Errors:");
    for (const error of payload.errors) {
      console.log(`  - ${error}`);
    }
  }
  if ((payload.warnings || []).length > 0) {
    console.log("Warnings:");
    for (const warning of payload.warnings) {
      console.log(`  - ${warning}`);
    }
  }
  if ((payload.nextCommands || []).length > 0) {
    console.log("Next commands:");
    for (const command of payload.nextCommands) {
      console.log(`  - ${command}`);
    }
  }
}

/**
 * @param {string} sdlcRoot
 * @returns {AnyRecord|null}
 */
function resolveSdlcWorkspace(sdlcRoot) {
  const ast = parsePath(sdlcRoot);
  const resolved = resolveWorkspace(ast);
  if (!resolved.ok) {
    console.error(formatValidationErrors(resolved.validation));
    return null;
  }
  return resolved;
}

/**
 * Runs `topogram sdlc ...` commands and the legacy top-level `topogram release`
 * command.
 *
 * @param {{
 *   commandArgs: AnyRecord,
 *   args: string[],
 *   inputPath: string|null|undefined
 * }} context
 * @returns {Promise<number>}
 */
export async function runSdlcCommand(context) {
  const { commandArgs, args } = context;
  const sdlcRoot = resolveTopoRoot(context.inputPath || ".");
  const actor = flagValue(args, "--actor");
  const note = flagValue(args, "--note");
  const status = flagValue(args, "--status");
  const id = flagValue(args, "--id");
  const before = flagValue(args, "--before");
  const appVersion = flagValue(args, "--app-version");
  const sinceTag = flagValue(args, "--since-tag");
  const base = flagValue(args, "--base");
  const head = flagValue(args, "--head");
  const exemption = flagValue(args, "--exemption");
  const verification = flagValue(args, "--verification");
  const dryRun = args.includes("--dry-run");
  const strict = args.includes("--strict");
  const json = args.includes("--json");

  if (String(commandArgs.sdlcCommand || "").startsWith("policy:")) {
    const {
      explainSdlcPolicy,
      loadSdlcPolicy,
      policyProjectRoot,
      writeDefaultSdlcPolicy
    } = await import("../../sdlc/policy.js");
    const projectRoot = policyProjectRoot(context.inputPath || ".");
    if (commandArgs.sdlcCommand === "policy:init") {
      const result = writeDefaultSdlcPolicy(projectRoot);
      console.log(stableStringify(result));
      return result.ok ? 0 : 1;
    }
    if (commandArgs.sdlcCommand === "policy:check") {
      const info = loadSdlcPolicy(projectRoot);
      const result = {
        type: "sdlc_policy_check",
        ok: info.exists && info.diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        exists: info.exists,
        path: info.path,
        status: info.status,
        mode: info.mode,
        diagnostics: info.diagnostics
      };
      if (json) {
        console.log(stableStringify(result));
      } else if (result.ok) {
        console.log(`SDLC policy is valid: ${result.path}`);
      } else {
        console.error(stableStringify(result));
      }
      return result.ok ? 0 : 1;
    }
    if (commandArgs.sdlcCommand === "policy:explain") {
      const result = explainSdlcPolicy(projectRoot);
      if (json) {
        console.log(stableStringify(result));
      } else {
        printPolicyExplain(result);
      }
      return result.ok ? 0 : 1;
    }
  }

  if (commandArgs.sdlcCommand === "gate") {
    const { runSdlcGate } = await import("../../sdlc/gate.js");
    const result = await runSdlcGate(context.inputPath || ".", {
      base,
      head,
      sdlcIds: flagValues(args, "--sdlc-id"),
      exemption,
      requireAdopted: args.includes("--require-adopted")
    });
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "prep:commit") {
    const { runSdlcCommitPrep } = await import("../../sdlc/prep.js");
    const result = runSdlcCommitPrep(context.inputPath || ".", {
      base,
      head
    });
    if (json) {
      console.log(stableStringify(result));
    } else {
      printCommitPrep(result);
    }
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "audit") {
    const { auditWorkspace } = await import("../../sdlc/audit.js");
    const resolved = resolveSdlcWorkspace(sdlcRoot);
    if (!resolved) {
      return 1;
    }
    const result = auditWorkspace(sdlcRoot, resolved);
    if (json) {
      console.log(stableStringify(result));
    } else {
      printSdlcAudit(result);
    }
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "link") {
    const { linkSdlcRecord } = await import("../../sdlc/link.js");
    const result = linkSdlcRecord(sdlcRoot, commandArgs.sdlcFromId, commandArgs.sdlcToId, {
      write: args.includes("--write")
    });
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "complete") {
    const { completeTask } = await import("../../sdlc/complete.js");
    const result = completeTask(sdlcRoot, commandArgs.sdlcId, verification || "", {
      write: args.includes("--write") && !dryRun,
      actor,
      note
    });
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "start") {
    const { startTask } = await import("../../sdlc/start.js");
    const result = startTask(sdlcRoot, commandArgs.sdlcId, {
      write: args.includes("--write") && !dryRun,
      dryRun,
      actor,
      note
    });
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "plan:create") {
    const { createPlan } = await import("../../sdlc/plan.js");
    const result = createPlan(sdlcRoot, commandArgs.sdlcId, commandArgs.sdlcSlug, {
      write: args.includes("--write") && !dryRun
    });
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "plan:explain") {
    const { explainPlan } = await import("../../sdlc/plan.js");
    const result = explainPlan(sdlcRoot, commandArgs.sdlcId);
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (String(commandArgs.sdlcCommand || "").startsWith("plan:step:")) {
    const { transitionPlanStep } = await import("../../sdlc/plan.js");
    if (commandArgs.sdlcCommand === "plan:step:skip" && !note) {
      console.log(stableStringify({ ok: false, error: "sdlc plan step skip requires --note <reason>" }));
      return 1;
    }
    const result = transitionPlanStep(sdlcRoot, commandArgs.sdlcId, commandArgs.sdlcStepId, commandArgs.sdlcTargetStatus, {
      write: args.includes("--write") && !dryRun,
      dryRun,
      actor,
      note
    });
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "transition") {
    const { transitionStatement } = await import("../../sdlc/transition.js");
    const result = transitionStatement(sdlcRoot, commandArgs.sdlcId, commandArgs.sdlcTargetStatus, {
      actor,
      note,
      dryRun
    });
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "check") {
    const { checkWorkspace } = await import("../../sdlc/check.js");
    const resolved = resolveSdlcWorkspace(sdlcRoot);
    if (!resolved) {
      return 1;
    }
    const result = checkWorkspace(sdlcRoot, resolved);
    console.log(stableStringify(result));
    return strict && (!result.ok || result.warnings.length > 0) ? 1 : 0;
  }

  if (commandArgs.sdlcCommand === "explain") {
    const { explain } = await import("../../sdlc/explain.js");
    const resolved = resolveSdlcWorkspace(sdlcRoot);
    if (!resolved) {
      return 1;
    }
    const result = explain(sdlcRoot, resolved, commandArgs.sdlcId, {
      includeHistory: includeHistory(args)
    });
    if (args.includes("--brief") && result.ok) {
      console.log(stableStringify({
        id: result.id,
        status: result.status,
        next_action: result.next_action
      }));
    } else {
      console.log(stableStringify(result));
    }
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "archive") {
    const { archiveBatch, archiveEligibleStatements } = await import("../../archive/archive.js");
    const resolved = resolveSdlcWorkspace(sdlcRoot);
    if (!resolved) {
      return 1;
    }
    const ids = id
      ? [id]
      : archiveEligibleStatements(resolved, {
          before,
          statuses: status ? status.split(",") : null
        });
    const result = archiveBatch(sdlcRoot, ids, { dryRun, by: actor, reason: note });
    console.log(stableStringify({ candidates: ids, ...result }));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "unarchive") {
    const { unarchive } = await import("../../archive/unarchive.js");
    const result = unarchive(sdlcRoot, commandArgs.sdlcId, {});
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "compact") {
    const { compact } = await import("../../archive/compact.js");
    const result = compact(path.resolve(commandArgs.sdlcArchiveFile));
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "new") {
    const { scaffoldNew } = await import("../../sdlc/scaffold.js");
    const result = scaffoldNew(sdlcRoot, commandArgs.sdlcNewKind, commandArgs.sdlcNewSlug);
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "adopt") {
    const { sdlcAdopt } = await import("../../sdlc/adopt.js");
    const result = sdlcAdopt(sdlcRoot);
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "release") {
    const { runRelease } = await import("../../sdlc/release.js");
    const result = runRelease(sdlcRoot, {
      appVersion,
      sinceTag,
      dryRun,
      actor
    });
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  throw new Error(`Unknown sdlc command '${commandArgs.sdlcCommand}'`);
}

/**
 * @param {AnyRecord} result
 */
function printSdlcAudit(result) {
  console.log("SDLC audit");
  console.log(`Workspace: ${result.workspaceRoot}`);
  console.log(`Draft requirements with completed task evidence: ${result.counts?.draftRequirementsWithCompletedTasks || 0}`);
  console.log(`Draft acceptance criteria with completed task evidence: ${result.counts?.draftAcceptanceCriteriaWithCompletedTasks || 0}`);
  console.log(`Approved acceptance criteria with draft parent requirements: ${result.counts?.approvedAcceptanceCriteriaWithDraftRequirements || 0}`);
  console.log(`Done tasks with draft refs: ${result.counts?.doneTasksWithDraftReferences || 0}`);
  console.log(`Remaining draft backlog: ${result.counts?.remainingDraftPitches || 0} pitch(es), ${result.counts?.remainingDraftRequirements || 0} requirement(s), ${result.counts?.remainingDraftAcceptanceCriteria || 0} acceptance criterion/criteria`);
  const findings = [
    ...(result.findings?.draftRequirementsWithCompletedTasks || []),
    ...(result.findings?.draftAcceptanceCriteriaWithCompletedTasks || []),
    ...(result.findings?.approvedAcceptanceCriteriaWithDraftRequirements || []),
    ...(result.findings?.doneTasksWithDraftReferences || [])
  ];
  if (findings.length > 0) {
    console.log("Actionable findings:");
    for (const finding of findings.slice(0, 10)) {
      console.log(`- ${finding.id}: ${finding.recommendedCommand || "review status"}`);
    }
  } else {
    console.log("Actionable findings: none");
  }
}

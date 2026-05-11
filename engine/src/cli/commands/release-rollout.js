// @ts-check

import fs from "node:fs";
import path from "node:path";

import {
  buildPackageUpdateCliPayload,
  CLI_PACKAGE_NAME,
  isPackageVersion,
  latestTopogramCliVersion
} from "./package.js";
import {
  commandDiagnostic,
  currentGitHead,
  discoverTopogramCliVersionConsumers,
  expectedConsumerWorkflowName,
  hasStagedGitChanges,
  inspectConsumerCi,
  inspectGitUpstreamAhead,
  inspectGitWorktreeClean,
  messageFromError,
  runGit,
  waitForConsumerCi
} from "./release-shared.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 * @typedef {{ consumer?: string, step: string, status: "start"|"ok"|"skip"|"waiting"|"error", message: string, elapsedMs?: number, [key: string]: any }} ReleaseRollProgress
 */

/**
 * @param {{ onProgress?: ((event: ReleaseRollProgress) => void)|null, captureProgress?: boolean }} options
 * @param {ReleaseRollProgress} event
 * @returns {void}
 */
function notifyProgress(options, event) {
  if (typeof options.onProgress === "function") {
    options.onProgress(event);
  }
}

/**
 * @param {AnyRecord} item
 * @param {{ onProgress?: ((event: ReleaseRollProgress) => void)|null, captureProgress?: boolean }} options
 * @param {ReleaseRollProgress["step"]} step
 * @param {ReleaseRollProgress["status"]} status
 * @param {string} message
 * @param {AnyRecord} [detail]
 * @returns {ReleaseRollProgress}
 */
function recordProgress(item, options, step, status, message, detail = {}) {
  /** @type {ReleaseRollProgress} */
  const event = {
    consumer: item.name,
    step,
    status,
    message
  };
  if (typeof detail.elapsedMs === "number") {
    event.elapsedMs = detail.elapsedMs;
  }
  if (typeof detail.headSha === "string") {
    event.headSha = detail.headSha;
  }
  if (typeof detail.expectedWorkflow === "string") {
    event.expectedWorkflow = detail.expectedWorkflow;
  }
  if (detail.run && typeof detail.run === "object") {
    event.run = {
      workflowName: detail.run.workflowName || null,
      status: detail.run.status || null,
      conclusion: detail.run.conclusion || null,
      headSha: detail.run.headSha || null,
      url: detail.run.url || null
    };
  }
  if (options.captureProgress !== true) {
    notifyProgress(options, event);
    return event;
  }
  if (!Array.isArray(item.progress)) {
    item.progress = [];
  }
  item.progress.push(event);
  notifyProgress(options, event);
  return event;
}

/**
 * @param {Array<AnyRecord>} consumers
 * @param {{ version: string, push: boolean, watch: boolean }} options
 * @returns {AnyRecord}
 */
function buildRecoverySummary(consumers, options) {
  /**
   * @param {(consumer: AnyRecord) => boolean} predicate
   * @returns {string[]}
   */
  const namesFor = (predicate) => consumers.filter(predicate).map((consumer) => String(consumer.name));
  return {
    version: options.version,
    alreadyCurrent: namesFor((consumer) => consumer.alreadyCurrent === true),
    alreadyPushed: namesFor((consumer) => consumer.alreadyPushed === true),
    updated: namesFor((consumer) => consumer.updated === true),
    committed: namesFor((consumer) => consumer.committed === true),
    pushed: namesFor((consumer) => consumer.pushed === true),
    recoveredPushes: namesFor((consumer) => consumer.recoveredPush === true),
    needsAttention: namesFor((consumer) => (
      /** @type {Array<AnyRecord>} */ (consumer.diagnostics || [])
    ).some((diagnostic) => diagnostic.severity === "error")),
    resumeCommand: `topogram release roll-consumers ${options.version}${options.push ? "" : " --no-push"}${options.watch ? " --watch" : ""}`,
    asyncVerificationCommand: "topogram release status --strict",
    watchGuidance: options.watch
      ? "If CI waiting is too slow or interrupted, rerun roll-consumers without --watch, then verify with release status --strict."
      : "This rollout did not wait for CI. Verify consumers after workflows finish with release status --strict."
  };
}

/**
 * @param {string} requested
 * @param {{ cwd?: string, push?: boolean, watch?: boolean, onProgress?: ((event: ReleaseRollProgress) => void)|null, captureProgress?: boolean }} [options]
 * @returns {{ ok: boolean, packageName: string, requestedVersion: string, requestedLatest: boolean, pushed: boolean, watched: boolean, consumers: Array<AnyRecord>, diagnostics: Array<AnyRecord>, errors: string[], recovery: AnyRecord|null }}
 */
export function buildReleaseRollConsumersPayload(requested, options = {}) {
  const cwd = options.cwd || process.cwd();
  const push = options.push !== false;
  const watch = Boolean(options.watch);
  const requestedLatest = requested === "latest" || requested === "--latest";
  /** @type {Array<AnyRecord>} */
  const diagnostics = [];
  if (watch && !push) {
    diagnostics.push({
      code: "release_roll_watch_requires_push",
      severity: "error",
      message: "`topogram release roll-consumers --watch` requires pushing consumer commits.",
      path: "release roll-consumers",
      suggestedFix: "Remove --no-push or run without --watch and verify consumer CI separately."
    });
    return {
      ok: false,
      packageName: CLI_PACKAGE_NAME,
      requestedVersion: requestedLatest ? "latest" : requested,
      requestedLatest,
      pushed: push,
      watched: watch,
      consumers: [],
      diagnostics,
      errors: diagnostics.map((diagnostic) => diagnostic.message),
      recovery: null
    };
  }
  const version = requestedLatest
    ? latestTopogramCliVersion(cwd)
    : requested;
  if (!isPackageVersion(version)) {
    throw new Error("topogram release roll-consumers requires <version> or --latest.");
  }
  /** @type {Array<AnyRecord>} */
  const consumers = [];
  for (const consumer of discoverTopogramCliVersionConsumers(cwd)) {
    const workflow = expectedConsumerWorkflowName(consumer.name);
    /** @type {AnyRecord} */
    const item = {
      name: consumer.name,
      root: consumer.root,
      workflow,
      updated: false,
      committed: false,
      pushed: false,
      commit: null,
      update: null,
      ci: null,
      alreadyCurrent: false,
      alreadyPushed: false,
      recoveredPush: false,
      upstreamAhead: null,
      diagnostics: []
    };
    consumers.push(item);
    recordProgress(item, options, "inspect", "start", `${consumer.name}: inspecting repository and package metadata.`);
    if (!consumer.root || !fs.existsSync(consumer.root)) {
      item.diagnostics.push({
        code: "release_consumer_repo_missing",
        severity: "error",
        message: `First-party consumer repo ${consumer.name} was not found.`,
        path: consumer.path,
        suggestedFix: `Clone ${consumer.name} beside the topogram repo, then rerun roll-consumers.`
      });
      diagnostics.push(...item.diagnostics);
      recordProgress(item, options, "inspect", "error", `${consumer.name}: repository not found.`);
      continue;
    }
    const packagePath = path.join(consumer.root, "package.json");
    if (!fs.existsSync(packagePath)) {
      item.diagnostics.push({
        code: "release_consumer_package_missing",
        severity: "error",
        message: `First-party consumer repo ${consumer.name} does not contain package.json.`,
        path: packagePath,
        suggestedFix: "Only package-backed first-party consumers can be rolled by this command."
      });
      diagnostics.push(...item.diagnostics);
      recordProgress(item, options, "inspect", "error", `${consumer.name}: package.json missing.`);
      continue;
    }
    const clean = inspectGitWorktreeClean(consumer.root);
    if (clean.ok !== true) {
      item.diagnostics.push({
        code: "release_consumer_worktree_dirty",
        severity: "error",
        message: clean.error || `First-party consumer repo ${consumer.name} has uncommitted changes.`,
        path: consumer.root,
        suggestedFix: "Commit, stash, or discard unrelated consumer changes before rolling the CLI version."
      });
      diagnostics.push(...item.diagnostics);
      recordProgress(item, options, "inspect", "error", `${consumer.name}: worktree is dirty.`);
      continue;
    }
    recordProgress(item, options, "inspect", "ok", `${consumer.name}: worktree is clean.`);
    try {
      recordProgress(item, options, "update", "start", `${consumer.name}: updating ${CLI_PACKAGE_NAME} to ${version} and running package checks.`);
      item.update = buildPackageUpdateCliPayload(version, { cwd: consumer.root });
      item.updated = true;
      recordProgress(item, options, "update", "ok", `${consumer.name}: package update/check completed.`);
    } catch (error) {
      item.diagnostics.push({
        code: "release_consumer_update_failed",
        severity: "error",
        message: `Failed to update ${consumer.name}: ${messageFromError(error)}`,
        path: consumer.root,
        suggestedFix: "Fix the consumer update/check failure, then rerun roll-consumers."
      });
      diagnostics.push(...item.diagnostics);
      recordProgress(item, options, "update", "error", `${consumer.name}: package update/check failed.`);
      continue;
    }
    const filesToStage = ["package.json", "package-lock.json", "topogram-cli.version"]
      .filter((file) => fs.existsSync(path.join(consumer.root || "", file)));
    recordProgress(item, options, "stage", "start", `${consumer.name}: staging package pin changes.`);
    const addResult = runGit(["add", ...filesToStage], consumer.root);
    if (addResult.status !== 0) {
      item.diagnostics.push(commandDiagnostic({
        code: "release_consumer_git_add_failed",
        severity: "error",
        message: `Failed to stage ${consumer.name} CLI update.`,
        path: consumer.root,
        suggestedFix: "Inspect git output, stage the changed files manually, then commit and push.",
        result: addResult
      }));
      diagnostics.push(...item.diagnostics);
      recordProgress(item, options, "stage", "error", `${consumer.name}: staging failed.`);
      continue;
    }
    const staged = hasStagedGitChanges(consumer.root);
    if (!staged.ok) {
      item.diagnostics.push(commandDiagnostic({
        code: "release_consumer_git_diff_failed",
        severity: "error",
        message: `Could not inspect staged changes for ${consumer.name}.`,
        path: consumer.root,
        suggestedFix: "Inspect git status manually before committing.",
        result: staged.result
      }));
      diagnostics.push(...item.diagnostics);
      recordProgress(item, options, "stage", "error", `${consumer.name}: could not inspect staged changes.`);
      continue;
    }
    if (!staged.changed) {
      item.alreadyCurrent = true;
      item.commit = currentGitHead(consumer.root);
      recordProgress(item, options, "stage", "skip", `${consumer.name}: already pinned to ${CLI_PACKAGE_NAME}@${version}; no commit needed.`);
      if (push) {
        const ahead = inspectGitUpstreamAhead(consumer.root);
        item.upstreamAhead = ahead.ok ? ahead.ahead : null;
        if (!ahead.ok) {
          item.diagnostics.push(commandDiagnostic({
            code: "release_consumer_git_upstream_unavailable",
            severity: "warning",
            message: `Could not inspect whether ${consumer.name} has unpushed commits.`,
            path: consumer.root,
            suggestedFix: "Inspect git status manually; if the consumer branch is ahead, push it before verifying CI.",
            result: ahead.result
          }));
          diagnostics.push(...item.diagnostics.slice(-1));
        } else if ((ahead.ahead || 0) > 0) {
          recordProgress(item, options, "push", "start", `${consumer.name}: branch is ahead of upstream; pushing existing rollout commit.`);
          const pushResult = runGit(["push", "origin", "main"], consumer.root);
          if (pushResult.status !== 0) {
            item.diagnostics.push(commandDiagnostic({
              code: "release_consumer_git_push_failed",
              severity: "error",
              message: `Failed to push ${consumer.name} existing CLI update.`,
              path: consumer.root,
              suggestedFix: "Push the consumer update manually, then confirm its verification workflow passes.",
              result: pushResult
            }));
            diagnostics.push(...item.diagnostics);
            recordProgress(item, options, "push", "error", `${consumer.name}: push failed.`);
            continue;
          }
          item.pushed = true;
          item.recoveredPush = true;
          recordProgress(item, options, "push", "ok", `${consumer.name}: pushed existing rollout commit.`);
        } else {
          item.alreadyPushed = true;
          recordProgress(item, options, "push", "skip", `${consumer.name}: branch already matches upstream.`);
        }
      }
      recordProgress(item, options, watch ? "watch-ci" : "check-ci", "start", `${consumer.name}: ${watch ? "watching" : "checking"} verification workflow.`);
      item.ci = watch
        ? waitForConsumerCi(consumer, {
            onProgress: (event) => recordProgress(item, options, "watch-ci", event.status === "ok" ? "ok" : event.status === "error" ? "error" : "waiting", event.message, event)
          })
        : inspectConsumerCi(consumer, { strict: false });
      item.diagnostics.push(...item.ci.diagnostics);
      diagnostics.push(...item.ci.diagnostics);
      recordProgress(item, options, watch ? "watch-ci" : "check-ci", item.ci.ok === false ? "error" : "ok", `${consumer.name}: verification ${item.ci.ok === false ? "reported issues" : "checked"}.`);
      continue;
    }
    recordProgress(item, options, "stage", "ok", `${consumer.name}: staged CLI pin changes.`);
    recordProgress(item, options, "commit", "start", `${consumer.name}: committing CLI rollout.`);
    const commitResult = runGit(["commit", "-m", `Update Topogram CLI to ${version}`], consumer.root);
    if (commitResult.status !== 0) {
      item.diagnostics.push(commandDiagnostic({
        code: "release_consumer_git_commit_failed",
        severity: "error",
        message: `Failed to commit ${consumer.name} CLI update.`,
        path: consumer.root,
        suggestedFix: "Inspect git output, commit the consumer update manually, then push.",
        result: commitResult
      }));
      diagnostics.push(...item.diagnostics);
      recordProgress(item, options, "commit", "error", `${consumer.name}: commit failed.`);
      continue;
    }
    item.committed = true;
    item.commit = currentGitHead(consumer.root);
    recordProgress(item, options, "commit", "ok", `${consumer.name}: committed ${item.commit || "CLI rollout"}.`);
    if (push) {
      recordProgress(item, options, "push", "start", `${consumer.name}: pushing rollout commit.`);
      const pushResult = runGit(["push", "origin", "main"], consumer.root);
      if (pushResult.status !== 0) {
        item.diagnostics.push(commandDiagnostic({
          code: "release_consumer_git_push_failed",
          severity: "error",
          message: `Failed to push ${consumer.name} CLI update.`,
          path: consumer.root,
          suggestedFix: "Push the consumer update manually, then confirm its verification workflow passes.",
          result: pushResult
        }));
        diagnostics.push(...item.diagnostics);
        recordProgress(item, options, "push", "error", `${consumer.name}: push failed.`);
        continue;
      }
      item.pushed = true;
      recordProgress(item, options, "push", "ok", `${consumer.name}: pushed rollout commit.`);
    }
    recordProgress(item, options, watch ? "watch-ci" : "check-ci", "start", `${consumer.name}: ${watch ? "watching" : "checking"} verification workflow.`);
    item.ci = watch
      ? waitForConsumerCi(consumer, {
          onProgress: (event) => recordProgress(item, options, "watch-ci", event.status === "ok" ? "ok" : event.status === "error" ? "error" : "waiting", event.message, event)
        })
      : inspectConsumerCi(consumer, { strict: false });
    item.diagnostics.push(...item.ci.diagnostics);
    diagnostics.push(...item.ci.diagnostics);
    recordProgress(item, options, watch ? "watch-ci" : "check-ci", item.ci.ok === false ? "error" : "ok", `${consumer.name}: verification ${item.ci.ok === false ? "reported issues" : "checked"}.`);
  }
  const errors = diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => diagnostic.message);
  return {
    ok: errors.length === 0,
    packageName: CLI_PACKAGE_NAME,
    requestedVersion: version,
    requestedLatest,
    pushed: push,
    watched: watch,
    consumers,
    diagnostics,
    errors,
    recovery: buildRecoverySummary(consumers, { version, push, watch })
  };
}

/**
 * @param {ReleaseRollProgress} event
 * @returns {void}
 */
export function printReleaseRollProgress(event) {
  console.error(`[roll-consumers] ${event.message}`);
}

/**
 * @param {ReturnType<typeof buildReleaseRollConsumersPayload>} payload
 * @returns {void}
 */
export function printReleaseRollConsumers(payload) {
  console.log(payload.ok ? "Topogram consumer rollout completed." : "Topogram consumer rollout found issues.");
  if (payload.requestedLatest) {
    console.log(`Resolved latest version: ${payload.requestedVersion}`);
  }
  console.log(`Package: ${payload.packageName}@${payload.requestedVersion}`);
  console.log(`Push: ${payload.pushed ? "enabled" : "disabled"}`);
  console.log(`Watch: ${payload.watched ? "enabled" : "disabled"}`);
  for (const consumer of payload.consumers) {
    const state = consumer.alreadyCurrent
      ? consumer.pushed ? "pushed existing commit" : consumer.alreadyPushed ? "current" : "current"
      : consumer.committed
        ? consumer.pushed ? "pushed" : "committed"
        : consumer.updated ? "updated" : "skipped";
    console.log(`- ${consumer.name}: ${state}`);
    if (consumer.update) {
      console.log(`  Checks run: ${consumer.update.scriptsRun.join(", ") || "none"}`);
    }
    if (consumer.commit) {
      console.log(`  Commit: ${consumer.commit}`);
    }
    if (consumer.ci?.run?.url) {
      const run = consumer.ci.run;
      console.log(`  CI: ${run.workflowName || consumer.workflow} ${run.status || "unknown"}/${run.conclusion || "unknown"} ${run.url}`);
    } else if (consumer.workflow) {
      console.log(`  CI: ${consumer.workflow} not found`);
    }
    for (const diagnostic of consumer.diagnostics || []) {
      const label = diagnostic.severity === "error" ? "Error" : diagnostic.severity === "warning" ? "Warning" : "Note";
      console.log(`  ${label}: ${diagnostic.message}`);
    }
  }
  if (payload.recovery) {
    console.log("Recovery:");
    console.log(`  Resume: ${payload.recovery.resumeCommand}`);
    console.log(`  Verify: ${payload.recovery.asyncVerificationCommand}`);
    if ((payload.recovery.needsAttention || []).length > 0) {
      console.log(`  Needs attention: ${payload.recovery.needsAttention.join(", ")}`);
    }
    console.log(`  ${payload.recovery.watchGuidance}`);
  }
}

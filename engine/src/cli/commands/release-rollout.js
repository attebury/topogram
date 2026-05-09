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
  inspectGitWorktreeClean,
  messageFromError,
  runGit,
  waitForConsumerCi
} from "./release-shared.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {string} requested
 * @param {{ cwd?: string, push?: boolean, watch?: boolean }} [options]
 * @returns {{ ok: boolean, packageName: string, requestedVersion: string, requestedLatest: boolean, pushed: boolean, watched: boolean, consumers: Array<AnyRecord>, diagnostics: Array<AnyRecord>, errors: string[] }}
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
      errors: diagnostics.map((diagnostic) => diagnostic.message)
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
      diagnostics: []
    };
    consumers.push(item);
    if (!consumer.root || !fs.existsSync(consumer.root)) {
      item.diagnostics.push({
        code: "release_consumer_repo_missing",
        severity: "error",
        message: `First-party consumer repo ${consumer.name} was not found.`,
        path: consumer.path,
        suggestedFix: `Clone ${consumer.name} beside the topogram repo, then rerun roll-consumers.`
      });
      diagnostics.push(...item.diagnostics);
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
      continue;
    }
    try {
      item.update = buildPackageUpdateCliPayload(version, { cwd: consumer.root });
      item.updated = true;
    } catch (error) {
      item.diagnostics.push({
        code: "release_consumer_update_failed",
        severity: "error",
        message: `Failed to update ${consumer.name}: ${messageFromError(error)}`,
        path: consumer.root,
        suggestedFix: "Fix the consumer update/check failure, then rerun roll-consumers."
      });
      diagnostics.push(...item.diagnostics);
      continue;
    }
    const filesToStage = ["package.json", "package-lock.json", "topogram-cli.version"]
      .filter((file) => fs.existsSync(path.join(consumer.root || "", file)));
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
      continue;
    }
    if (!staged.changed) {
      item.ci = watch
        ? waitForConsumerCi(consumer)
        : inspectConsumerCi(consumer, { strict: false });
      item.diagnostics.push(...item.ci.diagnostics);
      diagnostics.push(...item.ci.diagnostics);
      continue;
    }
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
      continue;
    }
    item.committed = true;
    item.commit = currentGitHead(consumer.root);
    if (push) {
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
        continue;
      }
      item.pushed = true;
    }
    item.ci = watch
      ? waitForConsumerCi(consumer)
      : inspectConsumerCi(consumer, { strict: false });
    item.diagnostics.push(...item.ci.diagnostics);
    diagnostics.push(...item.ci.diagnostics);
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
    errors
  };
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
    const state = consumer.committed
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
}

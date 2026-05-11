// @ts-check

import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  latestWorkflowRun,
  workflowRunJobs
} from "../../github-client.js";
import {
  githubRepoSlug,
  releaseConsumerRepos,
  releaseConsumerWorkflowJobs,
  releaseConsumerWorkflowName
} from "../../topogram-config.js";

const REPO_ROOT = decodeURIComponent(new URL("../../../../", import.meta.url).pathname);

/**
 * @typedef {Record<string, any>} AnyRecord
 * @typedef {{ consumer?: string, step?: string, status?: string, message: string, elapsedMs?: number, headSha?: string|null, expectedWorkflow?: string|null, run?: AnyRecord|null }} ReleaseProgressEvent
 */

/**
 * @param {unknown} error
 * @returns {string}
 */
export function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {string} version
 * @param {string} cwd
 * @returns {{ tag: string, local: boolean|null, remote: boolean|null, diagnostics: Array<AnyRecord> }}
 */
export function inspectReleaseGitTag(version, cwd) {
  const tag = `topogram-v${version}`;
  const diagnostics = [];
  let local = null;
  let remote = null;
  const localResult = childProcess.spawnSync("git", ["tag", "--list", tag], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, PATH: process.env.PATH || "" }
  });
  if (localResult.status === 0) {
    local = String(localResult.stdout || "").trim() === tag;
  } else {
    diagnostics.push({
      code: "release_local_tag_unavailable",
      severity: "warning",
      message: `Could not inspect local git tag ${tag}.`,
      path: cwd,
      suggestedFix: "Run from a git checkout with git available."
    });
  }
  const remoteResult = childProcess.spawnSync("git", ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, PATH: process.env.PATH || "" }
  });
  if (remoteResult.status === 0) {
    remote = true;
  } else if (remoteResult.status === 2) {
    remote = false;
  } else {
    diagnostics.push({
      code: "release_remote_tag_unavailable",
      severity: "warning",
      message: `Could not inspect remote git tag ${tag}.`,
      path: cwd,
      suggestedFix: "Check git remote access, then rerun `topogram release status`."
    });
  }
  return { tag, local, remote, diagnostics };
}

/**
 * @param {string} name
 * @returns {string|null}
 */
export function expectedConsumerWorkflowName(name) {
  return releaseConsumerWorkflowName(name);
}

/**
 * @param {string} name
 * @returns {string[]}
 */
function expectedConsumerWorkflowJobs(name) {
  return releaseConsumerWorkflowJobs(name);
}

/**
 * @param {{ name: string }|string} consumer
 * @returns {string}
 */
function consumerGithubRepoSlug(consumer) {
  const name = typeof consumer === "string" ? consumer : consumer.name;
  return githubRepoSlug(name);
}

/**
 * @param {string[]} args
 * @param {string} cwd
 * @returns {ReturnType<typeof childProcess.spawnSync>}
 */
export function runGit(args, cwd) {
  return childProcess.spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, PATH: process.env.PATH || "" }
  });
}

/**
 * @param {string} cwd
 * @returns {{ ok: boolean, dirty: boolean|null, error: string|null }}
 */
export function inspectGitWorktreeClean(cwd) {
  const result = runGit(["status", "--porcelain"], cwd);
  if (result.status !== 0) {
    return {
      ok: false,
      dirty: null,
      error: `Could not inspect git status: ${commandOutput(result) || "unknown error"}`
    };
  }
  const dirty = String(result.stdout || "").trim().length > 0;
  return {
    ok: !dirty,
    dirty,
    error: dirty ? "Consumer repo has uncommitted changes." : null
  };
}

/**
 * @param {string} cwd
 * @returns {{ ok: boolean, changed: boolean, result: ReturnType<typeof childProcess.spawnSync> }}
 */
export function hasStagedGitChanges(cwd) {
  const result = runGit(["diff", "--cached", "--quiet"], cwd);
  return {
    ok: result.status === 0 || result.status === 1,
    changed: result.status === 1,
    result
  };
}

/**
 * @param {string} cwd
 * @returns {string|null}
 */
export function currentGitHead(cwd) {
  const result = runGit(["rev-parse", "HEAD"], cwd);
  return result.status === 0 ? String(result.stdout || "").trim() || null : null;
}

/**
 * @param {string} cwd
 * @returns {{ ok: boolean, ahead: number|null, result: ReturnType<typeof childProcess.spawnSync> }}
 */
export function inspectGitUpstreamAhead(cwd) {
  const result = runGit(["rev-list", "--count", "@{u}..HEAD"], cwd);
  if (result.status !== 0) {
    return { ok: false, ahead: null, result };
  }
  const ahead = Number.parseInt(String(result.stdout || "").trim(), 10);
  return {
    ok: Number.isFinite(ahead),
    ahead: Number.isFinite(ahead) ? ahead : null,
    result
  };
}

/**
 * @param {{ code: string, severity: "error"|"warning", message: string, path: string|null, suggestedFix: string, result: ReturnType<typeof childProcess.spawnSync> }} input
 * @returns {{ code: string, severity: "error"|"warning", message: string, path: string|null, suggestedFix: string }}
 */
export function commandDiagnostic(input) {
  const output = commandOutput(input.result);
  return {
    code: input.code,
    severity: input.severity,
    message: output ? `${input.message}\n${output}` : input.message,
    path: input.path,
    suggestedFix: input.suggestedFix
  };
}

/**
 * @param {ReturnType<typeof childProcess.spawnSync>} result
 * @returns {string}
 */
function commandOutput(result) {
  return [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n").trim();
}

/**
 * @param {number} ms
 * @returns {void}
 */
function sleepSync(ms) {
  if (ms <= 0) {
    return;
  }
  const buffer = new SharedArrayBuffer(4);
  const view = new Int32Array(buffer);
  Atomics.wait(view, 0, 0, ms);
}

/**
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function positiveIntegerEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * @param {{ name: string, root?: string|null, workflow?: string|null }} consumer
 * @param {{ timeoutMs?: number, intervalMs?: number, onProgress?: ((event: ReleaseProgressEvent) => void)|null }} [options]
 * @returns {ReturnType<typeof inspectConsumerCi>}
 */
export function waitForConsumerCi(consumer, options = {}) {
  const timeoutMs = options.timeoutMs || positiveIntegerEnv("TOPOGRAM_RELEASE_WATCH_TIMEOUT_MS", 20 * 60 * 1000);
  const intervalMs = options.intervalMs || positiveIntegerEnv("TOPOGRAM_RELEASE_WATCH_INTERVAL_MS", 5000);
  const startedAt = Date.now();
  let latest = inspectConsumerCi(consumer, { strict: false });
  const notify = typeof options.onProgress === "function" ? options.onProgress : null;
  while (true) {
    const currentRun = latest.run &&
      latest.headSha &&
      latest.run?.headSha &&
      latest.run.headSha === latest.headSha;
    if (currentRun && latest.run?.status === "completed") {
      notify?.({
        consumer: consumer.name,
        step: "watch-ci",
        status: "ok",
        message: `${consumer.name}: verification workflow completed on current commit.`,
        elapsedMs: Date.now() - startedAt,
        headSha: latest.headSha,
        expectedWorkflow: latest.expectedWorkflow,
        run: latest.run
      });
      return inspectConsumerCi(consumer, { strict: true });
    }
    if (Date.now() - startedAt >= timeoutMs) {
      const strictLatest = inspectConsumerCi(consumer, { strict: true });
      strictLatest.diagnostics.push({
        code: "release_consumer_ci_watch_timeout",
        severity: "error",
        message: `${consumer.name} verification workflow did not complete on the current commit before the watch timeout.`,
        path: strictLatest.run?.url || consumerGithubRepoSlug(consumer),
        suggestedFix: "Open the consumer workflow, fix failures if needed, then rerun release status. If you only need to push and verify later, rerun roll-consumers with --no-watch."
      });
      strictLatest.ok = false;
      notify?.({
        consumer: consumer.name,
        step: "watch-ci",
        status: "error",
        message: `${consumer.name}: verification watch timed out; rerun with --no-watch to continue asynchronously.`,
        elapsedMs: Date.now() - startedAt,
        headSha: strictLatest.headSha,
        expectedWorkflow: strictLatest.expectedWorkflow,
        run: strictLatest.run
      });
      return strictLatest;
    }
    notify?.({
      consumer: consumer.name,
      step: "watch-ci",
      status: "waiting",
      message: `${consumer.name}: waiting for ${latest.expectedWorkflow || "verification workflow"} on ${latest.headSha || "HEAD"} (${Math.round((Date.now() - startedAt) / 1000)}s elapsed).`,
      elapsedMs: Date.now() - startedAt,
      headSha: latest.headSha,
      expectedWorkflow: latest.expectedWorkflow,
      run: latest.run
    });
    sleepSync(intervalMs);
    latest = inspectConsumerCi(consumer, { strict: false });
  }
}

/**
 * @param {{ name: string, root?: string|null, workflow?: string|null }} consumer
 * @param {{ strict?: boolean }} [options]
 * @returns {{ checked: boolean, ok: boolean|null, expectedWorkflow: string|null, expectedJobs: string[], headSha: string|null, run: AnyRecord|null, diagnostics: Array<AnyRecord> }}
 */
export function inspectConsumerCi(consumer, options = {}) {
  const diagnostics = [];
  const expectedWorkflow = consumer.workflow || expectedConsumerWorkflowName(consumer.name);
  const expectedJobs = expectedConsumerWorkflowJobs(consumer.name);
  const repoSlug = consumerGithubRepoSlug(consumer);
  if (!consumer.root || !fs.existsSync(consumer.root)) {
    return {
      checked: false,
      ok: null,
      expectedWorkflow,
      expectedJobs,
      headSha: null,
      run: null,
      diagnostics: []
    };
  }
  const headSha = currentGitHead(consumer.root);
  if (!headSha) {
    diagnostics.push({
      code: "release_consumer_head_unavailable",
      severity: options.strict ? "error" : "warning",
      message: `Could not inspect local HEAD for ${consumer.name}.`,
      path: consumer.root,
      suggestedFix: "Run from a checked-out consumer git repository."
    });
  }
  if (!expectedWorkflow) {
    diagnostics.push({
      code: "release_consumer_workflow_unknown",
      severity: options.strict ? "error" : "warning",
      message: `No expected verification workflow is configured for ${consumer.name}.`,
      path: consumer.name,
      suggestedFix: "Add the consumer repo to topogram.config.json release.workflows or the built-in release workflow defaults."
    });
    return {
      checked: true,
      ok: false,
      expectedWorkflow,
      expectedJobs,
      headSha,
      run: null,
      diagnostics
    };
  }
  /** @type {AnyRecord|null} */
  let run = null;
  try {
    run = latestWorkflowRun({
      repoSlug,
      branch: "main",
      workflowName: expectedWorkflow,
      cwd: consumer.root
    });
  } catch (error) {
    diagnostics.push({
      code: "release_consumer_ci_unavailable",
      severity: options.strict ? "error" : "warning",
      message: [`Could not inspect ${expectedWorkflow} for ${consumer.name}.`, messageFromError(error)].filter(Boolean).join("\n"),
      path: repoSlug,
      suggestedFix: "Set GITHUB_TOKEN or GH_TOKEN with Actions read access, or run `gh auth login` for local fallback; then rerun release status."
    });
    return {
      checked: true,
      ok: false,
      expectedWorkflow,
      expectedJobs,
      headSha,
      run: null,
      diagnostics
    };
  }
  if (!run) {
    diagnostics.push({
      code: "release_consumer_ci_missing",
      severity: options.strict ? "error" : "warning",
      message: `${consumer.name} has no ${expectedWorkflow} run on main.`,
      path: repoSlug,
      suggestedFix: "Push the consumer repo and wait for its verification workflow."
    });
    return {
      checked: true,
      ok: false,
      expectedWorkflow,
      expectedJobs,
      headSha,
      run: null,
      diagnostics
    };
  }
  if (headSha && run.headSha && run.headSha !== headSha) {
    diagnostics.push({
      code: "release_consumer_ci_head_mismatch",
      severity: options.strict ? "error" : "warning",
      message: `${consumer.name} latest ${expectedWorkflow} run is for ${run.headSha}, not checked-out HEAD ${headSha}.`,
      path: run.url || repoSlug,
      suggestedFix: "Wait for the verification workflow on the current consumer commit, then rerun release status."
    });
  }
  if (run.status !== "completed" || run.conclusion !== "success") {
    diagnostics.push({
      code: "release_consumer_ci_not_successful",
      severity: options.strict ? "error" : "warning",
      message: `${consumer.name} ${expectedWorkflow} is ${run.status || "unknown"}/${run.conclusion || "unknown"}.`,
      path: run.url || repoSlug,
      suggestedFix: "Wait for or fix the consumer verification workflow, then rerun release status."
    });
  }
  if (expectedJobs.length > 0 && run.databaseId) {
    const jobResult = inspectConsumerWorkflowJobs(consumer, run.databaseId, expectedJobs, options);
    if (jobResult.jobs) {
      run.jobs = jobResult.jobs;
    }
    diagnostics.push(...jobResult.diagnostics);
  } else if (expectedJobs.length > 0) {
    diagnostics.push({
      code: "release_consumer_ci_jobs_unavailable",
      severity: options.strict ? "error" : "warning",
      message: `${consumer.name} ${expectedWorkflow} run did not include a database id, so expected jobs could not be inspected.`,
      path: run.url || repoSlug,
      suggestedFix: "Rerun release status after GitHub exposes the workflow run id."
    });
  }
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  return {
    checked: true,
    ok: errorCount === 0 &&
      (!options.strict || (run.status === "completed" && run.conclusion === "success" && (!headSha || !run.headSha || run.headSha === headSha))),
    expectedWorkflow,
    expectedJobs,
    headSha,
    run,
    diagnostics
  };
}

/**
 * @param {{ name: string, root?: string|null }} consumer
 * @param {number|string} runId
 * @param {string[]} expectedJobs
 * @param {{ strict?: boolean }} [options]
 * @returns {{ jobs: Array<AnyRecord>|null, diagnostics: Array<AnyRecord> }}
 */
function inspectConsumerWorkflowJobs(consumer, runId, expectedJobs, options = {}) {
  const diagnostics = [];
  const repoSlug = consumerGithubRepoSlug(consumer);
  let jobs = [];
  try {
    jobs = workflowRunJobs({
      repoSlug,
      runId,
      cwd: consumer.root || process.cwd()
    });
  } catch (error) {
    diagnostics.push({
      code: "release_consumer_ci_jobs_unavailable",
      severity: options.strict ? "error" : "warning",
      message: [`Could not inspect expected jobs for ${consumer.name}.`, messageFromError(error)].filter(Boolean).join("\n"),
      path: repoSlug,
      suggestedFix: "Set GITHUB_TOKEN or GH_TOKEN with Actions read access, or run `gh auth login` for local fallback; then rerun release status."
    });
    return { jobs: null, diagnostics };
  }
  for (const expectedJob of expectedJobs) {
    const job = jobs.find((candidate) => candidate?.name === expectedJob);
    if (!job) {
      diagnostics.push({
        code: "release_consumer_ci_job_missing",
        severity: options.strict ? "error" : "warning",
        message: `${consumer.name} workflow is missing expected job '${expectedJob}'.`,
        path: repoSlug,
        suggestedFix: "Update the consumer workflow or the release-status expected job list, then rerun release status."
      });
      continue;
    }
    if (job.status !== "completed" || job.conclusion !== "success") {
      diagnostics.push({
        code: "release_consumer_ci_job_not_successful",
        severity: options.strict ? "error" : "warning",
        message: `${consumer.name} job '${expectedJob}' is ${job.status || "unknown"}/${job.conclusion || "unknown"}.`,
        path: job.url || repoSlug,
        suggestedFix: "Wait for or fix the expected workflow job, then rerun release status."
      });
    }
  }
  return { jobs, diagnostics };
}

/**
 * @param {string} cwd
 * @returns {Array<{ name: string, root: string|null, path: string, version: string|null, found: boolean }>}
 */
export function discoverTopogramCliVersionConsumers(cwd) {
  /** @type {string[]} */
  const roots = [];
  for (const root of [cwd, REPO_ROOT, path.dirname(REPO_ROOT)]) {
    const resolved = path.resolve(root);
    if (!roots.includes(resolved)) {
      roots.push(resolved);
    }
  }
  const consumers = [];
  for (const name of releaseConsumerRepos(cwd)) {
    let found = null;
    for (const root of roots) {
      const consumerRoot = path.join(root, name);
      const versionPath = path.join(consumerRoot, "topogram-cli.version");
      if (fs.existsSync(consumerRoot) && !fs.existsSync(versionPath)) {
        found = {
          name,
          root: consumerRoot,
          path: versionPath,
          version: null,
          found: false
        };
        break;
      }
      if (!fs.existsSync(versionPath)) {
        continue;
      }
      found = {
        name,
        root: consumerRoot,
        path: versionPath,
        version: fs.readFileSync(versionPath, "utf8").trim() || null,
        found: true
      };
      break;
    }
    consumers.push(found || {
      name,
      root: null,
      path: path.join(roots[0], name, "topogram-cli.version"),
      version: null,
      found: false
    });
  }
  return consumers;
}

/**
 * @param {Array<any>} consumers
 * @returns {{ known: number, pinned: number, matching: number, differing: number, missing: number, allKnownPinned: boolean, matchingNames: string[], differingNames: string[], missingNames: string[] }}
 */
export function summarizeConsumerPins(consumers) {
  const matchingNames = consumers.filter((consumer) => consumer.matchesLocal === true).map((consumer) => consumer.name);
  const differingNames = consumers.filter((consumer) => consumer.matchesLocal === false).map((consumer) => consumer.name);
  const missingNames = consumers.filter((consumer) => !consumer.found || !consumer.version).map((consumer) => consumer.name);
  return {
    known: consumers.length,
    pinned: consumers.filter((consumer) => consumer.found && consumer.version).length,
    matching: matchingNames.length,
    differing: differingNames.length,
    missing: missingNames.length,
    allKnownPinned: consumers.length > 0 && differingNames.length === 0 && missingNames.length === 0,
    matchingNames,
    differingNames,
    missingNames
  };
}

/**
 * @param {Array<any>} consumers
 * @returns {{ checked: number, passing: number, failing: number, unavailable: number, skipped: number, allCheckedAndPassing: boolean, passingNames: string[], failingNames: string[], unavailableNames: string[], skippedNames: string[] }}
 */
export function summarizeConsumerCi(consumers) {
  const checked = consumers.filter((consumer) => consumer.ci?.checked);
  const passingNames = checked.filter((consumer) => consumer.ci?.ok === true).map((consumer) => consumer.name);
  const failingNames = checked.filter((consumer) => consumer.ci?.ok === false && consumer.ci?.run).map((consumer) => consumer.name);
  const unavailableNames = checked.filter((consumer) => consumer.ci?.ok === false && !consumer.ci?.run).map((consumer) => consumer.name);
  const skippedNames = consumers.filter((consumer) => !consumer.ci?.checked).map((consumer) => consumer.name);
  return {
    checked: checked.length,
    passing: passingNames.length,
    failing: failingNames.length,
    unavailable: unavailableNames.length,
    skipped: skippedNames.length,
    allCheckedAndPassing: consumers.length > 0 && checked.length === consumers.length && failingNames.length === 0 && unavailableNames.length === 0,
    passingNames,
    failingNames,
    unavailableNames,
    skippedNames
  };
}

// @ts-check

import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { loadImplementationProvider } from "../example-implementation.js";
import { parsePath } from "../parser.js";
import {
  loadProjectConfig,
  projectConfigOrDefault,
  validateProjectConfig,
  validateProjectOutputOwnership
} from "../project-config.js";
import { resolveWorkspace } from "../resolver.js";
import { validateProjectImplementationTrust } from "../template-trust.js";
import { resolveTopoRoot, resolveWorkspaceContext } from "../workspace-paths.js";
import { checkWorkspace as checkSdlcWorkspace } from "./check.js";
import { readHistory } from "./history.js";
import { loadSdlcPolicy } from "./policy.js";
import { buildSdlcStaleWorkPayload } from "./views.js";

/**
 * @typedef {Object} SdlcGateOptions
 * @property {string|null} [base]
 * @property {string|null} [head]
 * @property {string[]} [sdlcIds]
 * @property {string|null} [exemption]
 * @property {boolean} [requireAdopted]
 * @property {string[]} [changedFiles]
 * @property {string|null} [prBody]
 */

/**
 * @param {string} flag
 * @returns {string}
 */
function envValue(flag) {
  return process.env[flag] || "";
}

/**
 * @param {string} pattern
 * @returns {RegExp}
 */
function globPatternToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`);
}

/**
 * @param {string} file
 * @param {string[]} patterns
 * @returns {boolean}
 */
function matchesAnyProtectedPath(file, patterns) {
  const normalized = file.replace(/\\/g, "/");
  return patterns.some((pattern) => globPatternToRegex(pattern).test(normalized));
}

/**
 * @param {string} projectRoot
 * @param {string|null|undefined} base
 * @param {string|null|undefined} head
 * @returns {{ ok: true, files: string[] } | { ok: false, error: string }}
 */
function gitChangedFiles(projectRoot, base, head) {
  if (!base || !head) {
    return { ok: true, files: [] };
  }
  const result = childProcess.spawnSync("git", ["diff", "--name-only", `${base}...${head}`], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return {
      ok: false,
      error: (result.stderr || result.stdout || `git diff failed with status ${result.status}`).trim()
    };
  }
  return {
    ok: true,
    files: result.stdout.split(/\r?\n/).map(/** @param {string} line */ (line) => line.trim()).filter(Boolean)
  };
}

/**
 * @returns {string|null}
 */
function githubPullRequestBody() {
  const eventPath = envValue("GITHUB_EVENT_PATH");
  if (!eventPath || !fs.existsSync(eventPath)) {
    return null;
  }
  try {
    const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    return typeof event?.pull_request?.body === "string" ? event.pull_request.body : null;
  } catch {
    return null;
  }
}

/**
 * @param {string|null|undefined} body
 * @returns {string[]}
 */
function sdlcIdsFromText(body) {
  if (!body) {
    return [];
  }
  const matches = body.match(/\b(?:task|bug|req|pitch)_[a-z][a-z0-9_]*\b/g) || [];
  return [...new Set(matches)];
}

/**
 * @param {string|null|undefined} body
 * @returns {string|null}
 */
function exemptionFromText(body) {
  if (!body) {
    return null;
  }
  const match = body.match(/exemption\s+reason\s*:\s*(.+)/i);
  const value = match?.[1]?.trim();
  return value && value.toLowerCase() !== "none" && value !== "N/A" ? value : null;
}

/**
 * @param {string} file
 * @returns {boolean}
 */
function isSdlcRecordChange(file) {
  const normalized = file.replace(/\\/g, "/");
  if (normalized === "topogram.sdlc-policy.json") {
    return true;
  }
  return [
    "topo/sdlc/pitches/",
    "topo/sdlc/requirements/",
    "topo/sdlc/acceptance_criteria/",
    "topo/sdlc/tasks/",
    "topo/sdlc/plans/",
    "topo/sdlc/bugs/",
    "topo/sdlc/decisions/",
    "topo/sdlc/docs/",
    "topo/pitches/",
    "topo/requirements/",
    "topo/acceptance_criteria/",
    "topo/tasks/",
    "topo/plans/",
    "topo/bugs/",
    "topo/docs/"
  ].some((prefix) => normalized.startsWith(prefix));
}

/**
 * @param {string} topogramPath
 * @returns {Promise<Record<string, any>>}
 */
async function runTopogramCheckPayload(topogramPath) {
  const ast = parsePath(topogramPath);
  const resolved = resolveWorkspace(ast);
  const implementation = await loadImplementationProvider(topogramPath).catch(() => null);
  const explicitProjectConfig = loadProjectConfig(topogramPath);
  const projectConfigInfo = explicitProjectConfig ||
    (implementation ? projectConfigOrDefault(topogramPath, resolved.ok ? resolved.graph : null, implementation) : null);
  const projectValidation = projectConfigInfo
    ? {
        ok: [
          validateProjectConfig(projectConfigInfo.config, resolved.ok ? resolved.graph : null, { configDir: projectConfigInfo.configDir }),
          validateProjectOutputOwnership(projectConfigInfo),
          validateProjectImplementationTrust(projectConfigInfo)
        ].every((result) => result.ok),
        errors: [
          ...validateProjectConfig(projectConfigInfo.config, resolved.ok ? resolved.graph : null, { configDir: projectConfigInfo.configDir }).errors,
          ...validateProjectOutputOwnership(projectConfigInfo).errors,
          ...validateProjectImplementationTrust(projectConfigInfo).errors
        ]
      }
    : { ok: false, errors: [{ message: "Missing topogram.project.json or compatible topogram.implementation.json", loc: null }] };
  return {
    ok: Boolean(resolved.ok && projectValidation.ok),
    topogram: resolved.ok,
    project: projectValidation.ok,
    errors: [
      ...(!resolved.ok ? resolved.validation.errors.map(/** @param {any} error */ (error) => ({ source: "topogram", message: error.message })) : []),
      ...projectValidation.errors.map((error) => ({ source: "project", message: error.message }))
    ]
  };
}

/**
 * @param {Record<string, any>} graph
 * @param {string[]} ids
 * @param {string[]} requiredKinds
 * @returns {{ valid: string[], invalid: string[] }}
 */
function validateSdlcIds(graph, ids, requiredKinds) {
  const byId = new Map((graph?.statements || []).map(/** @param {any} statement */ (statement) => [statement.id, statement]));
  /** @type {string[]} */
  const valid = [];
  /** @type {string[]} */
  const invalid = [];
  for (const id of ids) {
    const statement = byId.get(id);
    if (statement && requiredKinds.includes(String(statement.kind))) {
      valid.push(id);
    } else {
      invalid.push(id);
    }
  }
  return { valid, invalid };
}

/**
 * @param {string} inputPath
 * @param {SdlcGateOptions} [options]
 * @returns {Promise<Record<string, any>>}
 */
export async function runSdlcGate(inputPath = ".", options = {}) {
  const context = resolveWorkspaceContext(inputPath || ".");
  const projectRoot = context.projectRoot;
  const topogramRoot = resolveTopoRoot(inputPath || ".");
  const policyInfo = loadSdlcPolicy(projectRoot);
  const policy = policyInfo.policy;
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (policyInfo.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    errors.push(...policyInfo.diagnostics.filter((diagnostic) => diagnostic.severity === "error").map((diagnostic) => diagnostic.message));
  }

  if (!policyInfo.exists || policyInfo.status !== "adopted") {
    if (options.requireAdopted) {
      errors.push("SDLC policy is not adopted; required because --require-adopted was passed.");
    }
    return {
      type: "sdlc_gate",
      version: "1",
      ok: errors.length === 0,
      projectRoot,
      topogramRoot,
      policy: {
        exists: policyInfo.exists,
        path: policyInfo.path,
        status: policyInfo.status,
        mode: policyInfo.mode
      },
      changedFiles: [],
      protectedChanges: [],
      sdlcIds: [],
      validSdlcIds: [],
      invalidSdlcIds: [],
      sdlcRecordChanges: [],
      exemption: null,
      checks: [],
      warnings,
      errors,
      nextCommands: policyInfo.exists ? ["topogram sdlc policy check --json"] : ["topogram sdlc policy init ."]
    };
  }

  if (!policy) {
    errors.push("SDLC policy could not be loaded.");
  }

  const checkPayload = await runTopogramCheckPayload(topogramRoot);
  if (!checkPayload.ok) {
    errors.push("topogram check failed.");
  }
  const ast = parsePath(topogramRoot);
  const resolved = resolveWorkspace(ast);
  let sdlcCheck = { ok: false, errors: [{ message: "workspace did not resolve" }], warnings: [] };
  if (resolved.ok) {
    sdlcCheck = checkSdlcWorkspace(topogramRoot, resolved);
    if (!sdlcCheck.ok || sdlcCheck.warnings.length > 0) {
      errors.push("topogram sdlc check --strict failed.");
    }
  } else {
    errors.push("workspace resolution failed before SDLC check.");
  }

  /** @type {{ ok: true, files: string[] } | { ok: false, error: string }} */
  const diffResult = options.changedFiles
    ? { ok: true, files: options.changedFiles }
    : gitChangedFiles(projectRoot, options.base || null, options.head || null);
  if (!diffResult.ok) {
    errors.push(`Could not compute changed files: ${diffResult.error}`);
  }
  const changedFiles = diffResult.ok ? diffResult.files : [];
  const protectedChanges = changedFiles.filter((file) => matchesAnyProtectedPath(file, policy?.protectedPaths || []));
  const sdlcRecordChanges = changedFiles.filter(isSdlcRecordChange);
  const prBody = options.prBody ?? githubPullRequestBody();
  const explicitIds = options.sdlcIds || [];
  const sdlcIds = [...new Set([...explicitIds, ...sdlcIdsFromText(prBody)])];
  const idValidation = resolved.ok
    ? validateSdlcIds(resolved.graph, sdlcIds, policy?.requiredItemKinds || [])
    : { valid: [], invalid: sdlcIds };
  const exemption = options.exemption || exemptionFromText(prBody);
  const hasAllowedExemption = Boolean(exemption && policy?.allowExemptions);
  const hasSdlcLinkage = idValidation.valid.length > 0 || sdlcRecordChanges.length > 0 || hasAllowedExemption;

  if (idValidation.invalid.length > 0) {
    warnings.push(`Ignored invalid SDLC id(s): ${idValidation.invalid.join(", ")}`);
  }
  if (protectedChanges.length > 0 && !hasSdlcLinkage) {
    const message = "Protected changes require a valid SDLC item, a topo/*.tg SDLC record change, or an allowed exemption.";
    if (policy?.mode === "enforced") {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }
  const staleWork = resolved.ok
    ? buildSdlcStaleWorkPayload(resolved.graph, readHistory(topogramRoot), policy)
    : { ok: true, breaches: [] };
  if ((staleWork.breaches || []).length > 0) {
    const message = `SDLC stale/WIP policy has ${staleWork.breaches.length} breach(es).`;
    if (protectedChanges.length > 0 && policy?.mode === "enforced" && !hasAllowedExemption) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  return {
    type: "sdlc_gate",
    version: "1",
    ok: errors.length === 0,
    projectRoot,
    topogramRoot,
    policy: {
      exists: policyInfo.exists,
      path: policyInfo.path,
      status: policyInfo.status,
      mode: policyInfo.mode,
      protectedPaths: policy?.protectedPaths || [],
      requiredItemKinds: policy?.requiredItemKinds || [],
      allowExemptions: policy?.allowExemptions ?? false
    },
    changedFiles,
    protectedChanges,
    sdlcIds,
    validSdlcIds: idValidation.valid,
    invalidSdlcIds: idValidation.invalid,
    sdlcRecordChanges,
    exemption: exemption || null,
    staleWork,
    checks: [
      { command: "topogram check", ok: checkPayload.ok, errors: checkPayload.errors || [] },
      { command: "topogram sdlc check --strict", ok: Boolean(sdlcCheck.ok && sdlcCheck.warnings.length === 0), errors: sdlcCheck.errors || [], warnings: sdlcCheck.warnings || [] }
    ],
    warnings,
    errors,
    nextCommands: [
      "topogram sdlc explain <task-id> --json",
      "topogram query single-agent-plan . --mode modeling --capability <cap-id> --json"
    ]
  };
}

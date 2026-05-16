// @ts-check

import fs from "node:fs";
import path from "node:path";

import { resolveWorkspaceContext } from "../workspace-paths.js";

export const SDLC_POLICY_FILE = "topogram.sdlc-policy.json";
export const SDLC_POLICY_VERSION = "1";

export const SDLC_POLICY_STATUSES = new Set(["adopted", "not_adopted"]);
export const SDLC_POLICY_MODES = new Set(["advisory", "enforced"]);
export const SDLC_POLICY_ITEM_KINDS = new Set(["task", "bug", "requirement", "pitch"]);

export const DEFAULT_PROTECTED_PATHS = [
  "engine/**",
  "docs/**",
  "scripts/**",
  ".github/**",
  "topo/**",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "README.md",
  "package.json"
];

export const DEFAULT_REQUIRED_ITEM_KINDS = ["task", "bug", "requirement", "pitch"];

/**
 * @typedef {Object} SdlcPolicy
 * @property {string} version
 * @property {"adopted"|"not_adopted"} status
 * @property {"advisory"|"enforced"} mode
 * @property {string[]} protectedPaths
 * @property {string[]} requiredItemKinds
 * @property {boolean} allowExemptions
 * @property {boolean} releaseNotes
 * @property {{ maxInProgressTasks?: number, maxClaimedTasksPerActor?: number }|undefined} [wipLimits]
 * @property {{ claimedDays?: number, inProgressDays?: number }|undefined} [staleWork]
 */

/**
 * @typedef {Object} SdlcPolicyInfo
 * @property {boolean} exists
 * @property {string} path
 * @property {SdlcPolicy|null} policy
 * @property {"adopted"|"not_adopted"} status
 * @property {"advisory"|"enforced"|null} mode
 * @property {Array<{ severity: "error"|"warning", message: string }>} diagnostics
 */

/**
 * @returns {SdlcPolicy}
 */
export function defaultSdlcPolicy() {
  return {
    version: SDLC_POLICY_VERSION,
    status: "adopted",
    mode: "enforced",
    protectedPaths: [...DEFAULT_PROTECTED_PATHS],
    requiredItemKinds: [...DEFAULT_REQUIRED_ITEM_KINDS],
    allowExemptions: true,
    releaseNotes: true
  };
}

/**
 * @param {string} inputPath
 * @returns {string}
 */
export function policyProjectRoot(inputPath = ".") {
  return resolveWorkspaceContext(inputPath || ".").projectRoot;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isSafeRelativePattern(value) {
  const normalized = value.replace(/\\/g, "/").trim();
  return Boolean(normalized) &&
    !path.isAbsolute(normalized) &&
    normalized !== ".." &&
    !normalized.startsWith("../") &&
    !normalized.includes("/../") &&
    !normalized.endsWith("/..");
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @param {string[]} allowed
 * @param {SdlcPolicyInfo["diagnostics"]} diagnostics
 * @returns {Record<string, number>|undefined}
 */
function validateOptionalNumberObject(value, fieldName, allowed, diagnostics) {
  if (value == null) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    diagnostics.push({ severity: "error", message: `SDLC policy ${fieldName} must be an object when present.` });
    return undefined;
  }
  /** @type {Record<string, number>} */
  const output = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (!allowed.includes(key)) {
      diagnostics.push({ severity: "error", message: `Invalid SDLC policy ${fieldName}.${key}.` });
      continue;
    }
    if (!isPositiveNumber(entryValue)) {
      diagnostics.push({ severity: "error", message: `SDLC policy ${fieldName}.${key} must be a positive number.` });
      continue;
    }
    output[key] = entryValue;
  }
  return output;
}

/**
 * @param {unknown} value
 * @returns {{ ok: boolean, policy: SdlcPolicy|null, diagnostics: SdlcPolicyInfo["diagnostics"] }}
 */
export function validateSdlcPolicy(value) {
  /** @type {SdlcPolicyInfo["diagnostics"]} */
  const diagnostics = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      policy: null,
      diagnostics: [{ severity: "error", message: `${SDLC_POLICY_FILE} must contain a JSON object.` }]
    };
  }

  const record = /** @type {Record<string, unknown>} */ (value);
  if (record.version !== SDLC_POLICY_VERSION) {
    diagnostics.push({ severity: "error", message: `SDLC policy version must be "${SDLC_POLICY_VERSION}".` });
  }
  if (typeof record.status !== "string" || !SDLC_POLICY_STATUSES.has(record.status)) {
    diagnostics.push({ severity: "error", message: "SDLC policy status must be adopted or not_adopted." });
  }
  if (typeof record.mode !== "string" || !SDLC_POLICY_MODES.has(record.mode)) {
    diagnostics.push({ severity: "error", message: "SDLC policy mode must be advisory or enforced." });
  }
  if (record.status === "not_adopted" && record.mode === "enforced") {
    diagnostics.push({ severity: "error", message: "SDLC policy cannot be not_adopted and enforced." });
  }
  if (!Array.isArray(record.protectedPaths) || record.protectedPaths.length === 0) {
    diagnostics.push({ severity: "error", message: "SDLC policy protectedPaths must be a non-empty string array." });
  } else {
    for (const item of record.protectedPaths) {
      if (typeof item !== "string" || !isSafeRelativePattern(item)) {
        diagnostics.push({ severity: "error", message: `Invalid protected path '${String(item)}'. Paths must be relative and must not escape the project root.` });
      }
    }
  }
  if (!Array.isArray(record.requiredItemKinds) || record.requiredItemKinds.length === 0) {
    diagnostics.push({ severity: "error", message: "SDLC policy requiredItemKinds must be a non-empty string array." });
  } else {
    for (const item of record.requiredItemKinds) {
      if (typeof item !== "string" || !SDLC_POLICY_ITEM_KINDS.has(item)) {
        diagnostics.push({ severity: "error", message: `Invalid required SDLC item kind '${String(item)}'.` });
      }
    }
  }
  if (typeof record.allowExemptions !== "boolean") {
    diagnostics.push({ severity: "error", message: "SDLC policy allowExemptions must be a boolean." });
  }
  if (typeof record.releaseNotes !== "boolean") {
    diagnostics.push({ severity: "error", message: "SDLC policy releaseNotes must be a boolean." });
  }
  const wipLimits = validateOptionalNumberObject(
    record.wipLimits,
    "wipLimits",
    ["maxInProgressTasks", "maxClaimedTasksPerActor"],
    diagnostics
  );
  const staleWork = validateOptionalNumberObject(
    record.staleWork,
    "staleWork",
    ["claimedDays", "inProgressDays"],
    diagnostics
  );

  const ok = diagnostics.every((diagnostic) => diagnostic.severity !== "error");
  if (!ok) {
    return { ok, policy: null, diagnostics };
  }

  return {
    ok,
    policy: {
      version: String(record.version),
      status: /** @type {"adopted"|"not_adopted"} */ (record.status),
      mode: /** @type {"advisory"|"enforced"} */ (record.mode),
      protectedPaths: stringArray(record.protectedPaths),
      requiredItemKinds: stringArray(record.requiredItemKinds),
      allowExemptions: Boolean(record.allowExemptions),
      releaseNotes: Boolean(record.releaseNotes),
      ...(wipLimits ? { wipLimits } : {}),
      ...(staleWork ? { staleWork } : {})
    },
    diagnostics
  };
}

/**
 * @param {string} projectRoot
 * @returns {SdlcPolicyInfo}
 */
export function loadSdlcPolicy(projectRoot) {
  const policyPath = path.join(projectRoot, SDLC_POLICY_FILE);
  if (!fs.existsSync(policyPath)) {
    return {
      exists: false,
      path: policyPath,
      policy: null,
      status: "not_adopted",
      mode: null,
      diagnostics: []
    };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(policyPath, "utf8"));
    const validation = validateSdlcPolicy(parsed);
    return {
      exists: true,
      path: policyPath,
      policy: validation.policy,
      status: validation.policy?.status || "not_adopted",
      mode: validation.policy?.mode || null,
      diagnostics: validation.diagnostics
    };
  } catch (error) {
    return {
      exists: true,
      path: policyPath,
      policy: null,
      status: "not_adopted",
      mode: null,
      diagnostics: [{ severity: "error", message: `Could not read ${SDLC_POLICY_FILE}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

/**
 * @param {string} projectRoot
 * @returns {{ ok: boolean, file: string, policy: SdlcPolicy }}
 */
export function writeDefaultSdlcPolicy(projectRoot) {
  const file = path.join(projectRoot, SDLC_POLICY_FILE);
  if (fs.existsSync(file)) {
    throw new Error(`${SDLC_POLICY_FILE} already exists.`);
  }
  const policy = defaultSdlcPolicy();
  fs.writeFileSync(file, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
  return { ok: true, file, policy };
}

/**
 * @param {string} projectRoot
 * @returns {Record<string, any>}
 */
export function explainSdlcPolicy(projectRoot) {
  const info = loadSdlcPolicy(projectRoot);
  return {
    type: "sdlc_policy_explain",
    version: "1",
    ok: info.diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    policy: {
      exists: info.exists,
      path: info.path,
      status: info.status,
      mode: info.mode,
      protectedPaths: info.policy?.protectedPaths || [],
      requiredItemKinds: info.policy?.requiredItemKinds || [],
      allowExemptions: info.policy?.allowExemptions ?? false,
      releaseNotes: info.policy?.releaseNotes ?? false,
      wipLimits: info.policy?.wipLimits || null,
      staleWork: info.policy?.staleWork || null
    },
    diagnostics: info.diagnostics,
    enforcement: info.status === "adopted"
      ? (info.mode === "enforced" ? "Protected changes require SDLC linkage or an allowed exemption." : "Gaps are reported without failing.")
      : "Project has not adopted enforced SDLC.",
    nextCommands: info.exists
      ? ["topogram sdlc policy check --json", "topogram sdlc gate . --require-adopted --json"]
      : ["topogram sdlc policy init .", "topogram sdlc policy check --json"]
  };
}

// @ts-check

import fs from "node:fs";
import path from "node:path";

import { TEMPLATE_POLICY_FILE } from "./constants.js";
import { stableJsonStringify } from "./json.js";
import { currentTemplateMetadata } from "./metadata.js";
import { packageScopeFromSpec } from "./package-spec.js";

/** @typedef {import("./types.js").CreateNewProjectOptions} CreateNewProjectOptions */
/** @typedef {import("./types.js").TemplateUpdatePlanOptions} TemplateUpdatePlanOptions */
/** @typedef {import("./types.js").TemplateUpdateFileActionOptions} TemplateUpdateFileActionOptions */
/** @typedef {import("./types.js").TemplateOwnedFileRecord} TemplateOwnedFileRecord */
/** @typedef {import("./types.js").TemplateManifest} TemplateManifest */
/** @typedef {import("./types.js").TemplateTopologySummary} TemplateTopologySummary */
/** @typedef {import("./types.js").TemplatePolicy} TemplatePolicy */
/** @typedef {import("./types.js").TemplatePolicyInfo} TemplatePolicyInfo */
/** @typedef {import("./types.js").TemplateUpdateDiagnostic} TemplateUpdateDiagnostic */
/** @typedef {import("./types.js").ResolvedTemplate} ResolvedTemplate */
/** @typedef {import("./types.js").CatalogTemplateProvenance} CatalogTemplateProvenance */

/**
 * @param {Record<string, any>} input
 * @returns {TemplateUpdateDiagnostic}
 */
export function templateUpdateDiagnostic(input) {
  return {
    code: String(input.code || "template_update_failed"),
    severity: input.severity === "warning" ? "warning" : "error",
    message: String(input.message || "Template update failed."),
    path: typeof input.path === "string" ? input.path : null,
    suggestedFix: typeof input.suggestedFix === "string" ? input.suggestedFix : null,
    step: typeof input.step === "string" ? input.step : null
  };
}

/**
 * @param {unknown} value
 * @param {string} policyPath
 * @returns {TemplatePolicy}
 */
function validateTemplatePolicy(value, policyPath) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${TEMPLATE_POLICY_FILE} must contain a JSON object.`);
  }
  const policy = /** @type {Record<string, unknown>} */ (value);
  const version = typeof policy.version === "string" && policy.version ? policy.version : "0.1";
  const allowedSources = Array.isArray(policy.allowedSources) ? policy.allowedSources : ["local", "package"];
  const invalidSource = allowedSources.find((source) => !["local", "package"].includes(String(source)));
  if (invalidSource) {
    throw new Error(`${policyPath} has invalid allowedSources value '${String(invalidSource)}'.`);
  }
  const allowedTemplateIds = Array.isArray(policy.allowedTemplateIds)
    ? policy.allowedTemplateIds.map(String).filter(Boolean)
    : [];
  const allowedPackageScopes = Array.isArray(policy.allowedPackageScopes)
    ? policy.allowedPackageScopes.map(String).filter(Boolean)
    : [];
  const executableImplementation = policy.executableImplementation === "deny" || policy.executableImplementation === "warn"
    ? policy.executableImplementation
    : "allow";
  const pinnedVersions = policy.pinnedVersions && typeof policy.pinnedVersions === "object" && !Array.isArray(policy.pinnedVersions)
    ? Object.fromEntries(Object.entries(policy.pinnedVersions).filter(([, pin]) => typeof pin === "string"))
    : {};
  return {
    version,
    allowedSources: /** @type {Array<"local"|"package">} */ (allowedSources),
    allowedTemplateIds,
    allowedPackageScopes,
    executableImplementation,
    pinnedVersions
  };
}

/**
 * @param {string} projectRoot
 * @returns {TemplatePolicyInfo}
 */
export function loadTemplatePolicy(projectRoot) {
  const policyPath = path.join(projectRoot, TEMPLATE_POLICY_FILE);
  if (!fs.existsSync(policyPath)) {
    return {
      path: policyPath,
      policy: null,
      exists: false,
      diagnostics: []
    };
  }
  try {
    return {
      path: policyPath,
      policy: validateTemplatePolicy(JSON.parse(fs.readFileSync(policyPath, "utf8")), policyPath),
      exists: true,
      diagnostics: []
    };
  } catch (error) {
    return {
      path: policyPath,
      policy: null,
      exists: true,
      diagnostics: [templateUpdateDiagnostic({
        code: "template_policy_invalid",
        message: error instanceof Error ? error.message : String(error),
        path: policyPath,
        suggestedFix: "Fix topogram.template-policy.json or regenerate it with `topogram template policy init`.",
        step: "policy"
      })]
    };
  }
}

/**
 * @param {ResolvedTemplate} template
 * @returns {TemplatePolicy}
 */
export function defaultTemplatePolicyForTemplate(template) {
  const allowedPackageScopes = [];
  const idScope = template.source === "package"
    ? packageScopeFromSpec(template.packageSpec || template.requested)
    : null;
  if (template.source === "package" && idScope) {
    allowedPackageScopes.push(idScope);
  }
  return {
    version: "0.1",
    allowedSources: ["local", "package"],
    allowedTemplateIds: [template.manifest.id],
    allowedPackageScopes,
    executableImplementation: "allow",
    pinnedVersions: {}
  };
}

/**
 * @param {string} projectRoot
 * @param {TemplatePolicy} policy
 * @returns {TemplatePolicy}
 */
export function writeTemplatePolicy(projectRoot, policy) {
  fs.writeFileSync(path.join(projectRoot, TEMPLATE_POLICY_FILE), `${stableJsonStringify(policy)}\n`, "utf8");
  return policy;
}

/**
 * @param {string} projectRoot
 * @param {Record<string, any>} projectConfig
 * @returns {TemplatePolicy}
 */
export function writeTemplatePolicyForProject(projectRoot, projectConfig) {
  const current = currentTemplateMetadata(projectConfig);
  /** @type {string[]} */
  const allowedPackageScopes = [];
  if (current.source === "package") {
    const currentScope = packageScopeFromSpec(current.sourceSpec) ||
      (current.id?.startsWith("@") ? current.id.split("/")[0] : null);
    if (currentScope) {
      allowedPackageScopes.push(currentScope);
    }
  }
  return writeTemplatePolicy(projectRoot, {
    version: "0.1",
    allowedSources: ["local", "package"],
    allowedTemplateIds: current.id ? [current.id] : [],
    allowedPackageScopes,
    executableImplementation: "allow",
    pinnedVersions: {}
  });
}

/**
 * @param {TemplatePolicyInfo} policyInfo
 * @param {ResolvedTemplate} template
 * @param {string} step
 * @returns {TemplateUpdateDiagnostic[]}
 */
export function templatePolicyDiagnosticsForTemplate(policyInfo, template, step) {
  if (policyInfo.diagnostics.length > 0) {
    return policyInfo.diagnostics;
  }
  if (!policyInfo.policy) {
    return [];
  }
  const policy = policyInfo.policy;
  /** @type {TemplateUpdateDiagnostic[]} */
  const diagnostics = [];
  if (policy.allowedSources.length > 0 && !policy.allowedSources.includes(template.source)) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_source_denied",
      message: `Template source '${template.source}' is not allowed by ${TEMPLATE_POLICY_FILE}.`,
      path: policyInfo.path,
      suggestedFix: `Run \`topogram template policy init\` to reset from the current project, or add '${template.source}' to allowedSources after review.`,
      step
    }));
  }
  if (policy.allowedTemplateIds.length > 0 && !policy.allowedTemplateIds.includes(template.manifest.id)) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_id_denied",
      message: `Template '${template.manifest.id}' is not allowed by ${TEMPLATE_POLICY_FILE}.`,
      path: policyInfo.path,
      suggestedFix: `Run \`topogram template policy pin ${template.manifest.id}@${template.manifest.version}\` after review, or choose an allowed template.`,
      step
    }));
  }
  if (template.source === "package" && policy.allowedPackageScopes && policy.allowedPackageScopes.length > 0) {
    const scope = packageScopeFromSpec(template.packageSpec || template.requested) ||
      (template.manifest.id.startsWith("@") ? template.manifest.id.split("/")[0] : null);
    if (!scope || !policy.allowedPackageScopes.includes(scope)) {
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_package_scope_denied",
        message: `Template package scope '${scope || "(unscoped)"}' is not allowed by ${TEMPLATE_POLICY_FILE}.`,
        path: policyInfo.path,
        suggestedFix: `Add '${scope || "(unscoped)"}' to allowedPackageScopes after review, or choose a package from an allowed scope.`,
        step
      }));
    }
  }
  const pinnedVersion = policy.pinnedVersions?.[template.manifest.id];
  if (pinnedVersion && pinnedVersion !== template.manifest.version) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_version_mismatch",
      message: `Template '${template.manifest.id}' is pinned to version '${pinnedVersion}', but candidate version is '${template.manifest.version}'.`,
      path: policyInfo.path,
      suggestedFix: `Run \`topogram template policy pin ${template.manifest.id}@${template.manifest.version}\` after review, or use version '${pinnedVersion}'.`,
      step
    }));
  }
  if (template.manifest.includesExecutableImplementation) {
    if (policy.executableImplementation === "deny") {
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_executable_denied",
        message: `Template '${template.manifest.id}' includes executable implementation code, which is denied by ${TEMPLATE_POLICY_FILE}.`,
        path: policyInfo.path,
        suggestedFix: "Use a non-executable template, or set executableImplementation to 'allow' after reviewing implementation/.",
        step
      }));
    } else if (policy.executableImplementation === "warn") {
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_executable_warning",
        severity: "warning",
        message: `Template '${template.manifest.id}' includes executable implementation code.`,
        path: policyInfo.path,
        suggestedFix: "Review implementation/ before running topogram generate.",
        step
      }));
    }
  }
  return diagnostics;
}

/**
 * @param {string} projectRoot
 * @param {ResolvedTemplate} template
 * @param {string} step
 * @returns {TemplateUpdateDiagnostic[]}
 */
export function templatePolicyDiagnosticsForProject(projectRoot, template, step) {
  return templatePolicyDiagnosticsForTemplate(loadTemplatePolicy(projectRoot), template, step);
}

/**
 * @param {TemplateUpdateDiagnostic[]} diagnostics
 * @returns {string[]}
 */
export function issueMessagesFromDiagnostics(diagnostics) {
  return diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => diagnostic.message);
}

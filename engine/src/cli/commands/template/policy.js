// @ts-check

import path from "node:path";

import { loadProjectConfig } from "../../../project-config.js";
import {
  loadTemplatePolicy,
  packageScopeFromSpec,
  templatePolicyDiagnosticsForTemplate,
  writeTemplatePolicy,
  writeTemplatePolicyForProject
} from "../../../new-project.js";
import { templateCheckDiagnostic } from "./diagnostics.js";

/**
 * @typedef {Object} TemplateCheckDiagnostic
 * @property {string} code
 * @property {"error"|"warning"} severity
 * @property {string} message
 * @property {string|null} path
 * @property {string|null} suggestedFix
 * @property {string|null} step
 */

/**
 * @param {ReturnType<typeof loadProjectConfig>} projectConfigInfo
 * @returns {{ requested: string, root: string, manifest: { id: string, version: string, kind: string, topogramVersion: string, includesExecutableImplementation: boolean }, source: "local"|"package", packageSpec: string|null }}
 */
function currentPolicyTemplate(projectConfigInfo) {
  const template = projectConfigInfo?.config.template || {};
  const source = template.source === "local" || template.source === "package"
    ? template.source
    : "local";
  return {
    requested: typeof template.requested === "string" ? template.requested : String(template.id || "unknown"),
    root: projectConfigInfo?.configDir || process.cwd(),
    manifest: {
      id: typeof template.id === "string" ? template.id : "unknown",
      version: typeof template.version === "string" ? template.version : "unknown",
      kind: "starter",
      topogramVersion: "*",
      includesExecutableImplementation: Boolean(template.includesExecutableImplementation)
    },
    source,
    packageSpec: typeof template.sourceSpec === "string" ? template.sourceSpec : null
  };
}

/**
 * @param {string} projectPath
 * @returns {{ ok: boolean, path: string, exists: boolean, policy: any, diagnostics: TemplateCheckDiagnostic[], errors: string[] }}
 */
export function buildTemplatePolicyCheckPayload(projectPath) {
  const projectConfigInfo = loadProjectConfig(projectPath);
  if (!projectConfigInfo) {
    const diagnostic = templateCheckDiagnostic({
      code: "template_policy_project_missing",
      message: "Cannot check template policy without topogram.project.json.",
      path: path.resolve(projectPath),
      suggestedFix: "Run this command in a Topogram project.",
      step: "policy"
    });
    return {
      ok: false,
      path: path.join(path.resolve(projectPath), "topogram.template-policy.json"),
      exists: false,
      policy: null,
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  const policyInfo = loadTemplatePolicy(projectConfigInfo.configDir);
  /** @type {TemplateCheckDiagnostic[]} */
  const diagnostics = policyInfo.diagnostics.map((diagnostic) => templateCheckDiagnostic(diagnostic));
  if (!policyInfo.exists) {
    diagnostics.push(templateCheckDiagnostic({
      code: "template_policy_missing",
      severity: "warning",
      message: "No topogram.template-policy.json found. Template operations are permissive until a policy is defined.",
      path: policyInfo.path,
      suggestedFix: "Run `topogram template policy init` to create a project template policy.",
      step: "policy"
    }));
  } else if (policyInfo.policy) {
    const currentTemplate = currentPolicyTemplate(projectConfigInfo);
    diagnostics.push(...templatePolicyDiagnosticsForTemplate(policyInfo, currentTemplate, "policy")
      .map((diagnostic) => templateCheckDiagnostic(diagnostic)));
  }
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").map((diagnostic) => diagnostic.message);
  return {
    ok: errors.length === 0,
    path: policyInfo.path,
    exists: policyInfo.exists,
    policy: policyInfo.policy,
    diagnostics,
    errors
  };
}

/**
 * @param {string} name
 * @param {boolean} ok
 * @param {string} actual
 * @param {string} expected
 * @param {string} message
 * @param {string|null} fix
 * @returns {{ name: string, ok: boolean, actual: string, expected: string, message: string, fix: string|null }}
 */
function templatePolicyRule(name, ok, actual, expected, message, fix = null) {
  return { name, ok, actual, expected, message, fix };
}

/**
 * @param {string} name
 * @returns {string}
 */
function templatePolicyRuleLabel(name) {
  return ({
    "policy-file": "Policy file",
    "allowed-source": "Allowed source",
    "allowed-template-id": "Allowed template id",
    "allowed-package-scope": "Allowed package scope",
    "pinned-version": "Pinned version",
    "executable-implementation": "Executable implementation"
  })[name] || name;
}

/**
 * @param {string} projectPath
 * @returns {{ ok: boolean, path: string, exists: boolean, policy: any, template: any, catalog: any, package: any, rules: Array<{ name: string, ok: boolean, actual: string, expected: string, message: string, fix: string|null }>, diagnostics: TemplateCheckDiagnostic[], errors: string[] }}
 */
export function buildTemplatePolicyExplainPayload(projectPath) {
  const check = buildTemplatePolicyCheckPayload(projectPath);
  const projectConfigInfo = loadProjectConfig(projectPath);
  if (!projectConfigInfo) {
    return {
      ...check,
      template: null,
      catalog: null,
      package: null,
      rules: []
    };
  }
  const templateMetadata = projectConfigInfo.config.template || {};
  const currentTemplate = currentPolicyTemplate(projectConfigInfo);
  const policy = check.policy;
  const packageScope = currentTemplate.source === "package"
    ? packageScopeFromSpec(currentTemplate.packageSpec || currentTemplate.requested)
    : null;
  const rules = [];
  rules.push(templatePolicyRule(
    "policy-file",
    check.exists,
    check.exists ? "present" : "missing",
    "present",
    check.exists
      ? "Project has a template policy file."
      : "Project has no template policy file; template operations are permissive until one is defined.",
    check.exists ? null : "Run `topogram template policy init`."
  ));
  if (policy) {
    rules.push(templatePolicyRule(
      "allowed-source",
      policy.allowedSources.length === 0 || policy.allowedSources.includes(currentTemplate.source),
      currentTemplate.source,
      policy.allowedSources.length > 0 ? policy.allowedSources.join(", ") : "(any)",
      "Current template source must be allowed by allowedSources.",
      `Add '${currentTemplate.source}' to allowedSources after review, or run \`topogram template policy init\`.`
    ));
    rules.push(templatePolicyRule(
      "allowed-template-id",
      policy.allowedTemplateIds.length === 0 || policy.allowedTemplateIds.includes(currentTemplate.manifest.id),
      currentTemplate.manifest.id,
      policy.allowedTemplateIds.length > 0 ? policy.allowedTemplateIds.join(", ") : "(any)",
      "Current template id must be allowed by allowedTemplateIds.",
      `Run \`topogram template policy pin ${currentTemplate.manifest.id}@${currentTemplate.manifest.version}\` after review.`
    ));
    if (currentTemplate.source === "package") {
      rules.push(templatePolicyRule(
        "allowed-package-scope",
        !policy.allowedPackageScopes ||
          policy.allowedPackageScopes.length === 0 ||
          Boolean(packageScope && policy.allowedPackageScopes.includes(packageScope)),
        packageScope || "(unscoped)",
        policy.allowedPackageScopes && policy.allowedPackageScopes.length > 0 ? policy.allowedPackageScopes.join(", ") : "(any)",
        "Package-backed template source must be in an allowed package scope.",
        `Add '${packageScope || "(unscoped)"}' to allowedPackageScopes after review.`
      ));
    }
    const pinnedVersion = policy.pinnedVersions?.[currentTemplate.manifest.id] || null;
    rules.push(templatePolicyRule(
      "pinned-version",
      !pinnedVersion || pinnedVersion === currentTemplate.manifest.version,
      currentTemplate.manifest.version,
      pinnedVersion || "(unpinned)",
      "Pinned version must match the current template version when a pin exists.",
      `Run \`topogram template policy pin ${currentTemplate.manifest.id}@${currentTemplate.manifest.version}\` after review.`
    ));
    rules.push(templatePolicyRule(
      "executable-implementation",
      !currentTemplate.manifest.includesExecutableImplementation || policy.executableImplementation !== "deny",
      currentTemplate.manifest.includesExecutableImplementation ? "yes" : "no",
      policy.executableImplementation,
      "Executable template implementation must be allowed when implementation/ is present.",
      "Review implementation/, then set executableImplementation to 'allow' or choose a non-executable template."
    ));
  }
  return {
    ...check,
    template: {
      id: currentTemplate.manifest.id,
      version: currentTemplate.manifest.version,
      source: currentTemplate.source,
      requested: currentTemplate.requested,
      sourceSpec: currentTemplate.packageSpec,
      includesExecutableImplementation: currentTemplate.manifest.includesExecutableImplementation
    },
    catalog: templateMetadata.catalog || null,
    package: currentTemplate.source === "package" ? {
      spec: currentTemplate.packageSpec,
      scope: packageScope
    } : null,
    rules
  };
}

/**
 * @param {ReturnType<typeof buildTemplatePolicyExplainPayload>} payload
 * @returns {void}
 */
export function printTemplatePolicyExplainPayload(payload) {
  console.log(payload.ok ? "Template policy: allowed" : "Template policy: denied");
  console.log(payload.ok
    ? "Decision: the current template is allowed by this project's template policy."
    : "Decision: the current template is blocked by this project's template policy.");
  console.log(`Policy file: ${payload.path}`);
  console.log(`Policy file exists: ${payload.exists ? "yes" : "no"}`);
  if (payload.template) {
    console.log(`Template: ${payload.template.id}@${payload.template.version}`);
    console.log(`Source: ${payload.template.source}`);
    console.log(`Requested: ${payload.template.requested}`);
    if (payload.template.sourceSpec) {
      console.log(`Source spec: ${payload.template.sourceSpec}`);
    }
    console.log(`Executable implementation: ${payload.template.includesExecutableImplementation ? "yes" : "no"}`);
  }
  if (payload.catalog?.id) {
    console.log(`Catalog: ${payload.catalog.id} from ${payload.catalog.source || "unknown"}`);
    console.log(`Catalog package: ${payload.catalog.packageSpec || payload.catalog.package || "unknown"}`);
  }
  if (payload.package) {
    console.log(`Package scope: ${payload.package.scope || "(unscoped)"}`);
  }
  if (payload.rules.length > 0) {
    console.log("");
    console.log("Policy checks:");
  }
  for (const rule of payload.rules) {
    console.log(`${rule.ok ? "PASS" : "FAIL"} ${templatePolicyRuleLabel(rule.name)}: ${rule.message}`);
    console.log(`  actual: ${rule.actual}`);
    console.log(`  expected: ${rule.expected}`);
    if (!rule.ok && rule.fix) {
      console.log(`  fix: ${rule.fix}`);
    }
  }
  for (const diagnostic of payload.diagnostics) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
}

/**
 * @param {{ ok: boolean, path: string, exists: boolean, policy: any, diagnostics: TemplateCheckDiagnostic[] }} payload
 * @returns {void}
 */
export function printTemplatePolicyCheckPayload(payload) {
  console.log(payload.ok ? "Template policy check passed" : "Template policy check failed");
  console.log(`Policy: ${payload.path}`);
  console.log(`Exists: ${payload.exists ? "yes" : "no"}`);
  for (const diagnostic of payload.diagnostics) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.path) {
      console.log(`  path: ${diagnostic.path}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
}

/**
 * @param {string|null|undefined} spec
 * @returns {{ id: string, version: string }|null}
 */
function parseTemplateVersionPin(spec) {
  if (!spec) {
    return null;
  }
  const separator = spec.lastIndexOf("@");
  if (separator <= 0 || separator === spec.length - 1) {
    throw new Error("Template policy pin requires a template id and version, for example @scope/template@0.2.0.");
  }
  return {
    id: spec.slice(0, separator),
    version: spec.slice(separator + 1)
  };
}

/**
 * @param {string} projectPath
 * @param {string|null|undefined} spec
 * @returns {{ ok: boolean, path: string, policy: any, pinned: { id: string, version: string }, diagnostics: TemplateCheckDiagnostic[], errors: string[] }}
 */
export function buildTemplatePolicyPinPayload(projectPath, spec) {
  const projectConfigInfo = loadProjectConfig(projectPath);
  if (!projectConfigInfo) {
    const diagnostic = templateCheckDiagnostic({
      code: "template_policy_project_missing",
      message: "Cannot pin template policy without topogram.project.json.",
      path: path.resolve(projectPath),
      suggestedFix: "Run this command in a Topogram project.",
      step: "policy"
    });
    return {
      ok: false,
      path: path.join(path.resolve(projectPath), "topogram.template-policy.json"),
      policy: null,
      pinned: { id: "", version: "" },
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  const parsed = parseTemplateVersionPin(spec);
  const currentTemplate = projectConfigInfo.config.template || {};
  const pin = parsed || {
    id: typeof currentTemplate.id === "string" ? currentTemplate.id : "",
    version: typeof currentTemplate.version === "string" ? currentTemplate.version : ""
  };
  if (!pin.id || !pin.version) {
    const diagnostic = templateCheckDiagnostic({
      code: "template_policy_pin_missing_version",
      message: "Cannot pin a template version without a template id and version.",
      path: projectConfigInfo.configPath,
      suggestedFix: "Pass a pin such as @scope/template@0.2.0, or ensure topogram.project.json records template.id and template.version.",
      step: "policy"
    });
    return {
      ok: false,
      path: path.join(projectConfigInfo.configDir, "topogram.template-policy.json"),
      policy: null,
      pinned: pin,
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }

  const existing = loadTemplatePolicy(projectConfigInfo.configDir);
  const diagnostics = existing.diagnostics.map((diagnostic) => templateCheckDiagnostic(diagnostic));
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return {
      ok: false,
      path: existing.path,
      policy: existing.policy,
      pinned: pin,
      diagnostics,
      errors: diagnostics.map((diagnostic) => diagnostic.message)
    };
  }
  const policy = existing.policy || writeTemplatePolicyForProject(projectConfigInfo.configDir, projectConfigInfo.config);
  const allowedTemplateIds = policy.allowedTemplateIds.includes(pin.id)
    ? policy.allowedTemplateIds
    : [...policy.allowedTemplateIds, pin.id];
  const allowedPackageScopes = [...(policy.allowedPackageScopes || [])];
  if (pin.id.startsWith("@")) {
    const scope = pin.id.split("/")[0];
    if (scope && !allowedPackageScopes.includes(scope)) {
      allowedPackageScopes.push(scope);
    }
  }
  const nextPolicy = {
    ...policy,
    allowedTemplateIds,
    allowedPackageScopes,
    pinnedVersions: {
      ...(policy.pinnedVersions || {}),
      [pin.id]: pin.version
    }
  };
  writeTemplatePolicy(projectConfigInfo.configDir, nextPolicy);
  return {
    ok: true,
    path: path.join(projectConfigInfo.configDir, "topogram.template-policy.json"),
    policy: nextPolicy,
    pinned: pin,
    diagnostics: [],
    errors: []
  };
}

/**
 * @param {{ ok: boolean, path: string, pinned: { id: string, version: string }, diagnostics: TemplateCheckDiagnostic[] }} payload
 * @returns {void}
 */
export function printTemplatePolicyPinPayload(payload) {
  console.log(payload.ok ? "Template policy pin updated" : "Template policy pin failed");
  console.log(`Policy: ${payload.path}`);
  if (payload.pinned.id) {
    console.log(`Pinned: ${payload.pinned.id}@${payload.pinned.version || "unknown"}`);
  }
  for (const diagnostic of payload.diagnostics) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.path) {
      console.log(`  path: ${diagnostic.path}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
}

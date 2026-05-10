// @ts-check

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parsePath } from "../../../parser.js";
import { resolveWorkspace } from "../../../resolver.js";
import {
  loadProjectConfig,
  validateProjectConfig,
  validateProjectOutputOwnership
} from "../../../project-config.js";
import { resolveTopoRoot } from "../../../workspace-paths.js";
import {
  buildTemplateUpdatePlan,
  createNewProject,
  loadTemplatePolicy,
  resolveTemplate,
  templatePolicyDiagnosticsForTemplate
} from "../../../new-project.js";
import {
  getTemplateTrustStatus,
  implementationRequiresTrust,
  TEMPLATE_TRUST_FILE,
  templateTrustRecoveryGuidance,
  validateProjectImplementationTrust
} from "../../../template-trust.js";
import { runNpmForPackageUpdate } from "../package.js";
import { ENGINE_ROOT, TEMPLATES_ROOT } from "./constants.js";
import { combineProjectValidationResults, messageFromError } from "./shared.js";
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
 * @param {string} templateSpec
 * @param {string} relativePath
 * @returns {string|null}
 */
function localTemplatePath(templateSpec, relativePath) {
  if (
    templateSpec === "." ||
    templateSpec.startsWith("./") ||
    templateSpec.startsWith("../") ||
    path.isAbsolute(templateSpec)
  ) {
    return path.join(path.resolve(templateSpec), relativePath);
  }
  return null;
}

/**
 * @param {string} message
 * @param {string} templateSpec
 * @param {string} step
 * @returns {TemplateCheckDiagnostic}
 */
function diagnosticForTemplateCreateFailure(message, templateSpec, step) {
  if (message.includes("is missing topogram-template.json")) {
    return templateCheckDiagnostic({
      code: "template_manifest_missing",
      message,
      path: localTemplatePath(templateSpec, "topogram-template.json"),
      suggestedFix: "Add topogram-template.json with id, version, kind, and topogramVersion.",
      step
    });
  }
  if (message.includes("contains implementation/") && message.includes("includesExecutableImplementation: true")) {
    return templateCheckDiagnostic({
      code: "template_implementation_undeclared",
      message,
      path: localTemplatePath(templateSpec, "topogram-template.json"),
      suggestedFix: "Set includesExecutableImplementation to true after reviewing implementation/, or remove implementation/.",
      step
    });
  }
  if (message.includes("is missing required string field") || message.includes("topogram-template.json")) {
    return templateCheckDiagnostic({
      code: "template_manifest_invalid",
      message,
      path: localTemplatePath(templateSpec, "topogram-template.json"),
      suggestedFix: "Fix topogram-template.json so it matches the template manifest schema.",
      step
    });
  }
  if (message.includes("is missing topo/")) {
    return templateCheckDiagnostic({
      code: "template_topogram_missing",
      message,
      path: localTemplatePath(templateSpec, "topo"),
      suggestedFix: "Add a topo/ directory with the reusable Topogram source files.",
      step
    });
  }
  if (message.includes("is missing topogram.project.json")) {
    return templateCheckDiagnostic({
      code: "template_project_config_missing",
      message,
      path: localTemplatePath(templateSpec, "topogram.project.json"),
      suggestedFix: "Add topogram.project.json beside topo/ with outputs and topology.runtimes.",
      step
    });
  }
  if (message.includes("is missing implementation/")) {
    return templateCheckDiagnostic({
      code: "template_implementation_missing",
      message,
      path: localTemplatePath(templateSpec, "implementation"),
      suggestedFix: "Add implementation/ or set includesExecutableImplementation to false.",
      step
    });
  }
  if (message.includes("unsupported symlink")) {
    return templateCheckDiagnostic({
      code: "template_symlink_unsupported",
      message,
      path: path.isAbsolute(templateSpec) ? templateSpec : null,
      suggestedFix: "Replace template symlinks with real files or directories, then rerun `topogram new` or `topogram template check`.",
      step
    });
  }
  return templateCheckDiagnostic({
    code: "template_create_failed",
    message,
    path: path.isAbsolute(templateSpec) ? templateSpec : null,
    suggestedFix: "Fix the template pack so topogram new can create a starter from it.",
    step
  });
}

/**
 * @param {{ message: string, loc?: any }} error
 * @param {string} step
 * @param {string|null} configPath
 * @returns {TemplateCheckDiagnostic}
 */
function diagnosticForStarterCheckFailure(error, step, configPath) {
  const locFile = typeof error?.loc?.file === "string" ? error.loc.file : null;
  const isTrust = error.message.includes(TEMPLATE_TRUST_FILE) ||
    error.message.includes("unsupported symlink") ||
    error.message.includes("must be under implementation/");
  return templateCheckDiagnostic({
    code: isTrust ? "template_trust_invalid" : "starter_check_failed",
    message: error.message,
    path: locFile || configPath,
    suggestedFix: isTrust
      ? templateTrustRecoveryGuidance(error.message)
      : "Fix the generated Topogram source or topogram.project.json so topogram check passes.",
    step
  });
}

/**
 * @param {string} name
 * @param {boolean} ok
 * @param {Record<string, any>} [details]
 * @param {TemplateCheckDiagnostic[]} [diagnostics]
 * @returns {{ name: string, ok: boolean, details: Record<string, any>, diagnostics: TemplateCheckDiagnostic[] }}
 */
function templateCheckStep(name, ok, details = {}, diagnostics = []) {
  return { name, ok, details, diagnostics };
}

/**
 * @param {string} projectRoot
 * @returns {string[]}
 */
function templateCheckGeneratorDependencies(projectRoot) {
  const packagePath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(packagePath)) {
    return [];
  }
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const dependencies = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {})
  };
  return Object.keys(dependencies).filter((name) =>
    name.includes("topogram-generator") || name.startsWith("@topogram/generator-")
  ).sort();
}

/**
 * @param {string} projectRoot
 * @param {string[]} dependencies
 * @returns {TemplateCheckDiagnostic|null}
 */
function installTemplateCheckGeneratorDependencies(projectRoot, dependencies) {
  if (dependencies.length === 0) {
    return null;
  }
  const result = runNpmForPackageUpdate(["install", "--ignore-scripts"], projectRoot);
  if (result.status === 0) {
    return null;
  }
  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  return templateCheckDiagnostic({
    code: "template_generator_dependencies_install_failed",
    message: `Failed to install package-backed generator dependencies: ${dependencies.join(", ")}.`,
    path: path.join(projectRoot, "package.json"),
    suggestedFix: `Run npm install before checking this package-backed generator template.${output ? ` ${output.split(/\r?\n/).slice(-3).join(" ")}` : ""}`,
    step: "generator-dependencies"
  });
}

/**
 * @param {string} templateSpec
 * @returns {{ ok: boolean, templateSpec: string, projectRoot: string|null, steps: Array<{ name: string, ok: boolean, details: Record<string, any>, diagnostics: TemplateCheckDiagnostic[] }>, diagnostics: TemplateCheckDiagnostic[], errors: string[] }}
 */
export function buildTemplateCheckPayload(templateSpec) {
  if (!templateSpec) {
    throw new Error("topogram template check requires <template-spec-or-path>.");
  }
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-check-"));
  const projectRoot = path.join(runRoot, "starter");
  /** @type {Array<{ name: string, ok: boolean, details: Record<string, any>, diagnostics: TemplateCheckDiagnostic[] }>} */
  const steps = [];
  /** @type {TemplateCheckDiagnostic[]} */
  const diagnostics = [];
  try {
    const callerPolicyInfo = loadTemplatePolicy(process.cwd());
    if (callerPolicyInfo.exists) {
      const resolvedTemplate = resolveTemplate(templateSpec, TEMPLATES_ROOT);
      const policyDiagnostics = templatePolicyDiagnosticsForTemplate(callerPolicyInfo, resolvedTemplate, "template-check-policy");
      if (policyDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        const stepDiagnostics = policyDiagnostics.map((diagnostic) => templateCheckDiagnostic(diagnostic));
        diagnostics.push(...stepDiagnostics);
        steps.push(templateCheckStep("template-policy", false, {
          path: callerPolicyInfo.path
        }, stepDiagnostics));
        return {
          ok: false,
          templateSpec,
          projectRoot: null,
          steps,
          diagnostics,
          errors: diagnostics.map((diagnostic) => diagnostic.message)
        };
      }
    }
    const created = createNewProject({
      targetPath: projectRoot,
      templateName: templateSpec,
      engineRoot: ENGINE_ROOT,
      templatesRoot: TEMPLATES_ROOT
    });
    steps.push(templateCheckStep("create-starter", true, {
      template: created.templateName,
      warnings: created.warnings.length
    }));
    const generatorDependencies = templateCheckGeneratorDependencies(projectRoot);
    const installDiagnostic = installTemplateCheckGeneratorDependencies(projectRoot, generatorDependencies);
    if (installDiagnostic) {
      diagnostics.push(installDiagnostic);
      steps.push(templateCheckStep("generator-dependencies", false, {
        dependencies: generatorDependencies
      }, [installDiagnostic]));
      return {
        ok: false,
        templateSpec,
        projectRoot,
        steps,
        diagnostics,
        errors: diagnostics.map((diagnostic) => diagnostic.message)
      };
    }
    if (generatorDependencies.length > 0) {
      steps.push(templateCheckStep("generator-dependencies", true, {
        dependencies: generatorDependencies
      }));
    }
  } catch (error) {
    const stepDiagnostics = [
      diagnosticForTemplateCreateFailure(messageFromError(error), templateSpec, "create-starter")
    ];
    diagnostics.push(...stepDiagnostics);
    steps.push(templateCheckStep("create-starter", false, {}, stepDiagnostics));
    return {
      ok: false,
      templateSpec,
      projectRoot: null,
      steps,
      diagnostics,
      errors: diagnostics.map((diagnostic) => diagnostic.message)
    };
  }

  const projectConfigInfo = loadProjectConfig(projectRoot);
  if (!projectConfigInfo) {
    const stepDiagnostics = [
      templateCheckDiagnostic({
        code: "starter_project_config_missing",
        message: "Generated starter is missing topogram.project.json.",
        path: path.join(projectRoot, "topogram.project.json"),
        suggestedFix: "Ensure the template includes topogram.project.json at its root.",
        step: "project-config"
      })
    ];
    diagnostics.push(...stepDiagnostics);
    steps.push(templateCheckStep("project-config", false, {}, stepDiagnostics));
    return {
      ok: false,
      templateSpec,
      projectRoot,
      steps,
      diagnostics,
      errors: diagnostics.map((diagnostic) => diagnostic.message)
    };
  }
  steps.push(templateCheckStep("project-config", true, {
    path: projectConfigInfo.configPath,
    template: projectConfigInfo.config.template?.id || null
  }));

  const ast = parsePath(resolveTopoRoot(projectRoot));
  const resolved = resolveWorkspace(ast);
  const projectValidation = combineProjectValidationResults(
    validateProjectConfig(projectConfigInfo.config, resolved.ok ? resolved.graph : null, { configDir: projectConfigInfo.configDir }),
    validateProjectOutputOwnership(projectConfigInfo),
    validateProjectImplementationTrust(projectConfigInfo)
  );
  const starterCheckOk = resolved.ok && projectValidation.ok;
  const starterDiagnostics = [
    ...(resolved.ok ? [] : resolved.validation.errors),
    ...projectValidation.errors
  ].map((error) => diagnosticForStarterCheckFailure(error, "starter-check", projectConfigInfo.configPath));
  steps.push(templateCheckStep("starter-check", starterCheckOk, {
    files: ast.files.length,
    statements: ast.files.flatMap((/** @type {{ statements: any[] }} */ file) => file.statements).length
  }, starterDiagnostics));
  if (!starterCheckOk) {
    diagnostics.push(...starterDiagnostics);
  }

  const implementationInfo = projectConfigInfo.config.implementation
    ? {
        config: projectConfigInfo.config.implementation,
        configPath: projectConfigInfo.configPath,
        configDir: projectConfigInfo.configDir
      }
    : null;
  if (implementationInfo && implementationRequiresTrust(implementationInfo, projectConfigInfo.config)) {
    const trustStatus = getTemplateTrustStatus(implementationInfo, projectConfigInfo.config);
    const trustDiagnostics = trustStatus.issues.map((issue) => templateCheckDiagnostic({
      code: "template_trust_invalid",
      message: issue,
      path: trustStatus.trustPath,
      suggestedFix: templateTrustRecoveryGuidance(issue),
      step: "executable-implementation-trust"
    }));
    steps.push(templateCheckStep("executable-implementation-trust", trustStatus.ok, {
      requiresTrust: true,
      trustPath: trustStatus.trustPath,
      trustedFiles: trustStatus.trustRecord?.content?.files?.length || 0
    }, trustDiagnostics));
    if (!trustStatus.ok) {
      diagnostics.push(...trustDiagnostics);
    }
  } else {
    steps.push(templateCheckStep("executable-implementation-trust", true, {
      requiresTrust: false
    }));
  }

  try {
    const updatePlan = buildTemplateUpdatePlan({
      projectRoot,
      projectConfig: projectConfigInfo.config,
      templateName: null,
      templatesRoot: TEMPLATES_ROOT
    });
    steps.push(templateCheckStep("template-update-plan", updatePlan.ok, {
      writes: updatePlan.writes,
      added: updatePlan.summary.added,
      changed: updatePlan.summary.changed,
      currentOnly: updatePlan.summary.currentOnly
    }));
    if (!updatePlan.ok) {
      const stepDiagnostics = updatePlan.issues.map((issue) => templateCheckDiagnostic({
        code: "template_update_plan_failed",
        message: issue,
        path: projectConfigInfo.configPath,
        suggestedFix: "Fix template metadata so a no-write update plan can be produced.",
        step: "template-update-plan"
      }));
      steps[steps.length - 1].diagnostics.push(...stepDiagnostics);
      diagnostics.push(...stepDiagnostics);
    }
  } catch (error) {
    const stepDiagnostics = [
      templateCheckDiagnostic({
        code: "template_update_plan_failed",
        message: messageFromError(error),
        path: projectConfigInfo.configPath,
        suggestedFix: "Fix template metadata so a no-write update plan can be produced.",
        step: "template-update-plan"
      })
    ];
    diagnostics.push(...stepDiagnostics);
    steps.push(templateCheckStep("template-update-plan", false, {}, stepDiagnostics));
  }

  return {
    ok: steps.every((step) => step.ok),
    templateSpec,
    projectRoot,
    steps,
    diagnostics,
    errors: diagnostics.map((diagnostic) => diagnostic.message)
  };
}

/**
 * @param {Record<string, any>} details
 * @returns {string[]}
 */
function formatTemplateCheckDetails(details) {
  return Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `  ${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
}

/**
 * @param {ReturnType<typeof buildTemplateCheckPayload>} payload
 * @returns {void}
 */
export function printTemplateCheckPayload(payload) {
  console.log(payload.ok ? "Template check passed" : "Template check failed");
  console.log(`Template spec: ${payload.templateSpec}`);
  if (payload.projectRoot) {
    console.log(`Temp starter: ${payload.projectRoot}`);
  }
  for (const step of payload.steps) {
    console.log(`${step.ok ? "PASS" : "FAIL"} ${step.name}`);
    for (const detail of formatTemplateCheckDetails(step.details)) {
      console.log(detail);
    }
    for (const diagnostic of step.diagnostics) {
      console.log(`  [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
      if (diagnostic.path) {
        console.log(`    path: ${diagnostic.path}`);
      }
      if (diagnostic.suggestedFix) {
        console.log(`    fix: ${diagnostic.suggestedFix}`);
      }
    }
  }
  const stepDiagnostics = new Set(payload.steps.flatMap((step) => step.diagnostics));
  for (const diagnostic of payload.diagnostics.filter((item) => !stepDiagnostics.has(item))) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.path) {
      console.log(`  path: ${diagnostic.path}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
}

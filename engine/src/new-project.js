// @ts-check

export { packageNameFromSpec, packageScopeFromSpec } from "./new-project/package-spec.js";
export { installPackageSpec, resolveTemplate } from "./new-project/template-resolution.js";
export { loadTemplatePolicy, templatePolicyDiagnosticsForTemplate, writeTemplatePolicy, writeTemplatePolicyForProject } from "./new-project/template-policy.js";
export { writeTemplateFilesManifest } from "./new-project/template-snapshots.js";
export { applyTemplateUpdate, applyTemplateUpdateFileAction, buildTemplateUpdateCheck, buildTemplateUpdatePlan, buildTemplateUpdateStatus } from "./new-project/template-updates.js";
export { createNewProject } from "./new-project/create.js";

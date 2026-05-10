// @ts-check

import path from "node:path";

import { defaultGeneratorPolicy, writeGeneratorPolicy } from "../generator-policy.js";
import { writeTemplateTrustRecord } from "../template-trust.js";
import { DEFAULT_TEMPLATE_NAME } from "./constants.js";
import { writeProjectTemplateMetadata } from "./metadata.js";
import { assertProjectOutsideEngine, copyTopogramWorkspace, ensureCreatableProjectRoot, writeAgentsGuide, writeExplainScript, writeProjectPackage, writeProjectReadme } from "./project-files.js";
import { resolveTemplate } from "./template-resolution.js";
import { defaultTemplatePolicyForTemplate, writeTemplatePolicy } from "./template-policy.js";
import { writeTemplateFilesManifest } from "./template-snapshots.js";

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
 * @param {CreateNewProjectOptions} options
 * @returns {{ projectRoot: string, templateName: string, template: Record<string, any>, topogramPath: string, appPath: string, warnings: string[] }}
 */
export function createNewProject({
  targetPath,
  templateName = DEFAULT_TEMPLATE_NAME,
  engineRoot,
  templatesRoot,
  templateProvenance = null
}) {
  if (!targetPath) {
    throw new Error("topogram new requires <path>.");
  }
  const projectRoot = path.resolve(targetPath);
  assertProjectOutsideEngine(projectRoot, engineRoot);
  const template = resolveTemplate(templateName, templatesRoot);
  if (
    templateProvenance &&
    typeof templateProvenance.includesExecutableImplementation === "boolean" &&
    templateProvenance.includesExecutableImplementation !== Boolean(template.manifest.includesExecutableImplementation)
  ) {
    throw new Error(
      `Catalog entry '${templateProvenance.id}' declares includesExecutableImplementation: ${templateProvenance.includesExecutableImplementation}, ` +
        `but template package '${template.packageSpec || template.requested}' declares includesExecutableImplementation: ${Boolean(template.manifest.includesExecutableImplementation)}.`
    );
  }

  ensureCreatableProjectRoot(projectRoot);
  copyTopogramWorkspace(template.root, projectRoot);
  const projectConfig = writeProjectTemplateMetadata(projectRoot, template, templateProvenance);
  writeProjectPackage(projectRoot, engineRoot, template);
  writeExplainScript(projectRoot);
  writeProjectReadme(projectRoot, projectConfig);
  writeAgentsGuide(projectRoot, projectConfig);
  writeTemplateFilesManifest(projectRoot, projectConfig);
  writeTemplatePolicy(projectRoot, defaultTemplatePolicyForTemplate(template));
  writeGeneratorPolicy(projectRoot, defaultGeneratorPolicy());

  const warnings = [];
  if (template.manifest.includesExecutableImplementation) {
    writeTemplateTrustRecord(projectRoot, projectConfig);
    warnings.push(
      `Template '${template.manifest.id}' copied implementation/ code into this project. ` +
        "topogram new did not execute it, but topogram generate may load it later. " +
        "Recorded local trust in .topogram-template-trust.json."
    );
  }

  return {
    projectRoot,
    templateName: template.manifest.id,
    template: projectConfig.template,
    topogramPath: path.join(projectRoot, "topogram"),
    appPath: path.join(projectRoot, "app"),
    warnings
  };
}

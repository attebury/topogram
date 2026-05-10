// @ts-check

import fs from "node:fs";
import path from "node:path";

import { stableJsonStringify } from "./json.js";

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
 * @param {string} projectRoot
 * @param {ResolvedTemplate} template
 * @param {CatalogTemplateProvenance|null} [templateProvenance]
 * @returns {Record<string, any>}
 */
export function writeProjectTemplateMetadata(projectRoot, template, templateProvenance = null) {
  const projectConfigPath = path.join(projectRoot, "topogram.project.json");
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
  projectConfig.template = projectTemplateMetadata(template, templateProvenance);
  fs.writeFileSync(projectConfigPath, `${stableJsonStringify(projectConfig)}\n`, "utf8");
  return projectConfig;
}

/**
 * @param {ResolvedTemplate} template
 * @param {CatalogTemplateProvenance|null} [templateProvenance]
 * @returns {{ id: string, version: string, source: string, requested: string, sourceSpec: string, sourceRoot: string|null, includesExecutableImplementation: boolean, catalog?: CatalogTemplateProvenance }}
 */
export function projectTemplateMetadata(template, templateProvenance = null) {
  /** @type {{ id: string, version: string, source: string, requested: string, sourceSpec: string, sourceRoot: string|null, includesExecutableImplementation: boolean, catalog?: CatalogTemplateProvenance }} */
  const metadata = {
    id: template.manifest.id,
    version: template.manifest.version,
    source: template.source,
    requested: templateProvenance?.id || template.requested,
    sourceSpec: template.packageSpec || template.requested,
    sourceRoot: template.source === "local" ? template.root : null,
    includesExecutableImplementation: Boolean(template.manifest.includesExecutableImplementation)
  };
  if (templateProvenance) {
    metadata.catalog = templateProvenance;
  }
  return metadata;
}

/**
 * @param {Record<string, any>} projectConfig
 * @returns {{ id: string|null, version: string|null, source: string|null, sourceSpec: string|null, requested: string|null }}
 */
export function currentTemplateMetadata(projectConfig) {
  const currentTemplate = projectConfig.template || {};
  return {
    id: typeof currentTemplate.id === "string" ? currentTemplate.id : null,
    version: typeof currentTemplate.version === "string" ? currentTemplate.version : null,
    source: typeof currentTemplate.source === "string" ? currentTemplate.source : null,
    sourceSpec: typeof currentTemplate.sourceSpec === "string" ? currentTemplate.sourceSpec : null,
    requested: typeof currentTemplate.requested === "string" ? currentTemplate.requested : null
  };
}

/**
 * @param {ResolvedTemplate} template
 * @param {Record<string, any>|null} currentProjectConfig
 * @returns {ReturnType<typeof projectTemplateMetadata>}
 */
export function candidateProjectTemplateMetadata(template, currentProjectConfig) {
  const metadata = projectTemplateMetadata(template);
  const currentTemplate = currentProjectConfig?.template || null;
  if (!currentTemplate || currentTemplate.id !== metadata.id) {
    return metadata;
  }
  if (typeof currentTemplate.requested === "string" && currentTemplate.requested) {
    metadata.requested = currentTemplate.requested;
  }
  if (currentTemplate.catalog && typeof currentTemplate.catalog === "object") {
    metadata.catalog = {
      ...currentTemplate.catalog,
      package: typeof currentTemplate.catalog.package === "string"
        ? currentTemplate.catalog.package
        : metadata.id,
      version: metadata.version,
      packageSpec: metadata.sourceSpec
    };
  }
  return metadata;
}

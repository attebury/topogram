// @ts-check

export const CLI_PACKAGE_NAME = "@topogram/cli";
export const DEFAULT_TEMPLATE_NAME = "hello-web";
export const TEMPLATE_MANIFEST = "topogram-template.json";
export const TEMPLATE_FILES_MANIFEST = ".topogram-template-files.json";
export const TEMPLATE_POLICY_FILE = "topogram.template-policy.json";
export const MAX_TEXT_DIFF_BYTES = 256 * 1024;

export const GENERATOR_LABELS = new Map([
  ["topogram/express", "Express"],
  ["topogram/hono", "Hono"],
  ["topogram/postgres", "Postgres"],
  ["topogram/react", "React"],
  ["topogram/sqlite", "SQLite"],
  ["topogram/sveltekit", "SvelteKit"],
  ["topogram/vanilla-web", "Vanilla HTML/CSS/JS"]
]);

export const SURFACE_ORDER = new Map([
  ["web_surface", 10],
  ["api_service", 20],
  ["database", 30],
  ["ios_surface", 40],
  ["android_surface", 50]
]);

/**
 * @param {string} templateId
 * @param {string} relativePath
 * @returns {string}
 */
export function unsupportedTemplateSymlinkMessage(templateId, relativePath) {
  return `Template '${templateId}' contains unsupported symlink '${relativePath}'. Template packs must copy real files because Topogram records hashes for copied topogram/ and implementation/ content; symlinks can point outside the trusted template root. Replace the symlink with a real file or directory before running topogram new or topogram template check.`;
}

/**
 * @typedef {Object} CreateNewProjectOptions
 * @property {string} targetPath
 * @property {string} [templateName]
 * @property {string} engineRoot
 * @property {string} templatesRoot
 * @property {CatalogTemplateProvenance|null} [templateProvenance]
 */

/**
 * @typedef {Object} TemplateUpdatePlanOptions
 * @property {string} projectRoot
 * @property {Record<string, any>} projectConfig
 * @property {string|null} [templateName]
 * @property {string} templatesRoot
 */

/**
 * @typedef {TemplateUpdatePlanOptions & { filePath: string, action: "accept-current"|"accept-candidate"|"delete-current" }} TemplateUpdateFileActionOptions
 */

/**
 * @typedef {Object} TemplateOwnedFileRecord
 * @property {string} path
 * @property {string} sha256
 * @property {number} size
 */

/**
 * @typedef {Object} TemplateManifest
 * @property {string} id
 * @property {string} version
 * @property {string} kind
 * @property {string} topogramVersion
 * @property {boolean} [includesExecutableImplementation]
 * @property {string} [description]
 * @property {Record<string, string>} [starterScripts]
 */

/**
 * @typedef {Object} TemplateTopologySummary
 * @property {string[]} surfaces
 * @property {string[]} generators
 * @property {string} stack
 */

/**
 * @typedef {Object} TemplatePolicy
 * @property {string} version
 * @property {Array<"local"|"package">} allowedSources
 * @property {string[]} allowedTemplateIds
 * @property {string[]} [allowedPackageScopes]
 * @property {"allow"|"warn"|"deny"} executableImplementation
 * @property {Record<string, string>} [pinnedVersions]
 */

/**
 * @typedef {Object} TemplatePolicyInfo
 * @property {string} path
 * @property {TemplatePolicy|null} policy
 * @property {boolean} exists
 * @property {TemplateUpdateDiagnostic[]} diagnostics
 */

/**
 * @typedef {Object} TemplateUpdateDiagnostic
 * @property {string} code
 * @property {"error"|"warning"} severity
 * @property {string} message
 * @property {string|null} path
 * @property {string|null} suggestedFix
 * @property {string|null} step
 */

/**
 * @typedef {Object} ResolvedTemplate
 * @property {string} requested
 * @property {string} root
 * @property {TemplateManifest} manifest
 * @property {"local"|"package"} source
 * @property {string|null} packageSpec
 */

/**
 * @typedef {Object} CatalogTemplateProvenance
 * @property {string} id
 * @property {string} source
 * @property {string} package
 * @property {string} version
 * @property {string} packageSpec
 * @property {boolean} [includesExecutableImplementation]
 */

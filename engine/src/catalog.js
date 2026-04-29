// @ts-check

import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { installPackageSpec } from "./new-project.js";

export const DEFAULT_CATALOG_SOURCE = "github:attebury/topograms/topograms.catalog.json";
export const CATALOG_FILE_NAME = "topograms.catalog.json";

/**
 * @typedef {Object} CatalogTrust
 * @property {string} scope
 * @property {boolean} includesExecutableImplementation
 * @property {string} [notes]
 */

/**
 * @typedef {Object} CatalogEntry
 * @property {string} id
 * @property {"template"|"topogram"} kind
 * @property {string} package
 * @property {string} defaultVersion
 * @property {string} description
 * @property {string[]} tags
 * @property {CatalogTrust} trust
 */

/**
 * @typedef {Object} TopogramCatalog
 * @property {string} version
 * @property {CatalogEntry[]} entries
 */

/**
 * @typedef {Object} CatalogDiagnostic
 * @property {string} code
 * @property {"error"|"warning"} severity
 * @property {string} message
 * @property {string|null} path
 * @property {string|null} suggestedFix
 */

/**
 * @typedef {Object} CatalogValidationResult
 * @property {boolean} ok
 * @property {TopogramCatalog|null} catalog
 * @property {CatalogDiagnostic[]} diagnostics
 * @property {string[]} errors
 */

/**
 * @typedef {Object} CatalogLoadResult
 * @property {string} source
 * @property {TopogramCatalog} catalog
 * @property {CatalogDiagnostic[]} diagnostics
 */

/**
 * @param {Record<string, unknown>} input
 * @returns {CatalogDiagnostic}
 */
function catalogDiagnostic(input) {
  return {
    code: String(input.code || "catalog_invalid"),
    severity: input.severity === "warning" ? "warning" : "error",
    message: String(input.message || "Catalog is invalid."),
    path: typeof input.path === "string" ? input.path : null,
    suggestedFix: typeof input.suggestedFix === "string" ? input.suggestedFix : null
  };
}

/**
 * @param {string|undefined|null} source
 * @returns {string}
 */
export function catalogSourceOrDefault(source = null) {
  return source || process.env.TOPOGRAM_CATALOG_SOURCE || DEFAULT_CATALOG_SOURCE;
}

/**
 * @param {string|undefined|null} source
 * @returns {boolean}
 */
export function isCatalogSourceDisabled(source) {
  const normalized = String(source || "").trim().toLowerCase();
  return normalized === "none" || normalized === "off" || normalized === "false";
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isPackageName(value) {
  return /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(value);
}

/**
 * @param {unknown} value
 * @param {string} source
 * @returns {CatalogValidationResult}
 */
export function validateCatalog(value, source = "") {
  /** @type {CatalogDiagnostic[]} */
  const diagnostics = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    diagnostics.push(catalogDiagnostic({
      code: "catalog_not_object",
      message: "Catalog must contain a JSON object.",
      path: source || null,
      suggestedFix: `Create ${CATALOG_FILE_NAME} with version and entries[].`
    }));
    return validationResult(null, diagnostics);
  }

  const input = /** @type {Record<string, unknown>} */ (value);
  const version = typeof input.version === "string" && input.version ? input.version : "";
  if (!version) {
    diagnostics.push(catalogDiagnostic({
      code: "catalog_version_missing",
      message: "Catalog is missing required string field 'version'.",
      path: source || null,
      suggestedFix: "Add a version string such as \"0.1\"."
    }));
  }
  if (!Array.isArray(input.entries)) {
    diagnostics.push(catalogDiagnostic({
      code: "catalog_entries_missing",
      message: "Catalog is missing required array field 'entries'.",
      path: source || null,
      suggestedFix: "Add entries[] with template and topogram package references."
    }));
    return validationResult({ version, entries: [] }, diagnostics);
  }

  /** @type {CatalogEntry[]} */
  const entries = [];
  const ids = new Set();
  input.entries.forEach((entryValue, index) => {
    const entryPath = `entries[${index}]`;
    if (!entryValue || typeof entryValue !== "object" || Array.isArray(entryValue)) {
      diagnostics.push(catalogDiagnostic({
        code: "catalog_entry_not_object",
        message: `Catalog ${entryPath} must be an object.`,
        path: source || null,
        suggestedFix: "Replace the entry with an object containing id, kind, package, defaultVersion, description, tags, and trust."
      }));
      return;
    }
    const entry = /** @type {Record<string, unknown>} */ (entryValue);
    const id = stringField(entry, "id");
    const kind = stringField(entry, "kind");
    const packageName = stringField(entry, "package");
    const defaultVersion = stringField(entry, "defaultVersion");
    const description = stringField(entry, "description");
    const tags = Array.isArray(entry.tags) ? entry.tags.map(String).filter(Boolean) : [];
    const trust = trustField(entry.trust);

    for (const field of ["id", "kind", "package", "defaultVersion", "description"]) {
      if (!stringField(entry, field)) {
        diagnostics.push(catalogDiagnostic({
          code: "catalog_entry_field_missing",
          message: `Catalog ${entryPath} is missing required string field '${field}'.`,
          path: source || null,
          suggestedFix: `Add ${field} to ${entryPath}.`
        }));
      }
    }
    if (id && ids.has(id)) {
      diagnostics.push(catalogDiagnostic({
        code: "catalog_duplicate_id",
        message: `Catalog entry id '${id}' is duplicated.`,
        path: source || null,
        suggestedFix: "Use stable unique ids for catalog entries."
      }));
    }
    if (id) {
      ids.add(id);
    }
    if (kind && kind !== "template" && kind !== "topogram") {
      diagnostics.push(catalogDiagnostic({
        code: "catalog_invalid_kind",
        message: `Catalog entry '${id || entryPath}' has invalid kind '${kind}'.`,
        path: source || null,
        suggestedFix: "Use kind \"template\" or \"topogram\"."
      }));
    }
    if (packageName && !isPackageName(packageName)) {
      diagnostics.push(catalogDiagnostic({
        code: "catalog_invalid_package",
        message: `Catalog entry '${id || entryPath}' package must be an npm package name, not '${packageName}'.`,
        path: source || null,
        suggestedFix: "Use package plus defaultVersion separately, for example @scope/topogram-template-name and 0.1.0."
      }));
    }
    if (defaultVersion && /\s/.test(defaultVersion)) {
      diagnostics.push(catalogDiagnostic({
        code: "catalog_invalid_default_version",
        message: `Catalog entry '${id || entryPath}' defaultVersion must not contain whitespace.`,
        path: source || null,
        suggestedFix: "Use an exact version or npm dist-tag."
      }));
    }
    if (!Array.isArray(entry.tags)) {
      diagnostics.push(catalogDiagnostic({
        code: "catalog_tags_missing",
        message: `Catalog entry '${id || entryPath}' is missing required tags array.`,
        path: source || null,
        suggestedFix: "Add tags as an array of strings."
      }));
    }
    if (!trust) {
      diagnostics.push(catalogDiagnostic({
        code: "catalog_trust_missing",
        message: `Catalog entry '${id || entryPath}' is missing required trust metadata.`,
        path: source || null,
        suggestedFix: "Add trust.scope and trust.includesExecutableImplementation."
      }));
    } else if (kind === "topogram" && trust.includesExecutableImplementation) {
      diagnostics.push(catalogDiagnostic({
        code: "catalog_topogram_executable_not_supported",
        message: `Catalog topogram entry '${id || entryPath}' cannot include executable implementation in v1.`,
        path: source || null,
        suggestedFix: "Move executable code into a template package, or set includesExecutableImplementation to false."
      }));
    }

    entries.push({
      id,
      kind: kind === "topogram" ? "topogram" : "template",
      package: packageName,
      defaultVersion,
      description,
      tags,
      trust: trust || { scope: "", includesExecutableImplementation: false }
    });
  });

  return validationResult({ version, entries }, diagnostics);
}

/**
 * @param {TopogramCatalog|null} catalog
 * @param {CatalogDiagnostic[]} diagnostics
 * @returns {CatalogValidationResult}
 */
function validationResult(catalog, diagnostics) {
  const errors = diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => diagnostic.message);
  return {
    ok: errors.length === 0,
    catalog: errors.length === 0 ? catalog : null,
    diagnostics,
    errors
  };
}

/**
 * @param {Record<string, unknown>} input
 * @param {string} field
 * @returns {string}
 */
function stringField(input, field) {
  const value = input[field];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {unknown} value
 * @returns {CatalogTrust|null}
 */
function trustField(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const trust = /** @type {Record<string, unknown>} */ (value);
  if (typeof trust.scope !== "string" || !trust.scope) {
    return null;
  }
  if (typeof trust.includesExecutableImplementation !== "boolean") {
    return null;
  }
  const result = {
    scope: trust.scope,
    includesExecutableImplementation: trust.includesExecutableImplementation
  };
  if (typeof trust.notes === "string" && trust.notes) {
    return { ...result, notes: trust.notes };
  }
  return result;
}

/**
 * @param {string|undefined|null} sourceInput
 * @returns {CatalogLoadResult}
 */
export function loadCatalog(sourceInput = null) {
  const source = catalogSourceOrDefault(sourceInput);
  if (isCatalogSourceDisabled(source)) {
    throw new Error("Catalog source is disabled.");
  }
  const text = readCatalogText(source);
  const parsed = JSON.parse(text);
  const validation = validateCatalog(parsed, source);
  if (!validation.ok || !validation.catalog) {
    throw new Error(validation.errors.join("\n") || `Catalog '${source}' is invalid.`);
  }
  return {
    source,
    catalog: validation.catalog,
    diagnostics: validation.diagnostics
  };
}

/**
 * @param {string} source
 * @returns {CatalogValidationResult & { source: string }}
 */
export function checkCatalogSource(source) {
  const text = readCatalogText(source);
  const parsed = JSON.parse(text);
  return {
    source,
    ...validateCatalog(parsed, source)
  };
}

/**
 * @param {string} source
 * @returns {string}
 */
function readCatalogText(source) {
  if (source.startsWith("github:")) {
    return readGithubCatalogText(source);
  }
  if (source.startsWith("https://") || source.startsWith("http://")) {
    return readUrlText(source);
  }
  const resolvedPath = path.resolve(source);
  return fs.readFileSync(resolvedPath, "utf8");
}

/**
 * @param {string} source
 * @returns {string}
 */
function readGithubCatalogText(source) {
  const spec = source.slice("github:".length);
  const [pathPart, ref] = spec.split("?ref=");
  const segments = pathPart.split("/").filter(Boolean);
  if (segments.length < 3) {
    throw new Error(`Invalid GitHub catalog source '${source}'. Expected github:owner/repo/path/to/catalog.json.`);
  }
  const [owner, repo, ...fileSegments] = segments;
  const apiPath = `repos/${owner}/${repo}/contents/${fileSegments.join("/")}`;
  const args = ["api", apiPath, "--jq", ".content"];
  if (ref) {
    args.splice(2, 0, "-f", `ref=${ref}`);
  }
  const result = childProcess.spawnSync("gh", args, {
    encoding: "utf8",
    env: {
      ...process.env,
      GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "",
      PATH: process.env.PATH || ""
    }
  });
  if (result.status !== 0) {
    const reason = result.error?.message || result.stderr || result.stdout || "unknown error";
    throw new Error(
      `Failed to read catalog '${source}' with gh api. Set GITHUB_TOKEN or GH_TOKEN, or run gh auth login.\n${reason}`.trim()
    );
  }
  return Buffer.from(result.stdout.replace(/\s+/g, ""), "base64").toString("utf8");
}

/**
 * @param {string} source
 * @returns {string}
 */
function readUrlText(source) {
  const args = ["-fsSL", source];
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  if (token && source.includes("github.com")) {
    args.unshift("-H", `Authorization: Bearer ${token}`);
  }
  const result = childProcess.spawnSync("curl", args, {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: process.env.PATH || ""
    }
  });
  if (result.status !== 0) {
    const reason = result.error?.message || result.stderr || result.stdout || "unknown error";
    throw new Error(`Failed to read catalog URL '${source}'.\n${reason}`.trim());
  }
  return result.stdout;
}

/**
 * @param {TopogramCatalog} catalog
 * @param {string} id
 * @param {"template"|"topogram"|null} [kind]
 * @returns {CatalogEntry|null}
 */
export function findCatalogEntry(catalog, id, kind = null) {
  return catalog.entries.find((entry) => entry.id === id && (!kind || entry.kind === kind)) || null;
}

/**
 * @param {CatalogEntry} entry
 * @param {string|null|undefined} version
 * @returns {string}
 */
export function catalogEntryPackageSpec(entry, version = null) {
  return `${entry.package}@${version || entry.defaultVersion}`;
}

/**
 * @param {CatalogEntry} entry
 * @returns {{ id: string, version: string, source: "catalog", name: string, package: string, defaultVersion: string, description: string, tags: string[], includesExecutableImplementation: boolean, trust: CatalogTrust }}
 */
export function catalogTemplateListItem(entry) {
  return {
    id: entry.id,
    version: entry.defaultVersion,
    source: "catalog",
    name: entry.id,
    package: entry.package,
    defaultVersion: entry.defaultVersion,
    description: entry.description,
    tags: entry.tags,
    includesExecutableImplementation: entry.trust.includesExecutableImplementation,
    trust: entry.trust
  };
}

/**
 * @param {CatalogEntry} entry
 * @param {string} targetPath
 * @param {{ version?: string|null }} [options]
 * @returns {{ ok: boolean, id: string, kind: "topogram", packageSpec: string, targetPath: string, files: string[] }}
 */
export function copyCatalogTopogramEntry(entry, targetPath, options = {}) {
  if (entry.kind !== "topogram") {
    throw new Error(`Catalog entry '${entry.id}' is a ${entry.kind}, not a topogram.`);
  }
  const packageSpec = catalogEntryPackageSpec(entry, options.version || null);
  const packageRoot = installPackageSpec(packageSpec);
  const implementationRoot = path.join(packageRoot, "implementation");
  if (fs.existsSync(implementationRoot)) {
    throw new Error(
      `Catalog topogram entry '${entry.id}' package '${packageSpec}' contains implementation/, which is not allowed for v1 topogram entries.`
    );
  }
  const topogramRoot = path.join(packageRoot, "topogram");
  if (!fs.existsSync(topogramRoot) || !fs.statSync(topogramRoot).isDirectory()) {
    throw new Error(`Catalog topogram entry '${entry.id}' package '${packageSpec}' is missing topogram/.`);
  }

  const resolvedTarget = path.resolve(targetPath);
  ensureEmptyDirectory(resolvedTarget);
  /** @type {string[]} */
  const files = [];
  copyPath(topogramRoot, path.join(resolvedTarget, "topogram"), "topogram", files);
  for (const fileName of ["topogram.project.json", "README.md"]) {
    const sourcePath = path.join(packageRoot, fileName);
    if (fs.existsSync(sourcePath) && fs.statSync(sourcePath).isFile()) {
      copyPath(sourcePath, path.join(resolvedTarget, fileName), fileName, files);
    }
  }
  return {
    ok: true,
    id: entry.id,
    kind: "topogram",
    packageSpec,
    targetPath: resolvedTarget,
    files: files.sort((a, b) => a.localeCompare(b))
  };
}

/**
 * @param {string} targetPath
 * @returns {void}
 */
function ensureEmptyDirectory(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
    return;
  }
  if (!fs.statSync(targetPath).isDirectory()) {
    throw new Error(`Cannot copy catalog topogram into non-directory path '${targetPath}'.`);
  }
  const entries = fs.readdirSync(targetPath).filter((entry) => entry !== ".DS_Store");
  if (entries.length > 0) {
    throw new Error(`Refusing to copy catalog topogram into non-empty directory '${targetPath}'.`);
  }
}

/**
 * @param {string} sourcePath
 * @param {string} targetPath
 * @param {string} relativePath
 * @param {string[]} files
 * @returns {void}
 */
function copyPath(sourcePath, targetPath, relativePath, files) {
  fs.cpSync(sourcePath, targetPath, { recursive: true });
  collectFiles(targetPath, relativePath, files);
}

/**
 * @param {string} currentPath
 * @param {string} relativePath
 * @param {string[]} files
 * @returns {void}
 */
function collectFiles(currentPath, relativePath, files) {
  const stat = fs.statSync(currentPath);
  if (stat.isFile()) {
    files.push(relativePath.replace(/\\/g, "/"));
    return;
  }
  if (!stat.isDirectory()) {
    return;
  }
  for (const entry of fs.readdirSync(currentPath)) {
    collectFiles(path.join(currentPath, entry), path.join(relativePath, entry), files);
  }
}

// @ts-check

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { installPackageSpec } from "./new-project.js";

export const DEFAULT_CATALOG_SOURCE = "https://raw.githubusercontent.com/attebury/topograms/main/topograms.catalog.json";
export const CATALOG_FILE_NAME = "topograms.catalog.json";
export const TOPOGRAM_SOURCE_FILE = ".topogram-source.json";
const KNOWN_CATALOG_SURFACES = new Set(["web", "api", "database", "native"]);
const GITHUB_TOKEN_HOSTS = new Set([
  "github.com",
  "api.github.com",
  "raw.githubusercontent.com"
]);
const FETCH_URL_SCRIPT = `
const source = process.argv[1];
const token = process.env.TOPOGRAM_FETCH_TOKEN || "";
const tokenHosts = new Set(["github.com", "api.github.com", "raw.githubusercontent.com"]);
function tokenAllowed(url) {
  const hostname = new URL(url).hostname.toLowerCase();
  return tokenHosts.has(hostname) || hostname.endsWith(".github.com");
}
async function readUrl(url, redirects = 0) {
  if (redirects > 5) {
    throw new Error("Too many redirects.");
  }
  const headers = {};
  if (token && tokenAllowed(url)) {
    headers.authorization = "Bearer " + token;
  }
  const response = await fetch(url, { headers, redirect: "manual" });
  if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
    const next = new URL(response.headers.get("location"), url).toString();
    return readUrl(next, redirects + 1);
  }
  const text = await response.text();
  if (!response.ok) {
    const preview = text.trim().slice(0, 400);
    throw new Error(String(response.status) + " " + response.statusText + (preview ? "\\n" + preview : ""));
  }
  return text;
}
try {
  process.stdout.write(await readUrl(source));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
`;

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
 * @property {string[]} [surfaces]
 * @property {string[]} [generators]
 * @property {string} [stack]
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
    const surfaces = Array.isArray(entry.surfaces) ? entry.surfaces.map(String).filter(Boolean) : [];
    const generators = Array.isArray(entry.generators) ? entry.generators.map(String).filter(Boolean) : [];
    const stack = stringField(entry, "stack");
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
    if (Object.prototype.hasOwnProperty.call(entry, "surfaces") && !Array.isArray(entry.surfaces)) {
      diagnostics.push(catalogDiagnostic({
        code: "catalog_optional_surfaces_invalid",
        severity: "warning",
        message: `Catalog entry '${id || entryPath}' surfaces should be an array of surface ids.`,
        path: source || null,
        suggestedFix: "Use surfaces such as [\"web\"], [\"api\"], [\"database\"], or [\"native\"]."
      }));
    }
    for (const surface of surfaces) {
      if (!KNOWN_CATALOG_SURFACES.has(surface)) {
        diagnostics.push(catalogDiagnostic({
          code: "catalog_optional_surface_unknown",
          severity: "warning",
          message: `Catalog entry '${id || entryPath}' has unknown surface '${surface}'.`,
          path: source || null,
          suggestedFix: "Use known surface ids: web, api, database, native."
        }));
      }
    }
    if (Object.prototype.hasOwnProperty.call(entry, "generators") && !Array.isArray(entry.generators)) {
      diagnostics.push(catalogDiagnostic({
        code: "catalog_optional_generators_invalid",
        severity: "warning",
        message: `Catalog entry '${id || entryPath}' generators should be an array of generator ids.`,
        path: source || null,
        suggestedFix: "Use package-backed generator ids such as [\"@topogram/generator-sveltekit-web\", \"@topogram/generator-hono-api\"]."
      }));
    }
    if (Object.prototype.hasOwnProperty.call(entry, "stack") && typeof entry.stack !== "string") {
      diagnostics.push(catalogDiagnostic({
        code: "catalog_optional_stack_invalid",
        severity: "warning",
        message: `Catalog entry '${id || entryPath}' stack should be a string.`,
        path: source || null,
        suggestedFix: "Use a short stack label such as \"SvelteKit + Hono + Postgres\"."
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
      ...(surfaces.length > 0 ? { surfaces } : {}),
      ...(generators.length > 0 ? { generators } : {}),
      ...(stack ? { stack } : {}),
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
    throw new Error(formatGithubCatalogError(source, result));
  }
  return Buffer.from(result.stdout.replace(/\s+/g, ""), "base64").toString("utf8");
}

/**
 * @param {string} source
 * @param {any} result
 * @returns {string}
 */
function formatGithubCatalogError(source, result) {
  const output = [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n").trim();
  const normalized = output.toLowerCase();
  if (result.error?.code === "ENOENT") {
    return [
      `GitHub CLI (gh) is required to read catalog '${source}'.`,
      "Install gh, or set TOPOGRAM_CATALOG_SOURCE to a local topograms.catalog.json file."
    ].join("\n");
  }
  if (/\b(401|403)\b/.test(normalized) || normalized.includes("authentication") || normalized.includes("not logged in") || normalized.includes("forbidden")) {
    return [
      `Authentication is required to read private catalog '${source}'.`,
      "Set GITHUB_TOKEN or GH_TOKEN with repository read access, or run gh auth login.",
      output
    ].filter(Boolean).join("\n");
  }
  if (/\b404\b/.test(normalized) || normalized.includes("not found")) {
    return [
      `Catalog source '${source}' was not found, or the current token does not have repository access.`,
      "Check the github:owner/repo/path source and grant repository read access to the token or GitHub Actions workflow.",
      output
    ].filter(Boolean).join("\n");
  }
  return [
    `Failed to read catalog '${source}' with gh api.`,
    "Set GITHUB_TOKEN or GH_TOKEN, or run gh auth login.",
    output || "unknown error"
  ].join("\n");
}

/**
 * @param {string} source
 * @returns {string}
 */
function readUrlText(source) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  const tokenEnv = token && githubTokenAllowedForCatalogUrl(source)
    ? { TOPOGRAM_FETCH_TOKEN: token }
    : {};
  const result = childProcess.spawnSync(process.execPath, ["--input-type=module", "-e", FETCH_URL_SCRIPT, source], {
    encoding: "utf8",
    env: {
      ...process.env,
      ...tokenEnv,
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
 * @param {string} source
 * @returns {boolean}
 */
function githubTokenAllowedForCatalogUrl(source) {
  try {
    const hostname = new URL(source).hostname.toLowerCase();
    return GITHUB_TOKEN_HOSTS.has(hostname) || hostname.endsWith(".github.com");
  } catch {
    return false;
  }
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
 * @returns {{ id: string, version: string, source: "catalog", name: string, package: string, defaultVersion: string, description: string, tags: string[], surfaces?: string[], generators?: string[], stack?: string, includesExecutableImplementation: boolean, trust: CatalogTrust }}
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
    ...(entry.surfaces ? { surfaces: entry.surfaces } : {}),
    ...(entry.generators ? { generators: entry.generators } : {}),
    ...(entry.stack ? { stack: entry.stack } : {}),
    includesExecutableImplementation: entry.trust.includesExecutableImplementation,
    trust: entry.trust
  };
}

/**
 * @param {CatalogEntry} entry
 * @param {string} targetPath
 * @param {{ version?: string|null, catalogSource?: string|null }} [options]
 * @returns {{ ok: boolean, id: string, kind: "topogram", packageSpec: string, targetPath: string, provenancePath: string, files: string[] }}
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
  const provenance = writeTopogramSourceRecord(resolvedTarget, {
    catalogSource: options.catalogSource || null,
    entry,
    packageSpec,
    version: options.version || entry.defaultVersion
  });
  return {
    ok: true,
    id: entry.id,
    kind: "topogram",
    packageSpec,
    targetPath: resolvedTarget,
    provenancePath: provenance.path,
    files: files.sort((a, b) => a.localeCompare(b))
  };
}

/**
 * @param {string} projectRoot
 * @param {{ catalogSource: string|null, entry: CatalogEntry, packageSpec: string, version: string }} input
 * @returns {{ path: string, record: Record<string, any> }}
 */
function writeTopogramSourceRecord(projectRoot, input) {
  const record = {
    version: "0.1",
    kind: "topogram",
    copiedAt: new Date().toISOString(),
    catalog: {
      id: input.entry.id,
      source: input.catalogSource
    },
    package: {
      name: input.entry.package,
      version: input.version,
      spec: input.packageSpec
    },
    trust: {
      includesExecutableImplementation: false
    },
    files: collectSourceFileRecords(projectRoot)
  };
  const sourcePath = path.join(projectRoot, TOPOGRAM_SOURCE_FILE);
  fs.writeFileSync(sourcePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return { path: sourcePath, record };
}

/**
 * @param {string} projectRoot
 * @returns {{ ok: true, exists: boolean, path: string, status: "missing"|"clean"|"changed", source: Record<string, any>|null, content: { changed: string[], added: string[], removed: string[] }, diagnostics: any[], errors: [] }}
 */
export function buildTopogramSourceStatus(projectRoot) {
  const resolvedRoot = path.resolve(projectRoot);
  const sourcePath = path.join(resolvedRoot, TOPOGRAM_SOURCE_FILE);
  if (!fs.existsSync(sourcePath)) {
    return {
      ok: true,
      exists: false,
      path: sourcePath,
      status: "missing",
      source: null,
      content: { changed: [], added: [], removed: [] },
      diagnostics: [{
        code: "topogram_source_missing",
        severity: "warning",
        message: `${TOPOGRAM_SOURCE_FILE} was not found. This project may not have been copied from a catalog topogram entry.`,
        path: sourcePath,
        suggestedFix: "Run `topogram catalog copy <id> <target>` to create a project with source provenance."
      }],
      errors: []
    };
  }
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const trustedFiles = Array.isArray(source.files) ? source.files : [];
  const trustedByPath = new Map(trustedFiles.map((file) => [String(file.path), file]));
  const currentByPath = new Map(collectSourceFileRecords(resolvedRoot).map((file) => [file.path, file]));
  /** @type {string[]} */
  const changed = [];
  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
  const removed = [];
  for (const [filePath, current] of currentByPath) {
    const trusted = trustedByPath.get(filePath);
    if (!trusted) {
      added.push(filePath);
    } else if (trusted.sha256 !== current.sha256 || trusted.size !== current.size) {
      changed.push(filePath);
    }
  }
  for (const filePath of trustedByPath.keys()) {
    if (!currentByPath.has(filePath)) {
      removed.push(filePath);
    }
  }
  const content = {
    changed: changed.sort((a, b) => a.localeCompare(b)),
    added: added.sort((a, b) => a.localeCompare(b)),
    removed: removed.sort((a, b) => a.localeCompare(b))
  };
  return {
    ok: true,
    exists: true,
    path: sourcePath,
    status: content.changed.length || content.added.length || content.removed.length ? "changed" : "clean",
    source,
    content,
    diagnostics: [],
    errors: []
  };
}

/**
 * @param {string} projectRoot
 * @returns {Array<{ path: string, sha256: string, size: number }>}
 */
function collectSourceFileRecords(projectRoot) {
  /** @type {string[]} */
  const files = [];
  for (const sourceRoot of ["topogram", "topogram.project.json", "README.md"]) {
    const sourcePath = path.join(projectRoot, sourceRoot);
    if (fs.existsSync(sourcePath)) {
      collectFiles(sourcePath, sourceRoot, files);
    }
  }
  return files
    .sort((a, b) => a.localeCompare(b))
    .map((relativePath) => ({
      path: relativePath,
      ...fileHash(path.join(projectRoot, relativePath))
    }));
}

/**
 * @param {string} filePath
 * @returns {{ sha256: string, size: number }}
 */
function fileHash(filePath) {
  const bytes = fs.readFileSync(filePath);
  return {
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length
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

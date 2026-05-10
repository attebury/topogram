// @ts-check

import { CATALOG_FILE_NAME, KNOWN_CATALOG_SURFACES } from "./constants.js";
import { catalogDiagnostic } from "./diagnostics.js";

/**
 * @param {unknown} value
 * @param {string} source
 * @returns {{ ok: boolean, catalog: any|null, diagnostics: any[], errors: string[] }}
 */
export function validateCatalog(value, source = "") {
  /** @type {any[]} */
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

  /** @type {any[]} */
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
 * @param {any|null} catalog
 * @param {any[]} diagnostics
 * @returns {{ ok: boolean, catalog: any|null, diagnostics: any[], errors: string[] }}
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
 * @returns {{ scope: string, includesExecutableImplementation: boolean, notes?: string }|null}
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
 * @param {string} value
 * @returns {boolean}
 */
function isPackageName(value) {
  return /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(value);
}

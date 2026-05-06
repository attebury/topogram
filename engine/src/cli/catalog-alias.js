// @ts-check

import path from "node:path";

import {
  catalogEntryPackageSpec,
  catalogSourceOrDefault,
  findCatalogEntry,
  isCatalogSourceDisabled,
  loadCatalog
} from "../catalog.js";

/**
 * @param {unknown} error
 * @returns {string}
 */
function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {string} templateName
 * @param {string|null} [source]
 * @returns {{ templateName: string, provenance: { id: string, source: string, package: string, version: string, packageSpec: string, includesExecutableImplementation: boolean }|null }}
 */
export function resolveCatalogTemplateAlias(templateName, source = null) {
  if (!isCatalogAliasCandidate(templateName)) {
    return { templateName, provenance: null };
  }
  const catalogSource = catalogSourceOrDefault(source);
  if (isCatalogSourceDisabled(catalogSource)) {
    throw new Error(formatCatalogTemplateAliasError(templateName, catalogSource, null));
  }
  try {
    const loaded = loadCatalog(catalogSource);
    const entry = findCatalogEntry(loaded.catalog, templateName, "template");
    if (!entry) {
      throw new Error(formatCatalogTemplateAliasError(templateName, loaded.source, null, {
        suggestions: suggestCatalogTemplateIds(loaded.catalog, templateName)
      }));
    }
    const packageSpec = catalogEntryPackageSpec(entry);
    return {
      templateName: packageSpec,
      provenance: {
        id: entry.id,
        source: loaded.source,
        package: entry.package,
        version: entry.defaultVersion,
        packageSpec,
        includesExecutableImplementation: Boolean(entry.trust?.includesExecutableImplementation)
      }
    };
  } catch (error) {
    const message = messageFromError(error);
    if (message.startsWith(`Catalog template alias '${templateName}'`)) {
      throw error;
    }
    throw new Error(formatCatalogTemplateAliasError(templateName, catalogSource, error));
  }
}

/**
 * @param {string} templateName
 * @returns {boolean}
 */
export function isCatalogAliasCandidate(templateName) {
  return Boolean(templateName) &&
    !templateName.startsWith("@") &&
    !templateName.startsWith("./") &&
    !templateName.startsWith("../") &&
    !path.isAbsolute(templateName) &&
    !templateName.includes("/") &&
    !templateName.endsWith(".tgz");
}

/**
 * @param {string} templateName
 * @param {string|null} catalogSource
 * @param {unknown} error
 * @param {{ suggestions?: string[] }} [options]
 * @returns {string}
 */
export function formatCatalogTemplateAliasError(templateName, catalogSource, error, options = {}) {
  const sourceLabel = catalogSource || "disabled catalog";
  const catalogDisabled = isCatalogSourceDisabled(catalogSource);
  const suggestions = Array.isArray(options.suggestions) ? options.suggestions.filter(Boolean).slice(0, 3) : [];
  const reason = error
    ? messageFromError(error)
    : catalogDisabled
      ? "Catalog access is disabled, so catalog template aliases cannot be resolved."
      : `No template entry named '${templateName}' was found in the catalog.`;
  return [
    `Catalog template alias '${templateName}' could not be resolved from '${sourceLabel}'.`,
    reason,
    templateName === "hello-web" ? "The default starter 'hello-web' is catalog-backed. Enable catalog access, or pass --template with a local path or full package spec." : null,
    suggestions.length > 0 ? `Suggested templates: ${suggestions.join(", ")}.` : null,
    catalogDisabled ? "Unset TOPOGRAM_CATALOG_SOURCE=none, pass --catalog <source>, or use an explicit local path/package spec." : null,
    "Run `topogram template list` to see available templates, or `topogram catalog show <id>` to inspect a catalog alias.",
    catalogDisabled ? null : "The default catalog is public. For private catalogs, set GITHUB_TOKEN or GH_TOKEN with repository read access, or run `gh auth login`.",
    "For private template packages, configure registry-specific npm auth before installing.",
    "Use a catalog alias such as hello-web/web-api/web-api-db, a local path, or a full package spec such as @topogram/template-todo@0.1.6."
  ].filter(Boolean).join("\n");
}

/**
 * @param {{ entries: Array<Record<string, any>> }} catalog
 * @param {string} templateName
 * @returns {string[]}
 */
function suggestCatalogTemplateIds(catalog, templateName) {
  const queryTokens = tokenizeSuggestionText(templateName);
  const templates = (catalog.entries || []).filter((entry) => entry.kind === "template");
  return templates
    .map((entry, index) => ({
      id: String(entry.id || ""),
      index,
      score: catalogTemplateSuggestionScore(entry, queryTokens)
    }))
    .filter((item) => item.id && item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 3)
    .map((item) => item.id);
}

/**
 * @param {Record<string, any>} entry
 * @param {string[]} queryTokens
 * @returns {number}
 */
function catalogTemplateSuggestionScore(entry, queryTokens) {
  const id = String(entry.id || "");
  if (queryTokens.length === 0) {
    return id === "hello-web" ? 10 : 1;
  }
  const haystack = tokenizeSuggestionText([
    entry.id,
    entry.description,
    entry.stack,
    ...(Array.isArray(entry.tags) ? entry.tags : []),
    ...(Array.isArray(entry.surfaces) ? entry.surfaces : []),
    ...(Array.isArray(entry.generators) ? entry.generators : [])
  ].filter(Boolean).join(" "));
  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      score += 10;
    } else if (haystack.some((candidate) => candidate.includes(token) || token.includes(candidate))) {
      score += 3;
    }
  }
  if (id === "hello-web") {
    score += 1;
  }
  return score;
}

/**
 * @param {string} value
 * @returns {string[]}
 */
function tokenizeSuggestionText(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

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
 * @returns {{ templateName: string, provenance: { id: string, source: string, package: string, version: string, packageSpec: string }|null }}
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
      throw new Error(formatCatalogTemplateAliasError(templateName, loaded.source, null));
    }
    const packageSpec = catalogEntryPackageSpec(entry);
    return {
      templateName: packageSpec,
      provenance: {
        id: entry.id,
        source: loaded.source,
        package: entry.package,
        version: entry.defaultVersion,
        packageSpec
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
 * @returns {string}
 */
export function formatCatalogTemplateAliasError(templateName, catalogSource, error) {
  const sourceLabel = catalogSource || "disabled catalog";
  const catalogDisabled = isCatalogSourceDisabled(catalogSource);
  const reason = error
    ? messageFromError(error)
    : catalogDisabled
      ? "Catalog access is disabled, so catalog template aliases cannot be resolved."
      : `No template entry named '${templateName}' was found in the catalog.`;
  return [
    `Catalog template alias '${templateName}' could not be resolved from '${sourceLabel}'.`,
    reason,
    templateName === "hello-web" ? "The default starter 'hello-web' is catalog-backed. Enable catalog access, or pass --template with a local path or full package spec." : null,
    catalogDisabled ? "Unset TOPOGRAM_CATALOG_SOURCE=none, pass --catalog <source>, or use an explicit local path/package spec." : null,
    "Run `topogram template list` to see available templates, or `topogram catalog show <id>` to inspect a catalog alias.",
    catalogDisabled ? null : "For the private default catalog, set GITHUB_TOKEN or GH_TOKEN with repository read access, or run `gh auth login`.",
    "For private template packages, configure .npmrc for https://npm.pkg.github.com and run with NODE_AUTH_TOKEN when npm needs package read access.",
    "Use a catalog alias such as hello-web/web-api/web-api-db, a local path, or a full package spec such as @attebury/topogram-template-todo@0.1.6."
  ].filter(Boolean).join("\n");
}

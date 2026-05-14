// @ts-check

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  catalogEntryPackageSpec,
  copyCatalogTopogramEntry,
  findCatalogEntry,
  loadCatalog,
  TOPOGRAM_SOURCE_FILE
} from "../../catalog.js";
import { GENERATOR_POLICY_FILE } from "../../generator-policy.js";
import { createNewProject } from "../../new-project.js";
import { copyPath, ensureEmptyDirectory } from "../../catalog/files.js";
import { writeTopogramSourceRecord } from "../../catalog/provenance.js";
import { DEFAULT_TOPO_FOLDER_NAME, DEFAULT_WORKSPACE_PATH, resolvePackageWorkspace } from "../../workspace-paths.js";
import { formatCatalogTemplateAliasError, suggestCatalogTemplateIds } from "../catalog-alias.js";
import {
  buildCatalogListPayload,
  printCatalogList
} from "./catalog/list.js";
import { shellCommandArg } from "./catalog/shared.js";
import { stableStringify } from "../../format.js";

const ENGINE_ROOT = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const TEMPLATES_ROOT = path.join(ENGINE_ROOT, "templates");

/**
 * @param {string} source
 * @returns {boolean}
 */
function isCatalogIdCandidate(source) {
  return Boolean(source) &&
    !source.startsWith("@") &&
    !source.startsWith("./") &&
    !source.startsWith("../") &&
    !path.isAbsolute(source) &&
    !source.includes("/") &&
    !source.endsWith(".tgz");
}

/**
 * @param {ReturnType<typeof createNewProject>} result
 * @param {string} cwd
 * @returns {string}
 */
function displayProjectRootForCopy(result, cwd) {
  const relativeProjectRoot = path.relative(cwd, result.projectRoot);
  return !relativeProjectRoot || relativeProjectRoot.startsWith("..")
    ? result.projectRoot
    : relativeProjectRoot;
}

/**
 * @param {string} targetPath
 * @returns {void}
 */
function assertProjectTargetOutsideEngine(targetPath) {
  const projectRoot = path.resolve(targetPath);
  const relativeToEngine = path.relative(ENGINE_ROOT, projectRoot);
  if (relativeToEngine === "" || (!relativeToEngine.startsWith("..") && !path.isAbsolute(relativeToEngine))) {
    throw new Error(
      `Refusing to copy a project inside the engine directory. Use a path outside engine, for example '../${path.basename(projectRoot)}'.`
    );
  }
}

/**
 * @param {string} source
 * @param {string} targetPath
 * @param {{ catalogSource?: string|null, version?: string|null }} options
 * @returns {{ ok: boolean, action: "copy_topogram", source: string, id: string, kind: "topogram", packageSpec: string, targetPath: string, provenancePath: string, files: string[], diagnostics: any[], errors: string[] }|null}
 */
function tryCopyCatalogTopogram(source, targetPath, options) {
  if (!isCatalogIdCandidate(source)) {
    return null;
  }
  const loaded = loadCatalog(options.catalogSource || null);
  const entry = findCatalogEntry(loaded.catalog, source, "topogram");
  if (!entry) {
    return null;
  }
  const copied = copyCatalogTopogramEntry(entry, targetPath, {
    catalogSource: loaded.source,
    version: options.version || null
  });
  return {
    action: "copy_topogram",
    source: loaded.source,
    ...copied,
    diagnostics: [],
    errors: []
  };
}

/**
 * @param {string} source
 * @param {string} targetPath
 * @param {{ catalogSource?: string|null, version?: string|null }} options
 * @returns {{ templateName: string, provenance: any|null }}
 */
function resolveCopyTemplateSource(source, targetPath, options) {
  void targetPath;
  if (!isCatalogIdCandidate(source)) {
    return { templateName: source, provenance: null };
  }
  const loaded = loadCatalog(options.catalogSource || null);
  const entry = findCatalogEntry(loaded.catalog, source, "template");
  if (!entry) {
    throw new Error(formatCatalogTemplateAliasError(source, loaded.source, null, {
      suggestions: suggestCatalogTemplateIds(loaded.catalog, source)
    }));
  }
  const packageSpec = catalogEntryPackageSpec(entry, options.version || null);
  return {
    templateName: packageSpec,
    provenance: {
      id: entry.id,
      source: loaded.source,
      package: entry.package,
      version: options.version || entry.defaultVersion,
      packageSpec,
      includesExecutableImplementation: Boolean(entry.trust?.includesExecutableImplementation)
    }
  };
}

/**
 * @param {string} sourcePath
 * @param {string} targetPath
 * @returns {{ ok: boolean, action: "copy_topogram", source: string, id: string, kind: "topogram", packageSpec: string, targetPath: string, provenancePath: string, files: string[], diagnostics: any[], errors: string[] }}
 */
function copyLocalTopogramSource(sourcePath, targetPath) {
  const packageRoot = path.resolve(sourcePath);
  if (!fs.existsSync(packageRoot) || !fs.statSync(packageRoot).isDirectory()) {
    throw new Error(`Copy source '${sourcePath}' was not found.`);
  }
  if (fs.existsSync(path.join(packageRoot, "implementation"))) {
    throw new Error(`Topogram source '${sourcePath}' contains implementation/, which is not allowed for pure topogram copy.`);
  }
  const packageWorkspace = resolvePackageWorkspace(packageRoot);
  const resolvedTarget = path.resolve(targetPath);
  ensureEmptyDirectory(resolvedTarget);
  /** @type {string[]} */
  const files = [];
  copyPath(packageWorkspace.root, path.join(resolvedTarget, DEFAULT_TOPO_FOLDER_NAME), DEFAULT_TOPO_FOLDER_NAME, files);
  for (const fileName of ["topogram.project.json", "README.md"]) {
    const sourceFile = path.join(packageRoot, fileName);
    if (!fs.existsSync(sourceFile) || !fs.statSync(sourceFile).isFile()) {
      continue;
    }
    if (fileName === "topogram.project.json") {
      const projectConfig = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
      projectConfig.workspace = DEFAULT_WORKSPACE_PATH;
      fs.writeFileSync(path.join(resolvedTarget, fileName), `${JSON.stringify(projectConfig, null, 2)}\n`, "utf8");
      files.push(fileName);
    } else {
      copyPath(sourceFile, path.join(resolvedTarget, fileName), fileName, files);
    }
  }
  const sourceId = path.basename(packageRoot);
  const provenance = writeTopogramSourceRecord(resolvedTarget, {
    catalogSource: null,
    entry: {
      id: sourceId,
      package: sourcePath,
      defaultVersion: "local"
    },
    packageSpec: sourcePath,
    version: "local"
  });
  return {
    ok: true,
    action: "copy_topogram",
    source: sourcePath,
    id: sourceId,
    kind: "topogram",
    packageSpec: sourcePath,
    targetPath: resolvedTarget,
    provenancePath: provenance.path,
    files: files.sort((a, b) => a.localeCompare(b)),
    diagnostics: [],
    errors: []
  };
}

/**
 * @param {ReturnType<typeof createNewProject>} result
 * @returns {Record<string, any>}
 */
function templateCopyPayload(result) {
  return {
    ok: true,
    action: "copy_template",
    kind: "template",
    projectRoot: result.projectRoot,
    templateName: result.templateName,
    template: result.template,
    topogramPath: result.topogramPath,
    appPath: result.appPath,
    warnings: result.warnings,
    diagnostics: [],
    errors: []
  };
}

/**
 * @param {ReturnType<typeof createNewProject>} result
 * @param {string} cwd
 * @returns {void}
 */
export function printTemplateCopyResult(result, cwd) {
  const template = result.template || {};
  console.log(`Copied Topogram template to ${result.projectRoot}.`);
  console.log(`Template: ${result.templateName}`);
  console.log(`Source: ${template.source || "unknown"}`);
  if (template.sourceSpec) {
    console.log(`Source spec: ${template.sourceSpec}`);
  }
  if (template.catalog) {
    console.log(`Catalog: ${template.catalog.id} from ${template.catalog.source}`);
    console.log(`Package: ${template.catalog.packageSpec}`);
  }
  console.log(`Executable implementation: ${template.includesExecutableImplementation ? "yes" : "no"}`);
  console.log("Policy: topogram.template-policy.json");
  console.log(`Generator policy: ${GENERATOR_POLICY_FILE}`);
  console.log("Template files: .topogram-template-files.json");
  if (template.includesExecutableImplementation) {
    console.log("Trust: .topogram-template-trust.json");
  }
  for (const warning of result.warnings) {
    console.warn(`Warning: ${warning}`);
  }
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${displayProjectRootForCopy(result, cwd)}`);
  console.log("  npm install");
  console.log("  npm run agent:brief");
  console.log("  npm run doctor");
  console.log("  npm run source:status");
  console.log("  npm run template:explain");
  console.log("  npm run check");
  console.log("  npm run generator:policy:status");
  console.log("  npm run generator:policy:check");
  if (template.includesExecutableImplementation) {
    console.log("  npm run template:policy:explain");
    console.log("  npm run trust:status");
  }
  console.log("  npm run generate");
  console.log("  npm run verify");
}

/**
 * @param {any} payload
 * @returns {void}
 */
export function printTopogramCopy(payload) {
  console.log(`Copied topogram '${payload.id}' to ${payload.targetPath}.`);
  console.log(`Package: ${payload.packageSpec}`);
  console.log(`Source provenance: ${payload.provenancePath}`);
  console.log(`Files: ${payload.files.length}`);
  console.log(`${TOPOGRAM_SOURCE_FILE} records copy provenance only. Local edits are allowed.`);
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${shellCommandArg(path.relative(process.cwd(), payload.targetPath) || ".")}`);
  console.log("  topogram source status --local");
  console.log("  topogram check");
  console.log("  topogram generate");
}

/**
 * @param {{ commandArgs: Record<string, any>, catalogSource?: string|null, requestedVersion?: string|null, json?: boolean, cwd?: string }} context
 * @returns {number}
 */
export function runCopyCommand(context) {
  const {
    commandArgs,
    catalogSource = null,
    requestedVersion = null,
    json = false,
    cwd = process.cwd()
  } = context;

  if (commandArgs.copyCommand === "list") {
    const payload = buildCatalogListPayload(catalogSource || null);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printCatalogList(payload);
    }
    return 0;
  }

  const source = commandArgs.copySource;
  const targetPath = commandArgs.inputPath;
  if (!source || String(source).startsWith("-")) {
    throw new Error("topogram copy requires <source>.");
  }
  if (!targetPath || String(targetPath).startsWith("-")) {
    throw new Error("topogram copy requires <target>.");
  }
  assertProjectTargetOutsideEngine(targetPath);

  let catalogTopogram;
  try {
    catalogTopogram = tryCopyCatalogTopogram(source, targetPath, {
      catalogSource,
      version: requestedVersion
    });
  } catch (error) {
    if (isCatalogIdCandidate(source)) {
      throw new Error(formatCatalogTemplateAliasError(source, catalogSource || null, error));
    }
    throw error;
  }
  if (catalogTopogram) {
    if (json) {
      console.log(stableStringify(catalogTopogram));
    } else {
      printTopogramCopy(catalogTopogram);
    }
    return catalogTopogram.ok ? 0 : 1;
  }

  if (source === "." || source.startsWith("./") || source.startsWith("../") || path.isAbsolute(source)) {
    const localRoot = path.resolve(source);
    if (fs.existsSync(path.join(localRoot, DEFAULT_TOPO_FOLDER_NAME)) && !fs.existsSync(path.join(localRoot, "topogram-template.json"))) {
      const payload = copyLocalTopogramSource(source, targetPath);
      if (json) {
        console.log(stableStringify(payload));
      } else {
        printTopogramCopy(payload);
      }
      return payload.ok ? 0 : 1;
    }
  }

  const resolvedTemplate = resolveCopyTemplateSource(source, targetPath, {
    catalogSource,
    version: requestedVersion
  });
  const result = createNewProject({
    targetPath,
    templateName: resolvedTemplate.templateName,
    templateProvenance: resolvedTemplate.provenance,
    engineRoot: ENGINE_ROOT,
    templatesRoot: TEMPLATES_ROOT
  });
  if (json) {
    console.log(stableStringify(templateCopyPayload(result)));
  } else {
    printTemplateCopyResult(result, cwd);
  }
  return 0;
}

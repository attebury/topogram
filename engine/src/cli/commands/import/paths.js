// @ts-check

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../../../format.js";
import { TOPOGRAM_IMPORT_FILE } from "../../../import/provenance.js";
import { shellCommandArg } from "../catalog.js";

export const TOPOGRAM_IMPORT_ADOPTIONS_FILE = ".topogram-import-adoptions.jsonl";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {string} inputPath
 * @returns {string}
 */
export function normalizeTopogramPath(inputPath) {
  const absolute = path.resolve(inputPath);
  if (path.basename(absolute) === "topogram") {
    return absolute;
  }
  const candidate = path.join(absolute, "topogram");
  return fs.existsSync(candidate) ? candidate : absolute;
}

/**
 * @param {string} inputPath
 * @returns {string}
 */
export function normalizeProjectRoot(inputPath) {
  const absolute = path.resolve(inputPath);
  if (path.basename(absolute) === "topogram") {
    return path.dirname(absolute);
  }
  return absolute;
}

/**
 * @param  {...{ ok: boolean, errors?: any[] }|null|undefined} results
 * @returns {{ ok: boolean, errors: any[] }}
 */
export function combineProjectValidationResults(...results) {
  const errors = [];
  for (const result of results) {
    errors.push(...(result?.errors || []));
  }
  return {
    ok: errors.length === 0,
    errors
  };
}

/**
 * @param {AnyRecord} component
 * @returns {{ uses_api: string|null, uses_database: string|null }}
 */
export function topologyComponentReferences(component) {
  return {
    uses_api: component.uses_api || null,
    uses_database: component.uses_database || null
  };
}

/**
 * @param {AnyRecord} component
 * @returns {any}
 */
export function topologyComponentPort(component) {
  return Object.prototype.hasOwnProperty.call(component, "port") ? component.port : null;
}

/**
 * @param {AnyRecord|null|undefined} config
 * @returns {{ outputs: any[], runtimes: any[], edges: any[] }}
 */
export function summarizeProjectTopology(config) {
  const outputs = Object.entries(config?.outputs || {})
    .map(([name, output]) => ({
      name,
      path: output?.path || null,
      ownership: output?.ownership || null
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const runtimes = (config?.topology?.runtimes || [])
    .map((/** @type {AnyRecord} */ component) => ({
      id: component.id,
      kind: component.kind,
      projection: component.projection,
      generator: {
        id: component.generator?.id || null,
        version: component.generator?.version || null
      },
      port: topologyComponentPort(component),
      references: topologyComponentReferences(component)
    }))
    .sort((/** @type {AnyRecord} */ left, /** @type {AnyRecord} */ right) => left.id.localeCompare(right.id));
  const edges = runtimes.flatMap((/** @type {AnyRecord} */ component) => {
    const references = [];
    if (component.references.uses_api) {
      references.push({
        from: component.id,
        to: component.references.uses_api,
        type: "calls_api"
      });
    }
    if (component.references.uses_database) {
      references.push({
        from: component.id,
        to: component.references.uses_database,
        type: "uses_database"
      });
    }
    return references;
  }).sort((/** @type {AnyRecord} */ left, /** @type {AnyRecord} */ right) => `${left.from}:${left.type}:${left.to}`.localeCompare(`${right.from}:${right.type}:${right.to}`));
  return {
    outputs,
    runtimes,
    edges
  };
}

/**
 * @param {AnyRecord|null|undefined} topology
 * @returns {AnyRecord|null}
 */
export function publicProjectTopology(topology) {
  if (!topology || typeof topology !== "object") {
    return topology || null;
  }
  return {
    ...Object.fromEntries(Object.entries(topology).filter(([key]) => key !== "components")),
    runtimes: topology.runtimes || []
  };
}

/**
 * @param {{ inputPath: string, ast: AnyRecord, resolved: AnyRecord, projectConfigInfo: AnyRecord|null, projectValidation: { ok: boolean, errors: any[] } }} input
 * @returns {AnyRecord}
 */
export function checkSummaryPayload({ inputPath, ast, resolved, projectConfigInfo, projectValidation }) {
  const statementCount = ast.files.flatMap((/** @type {{ statements: any[] }} */ file) => file.statements).length;
  const projectInfo = projectConfigInfo || {
    configPath: null,
    compatibility: false,
    config: { topology: null }
  };
  const resolvedTopology = summarizeProjectTopology(projectInfo.config);
  return {
    ok: resolved.ok && projectValidation.ok,
    inputPath,
    topogram: {
      files: ast.files.length,
      statements: statementCount,
      valid: resolved.ok
    },
    project: {
      configPath: projectInfo.configPath,
      compatibility: Boolean(projectInfo.compatibility),
      valid: projectValidation.ok,
      topology: publicProjectTopology(projectInfo.config.topology),
      resolvedTopology
    },
    errors: [
      ...(resolved.ok ? [] : resolved.validation.errors.map((/** @type {AnyRecord} */ error) => ({
        source: "topogram",
        message: error.message,
        loc: error.loc
      }))),
      ...projectValidation.errors.map((error) => ({
        source: "project",
        message: error.message,
        loc: error.loc
      }))
    ]
  };
}

/**
 * @param {string} filePath
 * @returns {{ sha256: string, size: number }}
 */
export function projectFileHash(filePath) {
  const bytes = fs.readFileSync(filePath);
  return {
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length
  };
}

/**
 * @param {string} filePath
 * @returns {AnyRecord|null}
 */
export function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * @param {string} projectRoot
 * @returns {string}
 */
export function importAdoptionsPath(projectRoot) {
  return path.join(normalizeProjectRoot(projectRoot), TOPOGRAM_IMPORT_ADOPTIONS_FILE);
}

/**
 * @param {string} projectRoot
 * @returns {AnyRecord[]}
 */
export function readImportAdoptionReceipts(projectRoot) {
  const historyPath = importAdoptionsPath(projectRoot);
  if (!fs.existsSync(historyPath)) {
    return [];
  }
  return fs.readFileSync(historyPath, "utf8")
    .split(/\r?\n/)
    .map((/** @type {string} */ line) => line.trim())
    .filter(Boolean)
    .map((/** @type {string} */ line, /** @type {number} */ index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid import adoption receipt JSON at ${historyPath}:${index + 1}.`);
      }
    });
}

/**
 * @param {string} projectRoot
 * @param {AnyRecord} receipt
 * @returns {string}
 */
export function appendImportAdoptionReceipt(projectRoot, receipt) {
  const historyPath = importAdoptionsPath(projectRoot);
  fs.appendFileSync(historyPath, `${JSON.stringify(receipt)}\n`, "utf8");
  return historyPath;
}

/**
 * @param {AnyRecord[]} items
 * @param {string} fieldName
 * @returns {Record<string, number>}
 */
export function countByField(items, fieldName) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const item of items || []) {
    const key = item?.[fieldName] || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

/**
 * @param {string} projectRoot
 * @returns {string}
 */
export function importProjectCommandPath(projectRoot) {
  return shellCommandArg(path.relative(process.cwd(), projectRoot) || ".");
}

/**
 * @param {string} projectRoot
 * @param {string} selector
 * @param {boolean} [write]
 * @returns {string}
 */
export function importAdoptCommand(projectRoot, selector, write = false) {
  return `topogram import adopt ${selector} ${importProjectCommandPath(projectRoot)} ${write ? "--write" : "--dry-run"}`;
}

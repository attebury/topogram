// @ts-check

import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

export const TEMPLATE_TRUST_FILE = ".topogram-template-trust.json";
export const TEMPLATE_TRUST_POLICY = "topogram-template-executable-implementation-v1";

/**
 * @typedef {Object} TemplateTrustRecord
 * @property {string} version
 * @property {string} trustPolicy
 * @property {string} trustedAt
 * @property {{ id: string|null, version: string|null, source: string|null, sourceSpec: string|null, requested: string|null, sourceRoot: string|null, catalog?: Record<string, any>|null }} template
 * @property {{ id: string|null, module: string, export: string }} implementation
 * @property {{ algorithm: "sha256", root: string, digest: string, files: Array<{ path: string, sha256: string, size: number }> }} content
 */

const IGNORED_IMPLEMENTATION_ENTRIES = new Set([".DS_Store", "node_modules", ".tmp"]);
const MAX_TEXT_DIFF_BYTES = 256 * 1024;

/**
 * @param {string} parent
 * @param {string} child
 * @returns {boolean}
 */
function isSameOrInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeRoot(value) {
  return String(value || "").replace(/\\/g, "/");
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeRelativePath(value) {
  return value.replace(/\\/g, "/");
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeDiffPath(value) {
  return value.replace(/\t/g, "\\t").replace(/\n/g, "\\n");
}

/**
 * @param {any} bytes
 * @returns {boolean}
 */
function isLikelyText(bytes) {
  if (bytes.includes(0)) {
    return false;
  }
  const length = Math.min(bytes.length, 4096);
  let suspicious = 0;
  for (let index = 0; index < length; index += 1) {
    const byte = bytes[index];
    if (byte === 9 || byte === 10 || byte === 13) {
      continue;
    }
    if (byte < 32 || byte === 127) {
      suspicious += 1;
    }
  }
  return length === 0 || suspicious / length < 0.02;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function linesForDiff(text) {
  const lines = text.split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }
  return lines;
}

/**
 * @param {string[]} before
 * @param {string[]} after
 * @returns {Array<{ type: "same"|"added"|"removed", text: string }>}
 */
function diffLines(before, after) {
  const rows = before.length;
  const columns = after.length;
  /** @type {number[][]} */
  const table = Array.from({ length: rows + 1 }, () => Array(columns + 1).fill(0));
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      table[row][column] = before[row] === after[column]
        ? table[row + 1][column + 1] + 1
        : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }
  /** @type {Array<{ type: "same"|"added"|"removed", text: string }>} */
  const changes = [];
  let row = 0;
  let column = 0;
  while (row < rows && column < columns) {
    if (before[row] === after[column]) {
      changes.push({ type: "same", text: before[row] });
      row += 1;
      column += 1;
    } else if (table[row + 1][column] >= table[row][column + 1]) {
      changes.push({ type: "removed", text: before[row] });
      row += 1;
    } else {
      changes.push({ type: "added", text: after[column] });
      column += 1;
    }
  }
  while (row < rows) {
    changes.push({ type: "removed", text: before[row] });
    row += 1;
  }
  while (column < columns) {
    changes.push({ type: "added", text: after[column] });
    column += 1;
  }
  return changes;
}

/**
 * @param {string} relativePath
 * @param {string|null} beforeText
 * @param {string|null} afterText
 * @returns {string|null}
 */
function unifiedTextDiff(relativePath, beforeText, afterText) {
  if (beforeText === null && afterText === null) {
    return null;
  }
  const beforeLines = beforeText === null ? [] : linesForDiff(beforeText);
  const afterLines = afterText === null ? [] : linesForDiff(afterText);
  const changes = diffLines(beforeLines, afterLines);
  const lines = [
    `--- a/implementation/${escapeDiffPath(relativePath)}`,
    `+++ b/implementation/${escapeDiffPath(relativePath)}`,
    `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`
  ];
  for (const change of changes) {
    const prefix = change.type === "added" ? "+" : change.type === "removed" ? "-" : " ";
    lines.push(`${prefix}${change.text}`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * @param {string} filePath
 * @returns {{ text: string|null, binary: boolean, omitted: boolean }}
 */
function readReviewText(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length > MAX_TEXT_DIFF_BYTES) {
    return { text: null, binary: false, omitted: true };
  }
  if (!isLikelyText(bytes)) {
    return { text: null, binary: true, omitted: false };
  }
  return { text: bytes.toString("utf8"), binary: false, omitted: false };
}

/**
 * @param {string} implementationRoot
 * @param {string} currentDir
 * @param {string[]} files
 * @returns {void}
 */
function collectImplementationFiles(implementationRoot, currentDir, files) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (IGNORED_IMPLEMENTATION_ENTRIES.has(entry.name)) {
      continue;
    }
    const entryPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectImplementationFiles(implementationRoot, entryPath, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(normalizeRelativePath(path.relative(implementationRoot, entryPath)));
    }
  }
}

/**
 * @param {string} configDir
 * @returns {{ algorithm: "sha256", root: string, digest: string, files: Array<{ path: string, sha256: string, size: number }> }}
 */
export function hashImplementationContent(configDir) {
  const implementationRoot = path.join(configDir, "implementation");
  if (!fs.existsSync(implementationRoot) || !fs.statSync(implementationRoot).isDirectory()) {
    throw new Error(`Cannot trust template implementation because ${normalizeRoot(implementationRoot)} does not exist.`);
  }
  /** @type {string[]} */
  const relativePaths = [];
  collectImplementationFiles(implementationRoot, implementationRoot, relativePaths);
  relativePaths.sort((a, b) => a.localeCompare(b));
  const files = relativePaths.map((relativePath) => {
    const filePath = path.join(implementationRoot, relativePath);
    const bytes = fs.readFileSync(filePath);
    return {
      path: relativePath,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      size: bytes.length
    };
  });
  const aggregate = crypto.createHash("sha256");
  for (const file of files) {
    aggregate.update(file.path);
    aggregate.update("\0");
    aggregate.update(file.sha256);
    aggregate.update("\0");
    aggregate.update(String(file.size));
    aggregate.update("\0");
  }
  return {
    algorithm: "sha256",
    root: "implementation",
    digest: aggregate.digest("hex"),
    files
  };
}

/**
 * @param {Record<string, any>} config
 * @returns {{ id: string|null, module: string, export: string }}
 */
export function implementationTrustFingerprint(config) {
  const implementationModule = config.implementation_module || config.module;
  if (!implementationModule || typeof implementationModule !== "string") {
    throw new Error("Topogram implementation config is missing implementation module.");
  }
  return {
    id: config.implementation_id || config.id || null,
    module: implementationModule,
    export: config.implementation_export || config.export || "default"
  };
}

/**
 * @param {{ config: Record<string, any>, configDir: string }} implementationInfo
 * @returns {boolean}
 */
export function implementationRequiresTrust(implementationInfo) {
  const fingerprint = implementationTrustFingerprint(implementationInfo.config);
  const modulePath = path.resolve(implementationInfo.configDir, fingerprint.module);
  const implementationRoot = path.resolve(implementationInfo.configDir, "implementation");
  return isSameOrInside(implementationRoot, modulePath);
}

/**
 * @param {string} configDir
 * @returns {TemplateTrustRecord|null}
 */
export function readTemplateTrustRecord(configDir) {
  const trustPath = path.join(configDir, TEMPLATE_TRUST_FILE);
  if (!fs.existsSync(trustPath)) {
    return null;
  }
  return /** @type {TemplateTrustRecord} */ (JSON.parse(fs.readFileSync(trustPath, "utf8")));
}

/**
 * @param {string} configDir
 * @param {Record<string, any>} projectConfig
 * @param {{ id: string|null, module: string, export: string }} implementation
 * @returns {TemplateTrustRecord}
 */
function buildTrustRecord(configDir, projectConfig, implementation) {
  const template = projectConfig.template || {};
  const content = hashImplementationContent(configDir);
  return {
    version: "1",
    trustPolicy: TEMPLATE_TRUST_POLICY,
    trustedAt: new Date().toISOString(),
    template: {
      id: typeof template.id === "string" ? template.id : null,
      version: typeof template.version === "string" ? template.version : null,
      source: typeof template.source === "string" ? template.source : null,
      sourceSpec: typeof template.sourceSpec === "string" ? template.sourceSpec : null,
      requested: typeof template.requested === "string" ? template.requested : null,
      sourceRoot: typeof template.sourceRoot === "string" ? template.sourceRoot : null,
      catalog: template.catalog && typeof template.catalog === "object" && !Array.isArray(template.catalog)
        ? template.catalog
        : null
    },
    implementation,
    content
  };
}

/**
 * @param {string} configDir
 * @param {Record<string, any>} projectConfig
 * @returns {TemplateTrustRecord}
 */
export function writeTemplateTrustRecord(configDir, projectConfig) {
  const implementationConfig = projectConfig.implementation;
  if (!implementationConfig) {
    throw new Error("Cannot trust template implementation because topogram.project.json has no implementation config.");
  }
  const implementation = implementationTrustFingerprint(implementationConfig);
  const record = buildTrustRecord(configDir, projectConfig, implementation);
  fs.writeFileSync(path.join(configDir, TEMPLATE_TRUST_FILE), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

/**
 * @param {{ config: Record<string, any>, configPath: string|null, configDir: string }} implementationInfo
 * @param {Record<string, any>|null} projectConfig
 * @returns {void}
 */
export function assertTrustedImplementation(implementationInfo, projectConfig = null) {
  const status = getTemplateTrustStatus(implementationInfo, projectConfig);
  if (!status.requiresTrust || status.ok) {
    return;
  }
  const firstIssue = status.issues[0] || "implementation trust is invalid";
  throw new Error(
    `${firstIssue}. Review implementation/ and run 'topogram trust template' to trust the current files.`
  );
}

/**
 * @param {Map<string, { path: string, sha256: string, size: number }>} trustedByPath
 * @param {Map<string, { path: string, sha256: string, size: number }>} currentByPath
 * @returns {{ added: string[], removed: string[], changed: string[] }}
 */
function diffContentFiles(trustedByPath, currentByPath) {
  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
  const removed = [];
  /** @type {string[]} */
  const changed = [];
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
  return {
    added: added.sort((a, b) => a.localeCompare(b)),
    removed: removed.sort((a, b) => a.localeCompare(b)),
    changed: changed.sort((a, b) => a.localeCompare(b))
  };
}

/**
 * @param {string} configDir
 * @param {string} relativePath
 * @param {{ path: string, sha256: string, size: number }|null} file
 * @returns {{ path: string, sha256: string|null, size: number|null, binary: boolean, diffOmitted: boolean, text: string|null }}
 */
function implementationReviewFile(configDir, relativePath, file) {
  if (!file) {
    return { path: relativePath, sha256: null, size: null, binary: false, diffOmitted: false, text: null };
  }
  const reviewText = readReviewText(path.join(configDir, "implementation", relativePath));
  return {
    path: relativePath,
    sha256: file.sha256,
    size: file.size,
    binary: reviewText.binary,
    diffOmitted: reviewText.omitted,
    text: reviewText.text
  };
}

/**
 * @param {{ config: Record<string, any>, configPath: string|null, configDir: string }} implementationInfo
 * @param {Record<string, any>|null} projectConfig
 * @returns {{ ok: boolean, requiresTrust: boolean, trustPath: string, trustRecord: TemplateTrustRecord|null, template: { id: string|null, version: string|null, source: string|null, sourceSpec: string|null, requested: string|null, sourceRoot: string|null, catalog?: Record<string, any>|null, includesExecutableImplementation: boolean|null }, implementation: { id: string|null, module: string|null, export: string|null }, content: { trustedDigest: string|null, currentDigest: string|null, added: string[], removed: string[], changed: string[] }, issues: string[] }}
 */
export function getTemplateTrustStatus(implementationInfo, projectConfig = null) {
  if (!implementationRequiresTrust(implementationInfo)) {
    return {
      ok: true,
      requiresTrust: false,
      trustPath: path.join(implementationInfo.configDir, TEMPLATE_TRUST_FILE),
      trustRecord: null,
      template: { id: null, version: null, source: null, sourceSpec: null, requested: null, sourceRoot: null, catalog: null, includesExecutableImplementation: null },
      implementation: { id: null, module: null, export: null },
      content: { trustedDigest: null, currentDigest: null, added: [], removed: [], changed: [] },
      issues: []
    };
  }
  const fingerprint = implementationTrustFingerprint(implementationInfo.config);
  const trustRecord = readTemplateTrustRecord(implementationInfo.configDir);
  const configLabel = implementationInfo.configPath || "topogram.project.json";
  const trustPath = path.join(implementationInfo.configDir, TEMPLATE_TRUST_FILE);
  const projectTemplate = projectConfig?.template || null;
  /** @type {string[]} */
  const issues = [];
  /** @type {{ trustedDigest: string|null, currentDigest: string|null, added: string[], removed: string[], changed: string[] }} */
  const contentStatus = { trustedDigest: null, currentDigest: null, added: [], removed: [], changed: [] };

  if (!trustRecord) {
    issues.push(
      `Refusing to load executable implementation '${fingerprint.module}' from ${normalizeRoot(configLabel)} without ${TEMPLATE_TRUST_FILE}`
    );
  } else {
    if (trustRecord.trustPolicy !== TEMPLATE_TRUST_POLICY) {
      issues.push(`${TEMPLATE_TRUST_FILE} uses unsupported trust policy '${trustRecord.trustPolicy}'`);
    }
    if (trustRecord.implementation?.module !== fingerprint.module) {
      issues.push(`${TEMPLATE_TRUST_FILE} trusts implementation module '${trustRecord.implementation?.module}', but ${normalizeRoot(configLabel)} uses '${fingerprint.module}'`);
    }
    if (trustRecord.implementation?.export !== fingerprint.export) {
      issues.push(`${TEMPLATE_TRUST_FILE} trusts implementation export '${trustRecord.implementation?.export}', but ${normalizeRoot(configLabel)} uses '${fingerprint.export}'`);
    }
    const trustedId = trustRecord.implementation?.id || null;
    if (trustedId !== (fingerprint.id || null)) {
      issues.push(`${TEMPLATE_TRUST_FILE} trusts implementation id '${trustedId || ""}', but ${normalizeRoot(configLabel)} uses '${fingerprint.id || ""}'`);
    }

    if (projectTemplate?.id && trustRecord.template?.id !== projectTemplate.id) {
      issues.push(`${TEMPLATE_TRUST_FILE} trusts template '${trustRecord.template?.id}', but topogram.project.json declares '${projectTemplate.id}'`);
    }
    if (projectTemplate?.version && trustRecord.template?.version !== projectTemplate.version) {
      issues.push(`${TEMPLATE_TRUST_FILE} trusts template version '${trustRecord.template?.version}', but topogram.project.json declares '${projectTemplate.version}'`);
    }

    if (!trustRecord.content) {
      issues.push(`${TEMPLATE_TRUST_FILE} is missing implementation content hashes`);
    } else if (trustRecord.content.algorithm !== "sha256") {
      issues.push(`${TEMPLATE_TRUST_FILE} uses unsupported content hash algorithm '${trustRecord.content.algorithm}'`);
    } else {
      const currentContent = hashImplementationContent(implementationInfo.configDir);
      contentStatus.trustedDigest = trustRecord.content.digest;
      contentStatus.currentDigest = currentContent.digest;
      const trustedByPath = new Map((trustRecord.content.files || []).map((file) => [file.path, file]));
      const currentByPath = new Map(currentContent.files.map((file) => [file.path, file]));
      const diff = diffContentFiles(trustedByPath, currentByPath);
      contentStatus.added = diff.added;
      contentStatus.removed = diff.removed;
      contentStatus.changed = diff.changed;
      if (trustRecord.content.digest !== currentContent.digest) {
        issues.push(`${TEMPLATE_TRUST_FILE} implementation content changed since it was last trusted`);
      }
    }
  }

  return {
    ok: issues.length === 0,
    requiresTrust: true,
    trustPath,
    trustRecord,
    template: {
      id: projectTemplate?.id || trustRecord?.template?.id || null,
      version: projectTemplate?.version || trustRecord?.template?.version || null,
      source: projectTemplate?.source || trustRecord?.template?.source || null,
      sourceSpec: projectTemplate?.sourceSpec || trustRecord?.template?.sourceSpec || null,
      requested: projectTemplate?.requested || trustRecord?.template?.requested || null,
      sourceRoot: projectTemplate?.sourceRoot || trustRecord?.template?.sourceRoot || null,
      catalog: projectTemplate?.catalog || trustRecord?.template?.catalog || null,
      includesExecutableImplementation: typeof projectTemplate?.includesExecutableImplementation === "boolean"
        ? projectTemplate.includesExecutableImplementation
        : null
    },
    implementation: fingerprint,
    content: contentStatus,
    issues
  };
}

/**
 * @param {{ config: Record<string, any>, configPath: string|null, configDir: string }} implementationInfo
 * @param {Record<string, any>|null} projectConfig
 * @returns {{ ok: boolean, requiresTrust: boolean, status: ReturnType<typeof getTemplateTrustStatus>, files: Array<{ path: string, kind: "added"|"removed"|"changed", trusted: { path: string, sha256: string|null, size: number|null }|null, current: { path: string, sha256: string|null, size: number|null, binary: boolean, diffOmitted: boolean }|null, binary: boolean, diffOmitted: boolean, unifiedDiff: string|null }> }}
 */
export function getTemplateTrustDiff(implementationInfo, projectConfig = null) {
  const status = getTemplateTrustStatus(implementationInfo, projectConfig);
  if (!status.requiresTrust || !status.trustRecord?.content) {
    return { ok: status.ok, requiresTrust: status.requiresTrust, status, files: [] };
  }
  const currentContent = hashImplementationContent(implementationInfo.configDir);
  const trustedByPath = new Map((status.trustRecord.content.files || []).map((file) => [file.path, file]));
  const currentByPath = new Map(currentContent.files.map((file) => [file.path, file]));
  /** @type {Array<{ path: string, kind: "added"|"removed"|"changed", trusted: { path: string, sha256: string|null, size: number|null }|null, current: { path: string, sha256: string|null, size: number|null, binary: boolean, diffOmitted: boolean }|null, binary: boolean, diffOmitted: boolean, unifiedDiff: string|null }>} */
  const files = [];

  for (const relativePath of status.content.changed) {
    const trusted = trustedByPath.get(relativePath) || null;
    const current = currentByPath.get(relativePath) || null;
    const currentReview = implementationReviewFile(implementationInfo.configDir, relativePath, current);
    files.push({
      path: relativePath,
      kind: "changed",
      trusted: trusted ? { path: relativePath, sha256: trusted.sha256, size: trusted.size } : null,
      current: {
        path: relativePath,
        sha256: currentReview.sha256,
        size: currentReview.size,
        binary: currentReview.binary,
        diffOmitted: currentReview.diffOmitted
      },
      binary: currentReview.binary,
      diffOmitted: true,
      unifiedDiff: null
    });
  }
  for (const relativePath of status.content.added) {
    const current = currentByPath.get(relativePath) || null;
    const currentReview = implementationReviewFile(implementationInfo.configDir, relativePath, current);
    files.push({
      path: relativePath,
      kind: "added",
      trusted: null,
      current: {
        path: relativePath,
        sha256: currentReview.sha256,
        size: currentReview.size,
        binary: currentReview.binary,
        diffOmitted: currentReview.diffOmitted
      },
      binary: currentReview.binary,
      diffOmitted: currentReview.binary || currentReview.diffOmitted,
      unifiedDiff: currentReview.binary || currentReview.diffOmitted
        ? null
        : unifiedTextDiff(relativePath, null, currentReview.text)
    });
  }
  for (const relativePath of status.content.removed) {
    const trusted = trustedByPath.get(relativePath) || null;
    files.push({
      path: relativePath,
      kind: "removed",
      trusted: trusted ? { path: relativePath, sha256: trusted.sha256, size: trusted.size } : null,
      current: null,
      binary: false,
      diffOmitted: true,
      unifiedDiff: null
    });
  }

  files.sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind));
  return {
    ok: status.ok,
    requiresTrust: status.requiresTrust,
    status,
    files
  };
}

/**
 * @param {{ config: Record<string, any>, configPath: string|null, configDir: string }|null} projectConfigInfo
 * @returns {{ ok: boolean, errors: Array<{ message: string, loc: any }> }}
 */
export function validateProjectImplementationTrust(projectConfigInfo) {
  if (!projectConfigInfo?.config?.implementation) {
    return { ok: true, errors: [] };
  }
  const implementationModule =
    projectConfigInfo.config.implementation.implementation_module ||
    projectConfigInfo.config.implementation.module;
  if (!implementationModule) {
    return { ok: true, errors: [] };
  }
  const implementationInfo = {
    config: projectConfigInfo.config.implementation,
    configPath: projectConfigInfo.configPath,
    configDir: projectConfigInfo.configDir
  };
  try {
    assertTrustedImplementation(implementationInfo, projectConfigInfo.config);
    return { ok: true, errors: [] };
  } catch (error) {
    return {
      ok: false,
      errors: [{
        message: error instanceof Error ? error.message : String(error),
        loc: null
      }]
    };
  }
}

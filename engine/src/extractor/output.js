// @ts-check

/**
 * @typedef {Object} ExtractorResultValidationOptions
 * @property {string} [track]
 * @property {boolean} [strictCandidates]
 */

/**
 * @typedef {Object} ExtractorResultValidation
 * @property {boolean} ok
 * @property {string[]} errors
 * @property {{ findings: number, candidateKeys: number, diagnostics: number }|null} smoke
 */

/** @type {Record<string, Set<string>>} */
const TRACK_CANDIDATE_BUCKETS = {
  db: new Set(["entities", "enums", "relations", "indexes", "maintained_seams"]),
  api: new Set(["capabilities", "routes", "stacks"]),
  ui: new Set(["screens", "routes", "actions", "flows", "widgets", "shapes", "stacks"]),
  cli: new Set(["commands", "capabilities", "surfaces"]),
  workflows: new Set(["workflows", "workflow_states", "workflow_transitions"]),
  verification: new Set(["verifications", "scenarios", "frameworks", "scripts"])
};

const DISALLOWED_BUCKETS = new Set([
  "adoption",
  "adoption_plan",
  "adoptionPlan",
  "canonical",
  "canonical_files",
  "canonicalFiles",
  "files",
  "patches",
  "project_config",
  "projectConfig",
  "topo",
  "topogram",
  "topogram_project",
  "topogramProject",
  "writeFiles",
  "writes",
  "writtenFiles"
]);

const DISALLOWED_RECORD_KEYS = new Set([
  "adoption",
  "adoptionPlan",
  "canonical",
  "canonicalFiles",
  "files",
  "patches",
  "receipt",
  "topo",
  "topogram",
  "write",
  "writeFiles",
  "writes",
  "writtenFiles"
]);

/**
 * Keys that carry local source/package file references. Deliberately excludes
 * command/route `path` and config target dotted `path` values.
 */
const PATH_KEYS = new Set([
  "configFile",
  "configPath",
  "file",
  "filePath",
  "migrationPath",
  "migrationsPath",
  "schemaPath",
  "snapshotPath",
  "sourceFile",
  "sourcePath",
  "source_path",
  "targetFile",
  "targetPath"
]);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {string} candidatePath
 * @returns {boolean}
 */
function isUnsafeRelativePath(candidatePath) {
  return candidatePath.startsWith("/") || candidatePath === ".." || candidatePath.startsWith("../") || candidatePath.includes("/../");
}

/**
 * @param {string} bucket
 * @param {Record<string, unknown>} candidate
 * @returns {string[]}
 */
function identityFieldsForBucket(bucket, candidate) {
  if (bucket === "commands") return ["command_id", "id_hint"];
  if (bucket === "routes") {
    if (typeof candidate.method === "string" && typeof candidate.path === "string") {
      return [];
    }
    return ["id_hint", "id"];
  }
  return ["id_hint", "id", "name"];
}

/**
 * @param {string} bucket
 * @param {Record<string, unknown>} candidate
 * @param {string} pathLabel
 * @returns {string[]}
 */
function validateCandidateIdentity(bucket, candidate, pathLabel) {
  const fields = identityFieldsForBucket(bucket, candidate);
  if (fields.length === 0) return [];
  if (fields.some((field) => typeof candidate[field] === "string" && String(candidate[field]).trim().length > 0)) {
    return [];
  }
  return [`${pathLabel} must include an identity field: ${fields.join(" or ")}`];
}

/**
 * @param {unknown} value
 * @param {string} pathLabel
 * @param {string[]} errors
 * @returns {void}
 */
function validateNoUnsafeRecords(value, pathLabel, errors) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      validateNoUnsafeRecords(value[index], `${pathLabel}[${index}]`, errors);
    }
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${pathLabel}.${key}`;
    if (DISALLOWED_RECORD_KEYS.has(key)) {
      errors.push(`${childPath} is not allowed in extractor candidate output; extractors emit review candidates, not adoption plans or files.`);
      continue;
    }
    if (PATH_KEYS.has(key) && typeof child === "string" && isUnsafeRelativePath(child)) {
      errors.push(`${childPath} must be a safe project-relative path.`);
      continue;
    }
    validateNoUnsafeRecords(child, childPath, errors);
  }
}

/**
 * @param {unknown} result
 * @param {ExtractorResultValidationOptions} [options]
 * @returns {ExtractorResultValidation}
 */
export function validateExtractorResult(result, options = {}) {
  const errors = [];
  if (!isPlainObject(result)) {
    return { ok: false, errors: ["extract(context) must return an object"], smoke: null };
  }
  if (result.findings != null && !Array.isArray(result.findings)) {
    errors.push("extract(context) findings must be an array when present");
  }
  if (result.diagnostics != null && !Array.isArray(result.diagnostics)) {
    errors.push("extract(context) diagnostics must be an array when present");
  }
  if (!isPlainObject(result.candidates)) {
    errors.push("extract(context) result must include a candidates object");
    return { ok: false, errors, smoke: null };
  }

  const allowedBuckets = options.track ? TRACK_CANDIDATE_BUCKETS[options.track] : null;
  const candidateKeys = Object.keys(result.candidates);
  for (const [bucket, value] of Object.entries(result.candidates)) {
    const bucketLabel = `extract(context) candidates.${bucket}`;
    if (DISALLOWED_BUCKETS.has(bucket)) {
      errors.push(`${bucketLabel} is not allowed; extractors must not return adoption plans, canonical files, patches, or topo writes.`);
      continue;
    }
    if (options.strictCandidates && allowedBuckets && !allowedBuckets.has(bucket)) {
      errors.push(`${bucketLabel} is not allowed for track '${options.track}'.`);
      continue;
    }
    if (!Array.isArray(value)) {
      errors.push(`${bucketLabel} must be an array`);
      continue;
    }
    if (!options.strictCandidates) continue;
    for (let index = 0; index < value.length; index += 1) {
      const candidate = value[index];
      const candidateLabel = `${bucketLabel}[${index}]`;
      if (!isPlainObject(candidate)) {
        errors.push(`${candidateLabel} must be an object.`);
        continue;
      }
      errors.push(...validateCandidateIdentity(bucket, candidate, candidateLabel));
      validateNoUnsafeRecords(candidate, candidateLabel, errors);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    smoke: errors.length === 0
      ? {
          findings: Array.isArray(result.findings) ? result.findings.length : 0,
          candidateKeys: candidateKeys.length,
          diagnostics: Array.isArray(result.diagnostics) ? result.diagnostics.length : 0
        }
      : null
  };
}

export { TRACK_CANDIDATE_BUCKETS };

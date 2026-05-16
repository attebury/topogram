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

const SCALAR_CANDIDATE_BUCKETS = new Set(["stacks", "frameworks"]);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * @param {string} bucket
 * @param {unknown} value
 * @returns {unknown}
 */
function normalizeScalarBucketValue(bucket, value) {
  const direct = nonEmptyString(value);
  if (direct) return direct;
  if (!isPlainObject(value)) return value;
  const keys = bucket === "stacks"
    ? ["framework", "runtime", "name", "id_hint", "id"]
    : ["name", "id_hint", "id", "framework"];
  for (const key of keys) {
    const candidate = nonEmptyString(value[key]);
    if (candidate) return candidate;
  }
  return value;
}

/**
 * @param {unknown} entry
 * @param {boolean} required
 * @returns {unknown}
 */
function normalizeParamEntry(entry, required) {
  const name = nonEmptyString(entry);
  if (name) return { name, required, type: null };
  if (!isPlainObject(entry)) return entry;
  return {
    ...entry,
    name: nonEmptyString(entry.name) || nonEmptyString(entry.id) || nonEmptyString(entry.id_hint) || entry.name
  };
}

/**
 * @param {unknown} value
 * @param {boolean} required
 * @returns {unknown}
 */
function normalizeParamList(value, required) {
  if (!Array.isArray(value)) return value;
  return value.map((entry) => normalizeParamEntry(entry, required));
}

/**
 * @param {string} track
 * @param {string} bucket
 * @param {unknown} candidate
 * @returns {unknown}
 */
function normalizeCandidateRecord(track, bucket, candidate) {
  if (track !== "api" || bucket !== "capabilities" || !isPlainObject(candidate)) {
    return candidate;
  }
  return {
    ...candidate,
    path_params: normalizeParamList(candidate.path_params, true),
    query_params: normalizeParamList(candidate.query_params, false),
    header_params: normalizeParamList(candidate.header_params, false)
  };
}

/**
 * Normalize public extractor package output into the same practical shapes the
 * built-in extractors use before strict safety validation runs.
 *
 * @param {unknown} result
 * @param {{ track?: string }} [options]
 * @returns {any}
 */
export function normalizeExtractorResult(result, options = {}) {
  if (!isPlainObject(result) || !isPlainObject(result.candidates)) {
    return result;
  }
  /** @type {Record<string, unknown>} */
  const candidates = {};
  for (const [bucket, value] of Object.entries(result.candidates)) {
    if (!Array.isArray(value)) {
      candidates[bucket] = value;
      continue;
    }
    candidates[bucket] = SCALAR_CANDIDATE_BUCKETS.has(bucket)
      ? value.map((entry) => normalizeScalarBucketValue(bucket, entry))
      : value.map((entry) => normalizeCandidateRecord(options.track || "", bucket, entry));
  }
  return { ...result, candidates };
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
    if (SCALAR_CANDIDATE_BUCKETS.has(bucket)) {
      for (let index = 0; index < value.length; index += 1) {
        if (typeof value[index] !== "string" || String(value[index]).trim().length === 0) {
          errors.push(`${bucketLabel}[${index}] must be a non-empty string.`);
        }
      }
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

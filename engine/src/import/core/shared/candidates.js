import {
  canonicalCandidateTerm,
  ensureTrailingNewline,
  idHintify,
  pluralizeCandidateTerm,
  slugify,
  titleCase
} from "../../../text-helpers.js";

export {
  canonicalCandidateTerm,
  ensureTrailingNewline,
  idHintify,
  pluralizeCandidateTerm,
  slugify,
  titleCase
};

/**
 * @param {import("./types.d.ts").ImportCandidateRecord} arg1
 * @returns {any}
 */
export function makeCandidateRecord(arg1) {
  const {
    kind,
    idHint,
    label,
    confidence = "medium",
    sourceKind,
    sourceOfTruth = "imported",
    provenance,
    track = null,
    ...payload
  } = arg1;
  const inferredTrack =
    track ||
    (["entity", "enum", "relation", "index"].includes(kind)
      ? "db"
      : kind === "capability"
        ? "api"
        : kind === "widget"
          ? "ui"
          : null);
  return {
    kind,
    id_hint: idHint,
    label,
    confidence,
    source_kind: sourceKind,
    source_of_truth: sourceOfTruth,
    provenance: Array.isArray(provenance) ? provenance : [provenance].filter(Boolean),
    track: inferredTrack,
    ...payload
  };
}

/**
 * @param {import("./types.d.ts").ImportCandidateRecord[]} records
 * @param {any} keyFn
 * @returns {any}
 */
export function dedupeCandidateRecords(records, keyFn) {
  const seen = new Map();
  for (const record of records) {
    const key = keyFn(record);
    const recordProvenance = Array.isArray(record.provenance) ? record.provenance : [record.provenance].filter(Boolean);
    if (!seen.has(key)) {
      seen.set(key, { ...record, provenance: recordProvenance });
      continue;
    }
    const current = seen.get(key);
    const currentProvenance = Array.isArray(current.provenance) ? current.provenance : [current.provenance].filter(Boolean);
    current.provenance = [...new Set([...currentProvenance, ...recordProvenance])];
  }
  return [...seen.values()];
}

/**
 * @param {any} typeName
 * @returns {any}
 */
export function normalizePrismaType(typeName) {
  const normalized = String(typeName || "").toLowerCase();
  switch (normalized) {
    case "string": return "string";
    case "int": return "int";
    case "bigint": return "bigint";
    case "float": return "float";
    case "decimal": return "decimal";
    case "boolean":
    case "bool": return "boolean";
    case "datetime": return "datetime";
    case "bytes": return "bytes";
    case "json": return "json";
    default: return typeName;
  }
}

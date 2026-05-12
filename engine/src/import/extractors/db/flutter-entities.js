import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findPrimaryImportFiles,
  idHintify,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function normalizeDartFieldType(typeName) {
  const normalized = String(typeName || "").replace(/\?$/, "").trim();
  switch (normalized) {
    case "String": return "string";
    case "int": return "int";
    case "double": return "double";
    case "bool": return "boolean";
    case "DateTime": return "datetime";
    default: return idHintify(normalized) || "string";
  }
}

function featureStemFromPath(filePath) {
  return canonicalCandidateTerm(filePath.match(/\/features\/([^/]+)\//)?.[1] || "item");
}

function parseEntityFile(text, provenance, filePath) {
  const classMatch = String(text || "").match(/class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/m);
  if (!classMatch) return null;
  const className = classMatch[1];
  const fields = [...String(text || "").matchAll(/final\s+([A-Za-z0-9_<>\?]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g)]
    .map((match) => ({
      name: match[2],
      field_type: normalizeDartFieldType(match[1]),
      required: !String(match[1]).includes("?"),
      list: /^List</.test(match[1]),
      unique: false,
      primary_key: /^id$/i.test(match[2])
    }));
  if (fields.length === 0) return null;
  const stem = featureStemFromPath(filePath);
  return makeCandidateRecord({
    kind: "entity",
    idHint: `entity_${stem}`,
    label: titleCase(stem),
    confidence: "high",
    sourceKind: "schema",
    provenance,
    model_name: className,
    fields,
    track: "db"
  });
}

function parseEnums(text, provenance, filePath) {
  const stem = featureStemFromPath(filePath);
  const enums = [];
  for (const match of String(text || "").matchAll(/enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}/g)) {
    const enumName = canonicalCandidateTerm(idHintify(match[1].replace(/([a-z0-9])([A-Z])/g, "$1_$2")));
    const values = match[2]
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => value.replace(/\(.*$/, "").trim())
      .filter(Boolean);
    if (values.length === 0) continue;
    enums.push(makeCandidateRecord({
      kind: "enum",
      idHint: `enum_${stem}_${enumName}`,
      label: titleCase(enumName),
      confidence: "medium",
      sourceKind: "schema",
      provenance,
      values,
      track: "db"
    }));
  }
  return enums;
}

export const flutterEntitiesExtractor = {
  id: "db.flutter-entities",
  track: "db",
  detect(context) {
    const entityFiles = findPrimaryImportFiles(
      context.paths,
      (filePath) => /\/lib\/features\/.+\/domain\/entities\/.+_entity\.dart$/i.test(filePath)
    );
    const score = entityFiles.length > 0 ? 83 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found Flutter feature domain entities"] : []
    };
  },
  extract(context) {
    const entityFiles = findPrimaryImportFiles(
      context.paths,
      (filePath) => /\/lib\/features\/.+\/domain\/entities\/.+_entity\.dart$/i.test(filePath)
    );
    const findings = [];
    const candidates = { entities: [], enums: [], relations: [], indexes: [] };
    for (const filePath of entityFiles) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      const entity = parseEntityFile(text, provenance, filePath);
      if (entity) {
        candidates.entities.push(entity);
      }
      candidates.enums.push(...parseEnums(text, provenance, filePath));
      findings.push({
        kind: "flutter_domain_entity",
        file: provenance,
        entity_id: entity?.id_hint || null
      });
    }
    candidates.entities = dedupeCandidateRecords(candidates.entities, (record) => record.id_hint);
    candidates.enums = dedupeCandidateRecords(candidates.enums, (record) => record.id_hint);
    return { findings, candidates };
  }
};

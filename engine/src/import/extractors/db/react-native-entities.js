import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findImportFiles,
  idHintify,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function normalizeTsFieldType(typeName) {
  const normalized = String(typeName || "").trim().replace(/\[\]$/, "");
  switch (normalized) {
    case "string": return "string";
    case "number": return "int";
    case "boolean": return "boolean";
    default: return idHintify(normalized) || "string";
  }
}

function contextStemFromPath(filePath) {
  const contextMatch = String(filePath || "").match(/\/src\/([^/]+)\//);
  const entityMatch = String(filePath || "").match(/\/([^/]+)Entity\.ts$/);
  return canonicalCandidateTerm(
    entityMatch?.[1] ||
    contextMatch?.[1] ||
    "item"
  );
}

function parseEntityFile(text, provenance, filePath) {
  const interfaceMatch = String(text || "").match(/interface\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}/m);
  if (!interfaceMatch) return null;
  const [, interfaceName, body] = interfaceMatch;
  const fields = [...String(body || "").matchAll(/([A-Za-z_][A-Za-z0-9_]*)\??:\s*([^;\n]+)/g)]
    .map((match) => ({
      name: match[1],
      field_type: normalizeTsFieldType(match[2]),
      required: !match[0].includes("?:"),
      list: /\[\]\s*$/.test(match[2]),
      unique: false,
      primary_key: /^id$/i.test(match[1])
    }));
  if (fields.length === 0) return null;
  const stem = contextStemFromPath(filePath);
  return makeCandidateRecord({
    kind: "entity",
    idHint: `entity_${stem}`,
    label: titleCase(stem),
    confidence: "high",
    sourceKind: "schema",
    provenance,
    model_name: interfaceName,
    fields,
    track: "db"
  });
}

export const reactNativeEntitiesExtractor = {
  id: "db.react-native-entities",
  track: "db",
  detect(context) {
    const entityFiles = findImportFiles(
      context.paths,
      (filePath) => /\/src\/.+\/domain\/entities\/.+Entity\.ts$/i.test(filePath)
    );
    const score = entityFiles.length > 0 ? 82 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found React Native domain entity interfaces"] : []
    };
  },
  extract(context) {
    const entityFiles = findImportFiles(
      context.paths,
      (filePath) => /\/src\/.+\/domain\/entities\/.+Entity\.ts$/i.test(filePath)
    );
    const findings = [];
    const candidates = { entities: [], enums: [], relations: [], indexes: [] };
    for (const filePath of entityFiles) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      const entity = parseEntityFile(text, provenance, filePath);
      if (!entity) continue;
      findings.push({
        kind: "react_native_domain_entity",
        file: provenance,
        entity_id: entity.id_hint
      });
      candidates.entities.push(entity);
    }
    candidates.entities = dedupeCandidateRecords(candidates.entities, (record) => record.id_hint);
    return { findings, candidates };
  }
};

import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findPrimaryImportFiles,
  idHintify,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function swiftFieldType(typeName) {
  const normalized = String(typeName || "").replace(/\?$/, "").trim();
  switch (normalized) {
    case "String": return "string";
    case "Int": return "int";
    case "Double": return "double";
    case "Float": return "float";
    case "Bool": return "boolean";
    case "URL": return "url";
    default:
      if (/^\[.+\]$/.test(normalized)) return "json";
      return idHintify(normalized) || "string";
  }
}

function parseSwiftModelBlocks(text) {
  const blocks = [];
  const pattern = /@Model\s+final\s+class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\n\}/g;
  for (const match of String(text || "").matchAll(pattern)) {
    blocks.push({ className: match[1], body: match[2] });
  }
  return blocks;
}

function parseSwiftDataEntity(block, provenance) {
  const stem = idHintify(canonicalCandidateTerm(block.className.replace(/([a-z0-9])([A-Z])/g, "$1_$2")));
  const fields = [];
  const relations = [];
  let uniqueNext = false;
  let relationNext = false;

  for (const rawLine of String(block.body || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("@Attribute(.unique)")) {
      uniqueNext = true;
      continue;
    }
    if (line.startsWith("@Relationship")) {
      relationNext = true;
      continue;
    }
    const match = line.match(/^var\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^=]+)/);
    if (!match) continue;
    const [, name, rawType] = match;
    const typeName = rawType.trim();
    const isList = /^\[.+\]\??$/.test(typeName);
    const innerType = isList ? typeName.replace(/^\[/, "").replace(/\]\??$/, "") : typeName.replace(/\?$/, "");
    const looksRelation = relationNext || /^[A-Z][A-Za-z0-9_]+$/.test(innerType);
    fields.push({
      name,
      field_type: looksRelation ? idHintify(innerType.replace(/([a-z0-9])([A-Z])/g, "$1_$2")) : swiftFieldType(typeName),
      required: !typeName.includes("?"),
      list: isList,
      unique: uniqueNext,
      primary_key: false
    });
    if (looksRelation) {
      relations.push(makeCandidateRecord({
        kind: "relation",
        idHint: `${stem}_${name}_${idHintify(innerType)}`,
        label: `${stem} -> ${innerType}`,
        confidence: "medium",
        sourceKind: "schema",
        provenance,
        from_entity: `entity_${stem}`,
        to_entity: `entity_${canonicalCandidateTerm(idHintify(innerType.replace(/([a-z0-9])([A-Z])/g, "$1_$2")))}`,
        relation_field: name,
        fields: [name],
        references: ["id"],
        relation_type: isList ? "many" : "one",
        track: "db"
      }));
    }
    uniqueNext = false;
    relationNext = false;
  }

  return {
    entity: makeCandidateRecord({
      kind: "entity",
      idHint: `entity_${stem}`,
      label: titleCase(stem),
      confidence: "high",
      sourceKind: "schema",
      provenance,
      model_name: block.className,
      fields,
      track: "db"
    }),
    relations
  };
}

export const swiftDataExtractor = {
  id: "db.swiftdata",
  track: "db",
  detect(context) {
    const files = findPrimaryImportFiles(context.paths, (filePath) => /\.swift$/i.test(filePath))
      .filter((filePath) => /@Model/.test(context.helpers.readTextIfExists(filePath) || ""));
    return {
      score: files.length > 0 ? 86 : 0,
      reasons: files.length > 0 ? ["Found SwiftData @Model classes"] : []
    };
  },
  extract(context) {
    const files = findPrimaryImportFiles(context.paths, (filePath) => /\.swift$/i.test(filePath))
      .filter((filePath) => /@Model/.test(context.helpers.readTextIfExists(filePath) || ""));
    const findings = [];
    const candidates = { entities: [], enums: [], relations: [], indexes: [] };
    for (const filePath of files) {
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      const blocks = parseSwiftModelBlocks(context.helpers.readTextIfExists(filePath) || "");
      for (const block of blocks) {
        const parsed = parseSwiftDataEntity(block, provenance);
        candidates.entities.push(parsed.entity);
        candidates.relations.push(...parsed.relations);
      }
      if (blocks.length > 0) {
        findings.push({ kind: "swiftdata_models", file: provenance, entity_count: blocks.length });
      }
    }
    candidates.entities = dedupeCandidateRecords(candidates.entities, (record) => record.id_hint);
    candidates.relations = dedupeCandidateRecords(candidates.relations, (record) => record.id_hint);
    return { findings, candidates };
  }
};

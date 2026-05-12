import { canonicalCandidateTerm, dedupeCandidateRecords, findPrimaryImportFiles, makeCandidateRecord, relativeTo, slugify, titleCase } from "../../core/shared.js";

function extractAnnotatedFields(text) {
  const fields = [];
  const relations = [];
  const enumFields = [];
  for (const match of String(text || "").matchAll(/((?:\s*@[\w.]+(?:\([^)]*\))?\s*)+)\s*private\s+([A-Za-z0-9_<>\[\]\.?]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g)) {
    const [, annotations, rawType, name] = match;
    const baseType = rawType.replace(/^Set<|^List</, "").replace(/>$/, "").split(".").pop();
    const columnName = annotations.match(/@JoinColumn\(name\s*=\s*"([^"]+)"/)?.[1] || annotations.match(/@Column\(name\s*=\s*"([^"]+)"/)?.[1] || name;
    const isRelation = /@(ManyToOne|OneToOne|OneToMany|ManyToMany)/.test(annotations);
    if (isRelation) {
      const relationTarget = canonicalCandidateTerm(baseType.replace(/Data$/, ""));
      relations.push({
        to_entity: `entity_${slugify(relationTarget)}`,
        relation_field: columnName,
        fields: [columnName],
        references: ["id"]
      });
      if (/@(OneToMany|ManyToMany)/.test(annotations)) {
        continue;
      }
    }
    if (/@Enumerated/.test(annotations)) {
      enumFields.push({ name: columnName, enum_name: baseType });
    }
    fields.push({
      name: columnName,
      field_type: rawType.toLowerCase(),
      required: /nullable\s*=\s*false/.test(annotations) || /@Id\b/.test(annotations),
      list: /^Set<|^List</.test(rawType),
      unique: /unique\s*=\s*true/.test(annotations),
      primary_key: /@Id\b/.test(annotations)
    });
  }
  return { fields, relations, enumFields };
}

function isNoiseEntity(entityStem) {
  return ["order-item", "orderitem"].includes(entityStem) || /(?:favorite|follow|tag)-?relationship$/.test(entityStem);
}

export const jpaExtractor = {
  id: "db.jpa",
  track: "db",
  detect(context) {
    const entityFiles = findPrimaryImportFiles(context.paths, (filePath) => /\.java$/i.test(filePath));
    const count = entityFiles.filter((filePath) => /@Entity\b/.test(context.helpers.readTextIfExists(filePath) || "")).length;
    return {
      score: count > 0 ? 87 : 0,
      reasons: count > 0 ? ["Found JPA @Entity classes"] : []
    };
  },
  extract(context) {
    const files = findPrimaryImportFiles(context.paths, (filePath) => /\.java$/i.test(filePath));
    const findings = [];
    const candidates = { entities: [], enums: [], relations: [], indexes: [] };

    for (const filePath of files) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      const entityName = text.match(/@Entity(?:\(name\s*=\s*"([^"]+)"\))?/)?.[1];
      if (!/@Entity\b/.test(text)) continue;
      const className = text.match(/class\s+([A-Za-z_][A-Za-z0-9_]*)/)?.[1] || "";
      const tableName = text.match(/@Table\(name\s*=\s*"([^"]+)"\)/)?.[1] || entityName || className;
      const entityStem = canonicalCandidateTerm(String(entityName || tableName || className).replace(/Data$/, ""));
      const { fields, relations, enumFields } = extractAnnotatedFields(text);
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      const noiseCandidate = isNoiseEntity(entityStem);

      findings.push({
        kind: "jpa_entity",
        file: provenance,
        entity: entityStem,
        field_count: fields.length
      });

      candidates.entities.push(makeCandidateRecord({
        kind: "entity",
        idHint: `entity_${slugify(entityStem)}`,
        label: titleCase(entityStem),
        confidence: "high",
        sourceKind: "schema",
        provenance,
        table_name: tableName,
        fields,
        noise_candidate: noiseCandidate,
        noise_reason: noiseCandidate ? "JPA implementation-noise child entity." : null,
        track: "db"
      }));

      candidates.relations.push(...relations.map((relation) => makeCandidateRecord({
        kind: "relation",
        idHint: slugify(`entity_${entityStem}_${relation.relation_field}_${relation.to_entity}`),
        label: `entity_${entityStem} -> ${relation.to_entity}`,
        confidence: "high",
        sourceKind: "schema",
        provenance,
        from_entity: `entity_${slugify(entityStem)}`,
        ...relation,
        track: "db"
      })));

      candidates.enums.push(...enumFields.map((entry) => makeCandidateRecord({
        kind: "enum",
        idHint: slugify(entry.enum_name),
        label: titleCase(entry.enum_name),
        confidence: "medium",
        sourceKind: "schema",
        provenance,
        values: [],
        track: "db"
      })));
    }

    candidates.entities = dedupeCandidateRecords(candidates.entities, (record) => record.id_hint);
    candidates.relations = dedupeCandidateRecords(candidates.relations, (record) => record.id_hint);
    candidates.enums = dedupeCandidateRecords(candidates.enums, (record) => record.id_hint);
    return { findings, candidates };
  }
};

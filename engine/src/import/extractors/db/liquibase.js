import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findPrimaryImportFiles,
  idHintify,
  makeCandidateRecord,
  relativeTo,
  slugify,
  titleCase
} from "../../core/shared.js";

function normalizeLiquibaseTableName(tableName) {
  return String(tableName || "")
    .replace(/^(tbl?|v)_/i, "")
    .replace(/_/g, "-");
}

function isJoinTable(tableName, fields) {
  const normalized = normalizeLiquibaseTableName(tableName);
  const idFields = (fields || []).filter((field) => field.name.endsWith("_id"));
  return (
    /(?:^|-)(association|join|junction|link|mapping|relationship|xref)$/.test(normalized) ||
    (idFields.length >= 2 && (fields || []).length <= 4)
  );
}

function joinNoiseReason(tableName) {
  void tableName;
  return "Liquibase implementation-noise join table.";
}

function parseConstraints(raw) {
  return {
    required: /nullable="false"/.test(raw),
    unique: /unique="true"/.test(raw),
    primary_key: /primaryKey="true"/.test(raw),
    referencedTableName: raw.match(/referencedTableName="([^"]+)"/)?.[1] || null,
    referencedColumnNames: raw.match(/referencedColumnNames="([^"]+)"/)?.[1] || null
  };
}

function parseLiquibaseSchema(xmlText) {
  const entities = [];
  const relations = [];
  const indexes = [];

  for (const match of String(xmlText || "").matchAll(/<createTable\s+tableName="([^"]+)"[^>]*>([\s\S]*?)<\/createTable>/g)) {
    const [, tableName, tableBody] = match;
    if (/^v_/i.test(tableName)) continue;
    const entityStem = canonicalCandidateTerm(normalizeLiquibaseTableName(tableName));
    const fields = [];

    for (const columnMatch of tableBody.matchAll(/<column\s+name="([^"]+)"\s+type="([^"]+)"[^>]*>([\s\S]*?)<\/column>|<column\s+name="([^"]+)"\s+type="([^"]+)"([^>]*)\/>/g)) {
      const name = columnMatch[1] || columnMatch[4];
      const fieldType = (columnMatch[2] || columnMatch[5] || "").toLowerCase();
      const inner = columnMatch[3] || columnMatch[6] || "";
      const constraints = parseConstraints(inner);
      fields.push({
        name,
        field_type: fieldType,
        required: constraints.required,
        unique: constraints.unique,
        primary_key: constraints.primary_key,
        list: false
      });
      if (constraints.referencedTableName) {
        const targetStem = canonicalCandidateTerm(normalizeLiquibaseTableName(constraints.referencedTableName));
        relations.push({
          from_entity: `entity_${entityStem}`,
          to_entity: `entity_${targetStem}`,
          relation_field: name,
          fields: [name],
          references: String(constraints.referencedColumnNames || "id").split(/\s*,\s*/)
        });
      }
    }

    const noiseCandidate = isJoinTable(tableName, fields);
    entities.push({
      id_hint: `entity_${entityStem}`,
      label: titleCase(entityStem),
      table_name: tableName,
      fields,
      noise_candidate: noiseCandidate,
      noise_reason: noiseCandidate ? joinNoiseReason(tableName) : null
    });
  }

  for (const match of String(xmlText || "").matchAll(/<createIndex\s+indexName="([^"]+)"\s+tableName="([^"]+)"[^>]*>([\s\S]*?)<\/createIndex>/g)) {
    const [, indexName, tableName, body] = match;
    if (/^v_/i.test(tableName)) continue;
    const entityStem = canonicalCandidateTerm(normalizeLiquibaseTableName(tableName));
    const fields = [...body.matchAll(/<column\s+name="([^"]+)"\s*\/>/g)].map((entry) => entry[1]);
    indexes.push({
      id_hint: idHintify(indexName),
      entity: `entity_${entityStem}`,
      fields,
      unique: false
    });
  }

  return { entities, relations, indexes };
}

export const liquibaseExtractor = {
  id: "db.liquibase",
  track: "db",
  detect(context) {
    const files = findPrimaryImportFiles(context.paths, (filePath) => /db\/changelog\/.+\.(xml|ya?ml)$/i.test(filePath));
    return {
      score: files.length > 0 ? 88 : 0,
      reasons: files.length > 0 ? ["Found Liquibase changelog files"] : []
    };
  },
  extract(context) {
    const changelogFiles = findPrimaryImportFiles(context.paths, (filePath) => /db\/changelog\/.+\.xml$/i.test(filePath));
    const findings = [];
    const candidates = { entities: [], enums: [], relations: [], indexes: [] };

    for (const filePath of changelogFiles) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      const parsed = parseLiquibaseSchema(text);
      if (parsed.entities.length === 0 && parsed.relations.length === 0) continue;
      const provenance = relativeTo(context.paths.repoRoot, filePath);

      findings.push({
        kind: "liquibase_schema",
        file: provenance,
        entity_count: parsed.entities.length,
        relation_count: parsed.relations.length
      });

      candidates.entities.push(...parsed.entities.map((entity) => makeCandidateRecord({
        kind: "entity",
        idHint: entity.id_hint,
        label: entity.label,
        confidence: "high",
        sourceKind: "schema",
        provenance,
        table_name: entity.table_name,
        fields: entity.fields,
        noise_candidate: entity.noise_candidate,
        noise_reason: entity.noise_reason,
        track: "db"
      })));

      candidates.relations.push(...parsed.relations.map((relation) => makeCandidateRecord({
        kind: "relation",
        idHint: slugify(`${relation.from_entity}_${relation.relation_field}_${relation.to_entity}`),
        label: `${relation.from_entity} -> ${relation.to_entity}`,
        confidence: "high",
        sourceKind: "schema",
        provenance,
        ...relation,
        track: "db"
      })));

      candidates.indexes.push(...parsed.indexes.map((index) => makeCandidateRecord({
        kind: "index",
        idHint: index.id_hint,
        label: titleCase(index.id_hint.replace(/^ix_/, "")),
        confidence: "medium",
        sourceKind: "schema",
        provenance,
        entity: index.entity,
        fields: index.fields,
        unique: index.unique,
        track: "db"
      })));
    }

    candidates.entities = dedupeCandidateRecords(candidates.entities, (record) => record.id_hint);
    candidates.relations = dedupeCandidateRecords(candidates.relations, (record) => record.id_hint);
    candidates.indexes = dedupeCandidateRecords(candidates.indexes, (record) => record.id_hint);
    return { findings, candidates };
  }
};

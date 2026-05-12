import { findPrimaryImportFiles, makeCandidateRecord, relativeTo, slugify, titleCase, idHintify } from "../../core/shared.js";

function parseDbSchemaSnapshot(snapshot) {
  return {
    entities: (snapshot.tables || []).map((table) => ({
      name: table.table,
      table_name: table.table,
      fields: (table.columns || []).map((column) => ({
        name: column.name,
        field_type: column.type,
        required: !column.nullable,
        list: false,
        unique: false,
        primary_key: Boolean(column.primaryKey)
      }))
    })),
    enums: (snapshot.enums || []).map((entry) => ({
      name: entry.id,
      values: entry.values || []
    })),
    relations: (snapshot.tables || []).flatMap((table) =>
      (table.foreignKeys || []).map((foreignKey) => ({
        from_entity: `entity_${slugify(table.table)}`,
        to_entity: `entity_${slugify(foreignKey.referencesTable)}`,
        relation_field: foreignKey.columns?.[0] || "relation",
        fields: foreignKey.columns || [],
        references: foreignKey.referencesColumns || []
      }))
    ),
    indexes: (snapshot.tables || []).flatMap((table) =>
      (table.indexes || []).map((index) => ({
        id_hint: idHintify(index.name || `${table.table}_${(index.columns || []).join("_")}`),
        entity: `entity_${slugify(table.table)}`,
        fields: index.columns || [],
        unique: Boolean(index.unique)
      }))
    )
  };
}

export const snapshotExtractor = {
  id: "db.snapshot",
  track: "db",
  detect(context) {
    const files = findPrimaryImportFiles(context.paths, (filePath) => filePath.endsWith(".db-schema-snapshot.json"));
    return {
      score: files.length > 0 ? 40 : 0,
      reasons: files.length > 0 ? ["Found DB schema snapshot artifacts"] : []
    };
  },
  extract(context) {
    const snapshotFiles = findPrimaryImportFiles(context.paths, (filePath) => filePath.endsWith(".db-schema-snapshot.json"));
    const findings = [];
    const candidates = { entities: [], enums: [], relations: [], indexes: [] };
    for (const filePath of snapshotFiles) {
      const snapshot = context.helpers.readJsonIfExists(filePath);
      if (!snapshot) continue;
      const parsed = parseDbSchemaSnapshot(snapshot);
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      findings.push({
        kind: "db_schema_snapshot",
        file: provenance,
        entity_count: parsed.entities.length,
        enum_count: parsed.enums.length
      });
      candidates.entities.push(...parsed.entities.map((entity) => makeCandidateRecord({
        kind: "entity",
        idHint: `entity_${slugify(entity.name)}`,
        label: titleCase(entity.name),
        confidence: "medium",
        sourceKind: "generated_artifact",
        provenance,
        table_name: entity.table_name || slugify(entity.name),
        fields: entity.fields,
        track: "db"
      })));
      candidates.enums.push(...parsed.enums.map((entry) => makeCandidateRecord({
        kind: "enum",
        idHint: idHintify(entry.name),
        label: titleCase(entry.name),
        confidence: "medium",
        sourceKind: "generated_artifact",
        provenance,
        values: entry.values,
        track: "db"
      })));
      candidates.relations.push(...parsed.relations.map((relation) => makeCandidateRecord({
        kind: "relation",
        idHint: slugify(`${relation.from_entity}_${relation.relation_field}_${relation.to_entity}`),
        label: `${relation.from_entity} -> ${relation.to_entity}`,
        confidence: "medium",
        sourceKind: "generated_artifact",
        provenance,
        ...relation,
        track: "db"
      })));
      candidates.indexes.push(...parsed.indexes.map((index) => makeCandidateRecord({
        kind: "index",
        idHint: index.id_hint,
        label: titleCase(index.id_hint.replace(/^index_/, "")),
        confidence: "medium",
        sourceKind: "generated_artifact",
        provenance,
        entity: index.entity,
        fields: index.fields,
        unique: index.unique,
        track: "db"
      })));
    }
    return { findings, candidates };
  }
};

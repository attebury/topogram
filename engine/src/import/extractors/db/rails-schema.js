import path from "node:path";

import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findImportFiles,
  idHintify,
  makeCandidateRecord,
  relativeTo,
  slugify,
  titleCase
} from "../../core/shared.js";

function parseRailsArray(rawValue) {
  return [...String(rawValue || "").matchAll(/["']([^"']+)["']/g)].map((entry) => entry[1]);
}

function parseRailsColumns(block) {
  const fields = [];
  const indexes = [];
  const lines = String(block || "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const columnMatch = trimmed.match(/^t\.([a-z_]+)\s+"([^"]+)"(.*)$/i);
    if (columnMatch) {
      const [, rawType, fieldName, options = ""] = columnMatch;
      if (rawType !== "index") {
        fields.push({
          name: fieldName,
          field_type: rawType.toLowerCase(),
          required: /null:\s*false/.test(options),
          list: false,
          unique: false,
          primary_key: false
        });
      }
      continue;
    }

    const indexMatch = trimmed.match(/^t\.index\s+(\[[^\]]+\]|"[^"]+")\s*,\s*name:\s*"([^"]+)"(.*)$/i);
    if (indexMatch) {
      const [, rawFields, indexName, options = ""] = indexMatch;
      const fieldsForIndex = rawFields.startsWith("[")
        ? parseRailsArray(rawFields)
        : [rawFields.replace(/^"|"$/g, "")];
      indexes.push({
        id_hint: idHintify(indexName),
        fields: fieldsForIndex,
        unique: /unique:\s*true/.test(options)
      });
    }
  }
  return { fields, indexes };
}

function parseRailsSchema(schemaText) {
  const entities = [];
  const indexes = [];
  const relations = [];
  const entityFieldMap = new Map();

  for (const match of schemaText.matchAll(/create_table\s+"([^"]+)"[\s\S]*?do\s+\|t\|\n([\s\S]*?)^\s*end$/gm)) {
    const [, tableName, block] = match;
    const entityStem = canonicalCandidateTerm(tableName);
    const entityId = `entity_${entityStem}`;
    const parsed = parseRailsColumns(block);
    entities.push({
      id_hint: entityId,
      label: titleCase(entityStem),
      table_name: tableName,
      fields: parsed.fields
    });
    entityFieldMap.set(tableName, parsed.fields);
    indexes.push(...parsed.indexes.map((index) => ({
      ...index,
      entity: entityId
    })));
  }

  for (const match of schemaText.matchAll(/add_foreign_key\s+"([^"]+)"\s*,\s*"([^"]+)"/g)) {
    const [, fromTable, toTable] = match;
    const fromEntity = `entity_${canonicalCandidateTerm(fromTable)}`;
    const toEntity = `entity_${canonicalCandidateTerm(toTable)}`;
    const candidateFieldNames = [
      `${canonicalCandidateTerm(toTable).replace(/-/g, "_")}_id`,
      `${canonicalCandidateTerm(toTable).replace(/-/g, "_")}Id`
    ];
    const knownFields = entityFieldMap.get(fromTable) || [];
    const relationField = candidateFieldNames.find((fieldName) => knownFields.some((field) => field.name === fieldName))
      || knownFields.find((field) => field.name.endsWith("_id"))?.name
      || `${canonicalCandidateTerm(toTable).replace(/-/g, "_")}_id`;
    relations.push({
      from_entity: fromEntity,
      to_entity: toEntity,
      relation_field: relationField,
      fields: [relationField],
      references: ["id"]
    });
  }

  return { entities, indexes, relations };
}

export const railsSchemaExtractor = {
  id: "db.rails-schema",
  track: "db",
  detect(context) {
    const schemaFiles = findImportFiles(context.paths, (filePath) => /db\/schema\.rb$/i.test(filePath));
    return {
      score: schemaFiles.length > 0 ? 92 : 0,
      reasons: schemaFiles.length > 0 ? ["Found Rails schema.rb"] : []
    };
  },
  extract(context) {
    const schemaFiles = findImportFiles(context.paths, (filePath) => /db\/schema\.rb$/i.test(filePath));
    const findings = [];
    const candidates = { entities: [], enums: [], relations: [], indexes: [] };

    for (const filePath of schemaFiles) {
      const schemaText = context.helpers.readTextIfExists(filePath) || "";
      const parsed = parseRailsSchema(schemaText);
      const provenance = relativeTo(context.paths.repoRoot, filePath);

      findings.push({
        kind: "rails_schema",
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
        label: titleCase(index.id_hint.replace(/^index_/, "")),
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

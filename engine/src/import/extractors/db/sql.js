import { canonicalCandidateTerm, findImportFiles, makeCandidateRecord, relativeTo, selectPreferredImportFiles, slugify, titleCase, idHintify } from "../../core/shared.js";

function parseTableConstraint(line, tableName) {
  const normalized = line.replace(/,$/, "").trim();
  const relationMatch = normalized.match(/foreign\s+key\s*\(([^)]+)\)\s+references\s+([A-Za-z0-9_".]+)\s*\(([^)]+)\)/i);
  if (relationMatch) {
    return {
      type: "relation",
      relation: {
        from_entity: `entity_${canonicalCandidateTerm(tableName)}`,
        to_entity: `entity_${canonicalCandidateTerm(relationMatch[2].split(".").pop().replace(/"/g, ""))}`,
        relation_field: relationMatch[1].split(",")[0].trim().replace(/"/g, ""),
        fields: relationMatch[1].split(",").map((entry) => entry.trim().replace(/"/g, "")),
        references: relationMatch[3].split(",").map((entry) => entry.trim().replace(/"/g, ""))
      }
    };
  }
  return { type: "constraint" };
}

export function parseSqlSchema(sqlText) {
  const entities = [];
  const enums = [];
  const relations = [];
  const indexes = [];

  for (const match of sqlText.matchAll(/create\s+type\s+([A-Za-z0-9_"]+)\s+as\s+enum\s*\(([\s\S]*?)\)\s*;/gi)) {
    const [, rawName, rawValues] = match;
    const enumName = rawName.replace(/"/g, "");
    const values = rawValues
      .split(",")
      .map((value) => value.trim().replace(/^'+|'+$/g, ""))
      .filter(Boolean);
    enums.push({ name: enumName, values });
  }

  for (const match of sqlText.matchAll(/create\s+table\s+([A-Za-z0-9_".]+)\s*\(([\s\S]*?)\)\s*;/gi)) {
    const [, rawName, body] = match;
    const tableName = rawName.split(".").pop().replace(/"/g, "");
    const entityStem = canonicalCandidateTerm(tableName);
    const fields = [];
    const bodyLines = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of bodyLines) {
      if (/^(constraint\b.*)?foreign\s+key\b/i.test(line) || /^primary\s+key\b/i.test(line) || /^unique\b/i.test(line) || /^check\b/i.test(line)) {
        const parsedConstraint = parseTableConstraint(line, tableName);
        if (parsedConstraint.type === "relation") {
          relations.push(parsedConstraint.relation);
        }
        continue;
      }
      const columnMatch = line.replace(/,$/, "").match(/^"?(?<name>[A-Za-z0-9_]+)"?\s+(?<type>[A-Za-z0-9_()[\]".]+)(?<rest>.*)$/i);
      if (!columnMatch) {
        continue;
      }
      const name = columnMatch.groups.name;
      const fieldType = columnMatch.groups.type.replace(/"/g, "");
      const rest = columnMatch.groups.rest || "";
      fields.push({
        name,
        field_type: fieldType,
        required: /\bnot\s+null\b/i.test(rest) || /\bprimary\s+key\b/i.test(rest),
        list: /\[\]$/.test(fieldType),
        unique: /\bunique\b/i.test(rest),
        primary_key: /\bprimary\s+key\b/i.test(rest)
      });
      const inlineReferenceMatch = rest.match(/\breferences\s+([A-Za-z0-9_".]+)\s*\(([^)]+)\)/i);
      if (inlineReferenceMatch) {
        relations.push({
          from_entity: `entity_${entityStem}`,
          to_entity: `entity_${canonicalCandidateTerm(inlineReferenceMatch[1].split(".").pop().replace(/"/g, ""))}`,
          relation_field: name,
          fields: [name],
          references: inlineReferenceMatch[2].split(",").map((entry) => entry.trim().replace(/"/g, ""))
        });
      }
    }

    entities.push({
      name: entityStem,
      table_name: tableName,
      fields
    });
  }

  for (const match of sqlText.matchAll(/create\s+(unique\s+)?index\s+([A-Za-z0-9_"]+)\s+on\s+([A-Za-z0-9_".]+)\s*\(([^)]+)\)/gi)) {
    const [, uniqueFlag, rawIndexName, rawTableName, rawFields] = match;
    const tableName = rawTableName.split(".").pop().replace(/"/g, "");
    indexes.push({
      id_hint: idHintify(rawIndexName.replace(/"/g, "")),
      entity: `entity_${canonicalCandidateTerm(tableName)}`,
      fields: rawFields.split(",").map((entry) => entry.trim().replace(/"/g, "")),
      unique: Boolean(uniqueFlag)
    });
  }

  return { entities, enums, relations, indexes };
}

export const sqlExtractor = {
  id: "db.sql",
  track: "db",
  detect(context) {
    const files = findImportFiles(context.paths, (filePath) => filePath.endsWith(".sql"));
    return {
      score: files.length > 0 ? 80 : 0,
      reasons: files.length > 0 ? ["Found SQL schema or migration files"] : []
    };
  },
  extract(context) {
    const allSqlFiles = findImportFiles(context.paths, (filePath) => filePath.endsWith(".sql"));
    const schemaSqlFiles = allSqlFiles.filter((filePath) => !/migration/i.test(filePath) && !/\/src\/test\//i.test(filePath));
    const migrationSqlFiles = allSqlFiles.filter((filePath) => /migration/i.test(filePath));
    const sqlFiles =
      schemaSqlFiles.length > 0
        ? selectPreferredImportFiles(context.paths, schemaSqlFiles, "sql")
        : selectPreferredImportFiles(context.paths, migrationSqlFiles, "sql");
    const findings = [];
    const candidates = { entities: [], enums: [], relations: [], indexes: [] };
    for (const filePath of sqlFiles) {
      const parsed = parseSqlSchema(context.helpers.readTextIfExists(filePath) || "");
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      const sourceKind = /migration/i.test(filePath) ? "migration" : "schema";
      const confidence = sourceKind === "migration" ? "medium" : "high";
      findings.push({
        kind: "sql_schema",
        file: provenance,
        entity_count: parsed.entities.length,
        enum_count: parsed.enums.length
      });
      candidates.entities.push(...parsed.entities.map((entity) => makeCandidateRecord({
        kind: "entity",
        idHint: `entity_${slugify(entity.name)}`,
        label: titleCase(entity.name),
        confidence,
        sourceKind,
        provenance,
        table_name: entity.table_name || slugify(entity.name),
        fields: entity.fields,
        track: "db"
      })));
      candidates.enums.push(...parsed.enums.map((entry) => makeCandidateRecord({
        kind: "enum",
        idHint: idHintify(entry.name),
        label: titleCase(entry.name),
        confidence,
        sourceKind,
        provenance,
        values: entry.values,
        track: "db"
      })));
      candidates.relations.push(...parsed.relations.map((relation) => makeCandidateRecord({
        kind: "relation",
        idHint: slugify(`${relation.from_entity}_${relation.relation_field}_${relation.to_entity}`),
        label: `${relation.from_entity} -> ${relation.to_entity}`,
        confidence: "medium",
        sourceKind,
        provenance,
        ...relation,
        track: "db"
      })));
      candidates.indexes.push(...parsed.indexes.map((index) => makeCandidateRecord({
        kind: "index",
        idHint: index.id_hint,
        label: titleCase(index.id_hint.replace(/^index_/, "")),
        confidence: "medium",
        sourceKind,
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

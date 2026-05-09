// @ts-nocheck
import path from "node:path";

import { relativeTo } from "../../path-helpers.js";
import { idHintify, slugify, titleCase } from "../../text-helpers.js";
import { readJsonIfExists, readTextIfExists } from "../shared.js";
import { dedupeCandidateRecords, findImportFiles, makeCandidateRecord, selectPreferredImportFiles } from "./shared.js";

function normalizePrismaType(typeName) {
  const normalized = String(typeName || "").toLowerCase();
  switch (normalized) {
    case "string":
      return "string";
    case "int":
      return "int";
    case "bigint":
      return "bigint";
    case "float":
      return "float";
    case "decimal":
      return "decimal";
    case "boolean":
    case "bool":
      return "boolean";
    case "datetime":
      return "datetime";
    case "bytes":
      return "bytes";
    case "json":
      return "json";
    default:
      return typeName;
  }
}

function parsePrismaSchema(schemaText) {
  const enums = [];
  const entities = [];
  const relations = [];
  const indexes = [];
  const enumNames = new Set();
  const modelNames = [];

  for (const match of schemaText.matchAll(/^enum\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, enumName, body] = match;
    const values = body
      .split(/\r?\n/)
      .map((line) => line.replace(/\/\/.*$/, "").trim())
      .filter((line) => line && !line.startsWith("@@"))
      .map((line) => line.split(/\s+/)[0]);
    enumNames.add(enumName);
    enums.push({ name: enumName, values });
  }

  for (const match of schemaText.matchAll(/^model\s+([A-Za-z0-9_]+)\s*\{/gm)) {
    modelNames.push(match[1]);
  }
  const modelNameSet = new Set(modelNames);

  for (const match of schemaText.matchAll(/^model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, modelName, body] = match;
    const fields = [];
    const localIndexes = [];
    const lines = body
      .split(/\r?\n/)
      .map((line) => line.replace(/\/\/.*$/, "").trim())
      .filter(Boolean);

    for (const line of lines) {
      if (line.startsWith("@@")) {
        const indexMatch = line.match(/^@@(unique|index)\(\[([^\]]+)\]/);
        if (indexMatch) {
          const [, type, rawFields] = indexMatch;
          localIndexes.push({
            id_hint: `index_${slugify(`${modelName}_${rawFields}`)}`,
            fields: rawFields.split(",").map((field) => field.trim()),
            unique: type === "unique"
          });
        }
        continue;
      }

      const fieldMatch = line.match(/^([A-Za-z0-9_]+)\s+([^\s]+)(.*)$/);
      if (!fieldMatch) {
        continue;
      }
      const [, fieldName, rawTypeToken, remainder] = fieldMatch;
      const list = rawTypeToken.endsWith("[]");
      const optional = rawTypeToken.endsWith("?");
      const baseType = rawTypeToken.replace(/\?|\[\]/g, "");
      const referencesModel = modelNameSet.has(baseType) && !enumNames.has(baseType);
      const hasRelationDirective = remainder.includes("@relation(");

      if (referencesModel && hasRelationDirective) {
        const relationMatch = remainder.match(/@relation\(([^)]*)\)/);
        const relationArgs = relationMatch?.[1] || "";
        const fieldsMatch = relationArgs.match(/fields:\s*\[([^\]]+)\]/);
        const refsMatch = relationArgs.match(/references:\s*\[([^\]]+)\]/);
        relations.push({
          from_entity: `entity_${slugify(modelName)}`,
          to_entity: `entity_${slugify(baseType)}`,
          relation_field: fieldName,
          fields: fieldsMatch ? fieldsMatch[1].split(",").map((field) => field.trim()) : [],
          references: refsMatch ? refsMatch[1].split(",").map((field) => field.trim()) : []
        });
        continue;
      }

      if (referencesModel) {
        continue;
      }

      const fieldType = enumNames.has(baseType) ? baseType : normalizePrismaType(baseType);
      fields.push({
        name: fieldName,
        field_type: fieldType,
        required: !optional && !list,
        list,
        unique: /@unique\b/.test(remainder),
        primary_key: /@id\b/.test(remainder)
      });

      if (/@unique\b/.test(remainder)) {
        localIndexes.push({
          id_hint: `index_${slugify(`${modelName}_${fieldName}_unique`)}`,
          fields: [fieldName],
          unique: true
        });
      }
    }

    entities.push({ name: modelName, fields });
    indexes.push(...localIndexes.map((index) => ({ ...index, entity: `entity_${slugify(modelName)}` })));
  }

  return { entities, enums, relations, indexes };
}

function splitSqlSegments(body) {
  return body
    .split(/,\s*\n/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function parseSqlSchema(sqlText) {
  const entities = [];
  const enums = [];
  const relations = [];
  const indexes = [];

  for (const match of sqlText.matchAll(/CREATE\s+TYPE\s+([A-Za-z0-9_"]+)\s+AS\s+ENUM\s*\(([\s\S]*?)\);/gi)) {
    const enumName = match[1].replace(/"/g, "");
    const values = [...match[2].matchAll(/'([^']+)'/g)].map((valueMatch) => valueMatch[1]);
    enums.push({ name: enumName, values });
  }

  for (const match of sqlText.matchAll(/CREATE\s+TABLE\s+([A-Za-z0-9_"]+)\s*\(([\s\S]*?)\);/gi)) {
    const tableName = match[1].replace(/"/g, "");
    const entityId = `entity_${slugify(tableName.replace(/s$/, ""))}`;
    const fields = [];
    for (const segment of splitSqlSegments(match[2])) {
      if (/^(PRIMARY\s+KEY|UNIQUE|CONSTRAINT|FOREIGN\s+KEY)/i.test(segment)) {
        const foreignKeyMatch = segment.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([A-Za-z0-9_"]+)\s*\(([^)]+)\)/i);
        if (foreignKeyMatch) {
          relations.push({
            from_entity: entityId,
            to_entity: `entity_${slugify(foreignKeyMatch[2].replace(/"/g, "").replace(/s$/, ""))}`,
            relation_field: foreignKeyMatch[1].replace(/"/g, "").trim(),
            fields: foreignKeyMatch[1].split(",").map((field) => field.replace(/"/g, "").trim()),
            references: foreignKeyMatch[3].split(",").map((field) => field.replace(/"/g, "").trim())
          });
        }
        const uniqueMatch = segment.match(/UNIQUE\s*\(([^)]+)\)/i);
        if (uniqueMatch) {
          indexes.push({
            entity: entityId,
            id_hint: `index_${slugify(`${tableName}_${uniqueMatch[1]}`)}`,
            fields: uniqueMatch[1].split(",").map((field) => field.replace(/"/g, "").trim()),
            unique: true
          });
        }
        continue;
      }
      const fieldMatch = segment.match(/^"?([A-Za-z0-9_]+)"?\s+([A-Za-z0-9_()[\]]+)(.*)$/i);
      if (!fieldMatch) {
        continue;
      }
      const [, fieldName, rawType, remainder] = fieldMatch;
      fields.push({
        name: fieldName,
        field_type: normalizePrismaType(rawType.replace(/\(.+$/, "")),
        required: /NOT\s+NULL/i.test(remainder),
        list: false,
        unique: /\bUNIQUE\b/i.test(remainder),
        primary_key: /\bPRIMARY\s+KEY\b/i.test(remainder)
      });
      const inlineReferenceMatch = remainder.match(/REFERENCES\s+([A-Za-z0-9_"]+)\s*\(([^)]+)\)/i);
      if (inlineReferenceMatch) {
        relations.push({
          from_entity: entityId,
          to_entity: `entity_${slugify(inlineReferenceMatch[1].replace(/"/g, "").replace(/s$/, ""))}`,
          relation_field: fieldName,
          fields: [fieldName],
          references: inlineReferenceMatch[2].split(",").map((field) => field.replace(/"/g, "").trim())
        });
      }
      if (/\bUNIQUE\b/i.test(remainder)) {
        indexes.push({
          entity: entityId,
          id_hint: `index_${slugify(`${tableName}_${fieldName}_unique`)}`,
          fields: [fieldName],
          unique: true
        });
      }
    }
    entities.push({ name: tableName.replace(/s$/, ""), table_name: tableName, fields });
  }

  for (const match of sqlText.matchAll(/CREATE\s+(UNIQUE\s+)?INDEX\s+([A-Za-z0-9_"]+)\s+ON\s+([A-Za-z0-9_"]+)\s*\(([^)]+)\)/gi)) {
    indexes.push({
      entity: `entity_${slugify(match[3].replace(/"/g, "").replace(/s$/, ""))}`,
      id_hint: `index_${slugify(match[2].replace(/"/g, ""))}`,
      fields: match[4].split(",").map((field) => field.replace(/"/g, "").trim()),
      unique: Boolean(match[1])
    });
  }

  return { entities, enums, relations, indexes };
}

function parseDbSchemaSnapshot(snapshot) {
  return {
    entities: (snapshot.tables || []).map((table) => ({
      name: table.entity?.name || table.table.replace(/s$/, ""),
      table_name: table.table,
      fields: (table.columns || []).map((column) => ({
        name: column.name,
        field_type: column.type,
        required: !column.nullable,
        list: false,
        unique: false,
        primary_key: false
      }))
    })),
    enums: (snapshot.enums || []).map((entry) => ({
      name: entry.name || entry.id,
      values: entry.values || []
    })),
    relations: (snapshot.tables || []).flatMap((table) =>
      (table.foreignKeys || []).map((foreignKey) => ({
        from_entity: table.entity?.id || `entity_${slugify(table.table.replace(/s$/, ""))}`,
        to_entity: foreignKey.references?.id || foreignKey.reference?.id || `entity_${slugify((foreignKey.references?.table || "").replace(/s$/, ""))}`,
        relation_field: foreignKey.columns?.[0] || "",
        fields: foreignKey.columns || [],
        references: foreignKey.references?.columns || []
      }))
    ),
    indexes: (snapshot.tables || []).flatMap((table) =>
      (table.indexes || []).map((index) => ({
        entity: table.entity?.id || `entity_${slugify(table.table.replace(/s$/, ""))}`,
        id_hint: `index_${slugify(index.name || `${table.table}_${(index.columns || []).join("_")}`)}`,
        fields: index.columns || [],
        unique: Boolean(index.unique)
      }))
    )
  };
}

export function discoverDbSources(paths) {
  const allPrismaFiles = findImportFiles(paths, (filePath) => filePath.endsWith(path.join("prisma", "schema.prisma")) || filePath.endsWith("/prisma/schema.prisma"));
  const allSqlFiles = findImportFiles(paths, (filePath) => filePath.endsWith(".sql") && /(schema|migration|migrations|db)/i.test(filePath));
  const snapshotFiles = findImportFiles(paths, (filePath) => filePath.endsWith(".db-schema-snapshot.json"));
  const prismaFiles = selectPreferredImportFiles(paths, allPrismaFiles, "prisma");
  const schemaSqlFiles = allSqlFiles.filter((filePath) => !/migration/i.test(path.basename(filePath)));
  const migrationSqlFiles = allSqlFiles.filter((filePath) => /migration/i.test(path.basename(filePath)));
  const sqlFiles =
    prismaFiles.length > 0
      ? []
      : schemaSqlFiles.length > 0
        ? selectPreferredImportFiles(paths, schemaSqlFiles, "sql")
        : selectPreferredImportFiles(paths, migrationSqlFiles, "sql");
  return { prismaFiles, sqlFiles, snapshotFiles };
}

export function collectDbImport(paths) {
  const findings = [];
  const candidates = {
    entities: [],
    enums: [],
    relations: [],
    indexes: []
  };
  const { prismaFiles, sqlFiles, snapshotFiles } = discoverDbSources(paths);
  let hasPrimarySchemaSource = false;

  for (const filePath of prismaFiles) {
    const parsed = parsePrismaSchema(readTextIfExists(filePath) || "");
    const provenance = relativeTo(paths.repoRoot, filePath);
    hasPrimarySchemaSource = true;
    findings.push({
      kind: "prisma_schema",
      file: provenance,
      entity_count: parsed.entities.length,
      enum_count: parsed.enums.length
    });
    candidates.entities.push(
      ...parsed.entities.map((entity) =>
        makeCandidateRecord({
          kind: "entity",
          idHint: `entity_${slugify(entity.name)}`,
          label: titleCase(entity.name),
          confidence: "high",
          sourceKind: "schema",
          provenance,
          table_name: slugify(entity.table_name || entity.name),
          fields: entity.fields
        })
      )
    );
    candidates.enums.push(
      ...parsed.enums.map((entry) =>
        makeCandidateRecord({
          kind: "enum",
          idHint: idHintify(entry.name),
          label: titleCase(entry.name),
          confidence: "high",
          sourceKind: "schema",
          provenance,
          values: entry.values
        })
      )
    );
    candidates.relations.push(
      ...parsed.relations.map((relation) =>
        makeCandidateRecord({
          kind: "relation",
          idHint: slugify(`${relation.from_entity}_${relation.relation_field}_${relation.to_entity}`),
          label: `${relation.from_entity} -> ${relation.to_entity}`,
          confidence: "high",
          sourceKind: "schema",
          provenance,
          ...relation
        })
      )
    );
    candidates.indexes.push(
      ...parsed.indexes.map((index) =>
        makeCandidateRecord({
          kind: "index",
          idHint: index.id_hint,
          label: titleCase(index.id_hint.replace(/^index_/, "")),
          confidence: "medium",
          sourceKind: "schema",
          provenance,
          entity: index.entity,
          fields: index.fields,
          unique: index.unique
        })
      )
    );
  }

  for (const filePath of sqlFiles) {
    const parsed = parseSqlSchema(readTextIfExists(filePath) || "");
    const provenance = relativeTo(paths.repoRoot, filePath);
    hasPrimarySchemaSource = true;
    findings.push({
      kind: "sql_schema",
      file: provenance,
      entity_count: parsed.entities.length,
      enum_count: parsed.enums.length
    });
    candidates.entities.push(
      ...parsed.entities.map((entity) =>
        makeCandidateRecord({
          kind: "entity",
          idHint: `entity_${slugify(entity.name)}`,
          label: titleCase(entity.name),
          confidence: /migration/i.test(filePath) ? "medium" : "high",
          sourceKind: /migration/i.test(filePath) ? "migration" : "schema",
          provenance,
          table_name: entity.table_name || slugify(entity.name),
          fields: entity.fields
        })
      )
    );
    candidates.enums.push(
      ...parsed.enums.map((entry) =>
        makeCandidateRecord({
          kind: "enum",
          idHint: idHintify(entry.name),
          label: titleCase(entry.name),
          confidence: /migration/i.test(filePath) ? "medium" : "high",
          sourceKind: /migration/i.test(filePath) ? "migration" : "schema",
          provenance,
          values: entry.values
        })
      )
    );
    candidates.relations.push(
      ...parsed.relations.map((relation) =>
        makeCandidateRecord({
          kind: "relation",
          idHint: slugify(`${relation.from_entity}_${relation.relation_field}_${relation.to_entity}`),
          label: `${relation.from_entity} -> ${relation.to_entity}`,
          confidence: "medium",
          sourceKind: /migration/i.test(filePath) ? "migration" : "schema",
          provenance,
          ...relation
        })
      )
    );
    candidates.indexes.push(
      ...parsed.indexes.map((index) =>
        makeCandidateRecord({
          kind: "index",
          idHint: index.id_hint,
          label: titleCase(index.id_hint.replace(/^index_/, "")),
          confidence: "medium",
          sourceKind: /migration/i.test(filePath) ? "migration" : "schema",
          provenance,
          entity: index.entity,
          fields: index.fields,
          unique: index.unique
        })
      )
    );
  }

  if (!hasPrimarySchemaSource) {
    for (const filePath of snapshotFiles) {
      const snapshot = readJsonIfExists(filePath);
      if (!snapshot) {
        continue;
      }
      const parsed = parseDbSchemaSnapshot(snapshot);
      const provenance = relativeTo(paths.repoRoot, filePath);
      findings.push({
        kind: "db_schema_snapshot",
        file: provenance,
        entity_count: parsed.entities.length,
        enum_count: parsed.enums.length
      });
      candidates.entities.push(
        ...parsed.entities.map((entity) =>
          makeCandidateRecord({
            kind: "entity",
            idHint: `entity_${slugify(entity.name)}`,
            label: titleCase(entity.name),
            confidence: "medium",
            sourceKind: "generated_artifact",
            provenance,
            table_name: entity.table_name || slugify(entity.name),
            fields: entity.fields
          })
        )
      );
      candidates.enums.push(
        ...parsed.enums.map((entry) =>
          makeCandidateRecord({
            kind: "enum",
            idHint: idHintify(entry.name),
            label: titleCase(entry.name),
            confidence: "medium",
            sourceKind: "generated_artifact",
            provenance,
            values: entry.values
          })
        )
      );
      candidates.relations.push(
        ...parsed.relations.map((relation) =>
          makeCandidateRecord({
            kind: "relation",
            idHint: slugify(`${relation.from_entity}_${relation.relation_field}_${relation.to_entity}`),
            label: `${relation.from_entity} -> ${relation.to_entity}`,
            confidence: "medium",
            sourceKind: "generated_artifact",
            provenance,
            ...relation
          })
        )
      );
      candidates.indexes.push(
        ...parsed.indexes.map((index) =>
          makeCandidateRecord({
            kind: "index",
            idHint: index.id_hint,
            label: titleCase(index.id_hint.replace(/^index_/, "")),
            confidence: "medium",
            sourceKind: "generated_artifact",
            provenance,
            entity: index.entity,
            fields: index.fields,
            unique: index.unique
          })
        )
      );
    }
  } else {
    for (const filePath of snapshotFiles) {
      findings.push({
        kind: "db_schema_snapshot",
        file: relativeTo(paths.repoRoot, filePath),
        used_as_primary: false
      });
    }
  }

  candidates.entities = dedupeCandidateRecords(candidates.entities, (record) => record.id_hint);
  candidates.enums = dedupeCandidateRecords(candidates.enums, (record) => record.id_hint);
  candidates.relations = dedupeCandidateRecords(candidates.relations, (record) => record.id_hint);
  candidates.indexes = dedupeCandidateRecords(candidates.indexes, (record) => record.id_hint);

  return { findings, candidates };
}

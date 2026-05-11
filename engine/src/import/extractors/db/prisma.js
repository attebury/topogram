import {
  findImportFiles,
  makeCandidateRecord,
  normalizePrismaType,
  relativeTo,
  selectPreferredImportFiles,
  slugify,
  titleCase,
  idHintify
} from "../../core/shared.js";
import { inferPrismaMaintainedDbSeams } from "./maintained-seams.js";

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
      if (!fieldMatch) continue;
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

      if (referencesModel) continue;

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

export const prismaExtractor = {
  id: "db.prisma",
  track: "db",
  detect(context) {
    const files = findImportFiles(context.paths, (filePath) => filePath.endsWith("/prisma/schema.prisma") || filePath.endsWith("prisma/schema.prisma"));
    return {
      score: files.length > 0 ? 100 : 0,
      reasons: files.length > 0 ? ["Found Prisma schema"] : []
    };
  },
  extract(context) {
    const prismaFiles = selectPreferredImportFiles(
      context.paths,
      findImportFiles(context.paths, (filePath) => filePath.endsWith("/prisma/schema.prisma") || filePath.endsWith("prisma/schema.prisma")),
      "prisma"
    );
    const findings = [];
    const candidates = { entities: [], enums: [], relations: [], indexes: [], maintained_seams: [] };
    for (const filePath of prismaFiles) {
      const parsed = parsePrismaSchema(context.helpers.readTextIfExists(filePath) || "");
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      findings.push({
        kind: "prisma_schema",
        file: provenance,
        entity_count: parsed.entities.length,
        enum_count: parsed.enums.length
      });
      candidates.entities.push(...parsed.entities.map((entity) => makeCandidateRecord({
        kind: "entity",
        idHint: `entity_${slugify(entity.name)}`,
        label: titleCase(entity.name),
        confidence: "high",
        sourceKind: "schema",
        provenance,
        table_name: slugify(entity.table_name || entity.name),
        fields: entity.fields,
        track: "db"
      })));
      candidates.enums.push(...parsed.enums.map((entry) => makeCandidateRecord({
        kind: "enum",
        idHint: idHintify(entry.name),
        label: titleCase(entry.name),
        confidence: "high",
        sourceKind: "schema",
        provenance,
        values: entry.values,
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
    candidates.maintained_seams = inferPrismaMaintainedDbSeams(context, prismaFiles);
    return { findings, candidates };
  }
};

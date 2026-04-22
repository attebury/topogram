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

function splitTopLevelEntries(block) {
  const entries = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let stringQuote = null;
  for (let index = 0; index < block.length; index += 1) {
    const char = block[index];
    const prev = block[index - 1];
    if (inString) {
      current += char;
      if (char === stringQuote && prev !== "\\") {
        inString = false;
        stringQuote = null;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      inString = true;
      stringQuote = char;
      current += char;
      continue;
    }
    if (char === "{" || char === "[" || char === "(") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === "}" || char === "]" || char === ")") {
      depth -= 1;
      current += char;
      continue;
    }
    if (char === "," && depth === 0) {
      if (current.trim()) entries.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) entries.push(current.trim());
  return entries;
}

function parseDrizzleFieldType(rawExpression) {
  const expression = String(rawExpression || "");
  const typeMatch = expression.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  const fieldType = typeMatch ? typeMatch[1] : "unknown";
  const enumMatch = expression.match(/\benum:\s*\[([^\]]+)\]/);
  const enumValues = enumMatch
    ? enumMatch[1]
        .split(",")
        .map((entry) => entry.trim().replace(/^["'`]|["'`]$/g, ""))
        .filter(Boolean)
    : [];
  const referencesMatch = expression.match(/\.references\s*\(\s*\(\s*\)\s*=>\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/);
  return {
    field_type: fieldType,
    enum_values: enumValues,
    required: /\.notNull\s*\(/.test(expression),
    unique: /\.unique\s*\(/.test(expression),
    primary_key: /\.primaryKey\s*\(/.test(expression),
    references: referencesMatch
      ? {
          target_table_symbol: referencesMatch[1],
          target_field: referencesMatch[2]
        }
      : null
  };
}

function parseDrizzleTables(schemaText) {
  const entities = [];
  const enums = [];
  const relations = [];
  const indexes = [];
  const tableSymbolToEntity = new Map();
  const enumRegistry = new Map();

  for (const match of schemaText.matchAll(/export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*pgTable\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*\{([\s\S]*?)\}\s*(?:,\s*\(([^)]*?)\)\s*=>\s*\(\{([\s\S]*?)\}\))?\s*\)/g)) {
    const [, tableSymbol, tableName, rawFieldsBlock, _tableArgs, rawIndexesBlock = ""] = match;
    const entityStem = canonicalCandidateTerm(tableName);
    const entityId = `entity_${entityStem}`;
    const fields = [];
    tableSymbolToEntity.set(tableSymbol, entityId);

    for (const entry of splitTopLevelEntries(rawFieldsBlock)) {
      const fieldMatch = entry.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([\s\S]+)$/);
      if (!fieldMatch) continue;
      const [, fieldName, rawExpression] = fieldMatch;
      const parsedField = parseDrizzleFieldType(rawExpression);
      fields.push({
        name: fieldName,
        field_type: parsedField.field_type,
        required: parsedField.required || parsedField.primary_key,
        list: false,
        unique: parsedField.unique,
        primary_key: parsedField.primary_key
      });
      if (parsedField.enum_values.length > 0) {
        const enumId = `${entityStem}_${canonicalCandidateTerm(fieldName)}`;
        if (!enumRegistry.has(enumId)) {
          enumRegistry.set(enumId, {
            id_hint: enumId,
            label: titleCase(enumId),
            values: parsedField.enum_values
          });
        }
        fields[fields.length - 1].field_type = enumId;
      }
      if (parsedField.references) {
        relations.push({
          from_entity: entityId,
          to_entity_symbol: parsedField.references.target_table_symbol,
          relation_field: fieldName,
          fields: [fieldName],
          references: [parsedField.references.target_field]
        });
      }
    }

    for (const indexEntry of splitTopLevelEntries(rawIndexesBlock)) {
      const indexMatch = indexEntry.match(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(unique|index)\s*\(\s*["'`]([^"'`]+)["'`]\s*\)\.on\(([\s\S]+)\)$/);
      if (!indexMatch) continue;
      const [, , indexType, indexName, rawColumns] = indexMatch;
      const fieldsForIndex = [...rawColumns.matchAll(/table\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((entry) => entry[1]);
      indexes.push({
        id_hint: idHintify(indexName),
        entity: entityId,
        fields: fieldsForIndex,
        unique: indexType === "unique"
      });
    }

    entities.push({
      name: entityStem,
      table_name: tableName,
      fields
    });
  }

  for (const relation of relations) {
    relation.to_entity = tableSymbolToEntity.get(relation.to_entity_symbol) || `entity_${canonicalCandidateTerm(relation.to_entity_symbol)}`;
    delete relation.to_entity_symbol;
  }

  return {
    entities,
    enums: [...enumRegistry.values()],
    relations,
    indexes
  };
}

export const drizzleExtractor = {
  id: "db.drizzle",
  track: "db",
  detect(context) {
    const hasConfig = findImportFiles(context.paths, (filePath) => /drizzle\.config\.(ts|js|mjs|cjs)$/i.test(path.basename(filePath))).length > 0;
    const hasSchema = findImportFiles(context.paths, (filePath) => /src\/schema\.(ts|js|mjs|cjs)$/i.test(filePath)).length > 0;
    return {
      score: hasConfig || hasSchema ? 95 : 0,
      reasons: hasConfig || hasSchema ? ["Found Drizzle config/schema source"] : []
    };
  },
  extract(context) {
    const schemaFiles = findImportFiles(context.paths, (filePath) => /src\/schema\.(ts|js|mjs|cjs)$/i.test(filePath));
    const findings = [];
    const candidates = { entities: [], enums: [], relations: [], indexes: [] };
    for (const filePath of schemaFiles) {
      const parsed = parseDrizzleTables(context.helpers.readTextIfExists(filePath) || "");
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      findings.push({
        kind: "drizzle_schema",
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
        table_name: entity.table_name,
        fields: entity.fields,
        track: "db"
      })));
      candidates.enums.push(...parsed.enums.map((entry) => makeCandidateRecord({
        kind: "enum",
        idHint: entry.id_hint,
        label: entry.label,
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
    candidates.entities = dedupeCandidateRecords(candidates.entities, (record) => record.id_hint);
    candidates.enums = dedupeCandidateRecords(candidates.enums, (record) => record.id_hint);
    candidates.relations = dedupeCandidateRecords(candidates.relations, (record) => record.id_hint);
    candidates.indexes = dedupeCandidateRecords(candidates.indexes, (record) => record.id_hint);
    return { findings, candidates };
  }
};

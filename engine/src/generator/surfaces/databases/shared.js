export const DB_TARGETS = new Set([
  "db-contract-graph",
  "db-contract-debug",
  "db-schema-snapshot",
  "db-migration-plan",
  "db-lifecycle-plan",
  "db-lifecycle-bundle",
  "sql-schema",
  "sql-migration",
  "prisma-schema",
  "drizzle-schema"
]);

export function getDbFamily(options = {}) {
  if (options.projectionId?.includes("sqlite")) {
    return "sqlite";
  }
  return "postgres";
}

function indexStatements(graph) {
  const byId = new Map();
  for (const statement of graph.statements) {
    byId.set(statement.id, statement);
  }
  return byId;
}

export function getProjection(graph, projectionId) {
  const byId = indexStatements(graph);
  const projection = byId.get(projectionId);
  if (!projection || projection.kind !== "projection") {
    throw new Error(`No projection found with id '${projectionId}'`);
  }
  return projection;
}

export function indexGraphStatements(graph) {
  return indexStatements(graph);
}

export function dbProjectionCandidates(graph) {
  return (graph.byKind.projection || []).filter(
    (projection) =>
      (projection.type || projection.type) === "db_contract" ||
      projection.type?.startsWith("db_") ||
      (projection.dbTables || []).length > 0 ||
      (projection.dbColumns || []).length > 0 ||
      (projection.dbRelations || []).length > 0
  );
}

export function defaultTableName(entityId) {
  const base = entityId.replace(/^entity_/, "");
  return base.endsWith("s") ? base : `${base}s`;
}

export function generatorDefaultsMap(projection) {
  const defaults = {};
  for (const entry of projection.generatorDefaults || []) {
    if (entry.key && entry.value != null) {
      defaults[entry.key] = entry.value;
    }
  }
  return defaults;
}

export function dbProfileForProjection(projection) {
  const defaults = generatorDefaultsMap(projection);
  return defaults.profile || "postgres_sql";
}

function mergeDbKeys(entity, projection) {
  const projectionKeys = (projection.dbKeys || []).filter((entry) => entry.entity?.id === entity.id);
  const baseKeys = entity.keys || [];
  return [...baseKeys, ...projectionKeys.map((entry) => ({ type: entry.keyType, fields: entry.fields, raw: entry.raw }))];
}

function mergeDbIndexes(entity, projection) {
  const projectionIndexes = (projection.dbIndexes || []).filter((entry) => entry.entity?.id === entity.id);
  const baseIndexes = entity.keys
    .filter((entry) => entry.type === "index" || entry.type === "unique")
    .map((entry) => ({ type: entry.type, fields: entry.fields, raw: entry.raw }));
  return [...baseIndexes, ...projectionIndexes.map((entry) => ({ type: entry.indexType, fields: entry.fields, raw: entry.raw }))];
}

function dedupeFieldSets(entries) {
  const seen = new Set();
  const output = [];
  for (const entry of entries) {
    const key = `${entry.type}:${entry.fields.join(",")}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(entry);
  }
  return output;
}

export function sortFieldSets(fieldSets = []) {
  return [...fieldSets]
    .map((fields) => [...fields])
    .sort((a, b) => a.join("|").localeCompare(b.join("|")));
}

export function findEnumStatement(byId, typeName) {
  const candidate = byId.get(typeName);
  return candidate?.kind === "enum" ? candidate : null;
}

export function toPascalCase(value) {
  return value
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function sqlTypeForField(fieldType, engine, byId = null) {
  const enumStatement = byId ? findEnumStatement(byId, fieldType) : null;
  if (enumStatement && engine === "postgres") {
    return `"${toPascalCase(enumStatement.id.replace(/^enum_/, ""))}"`;
  }
  if (engine === "sqlite") {
    switch (fieldType) {
      case "integer":
      case "boolean":
        return "integer";
      case "number":
        return "real";
      default:
        return "text";
    }
  }

  switch (fieldType) {
    case "uuid":
      return "uuid";
    case "integer":
      return "integer";
    case "number":
      return "double precision";
    case "boolean":
      return "boolean";
    case "datetime":
      return "timestamptz";
    default:
      return "text";
  }
}

export function sqlDefaultLiteral(value, fieldType, engine) {
  if (value == null) {
    return null;
  }
  if (fieldType === "boolean") {
    return engine === "sqlite" ? (value === "true" ? "1" : "0") : value.toUpperCase();
  }
  if (fieldType === "integer" || fieldType === "number") {
    return value;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function enumStatementsForSnapshot(snapshot, byId) {
  if ((snapshot.enums || []).length > 0) {
    return [...snapshot.enums].sort((a, b) => a.id.localeCompare(b.id));
  }
  const enums = new Map();
  for (const table of snapshot.tables || []) {
    for (const column of table.columns || []) {
      const enumStatement = findEnumStatement(byId, column.fieldType);
      if (enumStatement) {
        enums.set(enumStatement.id, enumStatement);
      }
    }
  }
  return [...enums.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function renderCreateEnumType(enumStatement) {
  const typeName = enumStatement.typeName || toPascalCase(enumStatement.id.replace(/^enum_/, ""));
  const values = enumStatement.values.map((value) => `'${String(value).replace(/'/g, "''")}'`).join(", ");
  return `DO $$ BEGIN\n  CREATE TYPE "${typeName}" AS ENUM (${values});\nEXCEPTION\n  WHEN duplicate_object THEN null;\nEND $$;`;
}

export function renderAddEnumValue(enumStatement, operation) {
  const typeName = enumStatement.typeName || toPascalCase(enumStatement.id.replace(/^enum_/, ""));
  const escapedValue = `'${String(operation.value).replace(/'/g, "''")}'`;
  const position =
    operation.before != null
      ? ` BEFORE '${String(operation.before).replace(/'/g, "''")}'`
      : operation.after != null
        ? ` AFTER '${String(operation.after).replace(/'/g, "''")}'`
        : "";
  return `ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS ${escapedValue}${position};`;
}

export function renderCreateTable(table, engine, options = {}) {
  const includeRelations = options.includeRelations !== false;
  const byId = options.byId || null;
  const lines = [];
  for (const column of table.columns) {
    const parts = [`${column.name} ${sqlTypeForField(column.fieldType, engine, byId)}`];
    if (column.requiredness === "required") {
      parts.push("not null");
    }
    const defaultLiteral = sqlDefaultLiteral(column.defaultValue, column.fieldType, engine);
    if (defaultLiteral != null) {
      parts.push(`default ${defaultLiteral}`);
    }
    lines.push(`  ${parts.join(" ")}`);
  }

  if (table.primaryKey.length > 0) {
    lines.push(`  primary key (${table.primaryKey.join(", ")})`);
  }
  for (const fields of table.uniques) {
    lines.push(`  unique (${fields.join(", ")})`);
  }
  if (includeRelations) {
    for (const relation of table.relations) {
      if (relation.target?.id && relation.target?.field) {
        const targetTable = defaultTableName(relation.target.id);
        lines.push(`  foreign key (${relation.field}) references ${targetTable}(${relation.target.field})${relation.onDelete ? ` on delete ${relation.onDelete.replace("_", " ")}` : ""}`);
      }
    }
  }

  return `create table ${table.table} (\n${lines.join(",\n")}\n);`;
}

export function renderIndexes(table) {
  return table.indexes
    .filter((entry) => entry.type === "index")
    .map((entry) => {
      const name = `${table.table}_${entry.fields.join("_")}_${entry.type}`;
      return `create index ${name} on ${table.table} (${entry.fields.join(", ")});`;
    });
}

export function renderAddColumn(table, column) {
  const parts = [`alter table ${table} add column ${column.name} ${column.dbType}`];
  if (column.required) {
    parts.push("not null");
  }
  if (column.defaultSql != null) {
    parts.push(`default ${column.defaultSql}`);
  }
  return `${parts.join(" ")};`;
}

export function buildDbProjectionContract(graph, projection) {
  const byId = indexStatements(graph);
  const realizedEntities = (projection.realizes || [])
    .map((ref) => byId.get(ref.id))
    .filter((statement) => statement?.kind === "entity");

  const tableMappings = new Map((projection.dbTables || []).map((entry) => [entry.entity?.id, entry.table]));
  const columnMappings = new Map((projection.dbColumns || []).map((entry) => [`${entry.entity?.id}:${entry.field}`, entry.column]));
  const relationMappings = new Map();
  for (const entry of projection.dbRelations || []) {
    if (!relationMappings.has(entry.entity?.id)) {
      relationMappings.set(entry.entity?.id, []);
    }
    relationMappings.get(entry.entity?.id).push(entry);
  }
  const lifecycleMappings = new Map();
  for (const entry of projection.dbLifecycle || []) {
    if (!lifecycleMappings.has(entry.entity?.id)) {
      lifecycleMappings.set(entry.entity?.id, []);
    }
    lifecycleMappings.get(entry.entity?.id).push(entry);
  }

  return {
    projection: {
      id: projection.id,
      name: projection.name || projection.id,
      type: projection.type || projection.type
    },
    profile: dbProfileForProjection(projection),
    generatorDefaults: generatorDefaultsMap(projection),
    tables: realizedEntities.map((entity) => {
      const tableName = tableMappings.get(entity.id) || defaultTableName(entity.id);
      const mergedKeys = mergeDbKeys(entity, projection);
      const mergedIndexes = dedupeFieldSets(mergeDbIndexes(entity, projection));
      const primaryKey = mergedKeys.find((entry) => entry.type === "primary")?.fields || [];
      const uniques = mergedKeys
        .filter((entry) => entry.type === "unique")
        .map((entry) => entry.fields);
      const indexes = mergedIndexes
        .filter((entry) => entry.type === "index" || entry.type === "unique")
        .map((entry) => ({
          type: entry.type,
          fields: entry.fields
        }));
      const relationEntries = relationMappings.get(entity.id) || entity.relations.map((relation) => ({
        field: relation.sourceField,
        target: relation.target,
        onDelete: null
      }));
      const lifecycleEntries = lifecycleMappings.get(entity.id) || [];

      return {
        type: "db_table_contract",
        entity: {
          id: entity.id,
          name: entity.name || entity.id
        },
        table: tableName,
        columns: entity.fields.map((field) => ({
          name: columnMappings.get(`${entity.id}:${field.name}`) || field.name,
          sourceField: field.name,
          fieldType: field.fieldType,
          requiredness: field.requiredness,
          defaultValue: field.defaultValue
        })),
        primaryKey,
        uniques,
        indexes,
        relations: relationEntries.map((entry) => ({
          field: entry.field || entry.sourceField,
          target: entry.target,
          onDelete: entry.onDelete || null
        })),
        lifecycle: {
          softDelete: (() => {
            const entry = lifecycleEntries.find((item) => item.lifecycleType === "soft_delete");
            return entry
              ? {
                  field: entry.field,
                  value: entry.value
                }
              : null;
          })(),
          timestamps: (() => {
            const entry = lifecycleEntries.find((item) => item.lifecycleType === "timestamps");
            return entry
              ? {
                  createdAt: entry.createdAt,
                  updatedAt: entry.updatedAt
                }
              : null;
          })()
        }
      };
    })
  };
}

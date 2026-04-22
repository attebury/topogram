import {
  buildDbProjectionContract,
  dbProjectionCandidates,
  findEnumStatement,
  getProjection,
  indexGraphStatements,
  sortFieldSets,
  sqlDefaultLiteral,
  sqlTypeForField,
  toPascalCase
} from "./shared.js";

export function normalizeDbSchemaSnapshot(contract, byId = null) {
  const engine = contract.projection.platform === "db_sqlite" ? "sqlite" : "postgres";
  const tables = [...contract.tables]
    .map((table) => ({
      table: table.table,
      entity: table.entity,
      columns: [...table.columns]
        .map((column) => ({
          name: column.name,
          sourceField: column.sourceField,
          fieldType: column.fieldType,
          dbType: sqlTypeForField(column.fieldType, engine, byId),
          required: column.requiredness === "required",
          requiredness: column.requiredness,
          defaultValue: column.defaultValue ?? null,
          defaultSql: sqlDefaultLiteral(column.defaultValue, column.fieldType, engine)
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      primaryKey: [...table.primaryKey],
      uniques: sortFieldSets(table.uniques || []),
      indexes: [...(table.indexes || [])]
        .map((entry) => ({
          type: entry.type,
          fields: [...entry.fields]
        }))
        .sort((a, b) => `${a.type}:${a.fields.join("|")}`.localeCompare(`${b.type}:${b.fields.join("|")}`)),
      relations: [...(table.relations || [])]
        .map((relation) => ({
          field: relation.field,
          target: relation.target,
          onDelete: relation.onDelete || null
        }))
        .sort((a, b) => `${a.field}:${a.target?.id || ""}:${a.target?.field || ""}`.localeCompare(`${b.field}:${b.target?.id || ""}:${b.target?.field || ""}`)),
      lifecycle: table.lifecycle
    }))
    .sort((a, b) => a.table.localeCompare(b.table));
  const enums = byId
    ? [...new Map(
        tables.flatMap((table) =>
          table.columns.flatMap((column) => {
            const enumStatement = findEnumStatement(byId, column.fieldType);
            if (!enumStatement) {
              return [];
            }
            return [[
              enumStatement.id,
              {
                id: enumStatement.id,
                typeName: toPascalCase(enumStatement.id.replace(/^enum_/, "")),
                values: [...enumStatement.values]
              }
            ]];
          })
        )
      ).values()].sort((a, b) => a.id.localeCompare(b.id))
    : [];

  return {
    type: "db_schema_snapshot",
    projection: contract.projection,
    profile: contract.profile,
    generatorDefaults: contract.generatorDefaults,
    engine,
    enums,
    tables
  };
}

export function getTableFromSnapshot(snapshot, tableName) {
  return (snapshot.tables || []).find((table) => table.table === tableName);
}

export function generateDbSchemaSnapshot(graph, options = {}) {
  const byId = indexGraphStatements(graph);
  if (options.projectionId) {
    return normalizeDbSchemaSnapshot(buildDbProjectionContract(graph, getProjection(graph, options.projectionId)), byId);
  }

  const output = {};
  for (const projection of dbProjectionCandidates(graph)) {
    output[projection.id] = normalizeDbSchemaSnapshot(buildDbProjectionContract(graph, projection), byId);
  }
  return output;
}

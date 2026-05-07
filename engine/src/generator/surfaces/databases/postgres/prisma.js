import { buildDbProjectionContract, defaultTableName, findEnumStatement, getProjection, indexGraphStatements, toPascalCase } from "../shared.js";
import { normalizeDbSchemaSnapshot } from "../snapshot.js";
import { resolvePostgresCapabilities } from "./capabilities.js";

function prismaScalarForColumn(column, byId) {
  const enumStatement = findEnumStatement(byId, column.fieldType);
  if (enumStatement) {
    return { type: toPascalCase(enumStatement.id.replace(/^enum_/, "")), enumStatement };
  }

  switch (column.fieldType) {
    case "uuid":
      return { type: "String", db: "@db.Uuid" };
    case "integer":
      return { type: "Int" };
    case "number":
      return { type: "Float" };
    case "boolean":
      return { type: "Boolean" };
    case "datetime":
      return { type: "DateTime", db: "@db.Timestamptz(3)" };
    default:
      return { type: "String" };
  }
}

function prismaDefaultForColumn(column, byId) {
  if (column.defaultValue == null) {
    return null;
  }
  if (column.fieldType === "boolean" || column.fieldType === "integer" || column.fieldType === "number") {
    return `@default(${column.defaultValue})`;
  }
  if (byId.has(column.fieldType) && byId.get(column.fieldType)?.kind === "enum") {
    return `@default(${String(column.defaultValue)})`;
  }
  return `@default("${String(column.defaultValue).replace(/"/g, '\\"')}")`;
}

export function generatePostgresPrismaSchema(graph, options = {}) {
  resolvePostgresCapabilities(options.profileId);
  const projection = getProjection(graph, options.projectionId);
  const projectionType = projection.type || projection.platform;
  if (projectionType !== "db_contract") {
    throw new Error(`Prisma schema generation currently supports db_contract projections only, found '${projectionType}'`);
  }

  const byId = indexGraphStatements(graph);
  const snapshot = normalizeDbSchemaSnapshot(buildDbProjectionContract(graph, projection));
  const enumStatements = new Map();
  for (const table of snapshot.tables) {
    for (const column of table.columns) {
      const enumStatement = findEnumStatement(byId, column.fieldType);
      if (enumStatement) {
        enumStatements.set(enumStatement.id, enumStatement);
      }
    }
  }

  const relationBackrefs = new Map();
  for (const table of snapshot.tables) {
    for (const relation of table.relations || []) {
      const targetTable = defaultTableName(relation.target.id);
      if (!relationBackrefs.has(targetTable)) {
        relationBackrefs.set(targetTable, []);
      }
      relationBackrefs.get(targetTable).push({
        fromTable: table.table,
        fromModel: toPascalCase(table.entity.id.replace(/^entity_/, "")),
        field: relation.field,
        relationName: `${toPascalCase(table.entity.id.replace(/^entity_/, ""))}_${relation.field}_to_${toPascalCase(relation.target.id.replace(/^entity_/, ""))}`
      });
    }
  }

  const lines = [];
  lines.push('generator client {');
  lines.push('  provider = "prisma-client-js"');
  lines.push("}");
  lines.push("");
  lines.push("datasource db {");
  lines.push('  provider = "postgresql"');
  lines.push('  url      = env("DATABASE_URL")');
  lines.push("}");
  lines.push("");

  for (const enumStatement of [...enumStatements.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    lines.push(`enum ${toPascalCase(enumStatement.id.replace(/^enum_/, ""))} {`);
    for (const value of enumStatement.values) {
      lines.push(`  ${value}`);
    }
    lines.push("}");
    lines.push("");
  }

  for (const table of snapshot.tables) {
    const modelName = toPascalCase(table.entity.id.replace(/^entity_/, ""));
    const pk = table.primaryKey || [];
    const relationFields = new Map((table.relations || []).map((entry) => [entry.field, entry]));

    lines.push(`model ${modelName} {`);
    for (const column of table.columns) {
      const scalar = prismaScalarForColumn(column, byId);
      const optional = column.required ? "" : "?";
      const attrs = [];
      if (pk.length === 1 && pk[0] === column.name) {
        attrs.push("@id");
      }
      const uniqueMatch = (table.uniques || []).find((fields) => fields.length === 1 && fields[0] === column.name);
      if (uniqueMatch) {
        attrs.push("@unique");
      }
      const defaultAttr = prismaDefaultForColumn(column, byId);
      if (defaultAttr) {
        attrs.push(defaultAttr);
      }
      if (scalar.db) {
        attrs.push(scalar.db);
      }
      if (column.name !== column.sourceField) {
        attrs.push(`@map("${column.name}")`);
      }
      lines.push(`  ${column.sourceField} ${scalar.type}${optional}${attrs.length > 0 ? ` ${attrs.join(" ")}` : ""}`);

      const relation = relationFields.get(column.name);
      if (relation) {
        const targetModel = toPascalCase(relation.target.id.replace(/^entity_/, ""));
        const relationName = `${modelName}_${column.sourceField}_to_${targetModel}`;
        const optionalRelation = column.required ? "" : "?";
        lines.push(`  ${column.sourceField.replace(/_id$/, "")} ${targetModel}${optionalRelation} @relation("${relationName}", fields: [${column.sourceField}], references: [${relation.target.field}])`);
      }
    }

    for (const backref of relationBackrefs.get(table.table) || []) {
      const relationFieldName = `${backref.fromTable}`;
      lines.push(`  ${relationFieldName} ${backref.fromModel}[] @relation("${backref.relationName}")`);
    }

    if (pk.length > 1) {
      lines.push(`  @@id([${pk.join(", ")}])`);
    }
    for (const fields of table.uniques || []) {
      if (fields.length > 1) {
        lines.push(`  @@unique([${fields.join(", ")}])`);
      }
    }
    for (const index of table.indexes || []) {
      if (index.type === "index") {
        lines.push(`  @@index([${index.fields.join(", ")}])`);
      }
    }
    if (table.table !== modelName) {
      lines.push(`  @@map("${table.table}")`);
    }
    lines.push("}");
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

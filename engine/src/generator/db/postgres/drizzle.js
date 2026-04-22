import { buildDbProjectionContract, defaultTableName, getProjection } from "../shared.js";
import { normalizeDbSchemaSnapshot } from "../snapshot.js";
import { resolvePostgresCapabilities } from "./capabilities.js";

function fieldSetKey(fields) {
  return fields.join("|");
}

function drizzleScalarForColumn(column) {
  switch (column.fieldType) {
    case "uuid":
      return "uuid";
    case "integer":
      return "integer";
    case "number":
      return "doublePrecision";
    case "boolean":
      return "boolean";
    case "datetime":
      return "timestamp";
    default:
      return "text";
  }
}

function drizzleColumnBuilder(column, relation, targetTableVar) {
  const fn = drizzleScalarForColumn(column);
  const args = [`"${column.name}"`];
  const chain = [];
  if (fn === "timestamp") {
    args.push('{ withTimezone: true, mode: "string" }');
  }
  if (column.required) {
    chain.push("notNull()");
  }
  if (column.defaultValue != null) {
    if (column.fieldType === "boolean" || column.fieldType === "integer" || column.fieldType === "number") {
      chain.push(`default(${column.defaultValue})`);
    } else {
      chain.push(`default("${String(column.defaultValue).replace(/"/g, '\\"')}")`);
    }
  }
  if (relation && targetTableVar) {
    const config = relation.onDelete ? `, { onDelete: "${relation.onDelete.replace("_", " ")}" }` : "";
    chain.push(`references(() => ${targetTableVar}.${relation.target.field}${config})`);
  }
  return `${fn}(${args.join(", ")})${chain.length > 0 ? `.${chain.join(".")}` : ""}`;
}

export function generatePostgresDrizzleSchema(graph, options = {}) {
  resolvePostgresCapabilities(options.profileId);
  const projection = getProjection(graph, options.projectionId);
  if (projection.platform !== "db_postgres") {
    throw new Error(`Drizzle schema generation currently supports db_postgres projections only, found '${projection.platform}'`);
  }

  const contract = buildDbProjectionContract(graph, projection);
  const snapshot = normalizeDbSchemaSnapshot(contract);
  const tableVarByName = new Map(snapshot.tables.map((table) => [table.table, `${table.table}Table`]));
  const imports = new Set(["pgTable", "text", "uuid", "integer", "doublePrecision", "boolean", "timestamp", "index", "uniqueIndex"]);
  const lines = [];

  lines.push(`import { ${[...imports].sort().join(", ")} } from "drizzle-orm/pg-core";`);
  lines.push("");

  for (const table of snapshot.tables) {
    const tableVar = tableVarByName.get(table.table);
    const relationByField = new Map((table.relations || []).map((entry) => [entry.field, entry]));
    lines.push(`export const ${tableVar} = pgTable("${table.table}", {`);
    for (const column of table.columns) {
      const relation = relationByField.get(column.name);
      const targetTableVar = relation ? tableVarByName.get(defaultTableName(relation.target.id)) : null;
      let builder = drizzleColumnBuilder(column, relation, targetTableVar);
      if (table.primaryKey.length === 1 && table.primaryKey[0] === column.name) {
        builder += ".primaryKey()";
      }
      lines.push(`  ${column.sourceField}: ${builder},`);
    }
    lines.push("}, (table) => ({");
    for (const index of table.indexes || []) {
      const fn = index.type === "unique" ? "uniqueIndex" : "index";
      const name = `${table.table}_${index.fields.join("_")}_${index.type}`;
      const refs = index.fields.map((field) => `table.${(table.columns.find((column) => column.name === field) || { sourceField: field }).sourceField}`).join(", ");
      lines.push(`  ${name}: ${fn}("${name}").on(${refs}),`);
    }
    for (const fields of table.uniques || []) {
      if (fields.length === 1 && (table.indexes || []).some((entry) => entry.type === "unique" && fieldSetKey(entry.fields) === fieldSetKey(fields))) {
        continue;
      }
      const name = `${table.table}_${fields.join("_")}_unique`;
      const refs = fields.map((field) => `table.${(table.columns.find((column) => column.name === field) || { sourceField: field }).sourceField}`).join(", ");
      lines.push(`  ${name}: uniqueIndex("${name}").on(${refs}),`);
    }
    lines.push("}));");
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

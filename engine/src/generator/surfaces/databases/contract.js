import { buildDbRealization } from "../../../realization/db/index.js";

export function generateDbContractGraph(graph, options = {}) {
  return buildDbRealization(graph, options);
}

export function generateDbContractDebug(graph, options = {}) {
  const contracts = options.projectionId ? [generateDbContractGraph(graph, options)] : Object.values(generateDbContractGraph(graph, options));
  const lines = [];

  lines.push("# DB Contract Debug");
  lines.push("");
  lines.push(`Generated from \`${graph.root}\``);
  lines.push("");

  for (const contract of contracts) {
    lines.push(`## \`${contract.projection.id}\` - ${contract.projection.name}`);
    lines.push("");
    lines.push(`Type: \`${contract.projection.type}\``);
    lines.push(`Profile: \`${contract.profile}\``);
    lines.push("");

    for (const table of contract.tables) {
      lines.push(`### \`${table.table}\` <- \`${table.entity.id}\``);
      lines.push("");
      lines.push("Columns:");
      for (const column of table.columns) {
        lines.push(`- \`${column.name}\` <- \`${column.sourceField}\` : \`${column.fieldType}\` ${column.requiredness}`);
      }
      lines.push(`Primary key: ${table.primaryKey.length > 0 ? table.primaryKey.map((field) => `\`${field}\``).join(", ") : "_none_"}`);
      lines.push(`Unique: ${table.uniques.length > 0 ? table.uniques.map((fields) => `[${fields.join(", ")}]`).join(", ") : "_none_"}`);
      lines.push(`Indexes: ${table.indexes.length > 0 ? table.indexes.map((entry) => `${entry.type}[${entry.fields.join(", ")}]`).join(", ") : "_none_"}`);
      lines.push(`Relations: ${table.relations.length > 0 ? table.relations.map((entry) => `\`${entry.field}\` -> \`${entry.target?.id}.${entry.target?.field}\`${entry.onDelete ? ` on_delete ${entry.onDelete}` : ""}`).join(", ") : "_none_"}`);
      lines.push(`Lifecycle: ${table.lifecycle.softDelete ? `soft_delete(${table.lifecycle.softDelete.field}=${table.lifecycle.softDelete.value})` : "_none_"}${table.lifecycle.timestamps ? `, timestamps(${table.lifecycle.timestamps.createdAt}, ${table.lifecycle.timestamps.updatedAt})` : ""}`);
      lines.push("");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

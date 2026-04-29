import { buildDbMigrationPlan } from "../migration-plan.js";
import { generateDbSchemaSnapshot, getTableFromSnapshot } from "../snapshot.js";
import {
  renderAddColumn,
  renderCreateTable
} from "../shared.js";
import { resolveSqliteCapabilities } from "./capabilities.js";

function renderSqlMigration(plan, snapshot) {
  if (!plan.supported) {
    throw new Error(`Migration plan for '${plan.projection.id}' requires manual intervention`);
  }

  const statements = [];
  for (const operation of plan.operations) {
    if (operation.type === "create_enum" || operation.type === "add_enum_value") {
      continue;
    }

    if (operation.type === "create_table") {
      const table = getTableFromSnapshot(snapshot, operation.table);
      statements.push(renderCreateTable(table, "sqlite"));
      continue;
    }

    if (operation.type === "add_column") {
      const table = getTableFromSnapshot(snapshot, operation.table);
      const column = table?.columns.find((entry) => entry.name === operation.column);
      statements.push(renderAddColumn(operation.table, column));
      continue;
    }

    if (operation.type === "add_unique_constraint") {
      statements.push(`alter table ${operation.table} add unique (${operation.fields.join(", ")});`);
      continue;
    }

    if (operation.type === "add_index" || operation.type === "add_unique_index") {
      const unique = operation.type === "add_unique_index" ? "unique " : "";
      const name = `${operation.table}_${operation.fields.join("_")}_${operation.type === "add_unique_index" ? "unique" : "index"}`;
      statements.push(`create ${unique}index ${name} on ${operation.table} (${operation.fields.join(", ")});`);
      continue;
    }

    if (operation.type === "add_foreign_key") {
      continue;
    }
  }

  return `${statements.join("\n\n").trimEnd()}\n`;
}

export function generateSqliteSqlMigration(graph, options = {}) {
  resolveSqliteCapabilities(options.profileId);
  if (!options.projectionId) {
    throw new Error("sql-migration requires --projection");
  }
  if (!options.fromSnapshot) {
    throw new Error("sql-migration requires --from-snapshot");
  }

  const toSnapshot = generateDbSchemaSnapshot(graph, options);
  const plan = buildDbMigrationPlan(options.fromSnapshot, toSnapshot, options);
  return renderSqlMigration({ ...plan, graph }, toSnapshot);
}

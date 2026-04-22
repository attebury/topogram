import { buildDbMigrationPlan } from "../migration-plan.js";
import { generateDbSchemaSnapshot, getTableFromSnapshot } from "../snapshot.js";
import {
  defaultTableName,
  indexGraphStatements,
  renderAddColumn,
  renderAddEnumValue,
  renderCreateEnumType,
  renderCreateTable
} from "../shared.js";
import { resolvePostgresCapabilities } from "./capabilities.js";

function renderSqlMigration(plan, snapshot) {
  if (!plan.supported) {
    throw new Error(`Migration plan for '${plan.projection.id}' requires manual intervention`);
  }

  const statements = [];
  const byId = plan.graph ? indexGraphStatements(plan.graph) : null;
  const enumsById = new Map((snapshot.enums || []).map((entry) => [entry.id, entry]));
  const createdTables = new Set();
  const pendingForeignKeys = [];
  for (const operation of plan.operations) {
    if (operation.type === "create_enum") {
      const enumStatement = enumsById.get(operation.enum) || (byId ? byId.get(operation.enum) : null);
      if (enumStatement) {
        statements.push(renderCreateEnumType(enumStatement));
      }
      continue;
    }

    if (operation.type === "add_enum_value") {
      const enumStatement = enumsById.get(operation.enum) || (byId ? byId.get(operation.enum) : null);
      if (enumStatement) {
        statements.push(renderAddEnumValue(enumStatement, operation));
      }
      continue;
    }

    if (operation.type === "create_table") {
      const table = getTableFromSnapshot(snapshot, operation.table);
      createdTables.add(operation.table);
      statements.push(renderCreateTable(table, "postgres", { includeRelations: false, byId }));
      for (const relation of table?.relations || []) {
        if (relation.target?.id && relation.target?.field) {
          pendingForeignKeys.push({
            table: operation.table,
            field: relation.field,
            target: relation.target,
            onDelete: relation.onDelete || null
          });
        }
      }
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
      const targetTable = defaultTableName(operation.target.id);
      statements.push(`alter table ${operation.table} add foreign key (${operation.field}) references ${targetTable}(${operation.target.field})${operation.onDelete ? ` on delete ${operation.onDelete.replace("_", " ")}` : ""};`);
    }
  }

  for (const relation of pendingForeignKeys) {
    const targetTable = defaultTableName(relation.target.id);
    statements.push(`alter table ${relation.table} add foreign key (${relation.field}) references ${targetTable}(${relation.target.field})${relation.onDelete ? ` on delete ${relation.onDelete.replace("_", " ")}` : ""};`);
  }

  return `${statements.join("\n\n").trimEnd()}\n`;
}

export function generatePostgresSqlMigration(graph, options = {}) {
  resolvePostgresCapabilities(options.profileId);
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

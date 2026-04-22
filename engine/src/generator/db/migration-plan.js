import { generateDbSchemaSnapshot } from "./snapshot.js";

function fieldSetKey(fields) {
  return fields.join("|");
}

function relationKey(relation) {
  return `${relation.field}:${relation.target?.id || ""}:${relation.target?.field || ""}:${relation.onDelete || ""}`;
}

function findInsertedEnumValues(previousValues, nextValues) {
  const previousSet = new Set(previousValues);
  const inserted = [];
  let previousIndex = 0;

  for (const value of nextValues) {
    if (previousIndex < previousValues.length && previousValues[previousIndex] === value) {
      previousIndex += 1;
      continue;
    }
    if (previousSet.has(value)) {
      return null;
    }
    inserted.push(value);
  }

  if (previousIndex !== previousValues.length) {
    return null;
  }

  return inserted;
}

function enumPlacement(nextValues, value, previousValues) {
  const index = nextValues.indexOf(value);
  for (let cursor = index + 1; cursor < nextValues.length; cursor += 1) {
    const candidate = nextValues[cursor];
    if (previousValues.includes(candidate)) {
      return { before: candidate, after: null };
    }
  }
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const candidate = nextValues[cursor];
    if (previousValues.includes(candidate)) {
      return { before: null, after: candidate };
    }
  }
  return { before: null, after: null };
}

export function buildDbMigrationPlan(fromSnapshot, toSnapshot, options = {}) {
  const operations = [];
  const manual = [];
  const fromEnums = new Map((fromSnapshot.enums || []).map((entry) => [entry.id, entry]));
  const toEnums = new Map((toSnapshot.enums || []).map((entry) => [entry.id, entry]));
  const fromTables = new Map((fromSnapshot.tables || []).map((table) => [table.table, table]));
  const toTables = new Map((toSnapshot.tables || []).map((table) => [table.table, table]));

  for (const enumEntry of toSnapshot.enums || []) {
    const previous = fromEnums.get(enumEntry.id);
    if (!previous) {
      operations.push({
        type: "create_enum",
        enum: enumEntry.id,
        values: [...enumEntry.values]
      });
      continue;
    }

    const inserted = findInsertedEnumValues(previous.values || [], enumEntry.values || []);
    if (inserted == null) {
      manual.push({
        type: "alter_enum",
        enum: enumEntry.id,
        reason: "Enum values changed in a non-additive way"
      });
      continue;
    }

    for (const value of inserted) {
      const placement = enumPlacement(enumEntry.values || [], value, previous.values || []);
      operations.push({
        type: "add_enum_value",
        enum: enumEntry.id,
        value,
        before: placement.before,
        after: placement.after
      });
    }
  }

  for (const enumEntry of fromSnapshot.enums || []) {
    if (!toEnums.has(enumEntry.id)) {
      manual.push({
        type: "drop_enum",
        enum: enumEntry.id,
        reason: "Dropping enums is not generated automatically"
      });
    }
  }

  for (const table of toSnapshot.tables || []) {
    const previous = fromTables.get(table.table);
    if (!previous) {
      operations.push({
        type: "create_table",
        table: table.table,
        entity: table.entity?.id || null
      });
      for (const index of table.indexes || []) {
        if (index.type !== "index") {
          continue;
        }
        operations.push({
          type: "add_index",
          table: table.table,
          fields: index.fields
        });
      }
      continue;
    }

    const previousColumns = new Map((previous.columns || []).map((column) => [column.name, column]));
    const nextColumns = new Map((table.columns || []).map((column) => [column.name, column]));

    for (const column of table.columns || []) {
      const previousColumn = previousColumns.get(column.name);
      if (!previousColumn) {
        operations.push({
          type: "add_column",
          table: table.table,
          column: column.name
        });
        continue;
      }

      const changed =
        previousColumn.sourceField !== column.sourceField ||
        previousColumn.fieldType !== column.fieldType ||
        previousColumn.dbType !== column.dbType ||
        previousColumn.required !== column.required ||
        previousColumn.defaultSql !== column.defaultSql;

      if (changed) {
        manual.push({
          type: "alter_column",
          table: table.table,
          column: column.name,
          reason: "Column definition changed in a non-additive way"
        });
      }
    }

    for (const column of previous.columns || []) {
      if (!nextColumns.has(column.name)) {
        manual.push({
          type: "drop_column",
          table: table.table,
          column: column.name,
          reason: "Dropping columns is not generated automatically"
        });
      }
    }

    const previousUniqueKeys = new Set((previous.uniques || []).map(fieldSetKey));
    const nextUniqueKeys = new Set((table.uniques || []).map(fieldSetKey));
    for (const unique of table.uniques || []) {
      const key = fieldSetKey(unique);
      if (!previousUniqueKeys.has(key)) {
        operations.push({
          type: "add_unique_constraint",
          table: table.table,
          fields: unique
        });
      }
    }
    for (const unique of previous.uniques || []) {
      const key = fieldSetKey(unique);
      if (!nextUniqueKeys.has(key)) {
        manual.push({
          type: "drop_unique_constraint",
          table: table.table,
          fields: unique,
          reason: "Dropping unique constraints is not generated automatically"
        });
      }
    }

    const previousIndexes = new Set((previous.indexes || []).map((entry) => `${entry.type}:${fieldSetKey(entry.fields)}`));
    const nextIndexes = new Set((table.indexes || []).map((entry) => `${entry.type}:${fieldSetKey(entry.fields)}`));
    for (const index of table.indexes || []) {
      const key = `${index.type}:${fieldSetKey(index.fields)}`;
      if (!previousIndexes.has(key)) {
        if (index.type !== "index") {
          continue;
        }
        operations.push({
          type: "add_index",
          table: table.table,
          fields: index.fields
        });
      }
    }
    for (const index of previous.indexes || []) {
      const key = `${index.type}:${fieldSetKey(index.fields)}`;
      if (!nextIndexes.has(key)) {
        manual.push({
          type: "drop_index",
          table: table.table,
          fields: index.fields,
          reason: "Dropping indexes is not generated automatically"
        });
      }
    }

    const previousRelations = new Set((previous.relations || []).map(relationKey));
    const nextRelations = new Set((table.relations || []).map(relationKey));
    for (const relation of table.relations || []) {
      const key = relationKey(relation);
      if (!previousRelations.has(key)) {
        operations.push({
          type: "add_foreign_key",
          table: table.table,
          field: relation.field,
          target: relation.target,
          onDelete: relation.onDelete || null
        });
      }
    }
    for (const relation of previous.relations || []) {
      const key = relationKey(relation);
      if (!nextRelations.has(key)) {
        manual.push({
          type: "drop_foreign_key",
          table: table.table,
          field: relation.field,
          reason: "Dropping or changing foreign keys is not generated automatically"
        });
      }
    }
  }

  for (const table of fromSnapshot.tables || []) {
    if (!toTables.has(table.table)) {
      manual.push({
        type: "drop_table",
        table: table.table,
        reason: "Dropping tables is not generated automatically"
      });
    }
  }

  return {
    type: "db_migration_plan",
    projection: toSnapshot.projection,
    engine: toSnapshot.engine,
    from: {
      snapshotPath: options.fromSnapshotPath || null,
      tableCount: (fromSnapshot.tables || []).length
    },
    to: {
      tableCount: (toSnapshot.tables || []).length
    },
    supported: manual.length === 0,
    operations,
    manualInterventionRequired: manual.length > 0,
    manual
  };
}

export function generateDbMigrationPlan(graph, options = {}) {
  if (!options.projectionId) {
    throw new Error("db-migration-plan requires --projection");
  }
  if (!options.fromSnapshot) {
    throw new Error("db-migration-plan requires --from-snapshot");
  }

  const toSnapshot = generateDbSchemaSnapshot(graph, options);
  return buildDbMigrationPlan(options.fromSnapshot, toSnapshot, options);
}

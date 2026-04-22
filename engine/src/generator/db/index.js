import {
  generateDbContractDebug,
  generateDbContractGraph
} from "./contract.js";
import { generateDbLifecyclePlan } from "./lifecycle-shared.js";
import { generateDbSchemaSnapshot } from "./snapshot.js";
import { generateDbMigrationPlan } from "./migration-plan.js";
import { getDbFamily } from "./shared.js";
import {
  generatePostgresDbLifecycleBundle,
  generatePostgresDbLifecyclePlan,
  generatePostgresDrizzleSchema,
  generatePostgresPrismaSchema,
  generatePostgresSqlMigration,
  generatePostgresSqlSchema
} from "./postgres/index.js";
import {
  generateSqliteDbLifecycleBundle,
  generateSqliteDbLifecyclePlan,
  generateSqlitePrismaSchema,
  generateSqliteSqlMigration,
  generateSqliteSqlSchema
} from "./sqlite/index.js";

export function generateDbTarget(target, graph, options = {}) {
  const family = getDbFamily(options);

  if (target === "db-contract-graph") {
    return generateDbContractGraph(graph, options);
  }
  if (target === "db-contract-debug") {
    return generateDbContractDebug(graph, options);
  }
  if (target === "db-schema-snapshot") {
    return generateDbSchemaSnapshot(graph, options);
  }
  if (target === "db-migration-plan") {
    return generateDbMigrationPlan(graph, options);
  }
  if (target === "sql-schema") {
    return family === "sqlite"
      ? generateSqliteSqlSchema(graph, options)
      : generatePostgresSqlSchema(graph, options);
  }
  if (target === "sql-migration") {
    return family === "sqlite"
      ? generateSqliteSqlMigration(graph, options)
      : generatePostgresSqlMigration(graph, options);
  }
  if (target === "db-lifecycle-plan") {
    if (!options.projectionId) {
      return generateDbLifecyclePlan(graph, options);
    }
    return family === "sqlite"
      ? generateSqliteDbLifecyclePlan(graph, options)
      : generatePostgresDbLifecyclePlan(graph, options);
  }
  if (target === "db-lifecycle-bundle") {
    return family === "sqlite"
      ? generateSqliteDbLifecycleBundle(graph, options)
      : generatePostgresDbLifecycleBundle(graph, options);
  }
  if (target === "prisma-schema") {
    return family === "sqlite"
      ? generateSqlitePrismaSchema(graph, options)
      : generatePostgresPrismaSchema(graph, options);
  }
  if (target === "drizzle-schema") {
    return generatePostgresDrizzleSchema(graph, options);
  }

  throw new Error(`Unsupported DB generator target '${target}'`);
}

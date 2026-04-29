import { generateDbMigrationPlan } from "../../generator/surfaces/databases/migration-plan.js";

export function buildDbMigrationPlanRealization(graph, options = {}) {
  return generateDbMigrationPlan(graph, options);
}

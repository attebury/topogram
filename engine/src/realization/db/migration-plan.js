import { generateDbMigrationPlan } from "../../generator/db/migration-plan.js";

export function buildDbMigrationPlanRealization(graph, options = {}) {
  return generateDbMigrationPlan(graph, options);
}

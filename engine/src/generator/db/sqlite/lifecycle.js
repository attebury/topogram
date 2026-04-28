import {
  generateDbLifecycleBundleForProjection,
  generateDbLifecyclePlanForProjection
} from "../lifecycle-shared.js";
import { getProjection } from "../shared.js";
import { resolveSqliteCapabilities } from "./capabilities.js";

export function generateSqliteDbLifecyclePlan(graph, options = {}) {
  resolveSqliteCapabilities(options.profileId);
  return generateDbLifecyclePlanForProjection(graph, getProjection(graph, options.projectionId), options);
}

export function generateSqliteDbLifecycleBundle(graph, options = {}) {
  resolveSqliteCapabilities(options.profileId);
  return generateDbLifecycleBundleForProjection(graph, getProjection(graph, options.projectionId), options);
}

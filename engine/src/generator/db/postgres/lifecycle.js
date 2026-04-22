import {
  generateDbLifecycleBundleForProjection,
  generateDbLifecyclePlanForProjection
} from "../lifecycle-shared.js";
import { getProjection } from "../shared.js";
import { resolvePostgresCapabilities } from "./capabilities.js";

export function generatePostgresDbLifecyclePlan(graph, options = {}) {
  resolvePostgresCapabilities(options.profileId);
  return generateDbLifecyclePlanForProjection(graph, getProjection(graph, options.projectionId));
}

export function generatePostgresDbLifecycleBundle(graph, options = {}) {
  resolvePostgresCapabilities(options.profileId);
  return generateDbLifecycleBundleForProjection(graph, getProjection(graph, options.projectionId));
}

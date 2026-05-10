// @ts-check

export { buildBundleAdoptionPlan } from "./impacts/adoption-plan.js";
export {
  buildCanonicalShapeIndex,
  buildProjectionEntityIndex,
  capabilityEntityTargets,
  projectionKindForImpact,
  shapeFieldSignature
} from "./impacts/indexes.js";
export { buildProjectionPatchCandidates } from "./impacts/patches.js";
export {
  buildProjectionImpacts,
  buildUiImpacts,
  buildWorkflowImpacts
} from "./impacts/reports.js";

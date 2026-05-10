// @ts-check

export { ADOPT_SELECTORS, buildAdoptionPlan } from "./adoption-plan/build.js";
export {
  adoptionStatusForStep,
  blockingDependenciesForProjectionImpacts,
  blockingDependenciesForUiImpacts,
  blockingDependenciesForWorkflowImpacts,
  projectionImpactsForAdoptionItem
} from "./adoption-plan/dependencies.js";
export {
  buildCanonicalAdoptionOutputs,
  buildPromotedCanonicalItems,
  readAdoptionPlan
} from "./adoption-plan/outputs.js";
export {
  canonicalDisplayPathForItem,
  canonicalRelativePathForItem,
  candidateSourcePathForItem
} from "./adoption-plan/paths.js";
export {
  applyProjectionAuthPatchToTopogram,
  ensureProjectionBlock,
  ensureProjectionRealizes
} from "./adoption-plan/projection-patches.js";
export {
  formatDocDriftSummaryInline,
  formatDocLinkSuggestionInline,
  formatDocMetadataPatchInline,
  reasonForAdoptionItem,
  recommendationForAdoptionItem
} from "./adoption-plan/reasons.js";

// @ts-check

export {
  annotateBundleAuthHintClosures,
  buildAuthHintClosureSummary,
  summarizeHintClosureState
} from "./auth/closures.js";
export {
  authClaimPatternMatches,
  buildAuthClaimReviewGuidance,
  buildAuthOwnershipReviewGuidance,
  buildAuthPermissionReviewGuidance,
  buildAuthRoleReviewGuidance,
  collectAuthClaimSignalMatches,
  describeAuthClaimWhyInferred,
  describeAuthOwnershipWhyInferred,
  describeAuthPermissionWhyInferred,
  formatAuthClaimHintInline,
  formatAuthClaimValueInline,
  formatAuthOwnershipHintInline,
  formatAuthPermissionHintInline,
  formatAuthRoleFollowupInline,
  formatAuthRoleGuidanceInline
} from "./auth/formatters.js";
export {
  inferBundleAuthClaimHints,
  inferBundleAuthOwnershipHints,
  inferBundleAuthPermissionHints,
  inferPermissionActionForCapability,
  permissionResourceStemForCapability,
  singularizePermissionResource
} from "./auth/inference.js";
export {
  annotateDocLinkSuggestionsWithAuthRoleGuidance,
  classifyBundleAuthRoleGuidance,
  inferBundleAuthRoleGuidance
} from "./auth/roles.js";

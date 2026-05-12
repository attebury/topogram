// @ts-check

export { relativeTo } from "../../path-helpers.js";
export {
  canonicalCandidateTerm,
  ensureTrailingNewline,
  idHintify,
  pluralizeCandidateTerm,
  slugify,
  titleCase,
  makeCandidateRecord,
  dedupeCandidateRecords,
  normalizePrismaType
} from "./shared/candidates.js";
export {
  DEFAULT_IGNORED_DIRS,
  readTextIfExists,
  readJsonIfExists,
  listFilesRecursive,
  importSearchRoots,
  normalizeImportRelativePath,
  importSourcePathRelativeToWorkspace,
  classifyImportSourcePath,
  isPrimaryImportSource,
  canonicalSourceRank,
  selectPreferredImportFiles,
  findImportFiles,
  findPrimaryImportFiles
} from "./shared/files.js";
export {
  normalizeOpenApiPath,
  normalizeEndpointPathForMatch,
  nonParamEndpointSegments,
  inferApiEntityIdFromPath,
  inferApiCapabilityIdFromOperation,
  inferRouteCapabilityId,
  inferCapabilityEntityId
} from "./shared/api-routes.js";
export {
  routeSegments,
  screenKindForRoute,
  screenIdForRoute,
  uiCapabilityHintsForRoute,
  entityIdForRoute,
  inferNonResourceUiFlow,
  uiFlowIdForRoute,
  proposedUiContractAdditionsForFlow,
  inferReactRoutes,
  inferSvelteRoutes,
  inferNavigationStructure,
  shellKindFromNavigation,
  navigationPatternsFromStructure,
  detectUiPresentationFeatures
} from "./shared/ui-routes.js";
export {
  inferNextAppRoutes,
  nextScreenKindForRoute,
  nextScreenIdForRoute,
  entityIdForNextRoute,
  conceptIdForNextRoute,
  uiCapabilityHintsForNextRoute,
  inferRouteQueryParams,
  inferRouteAuthHint,
  extractNamedExportBlock,
  inferNextRequestSearchParams,
  inferNextJsonFields,
  extractHandlerContext,
  nextAppRoutePathFromFile,
  inferFormDataFields,
  inferInputNames,
  inferNextApiRoutes,
  inferNextServerActionCapabilities,
  inferNextAuthCapabilities
} from "./shared/next-app.js";

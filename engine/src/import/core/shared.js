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
  canonicalSourceRank,
  selectPreferredImportFiles,
  findImportFiles
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

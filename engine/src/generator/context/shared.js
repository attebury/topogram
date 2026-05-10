// @ts-check

export {
  docIds,
  refIds,
  stableSortedStrings
} from "./shared/primitives.js";
export {
  summarizeProjection,
  summarizeRule,
  summarizeStatement,
  summarizeVerification,
  reviewBoundaryForCapability,
  reviewBoundaryForProjection,
  reviewBoundaryForEntity,
  graphCounts
} from "./shared/summaries.js";
export {
  summarizeDoc,
  summarizeById,
  summarizeStatementsByIds,
  summarizeDocsByIds,
  workspaceInventory
} from "./shared/relationships.js";
export {
  relatedJourneysForCapability,
  relatedWorkflowDocsForCapability,
  relatedRulesForTarget,
  relatedProjectionsForCapability,
  relatedCapabilitiesForEntity,
  relatedShapesForEntity,
  relatedProjectionsForEntity,
  relatedCapabilitiesForProjection,
  relatedEntitiesForProjection,
  relatedShapesForProjection,
  relatedProjectionsForShape,
  widgetById,
  relatedWidgetsForProjection,
  relatedShapesForWidget,
  relatedProjectionsForWidget,
  verificationIdsForTarget,
  ensureContextSelection,
  buildIndexes
} from "./shared/relationships.js";
export {
  domainById,
  summarizeDomain,
  domainsByStatement,
  relatedCapabilitiesForDomain,
  relatedEntitiesForDomain,
  relatedRulesForDomain,
  relatedVerificationsForDomain,
  relatedProjectionsForDomain,
  pitchById,
  requirementById,
  acceptanceCriterionById,
  taskById,
  bugById,
  documentById,
  summarizePitch,
  summarizeRequirement,
  summarizeAcceptanceCriterion,
  summarizeTask,
  summarizeBug,
  summarizeDocument,
  getWorkflowDoc,
  getJourneyDoc,
  getStatement
} from "./shared/domain-sdlc.js";
export {
  repoRootFromGraph,
  readLocalMaintainedProofMetadata,
  buildMaintainedBoundaryArtifact,
  buildLocalMaintainedBoundaryArtifact,
  maintainedProofMetadata,
  buildMaintainedSeams,
  buildMaintainedOutputs,
  relativePathFromGraph
} from "./shared/maintained-boundary.js";
export {
  jsonByteSize,
  jsonLineCount,
  percentOf,
  buildDefaultWriteScope,
  buildMaintainedWriteScope,
  recommendedVerificationTargets
} from "./shared/metrics.js";

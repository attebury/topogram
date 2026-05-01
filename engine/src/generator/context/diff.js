import { parsePath } from "../../parser.js";
import { resolveWorkspace } from "../../resolver.js";
import {
  buildMaintainedOutputs,
  buildMaintainedSeams,
  maintainedProofMetadata,
  relatedCapabilitiesForEntity,
  relatedProjectionsForCapability,
  relatedProjectionsForComponent,
  relatedProjectionsForEntity,
  stableSortedStrings,
  summarizeById,
  summarizeDoc,
  summarizeStatement
} from "./shared.js";
import { defaultOwnershipBoundary } from "../../policy/review-boundaries.js";

function normalizeTargetMap(graph, kind) {
  if (kind === "workflow" || kind === "journey") {
    const docs = (graph.docs || []).filter((doc) => doc.kind === kind);
    return new Map(docs.map((doc) => [doc.id, summarizeDoc(doc)]));
  }

  return new Map(((graph.byKind[kind] || []).map((statement) => [statement.id, summarizeStatement(statement)])));
}

function diffMaps(currentMap, baselineMap) {
  const ids = stableSortedStrings([...currentMap.keys(), ...baselineMap.keys()]);
  const output = [];

  for (const id of ids) {
    const current = currentMap.get(id);
    const baseline = baselineMap.get(id);
    if (!baseline && current) {
      output.push({
        id,
        classification: "additive",
        current
      });
      continue;
    }
    if (baseline && !current) {
      output.push({
        id,
        classification: "removed",
        baseline
      });
      continue;
    }

    const currentJson = JSON.stringify(current);
    const baselineJson = JSON.stringify(baseline);
    if (currentJson === baselineJson) {
      continue;
    }

    const currentBoundary = current?.reviewBoundary || current?.review_boundary || null;
    const baselineBoundary = baseline?.reviewBoundary || baseline?.review_boundary || null;
    const classification =
      JSON.stringify(currentBoundary) !== JSON.stringify(baselineBoundary) ? "review_boundary_changed" : "modified";

    output.push({
      id,
      classification,
      current,
      baseline
    });
  }

  return output;
}

function changedIdsForDiffSections(diff) {
  const sectionNames = [
    "entities",
    "enums",
    "shapes",
    "capabilities",
    "rules",
    "workflows",
    "projections",
    "components",
    "journeys",
    "verifications"
  ];
  const ids = [];
  for (const section of sectionNames) {
    ids.push(...(diff[section] || []).map((entry) => entry.id));
  }
  return stableSortedStrings(ids);
}

function collectAffectedProjectionIds(graph, diff) {
  const changedCapabilities = stableSortedStrings((diff.capabilities || []).map((entry) => entry.id));
  const changedEntities = stableSortedStrings((diff.entities || []).map((entry) => entry.id));
  const changedProjections = stableSortedStrings((diff.projections || []).map((entry) => entry.id));
  const changedComponents = stableSortedStrings((diff.components || []).map((entry) => entry.id));

  return stableSortedStrings([
    ...changedProjections,
    ...changedCapabilities.flatMap((id) => relatedProjectionsForCapability(graph, id)),
    ...changedEntities.flatMap((id) => relatedProjectionsForEntity(graph, id)),
    ...changedComponents.flatMap((id) => relatedProjectionsForComponent(graph, id))
  ]);
}

function collectAffectedCapabilityIds(graph, diff) {
  const changedCapabilities = stableSortedStrings((diff.capabilities || []).map((entry) => entry.id));
  const changedEntities = stableSortedStrings((diff.entities || []).map((entry) => entry.id));
  return stableSortedStrings([
    ...changedCapabilities,
    ...changedEntities.flatMap((id) => relatedCapabilitiesForEntity(graph, id))
  ]);
}

function collectAffectedVerificationIds(graph, diff) {
  const changedIds = changedIdsForDiffSections(diff);
  const explicitVerificationIds = stableSortedStrings((diff.verifications || []).map((entry) => entry.id));
  const affected = (graph.byKind.verification || [])
    .filter((verification) => (verification.validates || []).some((target) => changedIds.includes(target.id)))
    .map((verification) => verification.id);
  return stableSortedStrings([...explicitVerificationIds, ...affected]);
}

function reviewBoundaryChanges(diff) {
  const sectionNames = [
    "entities",
    "capabilities",
    "workflows",
    "projections",
    "journeys"
  ];
  return sectionNames.flatMap((section) =>
    (diff[section] || [])
      .filter((entry) => entry.classification === "review_boundary_changed")
      .map((entry) => ({
        kind: section.slice(0, -1),
        id: entry.id,
        baseline: entry.baseline?.reviewBoundary || entry.baseline?.review_boundary || null,
        current: entry.current?.reviewBoundary || entry.current?.review_boundary || null
      }))
  );
}

function loadBaselineGraph(fromTopogramPath) {
  if (!fromTopogramPath) {
    throw new Error("context-diff requires --from-topogram <path>");
  }

  const parsed = parsePath(fromTopogramPath);
  const resolved = resolveWorkspace(parsed);
  if (!resolved.ok) {
    throw Object.assign(new Error("Failed to resolve baseline Topogram"), { validation: resolved.validation });
  }

  return resolved.graph;
}

export function generateContextDiff(graph, options = {}) {
  const baselineGraph = loadBaselineGraph(options.fromTopogramPath);
  const diff = {
    entities: diffMaps(normalizeTargetMap(graph, "entity"), normalizeTargetMap(baselineGraph, "entity")),
    enums: diffMaps(normalizeTargetMap(graph, "enum"), normalizeTargetMap(baselineGraph, "enum")),
    shapes: diffMaps(normalizeTargetMap(graph, "shape"), normalizeTargetMap(baselineGraph, "shape")),
    capabilities: diffMaps(normalizeTargetMap(graph, "capability"), normalizeTargetMap(baselineGraph, "capability")),
    rules: diffMaps(normalizeTargetMap(graph, "rule"), normalizeTargetMap(baselineGraph, "rule")),
    workflows: diffMaps(normalizeTargetMap(graph, "workflow"), normalizeTargetMap(baselineGraph, "workflow")),
    projections: diffMaps(normalizeTargetMap(graph, "projection"), normalizeTargetMap(baselineGraph, "projection")),
    components: diffMaps(normalizeTargetMap(graph, "component"), normalizeTargetMap(baselineGraph, "component")),
    journeys: diffMaps(normalizeTargetMap(graph, "journey"), normalizeTargetMap(baselineGraph, "journey")),
    verifications: diffMaps(normalizeTargetMap(graph, "verification"), normalizeTargetMap(baselineGraph, "verification"))
  };
  const affectedCapabilities = collectAffectedCapabilityIds(graph, diff);
  const affectedProjections = collectAffectedProjectionIds(graph, diff);
  const affectedVerifications = collectAffectedVerificationIds(graph, diff);
  const changedSemanticIds = changedIdsForDiffSections(diff);
  const affectedMaintainedStories = maintainedProofMetadata(graph).filter((item) => {
    const emittedDependencies = item.emittedDependencies || [];
    return emittedDependencies.includes("maintained-proof-package") || emittedDependencies.some((dependency) => changedSemanticIds.includes(dependency));
  });
  const affectedMaintainedSeams = buildMaintainedSeams(affectedMaintainedStories);
  const affectedMaintainedOutputs = buildMaintainedOutputs({
    seams: affectedMaintainedSeams,
    proofStories: affectedMaintainedStories,
    ownershipBoundary: defaultOwnershipBoundary(),
    graph
  });
  const reviewBoundaryChangeItems = reviewBoundaryChanges(diff);

  return {
    type: "context_diff",
    version: 1,
    current_root: graph.root,
    baseline_root: baselineGraph.root,
    ownership_boundary: defaultOwnershipBoundary(),
    ...diff,
    affected_generated_surfaces: {
      capabilities: affectedCapabilities.map((id) => summarizeById(graph, id)).filter(Boolean),
      projections: affectedProjections.map((id) => summarizeById(graph, id)).filter(Boolean),
      workflows: stableSortedStrings((diff.workflows || []).map((entry) => entry.id)).map((id) => summarizeById(graph, id) || summarizeById(baselineGraph, id)).filter(Boolean),
      journeys: stableSortedStrings((diff.journeys || []).map((entry) => entry.id)).map((id) => summarizeById(graph, id) || summarizeById(baselineGraph, id)).filter(Boolean)
    },
    affected_maintained_surfaces: {
      ownership_interpretation: {
        generated_only_impact: affectedMaintainedStories.length === 0,
        maintained_code_impact: affectedMaintainedStories.length > 0,
        human_review_required_impact: affectedMaintainedStories.some((item) => item.reviewBoundary?.automation_class !== "safe")
      },
      maintained_files_in_scope: stableSortedStrings(affectedMaintainedStories.flatMap((item) => item.maintainedFiles || [])),
      outputs: affectedMaintainedOutputs,
      affected_seams: affectedMaintainedSeams,
      proof_stories: affectedMaintainedStories.map((item) => ({
        classification: item.classification,
        relativePath: item.relativePath,
        maintained_files: item.maintainedFiles || [],
        review_boundary: item.reviewBoundary
      }))
    },
    affected_verifications: affectedVerifications.map((id) => summarizeById(graph, id) || summarizeById(baselineGraph, id)).filter(Boolean),
    review_boundary_changes: reviewBoundaryChangeItems
  };
}

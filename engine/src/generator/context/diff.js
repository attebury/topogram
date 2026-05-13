import { parsePath } from "../../parser.js";
import { resolveWorkspace } from "../../resolver.js";
import {
  buildMaintainedOutputs,
  buildMaintainedSeams,
  maintainedProofMetadata,
  relatedCapabilitiesForEntity,
  relatedProjectionsForCapability,
  relatedProjectionsForWidget,
  relatedProjectionsForEntity,
  stableSortedStrings,
  summarizeById,
  summarizeDoc,
  summarizeStatement
} from "./shared.js";
import { defaultOwnershipBoundary } from "../../policy/review-boundaries.js";

function normalizeTargetMap(graph, kind) {
  if (kind === "workflow") {
    const docs = (graph.docs || []).filter((doc) => doc.kind === kind);
    return new Map(docs.map((doc) => [doc.id, summarizeDoc(doc)]));
  }
  if (kind === "journey") {
    const journeys = [
      ...(graph.byKind?.journey || []).map((statement) => summarizeStatement(statement)),
      ...(graph.docs || []).filter((doc) => doc.kind === kind).map((doc) => summarizeDoc(doc))
    ];
    return new Map(journeys.map((journey) => [journey.id, journey]));
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
    "widgets",
    "journeys",
    "verifications",
    "domains",
    "pitches",
    "requirements",
    "acceptance_criteria",
    "tasks",
    "bugs"
  ];
  const ids = [];
  for (const section of sectionNames) {
    ids.push(...(diff[section] || []).map((entry) => entry.id));
  }
  return stableSortedStrings(ids);
}

function collectAffectedProjectionIds(graph, baselineGraph, diff) {
  const changedCapabilities = stableSortedStrings((diff.capabilities || []).map((entry) => entry.id));
  const changedEntities = stableSortedStrings((diff.entities || []).map((entry) => entry.id));
  const changedProjections = stableSortedStrings((diff.projections || []).map((entry) => entry.id));
  const changedWidgetProjections = stableSortedStrings((diff.widgets || []).flatMap((entry) => {
    if (entry.classification === "additive") {
      return relatedProjectionsForWidget(graph, entry.id);
    }
    if (entry.classification === "removed") {
      return relatedProjectionsForWidget(baselineGraph, entry.id);
    }
    return [
      ...relatedProjectionsForWidget(graph, entry.id),
      ...relatedProjectionsForWidget(baselineGraph, entry.id)
    ];
  }));

  return stableSortedStrings([
    ...changedProjections,
    ...changedCapabilities.flatMap((id) => relatedProjectionsForCapability(graph, id)),
    ...changedEntities.flatMap((id) => relatedProjectionsForEntity(graph, id)),
    ...changedWidgetProjections
  ]);
}

const WIDGET_CONTRACT_SECTIONS = [
  "category",
  "version",
  "status",
  "props",
  "events",
  "slots",
  "behavior",
  "behaviors",
  "patterns",
  "regions",
  "approvals",
  "lookups",
  "dependencies"
];

function changedWidgetContractSections(entry) {
  if (entry.classification === "additive") {
    return WIDGET_CONTRACT_SECTIONS.filter((section) => entry.current?.[section] != null);
  }
  if (entry.classification === "removed") {
    return WIDGET_CONTRACT_SECTIONS.filter((section) => entry.baseline?.[section] != null);
  }
  return WIDGET_CONTRACT_SECTIONS.filter((section) =>
    JSON.stringify(entry.current?.[section] ?? null) !== JSON.stringify(entry.baseline?.[section] ?? null)
  );
}

function affectedProjectionIdsForWidgetChange(graph, baselineGraph, entry) {
  if (entry.classification === "additive") {
    return relatedProjectionsForWidget(graph, entry.id);
  }
  if (entry.classification === "removed") {
    return relatedProjectionsForWidget(baselineGraph, entry.id);
  }
  return stableSortedStrings([
    ...relatedProjectionsForWidget(graph, entry.id),
    ...relatedProjectionsForWidget(baselineGraph, entry.id)
  ]);
}

function projectionMigrationCommands(widgetId, projectionId) {
  return [
    {
      target: "ui-widget-contract",
      command: `topogram emit ui-widget-contract ./topo --widget ${widgetId} --json`,
      reason: `Refresh the normalized widget contract for ${widgetId}.`
    },
    {
      target: "widget-conformance-report",
      command: `topogram emit widget-conformance-report ./topo --projection ${projectionId} --json`,
      reason: `Review projection ${projectionId} widget placement, required props, events, and region/pattern compatibility.`
    },
    {
      target: "widget-behavior-report",
      command: `topogram widget behavior ./topo --projection ${projectionId} --widget ${widgetId} --json`,
      reason: `Review behavior data/event/action wiring for ${widgetId} on projection ${projectionId}.`
    },
    {
      target: "ui-surface-contract",
      command: `topogram emit ui-surface-contract ./topo --projection ${projectionId} --json`,
      reason: `Refresh the surface contract consumed by stack generators for projection ${projectionId}.`
    }
  ];
}

function buildWidgetContractMigrationPlan(graph, baselineGraph, diff) {
  const widgets = (diff.widgets || []).map((entry) => {
    const affectedProjectionIds = affectedProjectionIdsForWidgetChange(graph, baselineGraph, entry);
    return {
      widget_id: entry.id,
      classification: entry.classification,
      changed_sections: changedWidgetContractSections(entry),
      affected_projection_ids: affectedProjectionIds,
      affected_projections: affectedProjectionIds
        .map((id) => summarizeById(graph, id) || summarizeById(baselineGraph, id))
        .filter(Boolean),
      review_commands: affectedProjectionIds.flatMap((projectionId) => projectionMigrationCommands(entry.id, projectionId)),
      migration_steps: [
        "Review changed_sections to understand the semantic widget contract delta.",
        "Refresh the widget contract and affected surface contracts.",
        "Run conformance and behavior reports for every affected projection.",
        "Regenerate generated-owned outputs or manually update maintained surfaces after review."
      ]
    };
  });

  return {
    widgets,
    affected_widget_ids: stableSortedStrings(widgets.map((entry) => entry.widget_id)),
    affected_projection_ids: stableSortedStrings(widgets.flatMap((entry) => entry.affected_projection_ids)),
    review_command_count: widgets.reduce((count, entry) => count + entry.review_commands.length, 0)
  };
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
    widgets: diffMaps(normalizeTargetMap(graph, "widget"), normalizeTargetMap(baselineGraph, "widget")),
    journeys: diffMaps(normalizeTargetMap(graph, "journey"), normalizeTargetMap(baselineGraph, "journey")),
    verifications: diffMaps(normalizeTargetMap(graph, "verification"), normalizeTargetMap(baselineGraph, "verification")),
    domains: diffMaps(normalizeTargetMap(graph, "domain"), normalizeTargetMap(baselineGraph, "domain")),
    pitches: diffMaps(normalizeTargetMap(graph, "pitch"), normalizeTargetMap(baselineGraph, "pitch")),
    requirements: diffMaps(normalizeTargetMap(graph, "requirement"), normalizeTargetMap(baselineGraph, "requirement")),
    acceptance_criteria: diffMaps(
      normalizeTargetMap(graph, "acceptance_criterion"),
      normalizeTargetMap(baselineGraph, "acceptance_criterion")
    ),
    tasks: diffMaps(normalizeTargetMap(graph, "task"), normalizeTargetMap(baselineGraph, "task")),
    bugs: diffMaps(normalizeTargetMap(graph, "bug"), normalizeTargetMap(baselineGraph, "bug"))
  };
  const sdlcChanges = {
    pitches: diff.pitches || [],
    requirements: diff.requirements || [],
    acceptance_criteria: diff.acceptance_criteria || [],
    tasks: diff.tasks || [],
    bugs: diff.bugs || []
  };
  const affectedCapabilities = collectAffectedCapabilityIds(graph, diff);
  const affectedProjections = collectAffectedProjectionIds(graph, baselineGraph, diff);
  const affectedVerifications = collectAffectedVerificationIds(graph, diff);
  const widgetContractMigrationPlan = buildWidgetContractMigrationPlan(graph, baselineGraph, diff);
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
      projections: affectedProjections.map((id) => summarizeById(graph, id) || summarizeById(baselineGraph, id)).filter(Boolean),
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
    widget_contract_migration_plan: widgetContractMigrationPlan,
    review_boundary_changes: reviewBoundaryChangeItems,
    sdlc: sdlcChanges
  };
}

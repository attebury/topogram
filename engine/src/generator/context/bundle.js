import {
  buildMaintainedOutputs,
  buildMaintainedBoundaryArtifact,
  buildMaintainedSeams,
  buildDefaultWriteScope,
  buildMaintainedWriteScope,
  maintainedProofMetadata,
  relatedCapabilitiesForEntity,
  relatedCapabilitiesForProjection,
  relatedEntitiesForProjection,
  recommendedVerificationTargets,
  stableSortedStrings,
  summarizeById,
  summarizeDocsByIds,
  summarizeJourneyLikeByIds,
  summarizeStatementsByIds,
  verificationIdsForTarget
} from "./shared.js";
import {
  defaultOwnershipBoundary,
  ownershipBoundaryForMaintainedSurface,
  reviewBoundaryForJourneyDoc,
  reviewBoundaryForWorkflowDoc
} from "../../policy/review-boundaries.js";

function apiBundle(graph) {
  const capabilities = stableSortedStrings((graph.byKind.capability || []).map((item) => item.id));
  const projections = stableSortedStrings(
    (graph.byKind.projection || [])
      .filter((projection) => (projection.http || []).length > 0)
      .map((projection) => projection.id)
  );
  const shapes = stableSortedStrings(capabilities.flatMap((capabilityId) => {
    const capability = (graph.byKind.capability || []).find((item) => item.id === capabilityId);
    return [...(capability?.input || []).map((item) => item.id), ...(capability?.output || []).map((item) => item.id)];
  }));
  const rules = stableSortedStrings(capabilities.flatMap((capabilityId) => {
    return (graph.byKind.rule || [])
      .filter((rule) => (rule.appliesTo || []).some((target) => target.id === capabilityId))
      .map((rule) => rule.id);
  }));

  return {
    type: "context_bundle",
    version: 1,
    task: "api",
    summary: {
      focus: "API-facing capability, shape, and projection context",
      capabilityCount: capabilities.length,
      projectionCount: projections.length
    },
    included_surfaces: {
      capabilities: summarizeStatementsByIds(graph, capabilities),
      shapes: summarizeStatementsByIds(graph, shapes),
      projections: summarizeStatementsByIds(graph, projections),
      rules: summarizeStatementsByIds(graph, rules)
    },
    dependencies: {
      capabilities,
      shapes,
      projections,
      rules
    },
    verification: summarizeStatementsByIds(graph, verificationIdsForTarget(graph, [...capabilities, ...projections])),
    verification_targets: recommendedVerificationTargets(graph, [...capabilities, ...projections], {
      rationale: "API bundle should point agents at API-facing generated checks instead of full workspace verification."
    }),
    write_scope: buildDefaultWriteScope(),
    ownership_boundary: defaultOwnershipBoundary(),
    review_boundaries: {
      capabilities: capabilities.map((id) => ({ id, review_boundary: summarizeById(graph, id)?.reviewBoundary || null })),
      projections: projections.map((id) => ({ id, review_boundary: summarizeById(graph, id)?.reviewBoundary || null }))
    }
  };
}

function uiBundle(graph) {
  const projections = stableSortedStrings(
    (graph.byKind.projection || [])
      .filter((projection) => (projection.uiScreens || []).length > 0 || (projection.uiWeb || []).length > 0)
      .map((projection) => projection.id)
  );
  const capabilities = stableSortedStrings(projections.flatMap((projectionId) => {
    const projection = (graph.byKind.projection || []).find((item) => item.id === projectionId);
    return relatedCapabilitiesForProjection(projection);
  }));
  const workflows = stableSortedStrings(
    (graph.docs || [])
      .filter((doc) => doc.kind === "workflow" && (doc.relatedProjections || []).some((id) => projections.includes(id)))
      .map((doc) => doc.id)
  );
  const journeys = stableSortedStrings(
    [
      ...(graph.byKind.journey || []),
      ...(graph.docs || []).filter((doc) => doc.kind === "journey")
    ]
      .filter((journey) => (journey.relatedProjections || []).some((id) => projections.includes(id)))
      .map((journey) => journey.id)
  );
  const rules = stableSortedStrings(capabilities.flatMap((capabilityId) => {
    return (graph.byKind.rule || [])
      .filter((rule) => (rule.appliesTo || []).some((target) => target.id === capabilityId))
      .map((rule) => rule.id);
  }));

  return {
    type: "context_bundle",
    version: 1,
    task: "ui",
    summary: {
      focus: "UI workflows, journeys, projections, and action semantics",
      projectionCount: projections.length,
      workflowCount: workflows.length
    },
    included_surfaces: {
      projections: summarizeStatementsByIds(graph, projections),
      capabilities: summarizeStatementsByIds(graph, capabilities),
      workflows: summarizeDocsByIds(graph, workflows),
      journeys: summarizeJourneyLikeByIds(graph, journeys),
      rules: summarizeStatementsByIds(graph, rules)
    },
    dependencies: {
      projections,
      capabilities,
      workflows,
      journeys,
      rules
    },
    verification: summarizeStatementsByIds(graph, verificationIdsForTarget(graph, [...capabilities, ...projections, ...workflows, ...journeys])),
    verification_targets: recommendedVerificationTargets(graph, [...capabilities, ...projections, ...workflows, ...journeys], {
      rationale: "UI bundle should target workflow and UI verification linked to the selected projections."
    }),
    write_scope: buildDefaultWriteScope(),
    ownership_boundary: defaultOwnershipBoundary(),
    review_boundaries: {
      projections: projections.map((id) => ({ id, review_boundary: summarizeById(graph, id)?.reviewBoundary || null })),
      workflows: workflows.map((id) => ({ id, review_boundary: reviewBoundaryForWorkflowDoc((graph.docs || []).find((doc) => doc.id === id)) })),
      journeys: journeys.map((id) => ({ id, review_boundary: reviewBoundaryForJourneyDoc(summarizeById(graph, id) || null) }))
    }
  };
}

function dbBundle(graph) {
  const projections = stableSortedStrings(
    (graph.byKind.projection || [])
      .filter((projection) => (projection.dbTables || []).length > 0 || (projection.dbColumns || []).length > 0)
      .map((projection) => projection.id)
  );
  const entities = stableSortedStrings(projections.flatMap((projectionId) => {
    const projection = (graph.byKind.projection || []).find((item) => item.id === projectionId);
    return relatedEntitiesForProjection(projection);
  }));
  const capabilities = stableSortedStrings(entities.flatMap((entityId) => relatedCapabilitiesForEntity(graph, entityId)));
  const enums = stableSortedStrings((graph.byKind.enum || []).map((item) => item.id));

  return {
    type: "context_bundle",
    version: 1,
    task: "db",
    summary: {
      focus: "DB schema, relations, and migration-sensitive semantics",
      projectionCount: projections.length,
      entityCount: entities.length
    },
    included_surfaces: {
      projections: summarizeStatementsByIds(graph, projections),
      entities: summarizeStatementsByIds(graph, entities),
      enums: summarizeStatementsByIds(graph, enums),
      capabilities: summarizeStatementsByIds(graph, capabilities)
    },
    dependencies: {
      projections,
      entities,
      enums,
      capabilities
    },
    verification: summarizeStatementsByIds(graph, verificationIdsForTarget(graph, [...projections, ...entities])),
    verification_targets: recommendedVerificationTargets(graph, [...projections, ...entities], {
      rationale: "DB bundle should target schema and runtime checks tied to affected entities and projections."
    }),
    write_scope: buildDefaultWriteScope(),
    ownership_boundary: defaultOwnershipBoundary(),
    review_boundaries: {
      projections: projections.map((id) => ({ id, review_boundary: summarizeById(graph, id)?.reviewBoundary || null })),
      entities: entities.map((id) => ({ id, review_boundary: { automation_class: "review_required", reasons: ["schema_surface"] } }))
    }
  };
}

function maintainedAppBundle(graph) {
  const proofStories = maintainedProofMetadata(graph);
  const projections = stableSortedStrings((graph.byKind.projection || []).map((item) => item.id));
  const journeys = stableSortedStrings([
    ...(graph.byKind.journey || []).map((item) => item.id),
    ...(graph.docs || []).filter((doc) => doc.kind === "journey").map((doc) => doc.id)
  ]);
  const verifications = stableSortedStrings((graph.byKind.verification || []).map((item) => item.id));
  const maintainedFiles = stableSortedStrings(proofStories.flatMap((item) => item.maintainedFiles || []));
  const emittedDependencies = stableSortedStrings(proofStories.flatMap((item) => item.emittedDependencies || []));
  const humanOwnedSeams = stableSortedStrings(proofStories.flatMap((item) => item.humanOwnedSeams || []));
  const verificationTargets = recommendedVerificationTargets(graph, [...verifications, ...emittedDependencies], {
    includeMaintainedApp: true,
    rationale: "Maintained-app bundle should point agents at both generated verification and maintained proof gates."
  });
  const maintainedBoundaryArtifact = buildMaintainedBoundaryArtifact({
    proofStories,
    verificationTargets,
    graph
  });
  const outputs = maintainedBoundaryArtifact?.outputs || [];
  const seams = maintainedBoundaryArtifact?.seams || [];

  return {
    type: "context_bundle",
    version: 1,
    task: "maintained-app",
    summary: {
      focus: "Maintained-app proof boundaries and human-owned change surfaces",
      accepted_change_count: proofStories.filter((item) => item.classification === "accepted_change").length,
      guarded_change_count: proofStories.filter((item) => item.classification === "guarded_manual_decision").length,
      no_go_count: proofStories.filter((item) => item.classification === "no_go").length
    },
    included_surfaces: {
      projections: summarizeStatementsByIds(graph, projections),
      journeys: summarizeJourneyLikeByIds(graph, journeys),
      maintained_files_in_scope: maintainedFiles,
      emitted_artifact_dependencies: emittedDependencies,
      human_owned_seams: humanOwnedSeams,
      outputs,
      seams,
      proof_stories: proofStories.map((item) => ({
        classification: item.classification,
        relativePath: item.relativePath,
        maintained_files: item.maintainedFiles || [],
        emitted_dependencies: item.emittedDependencies || [],
        human_owned_seams: item.humanOwnedSeams || [],
        review_boundary: item.reviewBoundary
      }))
    },
    dependencies: {
      projections,
      journeys,
      verifications,
      maintained_files: maintainedFiles,
      emitted_dependencies: emittedDependencies
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: verificationTargets,
    write_scope: buildMaintainedWriteScope(graph, maintainedFiles),
    ownership_boundary: ownershipBoundaryForMaintainedSurface(),
    maintained_boundary: maintainedBoundaryArtifact,
    review_boundaries: {
      maintained_surfaces: [
        {
          class: "accepted_change",
          description: "Maintained surface should mirror emitted Topogram artifacts directly.",
          review_boundary: proofStories.find((item) => item.classification === "accepted_change")?.reviewBoundary || null
        },
        {
          class: "guarded_manual_decision",
          description: "Topogram identifies the affected surface, but product or UX treatment remains human-owned.",
          review_boundary: proofStories.find((item) => item.classification === "guarded_manual_decision")?.reviewBoundary || null
        },
        {
          class: "no_go",
          description: "Unsafe semantic drift or relation changes should not be auto-applied.",
          review_boundary: proofStories.find((item) => item.classification === "no_go")?.reviewBoundary || null
        }
      ],
      human_owned_seams: humanOwnedSeams,
      independent_review_artifacts: proofStories
        .filter((item) => item.classification === "independent_review")
        .map((item) => item.relativePath)
    }
  };
}

export function generateContextBundle(graph, options = {}) {
  const task = options.taskId;
  if (!task) {
    throw new Error("context-bundle requires --task <api|ui|db|maintained-app>");
  }

  if (task === "api") {
    return apiBundle(graph);
  }
  if (task === "ui") {
    return uiBundle(graph);
  }
  if (task === "db") {
    return dbBundle(graph);
  }
  if (task === "maintained-app") {
    return maintainedAppBundle(graph);
  }

  throw new Error(`Unsupported context bundle task '${task}'`);
}

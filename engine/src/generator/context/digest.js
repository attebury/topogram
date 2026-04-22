import {
  maintainedProofMetadata,
  graphCounts,
  relatedJourneysForCapability,
  relatedProjectionsForCapability,
  relatedWorkflowDocsForCapability,
  summarizeById,
  summarizeProjection,
  summarizeStatement,
  verificationIdsForTarget,
  workspaceInventory
} from "./shared.js";
import {
  defaultOwnershipBoundary,
  reviewBoundaryForEntity,
  reviewBoundaryForJourneyDoc,
  reviewBoundaryForWorkflowDoc
} from "../../policy/review-boundaries.js";

function workspaceDigest(graph) {
  const inventory = workspaceInventory(graph);

  return {
    type: "context_digest",
    version: 1,
    focus: {
      kind: "workspace",
      id: "workspace"
    },
    workspace: {
      root: graph.root,
      counts: graphCounts(graph)
    },
    inventory,
    review_boundary: {
      automation_class: "manual_decision",
      reasons: ["workspace_requires_scoped_review"]
    },
    ownership_boundary: defaultOwnershipBoundary(),
    maintained_boundary_pointer: "maintained-boundary.context.json",
    pointers: {
      capabilities: inventory.capabilities.map((id) => `capabilities/${id}.context-digest.json`),
      workflows: inventory.workflows.map((id) => `workflows/${id}.context-digest.json`),
      entities: inventory.entities.map((id) => `entities/${id}.context-digest.json`),
      projections: inventory.projections.map((id) => `projections/${id}.context-digest.json`),
      journeys: inventory.journeys.map((id) => `journeys/${id}.context-digest.json`),
      maintained_boundary: "maintained-boundary.context.json"
    }
  };
}

function capabilityDigest(graph, capability) {
  const projections = relatedProjectionsForCapability(graph, capability.id);
  const journeys = relatedJourneysForCapability(graph, capability.id).map((doc) => doc.id).sort();
  const workflows = relatedWorkflowDocsForCapability(graph, capability.id).map((doc) => doc.id).sort();

  return {
    type: "context_digest",
    version: 1,
    focus: {
      kind: "capability",
      id: capability.id
    },
    summary: summarizeStatement(capability),
    dependencies: {
      shapes: [...new Set([...(capability.input || []).map((item) => item.id), ...(capability.output || []).map((item) => item.id)])].sort(),
      entities: [...new Set([
        ...(capability.reads || []).map((item) => item.id),
        ...(capability.creates || []).map((item) => item.id),
        ...(capability.updates || []).map((item) => item.id),
        ...(capability.deletes || []).map((item) => item.id)
      ])].sort()
    },
    journeys,
    workflows,
    projections,
    verifications: verificationIdsForTarget(graph, [capability.id, ...projections]),
    review_boundary: capability.reviewBoundary,
    ownership_boundary: defaultOwnershipBoundary()
  };
}

function workflowDigest(graph, workflow) {
  return {
    type: "context_digest",
    version: 1,
    focus: {
      kind: "workflow",
      id: workflow.id
    },
    summary: summarizeById(graph, workflow.id),
    dependencies: {
      capabilities: [...(workflow.relatedCapabilities || [])].sort(),
      projections: [...(workflow.relatedProjections || [])].sort()
    },
    verifications: verificationIdsForTarget(graph, [workflow.id, ...(workflow.relatedCapabilities || [])]),
    review_boundary: reviewBoundaryForWorkflowDoc(workflow),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

function entityDigest(graph, entity) {
  return {
    type: "context_digest",
    version: 1,
    focus: {
      kind: "entity",
      id: entity.id
    },
    summary: summarizeStatement(entity),
    verifications: verificationIdsForTarget(graph, [entity.id]),
    review_boundary: reviewBoundaryForEntity(entity),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

function projectionDigest(graph, projection) {
  return {
    type: "context_digest",
    version: 1,
    focus: {
      kind: "projection",
      id: projection.id
    },
    summary: summarizeProjection(projection),
    verifications: verificationIdsForTarget(graph, [projection.id, ...projection.realizes.map((item) => item.id)]),
    review_boundary: projection.reviewBoundary,
    ownership_boundary: defaultOwnershipBoundary()
  };
}

function journeyDigest(graph, journey) {
  return {
    type: "context_digest",
    version: 1,
    focus: {
      kind: "journey",
      id: journey.id
    },
    summary: summarizeById(graph, journey.id),
    verifications: verificationIdsForTarget(graph, [journey.id, ...(journey.relatedCapabilities || [])]),
    review_boundary: reviewBoundaryForJourneyDoc(journey),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

export function generateContextDigest(graph) {
  const files = {
    "workspace.context-digest.json": workspaceDigest(graph),
    "maintained-boundary.context.json": {
      type: "maintained_boundary",
      version: 1,
      summary: {
        focus: "Machine-readable maintained-app ownership and change boundary surface",
        story_count: maintainedProofMetadata(graph).length
      },
      stories: maintainedProofMetadata(graph)
    }
  };

  for (const capability of (graph.byKind.capability || []).slice().sort((a, b) => a.id.localeCompare(b.id))) {
    files[`capabilities/${capability.id}.context-digest.json`] = capabilityDigest(graph, capability);
  }

  for (const workflow of (graph.docs || []).filter((doc) => doc.kind === "workflow").sort((a, b) => a.id.localeCompare(b.id))) {
    files[`workflows/${workflow.id}.context-digest.json`] = workflowDigest(graph, workflow);
  }

  for (const entity of (graph.byKind.entity || []).slice().sort((a, b) => a.id.localeCompare(b.id))) {
    files[`entities/${entity.id}.context-digest.json`] = entityDigest(graph, entity);
  }

  for (const projection of (graph.byKind.projection || []).slice().sort((a, b) => a.id.localeCompare(b.id))) {
    files[`projections/${projection.id}.context-digest.json`] = projectionDigest(graph, projection);
  }

  for (const journey of (graph.docs || []).filter((doc) => doc.kind === "journey").sort((a, b) => a.id.localeCompare(b.id))) {
    files[`journeys/${journey.id}.context-digest.json`] = journeyDigest(graph, journey);
  }

  return files;
}

import fs from "node:fs";
import path from "node:path";

import { parseDocFile } from "../../workspace-docs.js";
import {
  defaultOwnershipBoundary,
  ownershipBoundaryForMaintainedSurface,
  reviewBoundaryForCapability as reviewBoundaryForCapabilityPolicy,
  reviewBoundaryForEntity as reviewBoundaryForEntityPolicy,
  reviewBoundaryForJourneyDoc as reviewBoundaryForJourneyDocPolicy,
  reviewBoundaryForMaintainedClassification,
  reviewBoundaryForProjection as reviewBoundaryForProjectionPolicy,
  reviewBoundaryForWorkflowDoc as reviewBoundaryForWorkflowDocPolicy
} from "../../policy/review-boundaries.js";

const bundledRepoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..", "..");

function stableSortedStrings(values) {
  return [...new Set((values || []).filter(Boolean))].sort();
}

function seamIdHint(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "maintained_surface";
}

function titleCaseWords(value) {
  return String(value || "")
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function refIds(items) {
  return stableSortedStrings((items || []).map((item) => item?.id || item?.target?.id));
}

function docIds(items) {
  return stableSortedStrings((items || []).map((item) => item?.id));
}

function summarizeField(field) {
  return {
    name: field.name || null,
    type: field.fieldType || null,
    requiredness: field.requiredness || null,
    defaultValue: field.defaultValue ?? null
  };
}

function summarizeProjection(projection) {
  return {
    id: projection.id,
    kind: projection.kind,
    name: projection.name || projection.id,
    description: projection.description || null,
    platform: projection.platform || null,
    realizes: refIds(projection.realizes),
    outputs: stableSortedStrings(projection.outputs || []),
    uiScreens: stableSortedStrings((projection.uiScreens || []).map((screen) => screen.id)),
    dbTables: stableSortedStrings((projection.dbTables || []).map((table) => table.table || table.entity?.id)),
    httpCapabilities: stableSortedStrings((projection.http || []).map((entry) => entry.capability?.id)),
    reviewBoundary: reviewBoundaryForProjectionPolicy(projection),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

function summarizeRule(rule) {
  return {
    id: rule.id,
    kind: rule.kind,
    name: rule.name || rule.id,
    description: rule.description || null,
    appliesTo: refIds(rule.appliesTo),
    actors: refIds(rule.actors),
    roles: refIds(rule.roles),
    severity: rule.severity || null,
    ownership_boundary: defaultOwnershipBoundary()
  };
}

function summarizeVerification(verification) {
  return {
    id: verification.id,
    kind: verification.kind,
    name: verification.name || verification.id,
    description: verification.description || null,
    method: verification.method || null,
    validates: refIds(verification.validates),
    scenarios: stableSortedStrings(verification.scenarios || []),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

function summarizeJourneyDoc(doc) {
  return {
    id: doc.id,
    kind: doc.kind,
    title: doc.title || doc.id,
    summary: doc.summary || null,
    relatedCapabilities: stableSortedStrings(doc.relatedCapabilities || []),
    relatedWorkflows: stableSortedStrings(doc.relatedWorkflows || []),
    relatedProjections: stableSortedStrings(doc.relatedProjections || []),
    reviewRequired: Boolean(doc.reviewRequired),
    reviewBoundary: doc.kind === "workflow" ? reviewBoundaryForWorkflowDocPolicy(doc) : reviewBoundaryForJourneyDocPolicy(doc),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

function summarizeStatement(statement) {
  switch (statement.kind) {
    case "entity":
      return {
        id: statement.id,
        kind: statement.kind,
        name: statement.name || statement.id,
        description: statement.description || null,
        fields: (statement.fields || []).map(summarizeField),
        relations: (statement.relations || []).map((relation) => ({
          type: relation.type || null,
          sourceField: relation.sourceField || null,
          target: relation.target?.id || null
        })),
        keys: stableSortedStrings((statement.keys || []).map((key) => key.name)),
        reviewBoundary: reviewBoundaryForEntityPolicy(statement),
        ownership_boundary: defaultOwnershipBoundary()
      };
    case "shape":
      return {
        id: statement.id,
        kind: statement.kind,
        name: statement.name || statement.id,
        description: statement.description || null,
        derivedFrom: refIds(statement.derivedFrom),
        include: stableSortedStrings(statement.include || []),
        exclude: stableSortedStrings(statement.exclude || []),
        fields: (statement.projectedFields || statement.fields || []).map(summarizeField),
        ownership_boundary: defaultOwnershipBoundary()
      };
    case "capability":
      return {
        id: statement.id,
        kind: statement.kind,
        name: statement.name || statement.id,
        description: statement.description || null,
        actors: refIds(statement.actors),
        roles: refIds(statement.roles),
        reads: refIds(statement.reads),
        creates: refIds(statement.creates),
        updates: refIds(statement.updates),
        deletes: refIds(statement.deletes),
        input: refIds(statement.input),
        output: refIds(statement.output),
        reviewBoundary: reviewBoundaryForCapabilityPolicy(statement),
        ownership_boundary: defaultOwnershipBoundary()
      };
    case "rule":
      return summarizeRule(statement);
    case "projection":
      return summarizeProjection(statement);
    case "verification":
      return summarizeVerification(statement);
    case "enum":
      return {
        id: statement.id,
        kind: statement.kind,
        name: statement.name || statement.id,
        values: stableSortedStrings(statement.values || []),
        ownership_boundary: defaultOwnershipBoundary()
      };
    case "actor":
    case "role":
      return {
        id: statement.id,
        kind: statement.kind,
        name: statement.name || statement.id,
        description: statement.description || null,
        ownership_boundary: defaultOwnershipBoundary()
      };
    default:
      return {
        id: statement.id,
        kind: statement.kind,
        name: statement.name || statement.id,
        description: statement.description || null,
        ownership_boundary: defaultOwnershipBoundary()
      };
  }
}

export function reviewBoundaryForCapability(capability) {
  return reviewBoundaryForCapabilityPolicy(capability);
}

export function reviewBoundaryForProjection(projection) {
  return reviewBoundaryForProjectionPolicy(projection);
}

export function reviewBoundaryForEntity(entity) {
  return reviewBoundaryForEntityPolicy(entity);
}

export function graphCounts(graph) {
  return Object.fromEntries(
    Object.entries(graph.byKind || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([kind, statements]) => [kind, statements.length])
  );
}

export function buildIndexes(graph) {
  const statementById = new Map((graph.statements || []).map((statement) => [statement.id, statement]));
  const docsById = new Map((graph.docs || []).map((doc) => [doc.id, doc]));
  const docsByKind = Object.groupBy(graph.docs || [], (doc) => doc.kind || "unknown");

  return {
    statementById,
    docsById,
    docsByKind
  };
}

function relatedDocs(graph, predicate) {
  return (graph.docs || []).filter(predicate);
}

function verificationsFor(graph, predicate) {
  return stableSortedStrings(
    (graph.byKind.verification || [])
      .filter((verification) => (verification.validates || []).some((target) => predicate(target.id)))
      .map((verification) => verification.id)
  );
}

export function relatedJourneysForCapability(graph, capabilityId) {
  return relatedDocs(
    graph,
    (doc) => doc.kind === "journey" && (doc.relatedCapabilities || []).includes(capabilityId)
  );
}

export function relatedWorkflowDocsForCapability(graph, capabilityId) {
  return relatedDocs(
    graph,
    (doc) => doc.kind === "workflow" && (doc.relatedCapabilities || []).includes(capabilityId)
  );
}

export function relatedRulesForTarget(graph, targetId) {
  return stableSortedStrings(
    (graph.byKind.rule || [])
      .filter((rule) => (rule.appliesTo || []).some((target) => target.id === targetId))
      .map((rule) => rule.id)
  );
}

export function relatedProjectionsForCapability(graph, capabilityId) {
  return stableSortedStrings(
    (graph.byKind.projection || [])
      .filter((projection) => (projection.realizes || []).some((target) => target.id === capabilityId))
      .map((projection) => projection.id)
  );
}

export function relatedCapabilitiesForEntity(graph, entityId) {
  return stableSortedStrings(
    (graph.byKind.capability || [])
      .filter(
        (capability) =>
          refIds(capability.reads).includes(entityId) ||
          refIds(capability.creates).includes(entityId) ||
          refIds(capability.updates).includes(entityId) ||
          refIds(capability.deletes).includes(entityId)
      )
      .map((capability) => capability.id)
  );
}

export function relatedShapesForEntity(graph, entityId) {
  return stableSortedStrings(
    (graph.byKind.shape || [])
      .filter((shape) => refIds(shape.derivedFrom).includes(entityId))
      .map((shape) => shape.id)
  );
}

export function relatedProjectionsForEntity(graph, entityId) {
  return stableSortedStrings(
    (graph.byKind.projection || [])
      .filter((projection) => {
        const dbMatches = (projection.dbTables || []).some((entry) => entry.entity?.id === entityId);
        const httpMatches = (projection.http || []).some((entry) => entry.entity?.id === entityId);
        return dbMatches || httpMatches;
      })
      .map((projection) => projection.id)
  );
}

export function relatedCapabilitiesForProjection(projection) {
  const ids = [
    ...(projection.realizes || []).map((entry) => entry.id),
    ...(projection.http || []).map((entry) => entry.capability?.id),
    ...(projection.uiActions || []).map((entry) => entry.capability?.id),
    ...(projection.uiVisibility || []).map((entry) => entry.capability?.id),
    ...(projection.uiLookups || []).map((entry) => entry.capability?.id)
  ];
  return stableSortedStrings(ids);
}

export function relatedEntitiesForProjection(projection) {
  const ids = [
    ...(projection.dbTables || []).map((entry) => entry.entity?.id),
    ...(projection.dbColumns || []).map((entry) => entry.entity?.id),
    ...(projection.dbRelations || []).map((entry) => entry.source?.id),
    ...(projection.dbRelations || []).map((entry) => entry.target?.id)
  ];
  return stableSortedStrings(ids);
}

export function relatedShapesForProjection(projection) {
  const ids = [
    ...(projection.uiScreens || []).map((entry) => entry.viewShape?.id),
    ...(projection.uiScreens || []).map((entry) => entry.editShape?.id),
    ...(projection.uiCollections || []).map((entry) => entry.itemShape?.id),
    ...(projection.httpResponses || []).map((entry) => entry.shape?.id),
    ...(projection.http || []).map((entry) => entry.requestShape?.id)
  ];
  return stableSortedStrings(ids);
}

export function verificationIdsForTarget(graph, targetIds) {
  const set = new Set(targetIds || []);
  return verificationsFor(graph, (targetId) => set.has(targetId));
}

export function summarizeDoc(doc) {
  return summarizeJourneyDoc(doc);
}

export function summarizeById(graph, id) {
  const statement = (graph.statements || []).find((item) => item.id === id);
  if (statement) {
    return summarizeStatement(statement);
  }

  const doc = (graph.docs || []).find((item) => item.id === id);
  return doc ? summarizeDoc(doc) : null;
}

export function summarizeStatementsByIds(graph, ids) {
  return stableSortedStrings(ids).map((id) => summarizeById(graph, id)).filter(Boolean);
}

export function summarizeDocsByIds(graph, ids) {
  return stableSortedStrings(ids)
    .map((id) => (graph.docs || []).find((doc) => doc.id === id))
    .filter(Boolean)
    .map(summarizeDoc);
}

export function workspaceInventory(graph) {
  return {
    capabilities: stableSortedStrings((graph.byKind.capability || []).map((item) => item.id)),
    workflows: stableSortedStrings((graph.docs || []).filter((doc) => doc.kind === "workflow").map((doc) => doc.id)),
    journeys: stableSortedStrings((graph.docs || []).filter((doc) => doc.kind === "journey").map((doc) => doc.id)),
    entities: stableSortedStrings((graph.byKind.entity || []).map((item) => item.id)),
    projections: stableSortedStrings((graph.byKind.projection || []).map((item) => item.id)),
    verifications: stableSortedStrings((graph.byKind.verification || []).map((item) => item.id))
  };
}

export function ensureContextSelection(options = {}) {
  const selectors = [
    options.capabilityId ? ["capability", options.capabilityId] : null,
    options.workflowId ? ["workflow", options.workflowId] : null,
    options.projectionId ? ["projection", options.projectionId] : null,
    options.entityId ? ["entity", options.entityId] : null,
    options.journeyId ? ["journey", options.journeyId] : null,
    options.surfaceId ? ["surface", options.surfaceId] : null
  ].filter(Boolean);

  if (selectors.length !== 1) {
    throw new Error("Context selection requires exactly one of --capability, --workflow, --projection, --entity, --journey, or --surface");
  }

  return {
    kind: selectors[0][0],
    id: selectors[0][1]
  };
}

export function getWorkflowDoc(graph, workflowId) {
  const doc = (graph.docs || []).find((item) => item.kind === "workflow" && item.id === workflowId);
  if (!doc) {
    throw new Error(`No workflow doc found with id '${workflowId}'`);
  }
  return doc;
}

export function getJourneyDoc(graph, journeyId) {
  const doc = (graph.docs || []).find((item) => item.kind === "journey" && item.id === journeyId);
  if (!doc) {
    throw new Error(`No journey doc found with id '${journeyId}'`);
  }
  return doc;
}

export function getStatement(graph, kind, id) {
  const statement = (graph.byKind[kind] || []).find((item) => item.id === id);
  if (!statement) {
    throw new Error(`No ${kind} found with id '${id}'`);
  }
  return statement;
}

export function repoRootFromGraph(graph) {
  let current = path.resolve(graph.root);
  while (true) {
    if (fs.existsSync(path.join(current, "examples", "maintained", "proof-app")) && fs.existsSync(path.join(current, "engine"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      if (
        fs.existsSync(path.join(bundledRepoRoot, "examples", "maintained", "proof-app")) &&
        fs.existsSync(path.join(bundledRepoRoot, "engine"))
      ) {
        return bundledRepoRoot;
      }
      return path.resolve(graph.root, "..", "..");
    }
    current = parent;
  }
}

function workspaceRootFromGraph(graph) {
  const root = path.resolve(graph.root);
  return path.basename(root) === "topogram" ? path.dirname(root) : root;
}

function collectMaintainedProofDocPaths(workspaceRoot) {
  const candidateDirs = [
    path.join(workspaceRoot, "proof"),
    path.join(workspaceRoot, "docs", "proof")
  ];
  const proofFiles = [];

  for (const dirPath of candidateDirs) {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      continue;
    }
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.isFile() && /^maintained-.*\.md$/.test(entry.name)) {
        proofFiles.push(path.join(dirPath, entry.name));
      }
    }
  }

  return stableSortedStrings(proofFiles);
}

function readLocalMaintainedProofMetadataFromWorkspace(workspaceRoot) {
  return collectMaintainedProofDocPaths(workspaceRoot)
    .map((filePath) => parseDocFile(filePath, workspaceRoot))
    .filter((doc) => !doc.parseError)
    .map((doc) => {
      const classification = doc.metadata.classification || null;
      const maintainedFiles = stableSortedStrings(doc.metadata.maintained_files || []);
      const emittedDependencies = stableSortedStrings(doc.metadata.emitted_dependencies || []);
      const humanOwnedSeams = stableSortedStrings(doc.metadata.human_owned_seams || []);

      if (!classification || maintainedFiles.length === 0 || emittedDependencies.length === 0 || humanOwnedSeams.length === 0) {
        return null;
      }

      return {
        classification,
        maintainedFiles,
        emittedDependencies,
        humanOwnedSeams,
        seamFamilyId: doc.metadata.seam_family_id || null,
        seamFamilyLabel: doc.metadata.seam_family_label || null,
        exists: true,
        absolutePath: doc.file,
        relativePath: doc.relativePath,
        reviewBoundary: reviewBoundaryForMaintainedClassification(classification),
        ownership_boundary: ownershipBoundaryForMaintainedSurface()
      };
    })
    .filter(Boolean);
}

export function readLocalMaintainedProofMetadata(graph) {
  return readLocalMaintainedProofMetadataFromWorkspace(workspaceRootFromGraph(graph));
}

export function buildMaintainedBoundaryArtifact({
  proofStories = [],
  verificationTargets = null,
  graph = null
} = {}) {
  if (!proofStories.length) {
    return null;
  }

  const seams = buildMaintainedSeams(proofStories);
  const outputs = buildMaintainedOutputs({
    seams,
    proofStories,
    ownershipBoundary: ownershipBoundaryForMaintainedSurface(),
    verificationTargets,
    graph
  });
  const maintainedFiles = stableSortedStrings(proofStories.flatMap((item) => item.maintainedFiles || []));
  const emittedDependencies = stableSortedStrings(proofStories.flatMap((item) => item.emittedDependencies || []));
  const humanOwnedSeams = stableSortedStrings(proofStories.flatMap((item) => item.humanOwnedSeams || []));

  return {
    type: "maintained_boundary",
    version: 2,
    summary: {
      focus: "Maintained-app files, emitted constraints, and explicit review boundaries",
      maintained_file_count: maintainedFiles.length,
      accepted_change_count: proofStories.filter((item) => item.classification === "accepted_change").length,
      guarded_change_count: proofStories.filter((item) => item.classification === "guarded_manual_decision").length,
      no_go_count: proofStories.filter((item) => item.classification === "no_go").length
    },
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
      seam_family_id: item.seamFamilyId || null,
      seam_family_label: item.seamFamilyLabel || null,
      review_boundary: item.reviewBoundary,
      ownership_boundary: item.ownership_boundary
    })),
    ownership_boundary: ownershipBoundaryForMaintainedSurface()
  };
}

export function buildLocalMaintainedBoundaryArtifact(workspaceRoot, graph = null) {
  const proofStories = readLocalMaintainedProofMetadataFromWorkspace(path.resolve(workspaceRoot));
  if (!proofStories.length) {
    return null;
  }

  const emittedDependencies = stableSortedStrings(proofStories.flatMap((item) => item.emittedDependencies || []));
  const verificationTargets = graph
    ? recommendedVerificationTargets(graph, emittedDependencies, {
        includeMaintainedApp: true,
        rationale: "Local maintained proof stories should point agents at emitted dependency checks plus any maintained proof gates."
      })
    : null;

  return buildMaintainedBoundaryArtifact({
    proofStories,
    verificationTargets,
    graph
  });
}

export function maintainedProofMetadata(graph) {
  const repoRoot = repoRootFromGraph(graph);
  const staticFiles = [
    {
      classification: "accepted_change",
      path: "examples/maintained/proof-app/proof/issues-ownership-visibility-story.md",
      maintainedFiles: ["examples/maintained/proof-app/src/issues.js"],
      emittedDependencies: ["proj_web", "proj_api", "journey_issue_resolution_and_closure"],
      humanOwnedSeams: ["maintained presenter structure", "detail/list rendering treatment"]
    },
    {
      classification: "accepted_change",
      path: "examples/maintained/proof-app/proof/issues-cross-surface-alignment-story.md",
      maintainedFiles: ["examples/maintained/proof-app/src/issues.js"],
      emittedDependencies: ["proj_web", "proj_api", "journey_issue_creation_and_assignment", "journey_issue_resolution_and_closure"],
      humanOwnedSeams: [
        "issues detail action state",
        "issues list/card summary state",
        "issues route and action metadata"
      ],
      seamFamilyId: "issues_cross_surface_alignment",
      seamFamilyLabel: "issues cross-surface ownership alignment"
    },
    {
      classification: "guarded_manual_decision",
      path: "examples/maintained/proof-app/proof/content-approval-workflow-decision-story.md",
      maintainedFiles: ["examples/maintained/proof-app/src/content-approval-change-guards.js"],
      emittedDependencies: ["cap_request_article_revision", "journey_editorial_review_and_revision"],
      humanOwnedSeams: ["new workflow affordance treatment", "action placement and copy"]
    },
    {
      classification: "no_go",
      path: "examples/maintained/proof-app/proof/issues-ownership-visibility-drift-story.md",
      maintainedFiles: ["examples/maintained/proof-app/src/issues.js"],
      emittedDependencies: ["proj_web", "journey_issue_resolution_and_closure"],
      humanOwnedSeams: ["owner visibility semantics must not drift"]
    },
    {
      classification: "no_go",
      path: "examples/maintained/proof-app/proof/content-approval-unsupported-change-story.md",
      maintainedFiles: ["examples/maintained/proof-app/src/content-approval.js", "examples/maintained/proof-app/src/content-approval-change-guards.js"],
      emittedDependencies: ["proj_web", "proj_api", "proj_db"],
      humanOwnedSeams: ["unsupported relation and workflow meaning changes"]
    },
    {
      classification: "no_go",
      path: "examples/maintained/proof-app/proof/todo-project-owner-unsupported-change-story.md",
      maintainedFiles: ["examples/maintained/proof-app/src/todo-change-guards.js"],
      emittedDependencies: ["entity_project", "proj_web", "proj_api"],
      humanOwnedSeams: ["ownership retargeting remains manual"]
    },
    {
      classification: "independent_review",
      path: "examples/maintained/proof-app/proof/maintained-contract-review.md",
      maintainedFiles: [
        "examples/maintained/proof-app/src/issues.js",
        "examples/maintained/proof-app/src/content-approval-change-guards.js",
        "examples/maintained/proof-app/src/todo-change-guards.js"
      ],
      emittedDependencies: ["maintained-proof-package"],
      humanOwnedSeams: ["human audit of emitted contracts vs maintained code"]
    },
    {
      classification: "accepted_change",
      path: "examples/generated/content-approval/implementation/proof/web-reference-seam-story.md",
      maintainedFiles: ["examples/generated/content-approval/implementation/web/reference.js"],
      emittedDependencies: ["proj_web", "journey_editorial_review_and_revision"],
      humanOwnedSeams: ["example web reference composition"]
    },
    {
      classification: "accepted_change",
      path: "examples/generated/content-approval/implementation/proof/backend-reference-seam-story.md",
      maintainedFiles: ["examples/generated/content-approval/implementation/backend/reference.js"],
      emittedDependencies: ["proj_api", "proj_db"],
      humanOwnedSeams: ["example backend reference integration"]
    }
  ];

  const staticProofs = staticFiles
    .map((item) => {
      const absolutePath = path.join(repoRoot, item.path);
      return {
        ...item,
        exists: fs.existsSync(absolutePath),
        absolutePath,
        relativePath: item.path,
        reviewBoundary: reviewBoundaryForMaintainedClassification(item.classification),
        ownership_boundary: ownershipBoundaryForMaintainedSurface()
      };
    })
    .filter((item) => item.exists);

  return [
    ...staticProofs,
    ...readLocalMaintainedProofMetadata(graph)
  ];
}

function maintainedSeamKind(label) {
  const normalized = String(label || "").toLowerCase();
  if (/audit|contract|review/.test(normalized)) {
    return "verification_harness";
  }
  if (/workflow|affordance|action|copy/.test(normalized)) {
    return "workflow_affordance";
  }
  if (/visibility|ownership|relation|policy/.test(normalized)) {
    return "policy_interpretation";
  }
  if (/route|navigation/.test(normalized)) {
    return "route_glue";
  }
  return "ui_presenter";
}

function maintainedSeamStatus(reviewBoundary) {
  const automationClass = reviewBoundary?.automation_class || "review_required";
  return automationClass === "safe" ? "aligned" : automationClass;
}

function maintainedSeamOwnershipClass(classification) {
  if (classification === "accepted_change") {
    return "contract_bound";
  }
  if (classification === "guarded_manual_decision" || classification === "independent_review") {
    return "advisory_only";
  }
  if (classification === "no_go") {
    return "out_of_bounds";
  }
  return "contract_bound";
}

function maintainedSeamAllowedChangeClasses(classification) {
  if (classification === "accepted_change") {
    return ["safe", "review_required"];
  }
  if (classification === "guarded_manual_decision") {
    return ["review_required", "manual_decision"];
  }
  if (classification === "independent_review") {
    return ["review_required"];
  }
  if (classification === "no_go") {
    return ["no_go"];
  }
  return ["review_required"];
}

function maintainedSeamDriftSignals(emittedDependencies = []) {
  const signals = new Set();
  for (const dependency of emittedDependencies || []) {
    if (dependency === "maintained-proof-package") {
      signals.add("verification_expectation_changed");
      continue;
    }
    if (dependency.startsWith("journey_") || dependency.startsWith("workflow_")) {
      signals.add("workflow_state_changed");
      continue;
    }
    if (dependency.startsWith("proj_ui") || dependency === "proj_web") {
      signals.add("emitted_contract_changed");
      signals.add("route_or_navigation_changed");
      continue;
    }
    if (
      dependency.startsWith("proj_") ||
      dependency.startsWith("cap_") ||
      dependency.startsWith("entity_") ||
      dependency.startsWith("shape_")
    ) {
      signals.add("emitted_contract_changed");
    }
  }
  return stableSortedStrings([...signals]);
}

function maintainedOutputDescriptor(filePaths = []) {
  const files = stableSortedStrings(filePaths);
  if (files.some((file) => String(file).startsWith("examples/maintained/proof-app/"))) {
    return {
      output_id: "maintained_app",
      label: "Maintained App",
      kind: "maintained_runtime",
      root_paths: ["examples/maintained/proof-app/**"]
    };
  }
  const exampleImplementationMatch = files
    .map((file) => String(file).match(/^examples\/(?:(generated)\/)?([^/]+)\/implementation\/(web|backend|runtime)\//))
    .find(Boolean);
  if (exampleImplementationMatch) {
    const [, category, slug, outputKind] = exampleImplementationMatch;
    const outputId = `output_${seamIdHint(`examples_${slug}_${outputKind}`)}`;
    const rootPrefix = category ? `examples/${category}/${slug}` : `examples/${slug}`;
    const root = `${rootPrefix}/implementation/${outputKind}`;
    return {
      output_id: outputId,
      label: `${titleCaseWords(slug)} ${titleCaseWords(outputKind)} Reference`,
      kind: outputKind === "web" ? "web_app" : outputKind === "backend" ? "backend_adapter" : "maintained_runtime",
      root_paths: [`${root}/**`]
    };
  }
  if (files.some((file) => String(file).startsWith("src/"))) {
    return {
      output_id: "output_src",
      label: "Source",
      kind: "backend_adapter",
      root_paths: ["src/**"]
    };
  }

  const firstFile = files[0] || "";
  const segments = String(firstFile).split("/").filter(Boolean);
  const root = segments.length >= 2 ? segments.slice(0, 2).join("/") : (segments[0] || "maintained");
  const outputStem = seamIdHint(root);
  return {
    output_id: `output_${outputStem}`,
    label: titleCaseWords(root.replaceAll("/", "_")),
    kind: "maintained_runtime",
    root_paths: [`${root}/**`]
  };
}

function mergeMaintainedSeam(existing, next) {
  if (!existing) {
    return {
      ...next,
      seam_family_id: next.seam_family_id || null,
      seam_family_label: next.seam_family_label || null,
      maintained_modules: stableSortedStrings(next.maintained_modules || []),
      emitted_dependencies: stableSortedStrings(next.emitted_dependencies || []),
      human_owned_aspects: stableSortedStrings(next.human_owned_aspects || []),
      allowed_change_classes: stableSortedStrings(next.allowed_change_classes || []),
      drift_signals: stableSortedStrings(next.drift_signals || []),
      proof_stories: [...(next.proof_stories || [])]
    };
  }

  const statusPriority = ["aligned", "review_required", "manual_decision", "no_go"];
  const ownershipPriority = ["engine_owned", "contract_bound", "advisory_only", "out_of_bounds"];

  const currentStatus = statusPriority.indexOf(existing.status);
  const nextStatus = statusPriority.indexOf(next.status);
  const currentOwnership = ownershipPriority.indexOf(existing.ownership_class);
  const nextOwnership = ownershipPriority.indexOf(next.ownership_class);

  return {
    ...existing,
    kind: existing.kind || next.kind,
    seam_family_id: existing.seam_family_id || next.seam_family_id || null,
    seam_family_label: existing.seam_family_label || next.seam_family_label || null,
    status: nextStatus > currentStatus ? next.status : existing.status,
    ownership_class: nextOwnership > currentOwnership ? next.ownership_class : existing.ownership_class,
    maintained_modules: stableSortedStrings([...(existing.maintained_modules || []), ...(next.maintained_modules || [])]),
    emitted_dependencies: stableSortedStrings([...(existing.emitted_dependencies || []), ...(next.emitted_dependencies || [])]),
    human_owned_aspects: stableSortedStrings([...(existing.human_owned_aspects || []), ...(next.human_owned_aspects || [])]),
    allowed_change_classes: stableSortedStrings([...(existing.allowed_change_classes || []), ...(next.allowed_change_classes || [])]),
    drift_signals: stableSortedStrings([...(existing.drift_signals || []), ...(next.drift_signals || [])]),
    proof_stories: stableSortedStrings([
      ...(existing.proof_stories || []).map((item) => JSON.stringify(item)),
      ...(next.proof_stories || []).map((item) => JSON.stringify(item))
    ]).map((item) => JSON.parse(item))
  };
}

export function buildMaintainedSeams(proofStories = []) {
  const seams = new Map();

  for (const story of proofStories || []) {
    for (const seamLabel of story.humanOwnedSeams || story.human_owned_seams || []) {
      const output = maintainedOutputDescriptor(story.maintainedFiles || story.maintained_files || []);
      const seam = {
        seam_id: `seam_${seamIdHint(seamLabel)}`,
        seam_family_id: story.seamFamilyId || story.seam_family_id || null,
        seam_family_label: story.seamFamilyLabel || story.seam_family_label || null,
        output_id: output.output_id,
        label: seamLabel,
        kind: maintainedSeamKind(seamLabel),
        ownership_class: maintainedSeamOwnershipClass(story.classification),
        status: maintainedSeamStatus(story.reviewBoundary || story.review_boundary),
        maintained_modules: story.maintainedFiles || story.maintained_files || [],
        emitted_dependencies: story.emittedDependencies || story.emitted_dependencies || [],
        human_owned_aspects: [seamLabel],
        allowed_change_classes: maintainedSeamAllowedChangeClasses(story.classification),
        drift_signals: maintainedSeamDriftSignals(story.emittedDependencies || story.emitted_dependencies || []),
        proof_stories: [
          {
            classification: story.classification || null,
            relativePath: story.relativePath || story.relative_path || null,
            review_boundary: story.reviewBoundary || story.review_boundary || null
          }
        ]
      };
      seams.set(seam.seam_id, mergeMaintainedSeam(seams.get(seam.seam_id), seam));
    }
  }

  return [...seams.values()].sort((a, b) => a.seam_id.localeCompare(b.seam_id));
}

export function buildMaintainedOutputs({
  seams = [],
  proofStories = [],
  ownershipBoundary = ownershipBoundaryForMaintainedSurface(),
  verificationTargets = null,
  graph = null
} = {}) {
  const outputs = new Map();

  for (const seam of seams || []) {
    const descriptor = maintainedOutputDescriptor(seam.maintained_modules || []);
    const outputId = seam.output_id || descriptor.output_id;
    const existing = outputs.get(outputId) || {
      output_id: outputId,
      label: descriptor.label,
      kind: descriptor.kind,
      root_paths: descriptor.root_paths,
      ownership_boundary: ownershipBoundary,
      verification_targets: verificationTargets || null,
      maintained_files_in_scope: [],
      human_owned_seams: [],
      seams: [],
      proof_stories: []
    };

    existing.maintained_files_in_scope = stableSortedStrings([
      ...existing.maintained_files_in_scope,
      ...(seam.maintained_modules || [])
    ]);
    existing.human_owned_seams = stableSortedStrings([
      ...existing.human_owned_seams,
      seam.label
    ]);
    existing.seams.push({
      ...seam,
      output_id: outputId
    });
    outputs.set(outputId, existing);
  }

  for (const story of proofStories || []) {
    const descriptor = maintainedOutputDescriptor(story.maintainedFiles || story.maintained_files || []);
    const outputId = descriptor.output_id;
    const existing = outputs.get(outputId) || {
      output_id: outputId,
      label: descriptor.label,
      kind: descriptor.kind,
      root_paths: descriptor.root_paths,
      ownership_boundary: ownershipBoundary,
      verification_targets: verificationTargets || null,
      maintained_files_in_scope: [],
      human_owned_seams: [],
      seams: [],
      proof_stories: []
    };

    existing.maintained_files_in_scope = stableSortedStrings([
      ...existing.maintained_files_in_scope,
      ...(story.maintainedFiles || story.maintained_files || [])
    ]);
    existing.human_owned_seams = stableSortedStrings([
      ...existing.human_owned_seams,
      ...(story.humanOwnedSeams || story.human_owned_seams || [])
    ]);
    existing.proof_stories.push(story);
    outputs.set(outputId, existing);
  }

  const verificationTargetsForOutput = (output) => {
    if (!graph) {
      return output.verification_targets || verificationTargets || null;
    }

    const emittedDependencies = stableSortedStrings([
      ...output.seams.flatMap((seam) => seam.emitted_dependencies || []),
      ...output.proof_stories.flatMap((story) => story.emittedDependencies || story.emitted_dependencies || [])
    ]);
    const verificationIds = stableSortedStrings(
      emittedDependencies.filter((id) => String(id).startsWith("ver_"))
    );
    const generatedDependencyTargets = emittedDependencies.filter((id) => !String(id).startsWith("ver_"));
    const targetIds = stableSortedStrings([...verificationIds, ...generatedDependencyTargets]);
    const includeMaintainedApp = output.kind === "maintained_runtime" || output.kind === "web_app" || output.kind === "mobile_app";

    const routedTargets = recommendedVerificationTargets(graph, targetIds, {
      includeMaintainedApp,
      rationale: `${output.label || output.output_id || "Maintained output"} should run the smallest verification set tied to its own emitted dependencies and maintained seams.`
    });

    return {
      ...routedTargets,
      verification_ids: stableSortedStrings([
        ...(routedTargets.verification_ids || []),
        ...(verificationTargets?.verification_ids || []).filter((id) => verificationIds.includes(id))
      ]),
      generated_checks: stableSortedStrings([
        ...(routedTargets.generated_checks || []),
        ...(verificationTargets?.generated_checks || []).filter((check) => routedTargets.generated_checks?.includes(check))
      ]),
      maintained_app_checks: includeMaintainedApp
        ? stableSortedStrings([
            ...(routedTargets.maintained_app_checks || []),
            ...(verificationTargets?.maintained_app_checks || [])
          ])
        : []
    };
  };

  return [...outputs.values()]
    .map((output) => ({
      ...output,
      verification_targets: verificationTargetsForOutput(output),
      write_scope: graph ? buildMaintainedWriteScope(graph, output.maintained_files_in_scope) : null,
      seams: [...output.seams].sort((a, b) => String(a.seam_id || "").localeCompare(String(b.seam_id || ""))),
      proof_stories: [...output.proof_stories]
    }))
    .sort((a, b) => a.output_id.localeCompare(b.output_id));
}

export function relativePathFromGraph(graph, targetPath) {
  return path.relative(repoRootFromGraph(graph), targetPath);
}

export function jsonByteSize(value) {
  return Buffer.byteLength(JSON.stringify(value));
}

export function jsonLineCount(value) {
  return JSON.stringify(value, null, 2).split("\n").length;
}

export function percentOf(part, whole) {
  if (!whole) {
    return 0;
  }
  return Number(((part / whole) * 100).toFixed(2));
}

export function buildDefaultWriteScope() {
  return {
    safe_to_edit: ["topogram/**", "candidates/**"],
    generator_owned: ["artifacts/**", "apps/**"],
    human_owned_review_required: ["examples/maintained/proof-app/**"],
    out_of_bounds: [".git/**", "node_modules/**"]
  };
}

export function buildMaintainedWriteScope(graph, maintainedFiles = []) {
  return {
    safe_to_edit: stableSortedStrings(maintainedFiles),
    generator_owned: ["artifacts/**", "apps/**"],
    human_owned_review_required: stableSortedStrings([
      ...maintainedFiles,
      "examples/maintained/proof-app/**"
    ]),
    out_of_bounds: ["topogram/**"]
  };
}

export function recommendedVerificationTargets(graph, targetIds = [], options = {}) {
  const verificationIds = verificationIdsForTarget(graph, targetIds);
  const base = {
    verification_ids: verificationIds,
    generated_checks: verificationIds.length > 0 ? ["compile-check", "runtime-check"] : ["compile-check"],
    maintained_app_checks: [],
    rationale: options.rationale || null
  };

  if (options.includeMaintainedApp) {
    base.maintained_app_checks = [
      "examples/maintained/proof-app/scripts/compile-check.mjs",
      "examples/maintained/proof-app/scripts/smoke.mjs",
      "examples/maintained/proof-app/scripts/runtime-check.mjs"
    ];
  }

  return base;
}

export {
  docIds,
  refIds,
  stableSortedStrings,
  summarizeProjection,
  summarizeRule,
  summarizeStatement,
  summarizeVerification
};

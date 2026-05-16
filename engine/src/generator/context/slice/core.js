// @ts-check

import {
  buildDefaultWriteScope,
  ensureContextSelection,
  getStatement,
  getWorkflowDoc,
  relatedCapabilitiesForEntity,
  relatedCapabilitiesForProjection,
  relatedEntitiesForProjection,
  relatedJourneysForCapability,
  relatedProjectionsForCapability,
  relatedProjectionsForEntity,
  relatedProjectionsForWidget,
  relatedRulesForTarget,
  relatedShapesForEntity,
  relatedShapesForProjection,
  relatedShapesForWidget,
  relatedWidgetsForProjection,
  relatedWorkflowDocsForCapability,
  summarizeById,
  summarizeDocsByIds,
  summarizeJourneyLikeByIds,
  summarizeProjection,
  summarizeStatementsByIds,
  verificationIdsForTarget,
  recommendedVerificationTargets,
  widgetById
} from "../shared.js";
import {
  defaultOwnershipBoundary,
  reviewBoundaryForCapability,
  reviewBoundaryForEntity,
  reviewBoundaryForWorkflowDoc
} from "../../../policy/review-boundaries.js";
import { uiAgentPacketForProjection, uiAgentPacketForWidget } from "./ui-packets.js";
import {
  acceptanceCriterionSlice,
  bugSlice,
  documentSlice,
  domainSlice,
  journeySlice,
  pitchSlice,
  planSlice,
  requirementSlice,
  taskSlice
} from "./sdlc.js";

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} capabilityId
 * @returns {any}
 */
function capabilitySlice(graph, capabilityId) {
  const capability = getStatement(graph, "capability", capabilityId);
  const shapes = [...new Set([...(capability.input || []).map(/** @param {any} item */ (item) => item.id), ...(capability.output || []).map(/** @param {any} item */ (item) => item.id)])].sort();
  const entities = [...new Set([
    ...(capability.reads || []).map(/** @param {any} item */ (item) => item.id),
    ...(capability.creates || []).map(/** @param {any} item */ (item) => item.id),
    ...(capability.updates || []).map(/** @param {any} item */ (item) => item.id),
    ...(capability.deletes || []).map(/** @param {any} item */ (item) => item.id)
  ])].sort();
  const rules = relatedRulesForTarget(graph, capabilityId);
  const workflows = relatedWorkflowDocsForCapability(graph, capabilityId).map(/** @param {any} doc */ (doc) => doc.id).sort();
  const projections = relatedProjectionsForCapability(graph, capabilityId);
  const journeys = relatedJourneysForCapability(graph, capabilityId).map(/** @param {any} doc */ (doc) => doc.id).sort();
  const verifications = verificationIdsForTarget(graph, [capabilityId, ...projections, ...shapes, ...entities]);

  return {
    type: "context_slice",
    version: 1,
    focus: {
      kind: "capability",
      id: capabilityId
    },
    summary: summarizeById(graph, capabilityId),
    depends_on: {
      shapes,
      entities,
      rules,
      workflows,
      projections,
      journeys,
      verifications
    },
    related: {
      shapes: summarizeStatementsByIds(graph, shapes),
      entities: summarizeStatementsByIds(graph, entities),
      rules: summarizeStatementsByIds(graph, rules),
      workflows: summarizeDocsByIds(graph, workflows),
      journeys: summarizeJourneyLikeByIds(graph, journeys),
      projections: summarizeStatementsByIds(graph, projections)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [capabilityId, ...projections, ...shapes, ...entities], {
      rationale: "Capability slice should point agents at the smallest verification set covering affected API/UI/DB surfaces."
    }),
    write_scope: buildDefaultWriteScope(),
    review_boundary: reviewBoundaryForCapability(capability),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} workflowId
 * @returns {any}
 */
function workflowSlice(graph, workflowId) {
  const workflow = getWorkflowDoc(graph, workflowId);
  const capabilities = [...(workflow.relatedCapabilities || [])].sort();
  const entities = [...new Set(capabilities.flatMap(/** @param {string} capabilityId */ (capabilityId) => {
    const capability = getStatement(graph, "capability", capabilityId);
    return [
      ...(capability.reads || []).map(/** @param {any} item */ (item) => item.id),
      ...(capability.creates || []).map(/** @param {any} item */ (item) => item.id),
      ...(capability.updates || []).map(/** @param {any} item */ (item) => item.id),
      ...(capability.deletes || []).map(/** @param {any} item */ (item) => item.id)
    ];
  }))].sort();
  const rules = [...new Set(capabilities.flatMap(/** @param {string} capabilityId */ (capabilityId) => relatedRulesForTarget(graph, capabilityId)))].sort();
  const journeys = [
    ...(graph.byKind?.journey || []),
    ...(graph.docs || []).filter(/** @param {any} doc */ (doc) => doc.kind === "journey")
  ]
    .filter(/** @param {any} journey */ (journey) => (journey.relatedWorkflows || []).includes(workflowId))
    .map(/** @param {any} journey */ (journey) => journey.id)
    .sort();
  const verifications = verificationIdsForTarget(graph, [...capabilities, ...entities, workflowId]);

  return {
    type: "context_slice",
    version: 1,
    focus: {
      kind: "workflow",
      id: workflowId
    },
    summary: summarizeById(graph, workflowId),
    depends_on: {
      capabilities,
      entities,
      rules,
      journeys,
      verifications
    },
    related: {
      capabilities: summarizeStatementsByIds(graph, capabilities),
      entities: summarizeStatementsByIds(graph, entities),
      rules: summarizeStatementsByIds(graph, rules),
      journeys: summarizeJourneyLikeByIds(graph, journeys)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [...capabilities, ...entities, workflowId], {
      rationale: "Workflow changes should re-run workflow-linked verification and human review on semantic behavior."
    }),
    write_scope: buildDefaultWriteScope(),
    review_boundary: reviewBoundaryForWorkflowDoc(workflow),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} projectionId
 * @returns {any}
 */
function projectionSlice(graph, projectionId) {
  const projection = getStatement(graph, "projection", projectionId);
  const capabilities = relatedCapabilitiesForProjection(projection);
  const entities = relatedEntitiesForProjection(projection);
  const shapes = relatedShapesForProjection(projection);
  const widgets = relatedWidgetsForProjection(graph, projection);
  const rules = [...new Set(capabilities.flatMap(/** @param {string} capabilityId */ (capabilityId) => relatedRulesForTarget(graph, capabilityId)))].sort();
  const verifications = verificationIdsForTarget(graph, [projectionId, ...capabilities, ...entities, ...shapes, ...widgets]);

  return {
    type: "context_slice",
    version: 1,
    focus: {
      kind: "projection",
      id: projectionId
    },
    summary: summarizeProjection(projection),
    depends_on: {
      entities,
      shapes,
      capabilities,
      widgets,
      rules,
      verifications
    },
    related: {
      entities: summarizeStatementsByIds(graph, entities),
      shapes: summarizeStatementsByIds(graph, shapes),
      capabilities: summarizeStatementsByIds(graph, capabilities),
      widgets: summarizeStatementsByIds(graph, widgets),
      rules: summarizeStatementsByIds(graph, rules)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [projectionId, ...capabilities, ...entities, ...shapes, ...widgets], {
      rationale: "Projection slices affect generated contract and runtime surfaces, so verification should follow the projection closure."
    }),
    ui_agent_packet: uiAgentPacketForProjection(graph, projection),
    write_scope: buildDefaultWriteScope(),
    review_boundary: projection.reviewBoundary || {
      automation_class: "review_required",
      reasons: ["projection_surface"]
    },
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} entityId
 * @returns {any}
 */
function entitySlice(graph, entityId) {
  const entity = getStatement(graph, "entity", entityId);
  const shapes = relatedShapesForEntity(graph, entityId);
  const capabilities = relatedCapabilitiesForEntity(graph, entityId);
  const rules = [...new Set([
    ...relatedRulesForTarget(graph, entityId),
    ...capabilities.flatMap(/** @param {string} capabilityId */ (capabilityId) => relatedRulesForTarget(graph, capabilityId))
  ])].sort();
  const projections = relatedProjectionsForEntity(graph, entityId);
  const verifications = verificationIdsForTarget(graph, [entityId, ...shapes, ...capabilities, ...projections]);

  return {
    type: "context_slice",
    version: 1,
    focus: {
      kind: "entity",
      id: entityId
    },
    summary: summarizeById(graph, entityId),
    depends_on: {
      shapes,
      capabilities,
      rules,
      projections,
      verifications
    },
    related: {
      shapes: summarizeStatementsByIds(graph, shapes),
      capabilities: summarizeStatementsByIds(graph, capabilities),
      rules: summarizeStatementsByIds(graph, rules),
      projections: summarizeStatementsByIds(graph, projections)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [entityId, ...shapes, ...capabilities, ...projections], {
      rationale: "Entity changes usually affect schema, projection, and capability semantics together."
    }),
    write_scope: buildDefaultWriteScope(),
    review_boundary: reviewBoundaryForEntity(entity),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} widgetId
 * @returns {any}
 */
function widgetSlice(graph, widgetId) {
  const widget = widgetById(graph, widgetId);
  if (!widget) {
    throw new Error(`No widget found with id '${widgetId}'`);
  }
  const dependencyIds = widgetDependencyIdsByKind(widget);
  const shapes = relatedShapesForWidget(widget);
  const entities = dependencyIds.entity;
  const capabilities = dependencyIds.capability;
  const projections = relatedProjectionsForWidget(graph, widgetId);
  const widgetDependencies = dependencyIds.widget;
  const verificationScope = [widgetId, ...shapes, ...entities, ...capabilities, ...projections, ...widgetDependencies];
  const verifications = verificationIdsForTarget(graph, verificationScope);

  return {
    type: "context_slice",
    version: 1,
    focus: {
      kind: "widget",
      id: widgetId
    },
    summary: summarizeById(graph, widgetId),
    depends_on: {
      shapes,
      entities,
      capabilities,
      widgets: widgetDependencies,
      projections,
      verifications
    },
    related: {
      shapes: summarizeStatementsByIds(graph, shapes),
      entities: summarizeStatementsByIds(graph, entities),
      capabilities: summarizeStatementsByIds(graph, capabilities),
      widgets: summarizeStatementsByIds(graph, widgetDependencies),
      projections: summarizeStatementsByIds(graph, projections)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, verificationScope, {
      rationale: "Widget changes affect every related projection, so verification should follow the widget contract closure."
    }),
    ui_agent_packet: uiAgentPacketForWidget(graph, widget, projections),
    write_scope: buildDefaultWriteScope(),
    review_boundary: {
      automation_class: "review_required",
      reasons: ["widget_surface"]
    },
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextWidget} widget
 * @returns {any}
 */
function widgetDependencyIdsByKind(widget) {
  const ids = /** @type {Record<string, string[]>} */ ({
    shape: [],
    entity: [],
    capability: [],
    projection: [],
    widget: []
  });

  for (const dependency of widget.dependencies || []) {
    const kind = widgetDependencyKind(dependency);
    if (kind && dependency.id && Object.hasOwn(ids, kind)) {
      ids[kind].push(dependency.id);
    }
  }

  return Object.fromEntries(
    Object.entries(ids).map(([kind, values]) => [kind, [...new Set(values.filter(Boolean))].sort()])
  );
}

/**
 * @param {import("../shared/types.d.ts").ContextReference} dependency
 * @returns {any}
 */
function widgetDependencyKind(dependency) {
  if (dependency?.target?.kind) {
    return dependency.target.kind === "component" ? "widget" : dependency.target.kind;
  }
  const id = String(dependency?.id || "");
  const prefix = id.split("_")[0];
  if (prefix === "proj") {
    return "projection";
  }
  if (prefix === "cap") {
    return "capability";
  }
  if (prefix === "component") {
    return "widget";
  }
  return prefix || null;
}

const STANDING_RULE_IDS = [
  "rule_tests_prove_consumer_value",
  "rule_maintainable_security_focused_code",
  "rule_stateful_workflow_mutations_use_cli"
];

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} id
 * @returns {any|null}
 */
function statementById(graph, id) {
  for (const statements of Object.values(graph.byKind || {})) {
    const found = (statements || []).find(/** @param {any} statement */ (statement) => statement.id === id);
    if (found) return found;
  }
  return null;
}

/**
 * @param {any} value
 * @param {Set<string>} ids
 * @returns {void}
 */
function collectStringIds(value, ids) {
  if (typeof value === "string") {
    ids.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringIds(item, ids);
    return;
  }
  if (value && typeof value === "object") {
    if (typeof value.id === "string") ids.add(value.id);
    for (const nested of Object.values(value)) collectStringIds(nested, ids);
  }
}

/**
 * @param {any} statement
 * @returns {string[]}
 */
function termIdsForStatement(statement) {
  const ids = [
    ...(statement?.relatedTerms || []),
    ...(statement?.usesTerms || [])
  ].map(/** @param {any} ref */ (ref) => ref?.id || ref).filter(Boolean);
  return [...new Set(ids)].sort();
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {any} slice
 * @returns {string[]}
 */
function relatedTermIdsForSlice(graph, slice) {
  const candidateIds = new Set();
  collectStringIds(slice.focus, candidateIds);
  collectStringIds(slice.depends_on, candidateIds);
  collectStringIds(slice.summary, candidateIds);
  const termIds = new Set();
  for (const id of candidateIds) {
    const statement = statementById(graph, id);
    if (!statement || statement.kind === "term") continue;
    for (const termId of termIdsForStatement(statement)) termIds.add(termId);
  }
  return [...termIds].sort();
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @returns {string[]}
 */
function standingRuleIds(graph) {
  return STANDING_RULE_IDS
    .filter((id) => {
      const rule = statementById(graph, id);
      return rule?.kind === "rule" && rule.status === "enforced";
    })
    .sort();
}

/**
 * @param {string|null|undefined} modeId
 * @returns {string}
 */
function normalizedMode(modeId) {
  if (modeId === "maintained-app-edit") return "maintained-app";
  if (modeId === "diff-review") return "review";
  return modeId || "implementation";
}

/**
 * @param {any} focus
 * @returns {string}
 */
function selectorForFocus(focus) {
  /** @type {Record<string, string>} */
  const flagByKind = {
    capability: "--capability",
    workflow: "--workflow",
    projection: "--projection",
    widget: "--widget",
    entity: "--entity",
    journey: "--journey",
    surface: "--surface",
    domain: "--domain",
    pitch: "--pitch",
    requirement: "--requirement",
    acceptance_criterion: "--acceptance",
    task: "--task",
    plan: "--plan",
    bug: "--bug",
    document: "--document"
  };
  const flag = flagByKind[focus?.kind] || "--id";
  return `${flag} ${focus?.id || "<id>"}`;
}

/**
 * @param {any} slice
 * @param {string|null|undefined} modeId
 * @returns {any}
 */
function buildAgentGuidance(slice, modeId) {
  const mode = normalizedMode(modeId);
  const selector = selectorForFocus(slice.focus);
  const commonCommands = [
    "topogram check . --json",
    "topogram sdlc check . --strict",
    "topogram sdlc prep commit . --json"
  ];
  /** @type {Record<string, string[]>} */
  const modeCommands = {
    modeling: ["topogram query slice ./topo --mode modeling " + selector + " --json"],
    implementation: ["topogram query sdlc-proof-gaps ./topo " + (slice.focus?.kind === "task" ? `--task ${slice.focus.id}` : "--json")],
    review: ["topogram query review-packet ./topo --mode review " + selector + " --json"],
    verification: ["topogram query verification-targets ./topo --mode verification " + selector + " --json"],
    "extract-adopt": ["topogram extract plan . --json", "topogram adopt --list . --json"],
    "maintained-app": ["topogram emit context-slice ./topo " + selector + " --json"],
    "generated-app": ["topogram generate .", "npm run verify"],
    release: ["topogram release status --strict --json"]
  };
  const warnings = [];
  if (mode === "maintained-app") {
    warnings.push("Do not overwrite maintained app output with generation; use emitted contracts and focused queries as implementation context.");
  }
  if (mode === "generated-app") {
    warnings.push("Generated-owned outputs may be refreshed by topogram generate; edit the Topogram source first.");
  }
  if (mode === "extract-adopt") {
    warnings.push("Extraction candidates are review-only until explicitly adopted.");
  }
  return {
    mode,
    read_first: ["focus", "summary", "depends_on", "related", "standing_rules", "verification_targets", "write_scope"],
    next_queries: [
      `topogram query slice ./topo --mode ${mode} ${selector} --json`,
      `topogram query single-agent-plan ./topo --mode ${mode} ${selector} --json`
    ],
    required_commands: [...(modeCommands[mode] || []), ...commonCommands],
    completion_command: "topogram sdlc prep commit . --json",
    warnings,
    write_scope_summary: slice.write_scope?.summary || "Edit the canonical Topogram source and project-owned files only; generated-owned outputs should be regenerated."
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {any} slice
 * @param {import("../shared/types.d.ts").ContextSelectionOptions} options
 * @returns {any}
 */
function decorateSlice(graph, slice, options) {
  const termIds = relatedTermIdsForSlice(graph, slice);
  const standingRules = standingRuleIds(graph);
  return {
    ...slice,
    depends_on: {
      ...(slice.depends_on || {}),
      ...(termIds.length > 0 ? { terms: termIds } : {})
    },
    related: {
      ...(slice.related || {}),
      ...(termIds.length > 0 ? { terms: summarizeStatementsByIds(graph, termIds) } : {})
    },
    standing_rules: summarizeStatementsByIds(graph, standingRules),
    agent_guidance: buildAgentGuidance(slice, options.modeId)
  };
}


/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {import("../shared/types.d.ts").ContextSelectionOptions} options
 * @returns {any}
 */
export function generateContextSlice(graph, options = {}) {
  const selection = ensureContextSelection({
    capabilityId: options.capabilityId,
    workflowId: options.workflowId,
    projectionId: options.projectionId,
    componentId: options.widgetId || options.componentId,
    entityId: options.entityId,
    journeyId: options.journeyId,
    surfaceId: options.surfaceId,
    domainId: options.domainId,
    pitchId: options.pitchId,
    requirementId: options.requirementId,
    acceptanceId: options.acceptanceId,
    taskId: options.taskId,
    planId: options.planId,
    bugId: options.bugId,
    documentId: options.documentId
  });

  let slice = null;
  if (selection.kind === "capability") slice = capabilitySlice(graph, selection.id);
  if (selection.kind === "workflow") slice = workflowSlice(graph, selection.id);
  if (selection.kind === "projection") slice = projectionSlice(graph, selection.id);
  if (selection.kind === "widget") slice = widgetSlice(graph, selection.id);
  if (selection.kind === "entity") slice = entitySlice(graph, selection.id);
  if (selection.kind === "journey") slice = journeySlice(graph, selection.id);
  if (selection.kind === "domain") slice = domainSlice(graph, selection.id);
  if (selection.kind === "pitch") slice = pitchSlice(graph, selection.id);
  if (selection.kind === "requirement") slice = requirementSlice(graph, selection.id);
  if (selection.kind === "acceptance_criterion") slice = acceptanceCriterionSlice(graph, selection.id);
  if (selection.kind === "task") slice = taskSlice(graph, selection.id);
  if (selection.kind === "plan") slice = planSlice(graph, selection.id);
  if (selection.kind === "bug") slice = bugSlice(graph, selection.id);
  if (selection.kind === "document") slice = documentSlice(graph, selection.id);

  if (slice) {
    return decorateSlice(graph, slice, options);
  }

  throw new Error(`Unsupported context slice kind '${selection.kind}'`);
}

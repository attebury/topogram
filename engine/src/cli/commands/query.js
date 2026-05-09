// @ts-check

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../../format.js";
import { generateWorkspace } from "../../generator.js";
import { recommendedVerificationTargets } from "../../generator/context/shared.js";
import { parsePath } from "../../parser.js";
import { resolveWorkspace } from "../../resolver.js";
import { formatValidationErrors } from "../../validator.js";
import {
  buildAuthHintsQueryPayload,
  buildAuthReviewPacketPayload,
  buildCanonicalWritesPayloadForChangePlan,
  buildCanonicalWritesPayloadForImportPlan,
  buildChangePlanPayload,
  buildHandoffStatusPayload,
  buildImportPlanPayload,
  buildLaneStatusPayload,
  buildMaintainedConformancePayload,
  buildMaintainedDriftPayload,
  buildMaintainedRiskSummary,
  buildMultiAgentPlanPayload,
  buildResolvedWorkflowContextPayload,
  buildReviewPacketPayloadForChangePlan,
  buildReviewPacketPayloadForImportPlan,
  buildRiskSummaryPayload,
  buildSeamCheckPayload,
  buildSingleAgentPlanPayload,
  buildWorkflowPresetActivationPayload,
  buildWorkflowPresetCustomizationPayload,
  buildWorkflowPresetDiffPayload,
  buildWorkflowPresetState,
  buildWorkPacketPayload,
  classifyRisk,
  proceedDecisionFromRisk,
  summarizeDiffArtifact
} from "../../agent-ops/query-builders.js";

/**
 * @typedef {{
 *   name: string,
 *   purpose: string,
 *   description: string,
 *   selectors: string[],
 *   args: string[],
 *   output: string,
 *   example: string
 * }} QueryDefinition
 *
 * @typedef {{
 *   type: "query_list",
 *   version: 1,
 *   queries: QueryDefinition[]
 * }} QueryListPayload
 *
 * @typedef {{
 *   type: "query_definition",
 *   version: 1,
 *   query: QueryDefinition
 * }} QueryDefinitionPayload
 */

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @returns {QueryDefinition[]}
 */
export function queryDefinitions() {
  return [
    {
      name: "slice",
      purpose: "Give an agent the smallest graph slice needed to reason about one selected semantic surface.",
      description: "Return a focused semantic context slice for one selected surface.",
      selectors: ["capability", "workflow", "projection", "widget", "entity", "journey", "domain"],
      args: ["[path]", "[selectors]", "[--json]"],
      output: "context_slice",
      example: "topogram query slice ./topogram --widget widget_data_grid"
    },
    {
      name: "verification-targets",
      purpose: "Map a selected change or mode to the smallest verification set worth running.",
      description: "Return the smallest verification target set for a mode, selector, or diff.",
      selectors: ["mode", "capability", "workflow", "projection", "widget", "entity", "journey", "from-topogram"],
      args: ["[path]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "verification_targets",
      example: "topogram query verification-targets ./topogram --widget widget_data_grid"
    },
    {
      name: "widget-behavior",
      purpose: "Show how reusable widget behavior is realized by projection usage.",
      description: "Return widget behavior realization data grouped by widget, screen, capability, and effect.",
      selectors: ["projection", "widget"],
      args: ["[path]", "[--projection <id>]", "[--widget <id>]", "[--json]"],
      output: "widget_behavior_report",
      example: "topogram query widget-behavior ./topogram --projection proj_web_surface --widget widget_data_grid --json"
    },
    {
      name: "change-plan",
      purpose: "Summarize what a selected change affects before code or Topogram edits start.",
      description: "Return the semantic change plan, generator targets, risk, and alignment recommendations.",
      selectors: ["mode", "capability", "workflow", "projection", "widget", "entity", "journey", "surface", "from-topogram"],
      args: ["[path]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "change_plan_query",
      example: "topogram query change-plan ./topogram --widget widget_data_grid"
    },
    {
      name: "review-packet",
      purpose: "Bundle the context a human or agent needs to review a selected semantic change.",
      description: "Return the review packet for a selected change or diff.",
      selectors: ["mode", "capability", "workflow", "projection", "widget", "entity", "journey", "surface", "from-topogram"],
      args: ["[path]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "review_packet_query",
      example: "topogram query review-packet ./topogram --widget widget_data_grid"
    },
    {
      name: "resolved-workflow-context",
      purpose: "Resolve workflow guidance and artifact load order for a selected mode or change.",
      description: "Return resolved workflow guidance, artifact load order, preset policy, and recommended artifact queries.",
      selectors: ["mode", "capability", "workflow", "projection", "widget", "entity", "journey", "surface", "provider", "preset", "from-topogram"],
      args: ["[path]", "[--mode <id>]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "resolved_workflow_context_query",
      example: "topogram query resolved-workflow-context ./topogram --mode modeling --widget widget_data_grid --json"
    },
    {
      name: "single-agent-plan",
      purpose: "Give one coding agent a bounded plan, artifact set, and write guidance.",
      description: "Return a single-agent operating plan for a mode and optional selector.",
      selectors: ["mode", "capability", "workflow", "projection", "widget", "entity", "journey", "surface", "from-topogram"],
      args: ["[path]", "[--mode <id>]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "single_agent_plan_query",
      example: "topogram query single-agent-plan ./topogram --mode modeling --widget widget_data_grid --json"
    },
    {
      name: "risk-summary",
      purpose: "Surface behavioral, ownership, and verification risks for a selected change.",
      description: "Return the risk summary for a selected change, mode, or diff.",
      selectors: ["mode", "capability", "workflow", "projection", "widget", "entity", "journey", "surface", "from-topogram"],
      args: ["[path]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "risk_summary_query",
      example: "topogram query risk-summary ./topogram --widget widget_data_grid"
    },
    {
      name: "proceed-decision",
      purpose: "Tell a human or agent whether enough context and proof exist to proceed.",
      description: "Return a proceed/no-go decision for the current selected work.",
      selectors: ["mode", "capability", "workflow", "projection", "widget", "entity", "journey", "surface", "from-topogram"],
      args: ["[path]", "[--mode <id>]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "proceed_decision_query",
      example: "topogram query proceed-decision ./topogram --mode verification"
    },
    {
      name: "write-scope",
      purpose: "Define where an agent may edit for a selected semantic surface.",
      description: "Return safe edit boundaries for a selected mode or semantic surface.",
      selectors: ["mode", "capability", "workflow", "projection", "widget", "entity", "journey", "from-topogram"],
      args: ["[path]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "write_scope_query",
      example: "topogram query write-scope ./topogram --widget widget_data_grid"
    }
  ];
}

/**
 * @returns {QueryListPayload}
 */
export function buildQueryListPayload() {
  return {
    type: "query_list",
    version: 1,
    queries: queryDefinitions()
  };
}

/**
 * @param {string} name
 * @returns {QueryDefinitionPayload}
 */
export function buildQueryShowPayload(name) {
  const query = queryDefinitions().find((entry) => entry.name === name);
  if (!query) {
    const known = queryDefinitions().map((entry) => entry.name).join(", ");
    throw new Error(`Unknown query '${name}'. Run 'topogram query list' to inspect available queries. Known queries: ${known}`);
  }
  return {
    type: "query_definition",
    version: 1,
    query
  };
}

/**
 * @returns {void}
 */
export function printQueryHelp() {
  console.log("Usage: topogram query list [--json]");
  console.log("   or: topogram query show <name> [--json]");
  console.log("   or: topogram query widget-behavior [path] [--projection <id>] [--widget <id>] [--json]");
  console.log("   or: topogram query <name> [path] [selectors] [--json]");
  console.log("");
  console.log("Agent-facing queries return focused JSON packets for context, review, verification, and generation follow-up.");
  console.log("");
  console.log("Common queries:");
  for (const query of queryDefinitions()) {
    console.log(`  ${query.name}`);
    console.log(`    ${query.description}`);
    console.log(`    example: ${query.example}`);
  }
}

/**
 * @param {QueryDefinitionPayload} payload
 * @returns {void}
 */
export function printQueryDefinition(payload) {
  const query = payload.query;
  console.log(`Query: ${query.name}`);
  console.log(`Purpose: ${query.purpose}`);
  console.log(`Description: ${query.description}`);
  console.log(`Output: ${query.output}`);
  console.log(`Arguments: ${query.args.join(" ")}`);
  console.log(`Selectors: ${query.selectors.join(", ") || "none"}`);
  console.log(`Example: ${query.example}`);
}

/**
 * @param {QueryListPayload} payload
 * @returns {void}
 */
export function printQueryList(payload) {
  console.log("Topogram queries:");
  for (const query of payload.queries) {
    console.log(`- ${query.name}: ${query.description}`);
    console.log(`  selectors: ${query.selectors.join(", ") || "none"}`);
    console.log(`  example: ${query.example}`);
  }
}

/**
 * @param {string} inputPath
 * @returns {string}
 */
function normalizeTopogramPath(inputPath) {
  const absolute = path.resolve(inputPath);
  if (path.basename(absolute) === "topogram") {
    return absolute;
  }
  const candidate = path.join(absolute, "topogram");
  return fs.existsSync(candidate) ? candidate : absolute;
}

/**
 * @param {AnyRecord} taskModeArtifact
 * @param {string|null} providerId
 * @param {string|null} presetId
 * @param {string|null} queryFamily
 * @returns {AnyRecord}
 */
function workflowPresetSelectors(taskModeArtifact, providerId = null, presetId = null, queryFamily = null) {
  const categories = [];
  if (taskModeArtifact?.mode === "import-adopt") categories.push("provider_adoption");
  if (taskModeArtifact?.mode === "maintained-app-edit") categories.push("maintained_app");
  if ((taskModeArtifact?.verification_targets?.maintained_app_checks || []).length > 0) categories.push("maintained_boundary");
  return {
    mode: taskModeArtifact?.mode || null,
    task_class: taskModeArtifact?.mode || null,
    provider_id: providerId,
    preset_id: presetId,
    query_family: queryFamily,
    integration_categories: categories
  };
}

/**
 * @param {AnyRecord} options
 * @returns {AnyRecord[]}
 */
function generatorTargetsForWorkflowContext(options = {}) {
  const { graph, taskModeArtifact, sliceArtifact = null, diffArtifact = null, maintainedBoundaryArtifact = null } = options;
  if (!graph || !taskModeArtifact) {
    return [];
  }
  return buildChangePlanPayload({
    graph,
    taskModeArtifact,
    sliceArtifact,
    diffArtifact,
    maintainedBoundaryArtifact
  }).generator_targets || [];
}

/**
 * @param {AnyRecord} options
 * @returns {boolean}
 */
function importAdoptOnlyRequested(options = {}) {
  return options.modeId === "import-adopt" && !(
    options.capabilityId ||
    options.workflowId ||
    options.projectionId ||
    options.componentId ||
    options.entityId ||
    options.journeyId ||
    options.surfaceId ||
    options.domainId ||
    options.fromTopogramPath
  );
}

/**
 * @param {AnyRecord} result
 * @returns {boolean}
 */
function resultOk(result) {
  return Boolean(result?.ok);
}

/**
 * @param {AnyRecord} result
 * @returns {number}
 */
function printValidationFailure(result) {
  console.error(formatValidationErrors(result.validation));
  return 1;
}

/**
 * @param {AnyRecord} ast
 * @param {AnyRecord} selectors
 * @param {string} modeId
 * @param {string|null} fromTopogramPath
 * @returns {AnyRecord}
 */
function buildTaskMode(ast, selectors, modeId, fromTopogramPath = null) {
  return generateWorkspace(ast, {
    target: "context-task-mode",
    modeId,
    ...selectors,
    widgetId: selectors.componentId,
    fromTopogramPath
  });
}

/**
 * @param {AnyRecord} ast
 * @param {AnyRecord} selectors
 * @returns {AnyRecord}
 */
function buildSlice(ast, selectors) {
  return generateWorkspace(ast, {
    target: "context-slice",
    ...selectors,
    widgetId: selectors.componentId
  });
}

/**
 * @param {AnyRecord} ast
 * @returns {AnyRecord}
 */
function buildMaintainedBundle(ast) {
  return generateWorkspace(ast, {
    target: "context-bundle",
    taskId: "maintained-app"
  });
}

/**
 * @param {AnyRecord} ast
 * @param {string|null} fromTopogramPath
 * @returns {AnyRecord|null}
 */
function buildDiff(ast, fromTopogramPath) {
  return fromTopogramPath
    ? generateWorkspace(ast, {
        target: "context-diff",
        fromTopogramPath
      })
    : null;
}

/**
 * @param {AnyRecord|null} result
 * @returns {AnyRecord|null}
 */
function artifactOrNull(result) {
  return result?.artifact || null;
}

/**
 * @param {string} topogramRoot
 * @returns {string}
 */
function adoptionPlanPath(topogramRoot) {
  return path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
}

/**
 * @param {string} topogramRoot
 * @param {string} label
 * @returns {{ reportPath: string, adoptionStatusPath: string, adoptionPlanPath: string }}
 */
function requireReconcileArtifacts(topogramRoot, label) {
  const reportPath = path.join(topogramRoot, "candidates", "reconcile", "report.json");
  const adoptionStatusPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-status.json");
  const planPath = adoptionPlanPath(topogramRoot);
  if (!fs.existsSync(reportPath) || !fs.existsSync(adoptionStatusPath) || !fs.existsSync(planPath)) {
    throw new Error(`No reconcile ${label} artifacts found under '${path.join(topogramRoot, "candidates", "reconcile")}'. Run 'node ./src/cli.js reconcile ${topogramRoot}' first.`);
  }
  return { reportPath, adoptionStatusPath, adoptionPlanPath: planPath };
}

/**
 * @param {string} filePath
 * @returns {AnyRecord}
 */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * @param {AnyRecord} options
 * @returns {boolean}
 */
function hasSelectors(options) {
  return Boolean(
    options.capabilityId ||
    options.workflowId ||
    options.projectionId ||
    options.componentId ||
    options.entityId ||
    options.journeyId ||
    options.surfaceId ||
    options.domainId
  );
}

/**
 * @param {AnyRecord} options
 * @returns {boolean}
 */
function shouldUseImportAdoptPath(options) {
  const selectorOrDiff = hasSelectors(options) || Boolean(options.fromTopogramPath);
  return importAdoptOnlyRequested(options) || (!selectorOrDiff && !options.modeId);
}

/**
 * @param {AnyRecord} options
 * @returns {AnyRecord}
 */
function selectorOptions(options) {
  return {
    capabilityId: options.capabilityId,
    workflowId: options.workflowId,
    projectionId: options.projectionId,
    componentId: options.componentId,
    entityId: options.entityId,
    journeyId: options.journeyId,
    surfaceId: options.surfaceId,
    domainId: options.domainId
  };
}

/**
 * @param {AnyRecord} context
 * @param {string} defaultMode
 * @returns {{ ast: AnyRecord, resolved: AnyRecord, taskModeResult: AnyRecord, sliceResult: AnyRecord|null, diffResult: AnyRecord|null, maintainedBundleResult: AnyRecord|null, changePlan: AnyRecord, diffSummary: AnyRecord|null, maintainedRisk: AnyRecord }}
 */
function buildChangePlanContext(context, defaultMode = "modeling") {
  const ast = parsePath(context.inputPath);
  const resolved = resolveWorkspace(ast);
  if (!resultOk(resolved)) {
    return /** @type {any} */ ({ ast, resolved });
  }
  const selectors = selectorOptions(context);
  const effectiveModeId = context.modeId || defaultMode;
  const taskModeResult = buildTaskMode(ast, selectors, effectiveModeId, context.fromTopogramPath);
  if (!resultOk(taskModeResult)) {
    return /** @type {any} */ ({ ast, resolved, taskModeResult });
  }
  const sliceResult = hasSelectors(context) ? buildSlice(ast, selectors) : null;
  if (sliceResult && !resultOk(sliceResult)) {
    return /** @type {any} */ ({ ast, resolved, taskModeResult, sliceResult });
  }
  const diffResult = buildDiff(ast, context.fromTopogramPath);
  if (diffResult && !resultOk(diffResult)) {
    return /** @type {any} */ ({ ast, resolved, taskModeResult, sliceResult, diffResult });
  }
  const includeMaintainedBoundary =
    effectiveModeId === "maintained-app-edit" ||
    context.surfaceId === "maintained-boundary" ||
    Boolean(diffResult?.artifact?.affected_maintained_surfaces?.ownership_interpretation?.maintained_code_impact);
  const maintainedBundleResult = includeMaintainedBoundary ? buildMaintainedBundle(ast) : null;
  if (maintainedBundleResult && !resultOk(maintainedBundleResult)) {
    return /** @type {any} */ ({ ast, resolved, taskModeResult, sliceResult, diffResult, maintainedBundleResult });
  }
  const changePlan = buildChangePlanPayload({
    graph: resolved.graph,
    taskModeArtifact: taskModeResult.artifact,
    sliceArtifact: artifactOrNull(sliceResult),
    diffArtifact: artifactOrNull(diffResult),
    maintainedBoundaryArtifact: maintainedBundleResult?.artifact?.maintained_boundary || null
  });
  const diffSummary = changePlan.diff_summary || summarizeDiffArtifact(diffResult?.artifact || null);
  const maintainedRisk = buildMaintainedRiskSummary({
    maintainedImpacts: changePlan.maintained_impacts,
    maintainedBoundary: changePlan.maintained_boundary,
    diffSummary
  });
  return { ast, resolved, taskModeResult, sliceResult, diffResult, maintainedBundleResult, changePlan, diffSummary, maintainedRisk };
}

/**
 * @param {AnyRecord} context
 * @param {string} queryFamily
 * @returns {AnyRecord}
 */
function buildImportPlanForContext(context, queryFamily) {
  const topogramRoot = normalizeTopogramPath(context.inputPath);
  const planPath = adoptionPlanPath(topogramRoot);
  if (!fs.existsSync(planPath)) {
    throw new Error(`No agent adoption plan found at '${planPath}'`);
  }
  const adoptionPlan = readJson(planPath);
  const ast = parsePath(context.inputPath);
  const taskModeResult = buildTaskMode(ast, {}, "import-adopt");
  if (!resultOk(taskModeResult)) {
    return taskModeResult;
  }
  const maintainedBundleResult = buildMaintainedBundle(ast);
  if (!resultOk(maintainedBundleResult)) {
    return maintainedBundleResult;
  }
  const workflowPresets = buildWorkflowPresetState({
    workspace: topogramRoot,
    selectors: workflowPresetSelectors(taskModeResult.artifact, context.providerId, context.presetId, queryFamily)
  });
  return {
    ok: true,
    topogramRoot,
    taskModeResult,
    maintainedBundleResult,
    adoptionPlan,
    importPlan: buildImportPlanPayload(
      adoptionPlan,
      taskModeResult.artifact,
      maintainedBundleResult.artifact.maintained_boundary || null,
      workflowPresets
    )
  };
}

/**
 * @param {AnyRecord} context
 * @param {string} queryFamily
 * @returns {AnyRecord}
 */
function buildImportAdoptAgentContext(context, queryFamily) {
  const topogramRoot = normalizeTopogramPath(context.inputPath);
  const artifacts = requireReconcileArtifacts(topogramRoot, queryFamily);
  const ast = parsePath(context.inputPath);
  const taskModeResult = buildTaskMode(ast, {}, "import-adopt");
  if (!resultOk(taskModeResult)) {
    return taskModeResult;
  }
  const adoptionPlanArtifact = readJson(artifacts.adoptionPlanPath);
  const reconcileReport = readJson(artifacts.reportPath);
  const adoptionStatus = readJson(artifacts.adoptionStatusPath);
  const workflowPresets = buildWorkflowPresetState({
    workspace: topogramRoot,
    selectors: workflowPresetSelectors(taskModeResult.artifact, context.providerId, context.presetId, queryFamily)
  });
  const importPlan = buildImportPlanPayload(adoptionPlanArtifact, taskModeResult.artifact, null, workflowPresets);
  const resolvedWorkflowContext = buildResolvedWorkflowContextPayload({
    workspace: topogramRoot,
    taskModeArtifact: taskModeResult.artifact,
    importPlan,
    selectors: workflowPresetSelectors(taskModeResult.artifact, context.providerId, context.presetId, queryFamily)
  });
  const singleAgentPlan = buildSingleAgentPlanPayload({
    workspace: topogramRoot,
    taskModeArtifact: taskModeResult.artifact,
    importPlan,
    resolvedWorkflowContext
  });
  const multiAgentPlan = buildMultiAgentPlanPayload({
    workspace: topogramRoot,
    singleAgentPlan,
    importPlan,
    report: reconcileReport,
    adoptionStatus,
    resolvedWorkflowContext
  });
  return {
    ok: true,
    topogramRoot,
    taskModeResult,
    adoptionPlanArtifact,
    reconcileReport,
    adoptionStatus,
    importPlan,
    resolvedWorkflowContext,
    singleAgentPlan,
    multiAgentPlan
  };
}

/**
 * @param {AnyRecord} nextAction
 * @param {string|null} mode
 * @returns {string}
 */
function resolveRecommendedQueryFamily(nextAction, mode) {
  switch (nextAction?.kind) {
    case "review_staged":
    case "review_bundle":
    case "inspect_review_group":
    case "inspect_proposal_surface":
    case "customize_workflow_preset":
    case "refresh_workflow_preset_customization":
    case "import_declared_workflow_preset":
      return "import-plan";
    case "review_diff_impact":
    case "inspect_projection":
    case "inspect_diff":
    case "review_diff_boundaries":
      return "change-plan";
    case "inspect_maintained_impact":
    case "inspect_boundary_before_edit":
    case "run_maintained_checks":
      return "maintained-boundary";
    case "inspect_verification_targets":
      return "verification-targets";
    case "inspect_workspace_digest":
      return "single-agent-plan";
    default:
      break;
  }
  if (mode === "import-adopt") return "import-plan";
  if (mode === "maintained-app-edit") return "maintained-boundary";
  if (mode === "verification") return "verification-targets";
  return "change-plan";
}

/**
 * @param {AnyRecord} context
 * @returns {Promise<number|null>}
 */
export async function runQueryCommand(context) {
  const queryName = context.commandArgs?.queryName;
  const selectors = selectorOptions(context);
  const selectedWidgetId = context["componentId"];

  if (queryName === "task-mode") {
    const result = generateWorkspace(parsePath(context.inputPath), {
      target: "context-task-mode",
      modeId: context.modeId,
      ...selectors,
      widgetId: selectedWidgetId,
      fromTopogramPath: context.fromTopogramPath
    });
    if (!resultOk(result)) return printValidationFailure(result);
    console.log(stableStringify(result.artifact));
    return 0;
  }

  if (queryName === "diff") {
    const result = generateWorkspace(parsePath(context.inputPath), {
      target: "context-diff",
      fromTopogramPath: context.fromTopogramPath
    });
    if (!resultOk(result)) return printValidationFailure(result);
    console.log(stableStringify(result.artifact));
    return 0;
  }

  if (queryName === "slice") {
    const result = buildSlice(parsePath(context.inputPath), selectors);
    if (!resultOk(result)) return printValidationFailure(result);
    console.log(stableStringify(result.artifact));
    return 0;
  }

  if (queryName === "adoption-plan") {
    const topogramRoot = normalizeTopogramPath(context.inputPath);
    const planPath = adoptionPlanPath(topogramRoot);
    if (!fs.existsSync(planPath)) {
      throw new Error(`No agent adoption plan found at '${planPath}'`);
    }
    console.log(stableStringify(readJson(planPath)));
    return 0;
  }

  if (queryName === "maintained-boundary") {
    const result = buildMaintainedBundle(parsePath(context.inputPath));
    if (!resultOk(result)) return printValidationFailure(result);
    console.log(stableStringify(result.artifact.maintained_boundary));
    return 0;
  }

  if (queryName === "maintained-drift") {
    if (!context.fromTopogramPath) {
      throw new Error("query maintained-drift requires --from-topogram <path>.");
    }
    const ast = parsePath(context.inputPath);
    const diffResult = buildDiff(ast, context.fromTopogramPath);
    if (diffResult && !resultOk(diffResult)) return printValidationFailure(diffResult);
    const maintainedBundleResult = buildMaintainedBundle(ast);
    if (!resultOk(maintainedBundleResult)) return printValidationFailure(maintainedBundleResult);
    const taskModeResult = buildTaskMode(ast, {}, "diff-review", context.fromTopogramPath);
    if (!resultOk(taskModeResult)) return printValidationFailure(taskModeResult);
    console.log(stableStringify(buildMaintainedDriftPayload({
      diffArtifact: diffResult?.artifact || null,
      maintainedBoundaryArtifact: maintainedBundleResult.artifact.maintained_boundary || null,
      verificationTargets: maintainedBundleResult.artifact.verification_targets || taskModeResult.artifact.verification_targets || null,
      nextAction: taskModeResult.artifact.next_action || null
    })));
    return 0;
  }

  if (queryName === "maintained-conformance") {
    const ast = parsePath(context.inputPath);
    const resolved = resolveWorkspace(ast);
    if (!resultOk(resolved)) return printValidationFailure(resolved);
    const diffResult = buildDiff(ast, context.fromTopogramPath);
    if (diffResult && !resultOk(diffResult)) return printValidationFailure(diffResult);
    const maintainedBundleResult = buildMaintainedBundle(ast);
    if (!resultOk(maintainedBundleResult)) return printValidationFailure(maintainedBundleResult);
    const taskModeResult = buildTaskMode(ast, {}, context.fromTopogramPath ? "diff-review" : "verification", context.fromTopogramPath);
    if (!resultOk(taskModeResult)) return printValidationFailure(taskModeResult);
    console.log(stableStringify(buildMaintainedConformancePayload({
      graph: resolved.graph,
      diffArtifact: artifactOrNull(diffResult),
      maintainedBoundaryArtifact: maintainedBundleResult.artifact.maintained_boundary || null,
      verificationTargets: maintainedBundleResult.artifact.verification_targets || taskModeResult.artifact.verification_targets || null,
      nextAction: taskModeResult.artifact.next_action || null
    })));
    return 0;
  }

  if (queryName === "domain-list") {
    const result = generateWorkspace(parsePath(context.inputPath), { target: "domain-list" });
    if (!resultOk(result)) return printValidationFailure(result);
    console.log(stableStringify(result.artifact));
    return 0;
  }

  if (queryName === "domain-coverage") {
    if (!context.domainId) {
      console.error("query domain-coverage requires --domain <id>");
      return 2;
    }
    const result = generateWorkspace(parsePath(context.inputPath), { target: "domain-coverage", domainId: context.domainId });
    if (!resultOk(result)) return printValidationFailure(result);
    console.log(stableStringify(result.artifact));
    return 0;
  }

  if (queryName === "seam-check") {
    const ast = parsePath(context.inputPath);
    const resolved = resolveWorkspace(ast);
    if (!resultOk(resolved)) return printValidationFailure(resolved);
    const diffResult = buildDiff(ast, context.fromTopogramPath);
    if (diffResult && !resultOk(diffResult)) return printValidationFailure(diffResult);
    const maintainedBundleResult = buildMaintainedBundle(ast);
    if (!resultOk(maintainedBundleResult)) return printValidationFailure(maintainedBundleResult);
    const taskModeResult = buildTaskMode(ast, {}, context.fromTopogramPath ? "diff-review" : "verification", context.fromTopogramPath);
    if (!resultOk(taskModeResult)) return printValidationFailure(taskModeResult);
    console.log(stableStringify(buildSeamCheckPayload({
      graph: resolved.graph,
      maintainedBoundaryArtifact: maintainedBundleResult.artifact.maintained_boundary || null,
      diffArtifact: artifactOrNull(diffResult),
      verificationTargets: maintainedBundleResult.artifact.verification_targets || taskModeResult.artifact.verification_targets || null,
      nextAction: taskModeResult.artifact.next_action || null,
      seamId: context.seamId
    })));
    return 0;
  }

  if (queryName === "review-boundary") {
    const result = buildSlice(parsePath(context.inputPath), selectors);
    if (!resultOk(result)) return printValidationFailure(result);
    console.log(stableStringify({
      type: "review_boundary_query",
      focus: result.artifact.focus,
      review_boundary: result.artifact.review_boundary,
      ownership_boundary: result.artifact.ownership_boundary,
      write_scope: result.artifact.write_scope || null,
      verification_targets: result.artifact.verification_targets || null
    }));
    return 0;
  }

  if (queryName === "write-scope") {
    const ast = parsePath(context.inputPath);
    if (context.modeId || (!hasSelectors(context) && !context.fromTopogramPath)) {
      const result = buildTaskMode(ast, selectors, context.modeId || "verification", context.fromTopogramPath);
      if (!resultOk(result)) return printValidationFailure(result);
      console.log(stableStringify({
        type: "write_scope_query",
        source: "context-task-mode",
        mode: result.artifact.mode,
        summary: result.artifact.summary || null,
        rationale: "Task mode write scope is the safest file-boundary contract for the selected operating mode.",
        write_scope: result.artifact.write_scope || null
      }));
      return 0;
    }
    if (context.surfaceId === "maintained-boundary") {
      const result = buildMaintainedBundle(ast);
      if (!resultOk(result)) return printValidationFailure(result);
      console.log(stableStringify({
        type: "write_scope_query",
        source: "maintained-boundary",
        summary: {
          maintained_file_count: (result.artifact.maintained_boundary?.maintained_files_in_scope || []).length
        },
        rationale: "Maintained-boundary write scope isolates the human-owned application files currently in scope.",
        write_scope: result.artifact.write_scope || null
      }));
      return 0;
    }
    const result = buildSlice(ast, selectors);
    if (!resultOk(result)) return printValidationFailure(result);
    console.log(stableStringify({
      type: "write_scope_query",
      source: "context-slice",
      focus: result.artifact.focus,
      summary: result.artifact.summary || null,
      rationale: "Slice write scope is the narrowest file-boundary contract attached to the selected semantic surface.",
      write_scope: result.artifact.write_scope || null
    }));
    return 0;
  }

  if (queryName === "verification-targets") {
    const ast = parsePath(context.inputPath);
    if (context.modeId || (!hasSelectors(context) && !context.fromTopogramPath)) {
      const result = buildTaskMode(ast, selectors, context.modeId || "verification", context.fromTopogramPath);
      if (!resultOk(result)) return printValidationFailure(result);
      console.log(stableStringify({
        type: "verification_targets_query",
        source: "context-task-mode",
        mode: result.artifact.mode,
        summary: result.artifact.summary || null,
        verification_targets: result.artifact.verification_targets || null
      }));
      return 0;
    }
    if (context.fromTopogramPath) {
      const resolved = resolveWorkspace(ast);
      if (!resultOk(resolved)) return printValidationFailure(resolved);
      const result = buildDiff(ast, context.fromTopogramPath);
      if (result && !resultOk(result)) return printValidationFailure(result);
      const affectedVerificationIds = (result?.artifact?.affected_verifications || []).map((/** @type {AnyRecord} */ item) => item.id);
      const verificationTargets = recommendedVerificationTargets(resolved.graph, affectedVerificationIds, {
        includeMaintainedApp: Boolean(result?.artifact?.affected_maintained_surfaces?.ownership_interpretation?.maintained_code_impact),
        rationale: "Diff verification targets should cover the affected semantic proof set and any maintained-app proof gates."
      });
      console.log(stableStringify({
        type: "verification_targets_query",
        source: "context-diff",
        summary: {
          baseline_root: result?.artifact?.baseline_root,
          affected_verification_count: affectedVerificationIds.length,
          maintained_code_impact: Boolean(result?.artifact?.affected_maintained_surfaces?.ownership_interpretation?.maintained_code_impact)
        },
        verification_targets: verificationTargets,
        affected_verifications: result?.artifact?.affected_verifications || []
      }));
      return 0;
    }
    const result = buildSlice(ast, selectors);
    if (!resultOk(result)) return printValidationFailure(result);
    console.log(stableStringify({
      type: "verification_targets_query",
      source: "context-slice",
      focus: result.artifact.focus,
      summary: result.artifact.summary || null,
      verification_targets: result.artifact.verification_targets || null
    }));
    return 0;
  }

  if (queryName === "widget-behavior") {
    const result = generateWorkspace(parsePath(normalizeTopogramPath(context.inputPath)), {
      target: "widget-behavior-report",
      projectionId: context.projectionId,
      componentId: selectedWidgetId
    });
    if (!resultOk(result)) return printValidationFailure(result);
    console.log(stableStringify(result.artifact));
    return (result.artifact.summary?.errors || 0) === 0 ? 0 : 1;
  }

  if (queryName === "change-plan") {
    const built = buildChangePlanContext(context, "modeling");
    if (!resultOk(built.resolved)) return printValidationFailure(built.resolved);
    if (!resultOk(built.taskModeResult)) return printValidationFailure(built.taskModeResult);
    if (built.sliceResult && !resultOk(built.sliceResult)) return printValidationFailure(built.sliceResult);
    if (built.diffResult && !resultOk(built.diffResult)) return printValidationFailure(built.diffResult);
    if (built.maintainedBundleResult && !resultOk(built.maintainedBundleResult)) return printValidationFailure(built.maintainedBundleResult);
    console.log(stableStringify(built.changePlan));
    return 0;
  }

  if (queryName === "import-plan") {
    const built = buildImportPlanForContext(context, "import-plan");
    if (!resultOk(built)) return printValidationFailure(built);
    console.log(stableStringify(built.importPlan));
    return 0;
  }

  if (queryName === "risk-summary") {
    if (shouldUseImportAdoptPath(context) && fs.existsSync(adoptionPlanPath(normalizeTopogramPath(context.inputPath)))) {
      const built = buildImportPlanForContext(context, "risk-summary");
      if (!resultOk(built)) return printValidationFailure(built);
      const risk = classifyRisk({
        importPlan: built.importPlan,
        verificationTargets: built.importPlan.verification_targets,
        maintainedRisk: built.importPlan.maintained_risk || null
      });
      console.log(stableStringify(buildRiskSummaryPayload({
        source: "import-plan",
        risk,
        nextAction: built.importPlan.next_action || null,
        maintainedRisk: built.importPlan.maintained_risk || null
      })));
      return 0;
    }
    const built = buildChangePlanContext(context, "modeling");
    if (!resultOk(built.resolved)) return printValidationFailure(built.resolved);
    if (!resultOk(built.taskModeResult)) return printValidationFailure(built.taskModeResult);
    if (built.sliceResult && !resultOk(built.sliceResult)) return printValidationFailure(built.sliceResult);
    if (built.diffResult && !resultOk(built.diffResult)) return printValidationFailure(built.diffResult);
    if (built.maintainedBundleResult && !resultOk(built.maintainedBundleResult)) return printValidationFailure(built.maintainedBundleResult);
    const risk = classifyRisk({
      reviewBoundary: built.changePlan.review_boundary,
      maintainedBoundary: built.changePlan.maintained_boundary,
      diffSummary: built.diffSummary,
      verificationTargets: built.changePlan.verification_targets,
      maintainedRisk: built.maintainedRisk
    });
    console.log(stableStringify(buildRiskSummaryPayload({
      source: "change-plan",
      risk,
      nextAction: built.changePlan.next_action || null,
      maintainedRisk: built.maintainedRisk
    })));
    return 0;
  }

  if (queryName === "canonical-writes") {
    if (shouldUseImportAdoptPath(context) && fs.existsSync(adoptionPlanPath(normalizeTopogramPath(context.inputPath)))) {
      const adoptionPlan = readJson(adoptionPlanPath(normalizeTopogramPath(context.inputPath)));
      console.log(stableStringify(buildCanonicalWritesPayloadForImportPlan(adoptionPlan.imported_proposal_surfaces || [])));
      return 0;
    }
    const result = buildTaskMode(parsePath(context.inputPath), selectors, context.modeId || "modeling", context.fromTopogramPath);
    if (!resultOk(result)) return printValidationFailure(result);
    console.log(stableStringify(buildCanonicalWritesPayloadForChangePlan(result.artifact.write_scope)));
    return 0;
  }

  if (queryName === "proceed-decision") {
    if (shouldUseImportAdoptPath(context) && fs.existsSync(adoptionPlanPath(normalizeTopogramPath(context.inputPath)))) {
      const built = buildImportPlanForContext(context, "proceed-decision");
      if (!resultOk(built)) return printValidationFailure(built);
      const risk = classifyRisk({
        importPlan: built.importPlan,
        verificationTargets: built.importPlan.verification_targets,
        maintainedRisk: built.importPlan.maintained_risk || null
      });
      const resolvedWorkflowContext = buildResolvedWorkflowContextPayload({
        workspace: built.topogramRoot,
        taskModeArtifact: built.taskModeResult.artifact,
        importPlan: built.importPlan,
        selectors: workflowPresetSelectors(built.taskModeResult.artifact, context.providerId, context.presetId, "proceed-decision")
      });
      console.log(stableStringify(proceedDecisionFromRisk(
        risk,
        built.importPlan.next_action,
        built.importPlan.write_scope,
        built.importPlan.verification_targets,
        built.importPlan.maintained_risk || null,
        built.importPlan.workflow_presets || null,
        resolvedWorkflowContext
      )));
      return 0;
    }
    const built = buildChangePlanContext(context, "modeling");
    if (!resultOk(built.resolved)) return printValidationFailure(built.resolved);
    if (!resultOk(built.taskModeResult)) return printValidationFailure(built.taskModeResult);
    if (built.sliceResult && !resultOk(built.sliceResult)) return printValidationFailure(built.sliceResult);
    if (built.diffResult && !resultOk(built.diffResult)) return printValidationFailure(built.diffResult);
    if (built.maintainedBundleResult && !resultOk(built.maintainedBundleResult)) return printValidationFailure(built.maintainedBundleResult);
    const risk = classifyRisk({
      reviewBoundary: built.changePlan.review_boundary,
      maintainedBoundary: built.changePlan.maintained_boundary,
      diffSummary: built.diffSummary,
      verificationTargets: built.changePlan.verification_targets,
      maintainedRisk: built.maintainedRisk
    });
    console.log(stableStringify(proceedDecisionFromRisk(
      risk,
      built.changePlan.next_action || null,
      built.changePlan.write_scope || null,
      built.changePlan.verification_targets || null,
      built.maintainedRisk,
      null,
      null
    )));
    return 0;
  }

  if (queryName === "review-packet") {
    if (shouldUseImportAdoptPath(context) && fs.existsSync(adoptionPlanPath(normalizeTopogramPath(context.inputPath)))) {
      const built = buildImportPlanForContext(context, "review-packet");
      if (!resultOk(built)) return printValidationFailure(built);
      const risk = classifyRisk({
        importPlan: built.importPlan,
        verificationTargets: built.importPlan.verification_targets,
        maintainedRisk: built.importPlan.maintained_risk || null
      });
      console.log(stableStringify(buildReviewPacketPayloadForImportPlan({ importPlan: built.importPlan, risk })));
      return 0;
    }
    const built = buildChangePlanContext(context, "modeling");
    if (!resultOk(built.resolved)) return printValidationFailure(built.resolved);
    if (!resultOk(built.taskModeResult)) return printValidationFailure(built.taskModeResult);
    if (built.sliceResult && !resultOk(built.sliceResult)) return printValidationFailure(built.sliceResult);
    if (built.diffResult && !resultOk(built.diffResult)) return printValidationFailure(built.diffResult);
    if (built.maintainedBundleResult && !resultOk(built.maintainedBundleResult)) return printValidationFailure(built.maintainedBundleResult);
    const risk = classifyRisk({
      reviewBoundary: built.changePlan.review_boundary,
      maintainedBoundary: built.changePlan.maintained_boundary,
      diffSummary: built.diffSummary,
      verificationTargets: built.changePlan.verification_targets,
      maintainedRisk: built.maintainedRisk
    });
    console.log(stableStringify(buildReviewPacketPayloadForChangePlan({ changePlan: built.changePlan, risk })));
    return 0;
  }

  if (queryName === "next-action") {
    const result = buildTaskMode(parsePath(context.inputPath), selectors, context.modeId || "import-adopt", context.fromTopogramPath);
    if (!resultOk(result)) return printValidationFailure(result);
    console.log(stableStringify({
      type: "next_action_query",
      mode: result.artifact.mode,
      summary: result.artifact.summary || null,
      next_action: result.artifact.next_action || null,
      recommended_query_family: resolveRecommendedQueryFamily(result.artifact.next_action || null, result.artifact.mode),
      immediate_artifacts: (result.artifact.preferred_context_artifacts || []).slice(0, 2),
      preferred_context_artifacts: result.artifact.preferred_context_artifacts || [],
      review_emphasis: result.artifact.review_emphasis || [],
      write_scope: result.artifact.write_scope || null,
      verification_targets: result.artifact.verification_targets || null
    }));
    return 0;
  }

  if (queryName === "single-agent-plan") {
    if (!context.modeId) {
      throw new Error("query single-agent-plan requires --mode <modeling|maintained-app-edit|import-adopt|diff-review|verification>.");
    }
    const ast = parsePath(context.inputPath);
    const result = buildTaskMode(ast, selectors, context.modeId, context.fromTopogramPath);
    if (!resultOk(result)) return printValidationFailure(result);
    const sliceResult = hasSelectors(context) ? buildSlice(ast, selectors) : null;
    if (sliceResult && !resultOk(sliceResult)) return printValidationFailure(sliceResult);
    const resolved = resolveWorkspace(ast);
    if (!resultOk(resolved)) return printValidationFailure(resolved);
    const generatorTargets = generatorTargetsForWorkflowContext({
      graph: resolved.graph,
      taskModeArtifact: result.artifact,
      sliceArtifact: artifactOrNull(sliceResult)
    });
    const topogramRoot = normalizeTopogramPath(context.inputPath);
    let importPlan = null;
    if (context.modeId === "import-adopt" && fs.existsSync(adoptionPlanPath(topogramRoot))) {
      const workflowPresets = buildWorkflowPresetState({
        workspace: topogramRoot,
        selectors: workflowPresetSelectors(result.artifact, context.providerId, context.presetId, "single-agent-plan")
      });
      importPlan = buildImportPlanPayload(readJson(adoptionPlanPath(topogramRoot)), result.artifact, null, workflowPresets);
    }
    const resolvedWorkflowContext = buildResolvedWorkflowContextPayload({
      workspace: topogramRoot,
      taskModeArtifact: result.artifact,
      generatorTargets,
      selectors: workflowPresetSelectors(result.artifact, context.providerId, context.presetId, "single-agent-plan"),
      importPlan
    });
    console.log(stableStringify(buildSingleAgentPlanPayload({
      workspace: topogramRoot,
      taskModeArtifact: result.artifact,
      importPlan,
      resolvedWorkflowContext
    })));
    return 0;
  }

  if (queryName === "resolved-workflow-context") {
    if (!context.modeId) {
      throw new Error("query resolved-workflow-context requires --mode <modeling|maintained-app-edit|import-adopt|diff-review|verification>.");
    }
    const topogramRoot = normalizeTopogramPath(context.inputPath);
    const ast = parsePath(context.inputPath);
    const taskModeResult = buildTaskMode(ast, selectors, context.modeId, context.fromTopogramPath);
    if (!resultOk(taskModeResult)) return printValidationFailure(taskModeResult);
    const resolved = resolveWorkspace(ast);
    if (!resultOk(resolved)) return printValidationFailure(resolved);
    const sliceResult = hasSelectors(context) ? buildSlice(ast, selectors) : null;
    if (sliceResult && !resultOk(sliceResult)) return printValidationFailure(sliceResult);
    const includeMaintainedBoundary =
      context.modeId === "maintained-app-edit" ||
      context.surfaceId === "maintained-boundary" ||
      context.fromTopogramPath;
    const maintainedBundleResult = includeMaintainedBoundary ? buildMaintainedBundle(ast) : null;
    if (maintainedBundleResult && !resultOk(maintainedBundleResult)) return printValidationFailure(maintainedBundleResult);
    const generatorTargets = generatorTargetsForWorkflowContext({
      graph: resolved.graph,
      taskModeArtifact: taskModeResult.artifact,
      sliceArtifact: artifactOrNull(sliceResult),
      maintainedBoundaryArtifact: maintainedBundleResult?.artifact?.maintained_boundary || null
    });
    let importPlan = null;
    if (context.modeId === "import-adopt" && fs.existsSync(adoptionPlanPath(topogramRoot))) {
      const workflowPresets = buildWorkflowPresetState({
        workspace: topogramRoot,
        selectors: workflowPresetSelectors(taskModeResult.artifact, context.providerId, context.presetId, "resolved-workflow-context")
      });
      importPlan = buildImportPlanPayload(
        readJson(adoptionPlanPath(topogramRoot)),
        taskModeResult.artifact,
        maintainedBundleResult?.artifact?.maintained_boundary || null,
        workflowPresets
      );
    }
    console.log(stableStringify(buildResolvedWorkflowContextPayload({
      workspace: topogramRoot,
      taskModeArtifact: taskModeResult.artifact,
      importPlan,
      reviewBoundary: sliceResult?.artifact?.review_boundary || null,
      maintainedBoundary: maintainedBundleResult?.artifact?.maintained_boundary || null,
      generatorTargets,
      selectors: workflowPresetSelectors(taskModeResult.artifact, context.providerId, context.presetId, "resolved-workflow-context")
    })));
    return 0;
  }

  if (queryName === "workflow-preset-activation") {
    if (!context.modeId) {
      throw new Error("query workflow-preset-activation requires --mode <modeling|maintained-app-edit|import-adopt|diff-review|verification>.");
    }
    const topogramRoot = normalizeTopogramPath(context.inputPath);
    const taskModeResult = buildTaskMode(parsePath(context.inputPath), selectors, context.modeId, context.fromTopogramPath);
    if (!resultOk(taskModeResult)) return printValidationFailure(taskModeResult);
    let importPlan = null;
    if (context.modeId === "import-adopt" && fs.existsSync(adoptionPlanPath(topogramRoot))) {
      const workflowPresets = buildWorkflowPresetState({
        workspace: topogramRoot,
        selectors: workflowPresetSelectors(taskModeResult.artifact, context.providerId, context.presetId, "workflow-preset-activation")
      });
      importPlan = buildImportPlanPayload(readJson(adoptionPlanPath(topogramRoot)), taskModeResult.artifact, null, workflowPresets);
    }
    console.log(stableStringify(buildWorkflowPresetActivationPayload({
      workspace: topogramRoot,
      taskModeArtifact: taskModeResult.artifact,
      importPlan,
      selectors: workflowPresetSelectors(taskModeResult.artifact, context.providerId, context.presetId, "workflow-preset-activation")
    })));
    return 0;
  }

  if (queryName === "workflow-preset-diff") {
    if (!context.providerId) {
      throw new Error("query workflow-preset-diff requires --provider <id>.");
    }
    console.log(stableStringify(buildWorkflowPresetDiffPayload({
      workspace: normalizeTopogramPath(context.inputPath),
      providerId: context.providerId,
      presetId: context.presetId
    })));
    return 0;
  }

  if (queryName === "workflow-preset-customization" || context.commandArgs?.workflowPresetCommand === "customize") {
    if (!context.providerId || !context.presetId) {
      throw new Error(`${queryName ? "query workflow-preset-customization" : "workflow-preset customize"} requires --provider <id> and --preset <id>.`);
    }
    const topogramRoot = normalizeTopogramPath(context.inputPath);
    const payload = buildWorkflowPresetCustomizationPayload({
      workspace: topogramRoot,
      providerId: context.providerId,
      presetId: context.presetId
    });
    if (queryName === "workflow-preset-customization" || !context.shouldWrite) {
      console.log(stableStringify(payload));
      return 0;
    }
    const targetPath = path.resolve(topogramRoot, context.outPath || payload.recommended_local_path);
    if (fs.existsSync(targetPath)) {
      throw new Error(`Refusing to overwrite existing workflow preset customization at '${targetPath}'.`);
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, `${stableStringify(payload.customization_template)}\n`);
    console.log(stableStringify({
      ...payload,
      written: true,
      written_path: targetPath
    }));
    return 0;
  }

  if (queryName === "multi-agent-plan") {
    if (context.modeId !== "import-adopt") {
      throw new Error("query multi-agent-plan currently supports only --mode import-adopt.");
    }
    const built = buildImportAdoptAgentContext(context, "multi-agent-plan");
    if (!resultOk(built)) return printValidationFailure(built);
    console.log(stableStringify(built.multiAgentPlan));
    return 0;
  }

  if (queryName === "work-packet") {
    if (context.modeId !== "import-adopt") {
      throw new Error("query work-packet currently supports only --mode import-adopt.");
    }
    if (!context.laneId) {
      throw new Error("query work-packet requires --lane <id>.");
    }
    const built = buildImportAdoptAgentContext(context, "work-packet");
    if (!resultOk(built)) return printValidationFailure(built);
    console.log(stableStringify(buildWorkPacketPayload({
      workspace: built.topogramRoot,
      multiAgentPlan: built.multiAgentPlan,
      laneId: context.laneId
    })));
    return 0;
  }

  if (queryName === "lane-status" || queryName === "handoff-status") {
    if (context.modeId !== "import-adopt") {
      throw new Error(`query ${queryName} currently supports only --mode import-adopt.`);
    }
    const built = buildImportAdoptAgentContext(context, queryName);
    if (!resultOk(built)) return printValidationFailure(built);
    const payload = queryName === "lane-status"
      ? buildLaneStatusPayload({
          workspace: built.topogramRoot,
          multiAgentPlan: built.multiAgentPlan,
          report: built.reconcileReport,
          adoptionStatus: built.adoptionStatus
        })
      : buildHandoffStatusPayload({
          workspace: built.topogramRoot,
          multiAgentPlan: built.multiAgentPlan,
          report: built.reconcileReport,
          adoptionStatus: built.adoptionStatus
        });
    console.log(stableStringify(payload));
    return 0;
  }

  if (queryName === "auth-hints") {
    const topogramRoot = normalizeTopogramPath(context.inputPath);
    const reportPath = path.join(topogramRoot, "candidates", "reconcile", "report.json");
    const adoptionStatusPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-status.json");
    if (!fs.existsSync(reportPath) || !fs.existsSync(adoptionStatusPath)) {
      throw new Error(`No reconcile auth-hint artifacts found under '${path.join(topogramRoot, "candidates", "reconcile")}'. Run 'node ./src/cli.js reconcile ${topogramRoot}' first.`);
    }
    console.log(stableStringify(buildAuthHintsQueryPayload(readJson(reportPath), readJson(adoptionStatusPath))));
    return 0;
  }

  if (queryName === "auth-review-packet") {
    if (!context.bundleSlug) {
      throw new Error("query auth-review-packet requires --bundle <slug>.");
    }
    const topogramRoot = normalizeTopogramPath(context.inputPath);
    const reportPath = path.join(topogramRoot, "candidates", "reconcile", "report.json");
    const adoptionStatusPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-status.json");
    if (!fs.existsSync(reportPath) || !fs.existsSync(adoptionStatusPath)) {
      throw new Error(`No reconcile auth-review artifacts found under '${path.join(topogramRoot, "candidates", "reconcile")}'. Run 'node ./src/cli.js reconcile ${topogramRoot}' first.`);
    }
    const reconcileReport = readJson(reportPath);
    const packet = buildAuthReviewPacketPayload(reconcileReport, readJson(adoptionStatusPath), context.bundleSlug);
    if (!packet) {
      const knownBundles = (reconcileReport.candidate_model_bundles || []).map((/** @type {AnyRecord} */ bundle) => bundle.slug).sort();
      throw new Error(`No auth review bundle '${context.bundleSlug}' found in '${path.join(topogramRoot, "candidates", "reconcile")}'. Known bundles: ${knownBundles.length ? knownBundles.join(", ") : "none"}.`);
    }
    console.log(stableStringify(packet));
    return 0;
  }

  return null;
}

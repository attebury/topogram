import {
  CANONICAL_TASK_MODES,
  artifactLoadOrderFromGeneratorTargets,
  flattenVerificationTargets,
  recommendedArtifactQueriesFromGeneratorTargets,
  stableOrderedUnion,
  stableSortedStrings
} from "./common.js";
import {
  activeProviderPreset,
  activeTeamPreset,
  loadWorkflowPresetArtifacts,
  presetAppliesToContext,
  providerManifestWorkflowPresetDeclarations,
  skippedPresetReason,
  summarizeWorkflowPreset
} from "./workflow-presets-core.js";
import { buildWorkflowPresetInventory } from "./workflow-presets.js";
import {
  buildBlockingConditions,
  buildOperatorLoopSummary,
  buildRecommendedSequence,
  buildReviewBoundaries,
  coreWorkflowQueriesForMode,
  currentFocusFromTaskMode,
  integrationCategoriesForWorkflowContext,
  outputIdsForWorkflowContext
} from "./workflow-context-shared.js";
import { buildPresetGuidanceSummary, classifyRisk } from "./change-risk.js";
export function activeWorkflowPresetsForContext({
  workspace = null,
  providerPresets = null,
  teamPresets = null,
  providerManifests = null,
  selectors = {}
} = {}) {
  const loaded = (providerPresets && teamPresets)
    ? { provider_presets: providerPresets, team_presets: teamPresets, provider_manifests: providerManifests || [] }
    : loadWorkflowPresetArtifacts(workspace);

  const activeProviderPresets = loaded.provider_presets
    .filter((preset) => activeProviderPreset(preset) && presetAppliesToContext(preset, selectors))
    .sort((a, b) => a.priority - b.priority || a.source_priority - b.source_priority || String(a.id).localeCompare(String(b.id)));
  const activeTeamPresets = loaded.team_presets
    .filter((preset) => activeTeamPreset(preset) && presetAppliesToContext(preset, selectors))
    .sort((a, b) => a.priority - b.priority || a.source_priority - b.source_priority || String(a.id).localeCompare(String(b.id)));
  const skippedPresets = [
    ...loaded.provider_presets
      .filter((preset) => !activeProviderPreset(preset) || !presetAppliesToContext(preset, selectors))
      .map((preset) => ({
        id: preset.id,
        kind: preset.kind,
        provider_id: preset.provider?.id || preset.provenance?.provider_id || null,
        priority: preset.priority,
        reason: skippedPresetReason(preset, selectors)
      })),
    ...loaded.team_presets
      .filter((preset) => !activeTeamPreset(preset) || !presetAppliesToContext(preset, selectors))
      .map((preset) => ({
        id: preset.id,
        kind: preset.kind,
        provider_id: preset.provider?.id || preset.provenance?.provider_id || null,
        priority: preset.priority,
        reason: skippedPresetReason(preset, selectors)
      }))
  ].sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));

  return {
    active_provider_presets: activeProviderPresets,
    active_team_presets: activeTeamPresets,
    skipped_presets: skippedPresets,
    provider_manifest_declarations: providerManifestWorkflowPresetDeclarations(loaded.provider_manifests || [], loaded.provider_presets || [])
  };
}

export function mergeFieldResolution(entries = []) {
  return entries.filter(Boolean).map((entry) => ({
    preset_id: entry.id,
    kind: entry.kind,
    priority: entry.priority,
    source_priority: entry.source_priority
  }));
}

export function buildWorkflowPresetActivationPayload({
  workspace = null,
  taskModeArtifact,
  importPlan = null,
  maintainedBoundary = null,
  providerPresets = null,
  teamPresets = null,
  providerManifests = null,
  selectors = {}
}) {
  const resolvedSelectors = {
    mode: taskModeArtifact?.mode || null,
    task_class: taskModeArtifact?.mode || null,
    outputs: outputIdsForWorkflowContext(taskModeArtifact, maintainedBoundary),
    integration_categories: integrationCategoriesForWorkflowContext(taskModeArtifact, importPlan),
    query_family: "workflow-activation",
    manual_context: Boolean(importPlan?.requires_human_review?.length),
    ...selectors
  };
  const inventory = buildWorkflowPresetInventory({
    workspace,
    providerPresets,
    teamPresets,
    providerManifests,
    selectors: resolvedSelectors
  });
  const activation = activeWorkflowPresetsForContext({
    workspace,
    providerPresets,
    teamPresets,
    providerManifests,
    selectors: resolvedSelectors
  });
  return {
    type: "workflow_preset_activation_query",
    mode: resolvedSelectors.mode,
    selectors: resolvedSelectors,
    active_presets: [
      ...activation.active_provider_presets.map((preset) => summarizeWorkflowPreset(preset, resolvedSelectors)),
      ...activation.active_team_presets.map((preset) => summarizeWorkflowPreset(preset, resolvedSelectors))
    ].sort((a, b) => `${a.kind}:${a.priority}:${a.id}`.localeCompare(`${b.kind}:${b.priority}:${b.id}`)),
    skipped_presets: activation.skipped_presets,
    provider_manifest_declarations: inventory.provider_manifest_declarations || [],
    summary: {
      active_provider_count: activation.active_provider_presets.length,
      active_team_count: activation.active_team_presets.length,
      skipped_count: activation.skipped_presets.length,
      missing_declared_workflow_preset_count: (inventory.provider_manifest_summary?.missing_declared_workflow_preset_count || 0)
    }
  };
}

export function composeWorkflowToolHints(providerPresets, teamPresets) {
  const merged = {};
  for (const preset of [...providerPresets, ...teamPresets]) {
    for (const [toolName, value] of Object.entries(preset.tool_hints || {})) {
      merged[toolName] = {
        ...(merged[toolName] || {}),
        ...(value && typeof value === "object" ? value : { value })
      };
    }
  }
  return merged;
}

export function buildResolvedWorkflowContextPayload({
  workspace = null,
  taskModeArtifact,
  importPlan = null,
  reviewBoundary = null,
  maintainedBoundary = null,
  generatorTargets = [],
  providerPresets = null,
  teamPresets = null,
  providerManifests = null,
  selectors = {}
}) {
  const resolvedSelectors = {
    mode: taskModeArtifact?.mode || null,
    task_class: taskModeArtifact?.mode || null,
    outputs: outputIdsForWorkflowContext(taskModeArtifact, maintainedBoundary),
    integration_categories: integrationCategoriesForWorkflowContext(taskModeArtifact, importPlan),
    query_family: "workflow",
    manual_context: Boolean(importPlan?.requires_human_review?.length),
    ...selectors
  };
  const presetInventory = buildWorkflowPresetInventory({
    workspace,
    providerPresets,
    teamPresets,
    providerManifests,
    selectors: resolvedSelectors
  });
  const activePresets = activeWorkflowPresetsForContext({
    workspace,
    providerPresets,
    teamPresets,
    providerManifests,
    selectors: resolvedSelectors
  });
  const providerPresetSummaries = activePresets.active_provider_presets.map((preset) => summarizeWorkflowPreset(preset, resolvedSelectors));
  const teamPresetSummaries = activePresets.active_team_presets.map((preset) => summarizeWorkflowPreset(preset, resolvedSelectors));

  const conflictNotes = [];
  const policyNotes = [];
  const appliedPresets = [];
  let resolvedTaskMode = taskModeArtifact?.mode || null;
  const fieldResolution = {
    recommended_task_mode: [],
    preferred_queries: [],
    artifact_load_order: [],
    review_policy: [],
    verification_policy: [],
    multi_agent_policy: [],
    handoff_defaults: [],
    tool_hints: []
  };
  for (const preset of [...activePresets.active_provider_presets, ...activePresets.active_team_presets]) {
    if (preset.recommended_task_mode) {
      fieldResolution.recommended_task_mode.push(...mergeFieldResolution([preset]));
      if (CANONICAL_TASK_MODES.has(preset.recommended_task_mode)) {
        if (resolvedTaskMode !== taskModeArtifact?.mode && resolvedTaskMode !== preset.recommended_task_mode) {
          conflictNotes.push(`Preset ${preset.id} overrode an earlier task-mode recommendation; highest-precedence canonical task mode wins.`);
        }
        resolvedTaskMode = preset.recommended_task_mode;
      } else {
        conflictNotes.push(`Preset ${preset.id} requested unsupported task mode ${preset.recommended_task_mode}; ignoring override.`);
      }
    }
    if (preset.write_scope || preset.ownership_boundary) {
      conflictNotes.push(`Preset ${preset.id} attempted to override protected workflow boundaries; ignoring override.`);
    }
    appliedPresets.push({
      id: preset.id,
      kind: preset.kind,
      source_priority: preset.source_priority,
      provenance: preset.provenance || null
    });
  }

  const coreQueries = coreWorkflowQueriesForMode(resolvedTaskMode);
  const providerQueries = activePresets.active_provider_presets.flatMap((preset) => preset.preferred_queries || []);
  const teamQueries = activePresets.active_team_presets.flatMap((preset) => preset.preferred_queries || []);
  const preferredQueries = stableOrderedUnion([
    ...teamQueries,
    ...providerQueries,
    ...coreQueries
  ]);
  fieldResolution.preferred_queries = mergeFieldResolution([
    ...activePresets.active_team_presets.filter((preset) => (preset.preferred_queries || []).length > 0),
    ...activePresets.active_provider_presets.filter((preset) => (preset.preferred_queries || []).length > 0)
  ]);
  const artifactLoadOrder = stableOrderedUnion([
    ...activePresets.active_team_presets.flatMap((preset) => preset.artifact_load_order || []),
    ...activePresets.active_provider_presets.flatMap((preset) => preset.artifact_load_order || []),
    ...(taskModeArtifact?.preferred_context_artifacts || []),
    ...artifactLoadOrderFromGeneratorTargets(generatorTargets)
  ]);
  const recommendedArtifactQueries = recommendedArtifactQueriesFromGeneratorTargets(generatorTargets);
  fieldResolution.artifact_load_order = mergeFieldResolution([
    ...activePresets.active_team_presets.filter((preset) => (preset.artifact_load_order || []).length > 0),
    ...activePresets.active_provider_presets.filter((preset) => (preset.artifact_load_order || []).length > 0)
  ]);

  const risk = classifyRisk({
    reviewBoundary,
    maintainedBoundary,
    importPlan,
    verificationTargets: taskModeArtifact?.verification_targets || null,
    maintainedRisk: importPlan?.maintained_risk || null
  });

  const requiredVerification = stableOrderedUnion([
    ...flattenVerificationTargets(taskModeArtifact?.verification_targets || null),
    ...activePresets.active_provider_presets.flatMap((preset) => preset.verification_policy?.required || []),
    ...activePresets.active_team_presets.flatMap((preset) => preset.verification_policy?.required || [])
  ]);
  const recommendedVerification = stableOrderedUnion([
    ...activePresets.active_provider_presets.flatMap((preset) => preset.verification_policy?.recommended || []),
    ...activePresets.active_team_presets.flatMap((preset) => preset.verification_policy?.recommended || [])
  ]).filter((entry) => !requiredVerification.includes(entry));
  fieldResolution.verification_policy = mergeFieldResolution([
    ...activePresets.active_provider_presets.filter((preset) =>
      (preset.verification_policy?.required || []).length > 0 ||
      (preset.verification_policy?.recommended || []).length > 0
    ),
    ...activePresets.active_team_presets.filter((preset) =>
      (preset.verification_policy?.required || []).length > 0 ||
      (preset.verification_policy?.recommended || []).length > 0
    )
  ]);

  const reviewBlockers = stableSortedStrings([
    "no_go",
    ...(risk.overall_risk === "manual_decision" || risk.overall_risk === "no_go" ? ["manual_decision"] : []),
    ...activePresets.active_provider_presets.flatMap((preset) => preset.review_policy?.block_on || []),
    ...activePresets.active_team_presets.flatMap((preset) => preset.review_policy?.block_on || [])
  ]);
  const reviewEscalations = stableSortedStrings([
    ...activePresets.active_provider_presets.flatMap((preset) => preset.review_policy?.escalate_categories || []),
    ...activePresets.active_team_presets.flatMap((preset) => preset.review_policy?.escalate_categories || [])
  ]);
  fieldResolution.review_policy = mergeFieldResolution([
    ...activePresets.active_provider_presets.filter((preset) =>
      (preset.review_policy?.block_on || []).length > 0 || (preset.review_policy?.escalate_categories || []).length > 0
    ),
    ...activePresets.active_team_presets.filter((preset) =>
      (preset.review_policy?.block_on || []).length > 0 || (preset.review_policy?.escalate_categories || []).length > 0
    )
  ]);
  if ((presetInventory.provider_manifest_summary?.missing_declared_workflow_preset_count || 0) > 0) {
    policyNotes.push(`${presetInventory.provider_manifest_summary.missing_declared_workflow_preset_count} manifest-declared workflow preset(s) are not yet imported.`);
  }
  if (activePresets.skipped_presets.some((preset) => preset.reason === "inactive")) {
    policyNotes.push("At least one workflow preset is present but inactive by local policy.");
  }

  const providerMultiAgentAllowed = activePresets.active_provider_presets.every((preset) => preset.multi_agent_policy?.allowed !== false);
  const teamMultiAgentAllowed = activePresets.active_team_presets.every((preset) => preset.multi_agent_policy?.allowed !== false);
  const teamDefaultStrategy = [...activePresets.active_team_presets].reverse().find((preset) => preset.multi_agent_policy?.default_strategy)?.multi_agent_policy?.default_strategy || null;
  const providerDefaultStrategy = [...activePresets.active_provider_presets].reverse().find((preset) => preset.multi_agent_policy?.default_strategy)?.multi_agent_policy?.default_strategy || null;
  fieldResolution.multi_agent_policy = mergeFieldResolution([
    ...activePresets.active_provider_presets.filter((preset) =>
      preset.multi_agent_policy?.allowed !== undefined || preset.multi_agent_policy?.default_strategy
    ),
    ...activePresets.active_team_presets.filter((preset) =>
      preset.multi_agent_policy?.allowed !== undefined || preset.multi_agent_policy?.default_strategy
    )
  ]);
  fieldResolution.handoff_defaults = mergeFieldResolution([
    ...activePresets.active_provider_presets.filter((preset) => (preset.handoff_defaults?.required_fields || []).length > 0),
    ...activePresets.active_team_presets.filter((preset) => (preset.handoff_defaults?.required_fields || []).length > 0)
  ]);
  fieldResolution.tool_hints = mergeFieldResolution([
    ...activePresets.active_provider_presets.filter((preset) => Object.keys(preset.tool_hints || {}).length > 0),
    ...activePresets.active_team_presets.filter((preset) => Object.keys(preset.tool_hints || {}).length > 0)
  ]);

  return {
    type: "resolved_workflow_context_query",
    resolved_task_mode: resolvedTaskMode,
    preferred_queries: preferredQueries,
    artifact_load_order: artifactLoadOrder,
    recommended_artifact_queries: recommendedArtifactQueries,
    effective_write_scope: taskModeArtifact?.write_scope || null,
    effective_review_policy: {
      block_on: reviewBlockers,
      escalate_categories: reviewEscalations,
      overall_risk: risk.overall_risk,
      risk_reasons: risk.risk_reasons || []
    },
    effective_verification_policy: {
      required: requiredVerification,
      recommended: recommendedVerification,
      output_verification_targets: taskModeArtifact?.verification_targets?.output_verification_targets || []
    },
    effective_multi_agent_policy: {
      allowed: providerMultiAgentAllowed && teamMultiAgentAllowed,
      default_strategy: teamDefaultStrategy || providerDefaultStrategy || null
    },
    effective_handoff_defaults: {
      required_fields: stableOrderedUnion([
        ...activePresets.active_provider_presets.flatMap((preset) => preset.handoff_defaults?.required_fields || []),
        ...activePresets.active_team_presets.flatMap((preset) => preset.handoff_defaults?.required_fields || [])
      ])
    },
    tool_hints: composeWorkflowToolHints(activePresets.active_provider_presets, activePresets.active_team_presets),
    applied_presets: appliedPresets,
    skipped_presets: activePresets.skipped_presets,
    field_resolution: fieldResolution,
    conflict_notes: conflictNotes,
    policy_notes: policyNotes,
    workflow_presets: presetInventory
  };
}

export function buildSingleAgentPlanPayload({
  workspace,
  taskModeArtifact,
  importPlan = null,
  resolvedWorkflowContext = null
}) {
  const primaryArtifacts = stableOrderedUnion([
    ...(resolvedWorkflowContext?.artifact_load_order || []),
    ...(taskModeArtifact?.preferred_context_artifacts || [])
  ]);
  const presetGuidanceSummary = buildPresetGuidanceSummary(importPlan?.workflow_presets || null, resolvedWorkflowContext);
  return {
    type: "single_agent_plan",
    workspace: workspace || null,
    mode: taskModeArtifact?.mode || null,
    summary: taskModeArtifact?.summary || null,
    current_focus: currentFocusFromTaskMode(taskModeArtifact),
    next_action: taskModeArtifact?.next_action || null,
    write_scope: taskModeArtifact?.write_scope || null,
    review_boundaries: buildReviewBoundaries(taskModeArtifact, importPlan),
    proof_targets: taskModeArtifact?.verification_targets || null,
    operator_loop: buildOperatorLoopSummary({
      mode: taskModeArtifact?.mode || null,
      nextAction: taskModeArtifact?.next_action || null,
      primaryArtifacts,
      verificationTargets: taskModeArtifact?.verification_targets || null,
      currentSurface: "single-agent-plan"
    }),
    recommended_sequence: buildRecommendedSequence(taskModeArtifact, importPlan),
    blocking_conditions: buildBlockingConditions(taskModeArtifact, importPlan),
    primary_artifacts: primaryArtifacts,
    preset_guidance_summary: presetGuidanceSummary,
    active_preset_ids: presetGuidanceSummary.active_preset_ids,
    preset_blockers: presetGuidanceSummary.preset_blockers,
    recommended_preset_action: presetGuidanceSummary.recommended_preset_action,
    resolved_workflow_context: resolvedWorkflowContext || null
  };
}

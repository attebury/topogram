import {
  customizationTemplateFromProviderPreset,
  findDerivedTeamPreset,
  loadWorkflowPresetArtifacts,
  providerManifestWorkflowPresetDeclarations,
  summarizeWorkflowPreset,
  workflowPresetChangedFields,
  workflowPresetComparableShape,
  workflowPresetDeltaPayload,
  workflowPresetDerivedSource,
  workflowPresetFingerprint,
  workflowPresetRequiresFreshReview,
  refreshBaselineForProviderPreset,
  recommendedCustomizationAction,
  customizationStatusForPreset,
  defaultLocalWorkflowPresetPath
} from "./workflow-presets-core.js";
import { stableSortedStrings } from "./common.js";
export function findProviderWorkflowPreset(providerPresets = [], providerId, presetId) {
  return providerPresets.find((preset) => {
    if (providerId && (preset.provider?.id || preset.provenance?.provider_id) !== providerId) return false;
    if (presetId && preset.id !== presetId) return false;
    return true;
  }) || null;
}

export function buildCustomizationStatus(currentPreset, derivedTeamPreset = null) {
  const status = customizationStatusForPreset(currentPreset, derivedTeamPreset);
  return {
    ...status,
    recommended_customization_action: recommendedCustomizationAction(currentPreset, status)
  };
}

export function workflowPresetDiffRecord({ currentPreset = null, derivedTeamPreset = null }) {
  if (!currentPreset && !derivedTeamPreset) return null;

  if (!currentPreset && derivedTeamPreset) {
    const derived = workflowPresetDerivedSource(derivedTeamPreset.derived_from);
    const customizationStatus = {
      status: "customization_orphaned",
      derived_preset_exists: true,
      fingerprint_matches_current_source: false,
      recommended_local_path: defaultLocalWorkflowPresetPath(derived?.provider_id || "provider", derived?.provider_preset_id || "preset"),
      source_fingerprint: derived?.source_fingerprint || null
    };
    return {
      provider_id: derived?.provider_id || null,
      preset_id: derived?.provider_preset_id || null,
      change_status: "orphaned_customization",
      changed_fields: [],
      review_class_delta: null,
      recommended_task_mode_delta: null,
      preferred_queries_delta: null,
      review_policy_delta: null,
      verification_policy_delta: null,
      multi_agent_policy_delta: null,
      tool_hints_delta: null,
      customization_overlap: stableSortedStrings(Object.keys(workflowPresetComparableShape(derivedTeamPreset))),
      requires_fresh_review: true,
      recommended_customization_action: recommendedCustomizationAction(null, customizationStatus),
      provenance: {
        current: null,
        previous: derivedTeamPreset.provenance || null
      }
    };
  }

  const derivedSource = workflowPresetDerivedSource(derivedTeamPreset?.derived_from);
  const derivedMatchesCurrent = Boolean(
    derivedSource &&
    derivedSource.source_fingerprint &&
    derivedSource.source_fingerprint === workflowPresetFingerprint(currentPreset)
  );
  const baselinePreset = refreshBaselineForProviderPreset(currentPreset);
  const hasDerivedTeamPreset = Boolean(derivedTeamPreset);

  if (hasDerivedTeamPreset) {
    const delta = baselinePreset ? workflowPresetDeltaPayload(currentPreset, baselinePreset) : {
      changed_fields: [],
      review_class_delta: null,
      recommended_task_mode_delta: null,
      preferred_queries_delta: null,
      review_policy_delta: null,
      verification_policy_delta: null,
      multi_agent_policy_delta: null,
      tool_hints_delta: null
    };
    const customizationOverlap = stableSortedStrings(workflowPresetChangedFields(derivedTeamPreset, currentPreset));
    const customizationStatus = customizationStatusForPreset(currentPreset, derivedTeamPreset);
    return {
      provider_id: currentPreset.provider?.id || currentPreset.provenance?.provider_id || null,
      preset_id: currentPreset.id,
      change_status: derivedMatchesCurrent ? "locally_customized" : "locally_customized",
      ...delta,
      customization_overlap: customizationOverlap,
      requires_fresh_review: true,
      recommended_customization_action: recommendedCustomizationAction(currentPreset, customizationStatus),
      provenance: {
        current: currentPreset.provenance || null,
        previous: derivedTeamPreset.provenance || null
      }
    };
  }

  if (baselinePreset) {
    const delta = workflowPresetDeltaPayload(currentPreset, baselinePreset);
    const changed = (delta.changed_fields || []).length > 0;
    const customizationStatus = customizationStatusForPreset(currentPreset, null);
    return {
      provider_id: currentPreset.provider?.id || currentPreset.provenance?.provider_id || null,
      preset_id: currentPreset.id,
      change_status: changed ? "changed" : "unchanged",
      ...delta,
      customization_overlap: [],
      requires_fresh_review: workflowPresetRequiresFreshReview(changed ? "changed" : "unchanged", currentPreset, delta),
      recommended_customization_action: recommendedCustomizationAction(currentPreset, customizationStatus),
      provenance: {
        current: currentPreset.provenance || null,
        previous: baselinePreset.provenance || null
      }
    };
  }

  const status = ["accept", "accepted"].includes(currentPreset.adoption_state) ? "unchanged" : "new";
  const customizationStatus = customizationStatusForPreset(currentPreset, null);
  return {
    provider_id: currentPreset.provider?.id || currentPreset.provenance?.provider_id || null,
    preset_id: currentPreset.id,
    change_status: status,
    changed_fields: [],
    review_class_delta: null,
    recommended_task_mode_delta: null,
    preferred_queries_delta: null,
    review_policy_delta: null,
    verification_policy_delta: null,
    multi_agent_policy_delta: null,
    tool_hints_delta: null,
    customization_overlap: [],
    requires_fresh_review: status === "new" && currentPreset.review_class === "manual_decision",
    recommended_customization_action: recommendedCustomizationAction(currentPreset, customizationStatus),
    provenance: {
      current: currentPreset.provenance || null,
      previous: null
    }
  };
}

export function buildWorkflowPresetInventory({
  workspace = null,
  providerPresets = null,
  teamPresets = null,
  providerManifests = null,
  selectors = {}
} = {}) {
  const loaded = (providerPresets && teamPresets)
    ? { provider_presets: providerPresets, team_presets: teamPresets, provider_manifests: providerManifests || [] }
    : loadWorkflowPresetArtifacts(workspace);
  const provider = loaded.provider_presets.map((preset) => summarizeWorkflowPreset(preset, selectors));
  const team = loaded.team_presets.map((preset) => summarizeWorkflowPreset(preset, selectors));
  const manifestDeclarations = providerManifestWorkflowPresetDeclarations(loaded.provider_manifests || [], loaded.provider_presets || []);
  return {
    provider: provider.sort((a, b) => String(a.id).localeCompare(String(b.id))),
    team: team.sort((a, b) => String(a.id).localeCompare(String(b.id))),
    active_provider_count: provider.filter((preset) => preset.active_for_context && ["accept", "accepted"].includes(preset.adoption_state)).length,
    active_team_count: team.filter((preset) => preset.active_for_context && !["reject", "rejected", "stage", "staged"].includes(preset.adoption_state)).length,
    provider_manifest_declarations: manifestDeclarations,
    provider_manifest_summary: {
      manifest_count: (loaded.provider_manifests || []).length,
      declared_workflow_preset_count: manifestDeclarations.length,
      imported_declared_workflow_preset_count: manifestDeclarations.filter((entry) => entry.imported).length,
      missing_declared_workflow_preset_count: manifestDeclarations.filter((entry) => !entry.imported).length,
      invalid_declared_workflow_preset_count: manifestDeclarations.filter((entry) => !entry.valid).length
    }
  };
}

export function buildWorkflowPresetDiffPayload({
  workspace = null,
  providerId = null,
  presetId = null,
  providerPresets = null,
  teamPresets = null
} = {}) {
  const loaded = (providerPresets && teamPresets)
    ? { provider_presets: providerPresets, team_presets: teamPresets }
    : loadWorkflowPresetArtifacts(workspace);
  const matchingProviderPresets = loaded.provider_presets.filter((preset) => {
    if (providerId && (preset.provider?.id || preset.provenance?.provider_id) !== providerId) return false;
    if (presetId && preset.id !== presetId) return false;
    return true;
  });
  const matchingTeamPresets = loaded.team_presets.filter((preset) => {
    const derived = workflowPresetDerivedSource(preset.derived_from);
    if (!derived) return false;
    if (providerId && derived.provider_id !== providerId) return false;
    if (presetId && derived.provider_preset_id !== presetId) return false;
    return true;
  });

  const seenKeys = new Set();
  const diffs = [];
  for (const preset of matchingProviderPresets) {
    const derivedTeamPreset = findDerivedTeamPreset(loaded.team_presets, preset);
    seenKeys.add(providerPresetMatchKey(preset));
    diffs.push(workflowPresetDiffRecord({
      currentPreset: preset,
      derivedTeamPreset
    }));
  }
  for (const teamPreset of matchingTeamPresets) {
    const derived = workflowPresetDerivedSource(teamPreset.derived_from);
    const key = `${derived?.provider_id || "unknown"}::${derived?.provider_preset_id || "unknown"}`;
    if (seenKeys.has(key)) continue;
    diffs.push(workflowPresetDiffRecord({
      currentPreset: null,
      derivedTeamPreset: teamPreset
    }));
  }

  const records = diffs.filter(Boolean).sort((a, b) =>
    `${a.provider_id || ""}:${a.preset_id || ""}`.localeCompare(`${b.provider_id || ""}:${b.preset_id || ""}`)
  );
  return {
    type: "workflow_preset_diff_query",
    provider_id: providerId || null,
    preset_id: presetId || null,
    diffs: records,
    summary: {
      diff_count: records.length,
      new_count: records.filter((entry) => entry.change_status === "new").length,
      unchanged_count: records.filter((entry) => entry.change_status === "unchanged").length,
      changed_count: records.filter((entry) => entry.change_status === "changed").length,
      locally_customized_count: records.filter((entry) => entry.change_status === "locally_customized").length,
      orphaned_customization_count: records.filter((entry) => entry.change_status === "orphaned_customization").length,
      requires_fresh_review_count: records.filter((entry) => entry.requires_fresh_review).length
    }
  };
}

export function buildWorkflowPresetState({
  workspace = null,
  providerPresets = null,
  teamPresets = null,
  providerManifests = null,
  selectors = {}
} = {}) {
  const loaded = (providerPresets && teamPresets)
    ? { provider_presets: providerPresets, team_presets: teamPresets, provider_manifests: providerManifests || [] }
    : loadWorkflowPresetArtifacts(workspace);
  const inventory = buildWorkflowPresetInventory({
    workspace,
    providerPresets: loaded.provider_presets,
    teamPresets: loaded.team_presets,
    providerManifests: loaded.provider_manifests,
    selectors
  });
  const workflowPresetSurfaces = loaded.provider_presets
    .filter((preset) => !selectors.provider_id || (preset.provider?.id || preset.provenance?.provider_id) === selectors.provider_id)
    .filter((preset) => !selectors.preset_id || preset.id === selectors.preset_id)
    .map((preset) => {
      const summary = summarizeWorkflowPreset(preset, selectors);
      const derivedTeamPreset = findDerivedTeamPreset(loaded.team_presets, preset);
      const customizationStatus = buildCustomizationStatus(preset, derivedTeamPreset);
      const manifestDeclaration = (inventory.provider_manifest_declarations || []).find((entry) =>
        entry.provider_id === summary.provider_id && entry.declaration_id === summary.id
      ) || null;
      return {
        ...summary,
        recommended_state: preset.adoption_state || "stage",
        derived_team_preset_path: derivedTeamPreset?.file_path || null,
        customization_status: customizationStatus,
        recommended_local_path: customizationStatus.recommended_local_path,
        recommended_customization_action: customizationStatus.recommended_customization_action,
        manifest_declared: Boolean(manifestDeclaration),
        manifest_declaration: manifestDeclaration
      };
    })
    .sort((a, b) => `${a.provider_id || ""}:${a.id}`.localeCompare(`${b.provider_id || ""}:${b.id}`));
  const refreshSummary = buildWorkflowPresetDiffPayload({
    workspace,
    providerPresets: loaded.provider_presets,
    teamPresets: loaded.team_presets,
    providerId: selectors.provider_id || null,
    presetId: selectors.preset_id || null
  });
  return {
    ...inventory,
    workflow_preset_surfaces: workflowPresetSurfaces,
    workflow_preset_refresh_summary: refreshSummary
  };
}

export function buildWorkflowPresetCustomizationPayload({
  workspace = null,
  providerId = null,
  presetId = null,
  providerPresets = null,
  teamPresets = null
} = {}) {
  const loaded = (providerPresets && teamPresets)
    ? { provider_presets: providerPresets, team_presets: teamPresets }
    : loadWorkflowPresetArtifacts(workspace);
  const currentPreset = findProviderWorkflowPreset(loaded.provider_presets, providerId, presetId);
  if (!currentPreset) {
    throw new Error(`No provider workflow preset found for provider '${providerId || "unknown"}' and preset '${presetId || "unknown"}'.`);
  }
  const derivedTeamPreset = findDerivedTeamPreset(loaded.team_presets, currentPreset);
  const customizationStatus = buildCustomizationStatus(currentPreset, derivedTeamPreset);
  const resolvedWorkspace = workspace ? path.resolve(workspace) : null;
  const customizationTemplate = customizationTemplateFromProviderPreset(currentPreset, resolvedWorkspace);
  const warnings = [];
  if (currentPreset.adoption_state !== "customize") {
    warnings.push("Provider preset is not currently marked customize; generating a local customization scaffold anyway.");
  }
  if (customizationStatus.status === "customization_present") {
    warnings.push("A derived local team preset already exists for this provider preset.");
  }
  if (customizationStatus.status === "customization_stale") {
    warnings.push("The existing derived local team preset is stale relative to the current provider preset fingerprint.");
  }
  return {
    type: "workflow_preset_customization_query",
    provider_id: currentPreset.provider?.id || currentPreset.provenance?.provider_id || null,
    preset_id: currentPreset.id,
    source_provider_preset: summarizeWorkflowPreset(currentPreset, {}),
    recommended_local_path: customizationStatus.recommended_local_path,
    customization_template: customizationTemplate,
    required_provenance: customizationTemplate.derived_from,
    suggested_fields_to_customize: [
      "preferred_queries",
      "artifact_load_order",
      "review_policy",
      "verification_policy",
      "multi_agent_policy",
      "handoff_defaults",
      "tool_hints"
    ],
    warnings
  };
}

import fs from "node:fs";
import path from "node:path";

import {
  CANONICAL_TASK_MODES,
  PROVIDER_PRESET_MANUAL_DECISION_CATEGORIES,
  WORKFLOW_REVIEW_BLOCKERS,
  stableOrderedUnion,
  stableSortedStrings
} from "./common.js";
import { DEFAULT_TOPO_FOLDER_NAME, resolveTopoRoot } from "../../workspace-paths.js";
export function workflowPresetReviewClass(preset) {
  const categories = stableSortedStrings([
    ...(preset?.review_policy?.escalate_categories || []),
    ...(preset?.review_escalation_categories || [])
  ]);
  if (categories.some((category) => PROVIDER_PRESET_MANUAL_DECISION_CATEGORIES.has(category))) {
    return "manual_decision";
  }
  return "review_required";
}

export function readJsonArtifactsFromDir(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => {
      const filePath = path.join(dirPath, entry);
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        return { parsed, filePath };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function normalizePresetAppliesTo(appliesTo = {}) {
  return {
    task_classes: stableSortedStrings(appliesTo.task_classes || appliesTo.task_modes || []),
    provider_ids: stableSortedStrings(appliesTo.provider_ids || []),
    provider_kinds: stableSortedStrings(appliesTo.provider_kinds || []),
    outputs: stableSortedStrings(appliesTo.outputs || []),
    integration_categories: stableSortedStrings(appliesTo.integration_categories || []),
    query_families: stableSortedStrings(appliesTo.query_families || [])
  };
}

export function normalizePresetActivation(activation = {}) {
  return {
    ...normalizePresetAppliesTo(activation || {}),
    manual_only: Boolean(activation?.manual_only)
  };
}

export function normalizeProviderWorkflowPresetManifest(manifest, {
  filePath = null
} = {}) {
  if (!manifest || typeof manifest !== "object") return null;
  const provider = manifest.provider && typeof manifest.provider === "object" ? manifest.provider : {};
  if (!provider.id) return null;
  const exportsSection = manifest.exports && typeof manifest.exports === "object" ? manifest.exports : {};
  const reviewDefaults = manifest.review_defaults && typeof manifest.review_defaults === "object" ? manifest.review_defaults : {};
  const requirements = manifest.requirements && typeof manifest.requirements === "object" ? manifest.requirements : {};
  const rawWorkflowPresets = Array.isArray(exportsSection.workflow_presets) ? exportsSection.workflow_presets : [];
  const workflowPresets = rawWorkflowPresets
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const recommendedTaskMode = entry.recommended_task_mode || null;
      const validation = {
        missing_path: !entry.path,
        invalid_kind: Boolean(entry.kind) && entry.kind !== "provider_workflow_preset",
        invalid_recommended_task_mode: Boolean(recommendedTaskMode) && !CANONICAL_TASK_MODES.has(recommendedTaskMode),
        invalid_review_default: Boolean(reviewDefaults.workflow_presets) && !WORKFLOW_REVIEW_BLOCKERS.has(reviewDefaults.workflow_presets) && reviewDefaults.workflow_presets !== "safe"
      };
      return {
        id: entry.id || path.basename(entry.path || "", path.extname(entry.path || "")) || null,
        label: entry.label || entry.id || null,
        path: entry.path || null,
        kind: entry.kind || "provider_workflow_preset",
        applies_to: normalizePresetAppliesTo(entry.applies_to || {}),
        proof_ref: entry.proof_ref || null,
        recommended_task_mode: recommendedTaskMode,
        validation,
        valid: !Object.values(validation).some(Boolean)
      };
    })
    .filter((entry) => entry.id);
  return {
    provider: {
      id: provider.id,
      kind: provider.kind || null,
      display_name: provider.display_name || provider.name || provider.id,
      version: provider.version || null
    },
    file_path: filePath,
    workflow_core_version: requirements.workflow_core_version || null,
    review_defaults: {
      workflow_presets: reviewDefaults.workflow_presets || "review_required"
    },
    exports: {
      workflow_presets: workflowPresets
    }
  };
}

export function normalizeWorkflowPresetArtifact(preset, {
  kind,
  filePath = null,
  provenance = null
} = {}) {
  if (!preset || typeof preset !== "object") {
    return null;
  }

  const normalizedKind = preset.kind || kind || null;
  if (!["provider_workflow_preset", "team_workflow_preset"].includes(normalizedKind)) {
    return null;
  }

  const adoptionState = preset.adoption_state || preset.state || (normalizedKind === "team_workflow_preset" ? "accept" : "stage");
  const sourcePriority = Number.isFinite(preset.source_priority)
    ? preset.source_priority
    : (normalizedKind === "team_workflow_preset" ? 200 : 100);
  const priority = Number.isFinite(preset.priority) ? preset.priority : sourcePriority;
  const toolHints = preset.tool_hints && typeof preset.tool_hints === "object" ? preset.tool_hints : {};
  const provider = preset.provider && typeof preset.provider === "object" ? preset.provider : {};

  return {
    id: preset.id || path.basename(filePath || "", ".json") || null,
    label: preset.label || preset.id || path.basename(filePath || "", ".json") || null,
    kind: normalizedKind,
    applies_to: normalizePresetAppliesTo(preset.applies_to || {}),
    recommended_task_mode: preset.recommended_task_mode || null,
    preferred_queries: stableOrderedUnion(preset.preferred_queries || []),
    artifact_load_order: stableOrderedUnion(preset.artifact_load_order || []),
    review_policy: {
      block_on: stableSortedStrings((preset.review_policy?.block_on || []).filter((entry) => WORKFLOW_REVIEW_BLOCKERS.has(entry))),
      escalate_categories: stableSortedStrings(preset.review_policy?.escalate_categories || [])
    },
    verification_policy: {
      required: stableOrderedUnion(preset.verification_policy?.required || []),
      recommended: stableOrderedUnion(preset.verification_policy?.recommended || []),
      require_output_specific_checks: Boolean(preset.verification_policy?.require_output_specific_checks),
      require_maintained_checks_when_seams_affected: Boolean(preset.verification_policy?.require_maintained_checks_when_seams_affected)
    },
    multi_agent_policy: {
      allowed: preset.multi_agent_policy?.allowed,
      default_strategy: preset.multi_agent_policy?.default_strategy || null
    },
    handoff_defaults: {
      required_fields: stableOrderedUnion(preset.handoff_defaults?.required_fields || [])
    },
    tool_hints: toolHints,
    active: preset.active !== false,
    activation: normalizePresetActivation(preset.activation || {}),
    priority,
    provenance: preset.provenance || provenance || {
      source_path: filePath,
      provider_id: provider.id || preset.provider_id || null
    },
    source_priority: sourcePriority,
    adoption_state: adoptionState,
    provider: {
      id: provider.id || preset.provider_id || null,
      kind: provider.kind || preset.provider_kind || null
    },
    refresh_baseline: preset.refresh_baseline || null,
    derived_from: preset.derived_from || null,
    file_path: filePath,
    review_class: workflowPresetReviewClass(preset)
  };
}

export function loadWorkflowPresetArtifacts(workspaceRoot) {
  if (!workspaceRoot) {
    return { provider_presets: [], team_presets: [], provider_manifests: [] };
  }
  const topogramRoot = resolveTopoRoot(workspaceRoot);
  const providerDir = path.join(topogramRoot, "candidates", "providers", "workflow-presets");
  const providerManifestDir = path.join(topogramRoot, "candidates", "providers", "manifests");
  const teamDirs = [
    path.join(topogramRoot, "workflow-presets"),
    path.join(topogramRoot, DEFAULT_TOPO_FOLDER_NAME, "workflow-presets")
  ];

  const providerPresets = readJsonArtifactsFromDir(providerDir)
    .map(({ parsed, filePath }) => normalizeWorkflowPresetArtifact(parsed, {
      kind: "provider_workflow_preset",
      filePath,
      provenance: {
        source_path: filePath,
        provider_id: parsed?.provider?.id || parsed?.provider_id || null
      }
    }))
    .filter(Boolean);

  const teamPresets = teamDirs.flatMap((teamDir) => readJsonArtifactsFromDir(teamDir))
    .map(({ parsed, filePath }) => normalizeWorkflowPresetArtifact(parsed, {
      kind: "team_workflow_preset",
      filePath,
      provenance: {
        source_path: filePath,
        provider_id: parsed?.provider?.id || parsed?.provider_id || null
      }
    }))
    .filter(Boolean);

  const providerManifests = readJsonArtifactsFromDir(providerManifestDir)
    .map(({ parsed, filePath }) => normalizeProviderWorkflowPresetManifest(parsed, { filePath }))
    .filter(Boolean);

  return {
    provider_presets: providerPresets,
    team_presets: teamPresets,
    provider_manifests: providerManifests
  };
}

export function activeProviderPreset(preset) {
  return preset.active !== false && ["accept", "accepted"].includes(preset.adoption_state);
}

export function activeTeamPreset(preset) {
  if (preset.active === false) return false;
  return !["reject", "rejected", "stage", "staged"].includes(preset.adoption_state);
}

export function presetAppliesToContext(preset, selectors = {}) {
  const applies = preset.applies_to || {};
  const selectedOutputs = stableSortedStrings(selectors.outputs || []);
  const presetId = selectors.preset_id || null;
  const providerId = selectors.provider_id || null;
  const providerKinds = stableSortedStrings(selectors.provider_kinds || []);
  const taskClass = selectors.task_class || selectors.mode || null;
  const queryFamily = selectors.query_family || null;
  const integrationCategories = stableSortedStrings(selectors.integration_categories || []);

  if (presetId && preset.id !== presetId) {
    return false;
  }
  if (providerId && (preset.provider?.id || preset.provenance?.provider_id) && (preset.provider?.id || preset.provenance?.provider_id) !== providerId) {
    return false;
  }
  if (applies.task_classes.length > 0 && (!taskClass || !applies.task_classes.includes(taskClass))) {
    return false;
  }
  if (applies.provider_ids.length > 0 && (!providerId || !applies.provider_ids.includes(providerId))) {
    return false;
  }
  if (applies.provider_kinds.length > 0 && !applies.provider_kinds.some((kind) => providerKinds.includes(kind))) {
    return false;
  }
  if (applies.outputs.length > 0 && !applies.outputs.some((outputId) => selectedOutputs.includes(outputId))) {
    return false;
  }
  if (applies.integration_categories.length > 0 && !applies.integration_categories.some((category) => integrationCategories.includes(category))) {
    return false;
  }
  if (applies.query_families.length > 0 && (!queryFamily || !applies.query_families.includes(queryFamily))) {
    return false;
  }
  const activation = preset.activation || normalizePresetActivation();
  if (activation.task_classes.length > 0 && (!taskClass || !activation.task_classes.includes(taskClass))) {
    return false;
  }
  if (activation.provider_ids.length > 0 && (!providerId || !activation.provider_ids.includes(providerId))) {
    return false;
  }
  if (activation.provider_kinds.length > 0 && !activation.provider_kinds.some((kind) => providerKinds.includes(kind))) {
    return false;
  }
  if (activation.outputs.length > 0 && !activation.outputs.some((outputId) => selectedOutputs.includes(outputId))) {
    return false;
  }
  if (activation.integration_categories.length > 0 && !activation.integration_categories.some((category) => integrationCategories.includes(category))) {
    return false;
  }
  if (activation.query_families.length > 0 && (!queryFamily || !activation.query_families.includes(queryFamily))) {
    return false;
  }
  if (activation.manual_only && selectors.manual_context !== true) {
    return false;
  }
  return true;
}

export function summarizeWorkflowPreset(preset, selectors = {}) {
  const escalateCategories = preset.review_policy?.escalate_categories || [];
  const verificationImpact = stableOrderedUnion([
    ...(preset.verification_policy?.required || []),
    ...(preset.verification_policy?.recommended || [])
  ]);
  return {
    id: preset.id,
    label: preset.label,
    kind: preset.kind,
    provider_id: preset.provider?.id || preset.provenance?.provider_id || null,
    provider_kind: preset.provider?.kind || null,
    adoption_state: preset.adoption_state,
    active: preset.active !== false,
    activation: preset.activation || normalizePresetActivation(),
    priority: preset.priority ?? preset.source_priority,
    applies_to: preset.applies_to,
    recommended_task_mode: preset.recommended_task_mode || null,
    review_class: preset.review_class,
    review_escalation_categories: escalateCategories,
    verification_impact: verificationImpact,
    multi_agent_hint_impact: {
      allowed: preset.multi_agent_policy?.allowed,
      default_strategy: preset.multi_agent_policy?.default_strategy || null
    },
    indirect_maintained_impact: Boolean(
      escalateCategories.includes("maintained_boundary") ||
      (preset.applies_to?.outputs || []).some((outputId) => String(outputId).startsWith("maintained"))
    ),
    active_for_context: presetAppliesToContext(preset, selectors),
    provenance: preset.provenance || null
  };
}

export function workflowPresetComparableShape(preset) {
  return {
    recommended_task_mode: preset?.recommended_task_mode || null,
    preferred_queries: stableOrderedUnion(preset?.preferred_queries || []),
    artifact_load_order: stableOrderedUnion(preset?.artifact_load_order || []),
    review_policy: {
      block_on: stableSortedStrings(preset?.review_policy?.block_on || []),
      escalate_categories: stableSortedStrings(preset?.review_policy?.escalate_categories || [])
    },
    verification_policy: {
      required: stableOrderedUnion(preset?.verification_policy?.required || []),
      recommended: stableOrderedUnion(preset?.verification_policy?.recommended || []),
      require_output_specific_checks: Boolean(preset?.verification_policy?.require_output_specific_checks),
      require_maintained_checks_when_seams_affected: Boolean(preset?.verification_policy?.require_maintained_checks_when_seams_affected)
    },
    multi_agent_policy: {
      allowed: preset?.multi_agent_policy?.allowed,
      default_strategy: preset?.multi_agent_policy?.default_strategy || null
    },
    handoff_defaults: {
      required_fields: stableOrderedUnion(preset?.handoff_defaults?.required_fields || [])
    },
    tool_hints: preset?.tool_hints || {},
    applies_to: normalizePresetAppliesTo(preset?.applies_to || {}),
    review_class: preset?.review_class || workflowPresetReviewClass(preset || {})
  };
}

export function workflowPresetFingerprint(preset) {
  return JSON.stringify(workflowPresetComparableShape(preset));
}

export function workflowPresetDerivedSource(derivedFrom = null) {
  if (!derivedFrom || typeof derivedFrom !== "object") return null;
  return {
    provider_id: derivedFrom.provider_id || null,
    provider_preset_id: derivedFrom.provider_preset_id || derivedFrom.preset_id || derivedFrom.id || null,
    source_path: derivedFrom.source_path || null,
    source_fingerprint: derivedFrom.source_fingerprint || null
  };
}

export function providerPresetMatchKey(preset) {
  return `${preset?.provider?.id || preset?.provenance?.provider_id || "unknown"}::${preset?.id || "unknown"}`;
}

export function findDerivedTeamPreset(teamPresets = [], providerPreset) {
  const matchKey = providerPresetMatchKey(providerPreset);
  return teamPresets.find((preset) => {
    const derived = workflowPresetDerivedSource(preset?.derived_from);
    if (!derived) return false;
    const derivedKey = `${derived.provider_id || "unknown"}::${derived.provider_preset_id || "unknown"}`;
    return derivedKey === matchKey;
  }) || null;
}

export function diffArrayValues(current = [], previous = []) {
  const normalizedCurrent = stableOrderedUnion(current);
  const normalizedPrevious = stableOrderedUnion(previous);
  return {
    current: normalizedCurrent,
    previous: normalizedPrevious,
    added: normalizedCurrent.filter((entry) => !normalizedPrevious.includes(entry)),
    removed: normalizedPrevious.filter((entry) => !normalizedCurrent.includes(entry))
  };
}

export function diffObjectKeys(current = {}, previous = {}) {
  const keys = stableSortedStrings([...Object.keys(current || {}), ...Object.keys(previous || {})]);
  const changed = {};
  for (const key of keys) {
    const currentValue = current?.[key];
    const previousValue = previous?.[key];
    if (JSON.stringify(currentValue) !== JSON.stringify(previousValue)) {
      changed[key] = {
        current: currentValue,
        previous: previousValue
      };
    }
  }
  return changed;
}

export function workflowPresetChangedFields(currentPreset, previousPreset) {
  const current = workflowPresetComparableShape(currentPreset);
  const previous = workflowPresetComparableShape(previousPreset);
  const changedFields = [];
  for (const field of [
    "recommended_task_mode",
    "preferred_queries",
    "artifact_load_order",
    "review_policy",
    "verification_policy",
    "multi_agent_policy",
    "handoff_defaults",
    "tool_hints",
    "applies_to",
    "review_class"
  ]) {
    if (JSON.stringify(current[field]) !== JSON.stringify(previous[field])) {
      changedFields.push(field);
    }
  }
  return changedFields;
}

export function workflowPresetDeltaPayload(currentPreset, previousPreset) {
  const current = workflowPresetComparableShape(currentPreset);
  const previous = workflowPresetComparableShape(previousPreset);
  return {
    changed_fields: workflowPresetChangedFields(currentPreset, previousPreset),
    review_class_delta: {
      current: current.review_class,
      previous: previous.review_class
    },
    recommended_task_mode_delta: {
      current: current.recommended_task_mode,
      previous: previous.recommended_task_mode
    },
    preferred_queries_delta: diffArrayValues(current.preferred_queries, previous.preferred_queries),
    review_policy_delta: {
      block_on: diffArrayValues(current.review_policy.block_on, previous.review_policy.block_on),
      escalate_categories: diffArrayValues(current.review_policy.escalate_categories, previous.review_policy.escalate_categories)
    },
    verification_policy_delta: {
      required: diffArrayValues(current.verification_policy.required, previous.verification_policy.required),
      recommended: diffArrayValues(current.verification_policy.recommended, previous.verification_policy.recommended),
      flags: diffObjectKeys({
        require_output_specific_checks: current.verification_policy.require_output_specific_checks,
        require_maintained_checks_when_seams_affected: current.verification_policy.require_maintained_checks_when_seams_affected
      }, {
        require_output_specific_checks: previous.verification_policy.require_output_specific_checks,
        require_maintained_checks_when_seams_affected: previous.verification_policy.require_maintained_checks_when_seams_affected
      })
    },
    multi_agent_policy_delta: diffObjectKeys(current.multi_agent_policy, previous.multi_agent_policy),
    tool_hints_delta: diffObjectKeys(current.tool_hints, previous.tool_hints)
  };
}

export function refreshBaselineForProviderPreset(preset) {
  const baseline = preset?.refresh_baseline;
  if (!baseline || typeof baseline !== "object") return null;
  return normalizeWorkflowPresetArtifact({
    ...baseline,
    kind: "provider_workflow_preset",
    provider: {
      ...(preset?.provider || {}),
      ...(baseline.provider || {})
    }
  }, {
    kind: "provider_workflow_preset",
    provenance: {
      source_path: baseline.source_path || null,
      provider_id: baseline?.provider?.id || preset?.provider?.id || null
    }
  });
}

export function workflowPresetRequiresFreshReview(changeStatus, currentPreset, delta) {
  if (changeStatus === "orphaned_customization") return true;
  if (changeStatus === "locally_customized") return true;
  if (changeStatus !== "changed") return false;
  return Boolean(
    (delta.changed_fields || []).some((field) => [
      "review_policy",
      "verification_policy",
      "multi_agent_policy",
      "recommended_task_mode",
      "review_class"
    ].includes(field))
  );
}

export function defaultLocalWorkflowPresetPath(providerId, presetId) {
  return `workflow-presets/provider.${providerId}.${presetId}.json`;
}

export function customizationStatusForPreset(currentPreset, derivedTeamPreset = null) {
  const providerId = currentPreset?.provider?.id || currentPreset?.provenance?.provider_id || null;
  const recommendedLocalPath = defaultLocalWorkflowPresetPath(providerId || "provider", currentPreset?.id || "preset");
  const sourceFingerprint = currentPreset ? workflowPresetFingerprint(currentPreset) : null;
  const derivedSource = workflowPresetDerivedSource(derivedTeamPreset?.derived_from);
  const fingerprintMatches = Boolean(
    derivedTeamPreset &&
    derivedSource?.source_fingerprint &&
    sourceFingerprint &&
    derivedSource.source_fingerprint === sourceFingerprint
  );
  let status = null;
  if (currentPreset?.adoption_state === "customize") {
    status = !derivedTeamPreset
      ? "ready_to_customize"
      : fingerprintMatches
        ? "customization_present"
        : "customization_stale";
  } else if (derivedTeamPreset) {
    status = fingerprintMatches ? "customization_present" : "customization_stale";
  }
  return {
    status,
    derived_preset_exists: Boolean(derivedTeamPreset),
    fingerprint_matches_current_source: fingerprintMatches,
    recommended_local_path: recommendedLocalPath,
    source_fingerprint: sourceFingerprint
  };
}

export function recommendedCustomizationAction(currentPreset, customizationStatus) {
  if (!customizationStatus) return null;
  if (customizationStatus.status === "customization_orphaned") {
    return "remove_or_replace_orphaned_customization";
  }
  if (currentPreset?.adoption_state === "customize" && customizationStatus.status === "ready_to_customize") {
    return "create_local_customization";
  }
  if (customizationStatus.status === "customization_stale") {
    return "refresh_local_customization";
  }
  if (customizationStatus.status === "customization_present") {
    return "review_existing_customization";
  }
  return null;
}

export function providerManifestWorkflowPresetDeclarations(providerManifests = [], providerPresets = []) {
  return providerManifests.flatMap((manifest) =>
    (manifest.exports?.workflow_presets || []).map((entry) => {
      const importedPreset = providerPresets.find((preset) =>
        (preset.provider?.id || preset.provenance?.provider_id) === manifest.provider.id &&
        preset.id === entry.id
      ) || null;
      return {
        provider_id: manifest.provider.id,
        provider_kind: manifest.provider.kind || null,
        manifest_path: manifest.file_path || null,
        workflow_core_version: manifest.workflow_core_version || null,
        review_default: manifest.review_defaults?.workflow_presets || "review_required",
        declaration_id: entry.id,
        label: entry.label || entry.id,
        path: entry.path || null,
        applies_to: entry.applies_to,
        proof_ref: entry.proof_ref || null,
        valid: entry.valid,
        validation: entry.validation,
        imported: Boolean(importedPreset),
        imported_preset_id: importedPreset?.id || null,
        import_status: importedPreset ? "imported" : "not_imported"
      };
    })
  ).sort((a, b) => `${a.provider_id}:${a.declaration_id}`.localeCompare(`${b.provider_id}:${b.declaration_id}`));
}

export function skippedPresetReason(preset, selectors = {}) {
  if (preset.active === false) return "inactive";
  const applies = preset.applies_to || {};
  const activation = preset.activation || normalizePresetActivation();
  const selectedOutputs = stableSortedStrings(selectors.outputs || []);
  const providerId = selectors.provider_id || null;
  const providerKinds = stableSortedStrings(selectors.provider_kinds || []);
  const taskClass = selectors.task_class || selectors.mode || null;
  const queryFamily = selectors.query_family || null;
  const integrationCategories = stableSortedStrings(selectors.integration_categories || []);
  if (applies.task_classes.length > 0 && (!taskClass || !applies.task_classes.includes(taskClass))) return "applies_to_task_class_mismatch";
  if (applies.provider_ids.length > 0 && (!providerId || !applies.provider_ids.includes(providerId))) return "applies_to_provider_mismatch";
  if (applies.provider_kinds.length > 0 && !applies.provider_kinds.some((kind) => providerKinds.includes(kind))) return "applies_to_provider_kind_mismatch";
  if (applies.outputs.length > 0 && !applies.outputs.some((outputId) => selectedOutputs.includes(outputId))) return "applies_to_output_mismatch";
  if (applies.integration_categories.length > 0 && !applies.integration_categories.some((category) => integrationCategories.includes(category))) return "applies_to_integration_category_mismatch";
  if (applies.query_families.length > 0 && (!queryFamily || !applies.query_families.includes(queryFamily))) return "applies_to_query_family_mismatch";
  if (activation.task_classes.length > 0 && (!taskClass || !activation.task_classes.includes(taskClass))) return "activation_task_class_mismatch";
  if (activation.provider_ids.length > 0 && (!providerId || !activation.provider_ids.includes(providerId))) return "activation_provider_mismatch";
  if (activation.provider_kinds.length > 0 && !activation.provider_kinds.some((kind) => providerKinds.includes(kind))) return "activation_provider_kind_mismatch";
  if (activation.outputs.length > 0 && !activation.outputs.some((outputId) => selectedOutputs.includes(outputId))) return "activation_output_mismatch";
  if (activation.integration_categories.length > 0 && !activation.integration_categories.some((category) => integrationCategories.includes(category))) return "activation_integration_category_mismatch";
  if (activation.query_families.length > 0 && (!queryFamily || !activation.query_families.includes(queryFamily))) return "activation_query_family_mismatch";
  if (activation.manual_only && selectors.manual_context !== true) return "manual_only";
  return "not_applicable";
}

export function customizationTemplateFromProviderPreset(currentPreset, workspaceRoot = null) {
  const providerId = currentPreset?.provider?.id || currentPreset?.provenance?.provider_id || "provider";
  const presetId = currentPreset?.id || "preset";
  const resolvedWorkspaceRoot = workspaceRoot ? path.resolve(workspaceRoot) : null;
  const sourcePath = currentPreset?.file_path
    ? resolvedWorkspaceRoot
      ? path.relative(resolvedWorkspaceRoot, currentPreset.file_path)
      : currentPreset.file_path
    : currentPreset?.provenance?.source_path || null;
  const template = {
    id: `provider.${providerId}.${presetId}`,
    label: `Customized ${currentPreset?.label || presetId}`,
    kind: "team_workflow_preset",
    adoption_state: "accept",
    derived_from: {
      provider_id: providerId,
      provider_preset_id: presetId,
      source_path: sourcePath,
      source_fingerprint: workflowPresetFingerprint(currentPreset)
    },
    applies_to: normalizePresetAppliesTo(currentPreset?.applies_to || {}),
    recommended_task_mode: currentPreset?.recommended_task_mode || null,
    preferred_queries: stableOrderedUnion(currentPreset?.preferred_queries || []),
    artifact_load_order: stableOrderedUnion(currentPreset?.artifact_load_order || []),
    review_policy: {
      block_on: stableSortedStrings(currentPreset?.review_policy?.block_on || []),
      escalate_categories: stableSortedStrings(currentPreset?.review_policy?.escalate_categories || [])
    },
    verification_policy: {
      required: stableOrderedUnion(currentPreset?.verification_policy?.required || []),
      recommended: stableOrderedUnion(currentPreset?.verification_policy?.recommended || []),
      require_output_specific_checks: Boolean(currentPreset?.verification_policy?.require_output_specific_checks),
      require_maintained_checks_when_seams_affected: Boolean(currentPreset?.verification_policy?.require_maintained_checks_when_seams_affected)
    },
    multi_agent_policy: {
      allowed: currentPreset?.multi_agent_policy?.allowed,
      default_strategy: currentPreset?.multi_agent_policy?.default_strategy || null
    },
    handoff_defaults: {
      required_fields: stableOrderedUnion(currentPreset?.handoff_defaults?.required_fields || [])
    },
    tool_hints: currentPreset?.tool_hints || {}
  };
  return template;
}

export function buildImportPlanNextAction(defaultNextAction, workflowPresetState = null) {
  const missingDeclaredCount = workflowPresetState?.provider_manifest_summary?.missing_declared_workflow_preset_count || 0;
  if (missingDeclaredCount > 0) {
    return {
      kind: "import_declared_workflow_preset",
      label: "Import declared workflow presets",
      reason: `${missingDeclaredCount} manifest-declared workflow preset(s) are available but not yet imported into candidate space.`
    };
  }
  const surfaces = workflowPresetState?.workflow_preset_surfaces || [];
  const refreshSurface = surfaces.find((surface) => surface.recommended_customization_action === "refresh_local_customization");
  if (refreshSurface) {
    return {
      kind: "refresh_workflow_preset_customization",
      label: "Refresh workflow preset customization",
      reason: `Provider workflow preset ${refreshSurface.id} has a stale local customization that should be refreshed before adoption proceeds.`
    };
  }
  const createSurface = surfaces.find((surface) => surface.recommended_customization_action === "create_local_customization");
  if (createSurface) {
    return {
      kind: "customize_workflow_preset",
      label: "Create local workflow preset customization",
      reason: `Provider workflow preset ${createSurface.id} is marked customize and needs a derived local team preset.`
    };
  }
  return defaultNextAction || null;
}

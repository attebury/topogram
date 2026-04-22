import fs from "node:fs";
import path from "node:path";

import {
  getJourneyDoc,
  getStatement,
  summarizeById,
  getWorkflowDoc,
  relatedProjectionsForCapability,
  relatedProjectionsForEntity,
  relatedShapesForProjection
} from "../generator/context/shared.js";
import { generatorDefaultsMap } from "../generator/apps/shared.js";

export function canonicalWriteCandidatesFromWriteScope(writeScope) {
  return (writeScope?.safe_to_edit || []).filter((entry) => entry === "topogram/**" || String(entry).startsWith("topogram/"));
}

export function buildImportPlanPayload(adoptionPlan, taskModeArtifact, maintainedBoundaryArtifact = null, workflowPresetState = null) {
  const importMaintained = buildImportMaintainedRisk(adoptionPlan.imported_proposal_surfaces || [], maintainedBoundaryArtifact);
  const importNextAction = buildImportPlanNextAction(taskModeArtifact.next_action || null, workflowPresetState);
  const presetGuidanceSummary = buildPresetGuidanceSummary(workflowPresetState, null);
  return {
    type: "import_plan_query",
    summary: taskModeArtifact.summary || null,
    adoption_state_vocabulary: adoptionPlan.adoption_state_vocabulary || [],
    next_action: importNextAction,
    write_scope: taskModeArtifact.write_scope || null,
    verification_targets: taskModeArtifact.verification_targets || null,
    review_groups: adoptionPlan.approved_review_groups || [],
    staged_items: adoptionPlan.staged_items || [],
    accepted_items: adoptionPlan.accepted_items || [],
    rejected_items: adoptionPlan.rejected_items || [],
    requires_human_review: adoptionPlan.requires_human_review || [],
    proposal_surfaces: importMaintained.proposal_surfaces,
    maintained_risk: importMaintained.maintained_risk,
    maintained_seam_review_summary: importMaintained.maintained_seam_review_summary,
    preset_guidance_summary: presetGuidanceSummary,
    active_preset_ids: presetGuidanceSummary.active_preset_ids,
    preset_blockers: presetGuidanceSummary.preset_blockers,
    recommended_preset_action: presetGuidanceSummary.recommended_preset_action,
    workflow_presets: workflowPresetState || {
      provider: [],
      team: [],
      active_provider_count: 0,
      active_team_count: 0,
      workflow_preset_surfaces: [],
      workflow_preset_refresh_summary: {
        type: "workflow_preset_diff_query",
        diffs: [],
        summary: {
          diff_count: 0,
          new_count: 0,
          unchanged_count: 0,
          changed_count: 0,
          locally_customized_count: 0,
          orphaned_customization_count: 0,
          requires_fresh_review_count: 0
        }
      }
    }
  };
}

export function summarizeDiffArtifact(diffArtifact) {
  if (!diffArtifact) {
    return null;
  }
  const maintainedOutputs = diffArtifact.affected_maintained_surfaces?.outputs || [];
  const maintainedSeams = diffArtifact.affected_maintained_surfaces?.affected_seams || [];
  const highestMaintainedSeverity = [...maintainedSeams]
    .sort((a, b) => severityRank(b.status) - severityRank(a.status))[0]?.status || null;
  return {
    baseline_root: diffArtifact.baseline_root,
    review_boundary_change_count: (diffArtifact.review_boundary_changes || []).length,
    maintained_file_count: (diffArtifact.affected_maintained_surfaces?.maintained_files_in_scope || []).length,
    affected_verification_count: (diffArtifact.affected_verifications || []).length,
    affected_output_count: maintainedOutputs.length,
    affected_seam_count: maintainedSeams.length,
    highest_maintained_severity: highestMaintainedSeverity
  };
}

function severityRank(status) {
  if (status === "no_go") return 3;
  if (status === "manual_decision") return 2;
  if (status === "review_required") return 1;
  return 0;
}

function stableSortedStrings(values) {
  return [...new Set((values || []).filter(Boolean))].sort();
}

const CANONICAL_TASK_MODES = new Set([
  "modeling",
  "maintained-app-edit",
  "import-adopt",
  "diff-review",
  "verification"
]);

const WORKFLOW_REVIEW_BLOCKERS = new Set([
  "review_required",
  "manual_decision",
  "no_go"
]);

const PROVIDER_PRESET_MANUAL_DECISION_CATEGORIES = new Set([
  "auth",
  "deployment_assumptions",
  "runtime_assumptions",
  "deploy_runtime_assumptions",
  "environment_expectations",
  "maintained_boundary",
  "ownership_visibility"
]);

const WORKFLOW_QUERY_FAMILIES_BY_MODE = {
  modeling: ["change-plan", "write-scope", "verification-targets", "risk-summary"],
  "maintained-app-edit": ["maintained-boundary", "maintained-conformance", "seam-check", "change-plan"],
  "import-adopt": ["import-plan", "risk-summary", "proceed-decision", "review-packet"],
  "diff-review": ["change-plan", "risk-summary", "review-packet"],
  verification: ["verification-targets", "proceed-decision", "risk-summary"]
};

function stableOrderedUnion(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function flattenVerificationTargets(verificationTargets = null) {
  if (!verificationTargets || typeof verificationTargets !== "object") {
    return [];
  }
  const entries = [];
  for (const [key, value] of Object.entries(verificationTargets)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) entries.push(item);
      }
      continue;
    }
    if (key === "output_verification_targets" && Array.isArray(value)) {
      for (const output of value) {
        entries.push(...flattenVerificationTargets(output?.verification_targets || null));
      }
    }
  }
  return stableOrderedUnion(entries);
}

function workflowPresetReviewClass(preset) {
  const categories = stableSortedStrings([
    ...(preset?.review_policy?.escalate_categories || []),
    ...(preset?.review_escalation_categories || [])
  ]);
  if (categories.some((category) => PROVIDER_PRESET_MANUAL_DECISION_CATEGORIES.has(category))) {
    return "manual_decision";
  }
  return "review_required";
}

function readJsonArtifactsFromDir(dirPath) {
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

function normalizePresetAppliesTo(appliesTo = {}) {
  return {
    task_classes: stableSortedStrings(appliesTo.task_classes || appliesTo.task_modes || []),
    provider_ids: stableSortedStrings(appliesTo.provider_ids || []),
    provider_kinds: stableSortedStrings(appliesTo.provider_kinds || []),
    outputs: stableSortedStrings(appliesTo.outputs || []),
    integration_categories: stableSortedStrings(appliesTo.integration_categories || []),
    query_families: stableSortedStrings(appliesTo.query_families || [])
  };
}

function normalizePresetActivation(activation = {}) {
  return {
    ...normalizePresetAppliesTo(activation || {}),
    manual_only: Boolean(activation?.manual_only)
  };
}

function normalizeProviderWorkflowPresetManifest(manifest, {
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

function normalizeWorkflowPresetArtifact(preset, {
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

function loadWorkflowPresetArtifacts(workspaceRoot) {
  if (!workspaceRoot) {
    return { provider_presets: [], team_presets: [], provider_manifests: [] };
  }
  const topogramRoot = path.basename(workspaceRoot) === "topogram" ? workspaceRoot : path.join(workspaceRoot, "topogram");
  const providerDir = path.join(topogramRoot, "candidates", "providers", "workflow-presets");
  const providerManifestDir = path.join(topogramRoot, "candidates", "providers", "manifests");
  const teamDirs = [
    path.join(topogramRoot, "workflow-presets"),
    path.join(topogramRoot, "topogram", "workflow-presets")
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

function activeProviderPreset(preset) {
  return preset.active !== false && ["accept", "accepted"].includes(preset.adoption_state);
}

function activeTeamPreset(preset) {
  if (preset.active === false) return false;
  return !["reject", "rejected", "stage", "staged"].includes(preset.adoption_state);
}

function presetAppliesToContext(preset, selectors = {}) {
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

function summarizeWorkflowPreset(preset, selectors = {}) {
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

function workflowPresetComparableShape(preset) {
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

function workflowPresetFingerprint(preset) {
  return JSON.stringify(workflowPresetComparableShape(preset));
}

function workflowPresetDerivedSource(derivedFrom = null) {
  if (!derivedFrom || typeof derivedFrom !== "object") return null;
  return {
    provider_id: derivedFrom.provider_id || null,
    provider_preset_id: derivedFrom.provider_preset_id || derivedFrom.preset_id || derivedFrom.id || null,
    source_path: derivedFrom.source_path || null,
    source_fingerprint: derivedFrom.source_fingerprint || null
  };
}

function providerPresetMatchKey(preset) {
  return `${preset?.provider?.id || preset?.provenance?.provider_id || "unknown"}::${preset?.id || "unknown"}`;
}

function findDerivedTeamPreset(teamPresets = [], providerPreset) {
  const matchKey = providerPresetMatchKey(providerPreset);
  return teamPresets.find((preset) => {
    const derived = workflowPresetDerivedSource(preset?.derived_from);
    if (!derived) return false;
    const derivedKey = `${derived.provider_id || "unknown"}::${derived.provider_preset_id || "unknown"}`;
    return derivedKey === matchKey;
  }) || null;
}

function diffArrayValues(current = [], previous = []) {
  const normalizedCurrent = stableOrderedUnion(current);
  const normalizedPrevious = stableOrderedUnion(previous);
  return {
    current: normalizedCurrent,
    previous: normalizedPrevious,
    added: normalizedCurrent.filter((entry) => !normalizedPrevious.includes(entry)),
    removed: normalizedPrevious.filter((entry) => !normalizedCurrent.includes(entry))
  };
}

function diffObjectKeys(current = {}, previous = {}) {
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

function workflowPresetChangedFields(currentPreset, previousPreset) {
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

function workflowPresetDeltaPayload(currentPreset, previousPreset) {
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

function refreshBaselineForProviderPreset(preset) {
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

function workflowPresetRequiresFreshReview(changeStatus, currentPreset, delta) {
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

function defaultLocalWorkflowPresetPath(providerId, presetId) {
  return `workflow-presets/provider.${providerId}.${presetId}.json`;
}

function customizationStatusForPreset(currentPreset, derivedTeamPreset = null) {
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

function recommendedCustomizationAction(currentPreset, customizationStatus) {
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

function providerManifestWorkflowPresetDeclarations(providerManifests = [], providerPresets = []) {
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

function skippedPresetReason(preset, selectors = {}) {
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

function customizationTemplateFromProviderPreset(currentPreset, workspaceRoot = null) {
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

function buildImportPlanNextAction(defaultNextAction, workflowPresetState = null) {
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

function findProviderWorkflowPreset(providerPresets = [], providerId, presetId) {
  return providerPresets.find((preset) => {
    if (providerId && (preset.provider?.id || preset.provenance?.provider_id) !== providerId) return false;
    if (presetId && preset.id !== presetId) return false;
    return true;
  }) || null;
}

function buildCustomizationStatus(currentPreset, derivedTeamPreset = null) {
  const status = customizationStatusForPreset(currentPreset, derivedTeamPreset);
  return {
    ...status,
    recommended_customization_action: recommendedCustomizationAction(currentPreset, status)
  };
}

function workflowPresetDiffRecord({ currentPreset = null, derivedTeamPreset = null }) {
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

function outputIdsForWorkflowContext(taskModeArtifact, maintainedBoundary = null) {
  return stableSortedStrings([
    ...((taskModeArtifact?.verification_targets?.output_verification_targets || []).map((entry) => entry.output_id)),
    ...((maintainedBoundary?.outputs || []).map((entry) => entry.output_id))
  ]);
}

function integrationCategoriesForWorkflowContext(taskModeArtifact, importPlan = null) {
  const categories = [];
  if (taskModeArtifact?.mode === "import-adopt") categories.push("provider_adoption");
  if (taskModeArtifact?.mode === "maintained-app-edit") categories.push("maintained_app");
  if ((taskModeArtifact?.verification_targets?.maintained_app_checks || []).length > 0) categories.push("maintained_boundary");
  if ((importPlan?.requires_human_review || []).length > 0) categories.push("human_review");
  return stableSortedStrings(categories);
}

function normalizeProofStorySummary(story) {
  return {
    classification: story?.classification || null,
    relativePath: story?.relativePath || null,
    maintained_files: story?.maintained_files || story?.maintainedFiles || [],
    seam_family_id: story?.seam_family_id || story?.seamFamilyId || null,
    seam_family_label: story?.seam_family_label || story?.seamFamilyLabel || null,
    review_boundary: story?.review_boundary || null
  };
}

function normalizeSeamSummary(seam, proofStoryMapper = normalizeProofStorySummary) {
  return {
    seam_id: seam?.seam_id || null,
    seam_family_id: seam?.seam_family_id || null,
    seam_family_label: seam?.seam_family_label || null,
    output_id: seam?.output_id || null,
    label: seam?.label || null,
    kind: seam?.kind || null,
    ownership_class: seam?.ownership_class || null,
    status: seam?.status || null,
    maintained_modules: seam?.maintained_modules || [],
    emitted_dependencies: seam?.emitted_dependencies || [],
    allowed_change_classes: seam?.allowed_change_classes || [],
    drift_signals: seam?.drift_signals || [],
    proof_stories: (seam?.proof_stories || []).map(proofStoryMapper)
  };
}

function maintainedOutputRecordFromFiles(files = []) {
  const normalizedFiles = stableSortedStrings(files);
  if (normalizedFiles.some((entry) => String(entry).startsWith("product/app/"))) {
    return {
      output_id: "maintained_app",
      label: "Maintained App",
      kind: "maintained_runtime",
      root_paths: ["product/app/**"]
    };
  }

  return {
    output_id: "maintained_app",
    label: "Maintained App",
    kind: "maintained_runtime",
    root_paths: []
  };
}

function normalizeMaintainedOutput(output, seamMap, {
  summaryField = "status",
  severitySelector = severityRank,
  verificationTargetsFallback = null
} = {}) {
  const seams = (output?.seams || [])
    .map((seam) => seamMap.get(seam.seam_id || seam.label))
    .filter(Boolean);
  const files = stableSortedStrings(output?.maintained_files_in_scope || seams.flatMap((seam) => seam.maintained_modules || []));
  const humanOwnedSeams = stableSortedStrings(output?.human_owned_seams || seams.map((seam) => seam.label));
  const proofStories = (output?.proof_stories || [])
    .map(normalizeProofStorySummary);
  const sortedSeams = [...seams].sort((a, b) => {
    const severityCompare = severitySelector(b[summaryField]) - severitySelector(a[summaryField]);
    return severityCompare !== 0 ? severityCompare : String(a.seam_id || "").localeCompare(String(b.seam_id || ""));
  });
  const statuses = stableSortedStrings(sortedSeams.map((seam) => seam[summaryField]).filter(Boolean));
  const statusCounts = Object.fromEntries(statuses.map((status) => [status, sortedSeams.filter((seam) => seam[summaryField] === status).length]));
  const seamFamilies = stableSortedStrings(sortedSeams.map((seam) => seam.seam_family_id).filter(Boolean));

  return {
    output_id: output?.output_id || null,
    label: output?.label || null,
    kind: output?.kind || null,
    root_paths: stableSortedStrings(output?.root_paths || []),
    ownership_boundary: output?.ownership_boundary || null,
    write_scope: output?.write_scope || null,
    verification_targets: output?.verification_targets || verificationTargetsFallback || null,
    maintained_files_in_scope: files,
    human_owned_seams: humanOwnedSeams,
    seam_families: seamFamilies,
    proof_stories: proofStories,
    seams: sortedSeams,
    summary: {
      affected_seam_count: sortedSeams.length,
      affected_seam_family_count: seamFamilies.length,
      maintained_file_count: files.length,
      highest_severity: sortedSeams[0]?.[summaryField] || "aligned",
      status_counts: statusCounts,
      affected_seam_families: seamFamilies
    }
  };
}

function buildMaintainedOutputGroups(outputs = [], seams = [], {
  summaryField = "status",
  severitySelector = severityRank,
  verificationTargetsFallback = null
} = {}) {
  const seamMap = new Map(seams.map((seam) => [seam.seam_id || seam.label, seam]));
  const sourceOutputs = outputs.length > 0
    ? outputs
    : [{
        ...maintainedOutputRecordFromFiles(seams.flatMap((seam) => seam.maintained_modules || [])),
        maintained_files_in_scope: stableSortedStrings(seams.flatMap((seam) => seam.maintained_modules || [])),
        human_owned_seams: stableSortedStrings(seams.map((seam) => seam.label)),
        seams: seams.map((seam) => ({ seam_id: seam.seam_id || null }))
      }];

  return sourceOutputs
    .map((output) => normalizeMaintainedOutput(output, seamMap, {
      summaryField,
      severitySelector,
      verificationTargetsFallback
    }))
    .filter((output) => output.seams.length > 0 || output.maintained_files_in_scope.length > 0)
    .sort((a, b) => String(a.output_id || "").localeCompare(String(b.output_id || "")));
}

function projectionKindForImpact(projection) {
  if (!projection) return "unknown";
  if ((projection.http || []).length > 0 || projection.platform === "api" || projection.platform === "backend") {
    return "api";
  }
  if (
    (projection.uiRoutes || []).length > 0 ||
    (projection.uiWeb || []).length > 0 ||
    (projection.uiScreens || []).length > 0 ||
    projection.platform === "ui_web" ||
    projection.platform === "ui_shared"
  ) {
    return "ui";
  }
  if (
    (projection.dbTables || []).length > 0 ||
    (projection.dbColumns || []).length > 0 ||
    (projection.dbRelations || []).length > 0 ||
    String(projection.platform || "").startsWith("db_")
  ) {
    return "db";
  }
  return "unknown";
}

function projectionSummaryForImpact(projection) {
  if (!projection) return null;
  return {
    projection_id: projection.id,
    kind: projectionKindForImpact(projection),
    platform: projection.platform || null,
    outputs: stableSortedStrings(projection.outputs || [])
  };
}

function projectionById(graph, projectionId) {
  return (graph?.byKind?.projection || []).find((projection) => projection.id === projectionId) || null;
}

function impactsFromProjectionIds(graph, projectionIds, impactSource, reasonBuilder) {
  return projectionIds
    .map((projectionId) => {
      const projection = projectionById(graph, projectionId);
      if (!projection) return null;
      return {
        ...projectionSummaryForImpact(projection),
        impact_source: impactSource,
        reason: reasonBuilder(projection)
      };
    })
    .filter(Boolean);
}

function addImpact(map, impact) {
  if (!impact?.projection_id) return;
  const existing = map.get(impact.projection_id);
  if (!existing) {
    map.set(impact.projection_id, {
      ...impact,
      impact_sources: [impact.impact_source],
      reasons: [impact.reason]
    });
    return;
  }

  const priority = [
    "direct_projection_change",
    "selected_projection",
    "changed_capability",
    "changed_entity",
    "changed_shape",
    "changed_rule",
    "changed_workflow",
    "changed_journey",
    "selected_rule",
    "selected_capability",
    "selected_entity",
    "selected_workflow",
    "selected_journey"
  ];
  existing.impact_sources = stableSortedStrings([...(existing.impact_sources || []), impact.impact_source]);
  existing.reasons = stableSortedStrings([...(existing.reasons || []), impact.reason]);
  const currentPriority = priority.indexOf(existing.impact_source);
  const nextPriority = priority.indexOf(impact.impact_source);
  if (currentPriority === -1 || (nextPriority !== -1 && nextPriority < currentPriority)) {
    existing.impact_source = impact.impact_source;
    existing.reason = impact.reason;
  }
}

function projectionImpactsFromRule(graph, ruleId, selected = false) {
  let rule;
  try {
    rule = getStatement(graph, "rule", ruleId);
  } catch {
    return [];
  }
  const impacts = [];
  for (const target of rule.appliesTo || []) {
    if (target.id?.startsWith("cap_")) {
      impacts.push(...impactsFromProjectionIds(
        graph,
        relatedProjectionsForCapability(graph, target.id),
        selected ? "selected_rule" : "changed_rule",
        (projection) => `Projection ${projection.id} is affected because rule ${ruleId} applies to capability ${target.id}.`
      ));
    } else if (target.id?.startsWith("entity_")) {
      impacts.push(...impactsFromProjectionIds(
        graph,
        relatedProjectionsForEntity(graph, target.id),
        selected ? "selected_rule" : "changed_rule",
        (projection) => `Projection ${projection.id} is affected because rule ${ruleId} applies to entity ${target.id}.`
      ));
    } else if (target.kind === "projection" || target.id?.startsWith("proj_")) {
      impacts.push(...impactsFromProjectionIds(
        graph,
        [target.id],
        selected ? "selected_rule" : "changed_rule",
        () => `Projection ${target.id} is affected because rule ${ruleId} applies directly to that projection.`
      ));
    }
  }
  return impacts;
}

function projectionImpactsFromWorkflow(graph, workflowId, selected = false) {
  let workflow;
  try {
    workflow = getWorkflowDoc(graph, workflowId);
  } catch {
    return [];
  }
  const direct = stableSortedStrings(workflow.relatedProjections || []);
  const viaCapabilities = stableSortedStrings((workflow.relatedCapabilities || []).flatMap((capabilityId) =>
    relatedProjectionsForCapability(graph, capabilityId)
  ));

  return [
    ...impactsFromProjectionIds(
      graph,
      direct,
      selected ? "selected_workflow" : "changed_workflow",
      (projection) => `Projection ${projection.id} is affected because workflow ${workflowId} links to that projection directly.`
    ),
    ...impactsFromProjectionIds(
      graph,
      viaCapabilities.filter((id) => !direct.includes(id)),
      selected ? "selected_workflow" : "changed_workflow",
      (projection) => `Projection ${projection.id} is affected because workflow ${workflowId} includes related capabilities realized by that projection.`
    )
  ];
}

function projectionImpactsFromJourney(graph, journeyId, selected = false) {
  let journey;
  try {
    journey = getJourneyDoc(graph, journeyId);
  } catch {
    return [];
  }
  const direct = stableSortedStrings(journey.relatedProjections || []);
  const viaCapabilities = stableSortedStrings((journey.relatedCapabilities || []).flatMap((capabilityId) =>
    relatedProjectionsForCapability(graph, capabilityId)
  ));
  const viaWorkflows = stableSortedStrings((journey.relatedWorkflows || []).flatMap((workflowId) => {
    try {
      const workflow = getWorkflowDoc(graph, workflowId);
      return workflow.relatedProjections || [];
    } catch {
      return [];
    }
  }));

  return [
    ...impactsFromProjectionIds(
      graph,
      direct,
      selected ? "selected_journey" : "changed_journey",
      (projection) => `Projection ${projection.id} is affected because journey ${journeyId} links to that projection directly.`
    ),
    ...impactsFromProjectionIds(
      graph,
      [...viaCapabilities, ...viaWorkflows].filter((id) => !direct.includes(id)),
      selected ? "selected_journey" : "changed_journey",
      (projection) => `Projection ${projection.id} is affected because journey ${journeyId} links to related workflow or capability surfaces realized by that projection.`
    )
  ];
}

function projectionImpactsFromShape(graph, shapeId) {
  const directProjectionIds = stableSortedStrings((graph?.byKind?.projection || [])
    .filter((projection) => relatedShapesForProjection(projection).includes(shapeId))
    .map((projection) => projection.id));
  const viaCapabilities = stableSortedStrings((graph?.byKind?.capability || [])
    .filter((capability) => [...(capability.input || []), ...(capability.output || [])].some((item) => item.id === shapeId))
    .flatMap((capability) => relatedProjectionsForCapability(graph, capability.id)));

  return [
    ...impactsFromProjectionIds(
      graph,
      directProjectionIds,
      "changed_shape",
      (projection) => `Projection ${projection.id} is affected because it references changed shape ${shapeId} directly.`
    ),
    ...impactsFromProjectionIds(
      graph,
      viaCapabilities.filter((id) => !directProjectionIds.includes(id)),
      "changed_shape",
      (projection) => `Projection ${projection.id} is affected because changed shape ${shapeId} is used by related capabilities realized by that projection.`
    )
  ];
}

function buildProjectionImpacts(graph, { sliceArtifact, diffArtifact }) {
  const impactMap = new Map();

  if (diffArtifact) {
    for (const entry of diffArtifact.projections || []) {
      addImpact(impactMap, {
        ...projectionSummaryForImpact(projectionById(graph, entry.id)),
        impact_source: "direct_projection_change",
        reason: `Projection ${entry.id} changed directly in the semantic diff.`
      });
    }

    for (const entry of diffArtifact.capabilities || []) {
      for (const impact of impactsFromProjectionIds(
        graph,
        relatedProjectionsForCapability(graph, entry.id),
        "changed_capability",
        (projection) => `Projection ${projection.id} is affected because changed capability ${entry.id} is realized by that projection.`
      )) addImpact(impactMap, impact);
    }

    for (const entry of diffArtifact.entities || []) {
      for (const impact of impactsFromProjectionIds(
        graph,
        relatedProjectionsForEntity(graph, entry.id),
        "changed_entity",
        (projection) => `Projection ${projection.id} is affected because changed entity ${entry.id} participates in that projection.`
      )) addImpact(impactMap, impact);
    }

    for (const entry of diffArtifact.shapes || []) {
      for (const impact of projectionImpactsFromShape(graph, entry.id)) addImpact(impactMap, impact);
    }

    for (const entry of diffArtifact.rules || []) {
      for (const impact of projectionImpactsFromRule(graph, entry.id)) addImpact(impactMap, impact);
    }

    for (const entry of diffArtifact.workflows || []) {
      for (const impact of projectionImpactsFromWorkflow(graph, entry.id)) addImpact(impactMap, impact);
    }

    for (const entry of diffArtifact.journeys || []) {
      for (const impact of projectionImpactsFromJourney(graph, entry.id)) addImpact(impactMap, impact);
    }
  } else if (sliceArtifact?.focus) {
    const { kind, id } = sliceArtifact.focus;
    if (kind === "projection") {
      addImpact(impactMap, {
        ...projectionSummaryForImpact(projectionById(graph, id)),
        impact_source: "selected_projection",
        reason: `Projection ${id} is the selected focus surface.`
      });
    } else if (kind === "capability") {
      for (const impact of impactsFromProjectionIds(
        graph,
        stableSortedStrings(sliceArtifact.depends_on?.projections || relatedProjectionsForCapability(graph, id)),
        "selected_capability",
        (projection) => `Projection ${projection.id} is in scope because selected capability ${id} is realized by that projection.`
      )) addImpact(impactMap, impact);
    } else if (kind === "entity") {
      for (const impact of impactsFromProjectionIds(
        graph,
        stableSortedStrings(sliceArtifact.depends_on?.projections || relatedProjectionsForEntity(graph, id)),
        "selected_entity",
        (projection) => `Projection ${projection.id} is in scope because selected entity ${id} participates in that projection.`
      )) addImpact(impactMap, impact);
    } else if (kind === "workflow") {
      for (const impact of projectionImpactsFromWorkflow(graph, id, true)) addImpact(impactMap, impact);
    } else if (kind === "journey") {
      for (const impact of projectionImpactsFromJourney(graph, id, true)) addImpact(impactMap, impact);
    }
  }

  return [...impactMap.values()]
    .map((impact) => ({
      ...impact,
      impact_sources: stableSortedStrings(impact.impact_sources || []),
      reasons: stableSortedStrings(impact.reasons || [])
    }))
    .sort((a, b) => a.projection_id.localeCompare(b.projection_id));
}

function buildGeneratorTargets(graph, projectionImpacts = [], diffArtifact = null) {
  const targets = [];
  const addTarget = (target) => {
    if (!target?.target || !target?.projection_id) return;
    if (!targets.some((entry) => entry.target === target.target && entry.projection_id === target.projection_id)) {
      targets.push(target);
    }
  };

  for (const impact of projectionImpacts) {
    const projection = projectionById(graph, impact.projection_id);
    if (!projection) continue;
    const profile = generatorDefaultsMap(projection).profile || null;
    const outputs = stableSortedStrings(projection.outputs || []);

    if (impact.kind === "api") {
      addTarget({
        target: "api-contract-graph",
        projection_id: impact.projection_id,
        required: true,
        reason: `Projection ${impact.projection_id} is API-facing, so API contract regeneration is required.`
      });
      addTarget({
        target: "server-contract",
        projection_id: impact.projection_id,
        required: true,
        reason: `Projection ${impact.projection_id} is API-facing, so the server contract should stay aligned.`
      });
      addTarget({
        target: "api-contract-debug",
        projection_id: impact.projection_id,
        required: false,
        reason: `Projection ${impact.projection_id} may benefit from API contract debug output during review.`
      });
    }

    if (projection.platform === "ui_shared") {
      addTarget({
        target: "ui-contract-graph",
        projection_id: impact.projection_id,
        required: true,
        reason: `Projection ${impact.projection_id} is a shared UI surface, so the UI contract should be refreshed.`
      });
      addTarget({
        target: "ui-contract-debug",
        projection_id: impact.projection_id,
        required: false,
        reason: `Projection ${impact.projection_id} may benefit from UI contract debug output during review.`
      });
    }

    if (projection.platform === "ui_web") {
      addTarget({
        target: "ui-web-contract",
        projection_id: impact.projection_id,
        required: true,
        reason: `Projection ${impact.projection_id} is a web UI surface, so the web UI contract should be refreshed.`
      });
      addTarget({
        target: "ui-web-debug",
        projection_id: impact.projection_id,
        required: false,
        reason: `Projection ${impact.projection_id} may benefit from UI web debug output during review.`
      });
      if (outputs.includes("web_app") && profile === "sveltekit") {
        addTarget({
          target: "sveltekit-app",
          projection_id: impact.projection_id,
          required: false,
          reason: `Projection ${impact.projection_id} emits a web app with SvelteKit profile, so the app scaffold may need regeneration.`
        });
      }
    }

    if (String(projection.platform || "").startsWith("db_")) {
      addTarget({
        target: "db-contract-graph",
        projection_id: impact.projection_id,
        required: true,
        reason: `Projection ${impact.projection_id} is database-facing, so the DB contract graph should be refreshed.`
      });
      addTarget({
        target: "db-contract-debug",
        projection_id: impact.projection_id,
        required: false,
        reason: `Projection ${impact.projection_id} may benefit from DB contract debug output during review.`
      });
      addTarget({
        target: "db-schema-snapshot",
        projection_id: impact.projection_id,
        required: true,
        reason: `Projection ${impact.projection_id} is database-facing, so the schema snapshot should stay aligned.`
      });

      const schemaSensitiveDiff = Boolean(
        diffArtifact &&
        (
          (diffArtifact.entities || []).length > 0 ||
          (diffArtifact.shapes || []).length > 0 ||
          (diffArtifact.projections || []).some((entry) => entry.id === impact.projection_id)
        )
      );
      if (schemaSensitiveDiff) {
        addTarget({
          target: "db-migration-plan",
          projection_id: impact.projection_id,
          required: false,
          reason: `Projection ${impact.projection_id} has schema-sensitive diff inputs, so reviewing a migration plan is recommended.`
        });
      }
    }
  }

  return targets.sort((a, b) => {
    const projectionCompare = a.projection_id.localeCompare(b.projection_id);
    return projectionCompare !== 0 ? projectionCompare : a.target.localeCompare(b.target);
  });
}

function buildMaintainedImpacts({ diffArtifact, maintainedBoundaryArtifact, sliceArtifact, verificationTargets = null }) {
  const diffMaintained = diffArtifact?.affected_maintained_surfaces || null;
  const boundaryFiles = maintainedBoundaryArtifact?.maintained_files_in_scope || [];
  const boundarySeams = maintainedBoundaryArtifact?.seams || [];
  const boundaryOutputs = maintainedBoundaryArtifact?.outputs || [];
  const proofStories = maintainedBoundaryArtifact?.proof_stories || [];
  const likelyFiles = stableSortedStrings([
    ...(diffMaintained?.maintained_files_in_scope || []),
    ...boundaryFiles
  ]);
  const likelySeams = (diffMaintained?.affected_seams || []).length > 0
    ? diffMaintained.affected_seams
    : boundarySeams;
  const likelyStories = diffMaintained?.proof_stories || proofStories;
  const reviewSensitive = likelyStories.some((story) => {
    const boundary = story.review_boundary || {};
    return boundary.automation_class && boundary.automation_class !== "safe";
  }) || likelySeams.some((seam) => seam.status && seam.status !== "aligned");
  const normalizedSeams = likelySeams.map((seam) => normalizeSeamSummary(seam));
  const affectedOutputs = buildMaintainedOutputGroups(
    diffMaintained?.outputs || boundaryOutputs,
    normalizedSeams,
    {
      verificationTargetsFallback: verificationTargets
    }
  ).map((output) => ({
    output_id: output.output_id,
    label: output.label,
    kind: output.kind,
    root_paths: output.root_paths,
    ownership_boundary: output.ownership_boundary,
    write_scope: output.write_scope,
    verification_targets: output.verification_targets,
    maintained_files_in_scope: output.maintained_files_in_scope,
    human_owned_seams: output.human_owned_seams,
    affected_seams: output.seams,
    proof_stories: output.proof_stories,
    highest_severity: output.summary.highest_severity,
    status_counts: output.summary.status_counts
  }));

  return {
    maintained_code_likely_impacted: Boolean(
      diffMaintained?.ownership_interpretation?.maintained_code_impact ||
      likelySeams.length > 0 ||
      likelyFiles.length > 0 ||
      (sliceArtifact?.ownership_boundary && boundaryFiles.length > 0)
    ),
    impact_scope: diffMaintained?.ownership_interpretation?.generated_only_impact
      ? "generated_only"
      : reviewSensitive
        ? "review_sensitive"
        : likelyFiles.length > 0
          ? "maintained_code"
          : "generated_only",
    review_sensitive: reviewSensitive,
    maintained_files_in_scope: likelyFiles,
    human_owned_seams: stableSortedStrings([
      ...(maintainedBoundaryArtifact?.human_owned_seams || []),
      ...likelySeams.map((seam) => seam.label),
      ...likelyStories.flatMap((story) => story.human_owned_seams || [])
    ]),
    affected_outputs: affectedOutputs,
    affected_seams: normalizedSeams,
    proof_stories: likelyStories.map((story) => normalizeProofStorySummary(story))
  };
}

function verificationTargetsForOutput(outputId, maintainedBoundaryArtifact, fallbackVerificationTargets = null) {
  const output = (maintainedBoundaryArtifact?.outputs || []).find((entry) => entry.output_id === outputId);
  return output?.verification_targets || fallbackVerificationTargets || null;
}

const DEPENDENCY_TOKEN_STOPWORDS = new Set([
  "and",
  "cap",
  "proj",
  "projection",
  "journey",
  "workflow",
  "entity",
  "shape",
  "input",
  "output",
  "rule",
  "ui",
  "web",
  "api",
  "db",
  "shared",
  "runtime",
  "contract",
  "contracts",
  "proof",
  "package",
  "maintained",
  "bundle",
  "screen",
  "detail",
  "list",
  "view",
  "ver"
]);

function existingGraphRoot(graph) {
  const root = graph?.root || null;
  return root && fs.existsSync(root) ? root : null;
}

function readableFilePath(root, relativePath) {
  if (!root || !relativePath) return null;
  let current = root;
  while (true) {
    const candidate = path.join(current, relativePath);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function loadMaintainedModuleContents(root, maintainedModules = []) {
  return maintainedModules
    .map((relativePath) => readableFilePath(root, relativePath))
    .filter(Boolean)
    .map((absolutePath) => ({
      absolutePath,
      contents: fs.readFileSync(absolutePath, "utf8").toLowerCase()
    }));
}

function dependencyTokens(emittedDependencies = []) {
  return stableSortedStrings(
    emittedDependencies.flatMap((id) =>
      String(id || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2 && !DEPENDENCY_TOKEN_STOPWORDS.has(token))
    )
  );
}

function verificationCoverageForSeamKind(seamKind, verificationTargets) {
  const generatedChecks = verificationTargets?.generated_checks || [];
  const maintainedChecks = verificationTargets?.maintained_app_checks || [];
  if (seamKind === "ui_presenter" || seamKind === "workflow_affordance") {
    return maintainedChecks.length > 0 || generatedChecks.some((check) => check.includes("runtime") || check.includes("compile"));
  }
  if (seamKind === "policy_interpretation") {
    return maintainedChecks.length > 0 || generatedChecks.some((check) => check.includes("runtime"));
  }
  if (seamKind === "verification_harness") {
    return maintainedChecks.length > 0;
  }
  return maintainedChecks.length > 0 || generatedChecks.length > 0 || (verificationTargets?.verification_ids || []).length > 0;
}

function buildSeamProbeReport(graph, seam, { verificationTargets = null, diffBacked = false, outputRecord = null } = {}) {
  const maintainedModules = seam?.maintained_modules || [];
  const proofStories = seam?.proof_stories || [];
  const emittedDependencies = seam?.emitted_dependencies || [];
  const graphRoot = existingGraphRoot(graph);
  const existingModules = maintainedModules.filter((relativePath) => readableFilePath(graphRoot, relativePath));
  const proofStoryFiles = proofStories.filter((story) => readableFilePath(graphRoot, story?.relativePath));
  const outputMaintainedFiles = new Set([...(outputRecord?.maintained_files_in_scope || []), ...maintainedModules]);
  const proofStoryMaintainedFiles = stableSortedStrings(proofStories.flatMap((story) => story?.maintained_files || []));
  const resolvedDependencies = emittedDependencies.filter((id) => id === "maintained-proof-package" || (graph ? Boolean(summarizeById(graph, id)) : false));
  const moduleContents = loadMaintainedModuleContents(graphRoot, maintainedModules);
  const corroborationTokens = dependencyTokens(emittedDependencies);
  const corroboratedTokens = corroborationTokens.filter((token) => moduleContents.some((entry) => entry.contents.includes(token)));
  const probeList = [
    {
      probe_id: "maintained_modules_present",
      status: maintainedModules.length > 0 ? "pass" : "fail",
      detail: maintainedModules.length > 0
        ? `${maintainedModules.length} maintained module(s) are attached to this seam.`
        : "No maintained modules are attached to this seam."
    },
    {
      probe_id: "proof_story_present",
      status: proofStories.length > 0 ? "pass" : "fail",
      detail: proofStories.length > 0
        ? `${proofStories.length} proof stor${proofStories.length === 1 ? "y is" : "ies are"} attached to this seam.`
        : "No proof story is attached to this seam."
    },
    {
      probe_id: "emitted_dependencies_resolved",
      status: emittedDependencies.length === resolvedDependencies.length ? "pass" : "fail",
      detail: emittedDependencies.length === resolvedDependencies.length
        ? `All ${emittedDependencies.length} emitted dependenc${emittedDependencies.length === 1 ? "y resolves" : "ies resolve"} in the current graph.`
        : `${resolvedDependencies.length} of ${emittedDependencies.length} emitted dependencies resolve in the current graph.`
    },
    {
      probe_id: "verification_targets_present",
      status: ((verificationTargets?.generated_checks || []).length + (verificationTargets?.maintained_app_checks || []).length + (verificationTargets?.verification_ids || []).length) > 0 ? "pass" : "fail",
      detail: verificationTargets
        ? "Verification targets are attached to this seam's output."
        : "No verification targets are attached to this seam's output."
    },
    {
      probe_id: "maintained_modules_exist",
      status: !graphRoot
        ? "skip"
        : maintainedModules.length === 0
          ? "skip"
          : existingModules.length === maintainedModules.length ? "pass" : "fail",
      detail: !graphRoot
        ? "Workspace root is unavailable, so maintained module existence was not verified."
        : maintainedModules.length === 0
          ? "No maintained modules are attached to this seam, so file existence was not verified."
          : existingModules.length === maintainedModules.length
            ? `All ${maintainedModules.length} maintained module file${maintainedModules.length === 1 ? "" : "s"} exist on disk.`
            : `${existingModules.length} of ${maintainedModules.length} maintained module files exist on disk.`
    },
    {
      probe_id: "proof_story_files_exist",
      status: !graphRoot
        ? "skip"
        : proofStories.length === 0
          ? "skip"
          : proofStoryFiles.length === proofStories.length ? "pass" : "fail",
      detail: !graphRoot
        ? "Workspace root is unavailable, so proof story files were not verified."
        : proofStories.length === 0
          ? "No proof stories are attached to this seam, so proof file existence was not verified."
          : proofStoryFiles.length === proofStories.length
            ? `All ${proofStories.length} proof stor${proofStories.length === 1 ? "y file exists" : "y files exist"} on disk.`
            : `${proofStoryFiles.length} of ${proofStories.length} proof story files exist on disk.`
    },
    {
      probe_id: "proof_story_maintained_files_in_scope",
      status: proofStoryMaintainedFiles.length === 0
        ? "skip"
        : proofStoryMaintainedFiles.every((relativePath) => outputMaintainedFiles.has(relativePath)) ? "pass" : "fail",
      detail: proofStoryMaintainedFiles.length === 0
        ? "Proof stories do not declare maintained files for this seam."
        : proofStoryMaintainedFiles.every((relativePath) => outputMaintainedFiles.has(relativePath))
          ? "All maintained files named by proof stories are still in the seam or output scope."
          : "At least one maintained file named by a proof story is no longer in the seam or output scope."
    },
    {
      probe_id: "emitted_dependency_tokens_corroborated",
      status: !graphRoot
        ? "skip"
        : corroborationTokens.length === 0
          ? "skip"
          : corroboratedTokens.length > 0 ? "pass" : "fail",
      detail: !graphRoot
        ? "Workspace root is unavailable, so maintained-module token corroboration was not verified."
        : corroborationTokens.length === 0
          ? "No dependency-specific tokens were available for lightweight maintained-module corroboration."
          : corroboratedTokens.length > 0
            ? `Maintained modules corroborate dependency tokens: ${corroboratedTokens.join(", ")}.`
            : `Maintained modules do not currently corroborate any dependency tokens from: ${corroborationTokens.join(", ")}.`
    },
    {
      probe_id: "verification_targets_cover_seam_kind",
      status: verificationTargets
        ? (verificationCoverageForSeamKind(seam?.kind || null, verificationTargets) ? "pass" : "fail")
        : "skip",
      detail: !verificationTargets
        ? "No verification targets are attached to this seam's output, so seam-kind coverage was not verified."
        : verificationCoverageForSeamKind(seam?.kind || null, verificationTargets)
          ? `Verification targets cover the seam kind '${seam?.kind || "unknown"}'.`
          : `Verification targets do not yet clearly cover the seam kind '${seam?.kind || "unknown"}'.`
    }
  ];
  let checkStatus = "aligned";
  if (seam?.status === "no_go") {
    checkStatus = "no_go";
  } else if (diffBacked && ["manual_decision", "review_required"].includes(seam?.status)) {
    checkStatus = "stale";
  } else if (probeList.some((probe) => probe.status === "fail")) {
    checkStatus = "unverifiable";
  } else if (["manual_decision", "review_required"].includes(seam?.status)) {
    checkStatus = "guarded";
  }

  return {
    seam_id: seam?.seam_id || null,
    output_id: seam?.output_id || null,
    check_status: checkStatus,
    probes: probeList
  };
}

function conformanceStateFromSeamCheck(seam, seamCheck) {
  if (seamCheck?.check_status === "no_go") return "no_go";
  if (seamCheck?.check_status === "stale") return "drift_suspected";
  if (seamCheck?.check_status === "unverifiable") return "unverifiable";
  if ((seam?.status || null) === "manual_decision" || (seam?.status || null) === "review_required" || seamCheck?.check_status === "guarded") {
    return "review_required";
  }
  return "aligned";
}

function importProposalDependencyIds(proposalSurface = {}) {
  return stableSortedStrings([
    ...(proposalSurface.requirements?.related_capabilities || []),
    ...(proposalSurface.requirements?.related_rules || []),
    ...(proposalSurface.requirements?.related_workflows || []),
    ...(proposalSurface.requirements?.related_docs || []),
    ...((proposalSurface.projection_impacts || []).map((impact) => impact.projection_id)),
    ...((proposalSurface.ui_impacts || []).map((impact) => impact.projection_id)),
    ...((proposalSurface.workflow_impacts || []).map((impact) => impact.id))
  ]);
}

function buildImportProposalMaintainedImpacts(proposalSurface, maintainedBoundaryArtifact) {
  const dependencyIds = importProposalDependencyIds(proposalSurface);
  const seamIdsFromCandidates = new Set((proposalSurface.maintained_seam_candidates || []).map((candidate) => candidate.seam_id).filter(Boolean));
  const matchedSeams = ((maintainedBoundaryArtifact?.seams || []).filter((seam) =>
    seamIdsFromCandidates.size > 0
      ? seamIdsFromCandidates.has(seam.seam_id)
      : (seam.emitted_dependencies || []).some((dependency) => dependencyIds.includes(dependency))
  ))
    .map((seam) => normalizeSeamSummary(seam));
  const matchedOutputs = buildMaintainedOutputGroups(
    (maintainedBoundaryArtifact?.outputs || []).filter((output) =>
      (output.seams || []).some((seam) => matchedSeams.some((matched) => matched.seam_id === seam.seam_id))
    ),
    matchedSeams,
    {
      verificationTargetsFallback: null
    }
  ).map((output) => compactMaintainedOutputSummary({
    ...output,
    affected_seams: output.seams,
    highest_severity: output.summary.highest_severity
  }));
  const candidateSummary = summarizeImportMaintainedSeamCandidates(proposalSurface, matchedSeams);

  return {
    dependency_ids: dependencyIds,
    maintained_seam_candidates: proposalSurface.maintained_seam_candidates || [],
    maintained_seam_candidate_summary: candidateSummary,
    affected_outputs: matchedOutputs,
    affected_seams: matchedSeams.map((seam) => compactMaintainedSeamSummary(seam)),
    highest_severity: matchedSeams.sort((a, b) => severityRank(b.status) - severityRank(a.status))[0]?.status || "aligned"
  };
}

function summarizeImportMaintainedSeamCandidates(proposalSurface = {}, matchedSeams = []) {
  const candidates = proposalSurface.maintained_seam_candidates || [];
  const highestConfidence = candidates.reduce((max, candidate) => Math.max(max, Number(candidate.confidence || 0)), 0);
  const topCandidate = [...candidates].sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))[0] || null;
  const matchedOutputs = stableSortedStrings(matchedSeams.map((seam) => seam.output_id).filter(Boolean));
  const status = candidates.length > 0
    ? "clear_candidate"
    : matchedSeams.length > 0
      ? "matched_without_explicit_candidate"
      : "no_candidate";

  return {
    status,
    candidate_count: candidates.length,
    matched_seam_count: matchedSeams.length,
    matched_output_ids: matchedOutputs,
    highest_confidence: candidates.length > 0 ? highestConfidence : null,
    top_candidate: topCandidate
      ? {
          seam_id: topCandidate.seam_id || null,
          output_id: topCandidate.output_id || null,
          status: topCandidate.status || null,
          confidence: Number(topCandidate.confidence || 0)
        }
      : null,
    review_guidance: candidates.length > 0
      ? "Review the candidate maintained seam mapping before selective adoption."
      : matchedSeams.length > 0
        ? "Proposal dependencies overlap maintained seams, but there is no explicit candidate mapping yet."
        : "No conservative maintained seam candidate was inferred for this proposal surface."
  };
}

function buildImportMaintainedRisk(proposalSurfaces = [], maintainedBoundaryArtifact = null) {
  const enrichedProposalSurfaces = proposalSurfaces.map((surface) => {
    const maintainedImpacts = buildImportProposalMaintainedImpacts(surface, maintainedBoundaryArtifact);
    return {
      ...surface,
      maintained_impacts: maintainedImpacts
    };
  });
  const allSeams = enrichedProposalSurfaces.flatMap((surface) => surface.maintained_impacts?.affected_seams || []);
  const seamIds = new Set(allSeams.map((seam) => seam.seam_id));
  const normalizedSeams = (maintainedBoundaryArtifact?.seams || [])
    .filter((seam) => seamIds.has(seam.seam_id))
    .map((seam) => normalizeSeamSummary(seam));
  const outputIds = new Set(allSeams.map((seam) => seam.output_id));
  const affectedOutputs = (maintainedBoundaryArtifact?.outputs || [])
    .filter((output) => outputIds.has(output.output_id))
    .map((output) => ({
      ...output,
      affected_seams: (output.seams || []).filter((seam) => seamIds.has(seam.seam_id)),
      highest_severity: [...(output.seams || []).filter((seam) => seamIds.has(seam.seam_id))]
        .sort((a, b) => severityRank(b.status) - severityRank(a.status))[0]?.status || "aligned"
    }));
  const maintainedRisk = buildMaintainedRiskSummary({
    maintainedImpacts: {
      affected_outputs: affectedOutputs,
      affected_seams: normalizedSeams,
      maintained_files_in_scope: stableSortedStrings(normalizedSeams.flatMap((seam) => seam.maintained_modules || []))
    },
    maintainedBoundary: maintainedBoundaryArtifact
  });
  const proposalSurfaceSummaries = enrichedProposalSurfaces.map((surface) => ({
    id: surface.id,
    bundle: surface.bundle || null,
    kind: surface.kind || null,
    ...surface.maintained_impacts?.maintained_seam_candidate_summary
  }));
  const surfacesWithCandidates = proposalSurfaceSummaries.filter((surface) => surface.status === "clear_candidate");
  const surfacesWithoutCandidates = proposalSurfaceSummaries.filter((surface) => surface.status === "no_candidate");
  const maintainedSeamReviewSummary = {
    status: surfacesWithCandidates.length > 0
      ? (surfacesWithoutCandidates.length > 0 ? "mixed" : "clear_candidate")
      : "no_candidate",
    proposal_surface_count: proposalSurfaceSummaries.length,
    surfaces_with_candidates_count: surfacesWithCandidates.length,
    surfaces_without_candidates_count: surfacesWithoutCandidates.length,
    candidate_count: proposalSurfaceSummaries.reduce((sum, surface) => sum + (surface.candidate_count || 0), 0),
    top_candidate: surfacesWithCandidates
      .sort((a, b) => (b.highest_confidence || 0) - (a.highest_confidence || 0))[0]?.top_candidate || null,
    proposal_surfaces: proposalSurfaceSummaries
  };

  return {
    proposal_surfaces: enrichedProposalSurfaces,
    maintained_risk: {
      ...maintainedRisk,
      maintained_seam_review_summary: maintainedSeamReviewSummary
    },
    maintained_seam_review_summary: maintainedSeamReviewSummary
  };
}

function compactMaintainedSeamSummary(seam) {
  return {
    seam_id: seam?.seam_id || null,
    seam_family_id: seam?.seam_family_id || null,
    seam_family_label: seam?.seam_family_label || null,
    output_id: seam?.output_id || null,
    kind: seam?.kind || null,
    status: seam?.status || null,
    ownership_class: seam?.ownership_class || null
  };
}

function compactMaintainedOutputSummary(output) {
  const verificationTargets = output?.verification_targets || null;
  return {
    output_id: output?.output_id || null,
    kind: output?.kind || null,
    highest_severity: output?.highest_severity || output?.summary?.highest_severity || "aligned",
    affected_seam_count: output?.affected_seams?.length || output?.summary?.affected_seam_count || 0,
    affected_seam_family_count: output?.summary?.affected_seam_family_count || 0,
    maintained_file_count: output?.maintained_files_in_scope?.length || output?.summary?.maintained_file_count || 0,
    verification_targets: verificationTargets
  };
}

export function buildMaintainedRiskSummary({ maintainedImpacts = null, maintainedBoundary = null, diffSummary = null } = {}) {
  const affectedOutputs = maintainedImpacts?.affected_outputs || (maintainedBoundary?.outputs || []).map((output) => ({
    output_id: output.output_id,
    kind: output.kind,
    highest_severity: output?.summary?.highest_severity || "aligned",
    affected_seams: output.seams || [],
    maintained_files_in_scope: output.maintained_files_in_scope || [],
    verification_targets: output.verification_targets || null
  }));
  const affectedSeams = maintainedImpacts?.affected_seams || (maintainedBoundary?.seams || []).map((seam) => normalizeSeamSummary(seam));
  const maintainedFilesInScope = stableSortedStrings(
    maintainedImpacts?.maintained_files_in_scope ||
    maintainedBoundary?.maintained_files_in_scope ||
    affectedOutputs.flatMap((output) => output.maintained_files_in_scope || []) ||
    affectedSeams.flatMap((seam) => seam.maintained_modules || [])
  );
  const compactOutputs = affectedOutputs
    .map((output) => compactMaintainedOutputSummary(output))
    .filter((output) => output.output_id || output.affected_seam_count > 0 || output.maintained_file_count > 0)
    .sort((a, b) => String(a.output_id || "").localeCompare(String(b.output_id || "")));
  const compactSeams = affectedSeams
    .map((seam) => compactMaintainedSeamSummary(seam))
    .filter((seam) => seam.seam_id || seam.output_id || seam.kind)
    .sort((a, b) => {
      const severityCompare = severityRank(b.status) - severityRank(a.status);
      return severityCompare !== 0 ? severityCompare : String(a.seam_id || "").localeCompare(String(b.seam_id || ""));
    });
  const derivedStatusCounts = {
    aligned: compactSeams.filter((seam) => seam.status === "aligned").length,
    review_required: compactSeams.filter((seam) => seam.status === "review_required").length,
    manual_decision: compactSeams.filter((seam) => seam.status === "manual_decision").length,
    no_go: compactSeams.filter((seam) => seam.status === "no_go").length
  };
  const statusCounts = {
    aligned: derivedStatusCounts.aligned || maintainedBoundary?.summary?.aligned_count || 0,
    review_required: derivedStatusCounts.review_required || maintainedBoundary?.summary?.review_required_count || 0,
    manual_decision: derivedStatusCounts.manual_decision || maintainedBoundary?.summary?.manual_decision_count || 0,
    no_go: derivedStatusCounts.no_go || maintainedBoundary?.summary?.no_go_count || 0
  };
  const highestSeverity = compactSeams[0]?.status
    || [...compactOutputs].sort((a, b) => severityRank(b.highest_severity) - severityRank(a.highest_severity))[0]?.highest_severity
    || (statusCounts.no_go > 0 ? "no_go" : statusCounts.manual_decision > 0 ? "manual_decision" : statusCounts.review_required > 0 ? "review_required" : null)
    || diffSummary?.highest_maintained_severity
    || "aligned";
  const outputVerificationTargets = compactOutputs.map((output) => ({
    output_id: output.output_id,
    verification_targets: output.verification_targets || null
  }));
  const affectedSeamFamilies = stableSortedStrings(compactSeams.map((seam) => seam.seam_family_id).filter(Boolean));

  return {
    affected_output_count: compactOutputs.length || diffSummary?.affected_output_count || 0,
    affected_seam_count: compactSeams.length || diffSummary?.affected_seam_count || 0,
    affected_seam_family_count: affectedSeamFamilies.length,
    highest_severity: highestSeverity,
    status_counts: statusCounts,
    affected_seam_families: affectedSeamFamilies,
    affected_outputs: compactOutputs,
    affected_seams: compactSeams,
    maintained_files_in_scope: maintainedFilesInScope,
    output_verification_targets: outputVerificationTargets
  };
}

function classifyChangePlan(changePlan, diffArtifact, projectionImpacts, generatorTargets, maintainedImpacts) {
  const focusKind = changePlan.focus?.kind || null;
  const semanticSections = diffArtifact
    ? ["entities", "capabilities", "rules", "workflows", "journeys", "shapes", "projections"]
        .filter((section) => (diffArtifact[section] || []).length > 0)
    : [];
  let classification = "context_review";
  if (diffArtifact) {
    classification = semanticSections.length > 0 ? "semantic_diff" : "diff_without_semantic_change";
  } else if (focusKind === "projection") {
    classification = "projection_focused_change";
  } else if (focusKind === "capability" || focusKind === "entity") {
    classification = "surface_closure_review";
  }
  if (maintainedImpacts.maintained_code_likely_impacted) {
    classification = `${classification}_with_maintained_followup`;
  }

  return {
    classification,
    selected_mode: changePlan.mode,
    focus: changePlan.focus,
    has_diff_baseline: Boolean(diffArtifact),
    semantic_sections_changed: semanticSections,
    affected_projection_count: projectionImpacts.length,
    affected_output_count: maintainedImpacts.affected_outputs.length,
    affected_seam_count: maintainedImpacts.affected_seams.length,
    recommended_generator_count: generatorTargets.length,
    maintained_code_likely_impacted: maintainedImpacts.maintained_code_likely_impacted
  };
}

function buildAlignmentRecommendations(changePlan, projectionImpacts, generatorTargets, maintainedImpacts) {
  const recommendations = [
    {
      action: "inspect_semantic_scope",
      order: 1,
      reason: changePlan.diff_summary
        ? "Review the semantic diff and affected projection closure before regenerating downstream surfaces."
        : "Review the selected surface and its projection closure before regenerating downstream surfaces."
    }
  ];

  if (projectionImpacts.length > 0) {
    recommendations.push({
      action: "regenerate_projection_targets",
      order: 2,
      reason: `Regenerate the recommended targets for ${projectionImpacts.length} affected projection(s).`,
      targets: stableSortedStrings(generatorTargets.map((entry) => entry.target))
    });
  }

  if (maintainedImpacts.maintained_code_likely_impacted) {
    recommendations.push({
      action: "review_maintained_followup",
      order: 3,
      reason: "Maintained code is likely impacted, so human-owned seams should be reviewed after regeneration.",
      maintained_files_in_scope: maintainedImpacts.maintained_files_in_scope,
      affected_outputs: stableSortedStrings(maintainedImpacts.affected_outputs.map((output) => output.output_id)),
      affected_seams: stableSortedStrings(maintainedImpacts.affected_seams.map((seam) => seam.seam_id || seam.label))
    });
  }

  recommendations.push({
    action: "run_verification_targets",
    order: maintainedImpacts.maintained_code_likely_impacted ? 4 : 3,
    reason: "Run the smallest recommended proof set once generated and maintained surfaces are aligned.",
    verification_targets: changePlan.verification_targets || null,
    output_verification_targets: maintainedImpacts.affected_outputs.map((output) => ({
      output_id: output.output_id,
      verification_targets: output.verification_targets || null
    }))
  });

  return recommendations;
}

export function buildMaintainedDriftPayload({ diffArtifact, maintainedBoundaryArtifact, verificationTargets, nextAction }) {
  const diffMaintained = diffArtifact?.affected_maintained_surfaces || null;
  const affectedSeams = (diffMaintained?.affected_seams || maintainedBoundaryArtifact?.seams || [])
    .map((seam) => normalizeSeamSummary(seam))
    .sort((a, b) => {
      const severityCompare = severityRank(b.status) - severityRank(a.status);
      return severityCompare !== 0 ? severityCompare : String(a.seam_id || "").localeCompare(String(b.seam_id || ""));
    });

  const statusCounts = {
    aligned: affectedSeams.filter((seam) => seam.status === "aligned").length,
    review_required: affectedSeams.filter((seam) => seam.status === "review_required").length,
    manual_decision: affectedSeams.filter((seam) => seam.status === "manual_decision").length,
    no_go: affectedSeams.filter((seam) => seam.status === "no_go").length
  };
  const highestSeverity = affectedSeams[0]?.status || "aligned";
  const maintainedFiles = stableSortedStrings(diffMaintained?.maintained_files_in_scope || maintainedBoundaryArtifact?.maintained_files_in_scope || []);
  const humanOwnedSeams = stableSortedStrings([
    ...(maintainedBoundaryArtifact?.human_owned_seams || []),
    ...affectedSeams.map((seam) => seam.label)
  ]);
  const outputs = buildMaintainedOutputGroups(
    diffMaintained?.outputs || maintainedBoundaryArtifact?.outputs || [],
    affectedSeams,
    {
      summaryField: "status",
      severitySelector: severityRank,
      verificationTargetsFallback: verificationTargets || null
    }
  ).map((output) => ({
    output_id: output.output_id,
    label: output.label,
    kind: output.kind,
    root_paths: output.root_paths,
    ownership_boundary: output.ownership_boundary,
    write_scope: output.write_scope,
    verification_targets: output.verification_targets,
    maintained_files_in_scope: output.maintained_files_in_scope,
    human_owned_seams: output.human_owned_seams,
    seam_families: output.seam_families,
    affected_seams: output.seams,
    proof_stories: output.proof_stories,
    summary: output.summary
  }));
  const affectedSeamFamilies = stableSortedStrings(affectedSeams.map((seam) => seam.seam_family_id).filter(Boolean));

  return {
    type: "maintained_drift_query",
    baseline_root: diffArtifact?.baseline_root || null,
    diff_summary: summarizeDiffArtifact(diffArtifact),
    ownership_interpretation: diffMaintained?.ownership_interpretation || {
      generated_only_impact: affectedSeams.length === 0,
      maintained_code_impact: affectedSeams.length > 0,
      human_review_required_impact: highestSeverity !== "aligned"
    },
    summary: {
      affected_seam_count: affectedSeams.length,
      affected_seam_family_count: affectedSeamFamilies.length,
      affected_output_count: outputs.length,
      maintained_file_count: maintainedFiles.length,
      highest_severity: highestSeverity,
      status_counts: statusCounts,
      affected_seam_families: affectedSeamFamilies
    },
    outputs,
    maintained_files_in_scope: maintainedFiles,
    human_owned_seams: humanOwnedSeams,
    affected_seam_families: affectedSeamFamilies,
    affected_seams: affectedSeams,
    proof_stories: (diffMaintained?.proof_stories || maintainedBoundaryArtifact?.proof_stories || []).map((story) => normalizeProofStorySummary(story)),
    verification_targets: verificationTargets || null,
    recommended_next_action: nextAction || null
  };
}

function conformanceSeverityRank(state) {
  if (state === "no_go") return 4;
  if (state === "drift_suspected") return 3;
  if (state === "review_required") return 2;
  if (state === "unverifiable") return 1;
  return 0;
}

function seamConformanceState(seam, { diffBacked }) {
  if ((seam?.status || null) === "no_go") {
    return "no_go";
  }
  if (diffBacked && (seam?.status === "manual_decision" || seam?.status === "review_required")) {
    return "drift_suspected";
  }
  if (!Array.isArray(seam?.proof_stories) || seam.proof_stories.length === 0 || !Array.isArray(seam?.maintained_modules) || seam.maintained_modules.length === 0) {
    return "unverifiable";
  }
  if ((seam?.status || null) === "manual_decision" || (seam?.status || null) === "review_required") {
    return "review_required";
  }
  return "aligned";
}

export function buildMaintainedConformancePayload({
  graph,
  diffArtifact,
  maintainedBoundaryArtifact,
  verificationTargets,
  nextAction
}) {
  const diffMaintained = diffArtifact?.affected_maintained_surfaces || null;
  const diffBacked = Boolean(diffArtifact);
  const sourceSeams = (diffMaintained?.affected_seams || []).length > 0
    ? diffMaintained.affected_seams
    : (maintainedBoundaryArtifact?.seams || []);
  const seams = sourceSeams
    .map((seam) => {
      const seamChecks = buildSeamProbeReport(graph, seam, {
        verificationTargets: verificationTargetsForOutput(seam.output_id, maintainedBoundaryArtifact, verificationTargets),
        outputRecord: (maintainedBoundaryArtifact?.outputs || []).find((output) => output.output_id === seam.output_id) || null,
        diffBacked
      });
      const outputVerificationTargets = verificationTargetsForOutput(seam.output_id, maintainedBoundaryArtifact, verificationTargets);
      const conformanceState = conformanceStateFromSeamCheck(seam, seamChecks);
      return {
        ...normalizeSeamSummary(seam),
        conformance_state: conformanceState,
        seam_checks: seamChecks,
        evidence: {
          proof_story_count: (seam.proof_stories || []).length,
          has_maintained_modules: Array.isArray(seam.maintained_modules) && seam.maintained_modules.length > 0,
          has_emitted_dependencies: Array.isArray(seam.emitted_dependencies) && seam.emitted_dependencies.length > 0,
          diff_pressure: diffBacked,
          review_boundary_classes: stableSortedStrings((seam.proof_stories || []).map((story) => story.review_boundary?.automation_class).filter(Boolean)),
          verification_target_types: [
            ...((outputVerificationTargets?.generated_checks || []).length > 0 ? ["generated_checks"] : []),
            ...((outputVerificationTargets?.maintained_app_checks || []).length > 0 ? ["maintained_app_checks"] : [])
          ]
        },
        recommended_checks: {
          generated_checks: outputVerificationTargets?.generated_checks || [],
          maintained_app_checks: outputVerificationTargets?.maintained_app_checks || [],
          verification_ids: outputVerificationTargets?.verification_ids || []
        }
      };
    })
    .sort((a, b) => {
      const severityCompare = conformanceSeverityRank(b.conformance_state) - conformanceSeverityRank(a.conformance_state);
      return severityCompare !== 0 ? severityCompare : String(a.seam_id || "").localeCompare(String(b.seam_id || ""));
    });

  const counts = {
    aligned: seams.filter((seam) => seam.conformance_state === "aligned").length,
    review_required: seams.filter((seam) => seam.conformance_state === "review_required").length,
    drift_suspected: seams.filter((seam) => seam.conformance_state === "drift_suspected").length,
    no_go: seams.filter((seam) => seam.conformance_state === "no_go").length,
    unverifiable: seams.filter((seam) => seam.conformance_state === "unverifiable").length
  };
  const conformanceStatus = seams[0]?.conformance_state || "aligned";
  const outputs = buildMaintainedOutputGroups(
    diffMaintained?.outputs || maintainedBoundaryArtifact?.outputs || [],
    seams,
    {
      summaryField: "conformance_state",
      severitySelector: conformanceSeverityRank,
      verificationTargetsFallback: verificationTargets || null
    }
  ).map((output) => ({
    output_id: output.output_id,
    label: output.label,
    kind: output.kind,
    root_paths: output.root_paths,
    ownership_boundary: output.ownership_boundary,
    write_scope: output.write_scope,
    verification_targets: output.verification_targets,
    maintained_files_in_scope: output.maintained_files_in_scope,
    human_owned_seams: output.human_owned_seams,
    seam_families: output.seam_families,
    conformance_status: output.summary.highest_severity,
    summary: {
      governed_seam_count: output.seams.length,
      affected_seam_family_count: output.summary.affected_seam_family_count || 0,
      aligned_count: output.seams.filter((seam) => seam.conformance_state === "aligned").length,
      review_required_count: output.seams.filter((seam) => seam.conformance_state === "review_required").length,
      drift_suspected_count: output.seams.filter((seam) => seam.conformance_state === "drift_suspected").length,
      no_go_count: output.seams.filter((seam) => seam.conformance_state === "no_go").length,
      unverifiable_count: output.seams.filter((seam) => seam.conformance_state === "unverifiable").length,
      highest_severity: output.summary.highest_severity,
      affected_seam_families: output.summary.affected_seam_families || []
    },
    seams: output.seams
  }));
  const seamFamilies = stableSortedStrings(seams.map((seam) => seam.seam_family_id).filter(Boolean));

  return {
    type: "maintained_conformance_query",
    baseline_root: diffArtifact?.baseline_root || null,
    diff_summary: summarizeDiffArtifact(diffArtifact),
    conformance_status: conformanceStatus,
    summary: {
      governed_seam_count: seams.length,
      affected_seam_family_count: seamFamilies.length,
      aligned_count: counts.aligned,
      review_required_count: counts.review_required,
      drift_suspected_count: counts.drift_suspected,
      no_go_count: counts.no_go,
      unverifiable_count: counts.unverifiable,
      highest_severity: conformanceStatus,
      affected_seam_families: seamFamilies
    },
    outputs,
    seams,
    verification_targets: verificationTargets || null,
    recommended_next_action: nextAction || null
  };
}

export function buildSeamCheckPayload({
  graph,
  maintainedBoundaryArtifact,
  diffArtifact = null,
  verificationTargets = null,
  nextAction = null,
  seamId = null
}) {
  const diffBacked = Boolean(diffArtifact);
  const sourceSeams = (diffArtifact?.affected_maintained_surfaces?.affected_seams || []).length > 0
    ? diffArtifact.affected_maintained_surfaces.affected_seams
    : (maintainedBoundaryArtifact?.seams || []);
  const filteredSeams = seamId
    ? sourceSeams.filter((seam) => seam.seam_id === seamId || seam.label === seamId)
    : sourceSeams;
  const seamChecks = filteredSeams
    .map((seam) => {
      const normalized = normalizeSeamSummary(seam);
      const check = buildSeamProbeReport(graph, seam, {
        verificationTargets: verificationTargetsForOutput(normalized.output_id, maintainedBoundaryArtifact, verificationTargets),
        outputRecord: (maintainedBoundaryArtifact?.outputs || []).find((output) => output.output_id === normalized.output_id) || null,
        diffBacked
      });
      return {
        ...compactMaintainedSeamSummary(normalized),
        label: normalized.label,
        check_status: check.check_status,
        probes: check.probes,
        verification_targets: verificationTargetsForOutput(normalized.output_id, maintainedBoundaryArtifact, verificationTargets)
      };
    })
    .sort((a, b) => {
      const rank = { no_go: 4, stale: 3, guarded: 2, unverifiable: 1, aligned: 0 };
      const severityCompare = (rank[b.check_status] ?? 0) - (rank[a.check_status] ?? 0);
      return severityCompare !== 0 ? severityCompare : String(a.seam_id || "").localeCompare(String(b.seam_id || ""));
    });
  const summary = {
    seam_count: seamChecks.length,
    seam_family_count: stableSortedStrings(seamChecks.map((item) => item.seam_family_id).filter(Boolean)).length,
    aligned_count: seamChecks.filter((item) => item.check_status === "aligned").length,
    guarded_count: seamChecks.filter((item) => item.check_status === "guarded").length,
    stale_count: seamChecks.filter((item) => item.check_status === "stale").length,
    no_go_count: seamChecks.filter((item) => item.check_status === "no_go").length,
    unverifiable_count: seamChecks.filter((item) => item.check_status === "unverifiable").length,
    highest_status: seamChecks[0]?.check_status || "aligned"
  };

  return {
    type: "seam_check_query",
    baseline_root: diffArtifact?.baseline_root || null,
    diff_summary: summarizeDiffArtifact(diffArtifact),
    summary,
    seams: seamChecks,
    recommended_next_action: nextAction || null
  };
}

export function buildChangePlanPayload({ graph, taskModeArtifact, sliceArtifact, diffArtifact, maintainedBoundaryArtifact }) {
  const basePayload = {
    type: "change_plan_query",
    mode: taskModeArtifact.mode,
    focus: sliceArtifact?.focus || taskModeArtifact.summary?.selected_surface || null,
    summary: taskModeArtifact.summary || null,
    preferred_context_artifacts: taskModeArtifact.preferred_context_artifacts || [],
    next_action: taskModeArtifact.next_action || null,
    review_boundary: sliceArtifact?.review_boundary || null,
    ownership_boundary: sliceArtifact?.ownership_boundary || taskModeArtifact.ownership_boundary || null,
    write_scope: taskModeArtifact.write_scope || sliceArtifact?.write_scope || null,
    verification_targets: taskModeArtifact.verification_targets || sliceArtifact?.verification_targets || null,
    maintained_boundary: maintainedBoundaryArtifact || null,
    diff_summary: summarizeDiffArtifact(diffArtifact)
  };

  const projectionImpacts = graph ? buildProjectionImpacts(graph, { sliceArtifact, diffArtifact }) : [];
  const generatorTargets = graph ? buildGeneratorTargets(graph, projectionImpacts, diffArtifact) : [];
  const maintainedImpacts = buildMaintainedImpacts({
    diffArtifact,
    maintainedBoundaryArtifact,
    sliceArtifact,
    verificationTargets: basePayload.verification_targets
  });

  return {
    ...basePayload,
    change_summary: classifyChangePlan(basePayload, diffArtifact, projectionImpacts, generatorTargets, maintainedImpacts),
    projection_impacts: projectionImpacts,
    generator_targets: generatorTargets,
    maintained_impacts: maintainedImpacts,
    alignment_recommendations: buildAlignmentRecommendations(basePayload, projectionImpacts, generatorTargets, maintainedImpacts)
  };
}

export function classifyRisk({ reviewBoundary, maintainedBoundary, diffSummary, verificationTargets, importPlan, maintainedRisk = null }) {
  const reasons = [];
  const blockingFactors = [];
  const normalizedMaintainedRisk = maintainedRisk || buildMaintainedRiskSummary({
    maintainedBoundary,
    diffSummary
  });
  const workflowPresets = importPlan?.workflow_presets || null;
  const workflowPresetEntries = [
    ...(workflowPresets?.provider || []),
    ...(workflowPresets?.team || [])
  ];
  const activeWorkflowPresets = workflowPresetEntries.filter((preset) =>
    preset.active_for_context &&
    (
      (preset.kind === "provider_workflow_preset" && ["accept", "accepted"].includes(preset.adoption_state)) ||
      (preset.kind === "team_workflow_preset" && !["reject", "rejected", "stage", "staged"].includes(preset.adoption_state))
    )
  );
  const manualDecisionPreset = activeWorkflowPresets.find((preset) => preset.review_class === "manual_decision");
  const reviewRequiredPreset = activeWorkflowPresets.find((preset) => preset.review_class === "review_required");
  const presetRefreshSummary = workflowPresets?.workflow_preset_refresh_summary?.summary || null;

  if (normalizedMaintainedRisk.highest_severity === "no_go") {
    reasons.push("maintained_no_go_seam");
    blockingFactors.push("Maintained-app proof boundaries include no-go changes.");
  }
  if ((reviewBoundary?.automation_class || null) === "no_go") {
    reasons.push("review_boundary_no_go");
    blockingFactors.push("Selected surface is classified as no-go for automation.");
  }
  if ((diffSummary?.review_boundary_change_count || 0) > 0) {
    reasons.push("review_boundary_changes_detected");
    blockingFactors.push("Semantic diff changes existing automation/review boundaries.");
  }
  if ((importPlan?.requires_human_review || []).length > 0) {
    reasons.push("import_requires_human_review");
    blockingFactors.push("Imported proposal surfaces still require human review or mapping decisions.");
  }
  if ((presetRefreshSummary?.requires_fresh_review_count || 0) > 0) {
    reasons.push("workflow_preset_refresh_review_required");
    blockingFactors.push("Provider workflow preset refresh changes require fresh review.");
  }
  if (manualDecisionPreset) {
    reasons.push("provider_workflow_preset_manual_decision");
    blockingFactors.push(`Workflow preset ${manualDecisionPreset.id} escalates provider-sensitive review categories.`);
  }
  if (reviewRequiredPreset) {
    reasons.push("provider_workflow_preset_review_required");
  }
  if (normalizedMaintainedRisk.affected_output_count > 1) {
    reasons.push("maintained_multi_output_impact");
  }
  if ((reviewBoundary?.automation_class || null) === "manual_decision") {
    reasons.push("manual_decision_surface");
  }
  if (normalizedMaintainedRisk.highest_severity === "manual_decision") {
    reasons.push("maintained_manual_decision_seam");
  }
  if (normalizedMaintainedRisk.highest_severity === "review_required") {
    reasons.push("maintained_review_required_seam");
  }
  if ((reviewBoundary?.automation_class || null) === "review_required") {
    reasons.push("review_required_surface");
  }
  if ((verificationTargets?.maintained_app_checks || []).length > 0) {
    reasons.push("maintained_proof_gates");
  }

  let overallRisk = "safe";
  if (reasons.includes("maintained_no_go_seam") || reasons.includes("review_boundary_no_go")) {
    overallRisk = "no_go";
  } else if (
    reasons.includes("review_boundary_changes_detected") ||
    reasons.includes("import_requires_human_review") ||
    reasons.includes("manual_decision_surface") ||
    reasons.includes("maintained_manual_decision_seam") ||
    reasons.includes("provider_workflow_preset_manual_decision") ||
    reasons.includes("workflow_preset_refresh_review_required")
  ) {
    overallRisk = "manual_decision";
  } else if (
    reasons.includes("review_required_surface") ||
    reasons.includes("maintained_review_required_seam") ||
    reasons.includes("maintained_proof_gates") ||
    reasons.includes("provider_workflow_preset_review_required")
  ) {
    overallRisk = "review_required";
  }

  return {
    overall_risk: overallRisk,
    risk_reasons: reasons,
    blocking_factors: blockingFactors,
    recommended_human_review: overallRisk !== "safe"
  };
}

export function buildRiskSummaryPayload({ source, risk, nextAction, maintainedRisk = null }) {
  return {
    type: "risk_summary_query",
    source,
    ...risk,
    maintained_risk: maintainedRisk,
    recommended_next_action: nextAction || null
  };
}

export function proceedDecisionFromRisk(risk, nextAction, writeScope, verificationTargets, maintainedRisk = null, workflowPresets = null, resolvedWorkflowContext = null) {
  let decision = "proceed";
  let reason = "No explicit review or safety blockers were detected.";

  if (risk.overall_risk === "no_go") {
    decision = "stop_no_go";
    reason = "At least one no-go boundary blocks automated progress.";
  } else if (risk.overall_risk === "manual_decision") {
    decision = "stage_only";
    reason = "This change should be staged or reviewed rather than applied directly.";
  } else if (risk.overall_risk === "review_required") {
    decision = "proceed_with_review";
    reason = "The change is possible, but it should proceed with explicit human review.";
  }

  const presetGuidanceSummary = buildPresetGuidanceSummary(workflowPresets, resolvedWorkflowContext);
  return {
    type: "proceed_decision_query",
    decision,
    reason,
    blocking_factors: risk.blocking_factors || [],
    required_human_review: Boolean(risk.recommended_human_review),
    recommended_next_action: nextAction || null,
    recommended_query_family: recommendedQueryFamilyForAction(nextAction, resolvedWorkflowContext?.resolved_task_mode || null),
    recommended_write_scope: writeScope || null,
    recommended_verification_targets: verificationTargets || null,
    operator_loop: buildOperatorLoopSummary({
      mode: resolvedWorkflowContext?.resolved_task_mode || null,
      nextAction,
      primaryArtifacts: resolvedWorkflowContext?.artifact_load_order || [],
      verificationTargets,
      currentSurface: "proceed-decision"
    }),
    maintained_risk: maintainedRisk,
    maintained_seam_review_summary: maintainedRisk?.maintained_seam_review_summary || null,
    output_verification_targets: maintainedRisk?.output_verification_targets || [],
    preset_guidance_summary: presetGuidanceSummary,
    active_preset_ids: presetGuidanceSummary.active_preset_ids
  };
}

function buildPresetGuidanceSummary(workflowPresets = null, resolvedWorkflowContext = null) {
  const activePresetIds = [
    ...(resolvedWorkflowContext?.applied_presets || []).map((preset) => preset.id),
    ...((workflowPresets?.provider || []).filter((preset) => preset.active_for_context && ["accept", "accepted"].includes(preset.adoption_state)).map((preset) => preset.id)),
    ...((workflowPresets?.team || []).filter((preset) => preset.active_for_context && !["reject", "rejected", "stage", "staged"].includes(preset.adoption_state)).map((preset) => preset.id))
  ];
  const refreshSummary = workflowPresets?.workflow_preset_refresh_summary?.summary || null;
  const recommendedPresetAction = (workflowPresets?.workflow_preset_surfaces || [])
    .map((surface) => surface.recommended_customization_action)
    .find(Boolean)
    || ((workflowPresets?.provider_manifest_summary?.missing_declared_workflow_preset_count || 0) > 0 ? "import_declared_workflow_preset" : null);
  const presetBlockers = stableSortedStrings([
    ...(resolvedWorkflowContext?.effective_review_policy?.block_on || []),
    ...((refreshSummary?.requires_fresh_review_count || 0) > 0 ? ["workflow_preset_refresh_review_required"] : []),
    ...((workflowPresets?.provider_manifest_summary?.invalid_declared_workflow_preset_count || 0) > 0 ? ["invalid_manifest_declared_workflow_preset"] : [])
  ]);
  return {
    active_preset_ids: stableSortedStrings(activePresetIds),
    preset_blockers: presetBlockers,
    recommended_preset_action: recommendedPresetAction,
    summary: {
      active_provider_count: workflowPresets?.active_provider_count || 0,
      active_team_count: workflowPresets?.active_team_count || 0,
      skipped_count: (resolvedWorkflowContext?.skipped_presets || []).length,
      manifest_declared_count: workflowPresets?.provider_manifest_summary?.declared_workflow_preset_count || 0,
      missing_declared_count: workflowPresets?.provider_manifest_summary?.missing_declared_workflow_preset_count || 0
    }
  };
}

export function buildCanonicalWritesPayloadForImportPlan(proposalSurfaces = []) {
  return {
    type: "canonical_writes_query",
    source: "import-plan",
    canonical_writes: proposalSurfaces
      .filter((surface) => surface.canonical_rel_path)
      .map((surface) => ({
        id: surface.id,
        current_state: surface.current_state,
        recommended_state: surface.recommended_state,
        canonical_rel_path: surface.canonical_rel_path,
        canonical_path: `topogram/${surface.canonical_rel_path}`
      }))
  };
}

export function buildCanonicalWritesPayloadForChangePlan(writeScope) {
  return {
    type: "canonical_writes_query",
    source: "change-plan",
    canonical_writes: canonicalWriteCandidatesFromWriteScope(writeScope).map((entry) => ({
      path: entry
    }))
  };
}

export function buildReviewPacketPayloadForImportPlan({ importPlan, risk }) {
  const presetGuidanceSummary = buildPresetGuidanceSummary(importPlan.workflow_presets || null, null);
  return {
    type: "review_packet_query",
    source: "import-plan",
    summary: importPlan.summary || null,
    risk_summary: {
      overall_risk: risk.overall_risk,
      risk_reasons: risk.risk_reasons,
      blocking_factors: risk.blocking_factors,
      maintained_risk: importPlan.maintained_risk || null
    },
    next_action: importPlan.next_action || null,
    recommended_query_family: recommendedQueryFamilyForAction(importPlan.next_action, "import-adopt"),
    canonical_writes: (importPlan.proposal_surfaces || [])
      .filter((surface) => surface.canonical_rel_path)
      .map((surface) => ({
        id: surface.id,
        canonical_rel_path: surface.canonical_rel_path,
        canonical_path: `topogram/${surface.canonical_rel_path}`
      })),
    review_groups: importPlan.review_groups || [],
    write_scope: importPlan.write_scope || null,
    verification_targets: importPlan.verification_targets || null,
    proposal_surfaces: importPlan.proposal_surfaces || [],
    maintained_risk: importPlan.maintained_risk || null,
    maintained_seam_review_summary: importPlan.maintained_seam_review_summary || null,
    operator_loop: buildOperatorLoopSummary({
      mode: "import-adopt",
      nextAction: importPlan.next_action || null,
      primaryArtifacts: ["import-plan", "adoption-plan.agent.json"],
      verificationTargets: importPlan.verification_targets || null,
      currentSurface: "review-packet"
    }),
    output_verification_targets: importPlan.maintained_risk?.output_verification_targets || [],
    preset_guidance_summary: presetGuidanceSummary,
    active_preset_ids: presetGuidanceSummary.active_preset_ids,
    preset_blockers: presetGuidanceSummary.preset_blockers,
    recommended_preset_action: presetGuidanceSummary.recommended_preset_action,
    workflow_presets: importPlan.workflow_presets || null,
    workflow_preset_surfaces: importPlan.workflow_presets?.workflow_preset_surfaces || [],
    workflow_preset_refresh_summary: importPlan.workflow_presets?.workflow_preset_refresh_summary || null
  };
}

export function buildReviewPacketPayloadForChangePlan({ changePlan, risk }) {
  const maintainedRisk = buildMaintainedRiskSummary({
    maintainedImpacts: changePlan.maintained_impacts,
    maintainedBoundary: changePlan.maintained_boundary,
    diffSummary: changePlan.diff_summary
  });
  return {
    type: "review_packet_query",
    source: "change-plan",
    summary: changePlan.summary || null,
    change_summary: changePlan.change_summary || null,
    risk_summary: {
      overall_risk: risk.overall_risk,
      risk_reasons: risk.risk_reasons,
      blocking_factors: risk.blocking_factors,
      maintained_risk: maintainedRisk
    },
    next_action: changePlan.next_action || null,
    recommended_query_family: recommendedQueryFamilyForAction(changePlan.next_action, changePlan.mode || null),
    canonical_writes: canonicalWriteCandidatesFromWriteScope(changePlan.write_scope).map((entry) => ({
      path: entry
    })),
    review_boundary: changePlan.review_boundary || null,
    maintained_boundary: changePlan.maintained_boundary || null,
    maintained_impacts: changePlan.maintained_impacts || null,
    diff_summary: changePlan.diff_summary || null,
    write_scope: changePlan.write_scope || null,
    verification_targets: changePlan.verification_targets || null,
    operator_loop: buildOperatorLoopSummary({
      mode: changePlan.mode || null,
      nextAction: changePlan.next_action || null,
      primaryArtifacts: changePlan.context_artifacts || [],
      verificationTargets: changePlan.verification_targets || null,
      currentSurface: "review-packet"
    }),
    alignment_recommendations: changePlan.alignment_recommendations || [],
    output_verification_targets: maintainedRisk.output_verification_targets || []
  };
}

function currentFocusFromTaskMode(taskModeArtifact) {
  const selectedSurface = taskModeArtifact?.summary?.selected_surface || null;
  if (selectedSurface) {
    return selectedSurface;
  }
  const focus = taskModeArtifact?.summary?.focus || null;
  return focus ? { kind: "mode_focus", label: focus } : null;
}

function verificationSurfaceForTargets(verificationTargets) {
  const targetCount = ((verificationTargets?.generated_checks || []).length)
    + ((verificationTargets?.maintained_app_checks || []).length)
    + ((verificationTargets?.verification_ids || []).length);
  return targetCount > 0 ? "verification-targets" : null;
}

function recommendedQueryFamilyForAction(nextAction, mode = null) {
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

function immediateArtifacts(primaryArtifacts = []) {
  return (primaryArtifacts || []).slice(0, 2);
}

function buildOperatorLoopSummary({
  mode = null,
  nextAction = null,
  primaryArtifacts = [],
  verificationTargets = null,
  currentSurface = null
} = {}) {
  return {
    current_surface: currentSurface,
    start_query_family: recommendedQueryFamilyForAction(nextAction, mode),
    immediate_artifacts: immediateArtifacts(primaryArtifacts),
    review_surface: "review-packet",
    decision_surface: "proceed-decision",
    verification_surface: verificationSurfaceForTargets(verificationTargets)
  };
}

function nextActionRequiresReview(nextAction) {
  const reviewKinds = new Set([
    "review_staged",
    "inspect_review_group",
    "inspect_proposal_surface",
    "inspect_plan",
    "inspect_boundary_before_edit",
    "review_diff_boundaries",
    "review_diff_impact",
    "inspect_maintained_impact",
    "inspect_generated_impact",
    "inspect_diff",
    "inspect_verification_targets",
    "inspect_workspace_digest"
  ]);
  return reviewKinds.has(nextAction?.kind);
}

function buildReviewBoundaries(taskModeArtifact, importPlan = null) {
  return {
    ownership_boundary: taskModeArtifact?.ownership_boundary || null,
    review_emphasis: taskModeArtifact?.review_emphasis || [],
    approved_review_groups: importPlan?.review_groups || [],
    requires_human_review: importPlan?.requires_human_review || []
  };
}

function buildBlockingConditions(taskModeArtifact, importPlan = null) {
  const blocking = [];
  const nextAction = taskModeArtifact?.next_action || null;

  if (nextAction?.kind === "missing_plan") {
    blocking.push({
      kind: "missing_artifact",
      artifact: "candidates/reconcile/adoption-plan.agent.json",
      reason: nextAction.reason || "No staged adoption plan exists yet.",
      recommended_step: "Run reconcile first."
    });
  }

  if ((importPlan?.requires_human_review || []).length > 0) {
    blocking.push({
      kind: "human_review_required",
      count: importPlan.requires_human_review.length,
      items: importPlan.requires_human_review,
      reason: `${importPlan.requires_human_review.length} staged proposal(s) still require human review or mapping decisions before canonical adoption.`
    });
  }

  if (nextAction && nextActionRequiresReview(nextAction)) {
    blocking.push({
      kind: "review_gate",
      next_action_kind: nextAction.kind,
      reason: nextAction.reason || "The next step is review-oriented rather than directly executable."
    });
  }

  return blocking;
}

function firstPrimaryArtifact(taskModeArtifact) {
  return (taskModeArtifact?.preferred_context_artifacts || [])[0] || null;
}

function buildImportAdoptSequence(taskModeArtifact, importPlan = null) {
  const steps = [];
  const primaryArtifact = firstPrimaryArtifact(taskModeArtifact);
  if (primaryArtifact) {
    steps.push({
      order: steps.length + 1,
      action: "read_primary_artifact",
      artifact: primaryArtifact,
      review_required: false,
      reason: "Start from the staged adoption view before changing canonical Topogram."
    });
  }
  if (importPlan) {
    steps.push({
      order: steps.length + 1,
      action: "inspect_adoption_state",
      review_required: (importPlan.requires_human_review || []).length > 0,
      reason: `${(importPlan.staged_items || []).length} staged item(s) and ${(importPlan.requires_human_review || []).length} review-required item(s) are currently in scope.`
    });
  }
  if (taskModeArtifact?.next_action) {
    steps.push({
      order: steps.length + 1,
      action: "follow_next_action",
      next_action_kind: taskModeArtifact.next_action.kind,
      review_required: nextActionRequiresReview(taskModeArtifact.next_action),
      reason: taskModeArtifact.next_action.reason || "Follow the current staged adoption step."
    });
  }
  steps.push({
    order: steps.length + 1,
    action: "run_proof_targets",
    review_required: false,
    proof_targets: taskModeArtifact?.verification_targets || null,
    reason: "Validate proposal state before any canonical write."
  });
  return steps;
}

function buildMaintainedAppEditSequence(taskModeArtifact) {
  const steps = [];
  const primaryArtifact = firstPrimaryArtifact(taskModeArtifact);
  if (primaryArtifact) {
    steps.push({
      order: 1,
      action: "read_primary_artifact",
      artifact: primaryArtifact,
      review_required: false,
      reason: "Start from the maintained-app bundle to see accepted, guarded, and no-go seams."
    });
  }
  steps.push({
    order: steps.length + 1,
    action: "inspect_review_boundaries",
    review_required: true,
    reason: "Review human-owned seams and guarded boundaries before editing maintained code."
  });
  steps.push({
    order: steps.length + 1,
    action: "respect_write_scope",
    review_required: false,
    reason: "Keep edits inside the maintained write scope attached to the current proof bundle."
  });
  steps.push({
    order: steps.length + 1,
    action: "run_proof_targets",
    review_required: false,
    proof_targets: taskModeArtifact?.verification_targets || null,
    reason: "Run maintained proof checks after the bounded edit."
  });
  return steps;
}

function buildGenericSequence(taskModeArtifact, {
  readReason,
  reviewReason,
  proofReason
} = {}) {
  const steps = [];
  const primaryArtifact = firstPrimaryArtifact(taskModeArtifact);
  if (primaryArtifact) {
    steps.push({
      order: steps.length + 1,
      action: "read_primary_artifact",
      artifact: primaryArtifact,
      review_required: false,
      reason: readReason || "Start from the preferred context artifact for this mode."
    });
  }
  if (taskModeArtifact?.next_action) {
    steps.push({
      order: steps.length + 1,
      action: "follow_next_action",
      next_action_kind: taskModeArtifact.next_action.kind,
      review_required: nextActionRequiresReview(taskModeArtifact.next_action),
      reason: taskModeArtifact.next_action.reason || "Follow the current recommended next action."
    });
  }
  steps.push({
    order: steps.length + 1,
    action: "inspect_review_boundaries",
    review_required: true,
    reason: reviewReason || "Use the attached review emphasis and ownership boundary before mutating durable meaning."
  });
  steps.push({
    order: steps.length + 1,
    action: "run_proof_targets",
    review_required: false,
    proof_targets: taskModeArtifact?.verification_targets || null,
    reason: proofReason || "Run the smallest proof set attached to this mode."
  });
  return steps;
}

function buildRecommendedSequence(taskModeArtifact, importPlan = null) {
  const mode = taskModeArtifact?.mode || null;
  if (mode === "import-adopt") {
    return buildImportAdoptSequence(taskModeArtifact, importPlan);
  }
  if (mode === "maintained-app-edit") {
    return buildMaintainedAppEditSequence(taskModeArtifact);
  }
  if (mode === "diff-review") {
    return buildGenericSequence(taskModeArtifact, {
      readReason: "Start from the diff or focused slice before choosing an edit path.",
      reviewReason: "Diff review should stay read-first until maintained and generated impact is clear.",
      proofReason: "Keep proof selection attached to the affected semantic change."
    });
  }
  if (mode === "verification") {
    return buildGenericSequence(taskModeArtifact, {
      readReason: "Start from the focused verification context before running checks.",
      reviewReason: "Confirm the intended verification surface before widening the check set.",
      proofReason: "Run the smallest correct proof set for the current task."
    });
  }
  return buildGenericSequence(taskModeArtifact, {
    readReason: "Start from the focused modeling context before editing canonical Topogram.",
    reviewReason: "Review semantic boundaries before changing durable intent.",
    proofReason: "Run the proof targets attached to the selected semantic closure."
  });
}

function coreWorkflowQueriesForMode(mode) {
  return WORKFLOW_QUERY_FAMILIES_BY_MODE[mode] || ["change-plan", "risk-summary", "verification-targets"];
}

function activeWorkflowPresetsForContext({
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

function mergeFieldResolution(entries = []) {
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

function composeWorkflowToolHints(providerPresets, teamPresets) {
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
    ...(taskModeArtifact?.preferred_context_artifacts || [])
  ]);
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

function laneRolePriority(role) {
  switch (role) {
    case "bundle_reviewer":
      return 0;
    case "auth_reviewer":
      return 1;
    case "mapping_reviewer":
      return 2;
    case "doc_promoter":
      return 3;
    case "adoption_operator":
      return 4;
    case "verification_runner":
      return 5;
    default:
      return 99;
  }
}

function canonicalTargetsForProposalSurfaces(proposalSurfaces = []) {
  return stableSortedStrings(
    proposalSurfaces
      .filter((surface) => surface.canonical_rel_path)
      .map((surface) => `topogram/${surface.canonical_rel_path}`)
  );
}

function reviewSelectorsFromImportPlan(importPlan = null) {
  return stableSortedStrings(
    (importPlan?.review_groups || []).map((id) => normalizeReviewGroupSelector(id)).filter(Boolean)
  );
}

function projectionIdsFromProposalSurfaces(proposalSurfaces = []) {
  return stableSortedStrings(
    proposalSurfaces.flatMap((surface) => (surface.projection_impacts || []).map((impact) => impact.projection_id)).filter(Boolean)
  );
}

function bundleProposalSurfaces(bundleSlug, importPlan = null) {
  if (!bundleSlug) {
    return [];
  }
  return (importPlan?.proposal_surfaces || []).filter((surface) => String(surface.id || "").includes(`${bundleSlug}:`) || String(surface.id || "").includes(`:${bundleSlug}`) || String(surface.canonical_rel_path || "").includes(`/${bundleSlug}`));
}

function buildLane({
  lane_id,
  role,
  bundle = null,
  purpose,
  allowed_inputs,
  write_scope,
  owned_targets,
  proof_targets,
  blocking_dependencies = [],
  completion_condition,
  publishes
}) {
  return {
    lane_id,
    role,
    bundle,
    purpose,
    allowed_inputs,
    write_scope,
    owned_targets,
    proof_targets,
    blocking_dependencies,
    completion_condition,
    publishes
  };
}

function buildBundleReviewerLanes(report, adoptionStatus, importPlan, singleAgentPlan) {
  return (report?.candidate_model_bundles || []).map((bundle) => {
    const bundlePriority = (adoptionStatus?.bundle_priorities || []).find((entry) => entry.bundle === bundle.slug) || null;
    const proposalSurfaces = bundleProposalSurfaces(bundle.slug, importPlan);
    const reviewSelectors = stableSortedStrings([
      bundlePriority?.recommend_bundle_review_selector || null,
      ...(bundlePriority?.next_review_groups || []).map((group) => normalizeReviewGroupSelector(group.id)).filter(Boolean)
    ]);
    return buildLane({
      lane_id: `bundle_reviewer.${bundle.slug}`,
      role: "bundle_reviewer",
      bundle: bundle.slug,
      purpose: "Review one candidate bundle and its proposal state before canonical adoption.",
      allowed_inputs: [
        "candidates/reconcile/report.json",
        "candidates/reconcile/adoption-status.json",
        "candidates/reconcile/adoption-plan.agent.json"
      ],
      write_scope: singleAgentPlan.write_scope,
      owned_targets: {
        bundles: [bundle.slug],
        review_groups: reviewSelectors,
        canonical_targets: canonicalTargetsForProposalSurfaces(proposalSurfaces),
        projection_ids: projectionIdsFromProposalSurfaces(proposalSurfaces)
      },
      proof_targets: singleAgentPlan.proof_targets,
      completion_condition: "Bundle review is complete when its review-oriented proposal surfaces are accepted, deferred, or clearly blocked with reason.",
      publishes: [`handoff:bundle-review.${bundle.slug}`]
    });
  });
}

function buildAuthReviewerLanes(report, adoptionStatus, importPlan, singleAgentPlan) {
  const hintsQuery = buildAuthHintsQueryPayload(report, adoptionStatus);
  const bundles = new Set([
    ...hintsQuery.unresolved_hints.map((hint) => hint.bundle),
    ...hintsQuery.deferred_hints.map((hint) => hint.bundle)
  ]);
  return [...bundles].sort().map((bundleSlug) => {
    const bundlePacket = buildAuthReviewPacketPayload(report, adoptionStatus, bundleSlug);
    const proposalSurfaces = bundleProposalSurfaces(bundleSlug, importPlan);
    return buildLane({
      lane_id: `auth_reviewer.${bundleSlug}`,
      role: "auth_reviewer",
      bundle: bundleSlug,
      purpose: "Review auth-sensitive hints and follow-up for one bundle before canonical promotion.",
      allowed_inputs: [
        "candidates/reconcile/report.json",
        "candidates/reconcile/adoption-status.json"
      ],
      write_scope: singleAgentPlan.write_scope,
      owned_targets: {
        bundles: [bundleSlug],
        review_groups: stableSortedStrings([bundlePacket?.next_review_selector, bundlePacket?.bundle_review_selector].filter(Boolean)),
        canonical_targets: stableSortedStrings([
          ...canonicalTargetsForProposalSurfaces(proposalSurfaces),
          ...(bundlePacket?.projection_patch_actions || []).map((entry) => `patch:${entry.action}`)
        ]),
        projection_ids: projectionIdsFromProposalSurfaces(proposalSurfaces)
      },
      proof_targets: singleAgentPlan.proof_targets,
      completion_condition: "Auth review is complete when unresolved and deferred auth hints are resolved into adopted, deferred, or blocked outcomes with explicit reasoning.",
      publishes: [`handoff:auth-review.${bundleSlug}`]
    });
  });
}

function buildMappingReviewerLane(importPlan, singleAgentPlan) {
  const mappingSurfaces = (importPlan?.proposal_surfaces || []).filter((surface) =>
    surface.recommended_state === "map" || surface.recommended_state === "customize" || surface.current_state === "map" || surface.current_state === "customize"
  );
  if (mappingSurfaces.length === 0) {
    return [];
  }
  return [buildLane({
    lane_id: "mapping_reviewer",
    role: "mapping_reviewer",
    purpose: "Resolve proposal surfaces that still need mapping or customization decisions before canonical adoption.",
    allowed_inputs: [
      "candidates/reconcile/adoption-plan.agent.json",
      "candidates/reconcile/report.json"
    ],
    write_scope: singleAgentPlan.write_scope,
    owned_targets: {
      bundles: [],
      review_groups: reviewSelectorsFromImportPlan(importPlan),
      canonical_targets: canonicalTargetsForProposalSurfaces(mappingSurfaces),
      projection_ids: projectionIdsFromProposalSurfaces(mappingSurfaces)
    },
    proof_targets: singleAgentPlan.proof_targets,
    blocking_dependencies: [],
    completion_condition: "All mapping-sensitive proposal surfaces are mapped, customized, deferred, or explicitly rejected.",
    publishes: ["handoff:mapping-review"]
  })];
}

function buildDocPromoterLane(importPlan, singleAgentPlan) {
  const docSurfaces = (importPlan?.proposal_surfaces || []).filter((surface) => String(surface.canonical_rel_path || "").startsWith("docs/"));
  if (docSurfaces.length === 0) {
    return [];
  }
  return [buildLane({
    lane_id: "doc_promoter",
    role: "doc_promoter",
    purpose: "Review and prepare documentation-oriented proposal surfaces for later adoption.",
    allowed_inputs: [
      "candidates/reconcile/adoption-plan.agent.json",
      "candidates/reconcile/report.json"
    ],
    write_scope: singleAgentPlan.write_scope,
    owned_targets: {
      bundles: [],
      review_groups: reviewSelectorsFromImportPlan(importPlan),
      canonical_targets: canonicalTargetsForProposalSurfaces(docSurfaces),
      projection_ids: projectionIdsFromProposalSurfaces(docSurfaces)
    },
    proof_targets: singleAgentPlan.proof_targets,
    blocking_dependencies: [],
    completion_condition: "Documentation proposal surfaces are reviewed and ready for explicit adoption or deferral.",
    publishes: ["handoff:doc-promotion-review"]
  })];
}

function buildAdoptionOperatorLane(importPlan, singleAgentPlan) {
  const canonicalTargets = canonicalTargetsForProposalSurfaces(importPlan?.proposal_surfaces || []);
  return buildLane({
    lane_id: "adoption_operator",
    role: "adoption_operator",
    purpose: "Own the single-writer canonical adoption step after review lanes finish.",
    allowed_inputs: [
      "candidates/reconcile/adoption-plan.agent.json",
      "candidates/reconcile/report.json",
      "candidates/reconcile/adoption-status.json"
    ],
    write_scope: singleAgentPlan.write_scope,
    owned_targets: {
      bundles: [],
      review_groups: reviewSelectorsFromImportPlan(importPlan),
      canonical_targets: canonicalTargets,
      projection_ids: projectionIdsFromProposalSurfaces(importPlan?.proposal_surfaces || [])
    },
    proof_targets: singleAgentPlan.proof_targets,
    blocking_dependencies: [],
    completion_condition: "Canonical adoption runs exactly once against the merged reviewed state.",
    publishes: ["handoff:canonical-adoption"]
  });
}

function buildVerificationRunnerLane(singleAgentPlan) {
  return buildLane({
    lane_id: "verification_runner",
    role: "verification_runner",
    purpose: "Run the proof set against merged canonical state after adoption completes.",
    allowed_inputs: [
      "candidates/reconcile/adoption-status.json",
      "candidates/reconcile/report.json"
    ],
    write_scope: singleAgentPlan.write_scope,
    owned_targets: {
      bundles: [],
      review_groups: [],
      canonical_targets: [],
      projection_ids: []
    },
    proof_targets: singleAgentPlan.proof_targets,
    blocking_dependencies: ["gate.canonical_adoption"],
    completion_condition: "The smallest attached proof set has been run after canonical adoption completes.",
    publishes: ["handoff:verification"]
  });
}

function targetsOverlap(a = [], b = []) {
  const set = new Set(a || []);
  return (b || []).some((entry) => set.has(entry));
}

function laneOverlapSummary(laneA, laneB) {
  const reasons = [];
  if (targetsOverlap(laneA.owned_targets?.canonical_targets, laneB.owned_targets?.canonical_targets)) {
    reasons.push("shared_canonical_targets");
  }
  if (targetsOverlap(laneA.owned_targets?.review_groups, laneB.owned_targets?.review_groups)) {
    reasons.push("shared_review_groups");
  }
  if (targetsOverlap(laneA.owned_targets?.projection_ids, laneB.owned_targets?.projection_ids)) {
    reasons.push("shared_projection_ids");
  }
  if (targetsOverlap(laneA.owned_targets?.bundles, laneB.owned_targets?.bundles) &&
      ((laneA.owned_targets?.canonical_targets || []).length > 0 || (laneB.owned_targets?.canonical_targets || []).length > 0)) {
    reasons.push("shared_bundle_scope");
  }
  return reasons;
}

function buildOverlapRules(lanes = []) {
  const rules = [];
  for (let index = 0; index < lanes.length; index += 1) {
    for (let inner = index + 1; inner < lanes.length; inner += 1) {
      const left = lanes[index];
      const right = lanes[inner];
      const overlapReasons = laneOverlapSummary(left, right);
      if (overlapReasons.length > 0) {
        rules.push({
          rule_id: `${left.lane_id}__${right.lane_id}`,
          lanes: [left.lane_id, right.lane_id],
          overlap_reasons: overlapReasons,
          policy: "serialize",
          reason: "Parallel work must not compete for the same canonical destination or review ownership."
        });
      }
    }
  }
  return rules;
}

function buildHandoffPackets(lanes = [], overlapRules = []) {
  const overlapMap = new Map();
  for (const rule of overlapRules) {
    for (const laneId of rule.lanes || []) {
      if (!overlapMap.has(laneId)) {
        overlapMap.set(laneId, []);
      }
      overlapMap.get(laneId).push(rule);
    }
  }

  return lanes
    .filter((lane) => lane.role !== "adoption_operator" && lane.role !== "verification_runner")
    .map((lane) => ({
      packet_id: lane.publishes?.[0] || `handoff:${lane.lane_id}`,
      from_lane: lane.lane_id,
      to_lane: "adoption_operator",
      status: "awaiting_review",
      scope: {
        bundle: lane.bundle || null,
        review_groups: lane.owned_targets?.review_groups || []
      },
      decision_summary: {
        completion_condition: lane.completion_condition,
        overlap_constraints: (overlapMap.get(lane.lane_id) || []).map((rule) => rule.rule_id)
      },
      canonical_targets: lane.owned_targets?.canonical_targets || [],
      recommended_next_action: {
        action: lane.role === "auth_reviewer" || lane.role === "bundle_reviewer" || lane.role === "mapping_reviewer" || lane.role === "doc_promoter"
          ? "publish_review_state"
          : "wait",
        selector: (lane.owned_targets?.review_groups || [])[0] || null
      },
      blocking_reasons: lane.blocking_dependencies || [],
      proof_expectations: lane.proof_targets || null
    }));
}

function buildSerializedGates(lanes = []) {
  const reviewLaneIds = lanes
    .filter((lane) => !["adoption_operator", "verification_runner"].includes(lane.role))
    .map((lane) => lane.lane_id);
  return [
    {
      gate_id: "gate.review_resolution",
      owner_lane: null,
      action: "resolve_review_packets",
      blocks_until: reviewLaneIds,
      reason: "Canonical adoption must wait until review-oriented lanes publish their outcomes."
    },
    {
      gate_id: "gate.canonical_adoption",
      owner_lane: "adoption_operator",
      action: "run_from_plan_write",
      blocks_until: ["gate.review_resolution"],
      reason: "Canonical promotion is a single-writer step."
    },
    {
      gate_id: "gate.post_adoption_proof",
      owner_lane: "verification_runner",
      action: "run_proof_targets",
      blocks_until: ["gate.canonical_adoption"],
      reason: "Proof should run against merged canonical state."
    }
  ];
}

function buildJoinPoints(lanes = []) {
  const reviewLaneIds = lanes
    .filter((lane) => !["adoption_operator", "verification_runner"].includes(lane.role))
    .map((lane) => lane.lane_id);
  return [
    {
      join_id: "join.review_packets_ready",
      requires: reviewLaneIds,
      then_enables: ["gate.review_resolution"]
    },
    {
      join_id: "join.canonical_state_ready",
      requires: ["gate.canonical_adoption"],
      then_enables: ["gate.post_adoption_proof"]
    },
    {
      join_id: "join.proof_complete",
      requires: ["gate.post_adoption_proof"],
      then_enables: []
    }
  ];
}

function buildParallelWorkstreams(lanes = [], overlapRules = []) {
  const reviewLanes = lanes.filter((lane) => !["adoption_operator", "verification_runner", "mapping_reviewer", "doc_promoter"].includes(lane.role));
  const blockedPairs = new Set(overlapRules.flatMap((rule) => {
    const [a, b] = rule.lanes || [];
    return [`${a}::${b}`, `${b}::${a}`];
  }));
  const workstreams = [];
  for (const lane of reviewLanes.sort((a, b) => laneRolePriority(a.role) - laneRolePriority(b.role) || String(a.bundle || a.lane_id).localeCompare(String(b.bundle || b.lane_id)))) {
    let placed = false;
    for (const stream of workstreams) {
      const conflicts = stream.lane_ids.some((existingLaneId) => blockedPairs.has(`${lane.lane_id}::${existingLaneId}`));
      if (!conflicts) {
        stream.lane_ids.push(lane.lane_id);
        if (lane.bundle && !stream.bundles.includes(lane.bundle)) {
          stream.bundles.push(lane.bundle);
        }
        placed = true;
        break;
      }
    }
    if (!placed) {
      workstreams.push({
        workstream_id: `parallel.${workstreams.length + 1}`,
        lane_ids: [lane.lane_id],
        bundles: lane.bundle ? [lane.bundle] : [],
        reason: "These review-oriented lanes do not overlap on canonical targets or review ownership."
      });
    }
  }
  return workstreams;
}

function buildMultiAgentSummary(lanes, parallelWorkstreams, overlapRules, handoffPackets) {
  const laneCounts = lanes.reduce((acc, lane) => {
    acc[lane.role] = (acc[lane.role] || 0) + 1;
    return acc;
  }, {});
  return {
    lane_count: lanes.length,
    role_counts: laneCounts,
    parallel_workstream_count: parallelWorkstreams.length,
    serialized_gate_count: 3,
    overlap_rule_count: overlapRules.length,
    handoff_packet_count: handoffPackets.length
  };
}

function buildMultiAgentRecommendedSequence(singleAgentPlan, parallelWorkstreams, serializedGates, resolvedWorkflowContext = null) {
  const steps = [
    {
      order: 1,
      action: "read_single_agent_plan",
      reason: "Start from the default single-agent plan before splitting work.",
      source: singleAgentPlan.type
    },
    {
      order: 2,
      action: "dispatch_parallel_review_lanes",
      reason: parallelWorkstreams.length > 0
        ? `Dispatch ${parallelWorkstreams.length} non-overlapping review workstream(s).`
        : "No safe parallel review workstreams were identified; keep review serialized."
    },
    {
      order: 3,
      action: "resolve_review_packets",
      reason: "Wait for review-oriented lanes to publish handoff packets before canonical adoption."
    },
    {
      order: 4,
      action: "run_from_plan_write",
      reason: serializedGates.find((gate) => gate.gate_id === "gate.canonical_adoption")?.reason || "Canonical promotion is a single-writer step."
    },
    {
      order: 5,
      action: "run_proof_targets",
      reason: serializedGates.find((gate) => gate.gate_id === "gate.post_adoption_proof")?.reason || "Proof should run after canonical adoption."
    }
  ];
  if ((resolvedWorkflowContext?.effective_review_policy?.escalate_categories || []).length > 0) {
    steps.splice(2, 0, {
      order: 3,
      action: "apply_resolved_workflow_review_policy",
      reason: `Carry resolved review escalation categories through the lane plan: ${resolvedWorkflowContext.effective_review_policy.escalate_categories.join(", ")}.`
    });
    for (let index = 3; index < steps.length; index += 1) {
      steps[index].order = index + 1;
    }
  }
  return steps;
}

function laneWorkflowContextOverrides(lane, resolvedWorkflowContext) {
  if (!resolvedWorkflowContext) return null;
  const overrides = {};
  if (JSON.stringify(lane.write_scope || null) !== JSON.stringify(resolvedWorkflowContext.effective_write_scope || null)) {
    overrides.effective_write_scope = lane.write_scope || null;
  }
  if (JSON.stringify(lane.proof_targets || null) !== JSON.stringify(resolvedWorkflowContext.effective_verification_policy || null)) {
    overrides.effective_verification_policy = {
      ...resolvedWorkflowContext.effective_verification_policy,
      lane_proof_targets: lane.proof_targets || null
    };
  }
  return Object.keys(overrides).length > 0 ? overrides : null;
}

export function buildMultiAgentPlanPayload({
  workspace,
  singleAgentPlan,
  importPlan,
  report,
  adoptionStatus,
  resolvedWorkflowContext = null
}) {
  const presetGuidanceSummary = buildPresetGuidanceSummary(importPlan?.workflow_presets || null, resolvedWorkflowContext || singleAgentPlan?.resolved_workflow_context || null);
  const lanes = [
    ...buildBundleReviewerLanes(report, adoptionStatus, importPlan, singleAgentPlan),
    ...buildAuthReviewerLanes(report, adoptionStatus, importPlan, singleAgentPlan),
    ...buildMappingReviewerLane(importPlan, singleAgentPlan),
    ...buildDocPromoterLane(importPlan, singleAgentPlan),
    buildAdoptionOperatorLane(importPlan, singleAgentPlan),
    buildVerificationRunnerLane(singleAgentPlan)
  ].map((lane) => ({
    ...lane,
    workflow_context_overrides: laneWorkflowContextOverrides(lane, resolvedWorkflowContext)
  }));
  const overlapRules = buildOverlapRules(lanes);
  const parallelWorkstreams = buildParallelWorkstreams(lanes, overlapRules);
  const handoffPackets = buildHandoffPackets(lanes, overlapRules);
  const serializedGates = buildSerializedGates(lanes);
  const joinPoints = buildJoinPoints(lanes);
  return {
    type: "multi_agent_plan",
    workspace: workspace || null,
    mode: "import-adopt",
    source_single_agent_plan: singleAgentPlan,
    summary: buildMultiAgentSummary(lanes, parallelWorkstreams, overlapRules, handoffPackets),
    coordination_strategy: {
      model: "artifact_handoff",
      freeform_agent_messaging: "discouraged",
      single_writer_for_canonical: true
    },
    preset_guidance_summary: presetGuidanceSummary,
    active_preset_ids: presetGuidanceSummary.active_preset_ids,
    preset_blockers: presetGuidanceSummary.preset_blockers,
    recommended_preset_action: presetGuidanceSummary.recommended_preset_action,
    resolved_workflow_context: resolvedWorkflowContext || singleAgentPlan?.resolved_workflow_context || null,
    lanes,
    parallel_workstreams: parallelWorkstreams,
    serialized_gates: serializedGates,
    join_points: joinPoints,
    overlap_rules: overlapRules,
    handoff_packets: handoffPackets,
    recommended_sequence: buildMultiAgentRecommendedSequence(
      singleAgentPlan,
      parallelWorkstreams,
      serializedGates,
      resolvedWorkflowContext || singleAgentPlan?.resolved_workflow_context || null
    )
  };
}

function handoffTemplateFromLane(lane, mode) {
  if (!lane) return null;
  return {
    packet_id: lane.publishes?.[0] || `handoff:${lane.lane_id}`,
    from_lane: lane.lane_id,
    to_lane: lane.role === "verification_runner" ? null : lane.role === "adoption_operator" ? "verification_runner" : "adoption_operator",
    status: "pending",
    scope: {
      bundle: lane.bundle || null,
      review_groups: lane.owned_targets?.review_groups || []
    },
    decision_summary: {
      completion_condition: lane.completion_condition || null
    },
    canonical_targets: lane.owned_targets?.canonical_targets || [],
    recommended_next_action: {
      action: lane.role === "adoption_operator"
        ? "run_from_plan_write"
        : lane.role === "verification_runner"
          ? "run_proof_targets"
          : "publish_review_state",
      selector: lane.role === "adoption_operator"
        ? "from-plan"
        : (lane.owned_targets?.review_groups || [])[0] || lane.bundle || null
    },
    blocking_reasons: lane.blocking_dependencies || [],
    proof_expectations: lane.proof_targets || null,
    mode
  };
}

function joinPointsForLane(multiAgentPlan, laneId) {
  return (multiAgentPlan?.join_points || []).filter((joinPoint) =>
    (joinPoint.requires || []).includes(laneId) ||
    (joinPoint.then_enables || []).includes(laneId)
  );
}

function serializedGatesForLane(multiAgentPlan, laneId) {
  return (multiAgentPlan?.serialized_gates || []).filter((gate) =>
    gate.owner_lane === laneId || (gate.blocks_until || []).includes(laneId)
  );
}

function overlapRulesForLane(multiAgentPlan, laneId) {
  return (multiAgentPlan?.overlap_rules || []).filter((rule) => (rule.lanes || []).includes(laneId));
}

function recommendedStepsForLane(multiAgentPlan, lane, publishedHandoffPacket) {
  const resolvedWorkflowContext = multiAgentPlan?.resolved_workflow_context || null;
  const steps = [
    {
      order: 1,
      action: "read_allowed_inputs",
      reason: "Start from the bounded artifacts assigned to this lane before making any recommendation."
    }
  ];

  if ((lane.blocking_dependencies || []).length > 0) {
    steps.push({
      order: steps.length + 1,
      action: "wait_for_dependencies",
      reason: `This lane is blocked until ${lane.blocking_dependencies.join(", ")} is satisfied.`,
      blocking_dependencies: lane.blocking_dependencies
    });
  }

  if (["bundle_reviewer", "auth_reviewer", "mapping_reviewer", "doc_promoter"].includes(lane.role)) {
    if ((resolvedWorkflowContext?.effective_review_policy?.escalate_categories || []).length > 0) {
      steps.push({
        order: steps.length + 1,
        action: "apply_resolved_review_policy",
        reason: `This lane should honor resolved review escalations for ${resolvedWorkflowContext.effective_review_policy.escalate_categories.join(", ")}.`
      });
    }
    steps.push({
      order: steps.length + 1,
      action: "review_scoped_work",
      reason: lane.completion_condition,
      selector: (lane.owned_targets?.review_groups || [])[0] || lane.bundle || null
    });
    steps.push({
      order: steps.length + 1,
      action: "publish_handoff_packet",
      reason: "Publish a structured handoff packet instead of coordinating through freeform messaging.",
      packet_id: publishedHandoffPacket?.packet_id || null
    });
    return steps;
  }

  if (lane.role === "adoption_operator") {
    steps.push({
      order: steps.length + 1,
      action: "collect_review_packets",
      reason: "Wait for review-oriented lanes to publish their handoff packets before canonical adoption."
    });
    steps.push({
      order: steps.length + 1,
      action: "run_from_plan_write",
      reason: "Canonical adoption stays serialized and single-writer.",
      selector: "from-plan"
    });
    steps.push({
      order: steps.length + 1,
      action: "publish_handoff_packet",
      reason: "Publish canonical adoption completion for the verification lane.",
      packet_id: publishedHandoffPacket?.packet_id || null
    });
    return steps;
  }

  if (lane.role === "verification_runner") {
    steps.push({
      order: steps.length + 1,
      action: "apply_resolved_verification_policy",
      reason: "Use the embedded resolved workflow context before running lane proof targets.",
      verification_requirements: resolvedWorkflowContext?.effective_verification_policy || null
    });
    steps.push({
      order: steps.length + 1,
      action: "run_proof_targets",
      reason: "Run the attached proof set only after canonical adoption completes.",
      proof_targets: lane.proof_targets || null
    });
    steps.push({
      order: steps.length + 1,
      action: "publish_handoff_packet",
      reason: "Publish verification completion for auditability.",
      packet_id: publishedHandoffPacket?.packet_id || null
    });
  }

  return steps;
}

export function buildWorkPacketPayload({
  workspace,
  multiAgentPlan,
  laneId
}) {
  const lane = (multiAgentPlan?.lanes || []).find((entry) => entry.lane_id === laneId);
  if (!lane) {
    throw new Error(`Unknown multi-agent lane '${laneId}'.`);
  }
  const publishedHandoffPacket = (multiAgentPlan?.handoff_packets || []).find((packet) => packet.from_lane === laneId)
    || handoffTemplateFromLane(lane, multiAgentPlan?.mode || null);
  const resolvedWorkflowContext = multiAgentPlan?.resolved_workflow_context || null;
  const presetGuidanceSummary = multiAgentPlan?.preset_guidance_summary || buildPresetGuidanceSummary(null, resolvedWorkflowContext);
  const effectiveWriteScope = lane.workflow_context_overrides?.effective_write_scope || lane.write_scope || resolvedWorkflowContext?.effective_write_scope || null;
  const effectiveVerificationPolicy = lane.workflow_context_overrides?.effective_verification_policy || {
    ...(resolvedWorkflowContext?.effective_verification_policy || {}),
    lane_proof_targets: lane.proof_targets || null
  };
  return {
    type: "work_packet",
    workspace: workspace || null,
    mode: multiAgentPlan?.mode || null,
    lane: {
      lane_id: lane.lane_id,
      role: lane.role,
      bundle: lane.bundle || null
    },
    summary: {
      purpose: lane.purpose,
      canonical_writer: lane.role === "adoption_operator",
      review_lane: ["bundle_reviewer", "auth_reviewer", "mapping_reviewer", "doc_promoter"].includes(lane.role),
      completion_condition: lane.completion_condition || null
    },
    allowed_inputs: lane.allowed_inputs || [],
    preset_guidance_summary: presetGuidanceSummary,
    active_preset_ids: presetGuidanceSummary.active_preset_ids,
    recommended_preset_action: presetGuidanceSummary.recommended_preset_action,
    write_scope: lane.write_scope || null,
    effective_write_scope: effectiveWriteScope,
    owned_targets: lane.owned_targets || null,
    blocking_dependencies: lane.blocking_dependencies || [],
    proof_targets: lane.proof_targets || null,
    effective_verification_policy: effectiveVerificationPolicy,
    required_handoff_packets: (multiAgentPlan?.handoff_packets || []).filter((packet) => packet.to_lane === laneId),
    published_handoff_packet: publishedHandoffPacket,
    overlap_rules: overlapRulesForLane(multiAgentPlan, laneId),
    serialized_gates: serializedGatesForLane(multiAgentPlan, laneId),
    join_points: joinPointsForLane(multiAgentPlan, laneId),
    recommended_steps: recommendedStepsForLane(multiAgentPlan, lane, publishedHandoffPacket),
    resolved_workflow_context: resolvedWorkflowContext
  };
}

function authReviewPacketForBundle(report, adoptionStatus, bundleSlug) {
  try {
    return buildAuthReviewPacketPayload(report, adoptionStatus, bundleSlug);
  } catch {
    return null;
  }
}

function bundlePriorityForBundle(adoptionStatus, bundleSlug) {
  return (adoptionStatus?.bundle_priorities || []).find((entry) => entry.bundle === bundleSlug) || null;
}

function laneStatusRecord(lane, { multiAgentPlan, report, adoptionStatus }) {
  if (lane.role === "bundle_reviewer") {
    const bundlePriority = bundlePriorityForBundle(adoptionStatus, lane.bundle);
    const complete = !bundlePriority || (
      (bundlePriority.next_review_groups || []).length === 0 &&
      !bundlePriority.recommend_bundle_review_selector
    );
    return {
      lane_id: lane.lane_id,
      role: lane.role,
      bundle: lane.bundle || null,
      status: complete ? "complete" : "ready",
      ready_for_handoff: complete,
      blocking_dependencies: [],
      reason: complete
        ? "Bundle review requirements for this bundle appear resolved in the current adoption state."
        : "This bundle still has review-oriented work before canonical adoption."
    };
  }

  if (lane.role === "auth_reviewer") {
    const packet = authReviewPacketForBundle(report, adoptionStatus, lane.bundle);
    const unresolvedCount = (packet?.unresolved_hints || []).length;
    const deferredCount = (packet?.deferred_hints || []).length;
    const roleFollowupCount = (packet?.auth_role_followup || []).length;
    const complete = unresolvedCount === 0 && deferredCount === 0 && roleFollowupCount === 0;
    return {
      lane_id: lane.lane_id,
      role: lane.role,
      bundle: lane.bundle || null,
      status: complete ? "complete" : "ready",
      ready_for_handoff: complete,
      blocking_dependencies: [],
      reason: complete
        ? "Auth hints and auth-relevant role follow-up are resolved for this bundle."
        : `This bundle still has ${unresolvedCount + deferredCount + roleFollowupCount} auth-sensitive follow-up item(s).`
    };
  }

  if (lane.role === "mapping_reviewer") {
    const pending = (lane.owned_targets?.canonical_targets || []).length;
    return {
      lane_id: lane.lane_id,
      role: lane.role,
      bundle: null,
      status: pending > 0 ? "ready" : "complete",
      ready_for_handoff: pending === 0,
      blocking_dependencies: [],
      reason: pending > 0
        ? "Mapping/customization-sensitive proposal surfaces still need explicit review."
        : "No mapping-sensitive proposal surfaces remain."
    };
  }

  if (lane.role === "doc_promoter") {
    const pending = (lane.owned_targets?.canonical_targets || []).length;
    return {
      lane_id: lane.lane_id,
      role: lane.role,
      bundle: null,
      status: pending > 0 ? "ready" : "complete",
      ready_for_handoff: pending === 0,
      blocking_dependencies: [],
      reason: pending > 0
        ? "Documentation-oriented proposal surfaces still need review before promotion."
        : "No documentation promotion work remains."
    };
  }

  const prereqReviewLanes = (multiAgentPlan?.lanes || [])
    .filter((entry) => !["adoption_operator", "verification_runner"].includes(entry.role));
  const reviewStatuses = prereqReviewLanes.map((entry) => laneStatusRecord(entry, { multiAgentPlan, report, adoptionStatus }));
  const incompleteReviewLanes = reviewStatuses.filter((entry) => entry.status !== "complete");

  if (lane.role === "adoption_operator") {
    const complete = !adoptionStatus?.next_bundle;
    if (complete) {
      return {
        lane_id: lane.lane_id,
        role: lane.role,
        bundle: null,
        status: "complete",
        ready_for_handoff: true,
        blocking_dependencies: [],
        reason: "Canonical adoption appears complete in the current adoption state."
      };
    }
    return {
      lane_id: lane.lane_id,
      role: lane.role,
      bundle: null,
      status: incompleteReviewLanes.length === 0 ? "ready" : "blocked",
      ready_for_handoff: false,
      blocking_dependencies: incompleteReviewLanes.map((entry) => entry.lane_id),
      reason: incompleteReviewLanes.length === 0
        ? "All review-oriented lanes are resolved, so canonical adoption can proceed."
        : "Canonical adoption remains blocked until review-oriented lanes publish resolved handoff state."
    };
  }

  if (lane.role === "verification_runner") {
    const adoptionLaneStatus = laneStatusRecord(
      (multiAgentPlan?.lanes || []).find((entry) => entry.role === "adoption_operator"),
      { multiAgentPlan, report, adoptionStatus }
    );
    return {
      lane_id: lane.lane_id,
      role: lane.role,
      bundle: null,
      status: adoptionLaneStatus.status === "complete" ? "ready" : "blocked",
      ready_for_handoff: false,
      blocking_dependencies: adoptionLaneStatus.status === "complete" ? [] : ["adoption_operator"],
      reason: adoptionLaneStatus.status === "complete"
        ? "Merged canonical state is ready for proof."
        : "Verification remains blocked until canonical adoption completes."
    };
  }

  return {
    lane_id: lane.lane_id,
    role: lane.role,
    bundle: lane.bundle || null,
    status: "ready",
    ready_for_handoff: false,
    blocking_dependencies: lane.blocking_dependencies || [],
    reason: lane.completion_condition || null
  };
}

export function buildLaneStatusPayload({
  workspace,
  multiAgentPlan,
  report,
  adoptionStatus
}) {
  const lanes = (multiAgentPlan?.lanes || []).map((lane) => laneStatusRecord(lane, {
    multiAgentPlan,
    report,
    adoptionStatus
  }));
  const statusCounts = lanes.reduce((acc, lane) => {
    acc[lane.status] = (acc[lane.status] || 0) + 1;
    return acc;
  }, {});
  const blocked = lanes.filter((lane) => lane.status === "blocked").map((lane) => lane.lane_id);
  const ready = lanes.filter((lane) => lane.status === "ready").map((lane) => lane.lane_id);
  const complete = lanes.filter((lane) => lane.status === "complete").map((lane) => lane.lane_id);
  return {
    type: "lane_status_query",
    workspace: workspace || null,
    mode: multiAgentPlan?.mode || null,
    summary: {
      lane_count: lanes.length,
      status_counts: statusCounts,
      blocked_lanes: blocked,
      ready_lanes: ready,
      complete_lanes: complete
    },
    lanes
  };
}

export function buildHandoffStatusPayload({
  workspace,
  multiAgentPlan,
  report,
  adoptionStatus
}) {
  const laneStatus = buildLaneStatusPayload({
    workspace,
    multiAgentPlan,
    report,
    adoptionStatus
  });
  const statusByLane = new Map(laneStatus.lanes.map((entry) => [entry.lane_id, entry]));
  const handoffs = (multiAgentPlan?.handoff_packets || []).map((packet) => {
    const lane = statusByLane.get(packet.from_lane);
    const status = lane?.status === "complete"
      ? "published"
      : lane?.status === "blocked"
        ? "blocked"
        : "pending";
    return {
      packet_id: packet.packet_id,
      from_lane: packet.from_lane,
      to_lane: packet.to_lane,
      status,
      blocking_dependencies: lane?.blocking_dependencies || [],
      scope: packet.scope || null,
      canonical_targets: packet.canonical_targets || [],
      reason: status === "published"
        ? "The source lane appears resolved in the current artifact-backed status view."
        : status === "blocked"
          ? "The source lane is still blocked, so this handoff cannot be published yet."
          : "The source lane still has review or execution work before publishing this handoff."
    };
  });
  const statusCounts = handoffs.reduce((acc, handoff) => {
    acc[handoff.status] = (acc[handoff.status] || 0) + 1;
    return acc;
  }, {});
  return {
    type: "handoff_status_query",
    workspace: workspace || null,
    mode: multiAgentPlan?.mode || null,
    summary: {
      handoff_count: handoffs.length,
      status_counts: statusCounts,
      published_packets: handoffs.filter((entry) => entry.status === "published").map((entry) => entry.packet_id),
      pending_packets: handoffs.filter((entry) => entry.status === "pending").map((entry) => entry.packet_id),
      blocked_packets: handoffs.filter((entry) => entry.status === "blocked").map((entry) => entry.packet_id)
    },
    handoffs
  };
}

function formatAuthClaimValueInline(value) {
  return value == null ? "_dynamic_" : `${value}`;
}

function normalizeReviewGroupSelector(id) {
  const normalized = String(id || "");
  if (normalized.startsWith("projection_review:")) {
    return `projection-review:${normalized.slice("projection_review:".length)}`;
  }
  if (normalized.startsWith("ui_review:")) {
    return `ui-review:${normalized.slice("ui_review:".length)}`;
  }
  if (normalized.startsWith("workflow_review:")) {
    return `workflow-review:${normalized.slice("workflow_review:".length)}`;
  }
  return null;
}

function buildHintLabel(hintType, hint) {
  if (hintType === "permission") {
    return `permission ${hint.permission}`;
  }
  if (hintType === "claim") {
    return `claim ${hint.claim} = ${formatAuthClaimValueInline(hint.claim_value)}`;
  }
  return `ownership ${hint.ownership} ownership_field ${hint.ownership_field}`;
}

function flattenHints(candidateModelBundles = []) {
  const hintGroups = [
    {
      collection: "auth_permission_hints",
      hintType: "permission",
      action: "apply_projection_permission_patch"
    },
    {
      collection: "auth_claim_hints",
      hintType: "claim",
      action: "apply_projection_auth_patch"
    },
    {
      collection: "auth_ownership_hints",
      hintType: "ownership",
      action: "apply_projection_ownership_patch"
    }
  ];
  return candidateModelBundles.flatMap((bundle) =>
    hintGroups.flatMap(({ collection, hintType, action }) =>
      (bundle[collection] || []).map((hint) => ({
        bundle: bundle.slug,
        hint_type: hintType,
        hint_label: buildHintLabel(hintType, hint),
        confidence: hint.confidence || null,
        related_capabilities: hint.related_capabilities || [],
        closure_state: hint.closure_state || "unresolved",
        closure_reason: hint.closure_reason || null,
        why_inferred: hint.why_inferred || hint.explanation || null,
        review_guidance: hint.review_guidance || null,
        projection_patch_action: action
      }))
    )
  );
}

function flattenAuthRoleFollowup(candidateModelBundles = []) {
  return candidateModelBundles.flatMap((bundle) =>
    (bundle.auth_role_guidance || []).map((entry) => ({
      bundle: bundle.slug,
      role_id: entry.role_id,
      confidence: entry.confidence || null,
      followup_action: entry.followup_action || null,
      followup_label: entry.followup_label || null,
      followup_reason: entry.followup_reason || null,
      review_guidance: entry.review_guidance || null,
      related_capabilities: entry.related_capabilities || [],
      related_docs: entry.related_docs || []
    }))
  );
}

function buildHighRiskBundles(bundlePriorities = []) {
  return (bundlePriorities || [])
    .filter((bundle) => bundle.auth_closure_summary?.status === "high_risk")
    .map((bundle) => ({
      bundle: bundle.bundle,
      auth_closure: bundle.auth_closure_summary || null,
      auth_aging: bundle.auth_aging_summary || null,
      next_review_group: bundle.next_review_groups?.[0]
        ? {
            id: bundle.next_review_groups[0].id,
            type: bundle.next_review_groups[0].type || null,
            reason: bundle.next_review_groups[0].reason || null,
            selector: normalizeReviewGroupSelector(bundle.next_review_groups[0].id)
          }
        : null,
      bundle_review_selector: bundle.recommend_bundle_review_selector || null,
      from_plan_ready: Boolean(bundle.recommend_from_plan)
    }));
}

function buildBundleReviewSummary(bundle) {
  if (!bundle) {
    return null;
  }
  return {
      bundle: bundle.bundle,
      auth_closure: bundle.auth_closure_summary || null,
      auth_aging: bundle.auth_aging_summary || null,
      next_review_group: bundle.next_review_groups?.[0]
        ? {
            id: bundle.next_review_groups[0].id,
            type: bundle.next_review_groups[0].type || null,
            reason: bundle.next_review_groups[0].reason || null,
            selector: normalizeReviewGroupSelector(bundle.next_review_groups[0].id)
          }
        : null,
      bundle_review_selector: bundle.recommend_bundle_review_selector || null,
      from_plan_ready: Boolean(bundle.recommend_from_plan)
    };
}

function buildRecommendedSteps({ highRiskBundles, authRoleFollowup, nextBundle }) {
  const priorityBundles = [];
  if (nextBundle?.bundle) {
    priorityBundles.push(nextBundle.bundle);
  }
  for (const bundle of highRiskBundles || []) {
    if (!priorityBundles.includes(bundle.bundle)) {
      priorityBundles.push(bundle.bundle);
    }
  }

  const highRiskMap = new Map((highRiskBundles || []).map((bundle) => [bundle.bundle, bundle]));
  const roleMap = new Map();
  for (const entry of authRoleFollowup || []) {
    if (!roleMap.has(entry.bundle)) {
      roleMap.set(entry.bundle, []);
    }
    roleMap.get(entry.bundle).push(entry);
  }

  const steps = [];
  for (const bundleId of priorityBundles) {
    const bundle = highRiskMap.get(bundleId);
    if (!bundle) {
      continue;
    }
    const nextReviewSelector = bundle.next_review_group?.selector || null;
    if (nextReviewSelector?.startsWith("projection-review:")) {
      steps.push({
        bundle: bundle.bundle,
        action: "review_projection_group",
        selector: nextReviewSelector,
        reason: bundle.next_review_group.reason || "Projection review is still required before auth hints can be adopted safely."
      });
    } else if (bundle.bundle_review_selector) {
      steps.push({
        bundle: bundle.bundle,
        action: "review_bundle",
        selector: bundle.bundle_review_selector,
        reason: bundle.next_review_group?.reason || "Bundle review is the safest next step before promoting auth-sensitive changes."
      });
    }

    for (const entry of roleMap.get(bundle.bundle) || []) {
      if (entry.followup_action === "promote_role") {
        steps.push({
          bundle: bundle.bundle,
          action: "promote_role_first",
          selector: null,
          reason: entry.followup_reason || `Promote role ${entry.role_id} before promoting related auth-sensitive changes.`
        });
      } else if (entry.followup_action === "link_role_to_docs") {
        steps.push({
          bundle: bundle.bundle,
          action: "patch_docs_first",
          selector: null,
          reason: entry.followup_reason || `Patch docs for role ${entry.role_id} before promoting related auth-sensitive changes.`
        });
      }
    }

    if (bundle.from_plan_ready) {
      steps.push({
        bundle: bundle.bundle,
        action: "run_from_plan_write",
        selector: "from-plan",
        reason: "Reviewed auth-sensitive items are ready to promote through from-plan adoption."
      });
    }
  }
  return steps;
}

export function buildAuthHintsQueryPayload(report, adoptionStatus) {
  const candidateModelBundles = report?.candidate_model_bundles || [];
  const bundlePriorities = adoptionStatus?.bundle_priorities || report?.bundle_priorities || [];
  const allHints = flattenHints(candidateModelBundles);
  const authRoleFollowup = flattenAuthRoleFollowup(candidateModelBundles);
  const highRiskBundles = buildHighRiskBundles(bundlePriorities);
  const staleHighRiskBundles = highRiskBundles.filter((bundle) => bundle.auth_aging?.escalationLevel === "stale_high_risk");
  const bundlesWithHints = candidateModelBundles.filter((bundle) =>
    (bundle.auth_permission_hints || []).length > 0 ||
    (bundle.auth_claim_hints || []).length > 0 ||
    (bundle.auth_ownership_hints || []).length > 0
  );

  const hintClosureCounts = allHints.reduce(
    (acc, hint) => {
      if (hint.closure_state === "adopted") {
        acc.adopted += 1;
      } else if (hint.closure_state === "deferred") {
        acc.deferred += 1;
      } else {
        acc.unresolved += 1;
      }
      return acc;
    },
    { adopted: 0, deferred: 0, unresolved: 0 }
  );

  const bundleClosureCounts = candidateModelBundles.reduce(
    (acc, bundle) => {
      const status = bundle.operator_summary?.authClosureSummary?.status || "no_auth_hints";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { no_auth_hints: 0, mostly_closed: 0, partially_closed: 0, high_risk: 0 }
  );

  return {
    type: "auth_hints_query",
    workspace: report?.workspace || adoptionStatus?.workspace || null,
    summary: {
      total_bundles_with_auth_hints: bundlesWithHints.length,
      hint_closure_counts: hintClosureCounts,
      bundle_auth_closure_counts: bundleClosureCounts,
      stale_high_risk_bundle_count: staleHighRiskBundles.length
    },
    high_risk_bundles: highRiskBundles,
    stale_high_risk_bundles: staleHighRiskBundles,
    unresolved_hints: allHints.filter((hint) => hint.closure_state === "unresolved"),
    deferred_hints: allHints.filter((hint) => hint.closure_state === "deferred"),
    adopted_hints: allHints.filter((hint) => hint.closure_state === "adopted"),
    auth_role_followup: authRoleFollowup,
    recommended_steps: buildRecommendedSteps({
      highRiskBundles,
      authRoleFollowup,
      nextBundle: adoptionStatus?.next_bundle || null
    })
  };
}

function buildProjectionPatchActionsForBundle(hints = []) {
  const actions = new Map();
  for (const hint of hints) {
    const actionId = hint.projection_patch_action;
    if (!actionId) {
      continue;
    }
    if (!actions.has(actionId)) {
      actions.set(actionId, {
        action: actionId,
        hint_types: [],
        hint_labels: []
      });
    }
    const entry = actions.get(actionId);
    if (hint.hint_type && !entry.hint_types.includes(hint.hint_type)) {
      entry.hint_types.push(hint.hint_type);
    }
    if (hint.hint_label && !entry.hint_labels.includes(hint.hint_label)) {
      entry.hint_labels.push(hint.hint_label);
    }
  }
  return [...actions.values()];
}

function buildBundleRecommendedSteps({ bundle, authRoleFollowup = [] }) {
  if (!bundle) {
    return [];
  }

  const steps = [];
  const nextReviewSelector = bundle.next_review_group?.selector || null;
  if (nextReviewSelector?.startsWith("projection-review:")) {
    steps.push({
      bundle: bundle.bundle,
      action: "review_projection_group",
      selector: nextReviewSelector,
      reason: bundle.next_review_group.reason || "Projection review is still required before auth hints can be adopted safely."
    });
  } else if (bundle.bundle_review_selector) {
    steps.push({
      bundle: bundle.bundle,
      action: "review_bundle",
      selector: bundle.bundle_review_selector,
      reason: bundle.next_review_group?.reason || "Bundle review is the safest next step before promoting auth-sensitive changes."
    });
  }

  for (const entry of authRoleFollowup || []) {
    if (entry.followup_action === "promote_role") {
      steps.push({
        bundle: bundle.bundle,
        action: "promote_role_first",
        selector: null,
        reason: entry.followup_reason || `Promote role ${entry.role_id} before promoting related auth-sensitive changes.`
      });
    } else if (entry.followup_action === "link_role_to_docs") {
      steps.push({
        bundle: bundle.bundle,
        action: "patch_docs_first",
        selector: null,
        reason: entry.followup_reason || `Patch docs for role ${entry.role_id} before promoting related auth-sensitive changes.`
      });
    }
  }

  if (bundle.from_plan_ready) {
    steps.push({
      bundle: bundle.bundle,
      action: "run_from_plan_write",
      selector: "from-plan",
      reason: "Reviewed auth-sensitive items are ready to promote through from-plan adoption."
    });
  }

  return steps;
}

export function buildAuthReviewPacketPayload(report, adoptionStatus, bundleSlug) {
  const candidateModelBundles = report?.candidate_model_bundles || [];
  const bundlePriorities = adoptionStatus?.bundle_priorities || report?.bundle_priorities || [];
  const targetBundle = candidateModelBundles.find((bundle) => bundle.slug === bundleSlug) || null;
  if (!targetBundle) {
    return null;
  }

  const bundlePriority = bundlePriorities.find((bundle) => bundle.bundle === bundleSlug) || null;
  const allBundleHints = flattenHints([targetBundle]);
  const unresolvedHints = allBundleHints.filter((hint) => hint.closure_state === "unresolved");
  const deferredHints = allBundleHints.filter((hint) => hint.closure_state === "deferred");
  const adoptedHints = allBundleHints.filter((hint) => hint.closure_state === "adopted");
  const authRoleFollowup = flattenAuthRoleFollowup([targetBundle]);
  const projectionPatchActions = buildProjectionPatchActionsForBundle([...unresolvedHints, ...deferredHints, ...adoptedHints]);
  const highRiskBundle = buildBundleReviewSummary(bundlePriority) || {
    bundle: bundleSlug,
    auth_closure: targetBundle.operator_summary?.authClosureSummary || null,
    auth_aging: targetBundle.operator_summary?.authAging || null,
    next_review_group: null,
    bundle_review_selector: null,
    from_plan_ready: false
  };

  return {
    type: "auth_review_packet_query",
    workspace: report?.workspace || adoptionStatus?.workspace || null,
    bundle: bundleSlug,
    auth_closure: highRiskBundle.auth_closure,
    auth_aging: highRiskBundle.auth_aging,
    next_review_selector: highRiskBundle.next_review_group?.selector || null,
    bundle_review_selector: highRiskBundle.bundle_review_selector || null,
    from_plan_ready: Boolean(highRiskBundle.from_plan_ready),
    unresolved_hints: unresolvedHints,
    deferred_hints: deferredHints,
    adopted_hints: adoptedHints,
    auth_role_followup: authRoleFollowup,
    projection_patch_actions: projectionPatchActions,
    recommended_steps: buildBundleRecommendedSteps({
      bundle: highRiskBundle,
      authRoleFollowup
    })
  };
}

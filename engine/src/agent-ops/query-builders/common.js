export function canonicalWriteCandidatesFromWriteScope(writeScope) {
  return (writeScope?.safe_to_edit || []).filter((entry) => entry === "topo/**" || String(entry).startsWith("topo/"));
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
    widget_migration_count: (diffArtifact.widget_contract_migration_plan?.widgets || []).length,
    widget_migration_projection_count: (diffArtifact.widget_contract_migration_plan?.affected_projection_ids || []).length,
    affected_output_count: maintainedOutputs.length,
    affected_seam_count: maintainedSeams.length,
    highest_maintained_severity: highestMaintainedSeverity
  };
}

export function severityRank(status) {
  if (status === "no_go") return 3;
  if (status === "manual_decision") return 2;
  if (status === "review_required") return 1;
  return 0;
}

export function stableSortedStrings(values) {
  return [...new Set((values || []).filter(Boolean))].sort();
}

export const CANONICAL_TASK_MODES = new Set([
  "modeling",
  "maintained-app-edit",
  "extract-adopt",
  "diff-review",
  "verification"
]);

export const WORKFLOW_REVIEW_BLOCKERS = new Set([
  "review_required",
  "manual_decision",
  "no_go"
]);

export const PROVIDER_PRESET_MANUAL_DECISION_CATEGORIES = new Set([
  "auth",
  "deployment_assumptions",
  "runtime_assumptions",
  "deploy_runtime_assumptions",
  "environment_expectations",
  "maintained_boundary",
  "ownership_visibility"
]);

export const WORKFLOW_QUERY_FAMILIES_BY_MODE = {
  modeling: ["change-plan", "write-scope", "verification-targets", "risk-summary"],
  "maintained-app-edit": ["maintained-boundary", "maintained-conformance", "seam-check", "change-plan"],
  "extract-adopt": ["extract-plan", "risk-summary", "proceed-decision", "review-packet"],
  "diff-review": ["change-plan", "risk-summary", "review-packet"],
  verification: ["verification-targets", "proceed-decision", "risk-summary"]
};

export function stableOrderedUnion(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

export function targetWidgetId(target = {}) {
  return target.widget_id || target.component_id || null;
}

export function componentBehaviorArtifactPath(target = {}) {
  if (target.target !== "widget-behavior-report") {
    return null;
  }
  const suffix = [target.projection_id, targetWidgetId(target)].filter(Boolean).join(".");
  return suffix ? `${suffix}.widget-behavior-report.json` : "widget-behavior-report.json";
}

export function componentBehaviorQueryCommand(target = {}) {
  if (target.target !== "widget-behavior-report") {
    return null;
  }
  const parts = ["topogram", "query", "widget-behavior", "./topo"];
  if (target.projection_id) {
    parts.push("--projection", target.projection_id);
  }
  const widgetId = targetWidgetId(target);
  if (widgetId) {
    parts.push("--widget", widgetId);
  }
  parts.push("--json");
  return parts.join(" ");
}

export function recommendedArtifactQueriesFromGeneratorTargets(generatorTargets = []) {
  const queries = [];
  const seen = new Set();
  for (const target of generatorTargets || []) {
    const command = componentBehaviorQueryCommand(target);
    if (!command || seen.has(command)) continue;
    seen.add(command);
    queries.push({
      query: "widget-behavior",
      target: target.target,
      projection_id: target.projection_id || null,
      widget_id: targetWidgetId(target),
      command
    });
  }
  return queries;
}

export function artifactLoadOrderFromGeneratorTargets(generatorTargets = []) {
  return stableOrderedUnion((generatorTargets || [])
    .map((target) => componentBehaviorArtifactPath(target))
    .filter(Boolean));
}

export function flattenVerificationTargets(verificationTargets = null) {
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

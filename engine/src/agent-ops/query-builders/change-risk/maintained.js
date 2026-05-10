import {
  severityRank,
  stableSortedStrings,
  summarizeDiffArtifact
} from "../common.js";
import {
  buildMaintainedOutputGroups,
  normalizeProofStorySummary,
  normalizeSeamSummary
} from "../maintained-shared.js";
import {
  buildSeamProbeReport,
  compactMaintainedSeamSummary,
  conformanceStateFromSeamCheck,
  verificationTargetsForOutput
} from "../maintained-risk.js";

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

export function conformanceSeverityRank(state) {
  if (state === "no_go") return 4;
  if (state === "drift_suspected") return 3;
  if (state === "review_required") return 2;
  if (state === "unverifiable") return 1;
  return 0;
}

export function seamConformanceState(seam, { diffBacked }) {
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

import fs from "node:fs";
import path from "node:path";

import {
  severityRank,
  stableSortedStrings
} from "./common.js";
import {
  buildMaintainedOutputGroups,
  normalizeSeamSummary
} from "./maintained-shared.js";
export function buildMaintainedImpacts({ diffArtifact, maintainedBoundaryArtifact, sliceArtifact, verificationTargets = null }) {
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

export function verificationTargetsForOutput(outputId, maintainedBoundaryArtifact, fallbackVerificationTargets = null) {
  const output = (maintainedBoundaryArtifact?.outputs || []).find((entry) => entry.output_id === outputId);
  return output?.verification_targets || fallbackVerificationTargets || null;
}

export const DEPENDENCY_TOKEN_STOPWORDS = new Set([
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

export function existingGraphRoot(graph) {
  const root = graph?.root || null;
  return root && fs.existsSync(root) ? root : null;
}

export function readableFilePath(root, relativePath) {
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

export function loadMaintainedModuleContents(root, maintainedModules = []) {
  return maintainedModules
    .map((relativePath) => readableFilePath(root, relativePath))
    .filter(Boolean)
    .map((absolutePath) => ({
      absolutePath,
      contents: fs.readFileSync(absolutePath, "utf8").toLowerCase()
    }));
}

export function dependencyTokens(emittedDependencies = []) {
  return stableSortedStrings(
    emittedDependencies.flatMap((id) =>
      String(id || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2 && !DEPENDENCY_TOKEN_STOPWORDS.has(token))
    )
  );
}

export function verificationCoverageForSeamKind(seamKind, verificationTargets) {
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

export function buildSeamProbeReport(graph, seam, { verificationTargets = null, diffBacked = false, outputRecord = null } = {}) {
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

export function conformanceStateFromSeamCheck(seam, seamCheck) {
  if (seamCheck?.check_status === "no_go") return "no_go";
  if (seamCheck?.check_status === "stale") return "drift_suspected";
  if (seamCheck?.check_status === "unverifiable") return "unverifiable";
  if ((seam?.status || null) === "manual_decision" || (seam?.status || null) === "review_required" || seamCheck?.check_status === "guarded") {
    return "review_required";
  }
  return "aligned";
}

export function importProposalDependencyIds(proposalSurface = {}) {
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

export function buildImportProposalMaintainedImpacts(proposalSurface, maintainedBoundaryArtifact) {
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

export function summarizeImportMaintainedSeamCandidates(proposalSurface = {}, matchedSeams = []) {
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

export function buildImportMaintainedRisk(proposalSurfaces = [], maintainedBoundaryArtifact = null) {
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

export function compactMaintainedSeamSummary(seam) {
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

export function compactMaintainedOutputSummary(output) {
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

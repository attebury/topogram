import {
  severityRank,
  stableSortedStrings
} from "./common.js";
export function normalizeProofStorySummary(story) {
  return {
    classification: story?.classification || null,
    relativePath: story?.relativePath || null,
    maintained_files: story?.maintained_files || story?.maintainedFiles || [],
    seam_family_id: story?.seam_family_id || story?.seamFamilyId || null,
    seam_family_label: story?.seam_family_label || story?.seamFamilyLabel || null,
    review_boundary: story?.review_boundary || null
  };
}

export function normalizeSeamSummary(seam, proofStoryMapper = normalizeProofStorySummary) {
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

export function maintainedOutputRecordFromFiles(files = []) {
  const normalizedFiles = stableSortedStrings(files);
  if (normalizedFiles.some((entry) => String(entry).startsWith("examples/maintained/proof-app/"))) {
    return {
      output_id: "maintained_app",
      label: "Maintained App",
      kind: "maintained_runtime",
      root_paths: ["examples/maintained/proof-app/**"]
    };
  }

  return {
    output_id: "maintained_app",
    label: "Maintained App",
    kind: "maintained_runtime",
    root_paths: []
  };
}

export function normalizeMaintainedOutput(output, seamMap, {
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

export function buildMaintainedOutputGroups(outputs = [], seams = [], {
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

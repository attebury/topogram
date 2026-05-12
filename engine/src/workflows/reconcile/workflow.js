// @ts-check
import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../../format.js";
import { generateContextBundle } from "../../generator/context/bundle.js";
import { buildLocalMaintainedBoundaryArtifact } from "../../generator/context/shared.js";
import { relativeTo } from "../../path-helpers.js";
import { ensureTrailingNewline } from "../../text-helpers.js";
import {
  adoptionItemKey,
  applyAdoptionSelector,
  buildAgentAdoptionPlan,
  mergeAdoptionPlanState,
  parseAdoptSelector,
  summarizeAdoptionPlanItems
} from "../../adoption/plan.js";
import {
  attachBundleOperatorHints,
  annotateBundlePriorities,
  buildAdoptionStatusFiles as buildAdoptionStatusFilesReport,
  buildAdoptionStatusSummary as buildAdoptionStatusSummaryReport,
  buildPromotedCanonicalItems as buildPromotedCanonicalItemsReport,
  renderBundlePriorityActionsMarkdown,
  renderNextBestActionMarkdown,
  renderPreviewFollowupMarkdown,
  renderPreviewRiskMarkdown,
  renderPromotedCanonicalItemsMarkdown
} from "../../adoption/reporting.js";
import {
  buildBundleAdoptionPriorities,
  buildBundleBlockerSummaries,
  buildProjectionReviewGroups,
  buildUiReviewGroups,
  buildWorkflowReviewGroups,
  selectNextBundle
} from "../../adoption/review-groups.js";
import { confidenceRank, tryLoadResolvedGraph } from "../docs.js";
import { listFilesRecursive, normalizeWorkspacePaths, readJsonIfExists } from "../shared.js";
import {
  annotateBundleAuthHintClosures,
  buildAuthClaimReviewGuidance,
  buildAuthOwnershipReviewGuidance,
  buildAuthPermissionReviewGuidance,
  formatAuthClaimHintInline,
  formatAuthOwnershipHintInline,
  formatAuthPermissionHintInline,
  formatAuthRoleGuidanceInline
} from "./auth.js";
import { buildAdoptionPlan, buildCanonicalAdoptionOutputs, buildPromotedCanonicalItems, readAdoptionPlan } from "./adoption-plan.js";
import { buildCandidateModelFiles } from "./candidate-model.js";
import { loadImportArtifacts } from "./gap-report.js";
import { annotateBundleAuthAging, renderCandidateBundleReadme, renderMaintainedSeamCandidatesInline } from "./bundle-core.js";
import { buildBundleOperatorSummary, summarizeBundleSurface } from "./summary.js";
import { formatDocDriftSummaryInline, formatDocLinkSuggestionInline, formatDocMetadataPatchInline } from "./adoption-plan.js";

/** @param {string} inputPath @param {WorkflowOptions} options @returns {any} */
export function reconcileWorkflow(inputPath, options = {}) {
  const paths = normalizeWorkspacePaths(inputPath);
  const graph = tryLoadResolvedGraph(paths.topogramRoot);
  const candidatesRoot = path.join(paths.topogramRoot, "candidates", "docs");
  const appImport = loadImportArtifacts(paths, inputPath);
  const adoptSelector = parseAdoptSelector(options.adopt);
  /** @type {WorkflowFiles} */
  /** @type {WorkflowFiles} */
  const files = {};
  /** @type {any[]} */
  const promoted = [];
  /** @type {any[]} */
  const skipped = [];

  for (const filePath of listFilesRecursive(candidatesRoot, (/** @type {any} */ child) => child.endsWith(".md"))) {
    const relativeCandidate = relativeTo(candidatesRoot, filePath);
    const destination = path.join("docs", relativeCandidate);
    const canonicalPath = path.join(paths.topogramRoot, destination);
    if (fs.existsSync(canonicalPath)) {
      skipped.push(destination.replaceAll(path.sep, "/"));
      continue;
    }
    files[destination.replaceAll(path.sep, "/")] = fs.readFileSync(filePath, "utf8");
    promoted.push(destination.replaceAll(path.sep, "/"));
  }

  const candidateModel = buildCandidateModelFiles(graph, appImport, paths.topogramRoot);
  const defaultPlanItems = buildAdoptionPlan(candidateModel.bundles);
  const existingPlan = readAdoptionPlan(paths);
  const previousReconcileReport = readJsonIfExists(path.join(paths.topogramRoot, "candidates", "reconcile", "report.json"));
  const mergedPlanItems = mergeAdoptionPlanState(defaultPlanItems, existingPlan, paths.topogramRoot);
  /** @type {WorkflowRecord} */
  const adoptionPlan = {
    type: "reconcile_adoption_plan",
    workspace: paths.topogramRoot,
    approved_review_groups: [...new Set(existingPlan?.approved_review_groups || [])],
    imported_maintained_db_seams: appImport.candidates?.db?.maintained_seams || [],
    items: mergedPlanItems,
    projection_review_groups: buildProjectionReviewGroups(mergedPlanItems),
    ui_review_groups: buildUiReviewGroups(mergedPlanItems),
    workflow_review_groups: buildWorkflowReviewGroups(mergedPlanItems)
  };

  const maintainedBoundaryArtifact = graph
    ? generateContextBundle(graph, { taskId: "maintained-app" }).maintained_boundary || null
    : buildLocalMaintainedBoundaryArtifact(paths.workspaceRoot) || null;
  let bundlesWithAuthHintClosures = annotateBundleAuthAging(
    candidateModel.bundles.map((/** @type {any} */ bundle) => annotateBundleAuthHintClosures(bundle, adoptionPlan.items)),
    previousReconcileReport
  );
  let candidateModelFiles = {
    ...candidateModel.files
  };
  /** @type {any[]} */
  let writtenCanonicalFiles = [];
  /** @type {any[]} */
  let reportRefreshedCanonicalFiles = [];
  /** @type {any[]} */
  let appliedItems = [];
  /** @type {any[]} */
  let approvedItems = [];
  /** @type {any[]} */
  let skippedItems = [];
  /** @type {any[]} */
  let blockedItems = [];
  let adoptionRun = null;

  if (adoptSelector) {
    adoptionRun = applyAdoptionSelector(adoptionPlan, adoptSelector, Boolean(options.write));
    adoptionPlan.items = adoptionRun.plan.items;
    adoptionPlan.approved_review_groups = adoptionRun.plan.approved_review_groups;
    adoptionPlan.projection_review_groups = buildProjectionReviewGroups(adoptionPlan.items);
    adoptionPlan.ui_review_groups = buildUiReviewGroups(adoptionPlan.items);
    adoptionPlan.workflow_review_groups = buildWorkflowReviewGroups(adoptionPlan.items);
    appliedItems = adoptionRun.appliedItems;
    approvedItems = adoptionRun.approvedItems;
    skippedItems = adoptionRun.skippedItems;
    blockedItems = adoptionRun.blockedItems;
    bundlesWithAuthHintClosures = annotateBundleAuthAging(
      candidateModel.bundles.map((/** @type {any} */ bundle) => annotateBundleAuthHintClosures(bundle, adoptionPlan.items)),
      previousReconcileReport
    );
    candidateModelFiles = {};
    const canonicalOutputs = buildCanonicalAdoptionOutputs(
      paths,
      candidateModel.files,
      adoptionPlan.items,
      adoptionRun.selectedItems,
      { refreshAdopted: options.refreshAdopted }
    );
    for (const [relativePath, contents] of Object.entries(canonicalOutputs.files)) {
      files[relativePath.replaceAll(path.sep, "/")] = contents;
    }
    writtenCanonicalFiles = Object.keys(canonicalOutputs.files).sort();
    reportRefreshedCanonicalFiles = canonicalOutputs.refreshedFiles || [];
  } else {
    for (const [relativePath, contents] of Object.entries(candidateModelFiles)) {
      files[relativePath.replaceAll(path.sep, "/")] = contents;
    }
  }

  const planItemSummary = summarizeAdoptionPlanItems(adoptionPlan.items);
  const agentAdoptionPlan = buildAgentAdoptionPlan(adoptionPlan, maintainedBoundaryArtifact);
  for (const bundle of bundlesWithAuthHintClosures) {
    const readmePath = `candidates/reconcile/model/bundles/${bundle.slug}/README.md`;
    const readme = renderCandidateBundleReadme(bundle, agentAdoptionPlan.imported_proposal_surfaces || []);
    candidateModelFiles[readmePath] = readme;
    files[readmePath] = readme;
  }
  appliedItems = planItemSummary.applied_items;
  approvedItems = planItemSummary.approved_items;
  skippedItems = planItemSummary.skipped_items;
  blockedItems = planItemSummary.blocked_items;

  files["candidates/reconcile/adoption-plan.json"] = `${stableStringify(adoptionPlan)}\n`;
  files["candidates/reconcile/adoption-plan.agent.json"] = `${stableStringify(agentAdoptionPlan)}\n`;
  /** @type {WorkflowRecord} */
  const report = {
    type: "reconcile_report",
    workspace: paths.topogramRoot,
    bootstrapped_topogram_root: paths.bootstrappedTopogramRoot,
    adoption_plan_path: "candidates/reconcile/adoption-plan.json",
    agent_adoption_plan_path: "candidates/reconcile/adoption-plan.agent.json",
    adopt_selector: adoptSelector,
    adopt_write_mode: Boolean(options.write),
    promoted,
    skipped,
    applied_items: appliedItems,
    approved_items: approvedItems,
    skipped_items: skippedItems,
    blocked_items: blockedItems,
    written_canonical_files: writtenCanonicalFiles,
    promoted_canonical_items: buildPromotedCanonicalItemsReport(
      adoptionPlan.items,
      adoptionRun?.selectedItems || [],
      writtenCanonicalFiles,
      adoptSelector,
      adoptionItemKey,
      reportRefreshedCanonicalFiles
    ),
    refreshed_canonical_files: reportRefreshedCanonicalFiles,
    approved_review_groups: adoptionPlan.approved_review_groups,
    staged_items: agentAdoptionPlan.staged_items,
    adoption_plan_items: adoptionPlan.items.map((/** @type {any} */ item) => ({
      bundle: item.bundle,
      item: item.item,
      kind: item.kind,
      status: item.status,
      confidence: item.confidence || null,
      recommendation: item.recommendation || null,
      related_docs: item.related_docs || [],
      related_capabilities: item.related_capabilities || [],
      related_rules: item.related_rules || [],
      related_workflows: item.related_workflows || []
    })),
    agent_adoption_plan_items: agentAdoptionPlan.imported_proposal_surfaces,
    projection_review_groups: adoptionPlan.projection_review_groups,
    ui_review_groups: adoptionPlan.ui_review_groups,
    workflow_review_groups: adoptionPlan.workflow_review_groups,
    bundle_blockers: buildBundleBlockerSummaries(adoptionPlan.items),
    projection_dependent_items: adoptionPlan.items
      .filter((/** @type {any} */ item) => (item.projection_impacts || []).length > 0)
      .map((/** @type {any} */ item) => ({
        item: item.item,
        kind: item.kind,
        bundle: item.bundle,
        projection_impacts: item.projection_impacts
      })),
    suppressed_noise_bundles: candidateModel.suppressedNoiseBundles || [],
    candidate_model_files: Object.keys(candidateModelFiles).sort(),
    candidate_model_bundles: bundlesWithAuthHintClosures.map((/** @type {any} */ bundle) => ({
      operator_summary: buildBundleOperatorSummary(bundle),
      auth_permission_hints: bundle.authPermissionHints || [],
      auth_claim_hints: bundle.authClaimHints || [],
      auth_ownership_hints: bundle.authOwnershipHints || [],
      auth_role_guidance: bundle.authRoleGuidance || [],
      id: bundle.id,
      slug: bundle.slug,
      label: bundle.label,
      merge_hints: bundle.mergeHints,
      projection_impacts: bundle.projectionImpacts,
      projection_patches: bundle.projectionPatches,
      ui_impacts: bundle.uiImpacts,
      workflow_impacts: bundle.workflowImpacts,
      doc_link_suggestions: bundle.docLinkSuggestions,
      doc_drift_summaries: bundle.docDriftSummaries,
      doc_metadata_patches: bundle.docMetadataPatches,
      adoption_plan: bundle.adoptionPlan,
      actors: bundle.actors.map((/** @type {any} */ entry) => entry.id_hint),
      actor_details: bundle.actors.map((/** @type {any} */ entry) => ({
        id: entry.id_hint,
        related_docs: entry.related_docs || [],
        related_capabilities: entry.related_capabilities || []
      })),
      roles: bundle.roles.map((/** @type {any} */ entry) => entry.id_hint),
      role_details: bundle.roles.map((/** @type {any} */ entry) => ({
        id: entry.id_hint,
        related_docs: entry.related_docs || [],
        related_capabilities: entry.related_capabilities || []
      })),
      entities: bundle.entities.map((/** @type {any} */ entry) => entry.id_hint),
      enums: bundle.enums.map((/** @type {any} */ entry) => entry.id_hint),
      capabilities: bundle.capabilities.map((/** @type {any} */ entry) => entry.id_hint),
      shapes: bundle.shapes.map((/** @type {any} */ entry) => entry.id),
      widgets: bundle.widgets.map((/** @type {any} */ entry) => entry.id_hint),
      cli_surfaces: (bundle.cliSurfaces || []).map((/** @type {any} */ entry) => entry.id_hint),
      screens: bundle.screens.map((/** @type {any} */ entry) => entry.id_hint),
      ui_flows: (bundle.uiFlows || []).map((/** @type {any} */ entry) => entry.id_hint),
      workflows: bundle.workflows.map((/** @type {any} */ entry) => entry.id_hint),
      docs: bundle.docs.map((/** @type {any} */ entry) => entry.id),
      maintained_seam_candidates: (agentAdoptionPlan.imported_proposal_surfaces || [])
        .filter((/** @type {any} */ surface) => surface.bundle === bundle.slug && (surface.maintained_seam_candidates || []).length > 0)
        .map((/** @type {any} */ surface) => ({
          id: surface.id,
          kind: surface.kind,
          maintained_seam_candidates: surface.maintained_seam_candidates
        }))
    }))
  };
  report.bundle_priorities = annotateBundlePriorities(
    attachBundleOperatorHints(
      buildBundleAdoptionPriorities(report, confidenceRank),
      report.candidate_model_bundles
    )
  );
  const canonicalChangeTitle = report.adopt_selector && !report.adopt_write_mode
    ? "## Preview Canonical Changes"
    : "## Promoted Canonical Items";
  files["candidates/reconcile/report.json"] = `${stableStringify(report)}\n`;
  const candidateModelBundlesMarkdown = report.candidate_model_bundles.length
    ? report.candidate_model_bundles.map((/** @type {any} */ bundle) => `- \`${bundle.slug}\` (${bundle.actors.length} actors, ${bundle.roles.length} roles, ${bundle.entities.length} entities, ${bundle.enums.length} enums, ${bundle.capabilities.length} capabilities, ${bundle.shapes.length} shapes, ${bundle.widgets.length} widgets, ${bundle.cli_surfaces.length} CLI surfaces, ${bundle.screens.length} screens, ${(bundle.ui_flows || []).length} UI flows, ${bundle.workflows.length} workflows, ${bundle.docs.length} docs)
  - primary concept \`${bundle.operator_summary.primaryConcept}\`${bundle.operator_summary.primaryEntityId ? `, primary entity \`${bundle.operator_summary.primaryEntityId}\`` : ""}
  - participants ${bundle.operator_summary.participants.label}
  - main capabilities ${summarizeBundleSurface(bundle, bundle.operator_summary.capabilityIds)}
  - main widgets ${summarizeBundleSurface(bundle, bundle.operator_summary.widgetIds)}
  - main routes ${summarizeBundleSurface(bundle, bundle.operator_summary.routePaths)}
  - candidate maintained seam mappings ${renderMaintainedSeamCandidatesInline(bundle)}
  - permission hints ${bundle.auth_permission_hints?.length ? bundle.auth_permission_hints.map((/** @type {any} */ entry) => formatAuthPermissionHintInline(entry)).join(", ") : "_none_"}
  - auth claims ${bundle.auth_claim_hints?.length ? bundle.auth_claim_hints.map((/** @type {any} */ entry) => formatAuthClaimHintInline(entry)).join(", ") : "_none_"}
  - ownership hints ${bundle.auth_ownership_hints?.length ? bundle.auth_ownership_hints.map((/** @type {any} */ entry) => formatAuthOwnershipHintInline(entry)).join(", ") : "_none_"}
  - auth role guidance ${bundle.auth_role_guidance?.length ? bundle.auth_role_guidance.map((/** @type {any} */ entry) => formatAuthRoleGuidanceInline(entry)).join(", ") : "_none_"}
  - auth closure ${bundle.operator_summary.authClosureSummary.label} (adopted=${bundle.operator_summary.authClosureSummary.adopted}, deferred=${bundle.operator_summary.authClosureSummary.deferred}, unresolved=${bundle.operator_summary.authClosureSummary.unresolved})
  ${bundle.operator_summary.authAging && bundle.operator_summary.authAging.escalationLevel !== "none" ? `- auth escalation ${bundle.operator_summary.authAging.escalationLevel === "stale_high_risk" ? "escalated" : "fresh attention"} (high-risk runs=${bundle.operator_summary.authAging.repeatCount})\n` : ""}  - why ${bundle.operator_summary.whyThisBundle}${bundle.auth_permission_hints?.length ? `\n${bundle.auth_permission_hints.map((/** @type {any} */ entry) => `  - permission ${formatAuthPermissionHintInline(entry)} <- ${entry.related_capabilities.length ? entry.related_capabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_no direct capability match_"}\n    - closure ${entry.closure_state || "unresolved"}\n    - closure reason ${entry.closure_reason || "No reviewed projection patch has been applied for this inferred auth hint yet."}\n    - why inferred ${entry.why_inferred || entry.explanation}\n    - review next ${entry.review_guidance || buildAuthPermissionReviewGuidance(entry)}`).join("\n")}` : ""}${bundle.auth_claim_hints?.length ? `\n${bundle.auth_claim_hints.map((/** @type {any} */ entry) => `  - auth ${formatAuthClaimHintInline(entry)} <- ${entry.related_capabilities.length ? entry.related_capabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_no direct capability match_"}\n    - closure ${entry.closure_state || "unresolved"}\n    - closure reason ${entry.closure_reason || "No reviewed projection patch has been applied for this inferred auth hint yet."}\n    - why inferred ${entry.why_inferred || entry.explanation}\n    - review next ${entry.review_guidance || buildAuthClaimReviewGuidance(entry)}`).join("\n")}` : ""}${bundle.auth_ownership_hints?.length ? `\n${bundle.auth_ownership_hints.map((/** @type {any} */ entry) => `  - ownership ${formatAuthOwnershipHintInline(entry)} <- ${entry.related_capabilities.length ? entry.related_capabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_no direct capability match_"}\n    - closure ${entry.closure_state || "unresolved"}\n    - closure reason ${entry.closure_reason || "No reviewed projection patch has been applied for this inferred auth hint yet."}\n    - why inferred ${entry.why_inferred || entry.explanation}\n    - review next ${entry.review_guidance || buildAuthOwnershipReviewGuidance(entry)}`).join("\n")}` : ""}${bundle.auth_role_guidance?.length ? `\n${bundle.auth_role_guidance.map((/** @type {any} */ entry) => `  - role ${formatAuthRoleGuidanceInline(entry)} <- ${entry.related_capabilities.length ? entry.related_capabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_role naming only_"}\n    - why inferred ${entry.why_inferred}\n    - suggested follow-up ${entry.followup_label} (${entry.followup_reason})\n    - review next ${entry.review_guidance}`).join("\n")}` : ""}${bundle.actor_details.length || bundle.role_details.length ? `\n${bundle.actor_details.map((/** @type {any} */ entry) => `  - actor \`${entry.id}\`${entry.related_docs.length ? ` docs=${entry.related_docs.map((/** @type {any} */ item) => `\`${item}\``).join(", ")}` : ""}${entry.related_capabilities.length ? ` capabilities=${entry.related_capabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ")}` : ""}`).concat(bundle.role_details.map((/** @type {any} */ entry) => `  - role \`${entry.id}\`${entry.related_docs.length ? ` docs=${entry.related_docs.map((/** @type {any} */ item) => `\`${item}\``).join(", ")}` : ""}${entry.related_capabilities.length ? ` capabilities=${entry.related_capabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ")}` : ""}`)).join("\n")}` : ""}${bundle.doc_link_suggestions?.length ? `\n${bundle.doc_link_suggestions.map((/** @type {any} */ item) => `  - ${formatDocLinkSuggestionInline(item).replace(/^doc /, "doc-link ")}${item.auth_role_followups?.length ? `\n    - auth role follow-up ${item.auth_role_followups.map((/** @type {any} */ entry) => `${entry.followup_label} for \`${entry.role_id}\``).join(", ")}` : ""}`).join("\n")}` : ""}${bundle.doc_drift_summaries?.length ? `\n${bundle.doc_drift_summaries.map((/** @type {any} */ item) => `  - drift ${formatDocDriftSummaryInline(item)}`).join("\n")}` : ""}${bundle.doc_metadata_patches?.length ? `\n${bundle.doc_metadata_patches.map((/** @type {any} */ item) => `  - metadata ${formatDocMetadataPatchInline(item)}`).join("\n")}` : ""}`).join("\n")
    : "- None";
  files["candidates/reconcile/report.md"] = ensureTrailingNewline(
      `# Reconcile Report\n\n## Promoted\n\n${promoted.length ? promoted.map((/** @type {any} */ item) => `- \`${item}\``).join("\n") : "- None"}\n\n## Skipped\n\n${skipped.length ? skipped.map((/** @type {any} */ item) => `- \`${item}\``).join("\n") : "- None"}\n\n## Adoption\n\n- Plan: \`${report.adoption_plan_path}\`\n- Selector: \`${report.adopt_selector || "none"}\`\n- Write mode: ${report.adopt_write_mode ? "yes" : "no"}\n- Approved items: ${report.approved_items.length}\n- Applied items: ${report.applied_items.length}\n- Skipped items: ${report.skipped_items.length}\n- Blocked items: ${report.blocked_items.length}\n- Canonical files: ${report.written_canonical_files.length}\n- Refreshed canonical files: ${report.refreshed_canonical_files.length}\n- Approved review groups: ${report.approved_review_groups.length}\n- Projection-dependent items: ${report.projection_dependent_items.length}\n- Projection review groups: ${report.projection_review_groups.length}\n- UI review groups: ${report.ui_review_groups.length}\n- Workflow review groups: ${report.workflow_review_groups.length}\n\n${renderPromotedCanonicalItemsMarkdown(report.promoted_canonical_items, { title: canonicalChangeTitle })}${renderPreviewRiskMarkdown(report)}${renderPreviewFollowupMarkdown(buildAdoptionStatusSummaryReport(report, selectNextBundle))}${renderNextBestActionMarkdown(selectNextBundle(report.bundle_priorities))}## Approved Review Groups\n\n${report.approved_review_groups.length ? report.approved_review_groups.map((/** @type {any} */ item) => `- \`${item}\``).join("\n") : "- None"}\n\n## Projection Review Groups\n\n${report.projection_review_groups.length ? report.projection_review_groups.map((/** @type {any} */ group) => `- \`${group.projection_id}\` (${group.kind}) <- ${group.items.map((/** @type {any} */ item) => `\`${item.item}\``).join(", ")}`).join("\n") : "- None"}\n\n## UI Review Groups\n\n${report.ui_review_groups.length ? report.ui_review_groups.map((/** @type {any} */ group) => `- \`${group.projection_id}\` (${group.kind}) <- ${group.items.map((/** @type {any} */ item) => `\`${item.item}\``).join(", ")}`).join("\n") : "- None"}\n\n## Workflow Review Groups\n\n${report.workflow_review_groups.length ? report.workflow_review_groups.map((/** @type {any} */ group) => `- \`${group.id}\` <- ${group.items.map((/** @type {any} */ item) => `\`${item.item}\``).join(", ")}`).join("\n") : "- None"}\n\n## Bundle Blockers\n\n${report.bundle_blockers.length ? report.bundle_blockers.map((/** @type {any} */ bundle) => `- \`${bundle.bundle}\`: blocked=${bundle.blocked_items.length}, approved=${bundle.approved_items.length}, applied=${bundle.applied_items.length}, pending=${bundle.pending_items.length}, dependencies=${bundle.blocking_dependencies.length ? bundle.blocking_dependencies.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_none_"}`).join("\n") : "- None"}\n\n${renderBundlePriorityActionsMarkdown(report.bundle_priorities)}## Suppressed Noise Bundles\n\n${report.suppressed_noise_bundles.length ? report.suppressed_noise_bundles.map((/** @type {any} */ bundle) => `- \`${bundle.slug}\`: ${bundle.reason}`).join("\n") : "- None"}\n\n## Projection Dependencies\n\n${report.projection_dependent_items.length ? report.projection_dependent_items.map((/** @type {any} */ item) => `- \`${item.item}\` -> ${item.projection_impacts.map((/** @type {any} */ impact) => `\`${impact.projection_id}\``).join(", ")}`).join("\n") : "- None"}\n\n## Blocked Adoption Items\n\n${report.blocked_items.length ? report.blocked_items.map((/** @type {any} */ item) => `- \`${item}\``).join("\n") : "- None"}\n\n## Candidate Model Bundles\n\n${candidateModelBundlesMarkdown}\n\n## Candidate Model Files\n\n${report.candidate_model_files.length ? report.candidate_model_files.map((/** @type {any} */ item) => `- \`${item}\``).join("\n") : "- None"}\n\n## Canonical Outputs\n\n${report.written_canonical_files.length ? report.written_canonical_files.map((/** @type {any} */ item) => `- \`${item}\``).join("\n") : "- None"}\n`
  );
  Object.assign(files, buildAdoptionStatusFilesReport(buildAdoptionStatusSummaryReport(report, selectNextBundle), formatDocLinkSuggestionInline, formatDocDriftSummaryInline, formatDocMetadataPatchInline));

  return {
    summary: report,
    files,
    defaultOutDir: paths.topogramRoot
  };
}

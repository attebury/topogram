// @ts-check

import { adoptionItemKey } from "../../../adoption/plan.js";
import { confidenceRank } from "../../docs.js";
import {
  adoptionStatusForStep,
  blockingDependenciesForProjectionImpacts,
  blockingDependenciesForUiImpacts,
  blockingDependenciesForWorkflowImpacts,
  projectionImpactsForAdoptionItem
} from "./dependencies.js";
import {
  canonicalDisplayPathForItem,
  canonicalRelativePathForItem,
  candidateSourcePathForItem
} from "./paths.js";
import {
  reasonForAdoptionItem,
  recommendationForAdoptionItem
} from "./reasons.js";

/** @param {CandidateBundle[]} bundles @returns {any} */
export function buildAdoptionPlan(bundles) {
  /** @type {any[]} */
  const items = [];
  for (const bundle of bundles) {
    for (const step of bundle.adoptionPlan || []) {
      const itemKind =
        step.action === "merge_bundle_into_existing_entity" ? "bundle" :
        step.action === "apply_projection_permission_patch" ? "projection_permission_patch" :
        step.action === "apply_projection_auth_patch" ? "projection_auth_patch" :
        step.action === "apply_projection_ownership_patch" ? "projection_ownership_patch" :
        step.action === "promote_cli_surface" ? "projection" :
        step.action.includes("doc") ? "doc" :
        step.action.includes("decision") ? "decision" :
        step.action.includes("verification") ? "verification" :
        step.action.includes("widget") ? "widget" :
        step.action.includes("ui_") ? "ui" :
        step.action.includes("actor") ? "actor" :
        step.action.includes("role") ? "role" :
        step.action.includes("enum") ? "enum" :
        step.action.includes("shape") ? "shape" :
        step.action.includes("capability") ? "capability" :
        step.action.includes("entity") ? "entity" :
        "bundle";
      if (itemKind === "bundle") {
        continue;
      }
      const projectionImpacts = projectionImpactsForAdoptionItem(bundle, step);
      const directProjectionBlockingDependencies =
        (step.action === "apply_projection_permission_patch" || step.action === "apply_projection_auth_patch" || step.action === "apply_projection_ownership_patch") && step.target
          ? blockingDependenciesForProjectionImpacts([
              {
                projection_id: step.target,
                kind: step.projection_kind || "api",
                projection_type: null,
                reason: `Projection ${step.target} auth rules need explicit review before promotion.`
              }
            ])
          : [];
      const uiImpacts = step.action.includes("ui_") ? bundle.uiImpacts || [] : [];
      const workflowImpacts = step.action.includes("workflow") ? bundle.workflowImpacts || [] : [];
      const blockingDependencies = [
        ...blockingDependenciesForProjectionImpacts(projectionImpacts),
        ...directProjectionBlockingDependencies,
        ...blockingDependenciesForUiImpacts(uiImpacts),
        ...blockingDependenciesForWorkflowImpacts(workflowImpacts)
      ];
      items.push({
        bundle: bundle.slug,
        item: step.item,
        kind: itemKind,
        track:
          step.track ? step.track :
          step.action.includes("workflow") ? "workflows" :
          step.action.includes("verification") ? "verification" :
          step.action.includes("ui_") ? "ui" :
          step.action === "apply_projection_permission_patch" ? "projection" :
          step.action === "apply_projection_auth_patch" ? "projection" :
          step.action === "apply_projection_ownership_patch" ? "projection" :
          step.action.includes("doc") ? "docs" :
          itemKind,
        suggested_action: step.action,
        target: step.target || null,
        confidence: step.confidence || null,
        inference_summary: step.inference_summary || null,
        source_kind: step.source_kind || null,
        widget_id: step.widget_id || null,
        event_name: step.event_name || null,
        related_docs: step.related_docs || [],
        related_capabilities: step.related_capabilities || [],
        related_shapes: step.related_shapes || [],
        permission: step.permission || null,
        claim: step.claim || null,
        claim_value: Object.prototype.hasOwnProperty.call(step, "claim_value") ? step.claim_value : null,
        ownership: step.ownership || null,
        ownership_field: step.ownership_field || null,
        projection_surface: step.projection_surface || null,
        status: adoptionStatusForStep(step, projectionImpacts, uiImpacts, workflowImpacts),
        source_path: step.source_path || candidateSourcePathForItem(bundle, itemKind, step.item),
        canonical_path:
          step.action === "skip_duplicate_shape"
            ? (step.target ? canonicalDisplayPathForItem("shape", step.target) : null)
            : (step.canonical_rel_path ? `topo/${step.canonical_rel_path}` : canonicalDisplayPathForItem(itemKind, step.item)),
        canonical_rel_path: step.canonical_rel_path || canonicalRelativePathForItem(itemKind, step.item),
        reason: reasonForAdoptionItem(step),
        recommendation: recommendationForAdoptionItem(step),
        projection_impacts: projectionImpacts,
        ui_impacts: uiImpacts,
        workflow_impacts: workflowImpacts,
        blocking_dependencies: blockingDependencies
      });
    }
    for (const patch of bundle.projectionPatches || []) {
      items.push({
        bundle: bundle.slug,
        item: `projection_patch:${patch.projection_id}`,
        kind: "projection_patch",
        track: "projection",
        suggested_action: "review_projection_patch",
        target: patch.projection_id,
        status: "needs_projection_review",
        source_path: `candidates/reconcile/model/bundles/${bundle.slug}/${patch.patch_rel_path}`,
        canonical_path: null,
        canonical_rel_path: null,
        reason: patch.reason || `Projection ${patch.projection_id} needs additive review.`,
        projection_impacts: [
          {
            projection_id: patch.projection_id,
            kind: patch.kind,
            projection_type: patch.projection_type,
            missing_capabilities: patch.missing_realizes || []
          }
        ],
        ui_impacts: (patch.missing_screens || []).length > 0 ? [
          {
            projection_id: patch.projection_id,
            kind: patch.kind,
            projection_type: patch.projection_type,
            missing_screens: patch.missing_screens || []
          }
        ] : [],
        workflow_impacts: [],
        blocking_dependencies: blockingDependenciesForProjectionImpacts([
          {
            projection_id: patch.projection_id,
            kind: patch.kind,
            projection_type: patch.projection_type,
            reason: patch.reason || `Projection ${patch.projection_id} needs additive review.`
          }
        ])
      });
    }
    for (const patch of bundle.docLinkSuggestions || []) {
      items.push({
        bundle: bundle.slug,
        item: `doc_link_patch:${patch.doc_id}`,
        kind: "doc_link_patch",
        track: "docs",
        suggested_action: "apply_doc_link_patch",
        target: patch.doc_id,
        status: "pending",
        source_path: `candidates/reconcile/model/bundles/${bundle.slug}/${patch.patch_rel_path}`,
        canonical_path: patch.canonical_rel_path ? `topo/${patch.canonical_rel_path}` : null,
        canonical_rel_path: patch.canonical_rel_path || null,
        reason: `Apply suggested related actor/role links to \`${patch.doc_id}\`.`,
        recommendation: recommendationForAdoptionItem({ action: "apply_doc_link_patch", target: patch.doc_id }),
        related_docs: [patch.doc_id],
        related_actors: patch.add_related_actors || [],
        related_roles: patch.add_related_roles || [],
        related_capabilities: patch.add_related_capabilities || [],
        related_rules: patch.add_related_rules || [],
        related_workflows: patch.add_related_workflows || [],
        projection_impacts: [],
        ui_impacts: [],
        workflow_impacts: [],
        blocking_dependencies: []
      });
    }
    for (const patch of bundle.docMetadataPatches || []) {
      items.push({
        bundle: bundle.slug,
        item: `doc_metadata_patch:${patch.doc_id}`,
        kind: "doc_metadata_patch",
        track: "docs",
        suggested_action: "apply_doc_metadata_patch",
        target: patch.doc_id,
        status: "pending",
        confidence: patch.imported_confidence || "low",
        source_path: `candidates/reconcile/model/bundles/${bundle.slug}/${patch.patch_rel_path}`,
        canonical_path: patch.canonical_rel_path ? `topo/${patch.canonical_rel_path}` : null,
        canonical_rel_path: patch.canonical_rel_path || null,
        reason: `Apply suggested safe metadata updates to \`${patch.doc_id}\`.`,
        recommendation: recommendationForAdoptionItem({ action: "apply_doc_metadata_patch", target: patch.doc_id }),
        related_docs: [patch.doc_id],
        summary: patch.summary || null,
        success_outcome: patch.success_outcome || null,
        actors: patch.actors || [],
        projection_impacts: [],
        ui_impacts: [],
        workflow_impacts: [],
        blocking_dependencies: []
      });
    }
  }
  return items.sort((/** @type {any} */ a, /** @type {any} */ b) =>
    a.bundle.localeCompare(b.bundle) ||
    confidenceRank(b.confidence || "low") - confidenceRank(a.confidence || "low") ||
    a.kind.localeCompare(b.kind) ||
    a.item.localeCompare(b.item)
  );
}

export const ADOPT_SELECTORS = new Set(["from-plan", "actors", "roles", "enums", "shapes", "entities", "capabilities", "widgets", "docs", "journeys", "workflows", "verification", "cli", "ui"]);

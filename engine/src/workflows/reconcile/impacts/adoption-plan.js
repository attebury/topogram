// @ts-check
import { docDirForKind } from "../../docs.js";
import { dashedTopogramId } from "../ids.js";
import { shapeFieldSignature } from "./indexes.js";

/** @param {CandidateBundle} bundle @param {any} canonicalShapeIndex @returns {any} */
export function buildBundleAdoptionPlan(bundle, canonicalShapeIndex) {
  /** @type {any[]} */
  const steps = [];
  for (const entry of bundle.actors) {
    steps.push({
      action: "promote_actor",
      item: entry.id_hint,
      target: null,
      confidence: entry.confidence || "low",
      inference_summary: entry.inference_summary || null,
      related_docs: entry.related_docs || [],
      related_capabilities: entry.related_capabilities || [],
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/actors/${entry.id_hint}.tg`,
      canonical_rel_path: `actors/${dashedTopogramId(entry.id_hint)}.tg`
    });
  }
  for (const entry of bundle.roles) {
    steps.push({
      action: "promote_role",
      item: entry.id_hint,
      target: null,
      confidence: entry.confidence || "low",
      inference_summary: entry.inference_summary || null,
      related_docs: entry.related_docs || [],
      related_capabilities: entry.related_capabilities || [],
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/roles/${entry.id_hint}.tg`,
      canonical_rel_path: `roles/${dashedTopogramId(entry.id_hint)}.tg`
    });
  }
  if (bundle.mergeHints?.canonicalEntityTarget) {
    steps.push({
      action: "merge_bundle_into_existing_entity",
      item: bundle.slug,
      target: bundle.mergeHints.canonicalEntityTarget
    });
  } else if (bundle.entities.length > 0) {
    for (const entry of bundle.entities) {
      steps.push({
        action: "promote_entity",
        item: entry.id_hint,
        target: null
      });
    }
  }
  for (const entry of bundle.enums) {
    steps.push({
      action: "promote_enum",
      item: entry.id_hint,
      target: bundle.mergeHints?.canonicalEntityTarget || null
    });
  }
  for (const entry of bundle.capabilities) {
    steps.push({
      action: bundle.mergeHints?.canonicalEntityTarget ? "merge_capability_into_existing_entity" : "promote_capability",
      item: entry.id_hint,
      target: bundle.mergeHints?.canonicalEntityTarget || null
    });
  }
  for (const entry of bundle.shapes) {
    const signature = shapeFieldSignature(entry.fields || []);
    const duplicateTargets = canonicalShapeIndex.get(signature) || [];
    if (duplicateTargets.length > 0 && entry.source_kind !== "ui_widget_event") {
      steps.push({
        action: "skip_duplicate_shape",
        item: entry.id,
        target: duplicateTargets[0]
      });
      continue;
    }
    steps.push({
      action: "promote_shape",
      item: entry.id,
      target: bundle.mergeHints?.canonicalEntityTarget || null,
      source_kind: entry.source_kind || null,
      widget_id: entry.widget_id || null,
      event_name: entry.event_name || null
    });
  }
  for (const entry of bundle.docs) {
    if (entry.existing_canonical) {
      continue;
    }
    steps.push({
      action: entry.kind === "workflow" ? "promote_workflow_doc" : "promote_doc",
      item: entry.id,
      target: null,
      doc_kind: entry.kind,
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/docs/${docDirForKind(entry.kind)}/${entry.id}.md`,
      canonical_rel_path: `docs/${docDirForKind(entry.kind)}/${entry.id}.md`
    });
  }
  for (const entry of bundle.workflows) {
    steps.push({
      action: "promote_workflow_decision",
      item: `dec_${entry.id_hint.replace(/^workflow_/, "")}`,
      target: null,
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/decisions/dec_${entry.id_hint.replace(/^workflow_/, "")}.tg`,
      canonical_rel_path: `decisions/decision-${dashedTopogramId(entry.id_hint.replace(/^workflow_/, ""))}.tg`
    });
    steps.push({
      action: "promote_workflow_doc",
      item: entry.id_hint,
      target: null,
      doc_kind: "workflow",
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/docs/workflows/${entry.id_hint}.md`,
      canonical_rel_path: `docs/workflows/${entry.id_hint}.md`
    });
  }
  for (const entry of bundle.verifications || []) {
    steps.push({
      action: "promote_verification",
      item: entry.id_hint,
      target: null,
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/verifications/${entry.id_hint}.tg`,
      canonical_rel_path: `verifications/${dashedTopogramId(entry.id_hint)}.tg`
    });
  }
  for (const entry of bundle.widgets || []) {
    steps.push({
      action: "promote_widget",
      item: entry.id_hint,
      target: null,
      confidence: entry.confidence || "low",
      inference_summary: entry.inference_summary || null,
      related_capabilities: [entry.data_source].filter(Boolean),
      related_shapes: [...new Set((entry.inferred_events || []).map((/** @type {any} */ event) => event.payload_shape).filter(Boolean))],
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/widgets/${entry.id_hint}.tg`,
      canonical_rel_path: `widgets/${dashedTopogramId(entry.id_hint)}.tg`
    });
  }
  for (const screen of bundle.screens) {
    steps.push({
      action: "promote_ui_report",
      item: `ui_${screen.id_hint}`,
      target: null,
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/docs/reports/ui-${screen.id_hint}.md`,
      canonical_rel_path: `docs/reports/ui-${screen.id_hint}.md`
    });
  }
  for (const patch of bundle.projectionPatches || []) {
    for (const hint of patch.missing_auth_permissions || []) {
      steps.push({
        action: "apply_projection_permission_patch",
        item: `projection_permission_patch:${patch.projection_id}:${hint.projection_surface}:${hint.permission}`,
        target: patch.projection_id,
        projection_kind: patch.kind,
        projection_surface: hint.projection_surface,
        permission: hint.permission,
        confidence: hint.confidence || "low",
        inference_summary: hint.why_inferred || hint.explanation || null,
        related_capabilities: hint.related_capabilities || [],
        source_path: `candidates/reconcile/model/bundles/${bundle.slug}/${patch.patch_rel_path}`,
        canonical_rel_path: `projections/${dashedTopogramId(patch.projection_id)}.tg`
      });
    }
    for (const hint of patch.missing_auth_claims || []) {
      steps.push({
        action: "apply_projection_auth_patch",
        item: `projection_auth_patch:${patch.projection_id}:${hint.projection_surface}:${hint.claim}`,
        target: patch.projection_id,
        projection_kind: patch.kind,
        projection_surface: hint.projection_surface,
        claim: hint.claim,
        claim_value: hint.claim_value,
        confidence: hint.confidence || "low",
        inference_summary: hint.why_inferred || hint.explanation || null,
        related_capabilities: hint.related_capabilities || [],
        source_path: `candidates/reconcile/model/bundles/${bundle.slug}/${patch.patch_rel_path}`,
        canonical_rel_path: `projections/${dashedTopogramId(patch.projection_id)}.tg`
      });
    }
    for (const hint of patch.missing_auth_ownerships || []) {
      steps.push({
        action: "apply_projection_ownership_patch",
        item: `projection_ownership_patch:${patch.projection_id}:${hint.ownership_field}`,
        target: patch.projection_id,
        projection_kind: patch.kind,
        projection_surface: "authorization",
        ownership: hint.ownership,
        ownership_field: hint.ownership_field,
        confidence: hint.confidence || "low",
        inference_summary: hint.why_inferred || hint.explanation || null,
        related_capabilities: hint.related_capabilities || [],
        source_path: `candidates/reconcile/model/bundles/${bundle.slug}/${patch.patch_rel_path}`,
        canonical_rel_path: `projections/${dashedTopogramId(patch.projection_id)}.tg`
      });
    }
  }
  return steps;
}

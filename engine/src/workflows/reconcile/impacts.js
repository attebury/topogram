// @ts-check
import { stableStringify } from "../../format.js";
import { docDirForKind } from "../docs.js";
import { dashedTopogramId } from "./ids.js";
import {
  buildAuthClaimReviewGuidance,
  buildAuthOwnershipReviewGuidance,
  buildAuthPermissionReviewGuidance,
  describeAuthClaimWhyInferred,
  describeAuthOwnershipWhyInferred,
  describeAuthPermissionWhyInferred,
  formatAuthClaimHintInline,
  formatAuthOwnershipHintInline,
  formatAuthPermissionHintInline
} from "./auth.js";

/** @param {any[]} fields @returns {any} */
export function shapeFieldSignature(fields) {
  return [...new Set((fields || []).filter(Boolean))].sort().join("|");
}

/** @param {ResolvedGraph} graph @returns {any} */
export function buildCanonicalShapeIndex(graph) {
  const bySignature = new Map();
  for (const shape of graph?.byKind.shape || []) {
    const fields = (shape.projectedFields || shape.fields || []).map((/** @type {any} */ field) => field.name).filter(Boolean);
    const signature = shapeFieldSignature(fields);
    if (!signature) {
      continue;
    }
    if (!bySignature.has(signature)) {
      bySignature.set(signature, []);
    }
    bySignature.get(signature).push(shape.id);
  }
  return bySignature;
}

/** @param {WorkflowRecord} capability @returns {any} */
export function capabilityEntityTargets(capability) {
  return [
    ...(capability.creates || []),
    ...(capability.updates || []),
    ...(capability.deletes || []),
    ...(capability.reads || [])
  ]
    .map((/** @type {any} */ ref) => ref?.id || ref?.target?.id || null)
    .filter((/** @type {any} */ id) => typeof id === "string" && id.startsWith("entity_"));
}

/** @param {WorkflowRecord} projection @returns {any} */
export function projectionKindForImpact(projection) {
  if ((projection.http || []).length > 0 || projection.type === "api_contract") {
    return "api";
  }
  if (
    (projection.uiRoutes || []).length > 0 ||
    (projection.uiWeb || []).length > 0 ||
    (projection.uiIos || []).length > 0 ||
    projection.type === "web_surface" ||
    projection.type === "ios_surface"
  ) {
    return "ui";
  }
  if ((projection.dbTables || []).length > 0) {
    return "db";
  }
  return "other";
}

/** @param {ResolvedGraph} graph @returns {any} */
export function buildProjectionEntityIndex(graph) {
  const projections = graph?.byKind.projection || [];
  const capabilities = new Map((graph?.byKind.capability || []).map((/** @type {any} */ capability) => [capability.id, capability]));
  const projectionsById = new Map(projections.map((/** @type {any} */ projection) => [projection.id, projection]));
  const memo = new Map();

  /** @param {string} projectionId @param {any} stack @returns {any} */
  function collectEntities(projectionId, stack = new Set()) {
    if (memo.has(projectionId)) {
      return memo.get(projectionId);
    }
    if (stack.has(projectionId)) {
      return new Set();
    }
    stack.add(projectionId);
    const projection = projectionsById.get(projectionId);
    const entities = new Set();
    for (const realized of projection?.realizes || []) {
      const realizedKind = realized?.target?.kind || realized?.kind || null;
      const realizedId = realized?.target?.id || realized?.id || null;
      if (realizedKind === "capability") {
        const capability = capabilities.get(realizedId);
        for (const entityId of capabilityEntityTargets(capability || {})) {
          entities.add(entityId);
        }
      } else if (realizedKind === "projection") {
        for (const entityId of collectEntities(realizedId, stack)) {
          entities.add(entityId);
        }
      }
    }
    memo.set(projectionId, entities);
    stack.delete(projectionId);
    return entities;
  }

  return projections.map((/** @type {any} */ projection) => ({
    id: projection.id,
    projection_type: projection.type || null,
    kind: projectionKindForImpact(projection),
    realizes: (projection.realizes || []).map((/** @type {any} */ entry) => entry.id),
    entityIds: [...collectEntities(projection.id)].sort()
  }));
}

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
    if (duplicateTargets.length > 0) {
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
      target: bundle.mergeHints?.canonicalEntityTarget || null
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

/** @param {CandidateBundle} bundle @param {any} projectionIndex @returns {any} */
export function buildProjectionImpacts(bundle, projectionIndex) {
  const bundleEntityIds = new Set([
    bundle.mergeHints?.canonicalEntityTarget || null,
    ...bundle.entities.map((/** @type {any} */ entry) => entry.id_hint)
  ].filter(Boolean));
  if (bundle.capabilities.length === 0 || bundleEntityIds.size === 0) {
    return [];
  }
  return projectionIndex
    .filter((/** @type {any} */ projection) => projection.kind === "api" || projection.kind === "ui")
    .filter((/** @type {any} */ projection) => projection.entityIds.some((/** @type {any} */ entityId) => bundleEntityIds.has(entityId)))
    .map((/** @type {any} */ projection) => {
      const missingCapabilities = bundle.capabilities
        .map((/** @type {any} */ entry) => entry.id_hint)
        .filter((/** @type {any} */ id) => !projection.realizes.includes(id));
      if (missingCapabilities.length === 0) {
        return null;
      }
      return {
        projection_id: projection.id,
        projection_type: projection.type,
        kind: projection.kind,
        missing_capabilities: missingCapabilities,
        reason: `Projection ${projection.id} already covers the same entity surface but does not realize these imported capabilities.`
      };
    })
    .filter(Boolean)
    .sort((/** @type {any} */ a, /** @type {any} */ b) => a.projection_id.localeCompare(b.projection_id));
}

/** @param {CandidateBundle} bundle @param {ResolvedGraph} graph @returns {any} */
export function buildUiImpacts(bundle, graph) {
  if ((bundle.screens || []).length === 0) {
    return [];
  }
  const uiProjections = (graph?.byKind.projection || []).filter((/** @type {any} */ projection) => ["ui_contract", "web_surface"].includes(projection.type));
  const bundleScreenIds = bundle.screens.map((/** @type {any} */ screen) => screen.id_hint);
  return uiProjections
    .map((/** @type {any} */ projection) => {
      const projectionScreens = new Set((projection.uiScreens || []).map((/** @type {any} */ screen) => screen.id));
      const missingScreens = bundleScreenIds.filter((/** @type {any} */ screenId) => !projectionScreens.has(screenId));
      if (missingScreens.length === 0) {
        return null;
      }
      return {
        projection_id: projection.id,
        kind: "ui",
        projection_type: projection.type,
        missing_screens: missingScreens,
        reason: `UI projection ${projection.id} does not currently represent these imported screens.`
      };
    })
    .filter(Boolean)
    .sort((/** @type {any} */ a, /** @type {any} */ b) => a.projection_id.localeCompare(b.projection_id));
}

/** @param {CandidateBundle} bundle @param {ResolvedGraph} graph @returns {any} */
export function buildWorkflowImpacts(bundle, graph) {
  if ((bundle.workflows || []).length === 0) {
    return [];
  }
  const canonicalWorkflowDocs = new Set((graph?.docs || []).filter((/** @type {any} */ doc) => doc.kind === "workflow").map((/** @type {any} */ doc) => doc.id));
  const impacted = bundle.workflows
    .map((/** @type {any} */ workflow) => workflow.id_hint)
    .filter((/** @type {any} */ id) => !canonicalWorkflowDocs.has(id));
  if (impacted.length === 0) {
    return [];
  }
  return [
    {
      review_group_id: `workflow_review:${bundle.slug}`,
      kind: "workflow",
      items: impacted,
      reason: `Workflow semantics for ${bundle.slug} need canonical review before promotion.`
    }
  ];
}

/** @param {CandidateBundle} bundle @returns {any} */
export function buildProjectionPatchCandidates(bundle) {
  const capabilityById = new Map((bundle.capabilities || []).map((/** @type {any} */ entry) => [entry.id_hint, entry]));
  const routesByScreen = new Map();
  for (const route of bundle.uiRoutes || []) {
    const screenId = route.screen_id || route.id_hint;
    if (!routesByScreen.has(screenId)) {
      routesByScreen.set(screenId, []);
    }
    routesByScreen.get(screenId).push(route);
  }
  const actionsByScreen = new Map();
  for (const action of bundle.uiActions || []) {
    const screenId = action.screen_id || action.id_hint;
    if (!actionsByScreen.has(screenId)) {
      actionsByScreen.set(screenId, []);
    }
    actionsByScreen.get(screenId).push(action);
  }

  /** @type {any[]} */

  const patches = [];
  for (const impact of bundle.projectionImpacts || []) {
    const missingRealizes = [...(impact.missing_capabilities || [])];
    const missingHttp = impact.kind === "api"
      ? missingRealizes
          .map((/** @type {any} */ capabilityId) => capabilityById.get(capabilityId))
          .filter(Boolean)
          .map((/** @type {any} */ entry) => ({
            capability_id: entry.id_hint,
            method: entry.endpoint?.method || "GET",
            path: entry.endpoint?.path || "/"
          }))
      : [];
    patches.push({
      projection_id: impact.projection_id,
      kind: impact.kind,
      projection_type: impact.projection_type,
      reason: impact.reason,
      missing_realizes: missingRealizes,
      missing_http: missingHttp,
      missing_screens: [],
      missing_routes: [],
      missing_actions: []
    });
  }

  for (const impact of bundle.uiImpacts || []) {
    const existing = patches.find((/** @type {any} */ patch) => patch.projection_id === impact.projection_id);
    const missingScreens = [...(impact.missing_screens || [])];
    const missingRoutes = missingScreens.flatMap((/** @type {any} */ screenId) => routesByScreen.get(screenId) || []).map((/** @type {any} */ route) => ({
      screen_id: route.screen_id,
      path: route.path
    }));
    const missingActions = missingScreens.flatMap((/** @type {any} */ screenId) => actionsByScreen.get(screenId) || []).map((/** @type {any} */ action) => ({
      screen_id: action.screen_id,
      capability_hint: action.capability_hint
    }));
    if (existing) {
      existing.missing_screens = [...new Set([...(existing.missing_screens || []), ...missingScreens])];
      existing.missing_routes = [...(existing.missing_routes || []), ...missingRoutes];
      existing.missing_actions = [...(existing.missing_actions || []), ...missingActions];
      continue;
    }
    patches.push({
      projection_id: impact.projection_id,
      kind: impact.kind,
      projection_type: impact.projection_type,
      reason: impact.reason,
      missing_realizes: [],
      missing_http: [],
      missing_screens: missingScreens,
      missing_routes: missingRoutes,
      missing_actions: missingActions
    });
  }

  for (const hint of bundle.authClaimHints || []) {
    for (const impact of bundle.projectionImpacts || []) {
      const relatedCapabilities = (impact.missing_capabilities || []).filter((/** @type {any} */ capabilityId) => (hint.related_capabilities || []).includes(capabilityId));
      if (relatedCapabilities.length === 0) {
        continue;
      }
      const projectionSurface = impact.kind === "ui" ? "visibility_rules" : "authorization";
      const entry = {
        claim: hint.claim,
        claim_value: hint.claim_value,
        confidence: hint.confidence,
        review_required: true,
        explanation: hint.explanation,
        why_inferred: hint.why_inferred || describeAuthClaimWhyInferred(hint),
        review_guidance: hint.review_guidance || buildAuthClaimReviewGuidance(hint),
        related_capabilities: relatedCapabilities,
        projection_surface: projectionSurface,
        evidence: hint.evidence || {}
      };
      const existing = patches.find((/** @type {any} */ patch) => patch.projection_id === impact.projection_id);
      if (existing) {
        existing.missing_auth_claims = existing.missing_auth_claims || [];
        const duplicate = existing.missing_auth_claims.some((/** @type {any} */ candidate) =>
          candidate.claim === entry.claim &&
          String(candidate.claim_value || "") === String(entry.claim_value || "") &&
          candidate.projection_surface === entry.projection_surface &&
          stableStringify(candidate.related_capabilities || []) === stableStringify(entry.related_capabilities || [])
        );
        if (!duplicate) {
          existing.missing_auth_claims.push(entry);
        }
        continue;
      }
      patches.push({
        projection_id: impact.projection_id,
        kind: impact.kind,
        projection_type: impact.projection_type,
        reason: `Projection ${impact.projection_id} likely needs claim-based auth rules for the imported ${bundle.label.toLowerCase()} surface.`,
        missing_realizes: relatedCapabilities,
        missing_http: [],
        missing_screens: [],
        missing_routes: [],
        missing_actions: [],
        missing_auth_claims: [entry]
      });
    }
  }

  for (const hint of bundle.authPermissionHints || []) {
    for (const impact of bundle.projectionImpacts || []) {
      const relatedCapabilities = (impact.missing_capabilities || []).filter((/** @type {any} */ capabilityId) => (hint.related_capabilities || []).includes(capabilityId));
      if (relatedCapabilities.length === 0) {
        continue;
      }
      const projectionSurface = impact.kind === "ui" ? "visibility_rules" : "authorization";
      const entry = {
        permission: hint.permission,
        confidence: hint.confidence,
        review_required: true,
        explanation: hint.explanation,
        why_inferred: hint.why_inferred || describeAuthPermissionWhyInferred(hint),
        review_guidance: hint.review_guidance || buildAuthPermissionReviewGuidance(hint),
        related_capabilities: relatedCapabilities,
        projection_surface: projectionSurface,
        evidence: hint.evidence || {}
      };
      const existing = patches.find((/** @type {any} */ patch) => patch.projection_id === impact.projection_id);
      if (existing) {
        existing.missing_auth_permissions = existing.missing_auth_permissions || [];
        const duplicate = existing.missing_auth_permissions.some((/** @type {any} */ candidate) =>
          candidate.permission === entry.permission &&
          candidate.projection_surface === entry.projection_surface &&
          stableStringify(candidate.related_capabilities || []) === stableStringify(entry.related_capabilities || [])
        );
        if (!duplicate) {
          existing.missing_auth_permissions.push(entry);
        }
        continue;
      }
      patches.push({
        projection_id: impact.projection_id,
        kind: impact.kind,
        projection_type: impact.projection_type,
        reason: `Projection ${impact.projection_id} likely needs permission-based auth rules for the imported ${bundle.label.toLowerCase()} surface.`,
        missing_realizes: relatedCapabilities,
        missing_http: [],
        missing_screens: [],
        missing_routes: [],
        missing_actions: [],
        missing_auth_permissions: [entry]
      });
    }
  }

  for (const hint of bundle.authOwnershipHints || []) {
    for (const impact of bundle.projectionImpacts || []) {
      if (impact.kind !== "api") {
        continue;
      }
      const relatedCapabilities = (impact.missing_capabilities || []).filter((/** @type {any} */ capabilityId) => (hint.related_capabilities || []).includes(capabilityId));
      if (relatedCapabilities.length === 0) {
        continue;
      }
      const entry = {
        ownership: hint.ownership,
        ownership_field: hint.ownership_field,
        confidence: hint.confidence,
        review_required: true,
        explanation: hint.explanation,
        why_inferred: hint.why_inferred || describeAuthOwnershipWhyInferred(hint),
        review_guidance: hint.review_guidance || buildAuthOwnershipReviewGuidance(hint),
        related_capabilities: relatedCapabilities,
        related_entities: hint.related_entities || [],
        evidence: hint.evidence || {}
      };
      const existing = patches.find((/** @type {any} */ patch) => patch.projection_id === impact.projection_id);
      if (existing) {
        existing.missing_auth_ownerships = existing.missing_auth_ownerships || [];
        const duplicate = existing.missing_auth_ownerships.some((/** @type {any} */ candidate) =>
          candidate.ownership === entry.ownership &&
          candidate.ownership_field === entry.ownership_field &&
          stableStringify(candidate.related_capabilities || []) === stableStringify(entry.related_capabilities || [])
        );
        if (!duplicate) {
          existing.missing_auth_ownerships.push(entry);
        }
        continue;
      }
      patches.push({
        projection_id: impact.projection_id,
        kind: impact.kind,
        projection_type: impact.projection_type,
        reason: `Projection ${impact.projection_id} likely needs ownership-based auth rules for the imported ${bundle.label.toLowerCase()} surface.`,
        missing_realizes: relatedCapabilities,
        missing_http: [],
        missing_screens: [],
        missing_routes: [],
        missing_actions: [],
        missing_auth_ownerships: [entry]
      });
    }
  }

  return patches
    .map((/** @type {any} */ patch) => ({
      ...patch,
      missing_auth_permissions: (patch.missing_auth_permissions || []).sort((/** @type {any} */ a, /** @type {any} */ b) =>
        (a.projection_surface || "").localeCompare(b.projection_surface || "") ||
        (a.permission || "").localeCompare(b.permission || "") ||
        stableStringify(a.related_capabilities || []).localeCompare(stableStringify(b.related_capabilities || []))
      ),
      missing_auth_claims: (patch.missing_auth_claims || []).sort((/** @type {any} */ a, /** @type {any} */ b) =>
        (a.projection_surface || "").localeCompare(b.projection_surface || "") ||
        (a.claim || "").localeCompare(b.claim || "") ||
        stableStringify(a.related_capabilities || []).localeCompare(stableStringify(b.related_capabilities || []))
      ),
      missing_auth_ownerships: (patch.missing_auth_ownerships || []).sort((/** @type {any} */ a, /** @type {any} */ b) =>
        (a.ownership_field || "").localeCompare(b.ownership_field || "") ||
        stableStringify(a.related_capabilities || []).localeCompare(stableStringify(b.related_capabilities || []))
      ),
      patch_rel_path: `projection-patches/${patch.projection_id}.md`
    }))
    .sort((/** @type {any} */ a, /** @type {any} */ b) => a.projection_id.localeCompare(b.projection_id));
}

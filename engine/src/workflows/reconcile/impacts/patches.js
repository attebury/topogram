// @ts-check
import { stableStringify } from "../../../format.js";
import {
  buildAuthClaimReviewGuidance,
  buildAuthOwnershipReviewGuidance,
  buildAuthPermissionReviewGuidance,
  describeAuthClaimWhyInferred,
  describeAuthOwnershipWhyInferred,
  describeAuthPermissionWhyInferred
} from "../auth.js";

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

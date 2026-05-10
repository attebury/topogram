// @ts-check
import { confidenceRank } from "../../docs.js";
import {
  buildAuthRoleReviewGuidance,
  formatAuthRoleFollowupInline
} from "./formatters.js";

/** @param {CandidateBundle} bundle @returns {any} */
export function inferBundleAuthRoleGuidance(bundle) {
  const roles = bundle.roles || [];
  if (roles.length === 0) {
    return [];
  }
  const authSensitiveCapabilities = new Set([
    ...(bundle.authPermissionHints || []).flatMap((/** @type {any} */ hint) => hint.related_capabilities || []),
    ...(bundle.authClaimHints || []).flatMap((/** @type {any} */ hint) => hint.related_capabilities || []),
    ...(bundle.authOwnershipHints || []).flatMap((/** @type {any} */ hint) => hint.related_capabilities || [])
  ]);
  const claimPreferredRoles = new Set(
    (bundle.authClaimHints || []).flatMap((/** @type {any} */ hint) => {
      if (hint.claim === "reviewer") return ["role_reviewer"];
      if (hint.claim === "tenant") return ["role_admin", "role_manager"];
      return [];
    })
  );
  const ownershipPreferredRoles = new Set(
    (bundle.authOwnershipHints || []).flatMap((/** @type {any} */ hint) => {
      if (hint.ownership_field === "owner_id") return ["role_owner"];
      if (hint.ownership_field === "assignee_id") return ["role_assignee"];
      return [];
    })
  );

  return roles
    .map((/** @type {any} */ role) => {
      const relatedCapabilities = [...new Set((role.related_capabilities || []).filter((/** @type {any} */ capabilityId) => authSensitiveCapabilities.has(capabilityId)))];
      const directRoleMatch = claimPreferredRoles.has(role.id_hint) || ownershipPreferredRoles.has(role.id_hint);
      if (!directRoleMatch && relatedCapabilities.length === 0) {
        return null;
      }
      /** @type {any[]} */
      const reasonParts = [];
      if (directRoleMatch) {
        reasonParts.push("role naming lines up with inferred auth semantics");
      }
      if (relatedCapabilities.length > 0) {
        reasonParts.push(`${relatedCapabilities.length} related auth-sensitive capability match${relatedCapabilities.length === 1 ? "" : "es"}`);
      }
      return {
        role_id: role.id_hint,
        confidence: role.confidence || "low",
        related_capabilities: relatedCapabilities.sort(),
        related_docs: [...new Set(role.related_docs || [])].sort(),
        why_inferred: `Imported role evidence suggests \`${role.id_hint}\` is likely part of the recovered auth story because ${reasonParts.join(" and ")}.`,
        review_guidance: buildAuthRoleReviewGuidance({ role_id: role.id_hint })
      };
    })
    .filter(Boolean)
    .sort((/** @type {any} */ a, /** @type {any} */ b) =>
      confidenceRank(b.confidence) - confidenceRank(a.confidence) ||
      (b.related_capabilities.length - a.related_capabilities.length) ||
      a.role_id.localeCompare(b.role_id)
    );
}

/** @param {CandidateBundle} bundle @returns {any} */
export function classifyBundleAuthRoleGuidance(bundle) {
  return (bundle.authRoleGuidance || []).map((/** @type {any} */ entry) => {
    const matchingDocLinks = (bundle.docLinkSuggestions || [])
      .filter((/** @type {any} */ item) => (item.add_related_roles || []).includes(entry.role_id));
    const hasRolePromotion = (bundle.adoptionPlan || [])
      .some((/** @type {any} */ step) => step.action === "promote_role" && step.item === entry.role_id);
    const followupDocIds = matchingDocLinks.map((/** @type {any} */ item) => item.doc_id).sort();
    const followupPatchPaths = matchingDocLinks.map((/** @type {any} */ item) => item.patch_rel_path).filter(Boolean).sort();
    let followupAction = "review_only";
    let followupReason = "Role evidence is still thin enough that this should stay review-only until the participant story is clearer.";
    if (matchingDocLinks.length > 0 && entry.related_capabilities.length === 0) {
      followupAction = "link_role_to_docs";
      followupReason = "Imported docs already exist for this participant signal, and the safer next step is to link the role into those docs before promoting more auth-sensitive changes.";
    } else if (hasRolePromotion && (confidenceRank(entry.confidence) >= confidenceRank("medium") || entry.related_capabilities.length > 0)) {
      followupAction = "promote_role";
      followupReason = "Recovered role evidence is strong enough to promote this role candidate before adopting linked auth-sensitive changes.";
    } else if (matchingDocLinks.length > 0) {
      followupAction = "link_role_to_docs";
      followupReason = "This role already has useful canonical doc anchors, so linking the participant context into docs is the safest next step.";
    }
    const classified = {
      ...entry,
      followup_action: followupAction,
      followup_label: formatAuthRoleFollowupInline({
        ...entry,
        followup_action: followupAction,
        followup_doc_ids: followupDocIds
      }),
      followup_reason: followupReason,
      followup_doc_ids: followupDocIds,
      followup_patch_paths: followupPatchPaths
    };
    return {
      ...classified,
      review_guidance: buildAuthRoleReviewGuidance(classified)
    };
  });
}

/** @param {any[]} docLinkSuggestions @param {any} authRoleGuidance @returns {any} */
export function annotateDocLinkSuggestionsWithAuthRoleGuidance(docLinkSuggestions, authRoleGuidance) {
  const authRoleMap = new Map((authRoleGuidance || []).map((/** @type {any} */ entry) => [entry.role_id, entry]));
  return (docLinkSuggestions || []).map((/** @type {any} */ item) => {
    const authRoleFollowups = [...new Set(item.add_related_roles || [])]
      .map((/** @type {any} */ roleId) => authRoleMap.get(roleId))
      .filter(Boolean)
      .map((/** @type {any} */ entry) => ({
        role_id: entry.role_id,
        followup_action: entry.followup_action,
        followup_label: entry.followup_label
      }));
    return authRoleFollowups.length > 0
      ? { ...item, auth_role_followups: authRoleFollowups }
      : item;
  });
}

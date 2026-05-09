// @ts-check
import { confidenceRank } from "../docs.js";
import { inferCapabilityEntityId, normalizeOpenApiPath } from "../import-app/index.js";
import { idHintify } from "../../text-helpers.js";

/** @param {string} text @param {any[]} patterns @returns {any} */
export function authClaimPatternMatches(text, patterns = []) {
  return patterns.some((/** @type {any} */ pattern) => pattern.test(text));
}

/** @param {any[]} entries @param {any[]} patterns @param {any} toText @returns {any} */
export function collectAuthClaimSignalMatches(entries, patterns, toText) {
  return (entries || []).filter((/** @type {any} */ entry) => authClaimPatternMatches(toText(entry), patterns));
}

/** @param {string} value @returns {any} */
export function formatAuthClaimValueInline(value) {
  return value == null ? "_dynamic_" : `\`${value}\``;
}

/** @param {WorkflowRecord} hint @returns {any} */
export function formatAuthClaimHintInline(hint) {
  return `claim \`${hint.claim}\` = ${formatAuthClaimValueInline(hint.claim_value)} (${hint.confidence})`;
}

/** @param {WorkflowRecord} hint @returns {any} */
export function formatAuthPermissionHintInline(hint) {
  return `permission \`${hint.permission}\` (${hint.confidence})`;
}

/** @param {WorkflowRecord} hint @returns {any} */
export function formatAuthOwnershipHintInline(hint) {
  return `ownership \`${hint.ownership}\` field \`${hint.ownership_field}\` (${hint.confidence})`;
}

/** @param {WorkflowRecord} hint @returns {any} */
export function describeAuthPermissionWhyInferred(hint) {
  /** @type {any[]} */
  const signals = [];
  if (hint?.evidence?.capability_hits) {
    signals.push(`${hint.evidence.capability_hits} secured capability match${hint.evidence.capability_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.route_hits) {
    signals.push(`${hint.evidence.route_hits} route/resource match${hint.evidence.route_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.doc_hits) {
    signals.push(`${hint.evidence.doc_hits} imported doc or policy match${hint.evidence.doc_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.provenance_hits) {
    signals.push(`${hint.evidence.provenance_hits} auth middleware or policy hint${hint.evidence.provenance_hits === 1 ? "" : "s"}`);
  }
  if (signals.length === 0) {
    return hint?.explanation || "Imported auth evidence suggests a permission rule may gate this surface.";
  }
  return `${hint?.explanation || "Imported auth evidence suggests a permission rule may gate this surface."} This inference is based on ${signals.join(", ")}.`;
}

/** @param {WorkflowRecord} hint @returns {any} */
export function buildAuthPermissionReviewGuidance(hint) {
  return `Confirm whether permission \`${hint.permission}\` should gate the related auth-sensitive capabilities before promoting this bundle into canonical auth rules or UI visibility.`;
}

/** @param {WorkflowRecord} hint @returns {any} */
export function describeAuthClaimWhyInferred(hint) {
  /** @type {any[]} */
  const signals = [];
  if (hint?.evidence?.capability_hits) {
    signals.push(`${hint.evidence.capability_hits} secured capability match${hint.evidence.capability_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.route_hits) {
    signals.push(`${hint.evidence.route_hits} route match${hint.evidence.route_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.participant_hits) {
    signals.push(`${hint.evidence.participant_hits} participant match${hint.evidence.participant_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.doc_hits) {
    signals.push(`${hint.evidence.doc_hits} imported doc match${hint.evidence.doc_hits === 1 ? "" : "es"}`);
  }
  if (signals.length === 0) {
    return hint?.explanation || "Imported auth-related evidence suggests this claim may matter here.";
  }
  return `${hint?.explanation || "Imported auth-related evidence suggests this claim may matter here."} This inference is based on ${signals.join(", ")}.`;
}

/** @param {WorkflowRecord} hint @returns {any} */
export function buildAuthClaimReviewGuidance(hint) {
  const claimTarget = `claim \`${hint.claim}\` = ${formatAuthClaimValueInline(hint.claim_value)}`;
  return `Confirm whether ${claimTarget} should gate the related auth-sensitive capabilities before promoting this bundle into canonical auth rules or UI visibility.`;
}

/** @param {WorkflowRecord} hint @returns {any} */
export function describeAuthOwnershipWhyInferred(hint) {
  /** @type {any[]} */
  const signals = [];
  if (hint?.evidence?.field_hits) {
    signals.push(`${hint.evidence.field_hits} ownership-style field match${hint.evidence.field_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.capability_hits) {
    signals.push(`${hint.evidence.capability_hits} secured lifecycle/detail capability match${hint.evidence.capability_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.doc_hits) {
    signals.push(`${hint.evidence.doc_hits} imported doc match${hint.evidence.doc_hits === 1 ? "" : "es"}`);
  }
  if (signals.length === 0) {
    return hint?.explanation || "Imported field and auth evidence suggests ownership-based access control may matter here.";
  }
  return `${hint?.explanation || "Imported field and auth evidence suggests ownership-based access control may matter here."} This inference is based on ${signals.join(", ")}.`;
}

/** @param {WorkflowRecord} hint @returns {any} */
export function buildAuthOwnershipReviewGuidance(hint) {
  return `Confirm whether field \`${hint.ownership_field}\` should drive \`${hint.ownership}\` access for the related auth-sensitive capabilities before promoting this bundle into canonical auth rules or UI visibility.`;
}

/** @param {WorkflowRecord} entry @returns {any} */
export function formatAuthRoleGuidanceInline(entry) {
  return `role \`${entry.role_id}\` (${entry.confidence})`;
}

/** @param {WorkflowRecord} entry @returns {any} */
export function buildAuthRoleReviewGuidance(entry) {
  if (entry.followup_action === "promote_role") {
    return `Promote role \`${entry.role_id}\` first, then confirm it remains the primary participant for the related auth-sensitive capabilities before promoting linked auth changes from this bundle.`;
  }
  if (entry.followup_action === "link_role_to_docs") {
    const docList = (entry.followup_doc_ids || []).length
      ? ` docs ${(entry.followup_doc_ids || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`
      : " the existing canonical docs";
    return `Link role \`${entry.role_id}\` into${docList} before promoting more auth-sensitive changes from this bundle.`;
  }
  return `Confirm whether role \`${entry.role_id}\` should remain the primary participant for the related auth-sensitive capabilities before promoting role or auth changes from this bundle.`;
}

/** @param {WorkflowRecord} entry @returns {any} */
export function formatAuthRoleFollowupInline(entry) {
  if (entry.followup_action === "promote_role") {
    return "promote role";
  }
  if (entry.followup_action === "link_role_to_docs") {
    return entry.followup_doc_ids?.length
      ? `link role to docs ${(entry.followup_doc_ids || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`
      : "link role to docs";
  }
  return "review only";
}

/** @param {any[]} items @returns {any} */
export function summarizeHintClosureState(items) {
  const statuses = (items || []).map((/** @type {any} */ item) => item.status).filter(Boolean);
  if (statuses.length === 0) {
    return {
      closure_state: "unresolved",
      closure_reason: "No reviewed projection patch has been applied for this inferred auth hint yet."
    };
  }
  if (statuses.every((/** @type {any} */ status) => status === "applied")) {
    return {
      closure_state: "adopted",
      closure_reason: "All matching projection patch actions for this inferred auth hint have been applied."
    };
  }
  if (statuses.every((/** @type {any} */ status) => ["applied", "approved", "skipped"].includes(status))) {
    return {
      closure_state: "deferred",
      closure_reason: "This inferred auth hint has been reviewed or intentionally held back, but not every matching projection patch has been applied yet."
    };
  }
  return {
    closure_state: "unresolved",
    closure_reason: "At least one matching projection patch for this inferred auth hint is still blocked on review or waiting to be applied."
  };
}

/** @param {WorkflowRecord} bundle @param {any[]} planItems @returns {any} */
export function annotateBundleAuthHintClosures(bundle, planItems) {
  const bundleItems = (planItems || []).filter((/** @type {any} */ item) => item.bundle === bundle.slug);
  const annotatedPermissions = (bundle.authPermissionHints || []).map((/** @type {any} */ hint) => ({
    ...hint,
    ...summarizeHintClosureState(bundleItems.filter((/** @type {any} */ item) =>
      item.suggested_action === "apply_projection_permission_patch" &&
      item.permission === hint.permission
    ))
  }));
  const annotatedClaims = (bundle.authClaimHints || []).map((/** @type {any} */ hint) => ({
    ...hint,
    ...summarizeHintClosureState(bundleItems.filter((/** @type {any} */ item) =>
      item.suggested_action === "apply_projection_auth_patch" &&
      item.claim === hint.claim &&
      item.claim_value === (Object.prototype.hasOwnProperty.call(hint, "claim_value") ? hint.claim_value : null)
    ))
  }));
  const annotatedOwnerships = (bundle.authOwnershipHints || []).map((/** @type {any} */ hint) => ({
    ...hint,
    ...summarizeHintClosureState(bundleItems.filter((/** @type {any} */ item) =>
      item.suggested_action === "apply_projection_ownership_patch" &&
      item.ownership === hint.ownership &&
      item.ownership_field === hint.ownership_field
    ))
  }));
  return {
    ...bundle,
    authPermissionHints: annotatedPermissions,
    authClaimHints: annotatedClaims,
    authOwnershipHints: annotatedOwnerships
  };
}

/** @param {WorkflowRecord} bundle @returns {any} */
export function buildAuthHintClosureSummary(bundle) {
  const hints = [
    ...(bundle.authPermissionHints || []),
    ...(bundle.authClaimHints || []),
    ...(bundle.authOwnershipHints || [])
  ];
  const counts = hints.reduce(
    (/** @type {any} */ acc, /** @type {any} */ hint) => {
      const state = hint.closure_state || "unresolved";
      if (state === "adopted") {
        acc.adopted += 1;
      } else if (state === "deferred") {
        acc.deferred += 1;
      } else {
        acc.unresolved += 1;
      }
      return acc;
    },
    { total: hints.length, adopted: 0, deferred: 0, unresolved: 0 }
  );
  if (counts.total === 0) {
    return {
      status: "no_auth_hints",
      label: "no auth hints",
      reason: "This bundle does not currently carry inferred permission, claim, or ownership hints.",
      ...counts
    };
  }
  if (counts.unresolved === 0 && counts.deferred === 0) {
    return {
      status: "mostly_closed",
      label: "mostly closed",
      reason: "All inferred auth hints for this bundle have been adopted into canonical projection rules.",
      ...counts
    };
  }
  if (counts.unresolved === 0) {
    return {
      status: "partially_closed",
      label: "partially closed",
      reason: "Every inferred auth hint has been reviewed, but at least one is still intentionally deferred instead of adopted.",
      ...counts
    };
  }
  return {
    status: "high_risk",
    label: "high risk",
    reason: "At least one inferred auth hint is still unresolved, so the recovered auth story for this bundle is not closed yet.",
    ...counts
  };
}

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

/** @param {WorkflowRecord} capability @returns {any} */
export function permissionResourceStemForCapability(capability) {
  const endpointPath = normalizeOpenApiPath(capability?.endpoint?.path || "");
  const pathSegments = endpointPath
    .split("/")
    .filter(Boolean)
    .filter((/** @type {any} */ segment) => segment !== "{}");
  const firstPathSegment = idHintify(pathSegments[0] || "");
  if (firstPathSegment) {
    return firstPathSegment;
  }
  const entityId = String(capability?.entity_id || inferCapabilityEntityId(capability) || "").replace(/^entity_/, "");
  if (!entityId) {
    return "resource";
  }
  return entityId.endsWith("s") ? entityId : `${entityId}s`;
}

/** @param {string} resource @returns {any} */
export function singularizePermissionResource(resource) {
  return String(resource || "").endsWith("s") ? String(resource).slice(0, -1) : String(resource || "");
}

/** @param {WorkflowRecord} capability @param {string} resourceStem @returns {any} */
export function inferPermissionActionForCapability(capability, resourceStem) {
  const capabilityId = String(capability?.id_hint || "");
  const capabilityMatch = capabilityId.match(/^cap_([^_]+)_(.+)$/);
  const resourceSingular = singularizePermissionResource(resourceStem);
  const resourcePrefixes = [resourceStem, resourceSingular].filter(Boolean);
  if (!capabilityMatch) {
    const method = String(capability?.endpoint?.method || "").toUpperCase();
    if (method === "GET") return "read";
    if (method === "POST") return "create";
    if (method === "PATCH" || method === "PUT") return "update";
    if (method === "DELETE") return "delete";
    return null;
  }
  const [, verb, remainder] = capabilityMatch;
  if (verb === "get" || verb === "list") {
    return "read";
  }
  let suffix = remainder;
  for (const prefix of resourcePrefixes) {
    if (suffix === prefix) {
      suffix = "";
      break;
    }
    if (suffix.startsWith(`${prefix}_`)) {
      suffix = suffix.slice(prefix.length + 1);
      break;
    }
  }
  if (!suffix) {
    return verb;
  }
  if (verb === "request") {
    return `request_${suffix}`;
  }
  return ["create", "update", "delete"].includes(verb) ? verb : `${verb}${suffix ? `_${suffix}` : ""}`;
}

/** @param {CandidateBundle} bundle @returns {any} */
export function inferBundleAuthPermissionHints(bundle) {
  const securedCapabilities = (bundle.capabilities || []).filter((/** @type {any} */ entry) => entry.auth_hint === "secured");
  if (securedCapabilities.length === 0) {
    return [];
  }

  const docEntries = bundle.docs || [];
  const grouped = new Map();
  for (const capability of securedCapabilities) {
    const resourceStem = permissionResourceStemForCapability(capability);
    const action = inferPermissionActionForCapability(capability, resourceStem);
    if (!resourceStem || !action) {
      continue;
    }
    const permission = `${resourceStem}.${action}`;
    const docPatterns = [
      new RegExp(`\\b${permission.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
      new RegExp(`\\b${resourceStem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
      new RegExp(`\\b${action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
    ];
    const docMatches = collectAuthClaimSignalMatches(
      docEntries,
      docPatterns,
      (/** @type {any} */ entry) => [entry.id, entry.title, ...(entry.provenance || []), entry.body || ""].filter(Boolean).join(" ")
    );
    const provenanceText = [capability.id_hint, capability.label, capability.endpoint?.path, ...(capability.provenance || [])]
      .filter(Boolean)
      .join(" ");
    const provenanceHits = /\b(permission|policy|scope|authorize|authoriz|allow|guard|access)\b/i.test(provenanceText) ? 1 : 0;
    const existing = grouped.get(permission) || {
      permission,
      confidence: "low",
      review_required: true,
      related_capabilities: [],
      evidence: {
        capability_hits: 0,
        route_hits: 0,
        doc_hits: 0,
        provenance_hits: 0
      },
      explanation: "Secured capability naming and imported route evidence suggest this permission may gate the recovered surface."
    };
    existing.related_capabilities.push(capability.id_hint);
    existing.evidence.capability_hits += 1;
    existing.evidence.route_hits += capability.endpoint?.path ? 1 : 0;
    existing.evidence.doc_hits += docMatches.length;
    existing.evidence.provenance_hits += provenanceHits;
    const confidence = provenanceHits > 0 || docMatches.length > 0 || capability.endpoint?.path ? "medium" : "low";
    if (confidenceRank(confidence) > confidenceRank(existing.confidence)) {
      existing.confidence = confidence;
    }
    grouped.set(permission, existing);
  }

  return [...grouped.values()]
    .map((/** @type {any} */ entry) => ({
      ...entry,
      related_capabilities: [...new Set(entry.related_capabilities)].sort(),
      why_inferred: describeAuthPermissionWhyInferred(entry),
      review_guidance: buildAuthPermissionReviewGuidance(entry)
    }))
    .sort((/** @type {any} */ a, /** @type {any} */ b) => confidenceRank(b.confidence) - confidenceRank(a.confidence) || a.permission.localeCompare(b.permission));
}

/** @param {CandidateBundle} bundle @returns {any} */
export function inferBundleAuthClaimHints(bundle) {
  const securedCapabilities = (bundle.capabilities || []).filter((/** @type {any} */ entry) => entry.auth_hint === "secured");
  if (securedCapabilities.length === 0) {
    return [];
  }

  const candidates = [
    {
      claim: "reviewer",
      claim_value: "true",
      confidenceFloor: "medium",
      capabilityPatterns: [/\breviewer\b/i, /\breview\b/i, /\bapprove\b/i, /\breject\b/i, /\brevision\b/i],
      routePatterns: [/\breviewer\b/i, /\breview\b/i, /\bapprove\b/i, /\breject\b/i, /\brevision\b/i],
      participantPatterns: [/\breviewer\b/i],
      docPatterns: [/\breviewer\b/i, /\breview\b/i, /\bapprove\b/i, /\breject\b/i, /\brevision\b/i],
      explanation: "Review-oriented capability, route, or participant evidence suggests a reviewer claim may gate these actions."
    },
    {
      claim: "tenant",
      claim_value: null,
      confidenceFloor: "low",
      capabilityPatterns: [/\btenant\b/i, /\bworkspace\b/i, /\borganization\b/i, /\borg\b/i],
      routePatterns: [/\btenant\b/i, /\bworkspace\b/i, /\borganization\b/i, /\borg\b/i],
      participantPatterns: [],
      docPatterns: [/\btenant\b/i, /\bworkspace\b/i, /\borganization\b/i, /\borg\b/i],
      explanation: "Tenant or workspace naming suggests a request-scoped claim may be part of access control here."
    }
  ];

  const routeEntries = [...(bundle.uiRoutes || []), ...securedCapabilities];
  const participantEntries = [...(bundle.actors || []), ...(bundle.roles || [])];
  const docEntries = bundle.docs || [];

  return candidates
    .map((/** @type {any} */ candidate) => {
      const capabilityMatches = collectAuthClaimSignalMatches(
        securedCapabilities,
        candidate.capabilityPatterns,
        (/** @type {any} */ entry) => [entry.id_hint, entry.label, entry.endpoint?.path, ...(entry.provenance || [])].filter(Boolean).join(" ")
      );
      const routeMatches = collectAuthClaimSignalMatches(
        routeEntries,
        candidate.routePatterns,
        (/** @type {any} */ entry) => [entry.path, entry.route_path, entry.id_hint, entry.label, ...(entry.provenance || [])].filter(Boolean).join(" ")
      );
      const participantMatches = collectAuthClaimSignalMatches(
        participantEntries,
        candidate.participantPatterns,
        (/** @type {any} */ entry) => [entry.id_hint, entry.label, ...(entry.provenance || [])].filter(Boolean).join(" ")
      );
      const docMatches = collectAuthClaimSignalMatches(
        docEntries,
        candidate.docPatterns,
        (/** @type {any} */ entry) => [entry.id, entry.title, ...(entry.provenance || []), entry.body || ""].filter(Boolean).join(" ")
      );
      const signalCount = [
        capabilityMatches.length > 0,
        routeMatches.length > 0,
        participantMatches.length > 0,
        docMatches.length > 0
      ].filter(Boolean).length;

      if (signalCount === 0) {
        return null;
      }
      if (candidate.claim === "reviewer" && signalCount < 2) {
        return null;
      }

      const confidence =
        participantMatches.length > 0 || (capabilityMatches.length > 0 && routeMatches.length > 0)
          ? candidate.confidenceFloor
          : "low";

      return {
        claim: candidate.claim,
        claim_value: candidate.claim_value,
        confidence,
        review_required: true,
        related_capabilities: [...new Set(capabilityMatches.map((/** @type {any} */ entry) => entry.id_hint))].sort(),
        evidence: {
          capability_hits: capabilityMatches.length,
          route_hits: routeMatches.length,
          participant_hits: participantMatches.length,
          doc_hits: docMatches.length
        },
        explanation: candidate.explanation,
        why_inferred: describeAuthClaimWhyInferred({
          claim: candidate.claim,
          claim_value: candidate.claim_value,
          explanation: candidate.explanation,
          evidence: {
            capability_hits: capabilityMatches.length,
            route_hits: routeMatches.length,
            participant_hits: participantMatches.length,
            doc_hits: docMatches.length
          }
        }),
        review_guidance: buildAuthClaimReviewGuidance({
          claim: candidate.claim,
          claim_value: candidate.claim_value
        })
      };
    })
    .filter(Boolean)
    .sort((/** @type {any} */ a, /** @type {any} */ b) => confidenceRank(b.confidence) - confidenceRank(a.confidence) || a.claim.localeCompare(b.claim));
}

/** @param {CandidateBundle} bundle @returns {any} */
export function inferBundleAuthOwnershipHints(bundle) {
  const securedCapabilities = (bundle.capabilities || []).filter((/** @type {any} */ entry) => entry.auth_hint === "secured");
  if (securedCapabilities.length === 0) {
    return [];
  }

  const entityFieldEntries = ((bundle.importedFieldEvidence || []).length > 0 ? bundle.importedFieldEvidence : (bundle.entities || []).flatMap((/** @type {any} */ entity) => (entity.fields || []).map((/** @type {any} */ field) => ({
    entity_id: entity.id_hint,
    name: field.name,
    field_type: field.field_type,
    required: field.required
  }))));
  const docEntries = bundle.docs || [];
  const ownershipScopedCapabilities = securedCapabilities.filter((/** @type {any} */ entry) =>
    /^cap_(get|update|close|complete|archive|delete|submit|request|approve|reject)_/.test(entry.id_hint || "")
  );
  if (entityFieldEntries.length === 0 || ownershipScopedCapabilities.length === 0) {
    return [];
  }

  const candidates = [
    {
      ownership: "owner_or_admin",
      ownership_field: "owner_id",
      confidenceFloor: "medium",
      fieldPatterns: [/^owner_id$/i, /^author_id$/i],
      docPatterns: [/\bowner\b/i, /\bauthor\b/i],
      explanation: "Ownership-style field naming suggests this bundle may authorize detail or lifecycle actions based on resource ownership."
    },
    {
      ownership: "owner_or_admin",
      ownership_field: "assignee_id",
      confidenceFloor: "medium",
      fieldPatterns: [/^assignee_id$/i],
      docPatterns: [/\bassignee\b/i, /\bassigned\b/i],
      explanation: "Assignment-style field naming suggests this bundle may authorize detail or lifecycle actions based on the assigned user."
    }
  ];

  return candidates
    .map((/** @type {any} */ candidate) => {
      const fieldMatches = entityFieldEntries.filter((/** @type {any} */ entry) => candidate.fieldPatterns.some((/** @type {any} */ pattern) => pattern.test(entry.name || "")));
      const docMatches = collectAuthClaimSignalMatches(
        docEntries,
        candidate.docPatterns,
        (/** @type {any} */ entry) => [entry.id, entry.title, ...(entry.provenance || []), entry.body || ""].filter(Boolean).join(" ")
      );
      if (fieldMatches.length === 0) {
        return null;
      }
      const relatedCapabilities = ownershipScopedCapabilities.map((/** @type {any} */ entry) => entry.id_hint).sort();
      const evidence = {
        field_hits: fieldMatches.length,
        capability_hits: relatedCapabilities.length,
        doc_hits: docMatches.length
      };
      return {
        ownership: candidate.ownership,
        ownership_field: candidate.ownership_field,
        confidence: candidate.confidenceFloor,
        review_required: true,
        related_capabilities: relatedCapabilities,
        related_entities: [...new Set(fieldMatches.map((/** @type {any} */ entry) => entry.entity_id))].sort(),
        evidence,
        explanation: candidate.explanation,
        why_inferred: describeAuthOwnershipWhyInferred({
          ownership: candidate.ownership,
          ownership_field: candidate.ownership_field,
          explanation: candidate.explanation,
          evidence
        }),
        review_guidance: buildAuthOwnershipReviewGuidance({
          ownership: candidate.ownership,
          ownership_field: candidate.ownership_field
        })
      };
    })
    .filter(Boolean)
    .sort((/** @type {any} */ a, /** @type {any} */ b) => confidenceRank(b.confidence) - confidenceRank(a.confidence) || a.ownership_field.localeCompare(b.ownership_field));
}

// @ts-check

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

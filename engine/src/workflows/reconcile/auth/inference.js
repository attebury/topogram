// @ts-check
import { confidenceRank } from "../../docs.js";
import { inferCapabilityEntityId, normalizeOpenApiPath } from "../../import-app/index.js";
import { idHintify } from "../../../text-helpers.js";
import {
  buildAuthClaimReviewGuidance,
  buildAuthOwnershipReviewGuidance,
  buildAuthPermissionReviewGuidance,
  collectAuthClaimSignalMatches,
  describeAuthClaimWhyInferred,
  describeAuthOwnershipWhyInferred,
  describeAuthPermissionWhyInferred
} from "./formatters.js";

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

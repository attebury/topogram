// @ts-check

import {
  DOC_ARRAY_FIELDS,
  DOC_CONFIDENCE,
  DOC_KINDS,
  DOC_REFERENCE_FIELDS,
  DOC_STATUSES
} from "../workspace-docs.js";
import { IDENTIFIER_PATTERN } from "./kinds.js";
import { pushError } from "./utils.js";

/**
 * @param {import("../parser.js").WorkspaceAst} workspaceAst
 * @param {TopogramRegistry} registry
 * @param {ValidationErrors} errors
 * @returns {void}
 */
export function validateDocs(workspaceAst, registry, errors) {
  const docs = workspaceAst.docs || [];
  const docRegistry = new Map();

  for (const doc of docs) {
    if (doc.parseError) {
      pushError(errors, doc.parseError.message, doc.parseError.loc);
      continue;
    }

    const { metadata } = doc;
    for (const required of ["id", "kind", "title", "status"]) {
      if (!metadata[required]) {
        pushError(errors, `Missing required doc metadata '${required}'`, doc.loc);
      }
    }

    if (metadata.id && !IDENTIFIER_PATTERN.test(metadata.id)) {
      pushError(errors, `Invalid doc identifier '${metadata.id}'`, doc.loc);
    }

    if (metadata.kind && !DOC_KINDS.has(metadata.kind)) {
      pushError(errors, `Unsupported doc kind '${metadata.kind}'`, doc.loc);
    }

    if (metadata.status && !DOC_STATUSES.has(metadata.status)) {
      pushError(errors, `Unsupported doc status '${metadata.status}'`, doc.loc);
    }

    if (metadata.confidence && !DOC_CONFIDENCE.has(metadata.confidence)) {
      pushError(errors, `Unsupported doc confidence '${metadata.confidence}'`, doc.loc);
    }

    if (metadata.review_required != null && typeof metadata.review_required !== "boolean") {
      pushError(errors, "Doc metadata 'review_required' must be a boolean", doc.loc);
    }

    for (const key of DOC_ARRAY_FIELDS) {
      if (metadata[key] != null && !Array.isArray(metadata[key])) {
        pushError(errors, `Doc metadata '${key}' must be a list`, doc.loc);
      }
    }

    if (metadata.id) {
      if (docRegistry.has(metadata.id)) {
        pushError(errors, `Duplicate doc id '${metadata.id}'`, doc.loc);
      } else {
        docRegistry.set(metadata.id, doc);
      }
    }
  }

  for (const doc of docs) {
    if (doc.parseError) {
      continue;
    }
    const { metadata } = doc;

    for (const entityId of metadata.related_entities || []) {
      const statement = registry.get(entityId);
      if (!statement || statement.kind !== "entity") {
        pushError(errors, `Doc '${metadata.id}' references missing entity '${entityId}'`, doc.loc);
      }
    }

    for (const capabilityId of metadata.related_capabilities || []) {
      const statement = registry.get(capabilityId);
      if (!statement || statement.kind !== "capability") {
        pushError(errors, `Doc '${metadata.id}' references missing capability '${capabilityId}'`, doc.loc);
      }
    }

    for (const actorId of metadata.related_actors || []) {
      const statement = registry.get(actorId);
      if (!statement || statement.kind !== "actor") {
        pushError(errors, `Doc '${metadata.id}' references missing actor '${actorId}'`, doc.loc);
      }
    }

    for (const roleId of metadata.related_roles || []) {
      const statement = registry.get(roleId);
      if (!statement || statement.kind !== "role") {
        pushError(errors, `Doc '${metadata.id}' references missing role '${roleId}'`, doc.loc);
      }
    }

    for (const ruleId of metadata.related_rules || []) {
      const statement = registry.get(ruleId);
      if (!statement || statement.kind !== "rule") {
        pushError(errors, `Doc '${metadata.id}' references missing rule '${ruleId}'`, doc.loc);
      }
    }

    for (const workflowDocId of metadata.related_workflows || []) {
      const relatedDoc = docRegistry.get(workflowDocId);
      if (!relatedDoc || relatedDoc.metadata.kind !== "workflow") {
        pushError(errors, `Doc '${metadata.id}' references missing workflow doc '${workflowDocId}'`, doc.loc);
      }
    }

    for (const decisionId of metadata.related_decisions || []) {
      const statement = registry.get(decisionId);
      if (!statement || statement.kind !== "decision") {
        pushError(errors, `Doc '${metadata.id}' references missing decision '${decisionId}'`, doc.loc);
      }
    }

    for (const shapeId of metadata.related_shapes || []) {
      const statement = registry.get(shapeId);
      if (!statement || statement.kind !== "shape") {
        pushError(errors, `Doc '${metadata.id}' references missing shape '${shapeId}'`, doc.loc);
      }
    }

    for (const projectionId of metadata.related_projections || []) {
      const statement = registry.get(projectionId);
      if (!statement || statement.kind !== "projection") {
        pushError(errors, `Doc '${metadata.id}' references missing projection '${projectionId}'`, doc.loc);
      }
    }

    for (const relatedDocId of metadata.related_docs || []) {
      if (!docRegistry.has(relatedDocId)) {
        pushError(errors, `Doc '${metadata.id}' references missing doc '${relatedDocId}'`, doc.loc);
      }
    }

    for (const [fieldName, expectedKind] of Object.entries(DOC_REFERENCE_FIELDS)) {
      const value = metadata[fieldName];
      if (value == null) continue;
      if (typeof value !== "string") {
        pushError(errors, `Doc metadata '${fieldName}' must be a single id`, doc.loc);
        continue;
      }
      const target = registry.get(value);
      if (!target) {
        pushError(errors, `Doc '${metadata.id}' references missing ${expectedKind} '${value}'`, doc.loc);
        continue;
      }
      if (target.kind !== expectedKind) {
        pushError(
          errors,
          `Doc '${metadata.id}' ${fieldName} must reference a ${expectedKind}, found ${target.kind} '${target.id}'`,
          doc.loc
        );
      }
    }
  }
}

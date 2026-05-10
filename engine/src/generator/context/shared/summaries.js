import {
  defaultOwnershipBoundary,
  reviewBoundaryForCapability as reviewBoundaryForCapabilityPolicy,
  reviewBoundaryForEntity as reviewBoundaryForEntityPolicy,
  reviewBoundaryForJourneyDoc as reviewBoundaryForJourneyDocPolicy,
  reviewBoundaryForProjection as reviewBoundaryForProjectionPolicy,
  reviewBoundaryForWorkflowDoc as reviewBoundaryForWorkflowDocPolicy
} from "../../../policy/review-boundaries.js";
import { docIds, refIds, stableSortedStrings } from "./primitives.js";

/**
 * @param {any} field
 * @returns {any}
 */
export function summarizeField(field) {
  return {
    name: field.name || null,
    type: field.fieldType || null,
    requiredness: field.requiredness || null,
    defaultValue: field.defaultValue ?? null
  };
}

/**
 * @param {any} projection
 * @returns {any}
 */
export function summarizeProjection(projection) {
  return {
    id: projection.id,
    kind: projection.kind,
    name: projection.name || projection.id,
    description: projection.description || null,
    type: projection.type || null,
    realizes: refIds(projection.realizes),
    outputs: stableSortedStrings(projection.outputs || []),
    uiScreens: stableSortedStrings((projection.uiScreens || []).map(/** @param {any} screen */ (screen) => screen.id)),
    widgetBindings: stableSortedStrings((projection.widgetBindings || []).map(/** @param {any} entry */ (entry) => entry.widget?.id).filter(Boolean)),
    dbTables: stableSortedStrings((projection.dbTables || []).map(/** @param {any} table */ (table) => table.table || table.entity?.id)),
    httpCapabilities: stableSortedStrings((projection.http || []).map(/** @param {any} entry */ (entry) => entry.capability?.id)),
    reviewBoundary: reviewBoundaryForProjectionPolicy(projection),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {any} rule
 * @returns {any}
 */
export function summarizeRule(rule) {
  return {
    id: rule.id,
    kind: rule.kind,
    name: rule.name || rule.id,
    description: rule.description || null,
    appliesTo: refIds(rule.appliesTo),
    actors: refIds(rule.actors),
    roles: refIds(rule.roles),
    severity: rule.severity || null,
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {any} verification
 * @returns {any}
 */
export function summarizeVerification(verification) {
  return {
    id: verification.id,
    kind: verification.kind,
    name: verification.name || verification.id,
    description: verification.description || null,
    method: verification.method || null,
    validates: refIds(verification.validates),
    scenarios: stableSortedStrings(verification.scenarios || []),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {import("./types.d.ts").ContextDoc} doc
 * @returns {any}
 */
export function summarizeJourneyDoc(doc) {
  return {
    id: doc.id,
    kind: doc.kind,
    title: doc.title || doc.id,
    summary: doc.summary || null,
    relatedCapabilities: stableSortedStrings(doc.relatedCapabilities || []),
    relatedWorkflows: stableSortedStrings(doc.relatedWorkflows || []),
    relatedProjections: stableSortedStrings(doc.relatedProjections || []),
    reviewRequired: Boolean(doc.reviewRequired),
    reviewBoundary: doc.kind === "workflow" ? reviewBoundaryForWorkflowDocPolicy(doc) : reviewBoundaryForJourneyDocPolicy(doc),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {import("./types.d.ts").ContextStatement} statement
 * @returns {any}
 */
export function summarizeComponent(statement) {
  return {
    id: statement.id,
    kind: statement.kind,
    name: statement.name || statement.id,
    description: statement.description || null,
    category: statement.category || null,
    version: statement.version || null,
    status: statement.status || null,
    props: (statement.props || []).map(/** @param {any} prop */ (prop) => ({
      name: prop.name ?? null,
      type: prop.fieldType ?? null,
      requiredness: prop.requiredness ?? null,
      defaultValue: prop.defaultValue ?? null
    })),
    events: (statement.events || []).map(/** @param {any} event */ (event) => ({
      id: event.id ?? null,
      shape: event.shape?.id ?? null
    })),
    slots: (statement.slots || []).map(/** @param {any} slot */ (slot) => ({
      id: slot.id ?? null,
      description: slot.description ?? null
    })),
    behavior: stableSortedStrings(statement.behavior || []),
    behaviors: (statement.behaviors || []).map(/** @param {any} behavior */ (behavior) => ({
      kind: behavior.kind || null,
      directives: behavior.directives || {},
      source: behavior.source || null
    })),
    patterns: stableSortedStrings(statement.patterns || []),
    regions: stableSortedStrings(statement.regions || []),
    approvals: stableSortedStrings(statement.approvals || []),
    lookups: refIds(statement.lookups),
    dependencies: refIds(statement.dependencies),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {import("./types.d.ts").ContextStatement} statement
 * @returns {any}
 */
export function summarizeStatement(statement) {
  switch (statement.kind) {
    case "entity":
      return {
        id: statement.id,
        kind: statement.kind,
        name: statement.name || statement.id,
        description: statement.description || null,
        fields: (statement.fields || []).map(summarizeField),
        relations: (statement.relations || []).map(/** @param {any} relation */ (relation) => ({
          type: relation.type || null,
          sourceField: relation.sourceField || null,
          target: relation.target?.id || null
        })),
        keys: stableSortedStrings((statement.keys || []).map(/** @param {any} key */ (key) => key.name)),
        reviewBoundary: reviewBoundaryForEntityPolicy(statement),
        ownership_boundary: defaultOwnershipBoundary()
      };
    case "widget":
      return summarizeComponent(statement);
    case "shape":
      return {
        id: statement.id,
        kind: statement.kind,
        name: statement.name || statement.id,
        description: statement.description || null,
        derivedFrom: refIds(statement.derivedFrom),
        include: stableSortedStrings(statement.include || []),
        exclude: stableSortedStrings(statement.exclude || []),
        fields: (statement.projectedFields || statement.fields || []).map(summarizeField),
        ownership_boundary: defaultOwnershipBoundary()
      };
    case "capability":
      return {
        id: statement.id,
        kind: statement.kind,
        name: statement.name || statement.id,
        description: statement.description || null,
        actors: refIds(statement.actors),
        roles: refIds(statement.roles),
        reads: refIds(statement.reads),
        creates: refIds(statement.creates),
        updates: refIds(statement.updates),
        deletes: refIds(statement.deletes),
        input: refIds(statement.input),
        output: refIds(statement.output),
        reviewBoundary: reviewBoundaryForCapabilityPolicy(statement),
        ownership_boundary: defaultOwnershipBoundary()
      };
    case "rule":
      return summarizeRule(statement);
    case "projection":
      return summarizeProjection(statement);
    case "verification":
      return summarizeVerification(statement);
    case "enum":
      return {
        id: statement.id,
        kind: statement.kind,
        name: statement.name || statement.id,
        values: stableSortedStrings(statement.values || []),
        ownership_boundary: defaultOwnershipBoundary()
      };
    case "actor":
    case "role":
      return {
        id: statement.id,
        kind: statement.kind,
        name: statement.name || statement.id,
        description: statement.description || null,
        ownership_boundary: defaultOwnershipBoundary()
      };
    default:
      return {
        id: statement.id,
        kind: statement.kind,
        name: statement.name || statement.id,
        description: statement.description || null,
        ownership_boundary: defaultOwnershipBoundary()
      };
  }
}

/**
 * @param {any} capability
 * @returns {any}
 */
export function reviewBoundaryForCapability(capability) {
  return reviewBoundaryForCapabilityPolicy(capability);
}

/**
 * @param {any} projection
 * @returns {any}
 */
export function reviewBoundaryForProjection(projection) {
  return reviewBoundaryForProjectionPolicy(projection);
}

/**
 * @param {any} entity
 * @returns {any}
 */
export function reviewBoundaryForEntity(entity) {
  return reviewBoundaryForEntityPolicy(entity);
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @returns {any}
 */
export function graphCounts(graph) {
  return Object.fromEntries(
    Object.entries(graph.byKind || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([kind, statements]) => [kind, statements.length])
  );
}

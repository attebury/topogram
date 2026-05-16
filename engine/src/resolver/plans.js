import { parseReferenceNodes, parseSymbolNodes } from "./shared.js";

export function buildCapabilityFlow(statement) {
  const effects = [];

  for (const [kind, refs] of [
    ["read", statement.reads],
    ["create", statement.creates],
    ["update", statement.updates],
    ["delete", statement.deletes]
  ]) {
    for (const ref of refs) {
      effects.push({
        type: "effect",
        action: kind,
        target: ref.target || { id: ref.id, kind: null }
      });
    }
  }

  return {
    type: "capability_flow",
    actors: parseReferenceNodes(statement.actors),
    roles: parseReferenceNodes(statement.roles),
    effects,
    contracts: {
      input: statement.input.map((ref) => ref.target || { id: ref.id, kind: null }),
      output: statement.output.map((ref) => ref.target || { id: ref.id, kind: null })
    }
  };
}

export function buildRulePolicy(statement) {
  return {
    type: "policy",
    appliesTo: statement.appliesTo.map((ref) => ref.target || { id: ref.id, kind: null }),
    actors: statement.actors.map((ref) => ref.target || { id: ref.id, kind: null }),
    roles: statement.roles.map((ref) => ref.target || { id: ref.id, kind: null }),
    condition: statement.conditionNode,
    requirement: statement.requirementNode,
    severity: statement.severity,
    sourceOfTruth: statement.sourceOfTruth.map((ref) => ref.target || { id: ref.id, kind: null })
  };
}

export function buildDecisionRecord(statement) {
  return {
    type: "decision_record",
    context: parseSymbolNodes(statement.context),
    consequences: parseSymbolNodes(statement.consequences),
    status: statement.status
  };
}

export function buildProjectionPlan(statement) {
  return {
    type: "projection_plan",
    projectionType: statement.type,
    realizes: statement.realizes.map((ref, index) => ({
      order: index,
      target: ref.target || { id: ref.id, kind: null }
    })),
    outputs: parseSymbolNodes(statement.outputs),
    endpoints: statement.http,
    errorResponses: statement.httpErrors,
    wireFields: statement.httpFields,
    responses: statement.httpResponses,
    preconditions: statement.httpPreconditions,
    idempotency: statement.httpIdempotency,
    cache: statement.httpCache,
    deleteSemantics: statement.httpDelete,
    asyncJobs: statement.httpAsync,
    asyncStatus: statement.httpStatus,
    downloads: statement.httpDownload,
    authorization: statement.httpAuthz,
    callbacks: statement.httpCallbacks,
    screens: statement.uiScreens,
    collectionViews: statement.uiCollections,
    screenActions: statement.uiActions,
    visibilityRules: statement.uiVisibility,
    fieldLookups: statement.uiLookups,
    screenRoutes: statement.uiRoutes,
    webHints: statement.uiWeb,
    iosHints: statement.uiIos,
    appShell: statement.uiAppShell,
    designTokens: statement.uiDesign,
    navigation: statement.uiNavigation,
    screenRegions: statement.uiScreenRegions,
    widgetBindings: statement.widgetBindings,
    tables: statement.dbTables,
    columns: statement.dbColumns,
    keys: statement.dbKeys,
    indexes: statement.dbIndexes,
    relations: statement.dbRelations,
    lifecycle: statement.dbLifecycle,
    http: statement.http,
    httpErrors: statement.httpErrors,
    httpFields: statement.httpFields,
    httpResponses: statement.httpResponses,
    httpPreconditions: statement.httpPreconditions,
    httpIdempotency: statement.httpIdempotency,
    httpCache: statement.httpCache,
    httpDelete: statement.httpDelete,
    httpAsync: statement.httpAsync,
    httpStatus: statement.httpStatus,
    httpDownload: statement.httpDownload,
    httpAuthz: statement.httpAuthz,
    httpCallbacks: statement.httpCallbacks,
    uiScreens: statement.uiScreens,
    uiCollections: statement.uiCollections,
    uiActions: statement.uiActions,
    uiVisibility: statement.uiVisibility,
    uiRoutes: statement.uiRoutes,
    uiWeb: statement.uiWeb,
    uiDesign: statement.uiDesign,
    dbTables: statement.dbTables,
    dbColumns: statement.dbColumns,
    dbKeys: statement.dbKeys,
    dbIndexes: statement.dbIndexes,
    dbRelations: statement.dbRelations,
    dbLifecycle: statement.dbLifecycle,
    generatorDefaults: statement.generatorDefaults
  };
}

export function buildVerificationPlan(statement) {
  return {
    type: "verification_plan",
    method: statement.method,
    validates: statement.validates.map((ref, index) => ({
      order: index,
      target: ref.target || { id: ref.id, kind: null }
    })),
    scenarios: parseSymbolNodes(statement.scenarios)
  };
}

export function buildOperationMonitoring(statement) {
  return {
    type: "operation_monitoring",
    observes: statement.observes.map((ref, index) => ({
      order: index,
      target: ref.target || { id: ref.id, kind: null }
    })),
    metrics: parseSymbolNodes(statement.metrics),
    alerts: parseSymbolNodes(statement.alerts)
  };
}

export function buildOrchestrationPlan(statement) {
  return {
    type: "orchestration_plan",
    inputs: statement.inputs.map((ref, index) => ({
      order: index,
      target: ref.target || { id: ref.id, kind: null }
    })),
    steps: parseSymbolNodes(statement.steps),
    outputs: parseSymbolNodes(statement.outputs)
  };
}

export function buildTermVocabulary(statement) {
  return {
    type: "term_vocabulary",
    category: statement.category || null,
    aliases: parseSymbolNodes(statement.aliases),
    excludes: parseSymbolNodes(statement.excludes),
    relatedTerms: parseReferenceNodes(statement.relatedTerms || [])
  };
}

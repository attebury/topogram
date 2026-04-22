export const APP_TARGETS = new Set([
  "ui-contract-graph",
  "ui-contract-debug",
  "ui-web-contract",
  "ui-web-debug",
  "sveltekit-app",
  "server-contract",
  "persistence-scaffold",
  "hono-server",
  "express-server"
]);

function indexStatements(graph) {
  const byId = new Map();
  for (const statement of graph.statements) {
    byId.set(statement.id, statement);
  }
  return byId;
}

export function getProjection(graph, projectionId) {
  const byId = indexStatements(graph);
  const projection = byId.get(projectionId);
  if (!projection || projection.kind !== "projection") {
    throw new Error(`No projection found with id '${projectionId}'`);
  }
  return projection;
}

export function uiProjectionCandidates(graph) {
  return (graph.byKind.projection || []).filter(
    (projection) =>
      (projection.uiScreens || []).length > 0 ||
      (projection.uiCollections || []).length > 0 ||
      (projection.uiActions || []).length > 0 ||
      (projection.uiVisibility || []).length > 0 ||
      (projection.uiLookups || []).length > 0 ||
      (projection.uiAppShell || []).length > 0 ||
      (projection.uiNavigation || []).length > 0 ||
      (projection.uiScreenRegions || []).length > 0
  );
}

export function generatorDefaultsMap(projection) {
  const defaults = {};
  for (const entry of projection.generatorDefaults || []) {
    if (entry.key && entry.value != null) {
      defaults[entry.key] = entry.value;
    }
  }
  return defaults;
}

export function sharedUiProjectionForWeb(graph, projection) {
  const byId = indexStatements(graph);
  for (const ref of projection.realizes || []) {
    const target = byId.get(ref.id);
    if (target?.kind === "projection" && (target.uiScreens || []).length > 0) {
      return target;
    }
  }
  return null;
}

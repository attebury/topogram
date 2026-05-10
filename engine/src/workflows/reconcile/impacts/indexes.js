// @ts-check

/** @param {any[]} fields @returns {any} */
export function shapeFieldSignature(fields) {
  return [...new Set((fields || [])
    .map((field) => typeof field === "string" ? field : field?.name)
    .filter(Boolean))]
    .sort()
    .join("|");
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

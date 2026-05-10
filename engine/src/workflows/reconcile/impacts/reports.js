// @ts-check

/** @param {CandidateBundle} bundle @param {ProjectionImpact[]} projectionIndex @returns {any} */
export function buildProjectionImpacts(bundle, projectionIndex) {
  const bundleEntityIds = new Set([
    bundle.mergeHints?.canonicalEntityTarget || null,
    ...bundle.entities.map((/** @type {any} */ entry) => entry.id_hint)
  ].filter(Boolean));
  if (bundle.capabilities.length === 0 || bundleEntityIds.size === 0) {
    return [];
  }
  return projectionIndex
    .filter((/** @type {any} */ projection) => projection.kind === "api" || projection.kind === "ui")
    .filter((/** @type {any} */ projection) => projection.entityIds.some((/** @type {any} */ entityId) => bundleEntityIds.has(entityId)))
    .map((/** @type {any} */ projection) => {
      const missingCapabilities = bundle.capabilities
        .map((/** @type {any} */ entry) => entry.id_hint)
        .filter((/** @type {any} */ id) => !projection.realizes.includes(id));
      if (missingCapabilities.length === 0) {
        return null;
      }
      return {
        projection_id: projection.id,
        projection_type: projection.type,
        kind: projection.kind,
        missing_capabilities: missingCapabilities,
        reason: `Projection ${projection.id} already covers the same entity surface but does not realize these imported capabilities.`
      };
    })
    .filter(Boolean)
    .sort((/** @type {any} */ a, /** @type {any} */ b) => a.projection_id.localeCompare(b.projection_id));
}

/** @param {CandidateBundle} bundle @param {ResolvedGraph} graph @returns {any} */
export function buildUiImpacts(bundle, graph) {
  if ((bundle.screens || []).length === 0) {
    return [];
  }
  const uiProjections = (graph?.byKind.projection || []).filter((/** @type {any} */ projection) => ["ui_contract", "web_surface"].includes(projection.type));
  const bundleScreenIds = bundle.screens.map((/** @type {any} */ screen) => screen.id_hint);
  return uiProjections
    .map((/** @type {any} */ projection) => {
      const projectionScreens = new Set((projection.uiScreens || []).map((/** @type {any} */ screen) => screen.id));
      const missingScreens = bundleScreenIds.filter((/** @type {any} */ screenId) => !projectionScreens.has(screenId));
      if (missingScreens.length === 0) {
        return null;
      }
      return {
        projection_id: projection.id,
        kind: "ui",
        projection_type: projection.type,
        missing_screens: missingScreens,
        reason: `UI projection ${projection.id} does not currently represent these imported screens.`
      };
    })
    .filter(Boolean)
    .sort((/** @type {any} */ a, /** @type {any} */ b) => a.projection_id.localeCompare(b.projection_id));
}

/** @param {CandidateBundle} bundle @param {ResolvedGraph} graph @returns {any} */
export function buildWorkflowImpacts(bundle, graph) {
  if ((bundle.workflows || []).length === 0) {
    return [];
  }
  const canonicalWorkflowDocs = new Set((graph?.docs || []).filter((/** @type {any} */ doc) => doc.kind === "workflow").map((/** @type {any} */ doc) => doc.id));
  const impacted = bundle.workflows
    .map((/** @type {any} */ workflow) => workflow.id_hint)
    .filter((/** @type {any} */ id) => !canonicalWorkflowDocs.has(id));
  if (impacted.length === 0) {
    return [];
  }
  return [
    {
      review_group_id: `workflow_review:${bundle.slug}`,
      kind: "workflow",
      items: impacted,
      reason: `Workflow semantics for ${bundle.slug} need canonical review before promotion.`
    }
  ];
}

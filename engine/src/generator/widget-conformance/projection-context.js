// @ts-check

import { sharedUiProjectionForWeb } from "../surfaces/shared.js";

/**
 * @param {any} entries
 * @returns {any}
 */
export function byId(entries = []) {
  return new Map(entries.map(/** @param {any} entry */ (entry) => [entry.id, entry]));
}

/**
 * @param {any} values
 * @returns {any}
 */
export function stableUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

/**
 * @param {any} entry
 * @returns {any}
 */
export function sourcePath(entry) {
  return entry?.loc?.file || null;
}

/**
 * @param {any} widget
 * @returns {any}
 */
export function widgetContract(widget) {
  return widget?.widgetContract || null;
}

/**
 * @param {any} projection
 * @returns {any}
 */
export function summarizeProjection(projection) {
  return projection
    ? {
        id: projection.id,
        name: projection.name || projection.id,
        type: projection.type || projection.type || null,
        status: projection.status || null,
        source_path: sourcePath(projection)
      }
    : null;
}

/**
 * @param {any} widget
 * @returns {any}
 */
export function summarizeWidget(widget) {
  return widget
    ? {
        id: widget.id,
        name: widget.name || widget.id,
        category: widget.category || null,
        version: widget.version || null,
        status: widget.status || null,
        source_path: sourcePath(widget)
      }
    : null;
}

/**
 * @param {any} widget
 * @returns {any}
 */
export function summarizeWidgetContract(widget) {
  const contract = widgetContract(widget);
  if (!contract) return null;
  return {
    id: contract.id,
    name: contract.name,
    category: contract.category || null,
    version: contract.version || null,
    status: contract.status || null,
    props: contract.props || [],
    events: contract.events || [],
    behaviors: contract.behaviors || [],
    behavior: contract.behavior || [],
    approvals: contract.approvals || [],
    dependencies: contract.dependencies || [],
    source_path: sourcePath(widget)
  };
}

/**
 * @param {any} projection
 * @returns {any}
 */
export function projectionRealizesIds(projection) {
  return new Set((projection?.realizes || []).map(/** @param {any} ref */ (ref) => ref.id).filter(Boolean));
}

/**
 * @param {any} projection
 * @returns {any}
 */
export function ownProjectionScreenMap(projection) {
  return new Map((projection?.uiScreens || []).map(/** @param {any} screen */ (screen) => [screen.id, screen]));
}

/**
 * @param {any} projection
 * @returns {any}
 */
export function ownProjectionRegionKeys(projection) {
  return new Set((projection?.uiScreenRegions || []).map(/** @param {any} entry */ (entry) => `${entry.screenId}:${entry.region}`));
}

/**
 * @param {any} graph
 * @returns {any}
 */
export function projectionById(graph) {
  return byId(graph.byKind.projection || []);
}

/**
 * @param {any} graph
 * @param {any} projection
 * @returns {any}
 */
export function projectionContext(graph, projection) {
  const projections = /** @type {any[]} */ ([]);
  const seen = new Set();
  const projectionsById = projectionById(graph);

  /**
   * @param {any} current
   * @returns {void}
   */
  function visit(current) {
    if (!current || seen.has(current.id)) {
      return;
    }
    seen.add(current.id);
    projections.push(current);
    for (const ref of current.realizes || []) {
      const target = projectionsById.get(ref.id);
      if (target) {
        visit(target);
      }
    }
  }

  visit(projection);
  return projections;
}

/**
 * @param {any} graph
 * @param {any} projection
 * @returns {any}
 */
export function projectionScreenMap(graph, projection) {
  const screens = new Map();
  for (const contextProjection of projectionContext(graph, projection).reverse()) {
    for (const [id, screen] of ownProjectionScreenMap(contextProjection)) {
      screens.set(id, screen);
    }
  }
  return screens;
}

/**
 * @param {any} graph
 * @param {any} projection
 * @returns {any}
 */
export function projectionRegionKeys(graph, projection) {
  const regions = new Set();
  for (const contextProjection of projectionContext(graph, projection)) {
    for (const key of ownProjectionRegionKeys(contextProjection)) {
      regions.add(key);
    }
  }
  return regions;
}

/**
 * @param {any} graph
 * @param {any} projection
 * @returns {any}
 */
export function projectionContextRealizesIds(graph, projection) {
  const ids = new Set();
  for (const contextProjection of projectionContext(graph, projection)) {
    for (const id of projectionRealizesIds(contextProjection)) {
      ids.add(id);
    }
  }
  return ids;
}

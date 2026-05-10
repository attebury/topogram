// @ts-check

import { getProjection, sharedUiProjectionForWeb, uiProjectionCandidates } from "../surfaces/shared.js";
import { buildWidgetBehaviorRealizations } from "../../widget-behavior.js";
import { collectUsageChecks, widgetUsageKey } from "./checks.js";
import {
  byId,
  projectionScreenMap,
  sourcePath,
  stableUnique,
  summarizeProjection,
  summarizeWidget,
  summarizeWidgetContract,
  widgetContract
} from "./projection-context.js";

/**
 * @param {import("./types.d.ts").WidgetGraph} graph
 * @param {import("./types.d.ts").WidgetProjection} projection
 * @returns {import("./types.d.ts").WidgetUsageEntry[]}
 */
export function projectionUsageEntries(graph, projection) {
  const sharedProjection = sharedUiProjectionForWeb(graph, projection);
  const entries = /** @type {import("./types.d.ts").WidgetUsageEntry[]} */ ([]);
  if (sharedProjection) {
    entries.push(...(sharedProjection.widgetBindings || []).map(/** @param {import("./types.d.ts").WidgetUsage} usage @param {any} index */ (usage, index) => ({
      projection,
      sourceProjection: sharedProjection,
      usage,
      index
    })));
  }
  entries.push(...(projection.widgetBindings || []).map(/** @param {import("./types.d.ts").WidgetUsage} usage @param {any} index */ (usage, index) => ({
    projection,
    sourceProjection: projection,
    usage,
    index
  })));
  return entries;
}

/**
 * @param {import("./types.d.ts").WidgetGraph} graph
 * @param {string | null | undefined} projectionId
 * @returns {any}
 */
export function candidateProjections(graph, projectionId) {
  if (projectionId) {
    return [getProjection(graph, projectionId)];
  }
  const direct = uiProjectionCandidates(graph).filter(/** @param {import("./types.d.ts").WidgetProjection} projection */ (projection) => (projection.widgetBindings || []).length > 0);
  const inherited = (graph.byKind.projection || []).filter(/** @param {import("./types.d.ts").WidgetProjection} projection */ (projection) => {
    if ((projection.widgetBindings || []).length > 0) return false;
    return Boolean(sharedUiProjectionForWeb(graph, projection)?.widgetBindings?.length);
  });
  return [...direct, ...inherited].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * @param {import("./types.d.ts").WidgetGraph} graph
 * @param {Iterable<string>} widgetIds
 * @param {Iterable<string>} projectionIds
 * @returns {any}
 */
export function relatedVerificationFiles(graph, widgetIds, projectionIds) {
  const ids = new Set([...widgetIds, ...projectionIds]);
  return stableUnique((graph.byKind.verification || [])
    .filter(/** @param {any} verification */ (verification) => (verification.validates || []).some(/** @param {any} ref */ (ref) => ids.has(ref.id)))
    .map(/** @param {any} verification */ (verification) => sourcePath(verification)));
}

/**
 * @param {import("./types.d.ts").WidgetGraph} graph
 * @param {import("./types.d.ts").WidgetOptions} options
 * @returns {any}
 */
export function generateWidgetConformanceReport(graph, options = {}) {
  const selectedWidgetId = options.widgetId || options.componentId || null;
  const widgets = byId(graph.byKind.widget || []);
  if (selectedWidgetId && !widgets.has(selectedWidgetId)) {
    throw new Error(`No widget found with id '${selectedWidgetId}'`);
  }

  const projectionUsageRecords = /** @type {import("./types.d.ts").WidgetProjectionUsageRecord[]} */ ([]);
  const checks = /** @type {any[]} */ ([]);
  const referencedWidgetIds = /** @type {Set<string>} */ (new Set());
  const affectedProjectionIds = /** @type {Set<string>} */ (new Set());

  for (const projection of candidateProjections(graph, options.projectionId)) {
    for (const entry of projectionUsageEntries(graph, projection)) {
      const widgetId = entry.usage.widget?.id || null;
      if (selectedWidgetId && widgetId !== selectedWidgetId) {
        continue;
      }
      const widget = widgetId ? widgets.get(widgetId) : null;
      if (widgetId) referencedWidgetIds.add(widgetId);
      affectedProjectionIds.add(entry.projection.id);
      if (entry.sourceProjection?.id) affectedProjectionIds.add(entry.sourceProjection.id);
      const usageChecks = collectUsageChecks({ graph, projection: entry.projection, sourceProjection: entry.sourceProjection, usage: entry.usage, widget });
      checks.push(...usageChecks);
      const outcome = usageChecks.some(/** @param {any} check */ (check) => check.severity === "error")
        ? "error"
        : usageChecks.some(/** @param {any} check */ (check) => check.severity === "warning")
          ? "warning"
          : "pass";
      projectionUsageRecords.push({
        key: widgetUsageKey(entry.projection, entry.sourceProjection, entry.usage, entry.index),
        projection: summarizeProjection(entry.projection),
        source_projection: entry.sourceProjection.id === entry.projection.id ? null : summarizeProjection(entry.sourceProjection),
        screen: {
          id: entry.usage.screenId || null,
          kind: projectionScreenMap(graph, entry.sourceProjection).get(entry.usage.screenId)?.kind || null,
          title: projectionScreenMap(graph, entry.sourceProjection).get(entry.usage.screenId)?.title || null
        },
        region: entry.usage.region || null,
        widget: summarizeWidget(widget) || { id: widgetId, name: widgetId, category: null, version: null, status: null, source_path: null },
        data_bindings: entry.usage.dataBindings || [],
        event_bindings: entry.usage.eventBindings || [],
        behavior_realizations: buildWidgetBehaviorRealizations(widgetContract(widget), entry.usage),
        outcome,
        check_codes: usageChecks.map(/** @param {any} check */ (check) => check.code)
      });
    }
  }

  const widgetFiles = stableUnique([...referencedWidgetIds].map(/** @param {any} id */ (id) => sourcePath(widgets.get(id))));
  const projectionFiles = stableUnique(
    [...affectedProjectionIds].map(/** @param {any} id */ (id) => sourcePath((graph.byKind.projection || []).find(/** @param {import("./types.d.ts").WidgetProjection} projection */ (projection) => projection.id === id)))
  );
  const verificationFiles = relatedVerificationFiles(graph, referencedWidgetIds, affectedProjectionIds);
  const errors = checks.filter(/** @param {any} check */ (check) => check.severity === "error");
  const warnings = checks.filter(/** @param {any} check */ (check) => check.severity === "warning");

  return {
    type: "widget_conformance_report",
    filters: {
      projection: options.projectionId || null,
      widget: selectedWidgetId
    },
    summary: {
      total_usages: projectionUsageRecords.length,
      passed_usages: projectionUsageRecords.filter(/** @param {import("./types.d.ts").WidgetProjectionUsageRecord} usage */ (usage) => usage.outcome === "pass").length,
      warning_usages: projectionUsageRecords.filter(/** @param {import("./types.d.ts").WidgetProjectionUsageRecord} usage */ (usage) => usage.outcome === "warning").length,
      error_usages: projectionUsageRecords.filter(/** @param {import("./types.d.ts").WidgetProjectionUsageRecord} usage */ (usage) => usage.outcome === "error").length,
      warnings: warnings.length,
      errors: errors.length,
      affected_projections: stableUnique([...affectedProjectionIds]),
      affected_widgets: stableUnique([...referencedWidgetIds])
    },
    projection_usages: projectionUsageRecords,
    checks,
    widget_contracts: stableUnique([...referencedWidgetIds])
      .map(/** @param {any} id */ (id) => summarizeWidgetContract(widgets.get(id)))
      .filter(Boolean),
    write_scope: {
      widget_files: widgetFiles,
      projection_files: projectionFiles,
      verification_files: verificationFiles,
      paths: stableUnique([...widgetFiles, ...projectionFiles, ...verificationFiles])
    },
    impact: {
      projections: stableUnique([...affectedProjectionIds]),
      widgets: stableUnique([...referencedWidgetIds])
    }
  };
}

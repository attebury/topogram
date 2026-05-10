// @ts-check

import { stableUnique } from "./projection-context.js";
import { generateWidgetConformanceReport } from "./report.js";

/**
 * @param {any} usage
 * @param {any} behavior
 * @param {any} index
 * @returns {any}
 */
export function behaviorReportKey(usage, behavior, index) {
  return [usage.key, behavior.kind || "behavior", String(index)].join(":");
}

/**
 * @param {any} behavior
 * @returns {any}
 */
export function capabilityIdsFromBehavior(behavior) {
  const ids = /** @type {string[]} */ ([]);
  for (const dependency of behavior.dataDependencies || []) {
    if (dependency.source?.kind === "capability" && dependency.source.id) {
      ids.push(dependency.source.id);
    }
  }
  for (const action of behavior.actions || []) {
    if (action.capability?.id) {
      ids.push(action.capability.id);
    }
    for (const effect of action.effects || []) {
      if (effect.capability?.id) {
        ids.push(effect.capability.id);
      }
    }
  }
  for (const effect of behavior.effects || []) {
    if (effect.capability?.id) {
      ids.push(effect.capability.id);
    }
  }
  return stableUnique(ids);
}

/**
 * @param {any} behavior
 * @returns {any}
 */
export function effectTypesFromBehavior(behavior) {
  const effects = behavior.effects || [];
  if (effects.length === 0) {
    return ["none"];
  }
  return stableUnique(effects.map(/** @param {any} effect */ (effect) => effect.type || "unknown"));
}

/**
 * @param {any} conformanceReport
 * @param {any} usage
 * @param {any} behavior
 * @returns {any}
 */
export function checksForBehavior(conformanceReport, usage, behavior) {
  return (conformanceReport.checks || [])
    .filter(/** @param {any} check */ (check) =>
      check.code?.startsWith("widget_behavior_") &&
      check.projection === usage.projection?.id &&
      check.widget === usage.widget?.id &&
      check.screen === usage.screen?.id &&
      check.region === usage.region &&
      (!check.behavior || check.behavior === behavior.kind)
    )
    .map(/** @param {any} check */ (check) => ({
      code: check.code,
      severity: check.severity,
      message: check.message,
      event: check.event || null,
      behavior: check.behavior || behavior.kind || null,
      suggested_fix: check.suggested_fix || null
    }));
}

/**
 * @param {any} behaviorRows
 * @returns {any}
 */
export function behaviorHighlights(behaviorRows) {
  const highlights = /** @type {any[]} */ ([]);
  for (const row of behaviorRows) {
    if (row.behavior.status === "partial") {
      highlights.push({
        severity: "warning",
        code: "widget_behavior_partial",
        message: `Behavior '${row.behavior.kind}' is partially realized for widget '${row.widget.id}' on screen '${row.screen.id}'.`,
        projection: row.projection.id,
        widget: row.widget.id,
        screen: row.screen.id,
        region: row.region,
        behavior: row.behavior.kind,
        suggested_fix: "Bind the required behavior data, events, or capability actions in the projection widget_bindings entry."
      });
    }
    for (const emittedEvent of row.emits || []) {
      if (!emittedEvent.bound) {
        highlights.push({
          severity: "warning",
          code: "widget_behavior_event_unbound",
          message: `Behavior '${row.behavior.kind}' emits event '${emittedEvent.event}', but this widget usage does not bind it.`,
          projection: row.projection.id,
          widget: row.widget.id,
          screen: row.screen.id,
          region: row.region,
          event: emittedEvent.event || null,
          behavior: row.behavior.kind,
          suggested_fix: `Add 'event ${emittedEvent.event} navigate <screen>' or 'event ${emittedEvent.event} action <capability>' to the projection widget_bindings entry.`
        });
      }
    }
    for (const action of row.actions || []) {
      if (!action.bound) {
        const target = action.capability?.id || action.event || "(unknown)";
        highlights.push({
          severity: "warning",
          code: "widget_behavior_action_unbound",
          message: `Behavior '${row.behavior.kind}' declares action '${target}', but this widget usage does not bind it.`,
          projection: row.projection.id,
          widget: row.widget.id,
          screen: row.screen.id,
          region: row.region,
          event: action.event || null,
          capability: action.capability?.id || null,
          behavior: row.behavior.kind,
          suggested_fix: action.capability?.id
            ? `Add 'event <widget_event> action ${action.capability.id}' to the projection widget_bindings entry.`
            : `Add 'event ${action.event} action <capability>' or 'event ${action.event} navigate <screen>' to the projection widget_bindings entry.`
        });
      }
    }
  }
  return highlights;
}

/**
 * @param {any} rows
 * @param {any} keyFn
 * @param {any} itemFn
 * @returns {any}
 */
export function groupBehaviorRows(rows, keyFn, itemFn = null) {
  const groups = new Map();
  for (const row of rows) {
    for (const key of keyFn(row)) {
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(row);
    }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, entries]) => ({
      id,
      total_behaviors: entries.length,
      realized: entries.filter(/** @param {any} entry */ (entry) => entry.behavior.status === "realized").length,
      partial: entries.filter(/** @param {any} entry */ (entry) => entry.behavior.status === "partial").length,
      declared: entries.filter(/** @param {any} entry */ (entry) => entry.behavior.status === "declared").length,
      behaviors: entries.map(/** @param {any} entry */ (entry) => itemFn ? itemFn(entry) : entry.key).sort()
    }));
}

/**
 * @param {any} graph
 * @param {any} options
 * @returns {any}
 */
export function generateWidgetBehaviorReport(graph, options = {}) {
  const conformanceReport = generateWidgetConformanceReport(graph, options);
  const behaviorRows = /** @type {any[]} */ ([]);

  for (const usage of conformanceReport.projection_usages || []) {
    for (const [index, behavior] of (usage.behavior_realizations || []).entries()) {
      const diagnostics = checksForBehavior(conformanceReport, usage, behavior);
      behaviorRows.push({
        key: behaviorReportKey(usage, behavior, index),
        projection: usage.projection,
        source_projection: usage.source_projection,
        screen: usage.screen,
        region: usage.region,
        widget: usage.widget,
        behavior: {
          kind: behavior.kind || null,
          source: behavior.source || null,
          status: behavior.status || "declared",
          directives: behavior.directives || {}
        },
        data_dependencies: behavior.dataDependencies || [],
        emits: behavior.emits || [],
        actions: behavior.actions || [],
        effects: behavior.effects || [],
        capabilities: capabilityIdsFromBehavior(behavior),
        effect_types: effectTypesFromBehavior(behavior),
        diagnostics,
        check_codes: diagnostics.map(/** @param {any} check */ (check) => check.code)
      });
    }
  }

  const highlights = behaviorHighlights(behaviorRows);
  const affectedCapabilities = stableUnique(behaviorRows.flatMap(/** @param {any} row */ (row) => row.capabilities));

  return {
    type: "widget_behavior_report",
    filters: conformanceReport.filters,
    summary: {
      total_usages: conformanceReport.summary.total_usages,
      total_behaviors: behaviorRows.length,
      realized: behaviorRows.filter(/** @param {any} row */ (row) => row.behavior.status === "realized").length,
      partial: behaviorRows.filter(/** @param {any} row */ (row) => row.behavior.status === "partial").length,
      declared: behaviorRows.filter(/** @param {any} row */ (row) => row.behavior.status === "declared").length,
      warnings: conformanceReport.summary.warnings,
      errors: conformanceReport.summary.errors,
      affected_widgets: conformanceReport.summary.affected_widgets,
      affected_projections: conformanceReport.summary.affected_projections,
      affected_capabilities: affectedCapabilities
    },
    groups: {
      widgets: groupBehaviorRows(
        behaviorRows,
        /** @param {any} row */ (row) => [row.widget.id].filter(Boolean),
        /** @param {any} row */ (row) => row.key
      ),
      screens: groupBehaviorRows(
        behaviorRows,
        /** @param {any} row */ (row) => [row.screen.id].filter(Boolean),
        /** @param {any} row */ (row) => row.key
      ),
      capabilities: groupBehaviorRows(
        behaviorRows,
        /** @param {any} row */ (row) => row.capabilities,
        /** @param {any} row */ (row) => row.key
      ),
      effects: groupBehaviorRows(
        behaviorRows,
        /** @param {any} row */ (row) => row.effect_types,
        /** @param {any} row */ (row) => row.key
      )
    },
    behaviors: behaviorRows,
    highlights,
    checks: conformanceReport.checks.filter(/** @param {any} check */ (check) => check.code?.startsWith("widget_behavior_")),
    write_scope: conformanceReport.write_scope,
    impact: {
      projections: conformanceReport.impact.projections,
      widgets: conformanceReport.impact.widgets,
      capabilities: affectedCapabilities
    }
  };
}

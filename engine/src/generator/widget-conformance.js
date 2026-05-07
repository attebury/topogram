import { getProjection, sharedUiProjectionForWeb, uiProjectionCandidates } from "./surfaces/shared.js";
import { buildWidgetBehaviorRealizations } from "../widget-behavior.js";

function byId(entries = []) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

function stableUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function sourcePath(entry) {
  return entry?.loc?.file || null;
}

function widgetContract(widget) {
  return widget?.widgetContract || null;
}

function summarizeProjection(projection) {
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

function summarizeWidget(widget) {
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

function summarizeWidgetContract(widget) {
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

function projectionRealizesIds(projection) {
  return new Set((projection?.realizes || []).map((ref) => ref.id).filter(Boolean));
}

function ownProjectionScreenMap(projection) {
  return new Map((projection?.uiScreens || []).map((screen) => [screen.id, screen]));
}

function ownProjectionRegionKeys(projection) {
  return new Set((projection?.uiScreenRegions || []).map((entry) => `${entry.screenId}:${entry.region}`));
}

function projectionById(graph) {
  return byId(graph.byKind.projection || []);
}

function projectionContext(graph, projection) {
  const projections = [];
  const seen = new Set();
  const projectionsById = projectionById(graph);

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

function projectionScreenMap(graph, projection) {
  const screens = new Map();
  for (const contextProjection of projectionContext(graph, projection).reverse()) {
    for (const [id, screen] of ownProjectionScreenMap(contextProjection)) {
      screens.set(id, screen);
    }
  }
  return screens;
}

function projectionRegionKeys(graph, projection) {
  const regions = new Set();
  for (const contextProjection of projectionContext(graph, projection)) {
    for (const key of ownProjectionRegionKeys(contextProjection)) {
      regions.add(key);
    }
  }
  return regions;
}

function projectionContextRealizesIds(graph, projection) {
  const ids = new Set();
  for (const contextProjection of projectionContext(graph, projection)) {
    for (const id of projectionRealizesIds(contextProjection)) {
      ids.add(id);
    }
  }
  return ids;
}

function checkRecord({
  code,
  severity,
  message,
  projection,
  sourceProjection,
  widget,
  usage,
  prop = null,
  event = null,
  behavior = null,
  suggestedFix
}) {
  return {
    code,
    severity,
    message,
    projection: projection?.id || null,
    source_projection: sourceProjection?.id || null,
    widget: widget?.id || usage.widget?.id || null,
    screen: usage.screenId || null,
    region: usage.region || null,
    prop,
    event,
    behavior,
    suggested_fix: suggestedFix
  };
}

function widgetUsageKey(projection, sourceProjection, usage, index) {
  return [
    projection.id,
    sourceProjection?.id || projection.id,
    usage.screenId || "screen",
    usage.region || "region",
    usage.widget?.id || "widget",
    String(index)
  ].join(":");
}

function collectUsageChecks({ graph, projection, sourceProjection, usage, widget }) {
  const checks = [];
  const contract = widgetContract(widget);
  const props = contract?.props || [];
  const events = contract?.events || [];
  const propNames = new Set(props.map((prop) => prop.name));
  const eventNames = new Set(events.map((event) => event.id));
  const boundProps = new Set((usage.dataBindings || []).map((binding) => binding.prop).filter(Boolean));
  const statements = byId(graph.statements || []);
  const screens = projectionScreenMap(graph, sourceProjection);
  const regionKeys = projectionRegionKeys(graph, sourceProjection);
  const realizedIds = projectionContextRealizesIds(graph, sourceProjection);

  if (!widget) {
    checks.push(checkRecord({
      code: "widget_missing",
      severity: "error",
      message: `Widget '${usage.widget?.id || "(missing)"}' could not be resolved.`,
      projection,
      sourceProjection,
      widget,
      usage,
      suggestedFix: "Create the widget or update the projection widget_bindings binding."
    }));
    return checks;
  }

  if (projection.status === "active" && widget.status && widget.status !== "active") {
    checks.push(checkRecord({
      code: "widget_status_not_active",
      severity: "warning",
      message: `Active projection '${projection.id}' uses widget '${widget.id}' with status '${widget.status}'.`,
      projection,
      sourceProjection,
      widget,
      usage,
      suggestedFix: "Promote the widget to active or move the usage behind an explicit review boundary."
    }));
  }

  if (!screens.has(usage.screenId)) {
    checks.push(checkRecord({
      code: "widget_usage_screen_missing",
      severity: "error",
      message: `Widget usage references missing screen '${usage.screenId}'.`,
      projection,
      sourceProjection,
      widget,
      usage,
      suggestedFix: "Add the screen to screens or update the widget usage screen id."
    }));
  }

  if (!regionKeys.has(`${usage.screenId}:${usage.region}`)) {
    checks.push(checkRecord({
      code: "widget_usage_region_missing",
      severity: "error",
      message: `Widget usage references undeclared region '${usage.region}' on screen '${usage.screenId}'.`,
      projection,
      sourceProjection,
      widget,
      usage,
      suggestedFix: "Add the region to screen_regions or update the widget usage region."
    }));
  }

  for (const prop of props.filter((entry) => entry.requiredness === "required")) {
    if (!boundProps.has(prop.name)) {
      checks.push(checkRecord({
        code: "widget_required_prop_missing",
        severity: "error",
        message: `Required prop '${prop.name}' is not bound for widget '${widget.id}'.`,
        projection,
        sourceProjection,
        widget,
        usage,
        prop: prop.name,
        suggestedFix: `Add 'data ${prop.name} from <source>' to the projection widget_bindings entry.`
      }));
    }
  }

  for (const binding of usage.dataBindings || []) {
    if (!propNames.has(binding.prop)) {
      checks.push(checkRecord({
        code: "widget_prop_unknown",
        severity: "error",
        message: `Prop '${binding.prop}' is not declared by widget '${widget.id}'.`,
        projection,
        sourceProjection,
        widget,
        usage,
        prop: binding.prop || null,
        suggestedFix: "Declare the prop on the widget or update the projection binding."
      }));
    }
    if (!binding.source?.id || !statements.has(binding.source.id)) {
      checks.push(checkRecord({
        code: "widget_data_source_missing",
        severity: "error",
        message: `Data binding for prop '${binding.prop}' references a missing source.`,
        projection,
        sourceProjection,
        widget,
        usage,
        prop: binding.prop || null,
        suggestedFix: "Bind the prop to an existing capability, projection, shape, or entity."
      }));
    }
  }

  for (const binding of usage.eventBindings || []) {
    if (!eventNames.has(binding.event)) {
      checks.push(checkRecord({
        code: "widget_event_unknown",
        severity: "error",
        message: `Event '${binding.event}' is not declared by widget '${widget.id}'.`,
        projection,
        sourceProjection,
        widget,
        usage,
        event: binding.event || null,
        suggestedFix: "Declare the event on the widget or update the projection binding."
      }));
    }
    if (binding.action === "navigate") {
      if (!screens.has(binding.target?.id)) {
        checks.push(checkRecord({
          code: "widget_event_navigation_target_missing",
          severity: "error",
          message: `Event '${binding.event}' navigates to missing screen '${binding.target?.id || "(missing)"}'.`,
          projection,
          sourceProjection,
          widget,
          usage,
          event: binding.event || null,
          suggestedFix: "Add the target screen or update the event navigation target."
        }));
      }
    } else if (binding.action === "action") {
      const target = binding.target?.id ? statements.get(binding.target.id) : null;
      if (!target || target.kind !== "capability") {
        checks.push(checkRecord({
          code: "widget_event_action_missing",
          severity: "error",
          message: `Event '${binding.event}' targets missing capability '${binding.target?.id || "(missing)"}'.`,
          projection,
          sourceProjection,
          widget,
          usage,
          event: binding.event || null,
          suggestedFix: "Bind the event to an existing capability."
        }));
      } else if (!realizedIds.has(target.id)) {
        checks.push(checkRecord({
          code: "widget_event_action_not_in_projection",
          severity: "error",
          message: `Event '${binding.event}' targets capability '${target.id}', but projection '${sourceProjection.id}' does not realize it through its UI context.`,
          projection,
          sourceProjection,
          widget,
          usage,
          event: binding.event || null,
          suggestedFix: `Add '${target.id}' to projection '${sourceProjection.id}' or an inherited shared projection realizes list, or choose a capability already in this projection context.`
        }));
      }
    } else {
      checks.push(checkRecord({
        code: "widget_event_action_unsupported",
        severity: "error",
        message: `Event '${binding.event}' uses unsupported action '${binding.action}'.`,
        projection,
        sourceProjection,
        widget,
        usage,
        event: binding.event || null,
        suggestedFix: "Use 'navigate' or 'action'."
      }));
    }
  }

  for (const behavior of contract?.behaviors || []) {
    const stateProp = behavior.directives?.state;
    if (stateProp && !propNames.has(stateProp)) {
      checks.push(checkRecord({
        code: "widget_behavior_prop_missing",
        severity: "error",
        message: `Behavior '${behavior.kind}' references missing prop '${stateProp}'.`,
        projection,
        sourceProjection,
        widget,
        usage,
        prop: stateProp,
        behavior: behavior.kind,
        suggestedFix: "Update the behavior directive or declare the referenced prop."
      }));
    }
    const emits = Array.isArray(behavior.directives?.emits)
      ? behavior.directives.emits
      : [behavior.directives?.emits].filter(Boolean);
    for (const eventName of emits) {
      if (!eventNames.has(eventName)) {
        checks.push(checkRecord({
          code: "widget_behavior_event_missing",
          severity: "error",
          message: `Behavior '${behavior.kind}' references missing event '${eventName}'.`,
          projection,
          sourceProjection,
          widget,
          usage,
          event: eventName,
          behavior: behavior.kind,
          suggestedFix: "Update the behavior directive or declare the referenced event."
        }));
        continue;
      }
      if (!(usage.eventBindings || []).some((binding) => binding.event === eventName)) {
        checks.push(checkRecord({
          code: "widget_behavior_event_unbound",
          severity: "warning",
          message: `Behavior '${behavior.kind}' emits event '${eventName}', but this projection usage does not bind that event to navigation or an action.`,
          projection,
          sourceProjection,
          widget,
          usage,
          event: eventName,
          behavior: behavior.kind,
          suggestedFix: `Add 'event ${eventName} navigate <screen>' or 'event ${eventName} action <capability>' to the projection widget_bindings entry.`
        }));
      }
    }
    const declaredActions = [
      ...(Array.isArray(behavior.directives?.actions) ? behavior.directives.actions : [behavior.directives?.actions].filter(Boolean)),
      ...(Array.isArray(behavior.directives?.submit) ? behavior.directives.submit : [behavior.directives?.submit].filter(Boolean))
    ];
    for (const actionTarget of declaredActions) {
      if (eventNames.has(actionTarget)) {
        if (!(usage.eventBindings || []).some((binding) => binding.event === actionTarget)) {
          checks.push(checkRecord({
            code: "widget_behavior_action_unbound",
            severity: "warning",
            message: `Behavior '${behavior.kind}' declares action event '${actionTarget}', but this projection usage does not bind that event to navigation or an action.`,
            projection,
            sourceProjection,
            widget,
            usage,
            event: actionTarget,
            behavior: behavior.kind,
            suggestedFix: `Add 'event ${actionTarget} action <capability>' or 'event ${actionTarget} navigate <screen>' to the projection widget_bindings entry.`
          }));
        }
        continue;
      }

      const target = statements.get(actionTarget);
      if (!target || target.kind !== "capability") {
        checks.push(checkRecord({
          code: "widget_behavior_action_missing",
          severity: "error",
          message: `Behavior '${behavior.kind}' references missing capability action '${actionTarget}'.`,
          projection,
          sourceProjection,
          widget,
          usage,
          behavior: behavior.kind,
          suggestedFix: "Update the behavior directive or declare the referenced capability."
        }));
        continue;
      }
      if (!realizedIds.has(actionTarget)) {
        checks.push(checkRecord({
          code: "widget_behavior_action_not_in_projection",
          severity: "error",
          message: `Behavior '${behavior.kind}' references capability '${actionTarget}', but projection '${sourceProjection.id}' does not realize it.`,
          projection,
          sourceProjection,
          widget,
          usage,
          behavior: behavior.kind,
          suggestedFix: `Add '${actionTarget}' to projection '${sourceProjection.id}' realizes or choose a capability already in this projection context.`
        }));
      }
      if (!(usage.eventBindings || []).some((binding) =>
        binding.action === "action" &&
        binding.target?.id === actionTarget &&
        binding.target?.kind === "capability"
      )) {
        checks.push(checkRecord({
          code: "widget_behavior_action_unbound",
          severity: "warning",
          message: `Behavior '${behavior.kind}' declares capability action '${actionTarget}', but this projection usage does not bind any widget event to that capability.`,
          projection,
          sourceProjection,
          widget,
          usage,
          behavior: behavior.kind,
          suggestedFix: `Add 'event <widget_event> action ${actionTarget}' to the projection widget_bindings entry.`
        }));
      }
    }
  }

  return checks;
}

function projectionUsageEntries(graph, projection) {
  const sharedProjection = sharedUiProjectionForWeb(graph, projection);
  const entries = [];
  if (sharedProjection) {
    entries.push(...(sharedProjection.uiComponents || []).map((usage, index) => ({
      projection,
      sourceProjection: sharedProjection,
      usage,
      index
    })));
  }
  entries.push(...(projection.uiComponents || []).map((usage, index) => ({
    projection,
    sourceProjection: projection,
    usage,
    index
  })));
  return entries;
}

function candidateProjections(graph, projectionId) {
  if (projectionId) {
    return [getProjection(graph, projectionId)];
  }
  const direct = uiProjectionCandidates(graph).filter((projection) => (projection.uiComponents || []).length > 0);
  const inherited = (graph.byKind.projection || []).filter((projection) => {
    if ((projection.uiComponents || []).length > 0) return false;
    return Boolean(sharedUiProjectionForWeb(graph, projection)?.uiComponents?.length);
  });
  return [...direct, ...inherited].sort((a, b) => a.id.localeCompare(b.id));
}

function relatedVerificationFiles(graph, widgetIds, projectionIds) {
  const ids = new Set([...widgetIds, ...projectionIds]);
  return stableUnique((graph.byKind.verification || [])
    .filter((verification) => (verification.validates || []).some((ref) => ids.has(ref.id)))
    .map((verification) => sourcePath(verification)));
}

export function generateWidgetConformanceReport(graph, options = {}) {
  const selectedWidgetId = options.widgetId || options.componentId || null;
  const widgets = byId(graph.byKind.widget || []);
  if (selectedWidgetId && !widgets.has(selectedWidgetId)) {
    throw new Error(`No widget found with id '${selectedWidgetId}'`);
  }

  const projectionUsageRecords = [];
  const checks = [];
  const referencedWidgetIds = new Set();
  const affectedProjectionIds = new Set();

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
      const outcome = usageChecks.some((check) => check.severity === "error")
        ? "error"
        : usageChecks.some((check) => check.severity === "warning")
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
        check_codes: usageChecks.map((check) => check.code)
      });
    }
  }

  const widgetFiles = stableUnique([...referencedWidgetIds].map((id) => sourcePath(widgets.get(id))));
  const projectionFiles = stableUnique(
    [...affectedProjectionIds].map((id) => sourcePath((graph.byKind.projection || []).find((projection) => projection.id === id)))
  );
  const verificationFiles = relatedVerificationFiles(graph, referencedWidgetIds, affectedProjectionIds);
  const errors = checks.filter((check) => check.severity === "error");
  const warnings = checks.filter((check) => check.severity === "warning");

  return {
    type: "widget_conformance_report",
    filters: {
      projection: options.projectionId || null,
      widget: selectedWidgetId
    },
    summary: {
      total_usages: projectionUsageRecords.length,
      passed_usages: projectionUsageRecords.filter((usage) => usage.outcome === "pass").length,
      warning_usages: projectionUsageRecords.filter((usage) => usage.outcome === "warning").length,
      error_usages: projectionUsageRecords.filter((usage) => usage.outcome === "error").length,
      warnings: warnings.length,
      errors: errors.length,
      affected_projections: stableUnique([...affectedProjectionIds]),
      affected_widgets: stableUnique([...referencedWidgetIds])
    },
    projection_usages: projectionUsageRecords,
    checks,
    widget_contracts: stableUnique([...referencedWidgetIds])
      .map((id) => summarizeWidgetContract(widgets.get(id)))
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

function behaviorReportKey(usage, behavior, index) {
  return [usage.key, behavior.kind || "behavior", String(index)].join(":");
}

function capabilityIdsFromBehavior(behavior) {
  const ids = [];
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

function effectTypesFromBehavior(behavior) {
  const effects = behavior.effects || [];
  if (effects.length === 0) {
    return ["none"];
  }
  return stableUnique(effects.map((effect) => effect.type || "unknown"));
}

function checksForBehavior(conformanceReport, usage, behavior) {
  return (conformanceReport.checks || [])
    .filter((check) =>
      check.code?.startsWith("widget_behavior_") &&
      check.projection === usage.projection?.id &&
      check.widget === usage.widget?.id &&
      check.screen === usage.screen?.id &&
      check.region === usage.region &&
      (!check.behavior || check.behavior === behavior.kind)
    )
    .map((check) => ({
      code: check.code,
      severity: check.severity,
      message: check.message,
      event: check.event || null,
      behavior: check.behavior || behavior.kind || null,
      suggested_fix: check.suggested_fix || null
    }));
}

function behaviorHighlights(behaviorRows) {
  const highlights = [];
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

function groupBehaviorRows(rows, keyFn, itemFn = null) {
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
      realized: entries.filter((entry) => entry.behavior.status === "realized").length,
      partial: entries.filter((entry) => entry.behavior.status === "partial").length,
      declared: entries.filter((entry) => entry.behavior.status === "declared").length,
      behaviors: entries.map((entry) => itemFn ? itemFn(entry) : entry.key).sort()
    }));
}

export function generateWidgetBehaviorReport(graph, options = {}) {
  const conformanceReport = generateWidgetConformanceReport(graph, options);
  const behaviorRows = [];

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
        check_codes: diagnostics.map((check) => check.code)
      });
    }
  }

  const highlights = behaviorHighlights(behaviorRows);
  const affectedCapabilities = stableUnique(behaviorRows.flatMap((row) => row.capabilities));

  return {
    type: "widget_behavior_report",
    filters: conformanceReport.filters,
    summary: {
      total_usages: conformanceReport.summary.total_usages,
      total_behaviors: behaviorRows.length,
      realized: behaviorRows.filter((row) => row.behavior.status === "realized").length,
      partial: behaviorRows.filter((row) => row.behavior.status === "partial").length,
      declared: behaviorRows.filter((row) => row.behavior.status === "declared").length,
      warnings: conformanceReport.summary.warnings,
      errors: conformanceReport.summary.errors,
      affected_widgets: conformanceReport.summary.affected_widgets,
      affected_projections: conformanceReport.summary.affected_projections,
      affected_capabilities: affectedCapabilities
    },
    groups: {
      widgets: groupBehaviorRows(
        behaviorRows,
        (row) => [row.widget.id].filter(Boolean),
        (row) => row.key
      ),
      screens: groupBehaviorRows(
        behaviorRows,
        (row) => [row.screen.id].filter(Boolean),
        (row) => row.key
      ),
      capabilities: groupBehaviorRows(
        behaviorRows,
        (row) => row.capabilities,
        (row) => row.key
      ),
      effects: groupBehaviorRows(
        behaviorRows,
        (row) => row.effect_types,
        (row) => row.key
      )
    },
    behaviors: behaviorRows,
    highlights,
    checks: conformanceReport.checks.filter((check) => check.code?.startsWith("widget_behavior_")),
    write_scope: conformanceReport.write_scope,
    impact: {
      projections: conformanceReport.impact.projections,
      widgets: conformanceReport.impact.widgets,
      capabilities: affectedCapabilities
    }
  };
}

import { getProjection, sharedUiProjectionForWeb, uiProjectionCandidates } from "./surfaces/shared.js";
import { buildComponentBehaviorRealizations } from "../component-behavior.js";

function byId(entries = []) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

function stableUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function sourcePath(entry) {
  return entry?.loc?.file || null;
}

function componentContract(component) {
  return component?.componentContract || null;
}

function summarizeProjection(projection) {
  return projection
    ? {
        id: projection.id,
        name: projection.name || projection.id,
        platform: projection.platform || null,
        status: projection.status || null,
        source_path: sourcePath(projection)
      }
    : null;
}

function summarizeComponent(component) {
  return component
    ? {
        id: component.id,
        name: component.name || component.id,
        category: component.category || null,
        version: component.version || null,
        status: component.status || null,
        source_path: sourcePath(component)
      }
    : null;
}

function summarizeComponentContract(component) {
  const contract = componentContract(component);
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
    source_path: sourcePath(component)
  };
}

function projectionRealizesIds(projection) {
  return new Set((projection?.realizes || []).map((ref) => ref.id).filter(Boolean));
}

function projectionScreenMap(projection) {
  return new Map((projection?.uiScreens || []).map((screen) => [screen.id, screen]));
}

function projectionRegionKeys(projection) {
  return new Set((projection?.uiScreenRegions || []).map((entry) => `${entry.screenId}:${entry.region}`));
}

function checkRecord({
  code,
  severity,
  message,
  projection,
  sourceProjection,
  component,
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
    component: component?.id || usage.component?.id || null,
    screen: usage.screenId || null,
    region: usage.region || null,
    prop,
    event,
    behavior,
    suggested_fix: suggestedFix
  };
}

function componentUsageKey(projection, sourceProjection, usage, index) {
  return [
    projection.id,
    sourceProjection?.id || projection.id,
    usage.screenId || "screen",
    usage.region || "region",
    usage.component?.id || "component",
    String(index)
  ].join(":");
}

function collectUsageChecks({ graph, projection, sourceProjection, usage, component }) {
  const checks = [];
  const contract = componentContract(component);
  const props = contract?.props || [];
  const events = contract?.events || [];
  const propNames = new Set(props.map((prop) => prop.name));
  const eventNames = new Set(events.map((event) => event.id));
  const boundProps = new Set((usage.dataBindings || []).map((binding) => binding.prop).filter(Boolean));
  const statements = byId(graph.statements || []);
  const screens = projectionScreenMap(sourceProjection);
  const regionKeys = projectionRegionKeys(sourceProjection);
  const realizedIds = projectionRealizesIds(sourceProjection);

  if (!component) {
    checks.push(checkRecord({
      code: "component_missing",
      severity: "error",
      message: `Component '${usage.component?.id || "(missing)"}' could not be resolved.`,
      projection,
      sourceProjection,
      component,
      usage,
      suggestedFix: "Create the component or update the projection ui_components binding."
    }));
    return checks;
  }

  if (projection.status === "active" && component.status && component.status !== "active") {
    checks.push(checkRecord({
      code: "component_status_not_active",
      severity: "warning",
      message: `Active projection '${projection.id}' uses component '${component.id}' with status '${component.status}'.`,
      projection,
      sourceProjection,
      component,
      usage,
      suggestedFix: "Promote the component to active or move the usage behind an explicit review boundary."
    }));
  }

  if (!screens.has(usage.screenId)) {
    checks.push(checkRecord({
      code: "component_usage_screen_missing",
      severity: "error",
      message: `Component usage references missing screen '${usage.screenId}'.`,
      projection,
      sourceProjection,
      component,
      usage,
      suggestedFix: "Add the screen to ui_screens or update the component usage screen id."
    }));
  }

  if (!regionKeys.has(`${usage.screenId}:${usage.region}`)) {
    checks.push(checkRecord({
      code: "component_usage_region_missing",
      severity: "error",
      message: `Component usage references undeclared region '${usage.region}' on screen '${usage.screenId}'.`,
      projection,
      sourceProjection,
      component,
      usage,
      suggestedFix: "Add the region to ui_screen_regions or update the component usage region."
    }));
  }

  for (const prop of props.filter((entry) => entry.requiredness === "required")) {
    if (!boundProps.has(prop.name)) {
      checks.push(checkRecord({
        code: "component_required_prop_missing",
        severity: "error",
        message: `Required prop '${prop.name}' is not bound for component '${component.id}'.`,
        projection,
        sourceProjection,
        component,
        usage,
        prop: prop.name,
        suggestedFix: `Add 'data ${prop.name} from <source>' to the projection ui_components entry.`
      }));
    }
  }

  for (const binding of usage.dataBindings || []) {
    if (!propNames.has(binding.prop)) {
      checks.push(checkRecord({
        code: "component_prop_unknown",
        severity: "error",
        message: `Prop '${binding.prop}' is not declared by component '${component.id}'.`,
        projection,
        sourceProjection,
        component,
        usage,
        prop: binding.prop || null,
        suggestedFix: "Declare the prop on the component or update the projection binding."
      }));
    }
    if (!binding.source?.id || !statements.has(binding.source.id)) {
      checks.push(checkRecord({
        code: "component_data_source_missing",
        severity: "error",
        message: `Data binding for prop '${binding.prop}' references a missing source.`,
        projection,
        sourceProjection,
        component,
        usage,
        prop: binding.prop || null,
        suggestedFix: "Bind the prop to an existing capability, projection, shape, or entity."
      }));
    }
  }

  for (const binding of usage.eventBindings || []) {
    if (!eventNames.has(binding.event)) {
      checks.push(checkRecord({
        code: "component_event_unknown",
        severity: "error",
        message: `Event '${binding.event}' is not declared by component '${component.id}'.`,
        projection,
        sourceProjection,
        component,
        usage,
        event: binding.event || null,
        suggestedFix: "Declare the event on the component or update the projection binding."
      }));
    }
    if (binding.action === "navigate") {
      if (!screens.has(binding.target?.id)) {
        checks.push(checkRecord({
          code: "component_event_navigation_target_missing",
          severity: "error",
          message: `Event '${binding.event}' navigates to missing screen '${binding.target?.id || "(missing)"}'.`,
          projection,
          sourceProjection,
          component,
          usage,
          event: binding.event || null,
          suggestedFix: "Add the target screen or update the event navigation target."
        }));
      }
    } else if (binding.action === "action") {
      const target = binding.target?.id ? statements.get(binding.target.id) : null;
      if (!target || target.kind !== "capability") {
        checks.push(checkRecord({
          code: "component_event_action_missing",
          severity: "error",
          message: `Event '${binding.event}' targets missing capability '${binding.target?.id || "(missing)"}'.`,
          projection,
          sourceProjection,
          component,
          usage,
          event: binding.event || null,
          suggestedFix: "Bind the event to an existing capability."
        }));
      } else if (!realizedIds.has(target.id)) {
        checks.push(checkRecord({
          code: "component_event_action_not_in_projection",
          severity: "error",
          message: `Event '${binding.event}' targets capability '${target.id}', but projection '${sourceProjection.id}' does not realize it.`,
          projection,
          sourceProjection,
          component,
          usage,
          event: binding.event || null,
          suggestedFix: `Add '${target.id}' to projection '${sourceProjection.id}' realizes or choose a capability already in this projection context.`
        }));
      }
    } else {
      checks.push(checkRecord({
        code: "component_event_action_unsupported",
        severity: "error",
        message: `Event '${binding.event}' uses unsupported action '${binding.action}'.`,
        projection,
        sourceProjection,
        component,
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
        code: "component_behavior_prop_missing",
        severity: "error",
        message: `Behavior '${behavior.kind}' references missing prop '${stateProp}'.`,
        projection,
        sourceProjection,
        component,
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
          code: "component_behavior_event_missing",
          severity: "error",
          message: `Behavior '${behavior.kind}' references missing event '${eventName}'.`,
          projection,
          sourceProjection,
          component,
          usage,
          event: eventName,
          behavior: behavior.kind,
          suggestedFix: "Update the behavior directive or declare the referenced event."
        }));
        continue;
      }
      if (!(usage.eventBindings || []).some((binding) => binding.event === eventName)) {
        checks.push(checkRecord({
          code: "component_behavior_event_unbound",
          severity: "warning",
          message: `Behavior '${behavior.kind}' emits event '${eventName}', but this projection usage does not bind that event to navigation or an action.`,
          projection,
          sourceProjection,
          component,
          usage,
          event: eventName,
          behavior: behavior.kind,
          suggestedFix: `Add 'event ${eventName} navigate <screen>' or 'event ${eventName} action <capability>' to the projection ui_components entry.`
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
            code: "component_behavior_action_unbound",
            severity: "warning",
            message: `Behavior '${behavior.kind}' declares action event '${actionTarget}', but this projection usage does not bind that event to navigation or an action.`,
            projection,
            sourceProjection,
            component,
            usage,
            event: actionTarget,
            behavior: behavior.kind,
            suggestedFix: `Add 'event ${actionTarget} action <capability>' or 'event ${actionTarget} navigate <screen>' to the projection ui_components entry.`
          }));
        }
        continue;
      }

      const target = statements.get(actionTarget);
      if (!target || target.kind !== "capability") {
        checks.push(checkRecord({
          code: "component_behavior_action_missing",
          severity: "error",
          message: `Behavior '${behavior.kind}' references missing capability action '${actionTarget}'.`,
          projection,
          sourceProjection,
          component,
          usage,
          behavior: behavior.kind,
          suggestedFix: "Update the behavior directive or declare the referenced capability."
        }));
        continue;
      }
      if (!realizedIds.has(actionTarget)) {
        checks.push(checkRecord({
          code: "component_behavior_action_not_in_projection",
          severity: "error",
          message: `Behavior '${behavior.kind}' references capability '${actionTarget}', but projection '${sourceProjection.id}' does not realize it.`,
          projection,
          sourceProjection,
          component,
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
          code: "component_behavior_action_unbound",
          severity: "warning",
          message: `Behavior '${behavior.kind}' declares capability action '${actionTarget}', but this projection usage does not bind any component event to that capability.`,
          projection,
          sourceProjection,
          component,
          usage,
          behavior: behavior.kind,
          suggestedFix: `Add 'event <component_event> action ${actionTarget}' to the projection ui_components entry.`
        }));
      }
    }
  }

  return checks;
}

function projectionUsageEntries(graph, projection) {
  const sharedProjection = sharedUiProjectionForWeb(graph, projection);
  const sourceProjection = sharedProjection || projection;
  const usages = sourceProjection.uiComponents || [];
  if (usages.length === 0) {
    return [];
  }
  return usages.map((usage, index) => ({
    projection,
    sourceProjection,
    usage,
    index
  }));
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

function relatedVerificationFiles(graph, componentIds, projectionIds) {
  const ids = new Set([...componentIds, ...projectionIds]);
  return stableUnique((graph.byKind.verification || [])
    .filter((verification) => (verification.validates || []).some((ref) => ids.has(ref.id)))
    .map((verification) => sourcePath(verification)));
}

export function generateComponentConformanceReport(graph, options = {}) {
  const components = byId(graph.byKind.component || []);
  if (options.componentId && !components.has(options.componentId)) {
    throw new Error(`No component found with id '${options.componentId}'`);
  }

  const projectionUsageRecords = [];
  const checks = [];
  const referencedComponentIds = new Set();
  const affectedProjectionIds = new Set();

  for (const projection of candidateProjections(graph, options.projectionId)) {
    for (const entry of projectionUsageEntries(graph, projection)) {
      const componentId = entry.usage.component?.id || null;
      if (options.componentId && componentId !== options.componentId) {
        continue;
      }
      const component = componentId ? components.get(componentId) : null;
      if (componentId) referencedComponentIds.add(componentId);
      affectedProjectionIds.add(entry.projection.id);
      if (entry.sourceProjection?.id) affectedProjectionIds.add(entry.sourceProjection.id);
      const usageChecks = collectUsageChecks({ graph, projection: entry.projection, sourceProjection: entry.sourceProjection, usage: entry.usage, component });
      checks.push(...usageChecks);
      const outcome = usageChecks.some((check) => check.severity === "error")
        ? "error"
        : usageChecks.some((check) => check.severity === "warning")
          ? "warning"
          : "pass";
      projectionUsageRecords.push({
        key: componentUsageKey(entry.projection, entry.sourceProjection, entry.usage, entry.index),
        projection: summarizeProjection(entry.projection),
        source_projection: entry.sourceProjection.id === entry.projection.id ? null : summarizeProjection(entry.sourceProjection),
        screen: {
          id: entry.usage.screenId || null,
          kind: projectionScreenMap(entry.sourceProjection).get(entry.usage.screenId)?.kind || null,
          title: projectionScreenMap(entry.sourceProjection).get(entry.usage.screenId)?.title || null
        },
        region: entry.usage.region || null,
        component: summarizeComponent(component) || { id: componentId, name: componentId, category: null, version: null, status: null, source_path: null },
        data_bindings: entry.usage.dataBindings || [],
        event_bindings: entry.usage.eventBindings || [],
        behavior_realizations: buildComponentBehaviorRealizations(componentContract(component), entry.usage),
        outcome,
        check_codes: usageChecks.map((check) => check.code)
      });
    }
  }

  const componentFiles = stableUnique([...referencedComponentIds].map((id) => sourcePath(components.get(id))));
  const projectionFiles = stableUnique(
    [...affectedProjectionIds].map((id) => sourcePath((graph.byKind.projection || []).find((projection) => projection.id === id)))
  );
  const verificationFiles = relatedVerificationFiles(graph, referencedComponentIds, affectedProjectionIds);
  const errors = checks.filter((check) => check.severity === "error");
  const warnings = checks.filter((check) => check.severity === "warning");

  return {
    type: "component_conformance_report",
    filters: {
      projection: options.projectionId || null,
      component: options.componentId || null
    },
    summary: {
      total_usages: projectionUsageRecords.length,
      passed_usages: projectionUsageRecords.filter((usage) => usage.outcome === "pass").length,
      warning_usages: projectionUsageRecords.filter((usage) => usage.outcome === "warning").length,
      error_usages: projectionUsageRecords.filter((usage) => usage.outcome === "error").length,
      warnings: warnings.length,
      errors: errors.length,
      affected_projections: stableUnique([...affectedProjectionIds]),
      affected_components: stableUnique([...referencedComponentIds])
    },
    projection_usages: projectionUsageRecords,
    checks,
    component_contracts: stableUnique([...referencedComponentIds])
      .map((id) => summarizeComponentContract(components.get(id)))
      .filter(Boolean),
    write_scope: {
      component_files: componentFiles,
      projection_files: projectionFiles,
      verification_files: verificationFiles,
      paths: stableUnique([...componentFiles, ...projectionFiles, ...verificationFiles])
    },
    impact: {
      projections: stableUnique([...affectedProjectionIds]),
      components: stableUnique([...referencedComponentIds])
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
      check.code?.startsWith("component_behavior_") &&
      check.projection === usage.projection?.id &&
      check.component === usage.component?.id &&
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
        code: "component_behavior_partial",
        message: `Behavior '${row.behavior.kind}' is partially realized for component '${row.component.id}' on screen '${row.screen.id}'.`,
        projection: row.projection.id,
        component: row.component.id,
        screen: row.screen.id,
        region: row.region,
        behavior: row.behavior.kind,
        suggested_fix: "Bind the required behavior data, events, or capability actions in the projection ui_components entry."
      });
    }
    for (const emittedEvent of row.emits || []) {
      if (!emittedEvent.bound) {
        highlights.push({
          severity: "warning",
          code: "component_behavior_event_unbound",
          message: `Behavior '${row.behavior.kind}' emits event '${emittedEvent.event}', but this component usage does not bind it.`,
          projection: row.projection.id,
          component: row.component.id,
          screen: row.screen.id,
          region: row.region,
          event: emittedEvent.event || null,
          behavior: row.behavior.kind,
          suggested_fix: `Add 'event ${emittedEvent.event} navigate <screen>' or 'event ${emittedEvent.event} action <capability>' to the projection ui_components entry.`
        });
      }
    }
    for (const action of row.actions || []) {
      if (!action.bound) {
        const target = action.capability?.id || action.event || "(unknown)";
        highlights.push({
          severity: "warning",
          code: "component_behavior_action_unbound",
          message: `Behavior '${row.behavior.kind}' declares action '${target}', but this component usage does not bind it.`,
          projection: row.projection.id,
          component: row.component.id,
          screen: row.screen.id,
          region: row.region,
          event: action.event || null,
          capability: action.capability?.id || null,
          behavior: row.behavior.kind,
          suggested_fix: action.capability?.id
            ? `Add 'event <component_event> action ${action.capability.id}' to the projection ui_components entry.`
            : `Add 'event ${action.event} action <capability>' or 'event ${action.event} navigate <screen>' to the projection ui_components entry.`
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

export function generateComponentBehaviorReport(graph, options = {}) {
  const conformanceReport = generateComponentConformanceReport(graph, options);
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
        component: usage.component,
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
    type: "component_behavior_report",
    filters: conformanceReport.filters,
    summary: {
      total_usages: conformanceReport.summary.total_usages,
      total_behaviors: behaviorRows.length,
      realized: behaviorRows.filter((row) => row.behavior.status === "realized").length,
      partial: behaviorRows.filter((row) => row.behavior.status === "partial").length,
      declared: behaviorRows.filter((row) => row.behavior.status === "declared").length,
      warnings: conformanceReport.summary.warnings,
      errors: conformanceReport.summary.errors,
      affected_components: conformanceReport.summary.affected_components,
      affected_projections: conformanceReport.summary.affected_projections,
      affected_capabilities: affectedCapabilities
    },
    groups: {
      components: groupBehaviorRows(
        behaviorRows,
        (row) => [row.component.id].filter(Boolean),
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
    checks: conformanceReport.checks.filter((check) => check.code?.startsWith("component_behavior_")),
    write_scope: conformanceReport.write_scope,
    impact: {
      projections: conformanceReport.impact.projections,
      components: conformanceReport.impact.components,
      capabilities: affectedCapabilities
    }
  };
}

// @ts-check

import {
  byId,
  projectionContextRealizesIds,
  projectionRegionKeys,
  projectionScreenMap,
  widgetContract
} from "./projection-context.js";

/**
 * @param {any} arg1
 * @returns {any}
 */
export function checkRecord(arg1) {
  const {
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
  } = arg1;
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

/**
 * @param {any} projection
 * @param {any} sourceProjection
 * @param {any} usage
 * @param {any} index
 * @returns {any}
 */
export function widgetUsageKey(projection, sourceProjection, usage, index) {
  return [
    projection.id,
    sourceProjection?.id || projection.id,
    usage.screenId || "screen",
    usage.region || "region",
    usage.widget?.id || "widget",
    String(index)
  ].join(":");
}

/**
 * @param {any} arg1
 * @returns {any}
 */
export function collectUsageChecks(arg1) {
  const { graph, projection, sourceProjection, usage, widget } = arg1;
  const checks = /** @type {any[]} */ ([]);
  const contract = widgetContract(widget);
  const props = contract?.props || [];
  const events = contract?.events || [];
  const propNames = new Set(props.map(/** @param {any} prop */ (prop) => prop.name));
  const eventNames = new Set(events.map(/** @param {any} event */ (event) => event.id));
  const boundProps = new Set((usage.dataBindings || []).map(/** @param {any} binding */ (binding) => binding.prop).filter(Boolean));
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

  for (const prop of props.filter(/** @param {any} entry */ (entry) => entry.requiredness === "required")) {
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
      if (!(usage.eventBindings || []).some(/** @param {any} binding */ (binding) => binding.event === eventName)) {
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
        if (!(usage.eventBindings || []).some(/** @param {any} binding */ (binding) => binding.event === actionTarget)) {
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
      if (!(usage.eventBindings || []).some(/** @param {any} binding */ (binding) =>
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

function asArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return value == null ? [] : [value];
}

function propByName(contract) {
  return new Map((contract?.props || []).map((prop) => [prop.name, prop]));
}

function bindingSourceForProp(usage, propName) {
  return (usage?.dataBindings || []).find((binding) => binding.prop === propName)?.source || null;
}

function effectFromEventBinding(binding) {
  if (binding.action === "navigate") {
    return {
      type: "navigation",
      event: binding.event || null,
      target: binding.target || null
    };
  }
  if (binding.action === "action") {
    return {
      type: "command",
      event: binding.event || null,
      capability: binding.target || null
    };
  }
  return {
    type: "unknown",
    event: binding.event || null,
    action: binding.action || null,
    target: binding.target || null
  };
}

function uniqueEffects(effects) {
  const seen = new Set();
  const output = [];
  for (const effect of effects) {
    const key = JSON.stringify(effect);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(effect);
  }
  return output;
}

function eventRealizations(usage, eventNames) {
  const bindings = usage?.eventBindings || [];
  return eventNames.map((eventName) => {
    const matchingBindings = bindings.filter((binding) => binding.event === eventName);
    return {
      event: eventName,
      bound: matchingBindings.length > 0,
      bindings: matchingBindings.map((binding) => ({
        event: binding.event || null,
        action: binding.action || null,
        target: binding.target || null
      })),
      effects: matchingBindings.map(effectFromEventBinding)
    };
  });
}

function capabilityActionRealization(usage, capabilityId) {
  const bindings = (usage?.eventBindings || [])
    .filter((binding) =>
      binding.action === "action" &&
      binding.target?.kind === "capability" &&
      binding.target?.id === capabilityId
    );
  const capability = {
    id: capabilityId,
    kind: "capability"
  };
  return {
    event: null,
    capability,
    bound: bindings.length > 0,
    bindings: bindings.map((binding) => ({
      event: binding.event || null,
      action: binding.action || null,
      target: binding.target || null
    })),
    effects: bindings.length > 0
      ? bindings.map(effectFromEventBinding)
      : [{
          type: "command",
          event: null,
          capability,
          source: "behavior"
        }]
  };
}

function actionRealizations(usage, actionNames, eventNames) {
  return actionNames.map((actionName) => {
    if (eventNames.has(actionName)) {
      return eventRealizations(usage, [actionName])[0];
    }
    return capabilityActionRealization(usage, actionName);
  });
}

function behaviorStatus({ hasDirectives, state, emits }) {
  const hasMissingEventBinding = emits.some((entry) => !entry.bound);
  if (hasMissingEventBinding) {
    return "partial";
  }
  if (state?.requiredness === "required" && !state.bound) {
    return "partial";
  }
  return hasDirectives ? "realized" : "declared";
}

/**
 * Build projection-specific realizations for component behavior contracts.
 *
 * Components declare reusable behavior capabilities; projection ui_components
 * bindings provide concrete data/event outcomes. This derived contract is the
 * normalized bridge agents and generators can use without inferring behavior
 * from stack code.
 *
 * @param {Record<string, any>|null} contract
 * @param {Record<string, any>} usage
 * @returns {Array<Record<string, any>>}
 */
export function buildComponentBehaviorRealizations(contract, usage) {
  const props = propByName(contract);
  const eventNames = new Set((contract?.events || []).map((event) => event.id).filter(Boolean));
  return (contract?.behaviors || []).map((behavior) => {
    const directives = behavior.directives || {};
    const statePropName = directives.state || null;
    const stateProp = statePropName ? props.get(statePropName) || null : null;
    const state = statePropName
      ? {
          prop: statePropName,
          requiredness: stateProp?.requiredness || null,
          bound: Boolean(bindingSourceForProp(usage, statePropName)),
          source: bindingSourceForProp(usage, statePropName),
          defaultValue: stateProp?.defaultValue ?? null
        }
      : null;
    const emits = eventRealizations(usage, asArray(directives.emits));
    const actions = actionRealizations(usage, [
      ...asArray(directives.actions),
      ...asArray(directives.submit)
    ], eventNames);
    const dataDependencies = (usage?.dataBindings || []).map((binding) => ({
      prop: binding.prop || null,
      source: binding.source || null
    }));
    const effects = uniqueEffects([...emits, ...actions].flatMap((entry) => entry.effects));
    const hasDirectives = Object.keys(directives).length > 0;

    return {
      kind: behavior.kind || null,
      source: behavior.source || null,
      directives: { ...directives },
      state,
      emits,
      actions,
      dataDependencies,
      effects,
      status: behaviorStatus({ hasDirectives, state, emits: [...emits, ...actions] })
    };
  });
}

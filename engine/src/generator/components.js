function stableSortedComponents(graph) {
  return [...(graph?.byKind?.component || [])].sort((a, b) => a.id.localeCompare(b.id));
}

function componentContract(component) {
  return component.componentContract || {
    type: "component_contract",
    id: component.id,
    name: component.name || component.id,
    description: component.description || null,
    category: component.category || null,
    version: component.version || null,
    status: component.status || null,
    props: component.props || [],
    events: component.events || [],
    slots: component.slots || [],
    behavior: component.behavior || [],
    patterns: component.patterns || [],
    regions: component.regions || [],
    lookups: component.lookups || [],
    dependencies: component.dependencies || [],
    consumers: component.consumers || []
  };
}

export function generateUiComponentContract(graph, options = {}) {
  if (options.componentId) {
    const component = (graph?.byKind?.component || []).find((entry) => entry.id === options.componentId);
    if (!component) {
      throw new Error(`No component found with id '${options.componentId}'`);
    }
    return componentContract(component);
  }

  return Object.fromEntries(
    stableSortedComponents(graph).map((component) => [component.id, componentContract(component)])
  );
}

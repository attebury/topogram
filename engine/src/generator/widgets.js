function stableSortedWidgets(graph) {
  return [...(graph?.byKind?.widget || [])].sort((a, b) => a.id.localeCompare(b.id));
}

function widgetContract(widget) {
  return widget.widgetContract || {
    type: "ui_widget_contract",
    id: widget.id,
    name: widget.name || widget.id,
    description: widget.description || null,
    category: widget.category || null,
    version: widget.version || null,
    status: widget.status || null,
    props: widget.props || [],
    events: widget.events || [],
    slots: widget.slots || [],
    behavior: widget.behavior || [],
    behaviors: widget.behaviors || [],
    patterns: widget.patterns || [],
    regions: widget.regions || [],
    approvals: widget.approvals || [],
    lookups: widget.lookups || [],
    dependencies: widget.dependencies || []
  };
}

export function generateUiWidgetContract(graph, options = {}) {
  const widgetId = options.widgetId || options.componentId;
  if (widgetId) {
    const widget = (graph?.byKind?.widget || graph?.byKind?.component || []).find((entry) => entry.id === widgetId);
    if (!widget) {
      throw new Error(`No widget found with id '${widgetId}'`);
    }
    return widgetContract(widget);
  }

  return Object.fromEntries(
    stableSortedWidgets(graph).map((widget) => [widget.id, widgetContract(widget)])
  );
}

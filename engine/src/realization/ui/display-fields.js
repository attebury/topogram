// @ts-check

/**
 * @typedef {{ name?: string, sourceName?: string, fieldType?: string, requiredness?: string }} ShapeField
 * @typedef {{ id?: string, output?: Array<{ id?: string }>, target?: { id?: string } }} CapabilityLike
 * @typedef {{ id?: string, projectedFields?: ShapeField[], fields?: ShapeField[] }} ShapeLike
 * @typedef {{ prop?: string|null, source?: { id?: string, kind?: string }|string|null }} DataBinding
 */

/**
 * @param {any} graph
 * @returns {Map<string, any>}
 */
function statementMap(graph) {
  return new Map((graph.statements || []).map((/** @type {any} */ statement) => [statement.id, statement]));
}

/**
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function labelForFieldName(name) {
  return String(name || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * @param {ShapeField} field
 * @returns {string}
 */
function roleForField(field) {
  const name = String(field.name || "").toLowerCase();
  const sourceName = String(field.sourceName || "").toLowerCase();
  const type = String(field.fieldType || "").toLowerCase();
  const combined = `${name} ${sourceName}`;
  if (/^(title|name|label|displayname|display_name)$/.test(name)) return "primary";
  if (/(^|_)(status|state|stage)($|_)/.test(combined)) return "status";
  if (/(^|_)priority($|_)/.test(combined)) return "priority";
  if (/date|time|_at$|at$/.test(combined) || /date|time/.test(type)) return "date";
  if (/(^id$|_id$|id$|uuid)/.test(combined) || type === "uuid") return "identifier";
  if (/^(number|integer|int|float|decimal|currency)$/.test(type)) return "numeric";
  if (type === "boolean" || type === "bool") return "flag";
  return "metadata";
}

/**
 * @param {ShapeField} field
 * @returns {{ name: string, sourceName: string|null, label: string, role: string, type: string|null, required: boolean, requiredness: string|null }}
 */
function displayField(field) {
  const name = String(field.name || "");
  return {
    name,
    sourceName: field.sourceName || null,
    label: labelForFieldName(name),
    role: roleForField(field),
    type: field.fieldType || null,
    required: field.requiredness === "required",
    requiredness: field.requiredness || null
  };
}

/**
 * @param {ShapeLike|null|undefined} shape
 * @returns {ReturnType<typeof displayField>[]}
 */
function displayFieldsForShape(shape) {
  const fields = shape?.projectedFields || shape?.fields || [];
  return fields.map(displayField).filter((field) => field.name);
}

/**
 * @param {Map<string, any>} byId
 * @param {CapabilityLike|null|undefined} capability
 * @returns {ShapeLike|null}
 */
function outputShapeForCapability(byId, capability) {
  const outputId = capability?.output?.[0]?.id || null;
  const shape = outputId ? byId.get(outputId) : null;
  return shape?.kind === "shape" ? shape : null;
}

/**
 * @param {any} graph
 * @param {any} screen
 * @returns {{ source: { kind: string, id: string }|null, fields: ReturnType<typeof displayField>[] }}
 */
export function deriveScreenDisplayFields(graph, screen) {
  const byId = statementMap(graph);
  const shapeId = screen?.itemShape?.id || screen?.viewShape?.id || screen?.inputShape?.id || null;
  const shape = shapeId ? byId.get(shapeId) : null;
  if (shape?.kind === "shape") {
    return {
      source: { kind: "shape", id: shape.id },
      fields: displayFieldsForShape(shape)
    };
  }
  const loadCapability = screen?.load?.id ? byId.get(screen.load.id) : null;
  const outputShape = loadCapability?.kind === "capability" ? outputShapeForCapability(byId, loadCapability) : null;
  if (outputShape) {
    return {
      source: { kind: "shape", id: String(outputShape.id) },
      fields: displayFieldsForShape(outputShape)
    };
  }
  return { source: null, fields: [] };
}

/**
 * @param {any} graph
 * @param {DataBinding|null|undefined} binding
 * @param {ReturnType<typeof deriveScreenDisplayFields>} screenDisplay
 * @returns {{ source: { kind: string|null, id: string|null }, sourceShape: { kind: string, id: string }|null, fields: ReturnType<typeof displayField>[] }}
 */
function displayForBindingSource(graph, binding, screenDisplay) {
  const byId = statementMap(graph);
  const sourceId = typeof binding?.source === "string" ? binding.source : binding?.source?.id || null;
  const sourceKind = typeof binding?.source === "object" && binding.source ? binding.source.kind || null : null;
  const source = sourceId ? byId.get(sourceId) : null;
  if (source?.kind === "shape") {
    return {
      source: { kind: "shape", id: source.id },
      sourceShape: { kind: "shape", id: source.id },
      fields: displayFieldsForShape(source)
    };
  }
  if (source?.kind === "capability") {
    if (screenDisplay.fields.length > 0) {
      return {
        source: { kind: "capability", id: source.id },
        sourceShape: screenDisplay.source,
        fields: screenDisplay.fields
      };
    }
    const shape = outputShapeForCapability(byId, source);
    if (shape) {
      return {
        source: { kind: "capability", id: source.id },
        sourceShape: { kind: "shape", id: String(shape.id) },
        fields: displayFieldsForShape(shape)
      };
    }
  }
  return {
    source: { kind: sourceKind, id: sourceId },
    sourceShape: screenDisplay.source,
    fields: screenDisplay.fields
  };
}

/**
 * @param {any} graph
 * @param {any} usage
 * @param {any} screen
 * @returns {{ prop: string|null, source: { kind: string|null, id: string|null }, sourceShape: { kind: string, id: string }|null, fields: ReturnType<typeof displayField>[], diagnostics: any[] }}
 */
export function deriveWidgetUsageDisplay(graph, usage, screen) {
  const screenDisplay = deriveScreenDisplayFields(graph, screen);
  const binding = (usage?.dataBindings || [])[0] || null;
  const display = displayForBindingSource(graph, binding, screenDisplay);
  const diagnostics = display.fields.length === 0
    ? [{
        code: "ui_display_fields_unresolved",
        severity: "warning",
        screen: usage?.screenId || screen?.id || null,
        region: usage?.region || null,
        widget: usage?.widget?.id || null,
        source: display.source,
        message: "Widget usage display fields could not be derived from a shape or capability output.",
        suggested_fix: "Bind the widget data prop to a capability with an output shape or add item/view/input shape metadata on the screen."
      }]
    : [];
  return {
    prop: binding?.prop || null,
    source: display.source,
    sourceShape: display.sourceShape,
    fields: display.fields,
    diagnostics
  };
}

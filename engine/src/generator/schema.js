import { fieldSignature, symbolList } from "./shared.js";

const JSON_SCHEMA_DRAFT = "https://json-schema.org/draft/2020-12/schema";

function indexStatements(graph) {
  const byId = new Map();
  for (const statement of graph.statements) {
    byId.set(statement.id, statement);
  }
  return byId;
}

function scalarSchema(typeName, byId) {
  switch (typeName) {
    case "string":
    case "text":
      return { type: "string" };
    case "integer":
      return { type: "integer" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "datetime":
      return { type: "string", format: "date-time" };
    case "uuid":
      return { type: "string", format: "uuid" };
    default: {
      const target = byId.get(typeName);
      if (target?.kind === "enum") {
        return { type: "string", enum: target.values };
      }
      return { type: "string", "x-topogram-type": typeName };
    }
  }
}

function coerceDefaultValue(value, schema) {
  if (value == null) {
    return undefined;
  }

  if (schema.type === "integer") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? value : parsed;
  }

  if (schema.type === "number") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? value : parsed;
  }

  if (schema.type === "boolean") {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
  }

  return value;
}

function schemaForField(field, byId) {
  const schema = scalarSchema(field.fieldType, byId);
  const defaultValue = coerceDefaultValue(field.defaultValue, schema);
  return defaultValue === undefined ? schema : { ...schema, default: defaultValue };
}

function generateShapeJsonSchema(shape, byId) {
  const fields = shape.projectedFields || shape.fields || [];
  const properties = {};
  const required = [];

  for (const field of fields) {
    properties[field.name] = schemaForField(field, byId);
    if (field.requiredness === "required") {
      required.push(field.name);
    }
  }

  const schema = {
    $schema: JSON_SCHEMA_DRAFT,
    $id: `topogram:shape:${shape.id}`,
    title: shape.name || shape.id,
    description: shape.description || undefined,
    type: "object",
    properties,
    additionalProperties: false
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

function getShape(graph, shapeId) {
  const byId = indexStatements(graph);
  const shape = byId.get(shapeId);
  if (!shape || shape.kind !== "shape") {
    throw new Error(`No shape found with id '${shapeId}'`);
  }
  return shape;
}

export function generateJsonSchema(graph, options = {}) {
  const byId = indexStatements(graph);
  const shapes = graph.byKind.shape || [];

  if (options.shapeId) {
    return generateShapeJsonSchema(getShape(graph, options.shapeId), byId);
  }

  const output = {};
  for (const shape of shapes) {
    output[shape.id] = generateShapeJsonSchema(shape, byId);
  }

  return output;
}

export function generateShapeTransformGraph(graph, options = {}) {
  const shapes = graph.byKind.shape || [];

  if (options.shapeId) {
    return getShape(graph, options.shapeId).transformGraph;
  }

  const output = {};
  for (const shape of shapes) {
    output[shape.id] = shape.transformGraph;
  }
  return output;
}

export function generateShapeTransformDebug(graph, options = {}) {
  const shapes = options.shapeId ? [getShape(graph, options.shapeId)] : graph.byKind.shape || [];
  const lines = [];

  lines.push("# Shape Transform Debug");
  lines.push("");
  lines.push(`Generated from \`${graph.root}\``);
  lines.push("");

  for (const shape of shapes) {
    lines.push(`## \`${shape.id}\` - ${shape.name || shape.id}`);
    lines.push("");
    if (shape.description) {
      lines.push(shape.description);
      lines.push("");
    }

    lines.push(`Selection mode: \`${shape.transformGraph.selection.mode}\``);
    if (shape.transformGraph.selection.source?.id) {
      lines.push(`Source: \`${shape.transformGraph.selection.source.id}\``);
    }
    lines.push(`Include: ${symbolList(shape.include)}`);
    lines.push(`Exclude: ${symbolList(shape.exclude)}`);
    lines.push("");

    lines.push("Selected fields:");
    for (const field of shape.transformGraph.selection.selectedFields) {
      lines.push(`- ${fieldSignature(field)}`);
    }
    lines.push("");

    lines.push("Transforms:");
    if (shape.transformGraph.transforms.length === 0) {
      lines.push("- _none_");
    } else {
      for (const transform of shape.transformGraph.transforms) {
        if (transform.type === "rename_field") {
          lines.push(`- rename \`${transform.from}\` -> \`${transform.to}\``);
          continue;
        }
        if (transform.type === "override_field") {
          const changes = [];
          if (transform.changes.requiredness) {
            changes.push(transform.changes.requiredness);
          }
          if (transform.changes.fieldType) {
            changes.push(`type \`${transform.changes.fieldType}\``);
          }
          if (transform.changes.defaultValue != null) {
            changes.push(`default \`${transform.changes.defaultValue}\``);
          }
          lines.push(`- override \`${transform.field}\`: ${changes.join(", ")}`);
        }
      }
    }
    lines.push("");

    lines.push("Result fields:");
    for (const field of shape.transformGraph.resultFields) {
      lines.push(`- ${fieldSignature(field)}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

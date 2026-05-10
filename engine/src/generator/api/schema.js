export const JSON_SCHEMA_DRAFT = "https://json-schema.org/draft/2020-12/schema";

/**
 * @param {any} graph
 * @returns {any}
 */
export function indexStatements(graph) {
  const byId = new Map();
  for (const statement of graph.statements) {
    byId.set(statement.id, statement);
  }
  return byId;
}

/**
 * @param {any} typeName
 * @param {any} byId
 * @returns {any}
 */
export function scalarSchema(typeName, byId) {
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

/**
 * @param {any} value
 * @param {any} schema
 * @returns {any}
 */
export function coerceDefaultValue(value, schema) {
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
    if (value === "true") return true;
    if (value === "false") return false;
  }

  return value;
}

/**
 * @param {any} field
 * @param {any} byId
 * @returns {any}
 */
export function schemaForField(field, byId) {
  const schema = scalarSchema(field.fieldType, byId);
  const defaultValue = coerceDefaultValue(field.defaultValue, schema);
  return defaultValue === undefined ? schema : { ...schema, default: defaultValue };
}

/**
 * @param {any} shape
 * @param {any} byId
 * @returns {any}
 */
export function generateShapeJsonSchema(shape, byId) {
  const fields = shape.projectedFields || shape.fields || [];
  const properties = /** @type {Record<string, any>} */ ({});
  const required = [];

  for (const field of fields) {
    properties[field.name] = schemaForField(field, byId);
    if (field.requiredness === "required") {
      required.push(field.name);
    }
  }

  const schema = /** @type {any} */ ({
    $schema: JSON_SCHEMA_DRAFT,
    $id: `topogram:shape:${shape.id}`,
    title: shape.name || shape.id,
    description: shape.description || undefined,
    type: "object",
    properties,
    additionalProperties: false
  });

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

/**
 * @param {any} value
 * @returns {any}
 */
export function cloneSchema(value) {
  return JSON.parse(JSON.stringify(value));
}

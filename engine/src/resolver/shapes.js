import { blockEntries, getFieldValue } from "../validator.js";
import { normalizeSequence, parseInvariantEntry, parseSymbolNodes, tokenValue } from "./shared.js";

export function parseKeyBlock(statement) {
  return blockEntries(getFieldValue(statement, "keys")).map((entry) => ({
    type: tokenValue(entry.items[0]),
    fields:
      entry.items[1]?.type === "list"
        ? entry.items[1].items.map((item) => item.value)
        : [],
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

export function parseRelationBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "relations")).map((entry) => {
    const sourceField = tokenValue(entry.items[0]);
    const targetRef = tokenValue(entry.items[2]);
    const [entityId, fieldName] = (targetRef || "").split(".");
    const targetStatement = entityId ? registry.get(entityId) : null;

    return {
      type: "reference",
      sourceField,
      target: entityId
        ? {
            id: entityId,
            kind: targetStatement?.kind || null,
            field: fieldName || null
          }
        : null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

export function parseInvariantBlock(statement) {
  return blockEntries(getFieldValue(statement, "invariants")).map((entry) => parseInvariantEntry(entry));
}

export function parseRenameBlock(statement) {
  return blockEntries(getFieldValue(statement, "rename")).map((entry) => ({
    from: entry.items[0]?.value ?? null,
    to: entry.items[1]?.value ?? null,
    loc: entry.loc
  }));
}

export function parseOverridesBlock(statement) {
  return blockEntries(getFieldValue(statement, "overrides")).map((entry) => {
    const [fieldName, ...rest] = entry.items;
    const override = {
      field: fieldName?.value ?? null,
      requiredness: null,
      fieldType: null,
      defaultValue: undefined,
      loc: entry.loc
    };

    for (let i = 0; i < rest.length; i += 1) {
      const token = rest[i];
      if (!token || token.type !== "symbol") {
        continue;
      }

      if (token.value === "required" || token.value === "optional") {
        override.requiredness = token.value;
        continue;
      }

      if (token.value === "type") {
        override.fieldType = rest[i + 1]?.value ?? null;
        i += 1;
        continue;
      }

      if (token.value === "default") {
        override.defaultValue = rest[i + 1]?.value ?? null;
        i += 1;
      }
    }

    return override;
  });
}

export function cloneField(field) {
  return {
    ...field,
    sourceName: field.sourceName ?? field.name
  };
}

export function fieldRef(field) {
  return {
    name: field.name,
    sourceName: field.sourceName ?? field.name,
    fieldType: field.fieldType,
    requiredness: field.requiredness,
    defaultValue: field.defaultValue ?? null
  };
}

export function applyRename(fields, renameRules) {
  const renameBySource = new Map(renameRules.map((rule) => [rule.from, rule.to]));
  return fields.map((field) => {
    const renamed = cloneField(field);
    const nextName = renameBySource.get(field.name);
    if (nextName) {
      renamed.name = nextName;
    }
    return renamed;
  });
}

export function applyOverrides(fields, overrideRules) {
  const byCurrentName = new Map(fields.map((field) => [field.name, field]));
  const bySourceName = new Map(fields.map((field) => [field.sourceName, field]));

  for (const rule of overrideRules) {
    const target = byCurrentName.get(rule.field) || bySourceName.get(rule.field);
    if (!target) {
      continue;
    }

    if (rule.requiredness) {
      target.requiredness = rule.requiredness;
    }
    if (rule.fieldType) {
      target.fieldType = rule.fieldType;
    }
    if (rule.defaultValue !== undefined) {
      target.defaultValue = rule.defaultValue;
    }
  }

  return fields;
}

export function buildShapeSelection(shape, byId) {
  const explicitFields = shape.fields.length > 0;
  const selectedFields =
    explicitFields
      ? shape.fields.map((field) => ({
          ...cloneField(field),
          sourceName: field.name
        }))
      : deriveShapeFields(shape, byId).map((field) => ({
          ...cloneField(field),
          sourceName: field.name
        }));

  return {
    type: "shape_selection",
    mode: explicitFields ? "explicit_fields" : shape.from?.id ? "derived_from_entity" : "empty",
    source: shape.from?.target || null,
    include: parseSymbolNodes(shape.include),
    exclude: parseSymbolNodes(shape.exclude),
    selectedFields: selectedFields.map((field) => fieldRef(field))
  };
}

export function buildRenameTransforms(renameRules) {
  return renameRules.map((rule, index) => ({
    type: "rename_field",
    order: index,
    from: rule.from,
    to: rule.to,
    loc: rule.loc
  }));
}

export function buildOverrideTransforms(overrideRules) {
  return overrideRules.map((rule, index) => ({
    type: "override_field",
    order: index,
    field: rule.field,
    changes: {
      requiredness: rule.requiredness,
      fieldType: rule.fieldType,
      defaultValue: rule.defaultValue ?? null
    },
    loc: rule.loc
  }));
}

export function buildShapeTransformGraph(shape, byId) {
  const selection = buildShapeSelection(shape, byId);
  return {
    type: "shape_transform_graph",
    selection,
    transforms: [
      ...buildRenameTransforms(shape.rename),
      ...buildOverrideTransforms(shape.overrides)
    ],
    resultFields: (shape.projectedFields || []).map((field) => fieldRef(field))
  };
}

export function projectShapeFields(shape, byId) {
  const baseFields =
    shape.fields.length > 0
      ? shape.fields.map((field) => ({
          ...cloneField(field),
          sourceName: field.name
        }))
      : deriveShapeFields(shape, byId).map((field) => ({
          ...cloneField(field),
          sourceName: field.name
        }));

  const renamedFields = applyRename(baseFields, shape.rename);
  const overriddenFields = applyOverrides(renamedFields, shape.overrides);

  return overriddenFields.map((field) => ({
    name: field.name,
    sourceName: field.sourceName,
    fieldType: field.fieldType,
    requiredness: field.requiredness,
    defaultValue: field.defaultValue ?? null,
    raw: field.raw,
    loc: field.loc
  }));
}

export function deriveShapeFields(shape, byId) {
  if (shape.fields.length > 0) {
    return shape.fields;
  }

  if (!shape.from?.target?.id) {
    return [];
  }

  const entity = byId.get(shape.from.target.id);
  if (!entity || entity.kind !== "entity") {
    return [];
  }

  const sourceFields = new Map(entity.fields.map((field) => [field.name, field]));
  const includes = shape.include.length > 0 ? shape.include : [...sourceFields.keys()];
  const excludes = new Set(shape.exclude);

  return includes
    .filter((fieldName) => !excludes.has(fieldName))
    .map((fieldName) => sourceFields.get(fieldName))
    .filter(Boolean)
    .map((field) => cloneField(field));
}

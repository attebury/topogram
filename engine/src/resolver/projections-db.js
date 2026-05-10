import { blockEntries, getFieldValue } from "../validator.js";
import { normalizeSequence, tokenValue } from "./shared.js";

export function parseProjectionGeneratorDefaultsBlock(statement) {
  return blockEntries(getFieldValue(statement, "generator_defaults")).map((entry) => ({
    type: "generator_default",
    key: tokenValue(entry.items[0]),
    value: tokenValue(entry.items[1]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

export function parseProjectionDbTablesBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "tables")).map((entry) => ({
    type: "db_table_mapping",
    entity: tokenValue(entry.items[0])
      ? {
          id: tokenValue(entry.items[0]),
          kind: registry.get(tokenValue(entry.items[0]))?.kind || null
        }
      : null,
    table: tokenValue(entry.items[2]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

export function parseProjectionDbColumnsBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "columns")).map((entry) => ({
    type: "db_column_mapping",
    entity: tokenValue(entry.items[0])
      ? {
          id: tokenValue(entry.items[0]),
          kind: registry.get(tokenValue(entry.items[0]))?.kind || null
        }
      : null,
    field: tokenValue(entry.items[2]) || null,
    column: tokenValue(entry.items[4]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

export function parseProjectionDbKeysBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "keys")).map((entry) => ({
    type: "db_key",
    entity: tokenValue(entry.items[0])
      ? {
          id: tokenValue(entry.items[0]),
          kind: registry.get(tokenValue(entry.items[0]))?.kind || null
        }
      : null,
    keyType: tokenValue(entry.items[1]) || null,
    fields: entry.items[2]?.type === "list" ? entry.items[2].items.map((item) => item.value) : [],
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

export function parseProjectionDbIndexesBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "indexes")).map((entry) => ({
    type: "db_index",
    entity: tokenValue(entry.items[0])
      ? {
          id: tokenValue(entry.items[0]),
          kind: registry.get(tokenValue(entry.items[0]))?.kind || null
        }
      : null,
    indexType: tokenValue(entry.items[1]) || null,
    fields: entry.items[2]?.type === "list" ? entry.items[2].items.map((item) => item.value) : [],
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

export function parseProjectionDbRelationsBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "relations")).map((entry) => {
    const targetRef = tokenValue(entry.items[4]) || null;
    const [targetEntityId, targetField] = (targetRef || "").split(".");
    return {
      type: "db_relation",
      entity: tokenValue(entry.items[0])
        ? {
            id: tokenValue(entry.items[0]),
            kind: registry.get(tokenValue(entry.items[0]))?.kind || null
          }
        : null,
      relationType: tokenValue(entry.items[1]) || null,
      field: tokenValue(entry.items[2]) || null,
      target: targetEntityId
        ? {
            id: targetEntityId,
            kind: registry.get(targetEntityId)?.kind || null,
            field: targetField || null
          }
        : null,
      onDelete: tokenValue(entry.items[6]) || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

export function parseProjectionDbLifecycleBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "lifecycle")).map((entry) => {
    const directives = {};
    for (let i = 2; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "lifecycle",
      entity: tokenValue(entry.items[0])
        ? {
            id: tokenValue(entry.items[0]),
            kind: registry.get(tokenValue(entry.items[0]))?.kind || null
          }
        : null,
      lifecycleType: tokenValue(entry.items[1]) || null,
      field: directives.field || null,
      value: directives.value || null,
      createdAt: directives.created_at || null,
      updatedAt: directives.updated_at || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

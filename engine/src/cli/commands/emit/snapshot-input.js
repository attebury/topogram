// @ts-check

import fs from "node:fs";

const FORBIDDEN_SNAPSHOT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function errorMessage(value) {
  return value instanceof Error ? value.message : String(value);
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function validateDbSchemaSnapshot(value) {
  const errors = [];
  if (!isRecord(value)) {
    return ["snapshot must be a JSON object"];
  }
  if (value.type !== "db_schema_snapshot") {
    errors.push("snapshot.type must be 'db_schema_snapshot'");
  }
  if (!Array.isArray(value.tables)) {
    errors.push("snapshot.tables must be an array");
  }
  if (!Array.isArray(value.enums)) {
    errors.push("snapshot.enums must be an array");
  }
  if (Array.isArray(value.tables)) {
    for (const [index, table] of value.tables.entries()) {
      if (!isRecord(table)) {
        errors.push(`snapshot.tables[${index}] must be an object`);
        continue;
      }
      if (typeof table.table !== "string" || table.table.length === 0) {
        errors.push(`snapshot.tables[${index}].table must be a non-empty string`);
      }
      if (!Array.isArray(table.columns)) {
        errors.push(`snapshot.tables[${index}].columns must be an array`);
      }
    }
  }
  if (Array.isArray(value.enums)) {
    for (const [index, enumEntry] of value.enums.entries()) {
      if (!isRecord(enumEntry)) {
        errors.push(`snapshot.enums[${index}] must be an object`);
        continue;
      }
      if (typeof enumEntry.id !== "string" || enumEntry.id.length === 0) {
        errors.push(`snapshot.enums[${index}].id must be a non-empty string`);
      }
      if (!Array.isArray(enumEntry.values)) {
        errors.push(`snapshot.enums[${index}].values must be an array`);
      }
    }
  }
  return errors;
}

/**
 * @param {string} snapshotPath
 * @returns {{ ok: true, snapshot: Record<string, unknown> } | { ok: false, message: string }}
 */
export function readFromSnapshot(snapshotPath) {
  let raw;
  try {
    raw = fs.readFileSync(snapshotPath, "utf8");
  } catch (error) {
    return {
      ok: false,
      message: `Unable to read --from-snapshot '${snapshotPath}': ${errorMessage(error)}`
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw, (key, value) => {
      if (FORBIDDEN_SNAPSHOT_KEYS.has(key)) {
        throw new Error(`unsafe key '${key}' is not allowed in snapshot JSON`);
      }
      return value;
    });
  } catch (error) {
    return {
      ok: false,
      message: `Invalid --from-snapshot JSON at '${snapshotPath}': ${errorMessage(error)}`
    };
  }

  const errors = validateDbSchemaSnapshot(parsed);
  if (errors.length > 0) {
    return {
      ok: false,
      message: `Invalid --from-snapshot DB schema snapshot at '${snapshotPath}': ${errors.join("; ")}`
    };
  }

  return { ok: true, snapshot: parsed };
}

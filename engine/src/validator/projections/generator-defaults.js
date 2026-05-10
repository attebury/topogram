// @ts-check

import {
  blockSymbolItems,
  pushError
} from "../utils.js";

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {void}
 */
export function validateProjectionGeneratorDefaults(errors, statement, fieldMap) {
  if (statement.kind !== "projection") {
    return;
  }

  const generatorField = fieldMap.get("generator_defaults")?.[0];
  if (!generatorField || generatorField.value.type !== "block") {
    return;
  }

  for (const entry of generatorField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [key, value] = tokens;
    if (!["profile", "language", "styling"].includes(key || "")) {
      pushError(errors, `Projection ${statement.id} generator_defaults has unknown key '${key}'`, entry.loc);
      continue;
    }
    if (!value) {
      pushError(errors, `Projection ${statement.id} generator_defaults is missing a value for '${key}'`, entry.loc);
      continue;
    }
    if (key === "profile" && !["vanilla", "sveltekit", "react", "swiftui", "postgres_sql", "sqlite_sql", "prisma", "drizzle"].includes(value)) {
      pushError(errors, `Projection ${statement.id} generator_defaults has unsupported profile '${value}'`, entry.loc);
    }
    if (key === "language" && !["typescript", "javascript", "swift", "sql"].includes(value)) {
      pushError(errors, `Projection ${statement.id} generator_defaults has unsupported language '${value}'`, entry.loc);
    }
    if (key === "styling" && !["tailwind", "css"].includes(value)) {
      pushError(errors, `Projection ${statement.id} generator_defaults has unsupported styling '${value}'`, entry.loc);
    }
  }
}

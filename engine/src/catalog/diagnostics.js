// @ts-check

/**
 * @param {Record<string, unknown>} input
 * @returns {{ code: string, severity: "error"|"warning", message: string, path: string|null, suggestedFix: string|null }}
 */
export function catalogDiagnostic(input) {
  return {
    code: String(input.code || "catalog_invalid"),
    severity: input.severity === "warning" ? "warning" : "error",
    message: String(input.message || "Catalog is invalid."),
    path: typeof input.path === "string" ? input.path : null,
    suggestedFix: typeof input.suggestedFix === "string" ? input.suggestedFix : null
  };
}

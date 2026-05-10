// @ts-check

/**
 * @typedef {Object} TemplateCheckDiagnostic
 * @property {string} code
 * @property {"error"|"warning"} severity
 * @property {string} message
 * @property {string|null} path
 * @property {string|null} suggestedFix
 * @property {string|null} step
 */

/**
 * @param {Record<string, any>} input
 * @returns {TemplateCheckDiagnostic}
 */
export function templateCheckDiagnostic(input) {
  return {
    code: String(input.code || "template_check_failed"),
    severity: input.severity === "warning" ? "warning" : "error",
    message: String(input.message || "Template check failed."),
    path: typeof input.path === "string" ? input.path : null,
    suggestedFix: typeof input.suggestedFix === "string" ? input.suggestedFix : null,
    step: typeof input.step === "string" ? input.step : null
  };
}

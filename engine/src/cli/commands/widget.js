// @ts-check

import { stableStringify } from "../../format.js";
import { generateWorkspace } from "../../generator.js";
import { parsePath } from "../../parser.js";
import { formatValidationErrors } from "../../validator.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {AnyRecord} report
 * @returns {void}
 */
export function printWidgetConformanceReport(report) {
  const summary = report.summary || {};
  const ok = (summary.errors || 0) === 0;
  console.log(ok ? "Widget conformance passed." : "Widget conformance found issues.");
  console.log(`Usages: ${summary.total_usages || 0} total, ${summary.passed_usages || 0} passed, ${summary.warning_usages || 0} warning, ${summary.error_usages || 0} error`);
  console.log(`Checks: ${summary.errors || 0} error(s), ${summary.warnings || 0} warning(s)`);
  if (report.filters?.projection) {
    console.log(`Projection filter: ${report.filters.projection}`);
  }
  if (report.filters?.widget) {
    console.log(`Widget filter: ${report.filters.widget}`);
  }
  if ((summary.affected_projections || []).length > 0) {
    console.log(`Affected projections: ${summary.affected_projections.join(", ")}`);
  }
  if ((summary.affected_widgets || []).length > 0) {
    console.log(`Affected widgets: ${summary.affected_widgets.join(", ")}`);
  }
  if ((report.checks || []).length > 0) {
    console.log("");
    console.log("Issues:");
    for (const check of report.checks) {
      const context = [
        check.projection ? `projection ${check.projection}` : null,
        check.widget ? `widget ${check.widget}` : null,
        check.screen ? `screen ${check.screen}` : null,
        check.region ? `region ${check.region}` : null,
        check.prop ? `prop ${check.prop}` : null,
        check.event ? `event ${check.event}` : null,
        check.behavior ? `behavior ${check.behavior}` : null
      ].filter(Boolean).join(", ");
      console.log(`- ${check.severity.toUpperCase()} ${check.code}${context ? ` (${context})` : ""}: ${check.message}`);
      if (check.suggested_fix) {
        console.log(`  Fix: ${check.suggested_fix}`);
      }
    }
  }
  const writeScopePaths = report.write_scope?.paths || [];
  if (writeScopePaths.length > 0) {
    console.log("");
    console.log("Write scope:");
    for (const filePath of writeScopePaths) {
      console.log(`- ${filePath}`);
    }
  }
}

/**
 * @param {AnyRecord} report
 * @returns {void}
 */
export function printWidgetBehaviorReport(report) {
  const summary = report.summary || {};
  const ok = (summary.errors || 0) === 0;
  console.log(ok ? "Widget behavior report passed." : "Widget behavior report found issues.");
  console.log(`Behaviors: ${summary.total_behaviors || 0} total, ${summary.realized || 0} realized, ${summary.partial || 0} partial, ${summary.declared || 0} declared`);
  console.log(`Checks: ${summary.errors || 0} error(s), ${summary.warnings || 0} warning(s)`);
  if (report.filters?.projection) {
    console.log(`Projection filter: ${report.filters.projection}`);
  }
  if (report.filters?.widget) {
    console.log(`Widget filter: ${report.filters.widget}`);
  }
  if ((summary.affected_projections || []).length > 0) {
    console.log(`Affected projections: ${summary.affected_projections.join(", ")}`);
  }
  if ((summary.affected_widgets || []).length > 0) {
    console.log(`Affected widgets: ${summary.affected_widgets.join(", ")}`);
  }
  if ((summary.affected_capabilities || []).length > 0) {
    console.log(`Affected capabilities: ${summary.affected_capabilities.join(", ")}`);
  }
  const highlights = report.highlights || [];
  if (highlights.length > 0) {
    console.log("");
    console.log("Behavior highlights:");
    for (const highlight of highlights) {
      const context = [
        highlight.projection ? `projection ${highlight.projection}` : null,
        highlight.widget ? `widget ${highlight.widget}` : null,
        highlight.screen ? `screen ${highlight.screen}` : null,
        highlight.region ? `region ${highlight.region}` : null,
        highlight.event ? `event ${highlight.event}` : null,
        highlight.capability ? `capability ${highlight.capability}` : null,
        highlight.behavior ? `behavior ${highlight.behavior}` : null
      ].filter(Boolean).join(", ");
      console.log(`- ${highlight.severity.toUpperCase()} ${highlight.code}${context ? ` (${context})` : ""}: ${highlight.message}`);
      if (highlight.suggested_fix) {
        console.log(`  Fix: ${highlight.suggested_fix}`);
      }
    }
  }
  const groupSummary = report.groups || {};
  console.log("");
  console.log(`Groups: ${(groupSummary.widgets || []).length} widget(s), ${(groupSummary.screens || []).length} screen(s), ${(groupSummary.capabilities || []).length} capability group(s), ${(groupSummary.effects || []).length} effect group(s)`);
}

/**
 * @param {string} inputPath
 * @param {{ json?: boolean, projectionId?: string|null, widgetId?: string|null }} [options]
 * @returns {number}
 */
export function runWidgetCheckCommand(inputPath, options = {}) {
  return runWidgetReportCommand(inputPath, {
    json: options.json,
    projectionId: options.projectionId,
    widgetId: options.widgetId,
    target: "widget-conformance-report",
    print: printWidgetConformanceReport
  });
}

/**
 * @param {string} inputPath
 * @param {{ json?: boolean, projectionId?: string|null, widgetId?: string|null }} [options]
 * @returns {number}
 */
export function runWidgetBehaviorCommand(inputPath, options = {}) {
  return runWidgetReportCommand(inputPath, {
    json: options.json,
    projectionId: options.projectionId,
    widgetId: options.widgetId,
    target: "widget-behavior-report",
    print: printWidgetBehaviorReport
  });
}

/**
 * @param {string} inputPath
 * @param {{ json?: boolean, projectionId?: string|null, widgetId?: string|null, target: string, print: (report: AnyRecord) => void }} options
 * @returns {number}
 */
function runWidgetReportCommand(inputPath, options) {
  const ast = parsePath(inputPath);
  const result = generateWorkspace(ast, {
    target: options.target,
    projectionId: options.projectionId,
    widgetId: options.widgetId,
    componentId: options.widgetId
  });
  if (!result.ok) {
    console.error(formatValidationErrors(result.validation));
    return 1;
  }
  const report = result.artifact;
  const ok = (report.summary?.errors || 0) === 0;
  if (options.json) {
    console.log(stableStringify(report));
  } else {
    options.print(report);
  }
  return ok ? 0 : 1;
}

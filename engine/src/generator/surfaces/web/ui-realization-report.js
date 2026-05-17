// @ts-check

import { buildDesignIntentCoverage, renderDesignIntentCss } from "./design-intent.js";
import { generateUiSurfaceContract } from "./ui-surface-contract.js";
import { reactWidgetUsageSupport } from "./react-widgets.js";
import { svelteKitWidgetUsageSupport } from "./sveltekit-widgets.js";

/**
 * @param {any} contract
 * @returns {"react"|"sveltekit"|"vanilla"}
 */
function reportProfile(contract) {
  const profile = contract?.generatorDefaults?.profile || "sveltekit";
  if (profile === "react") return "react";
  if (profile === "vanilla") return "vanilla";
  return "sveltekit";
}

/**
 * @param {any} usage
 * @param {any} widgets
 * @param {"react"|"sveltekit"|"vanilla"} profile
 * @returns {{ pattern: string|null, supported: boolean }}
 */
function widgetSupport(usage, widgets, profile) {
  if (profile === "react") return reactWidgetUsageSupport(usage, widgets);
  if (profile === "sveltekit") return svelteKitWidgetUsageSupport(usage, widgets);
  return { pattern: usage?.pattern || null, supported: false };
}

/**
 * @param {any} usage
 * @param {any} screen
 * @param {any} contract
 * @param {"react"|"sveltekit"|"vanilla"} profile
 * @returns {{ record: any, diagnostics: any[] }}
 */
function widgetUsageReport(usage, screen, contract, profile) {
  const widgetId = usage.widget?.id || null;
  const support = widgetSupport(usage, contract.widgets || {}, profile);
  const displayFields = usage.displayFields || usage.display?.fields || [];
  const diagnostics = [
    ...(usage.diagnostics || [])
  ];
  let status = support.supported ? "rendered" : "unsupported";
  if (!support.supported) {
    diagnostics.push({
      code: "ui_widget_realization_unsupported",
      severity: "error",
      screen: screen.id,
      route: screen.route || null,
      region: usage.region || null,
      widget: widgetId,
      pattern: support.pattern || null,
      generator: `topogram/${profile}`,
      message: `Widget '${widgetId || "(unknown)"}' on screen '${screen.id}' uses unsupported ${profile} pattern '${support.pattern || "(missing)"}'.`,
      suggested_fix: "Use a supported widget pattern, mark the generator manifest as contract-only for this pattern, or provide an implementation override."
    });
  }
  if (support.supported && displayFields.length === 0) {
    status = "failed";
    diagnostics.push({
      code: "ui_widget_display_fields_missing",
      severity: "error",
      screen: screen.id,
      route: screen.route || null,
      region: usage.region || null,
      widget: widgetId,
      message: `Widget '${widgetId || "(unknown)"}' on screen '${screen.id}' has no display fields for ${profile} realization.`,
      suggested_fix: "Bind widget data to a capability with an output shape or add screen item/view/input shape metadata."
    });
  }
  return {
    record: {
      screen: screen.id,
      route: screen.route || null,
      region: usage.region || null,
      widget: widgetId,
      pattern: support.pattern || null,
      status,
      supported: support.supported,
      display: usage.display || null,
      displayFields,
      behaviorRealizations: usage.behaviorRealizations || [],
      requiredMarkers: {
        widget: widgetId ? `data-topogram-widget="${widgetId}"` : null,
        region: usage.region ? `data-topogram-region="${usage.region}"` : null,
        screen: `data-topogram-screen="${screen.id}"`,
        displayField: "data-topogram-display-field"
      }
    },
    diagnostics
  };
}

/**
 * @param {any} contract
 * @returns {any}
 */
function designMappingReport(contract) {
  const css = renderDesignIntentCss(contract.designTokens);
  return buildDesignIntentCoverage(contract, { "src/app.css": css }, "src/app.css").coverage;
}

/**
 * @param {any} contract
 * @returns {any}
 */
function reportForContract(contract) {
  const profile = reportProfile(contract);
  const diagnostics = /** @type {any[]} */ ([]);
  const contractScreens = /** @type {any[]} */ (contract.screens || []);
  const screens = contractScreens.map((screen) => {
    const screenWidgets = /** @type {any[]} */ (screen.widgets || []);
    const usageReports = screenWidgets.map((usage) => widgetUsageReport(usage, screen, contract, profile));
    diagnostics.push(...usageReports.flatMap((entry) => entry.diagnostics));
    return {
      id: screen.id,
      kind: screen.kind || null,
      title: screen.title || screen.id,
      route: screen.route || null,
      regions: screen.regions || [],
      displayFields: screen.displayFields || screen.display?.fields || [],
      widgets: usageReports.map((entry) => entry.record),
      visibility: screen.visibility || [],
      actions: screen.actions || {}
    };
  });
  const widgetUsages = /** @type {any[]} */ (screens.flatMap((screen) => screen.widgets));
  return {
    type: "ui_realization_report",
    version: 1,
    surface: "web",
    generator: `topogram/${profile}`,
    projection: contract.projection,
    uiContract: contract.uiContract || null,
    summary: {
      screens: screens.length,
      routed_screens: screens.filter((screen) => screen.route).length,
      widget_usages: widgetUsages.length,
      rendered: widgetUsages.filter((usage) => usage.status === "rendered").length,
      contract_only: widgetUsages.filter((usage) => usage.status === "contract_only").length,
      unsupported: widgetUsages.filter((usage) => usage.status === "unsupported").length,
      failed: widgetUsages.filter((usage) => usage.status === "failed").length,
      diagnostics: diagnostics.length,
      errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
      warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length
    },
    ownership: {
      widgetPlacement: "ui_contract",
      designTokens: "ui_contract",
      concreteSurfaceOwns: ["screen_routes", "surface_hints"]
    },
    designTokenMapping: designMappingReport(contract),
    screens,
    widgetUsages,
    diagnostics
  };
}

/**
 * @param {any} graph
 * @param {any} options
 * @returns {any}
 */
export function generateUiRealizationReport(graph, options = {}) {
  const contracts = generateUiSurfaceContract(graph, options);
  if (options.projectionId) {
    return reportForContract(contracts);
  }
  return Object.fromEntries(Object.entries(contracts).map(([projectionId, contract]) => [
    projectionId,
    reportForContract(contract)
  ]));
}

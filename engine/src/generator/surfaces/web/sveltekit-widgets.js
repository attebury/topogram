// @ts-check

import { UI_GENERATOR_RENDERED_COMPONENT_PATTERNS } from "../../../ui/taxonomy.js";

/**
 * @typedef {{ id?: string, name?: string }} WidgetReference
 * @typedef {{ name: string, label?: string, role?: string }} DisplayField
 * @typedef {{ widget?: WidgetReference, region?: string, pattern?: string, display?: { fields?: DisplayField[] }, displayFields?: DisplayField[] }} WidgetUsage
 * @typedef {{ patterns?: string[] }} WidgetContract
 * @typedef {Record<string, WidgetContract>} WidgetContractMap
 * @typedef {{ itemsExpression?: string, widgetContracts?: WidgetContractMap, useTypescript?: boolean, screenId?: string|null, region?: string|null }} RenderOptions
 * @typedef {{ widgets?: WidgetUsage[] }} ScreenContract
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {WidgetUsage} usage
 * @returns {string}
 */
function widgetName(usage) {
  return usage?.widget?.name || usage?.widget?.id || "Widget";
}

/**
 * @param {WidgetUsage} usage
 * @returns {string}
 */
function widgetId(usage) {
  return usage?.widget?.id || "widget";
}

/**
 * @param {WidgetUsage} usage
 * @returns {DisplayField[]}
 */
function displayFields(usage) {
  const fields = Array.isArray(usage.displayFields) ? usage.displayFields : usage.display?.fields || [];
  return fields.filter((field) => field?.name);
}

/**
 * @param {WidgetUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function widgetAttrs(usage, options) {
  return [
    `data-topogram-widget="${escapeHtml(widgetId(usage))}"`,
    `data-topogram-region="${escapeHtml(options.region || usage.region || "")}"`,
    `data-topogram-screen="${escapeHtml(options.screenId || "")}"`
  ].join(" ");
}

/**
 * @param {WidgetUsage} usage
 * @returns {string}
 */
function displayFieldsLiteral(usage) {
  return JSON.stringify(displayFields(usage).map((field) => ({
    name: field.name,
    label: field.label || field.name,
    role: field.role || "metadata"
  })));
}

/**
 * @param {WidgetUsage} usage
 * @param {string[]} roles
 * @param {string} fallback
 * @returns {string}
 */
function fieldNameByRole(usage, roles, fallback) {
  const fields = displayFields(usage);
  return fields.find((field) => roles.includes(field.role || ""))?.name || fields[0]?.name || fallback;
}

/**
 * @param {WidgetUsage} usage
 * @param {WidgetContractMap | undefined} widgetContracts
 * @returns {string[]}
 */
function widgetPatterns(usage, widgetContracts) {
  const id = usage?.widget?.id;
  const contract = id ? widgetContracts?.[id] : null;
  return Array.isArray(contract?.patterns) ? contract.patterns : [];
}

/**
 * @param {WidgetUsage} usage
 * @param {WidgetContractMap | undefined} widgetContracts
 * @param {string} pattern
 * @returns {boolean}
 */
function usagePattern(usage, widgetContracts) {
  return usage?.pattern || widgetPatterns(usage, widgetContracts)[0] || null;
}

export function svelteKitWidgetUsageSupport(usage, widgetContracts) {
  const pattern = usagePattern(usage, widgetContracts);
  return {
    pattern,
    supported: UI_GENERATOR_RENDERED_COMPONENT_PATTERNS.has(pattern || "")
  };
}

/**
 * @param {WidgetUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderSummaryStats(usage, options) {
  const items = options.itemsExpression || "data.result.items";
  const fields = displayFields(usage);
  return `<section class="widget-card widget-summary" ${widgetAttrs(usage, options)}>
          <div>
            <p class="widget-eyebrow">Widget</p>
            <h2>${escapeHtml(widgetName(usage))}</h2>
          </div>
          <div class="summary-grid">
            <div>
              <strong>{${items}.length}</strong>
              <span>Total</span>
            </div>
            <div>
              <strong>${fields.length}</strong>
              <span>Fields</span>
            </div>
            <div>
              <strong>{${items}.filter((item) => item && (item.id ?? item.uuid ?? item.key)).length}</strong>
              <span>Identified</span>
            </div>
          </div>
        </section>`;
}

/**
 * @param {WidgetUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderCollectionTable(usage, options) {
  const items = options.itemsExpression || "data.result.items";
  const fields = displayFieldsLiteral(usage);
  return `<div class="widget-card widget-table" ${widgetAttrs(usage, options)}>
          <div class="widget-header">
            <div>
              <p class="widget-eyebrow">Widget</p>
              <h2>${escapeHtml(widgetName(usage))}</h2>
            </div>
            <span class="badge">{${items}.length} items</span>
          </div>
          <div class="table-wrap widget-table-wrap">
            <table class="resource-table data-grid">
              <thead>
                <tr>
                  {#each ${fields} as field}
                    <th data-topogram-display-field={field.name}>{field.label}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each ${items} as item}
                  <tr>
                    {#each ${fields} as field}
                      <td data-topogram-display-field={field.name}>{String(item?.[field.name] ?? "")}</td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>`;
}

/**
 * @param {WidgetUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderBoard(usage, options) {
  const items = options.itemsExpression || "data.result.items";
  const fields = displayFieldsLiteral(usage);
  const groupFieldName = fieldNameByRole(usage, ["status", "priority", "metadata"], "status");
  const titleFieldName = fieldNameByRole(usage, ["primary", "identifier"], "title");
  const groupField = JSON.stringify(groupFieldName);
  const titleField = JSON.stringify(titleFieldName);
  return `<div class="widget-card widget-board" ${widgetAttrs(usage, options)}>
          <div class="widget-header">
            <div>
              <p class="widget-eyebrow">Widget</p>
              <h2>${escapeHtml(widgetName(usage))}</h2>
            </div>
          </div>
          <div class="board-grid">
            {#each Array.from(new Set(${items}.map((item) => item?.[${groupField}] ?? "items"))) as group}
              <section class="board-column">
                <h3>{group}</h3>
	                {#each ${items}.filter((item) => (item?.[${groupField}] ?? "items") === group) as item}
	                  <div class="board-card">
	                    <strong data-topogram-display-field="${escapeHtml(titleFieldName)}">{item?.[${titleField}] ?? item.title ?? item.name ?? item.label ?? item.message ?? item.id ?? JSON.stringify(item)}</strong>
	                    <dl class="widget-field-list">
	                      {#each ${fields} as field}
	                        <div>
	                          <dt>{field.label}</dt>
	                          <dd data-topogram-display-field={field.name}>{String(item?.[field.name] ?? "")}</dd>
	                        </div>
	                      {/each}
	                    </dl>
	                  </div>
	                {/each}
	              </section>
	            {/each}
          </div>
        </div>`;
}

/**
 * @param {WidgetUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderCalendar(usage, options) {
  const items = options.itemsExpression || "data.result.items";
  const fields = displayFieldsLiteral(usage);
  const dateFieldName = fieldNameByRole(usage, ["date"], "date");
  const titleFieldName = fieldNameByRole(usage, ["primary", "identifier"], "title");
  const dateField = JSON.stringify(dateFieldName);
  const titleField = JSON.stringify(titleFieldName);
  return `<div class="widget-card widget-calendar" ${widgetAttrs(usage, options)}>
          <div class="widget-header">
            <div>
              <p class="widget-eyebrow">Widget</p>
              <h2>${escapeHtml(widgetName(usage))}</h2>
            </div>
          </div>
          <div class="calendar-list">
	            {#each ${items}.filter((item) => item?.[${dateField}]) as item}
	              <div class="calendar-card">
	                <span data-topogram-display-field="${escapeHtml(dateFieldName)}">{item?.[${dateField}]}</span>
	                <strong data-topogram-display-field="${escapeHtml(titleFieldName)}">{item?.[${titleField}] ?? item.title ?? item.name ?? item.label ?? item.message ?? item.id ?? JSON.stringify(item)}</strong>
	                <dl class="widget-field-list">
	                  {#each ${fields} as field}
	                    <div>
	                      <dt>{field.label}</dt>
	                      <dd data-topogram-display-field={field.name}>{String(item?.[field.name] ?? "")}</dd>
	                    </div>
	                  {/each}
	                </dl>
	              </div>
	            {/each}
	          </div>
        </div>`;
}

/**
 * @param {WidgetUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderUsage(usage, options) {
  const widgetContracts = options.widgetContracts || {};
  const { pattern } = svelteKitWidgetUsageSupport(usage, widgetContracts);
  if (pattern === "summary_stats") {
    return renderSummaryStats(usage, options);
  }
  if (pattern === "board_view") {
    return renderBoard(usage, options);
  }
  if (pattern === "calendar_view") {
    return renderCalendar(usage, options);
  }
  if (pattern === "resource_table" || pattern === "data_grid_view") {
    return renderCollectionTable(usage, options);
  }
  return "";
}

/**
 * @param {ScreenContract} screen
 * @param {string} region
 * @returns {WidgetUsage[]}
 */
export function svelteKitWidgetUsagesForRegion(screen, region) {
  return (screen?.widgets || []).filter((usage) => usage?.region === region);
}

/**
 * @param {ScreenContract} screen
 * @param {string} region
 * @returns {boolean}
 */
export function hasSvelteKitWidgetRegion(screen, region) {
  return svelteKitWidgetUsagesForRegion(screen, region).length > 0;
}

/**
 * @param {ScreenContract} screen
 * @param {string} region
 * @param {RenderOptions} [options]
 * @returns {string}
 */
export function renderSvelteKitWidgetRegion(screen, region, options = {}) {
  const rendered = svelteKitWidgetUsagesForRegion(screen, region)
    .map((usage) => renderUsage(usage, { ...options, region, screenId: options.screenId || screen?.id || null }))
    .filter(Boolean);
  if (rendered.length === 0) {
    return "";
  }
  return rendered.join("\n");
}

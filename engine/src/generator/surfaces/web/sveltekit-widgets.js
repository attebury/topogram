// @ts-check

import { UI_GENERATOR_RENDERED_COMPONENT_PATTERNS } from "../../../ui/taxonomy.js";

/**
 * @typedef {{ id?: string, name?: string }} WidgetReference
 * @typedef {{ widget?: WidgetReference, region?: string, pattern?: string }} WidgetUsage
 * @typedef {{ patterns?: string[] }} WidgetContract
 * @typedef {Record<string, WidgetContract>} WidgetContractMap
 * @typedef {{ itemsExpression?: string, widgetContracts?: WidgetContractMap, useTypescript?: boolean }} RenderOptions
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
  return `<section class="widget-card widget-summary" data-topogram-widget="${escapeHtml(widgetId(usage))}">
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
              <strong>{Object.keys(${items}[0] ?? {}).length}</strong>
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
  return `<div class="widget-card widget-table" data-topogram-widget="${escapeHtml(widgetId(usage))}">
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
                  {#each Object.keys(${items}[0] ?? {}).slice(0, 4) as field}
                    <th>{field}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each ${items} as item}
                  <tr>
                    {#each Object.keys(${items}[0] ?? {}).slice(0, 4) as field}
                      <td>{String(item?.[field] ?? "")}</td>
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
  return `<div class="widget-card widget-board" data-topogram-widget="${escapeHtml(widgetId(usage))}">
          <div class="widget-header">
            <div>
              <p class="widget-eyebrow">Widget</p>
              <h2>${escapeHtml(widgetName(usage))}</h2>
            </div>
          </div>
          <div class="board-grid">
            {#each Array.from(new Set(${items}.map((item) => item?.status ?? item?.state ?? item?.stage ?? item?.category ?? "items"))) as group}
              <section class="board-column">
                <h3>{group}</h3>
                {#each ${items}.filter((item) => (item?.status ?? item?.state ?? item?.stage ?? item?.category ?? "items") === group) as item}
                  <div class="board-card">{item.title ?? item.name ?? item.label ?? item.message ?? item.id ?? JSON.stringify(item)}</div>
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
  return `<div class="widget-card widget-calendar" data-topogram-widget="${escapeHtml(widgetId(usage))}">
          <div class="widget-header">
            <div>
              <p class="widget-eyebrow">Widget</p>
              <h2>${escapeHtml(widgetName(usage))}</h2>
            </div>
          </div>
          <div class="calendar-list">
            {#each ${items}.filter((item) => item?.date || item?.due_at || item?.dueAt || item?.created_at || item?.createdAt || item?.updated_at || item?.updatedAt) as item}
              <div class="calendar-card">
                <span>{item.date ?? item.due_at ?? item.dueAt ?? item.created_at ?? item.createdAt ?? item.updated_at ?? item.updatedAt}</span>
                <strong>{item.title ?? item.name ?? item.label ?? item.message ?? item.id ?? JSON.stringify(item)}</strong>
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
    .map((usage) => renderUsage(usage, options))
    .filter(Boolean);
  if (rendered.length === 0) {
    return "";
  }
  return rendered.join("\n");
}

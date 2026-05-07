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
function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

export function reactWidgetUsageSupport(usage, widgetContracts) {
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
  const items = options.itemsExpression || "items";
  return `<section className="widget-card widget-summary" data-topogram-widget="${escapeAttribute(widgetId(usage))}">
          <div>
            <p className="widget-eyebrow">Widget</p>
            <h2>${escapeText(widgetName(usage))}</h2>
          </div>
          <div className="summary-grid">
            <div>
              <strong>{${items}.length}</strong>
              <span>Total</span>
            </div>
            <div>
              <strong>{Object.keys(${items}[0] ?? {}).length}</strong>
              <span>Fields</span>
            </div>
            <div>
              <strong>{${items}.filter((item: any) => item && (item.id ?? item.uuid ?? item.key)).length}</strong>
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
  const items = options.itemsExpression || "items";
  const itemParam = options.useTypescript ? "(item: any)" : "(item)";
  return `<div className="widget-card widget-table" data-topogram-widget="${escapeAttribute(widgetId(usage))}">
          <div className="widget-header">
            <div>
              <p className="widget-eyebrow">Widget</p>
              <h2>${escapeText(widgetName(usage))}</h2>
            </div>
            <span className="badge">{${items}.length} items</span>
          </div>
          <div className="table-wrap widget-table-wrap">
            <table className="resource-table data-grid">
              <thead>
                <tr>
                  {Object.keys(${items}[0] ?? {}).slice(0, 4).map((field) => (
                    <th key={field}>{field}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {${items}.map(${itemParam} => (
                  <tr key={String(item.id ?? item.title ?? item.name ?? item.message)}>
                    {Object.keys(${items}[0] ?? {}).slice(0, 4).map((field) => (
                      <td key={field}>{String(item?.[field] ?? "")}</td>
                    ))}
                  </tr>
                ))}
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
  const items = options.itemsExpression || "items";
  const itemParam = options.useTypescript ? "(item: any)" : "(item)";
  return `<div className="widget-card widget-board" data-topogram-widget="${escapeAttribute(widgetId(usage))}">
          <div className="widget-header">
            <div>
              <p className="widget-eyebrow">Widget</p>
              <h2>${escapeText(widgetName(usage))}</h2>
            </div>
          </div>
          <div className="board-grid">
            {Array.from(new Set(${items}.map((item: any) => item?.status ?? item?.state ?? item?.stage ?? item?.category ?? "items"))).map((group) => (
              <section className="board-column" key={String(group)}>
                <h3>{String(group)}</h3>
                {${items}.filter(${itemParam} => (item?.status ?? item?.state ?? item?.stage ?? item?.category ?? "items") === group).map(${itemParam} => (
                  <div className="board-card" key={String(item.id ?? item.title ?? item.name)}>
                    {item.title ?? item.name ?? item.label ?? item.message ?? item.id ?? JSON.stringify(item)}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>`;
}

/**
 * @param {WidgetUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderCalendar(usage, options) {
  const items = options.itemsExpression || "items";
  const itemParam = options.useTypescript ? "(item: any)" : "(item)";
  return `<div className="widget-card widget-calendar" data-topogram-widget="${escapeAttribute(widgetId(usage))}">
          <div className="widget-header">
            <div>
              <p className="widget-eyebrow">Widget</p>
              <h2>${escapeText(widgetName(usage))}</h2>
            </div>
          </div>
          <div className="calendar-list">
            {${items}.filter(${itemParam} => item.date || item.due_at || item.dueAt || item.created_at || item.createdAt || item.updated_at || item.updatedAt).map(${itemParam} => (
              <div className="calendar-card" key={String(item.id ?? item.title ?? item.name)}>
                <span>{item.date ?? item.due_at ?? item.dueAt ?? item.created_at ?? item.createdAt ?? item.updated_at ?? item.updatedAt}</span>
                <strong>{item.title ?? item.name ?? item.label ?? item.message ?? item.id ?? JSON.stringify(item)}</strong>
              </div>
            ))}
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
  const { pattern } = reactWidgetUsageSupport(usage, widgetContracts);
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
export function reactWidgetUsagesForRegion(screen, region) {
  return (screen?.widgets || []).filter((usage) => usage?.region === region);
}

/**
 * @param {ScreenContract} screen
 * @param {string} region
 * @returns {boolean}
 */
export function hasReactWidgetRegion(screen, region) {
  return reactWidgetUsagesForRegion(screen, region).length > 0;
}

/**
 * @param {ScreenContract} screen
 * @param {string} region
 * @param {RenderOptions} [options]
 * @returns {string}
 */
export function renderReactWidgetRegion(screen, region, options = {}) {
  const rendered = reactWidgetUsagesForRegion(screen, region)
    .map((usage) => renderUsage(usage, options))
    .filter(Boolean);
  if (rendered.length === 0) {
    return "";
  }
  return rendered.join("\n");
}

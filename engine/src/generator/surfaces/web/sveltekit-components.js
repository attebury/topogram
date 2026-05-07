// @ts-check

import { UI_GENERATOR_RENDERED_COMPONENT_PATTERNS } from "../../../ui/taxonomy.js";

/**
 * @typedef {{ id?: string, name?: string }} ComponentReference
 * @typedef {{ component?: ComponentReference, region?: string, pattern?: string }} ComponentUsage
 * @typedef {{ patterns?: string[] }} ComponentContract
 * @typedef {Record<string, ComponentContract>} ComponentContractMap
 * @typedef {{ itemsExpression?: string, componentContracts?: ComponentContractMap, useTypescript?: boolean }} RenderOptions
 * @typedef {{ components?: ComponentUsage[] }} ScreenContract
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
 * @param {ComponentUsage} usage
 * @returns {string}
 */
function componentName(usage) {
  return usage?.component?.name || usage?.component?.id || "Component";
}

/**
 * @param {ComponentUsage} usage
 * @returns {string}
 */
function componentId(usage) {
  return usage?.component?.id || "component";
}

/**
 * @param {ComponentUsage} usage
 * @param {ComponentContractMap | undefined} componentContracts
 * @returns {string[]}
 */
function componentPatterns(usage, componentContracts) {
  const id = usage?.component?.id;
  const contract = id ? componentContracts?.[id] : null;
  return Array.isArray(contract?.patterns) ? contract.patterns : [];
}

/**
 * @param {ComponentUsage} usage
 * @param {ComponentContractMap | undefined} componentContracts
 * @param {string} pattern
 * @returns {boolean}
 */
function usagePattern(usage, componentContracts) {
  return usage?.pattern || componentPatterns(usage, componentContracts)[0] || null;
}

export function svelteKitComponentUsageSupport(usage, componentContracts) {
  const pattern = usagePattern(usage, componentContracts);
  return {
    pattern,
    supported: UI_GENERATOR_RENDERED_COMPONENT_PATTERNS.has(pattern || "")
  };
}

/**
 * @param {ComponentUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderSummaryStats(usage, options) {
  const items = options.itemsExpression || "data.result.items";
  return `<section class="component-card component-summary" data-topogram-component="${escapeHtml(componentId(usage))}">
          <div>
            <p class="component-eyebrow">Component</p>
            <h2>${escapeHtml(componentName(usage))}</h2>
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
 * @param {ComponentUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderCollectionTable(usage, options) {
  const items = options.itemsExpression || "data.result.items";
  return `<div class="component-card component-table" data-topogram-component="${escapeHtml(componentId(usage))}">
          <div class="component-header">
            <div>
              <p class="component-eyebrow">Component</p>
              <h2>${escapeHtml(componentName(usage))}</h2>
            </div>
            <span class="badge">{${items}.length} items</span>
          </div>
          <div class="table-wrap component-table-wrap">
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
 * @param {ComponentUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderBoard(usage, options) {
  const items = options.itemsExpression || "data.result.items";
  return `<div class="component-card component-board" data-topogram-component="${escapeHtml(componentId(usage))}">
          <div class="component-header">
            <div>
              <p class="component-eyebrow">Component</p>
              <h2>${escapeHtml(componentName(usage))}</h2>
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
 * @param {ComponentUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderCalendar(usage, options) {
  const items = options.itemsExpression || "data.result.items";
  return `<div class="component-card component-calendar" data-topogram-component="${escapeHtml(componentId(usage))}">
          <div class="component-header">
            <div>
              <p class="component-eyebrow">Component</p>
              <h2>${escapeHtml(componentName(usage))}</h2>
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
 * @param {ComponentUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderUsage(usage, options) {
  const componentContracts = options.componentContracts || {};
  const { pattern } = svelteKitComponentUsageSupport(usage, componentContracts);
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
 * @returns {ComponentUsage[]}
 */
export function svelteKitComponentUsagesForRegion(screen, region) {
  return (screen?.components || []).filter((usage) => usage?.region === region);
}

/**
 * @param {ScreenContract} screen
 * @param {string} region
 * @returns {boolean}
 */
export function hasSvelteKitComponentRegion(screen, region) {
  return svelteKitComponentUsagesForRegion(screen, region).length > 0;
}

/**
 * @param {ScreenContract} screen
 * @param {string} region
 * @param {RenderOptions} [options]
 * @returns {string}
 */
export function renderSvelteKitComponentRegion(screen, region, options = {}) {
  const rendered = svelteKitComponentUsagesForRegion(screen, region)
    .map((usage) => renderUsage(usage, options))
    .filter(Boolean);
  if (rendered.length === 0) {
    return "";
  }
  return rendered.join("\n");
}

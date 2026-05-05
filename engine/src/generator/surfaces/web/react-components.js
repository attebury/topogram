// @ts-check

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

export function reactComponentUsageSupport(usage, componentContracts) {
  const pattern = usagePattern(usage, componentContracts);
  return {
    pattern,
    supported: [
      "summary_stats",
      "board_view",
      "calendar_view",
      "resource_table",
      "data_grid_view"
    ].includes(pattern || "")
  };
}

/**
 * @param {ComponentUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderSummaryStats(usage, options) {
  const items = options.itemsExpression || "items";
  return `<section className="component-card component-summary" data-topogram-component="${escapeAttribute(componentId(usage))}">
          <div>
            <p className="component-eyebrow">Component</p>
            <h2>${escapeText(componentName(usage))}</h2>
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
 * @param {ComponentUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderCollectionTable(usage, options) {
  const items = options.itemsExpression || "items";
  const itemParam = options.useTypescript ? "(item: any)" : "(item)";
  return `<div className="component-card component-table" data-topogram-component="${escapeAttribute(componentId(usage))}">
          <div className="component-header">
            <div>
              <p className="component-eyebrow">Component</p>
              <h2>${escapeText(componentName(usage))}</h2>
            </div>
            <span className="badge">{${items}.length} items</span>
          </div>
          <div className="table-wrap component-table-wrap">
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
 * @param {ComponentUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderBoard(usage, options) {
  const items = options.itemsExpression || "items";
  const itemParam = options.useTypescript ? "(item: any)" : "(item)";
  return `<div className="component-card component-board" data-topogram-component="${escapeAttribute(componentId(usage))}">
          <div className="component-header">
            <div>
              <p className="component-eyebrow">Component</p>
              <h2>${escapeText(componentName(usage))}</h2>
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
 * @param {ComponentUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderCalendar(usage, options) {
  const items = options.itemsExpression || "items";
  const itemParam = options.useTypescript ? "(item: any)" : "(item)";
  return `<div className="component-card component-calendar" data-topogram-component="${escapeAttribute(componentId(usage))}">
          <div className="component-header">
            <div>
              <p className="component-eyebrow">Component</p>
              <h2>${escapeText(componentName(usage))}</h2>
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
 * @param {ComponentUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderUsage(usage, options) {
  const componentContracts = options.componentContracts || {};
  const { pattern } = reactComponentUsageSupport(usage, componentContracts);
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
export function reactComponentUsagesForRegion(screen, region) {
  return (screen?.components || []).filter((usage) => usage?.region === region);
}

/**
 * @param {ScreenContract} screen
 * @param {string} region
 * @returns {boolean}
 */
export function hasReactComponentRegion(screen, region) {
  return reactComponentUsagesForRegion(screen, region).length > 0;
}

/**
 * @param {ScreenContract} screen
 * @param {string} region
 * @param {RenderOptions} [options]
 * @returns {string}
 */
export function renderReactComponentRegion(screen, region, options = {}) {
  const rendered = reactComponentUsagesForRegion(screen, region)
    .map((usage) => renderUsage(usage, options))
    .filter(Boolean);
  if (rendered.length === 0) {
    return "";
  }
  return rendered.join("\n");
}

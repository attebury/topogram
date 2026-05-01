// @ts-check

/**
 * @typedef {{ id?: string, name?: string }} ComponentReference
 * @typedef {{ component?: ComponentReference, region?: string }} ComponentUsage
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
function hasPattern(usage, componentContracts, pattern) {
  return componentPatterns(usage, componentContracts).includes(pattern);
}

/**
 * @param {ComponentUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderSummaryStats(usage, options) {
  const items = options.itemsExpression || "items";
  const itemParam = options.useTypescript ? "(item: any)" : "(item)";
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
              <strong>{${items}.filter(${itemParam} => item.status === "active").length}</strong>
              <span>Active</span>
            </div>
            <div>
              <strong>{${items}.filter(${itemParam} => item.status === "completed").length}</strong>
              <span>Completed</span>
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
                  <th>Name</th>
                  <th>Status</th>
                  <th>Summary</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {${items}.map(${itemParam} => (
                  <tr key={String(item.id ?? item.title ?? item.name ?? item.message)}>
                    <td>
                      <div className="cell-stack">
                        <strong>{item.title ?? item.name ?? item.message ?? item.id}</strong>
                        {(item.description || item.body) ? <span className="cell-secondary">{item.description ?? item.body}</span> : null}
                      </div>
                    </td>
                    <td><span className="badge">{item.status ?? "active"}</span></td>
                    <td>{item.priority ?? item.created_at ?? item.createdAt ?? "Ready"}</td>
                    <td>{item.owner_id ?? item.ownerId ?? "Unassigned"}</td>
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
            {["draft", "active", "completed", "archived"].map((status) => (
              <section className="board-column" key={status}>
                <h3>{status}</h3>
                {${items}.filter(${itemParam} => item.status === status).map(${itemParam} => (
                  <div className="board-card" key={String(item.id ?? item.title ?? item.name)}>
                    {item.title ?? item.name ?? item.message ?? item.id}
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
            {${items}.filter(${itemParam} => item.due_at || item.dueAt || item.created_at || item.createdAt).map(${itemParam} => (
              <div className="calendar-card" key={String(item.id ?? item.title ?? item.name)}>
                <span>{item.due_at ?? item.dueAt ?? item.created_at ?? item.createdAt}</span>
                <strong>{item.title ?? item.name ?? item.message ?? item.id}</strong>
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
  if (hasPattern(usage, componentContracts, "summary_stats")) {
    return renderSummaryStats(usage, options);
  }
  if (hasPattern(usage, componentContracts, "board_view")) {
    return renderBoard(usage, options);
  }
  if (hasPattern(usage, componentContracts, "calendar_view")) {
    return renderCalendar(usage, options);
  }
  if (hasPattern(usage, componentContracts, "resource_table") || hasPattern(usage, componentContracts, "data_grid_view")) {
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

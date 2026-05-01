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
function hasPattern(usage, componentContracts, pattern) {
  return componentPatterns(usage, componentContracts).includes(pattern);
}

/**
 * @param {ComponentUsage} usage
 * @param {RenderOptions} options
 * @returns {string}
 */
function renderSummaryStats(usage, options) {
  const items = options.itemsExpression || "data.result.items";
  const itemParam = options.useTypescript ? "(item: any)" : "(item)";
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
                  <th>Task</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {#each ${items} as task}
                  <tr>
                    <td>
                      <div class="cell-stack">
                        <a href={'/tasks/' + task.id}><strong>{task.title}</strong></a>
                        {#if task.description}<span class="cell-secondary">{task.description}</span>{/if}
                      </div>
                    </td>
                    <td><span class="badge">{task.status}</span></td>
                    <td>{task.priority ?? "medium"}</td>
                    <td>{task.owner_id ?? task.ownerId ?? "Unassigned"}</td>
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
  const taskParam = options.useTypescript ? "(task: any)" : "(task)";
  return `<div class="component-card component-board" data-topogram-component="${escapeHtml(componentId(usage))}">
          <div class="component-header">
            <div>
              <p class="component-eyebrow">Component</p>
              <h2>${escapeHtml(componentName(usage))}</h2>
            </div>
          </div>
          <div class="board-grid">
            {#each ["draft", "active", "completed", "archived"] as status}
              <section class="board-column">
                <h3>{status}</h3>
                {#each ${items}.filter(${taskParam} => task.status === status) as task}
                  <a class="board-card" href={'/tasks/' + task.id}>{task.title}</a>
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
  const taskParam = options.useTypescript ? "(task: any)" : "(task)";
  return `<div class="component-card component-calendar" data-topogram-component="${escapeHtml(componentId(usage))}">
          <div class="component-header">
            <div>
              <p class="component-eyebrow">Component</p>
              <h2>${escapeHtml(componentName(usage))}</h2>
            </div>
          </div>
          <div class="calendar-list">
            {#each ${items}.filter(${taskParam} => task.due_at || task.dueAt) as task}
              <a href={'/tasks/' + task.id}>
                <span>{task.due_at ?? task.dueAt}</span>
                <strong>{task.title}</strong>
              </a>
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

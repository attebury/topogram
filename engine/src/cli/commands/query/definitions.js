// @ts-check

/**
 * @typedef {{
 *   name: string,
 *   purpose: string,
 *   description: string,
 *   selectors: string[],
 *   args: string[],
 *   output: string,
 *   example: string
 * }} QueryDefinition
 *
 * @typedef {{
 *   type: "query_list",
 *   version: 1,
 *   queries: QueryDefinition[]
 * }} QueryListPayload
 *
 * @typedef {{
 *   type: "query_definition",
 *   version: 1,
 *   query: QueryDefinition
 * }} QueryDefinitionPayload
 */

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @returns {QueryDefinition[]}
 */
export function queryDefinitions() {
  const contextSelectors = ["mode", "capability", "workflow", "projection", "widget", "entity", "journey", "surface", "domain", "pitch", "requirement", "acceptance", "task", "plan", "bug", "document", "from-topogram"];
  return [
    {
      name: "slice",
      purpose: "Give an agent the smallest graph slice needed to reason about one selected semantic surface.",
      description: "Return a focused semantic context slice for one selected surface.",
      selectors: ["capability", "workflow", "projection", "widget", "entity", "journey", "domain", "pitch", "requirement", "acceptance", "task", "plan", "bug", "document"],
      args: ["[path]", "[selectors]", "[--json]"],
      output: "context_slice",
      example: "topogram query slice ./topo --task task_implement_audit_writer"
    },
    {
      name: "verification-targets",
      purpose: "Map a selected change or mode to the smallest verification set worth running.",
      description: "Return the smallest verification target set for a mode, selector, or diff.",
      selectors: contextSelectors.filter((selector) => selector !== "surface" && selector !== "domain" && selector !== "pitch" && selector !== "requirement" && selector !== "acceptance" && selector !== "plan" && selector !== "bug" && selector !== "document"),
      args: ["[path]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "verification_targets",
      example: "topogram query verification-targets ./topo --widget widget_data_grid"
    },
    {
      name: "widget-behavior",
      purpose: "Show how reusable widget behavior is realized by projection usage.",
      description: "Return widget behavior realization data grouped by widget, screen, capability, and effect.",
      selectors: ["projection", "widget"],
      args: ["[path]", "[--projection <id>]", "[--widget <id>]", "[--json]"],
      output: "widget_behavior_report",
      example: "topogram query widget-behavior ./topo --projection proj_web_surface --widget widget_data_grid --json"
    },
    {
      name: "change-plan",
      purpose: "Summarize what a selected change affects before code or Topogram edits start.",
      description: "Return the semantic change plan, generator targets, risk, and alignment recommendations.",
      selectors: contextSelectors,
      args: ["[path]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "change_plan_query",
      example: "topogram query change-plan ./topo --widget widget_data_grid"
    },
    {
      name: "review-packet",
      purpose: "Bundle the context a human or agent needs to review a selected semantic change.",
      description: "Return the review packet for a selected change or diff.",
      selectors: contextSelectors,
      args: ["[path]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "review_packet_query",
      example: "topogram query review-packet ./topo --widget widget_data_grid"
    },
    {
      name: "resolved-workflow-context",
      purpose: "Resolve workflow guidance and artifact load order for a selected mode or change.",
      description: "Return resolved workflow guidance, artifact load order, preset policy, and recommended artifact queries.",
      selectors: [...contextSelectors.filter((selector) => selector !== "document"), "provider", "preset"],
      args: ["[path]", "[--mode <id>]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "resolved_workflow_context_query",
      example: "topogram query resolved-workflow-context ./topo --mode modeling --widget widget_data_grid --json"
    },
    {
      name: "single-agent-plan",
      purpose: "Give one coding agent a bounded plan, artifact set, and write guidance.",
      description: "Return a single-agent operating plan for a mode and optional selector.",
      selectors: contextSelectors.filter((selector) => selector !== "document"),
      args: ["[path]", "[--mode <id>]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "single_agent_plan_query",
      example: "topogram query single-agent-plan ./topo --mode modeling --widget widget_data_grid --json"
    },
    {
      name: "risk-summary",
      purpose: "Surface behavioral, ownership, and verification risks for a selected change.",
      description: "Return the risk summary for a selected change, mode, or diff.",
      selectors: contextSelectors,
      args: ["[path]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "risk_summary_query",
      example: "topogram query risk-summary ./topo --widget widget_data_grid"
    },
    {
      name: "proceed-decision",
      purpose: "Tell a human or agent whether enough context and proof exist to proceed.",
      description: "Return a proceed/no-go decision for the current selected work.",
      selectors: contextSelectors,
      args: ["[path]", "[--mode <id>]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "proceed_decision_query",
      example: "topogram query proceed-decision ./topo --mode verification"
    },
    {
      name: "write-scope",
      purpose: "Define where an agent may edit for a selected semantic surface.",
      description: "Return safe edit boundaries for a selected mode or semantic surface.",
      selectors: contextSelectors.filter((selector) => selector !== "surface" && selector !== "document"),
      args: ["[path]", "[selectors]", "[--from-topogram <path>]", "[--json]"],
      output: "write_scope_query",
      example: "topogram query write-scope ./topo --widget widget_data_grid"
    }
  ];
}

/**
 * @returns {QueryListPayload}
 */
export function buildQueryListPayload() {
  return {
    type: "query_list",
    version: 1,
    queries: queryDefinitions()
  };
}

/**
 * @param {string} name
 * @returns {QueryDefinitionPayload}
 */
export function buildQueryShowPayload(name) {
  const query = queryDefinitions().find((entry) => entry.name === name);
  if (!query) {
    const known = queryDefinitions().map((entry) => entry.name).join(", ");
    throw new Error(`Unknown query '${name}'. Run 'topogram query list' to inspect available queries. Known queries: ${known}`);
  }
  return {
    type: "query_definition",
    version: 1,
    query
  };
}

/**
 * @returns {void}
 */
export function printQueryHelp() {
  console.log("Usage: topogram query list [--json]");
  console.log("   or: topogram query show <name> [--json]");
  console.log("   or: topogram query widget-behavior [path] [--projection <id>] [--widget <id>] [--json]");
  console.log("   or: topogram query <name> [path] [selectors] [--json]");
  console.log("");
  console.log("Agent-facing queries return focused JSON packets for context, review, verification, and generation follow-up.");
  console.log("");
  console.log("Common queries:");
  for (const query of queryDefinitions()) {
    console.log(`  ${query.name}`);
    console.log(`    ${query.description}`);
    console.log(`    example: ${query.example}`);
  }
}

/**
 * @param {QueryDefinitionPayload} payload
 * @returns {void}
 */
export function printQueryDefinition(payload) {
  const query = payload.query;
  console.log(`Query: ${query.name}`);
  console.log(`Purpose: ${query.purpose}`);
  console.log(`Description: ${query.description}`);
  console.log(`Output: ${query.output}`);
  console.log(`Arguments: ${query.args.join(" ")}`);
  console.log(`Selectors: ${query.selectors.join(", ") || "none"}`);
  console.log(`Example: ${query.example}`);
}

/**
 * @param {QueryListPayload} payload
 * @returns {void}
 */
export function printQueryList(payload) {
  console.log("Topogram queries:");
  for (const query of payload.queries) {
    console.log(`- ${query.name}: ${query.description}`);
    console.log(`  selectors: ${query.selectors.join(", ") || "none"}`);
    console.log(`  example: ${query.example}`);
  }
}

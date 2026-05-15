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
      name: "extract-plan",
      purpose: "Summarize brownfield extraction candidates, package extractor context, and adoption review state.",
      description: "Return the extract/adopt plan for an extracted workspace, including trusted extraction provenance and next review commands.",
      selectors: ["provider", "preset"],
      args: ["[path]", "[--json]"],
      output: "extract_plan_query",
      example: "topogram query extract-plan ./extracted-topogram --json"
    },
    {
      name: "multi-agent-plan",
      purpose: "Split extract/adopt review into serialized and parallel agent lanes.",
      description: "Return lane ownership, handoff packets, overlap rules, and package extractor context for extract/adopt mode.",
      selectors: ["mode", "provider", "preset"],
      args: ["[path]", "--mode extract-adopt", "[--json]"],
      output: "multi_agent_plan",
      example: "topogram query multi-agent-plan ./extracted-topogram --mode extract-adopt --json"
    },
    {
      name: "work-packet",
      purpose: "Give one extract/adopt lane its allowed inputs, write scope, blockers, and handoff packet.",
      description: "Return a lane-scoped work packet for extract/adopt mode.",
      selectors: ["mode", "lane"],
      args: ["[path]", "--mode extract-adopt", "--lane <id>", "[--json]"],
      output: "work_packet",
      example: "topogram query work-packet ./extracted-topogram --mode extract-adopt --lane adoption_operator --json"
    },
    {
      name: "lane-status",
      purpose: "Show which extract/adopt lanes are ready, blocked, or complete.",
      description: "Return artifact-derived lane status for extract/adopt mode.",
      selectors: ["mode"],
      args: ["[path]", "--mode extract-adopt", "[--json]"],
      output: "lane_status_query",
      example: "topogram query lane-status ./extracted-topogram --mode extract-adopt --json"
    },
    {
      name: "handoff-status",
      purpose: "Show extract/adopt handoff packet status across lanes.",
      description: "Return handoff readiness and blockers for extract/adopt mode.",
      selectors: ["mode"],
      args: ["[path]", "--mode extract-adopt", "[--json]"],
      output: "handoff_status_query",
      example: "topogram query handoff-status ./extracted-topogram --mode extract-adopt --json"
    },
    {
      name: "sdlc-available",
      purpose: "Show SDLC work that is ready to be claimed or shaped.",
      description: "Return unclaimed active tasks, unresolved bugs, and approved requirements without active tasks.",
      selectors: [],
      args: ["[path]", "[--json]"],
      output: "sdlc_available_query",
      example: "topogram query sdlc-available ./topo --json"
    },
    {
      name: "sdlc-claimed",
      purpose: "Show claimed and in-progress SDLC tasks grouped by actor.",
      description: "Return claimed work, optionally filtered by --actor.",
      selectors: ["actor"],
      args: ["[path]", "[--actor <id>]", "[--json]"],
      output: "sdlc_claimed_query",
      example: "topogram query sdlc-claimed ./topo --actor actor_coding_agent --json"
    },
    {
      name: "sdlc-blockers",
      purpose: "Show SDLC task blockers and reciprocal block issues.",
      description: "Return blocked tasks, unmet blockers, and block/blocked_by reciprocity problems.",
      selectors: ["task"],
      args: ["[path]", "[--task <id>]", "[--json]"],
      output: "sdlc_blockers_query",
      example: "topogram query sdlc-blockers ./topo --task task_implement_audit_writer --json"
    },
    {
      name: "sdlc-proof-gaps",
      purpose: "Show missing proof before a task can be completed.",
      description: "Return missing requirement, acceptance, verification, or DoD proof for one task or all open tasks.",
      selectors: ["task"],
      args: ["[path]", "[--task <id>]", "[--json]"],
      output: "sdlc_proof_gaps_query",
      example: "topogram query sdlc-proof-gaps ./topo --task task_implement_audit_writer --json"
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

// @ts-check

import { ensureTrailingNewline } from "../shared.js";
import { uiWidgetCandidates } from "./candidates.js";

/**
 * @param {string} track
 * @param {any} candidates
 * @returns {string}
 */
export function reportMarkdown(track, candidates) {
  if (track === "db") {
    const seamLines = (candidates.maintained_seams || []).flatMap((/** @type {any} */ seam) => [
      `- \`${seam.id_hint}\` tool \`${seam.tool}\` confidence ${seam.confidence || "unknown"} schema \`${seam.schemaPath || "none"}\` migrations \`${seam.migrationsPath || "review-required"}\` missing decisions ${(seam.missing_decisions || []).length}`,
      `  - project config target: \`${seam.project_config_target?.path || "topology.runtimes[].migration"}\``,
      `  - evidence: ${(seam.evidence || []).slice(0, 3).map((/** @type {string} */ item) => `\`${item}\``).join(", ") || "_none_"}`,
      `  - manual next: ${(seam.manual_next_steps || []).slice(0, 2).join(" ")}`
    ]);
    return ensureTrailingNewline(
      `# DB Import Report\n\n- Entities: ${candidates.entities.length}\n- Enums: ${candidates.enums.length}\n- Relations: ${candidates.relations.length}\n- Indexes: ${candidates.indexes.length}\n- Maintained DB migration seams: ${(candidates.maintained_seams || []).length}\n\n## Maintained DB Migration Seam Candidates\n\n${seamLines.length ? seamLines.join("\n") : "- none"}\n`
    );
  }
  if (track === "api") {
    return ensureTrailingNewline(
      `# API Import Report\n\n- Capabilities: ${candidates.capabilities.length}\n- Routes: ${candidates.routes.length}\n- Stacks: ${candidates.stacks.length ? candidates.stacks.join(", ") : "none"}\n`
    );
  }
  if (track === "ui") {
    const widgets = uiWidgetCandidates(candidates);
    const shapes = candidates.shapes || [];
    const flows = candidates.flows || [];
    const widgetLines = widgets.map((widget) =>
      `- \`${widget.id_hint}\` confidence ${widget.confidence || "unknown"} pattern \`${widget.pattern || widget.inferred_pattern || "unknown"}\` region \`${widget.region || widget.inferred_region || "unknown"}\` events ${(widget.inferred_events || []).length} evidence ${(widget.evidence || widget.provenance || []).length} missing decisions ${(widget.missing_decisions || []).length}`
    );
    const flowLines = flows.map((/** @type {any} */ flow) =>
      `- \`${flow.id_hint}\` type \`${flow.flow_type}\` confidence ${flow.confidence || "unknown"} routes ${(flow.route_paths || []).map((/** @type {string} */ route) => `\`${route}\``).join(", ") || "_none_"} missing decisions ${(flow.missing_decisions || []).length}`
    );
    return ensureTrailingNewline(
      `# UI Import Report\n\n- Screens: ${candidates.screens.length}\n- Routes: ${candidates.routes.length}\n- Actions: ${candidates.actions.length}\n- Flow candidates: ${flows.length}\n- Widgets: ${widgets.length}\n- Event payload shapes: ${shapes.length}\n- Stacks: ${candidates.stacks.length ? candidates.stacks.join(", ") : "none"}\n\n## Flow Candidates\n\n${flowLines.length ? flowLines.join("\n") : "- none"}\n\n## Widget Candidates\n\n${widgetLines.length ? widgetLines.join("\n") : "- none"}\n\n## Next Validation\n\n- Review flow candidates in \`topo/candidates/app/ui/candidates.json\` before adding shared UI contract behavior.\n- Review candidates under \`topo/candidates/app/ui/drafts/widgets/**\`.\n- Run \`topogram import plan <path>\` before adoption.\n- After adoption, run \`topogram check <path>\`, \`topogram widget check <path>\`, and \`topogram widget behavior <path>\`.\n`
    );
  }
  if (track === "cli") {
    const commandLines = (candidates.commands || []).map((/** @type {any} */ command) =>
      `- \`${command.command_id || command.id_hint}\` usage \`${command.usage || "unknown"}\` effects ${(command.effects || []).map((/** @type {any} */ effect) => `\`${effect}\``).join(", ") || "_none_"}`
    );
    return ensureTrailingNewline(
      `# CLI Import Report\n\n- Commands: ${candidates.commands.length}\n- Capabilities: ${candidates.capabilities.length}\n- CLI surfaces: ${candidates.surfaces.length}\n\n## Command Candidates\n\n${commandLines.length ? commandLines.join("\n") : "- none"}\n`
    );
  }
  if (track === "verification") {
    return ensureTrailingNewline(
      `# Verification Import Report\n\n- Verifications: ${candidates.verifications.length}\n- Scenarios: ${candidates.scenarios.length}\n- Frameworks: ${candidates.frameworks.length ? candidates.frameworks.join(", ") : "none"}\n- Scripts: ${candidates.scripts.length}\n`
    );
  }
  return ensureTrailingNewline(
    `# Workflow Import Report\n\n- Workflows: ${candidates.workflows.length}\n- States: ${candidates.workflow_states.length}\n- Transitions: ${candidates.workflow_transitions.length}\n`
  );
}

/**
 * @param {Record<string, any>} candidates
 * @param {string[]} tracks
 * @returns {string}
 */
export function appReportMarkdown(candidates, tracks) {
  return ensureTrailingNewline(
    `# App Import Report\n\nTracks: ${tracks.join(", ")}\n\n## DB\n\n- Entities: ${candidates.db?.entities?.length || 0}\n- Enums: ${candidates.db?.enums?.length || 0}\n- Relations: ${candidates.db?.relations?.length || 0}\n- Maintained DB migration seams: ${candidates.db?.maintained_seams?.length || 0}\n\n## API\n\n- Capabilities: ${candidates.api?.capabilities?.length || 0}\n- Routes: ${candidates.api?.routes?.length || 0}\n- Stacks: ${candidates.api?.stacks?.length ? candidates.api.stacks.join(", ") : "none"}\n\n## UI\n\n- Screens: ${candidates.ui?.screens?.length || 0}\n- Routes: ${candidates.ui?.routes?.length || 0}\n- Actions: ${candidates.ui?.actions?.length || 0}\n- Flow candidates: ${candidates.ui?.flows?.length || 0}\n- Widgets: ${uiWidgetCandidates(candidates.ui).length}\n- Event payload shapes: ${candidates.ui?.shapes?.length || 0}\n- Stacks: ${candidates.ui?.stacks?.length ? candidates.ui.stacks.join(", ") : "none"}\n\n## CLI\n\n- Commands: ${candidates.cli?.commands?.length || 0}\n- Capabilities: ${candidates.cli?.capabilities?.length || 0}\n- CLI surfaces: ${candidates.cli?.surfaces?.length || 0}\n\n## Workflows\n\n- Workflows: ${candidates.workflows?.workflows?.length || 0}\n- States: ${candidates.workflows?.workflow_states?.length || 0}\n- Transitions: ${candidates.workflows?.workflow_transitions?.length || 0}\n\n## Verification\n\n- Verifications: ${candidates.verification?.verifications?.length || 0}\n- Scenarios: ${candidates.verification?.scenarios?.length || 0}\n- Frameworks: ${candidates.verification?.frameworks?.length ? candidates.verification.frameworks.join(", ") : "none"}\n- Scripts: ${candidates.verification?.scripts?.length || 0}\n`
  );
}

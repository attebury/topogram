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
    return ensureTrailingNewline(
      `# DB Import Report\n\n- Entities: ${candidates.entities.length}\n- Enums: ${candidates.enums.length}\n- Relations: ${candidates.relations.length}\n- Indexes: ${candidates.indexes.length}\n`
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
    const widgetLines = widgets.map((widget) =>
      `- \`${widget.id_hint}\` confidence ${widget.confidence || "unknown"} pattern \`${widget.pattern || widget.inferred_pattern || "unknown"}\` region \`${widget.region || widget.inferred_region || "unknown"}\` events ${(widget.inferred_events || []).length} evidence ${(widget.evidence || widget.provenance || []).length} missing decisions ${(widget.missing_decisions || []).length}`
    );
    return ensureTrailingNewline(
      `# UI Import Report\n\n- Screens: ${candidates.screens.length}\n- Routes: ${candidates.routes.length}\n- Actions: ${candidates.actions.length}\n- Widgets: ${widgets.length}\n- Event payload shapes: ${shapes.length}\n- Stacks: ${candidates.stacks.length ? candidates.stacks.join(", ") : "none"}\n\n## Widget Candidates\n\n${widgetLines.length ? widgetLines.join("\n") : "- none"}\n\n## Next Validation\n\n- Review candidates under \`topogram/candidates/app/ui/drafts/widgets/**\`.\n- Run \`topogram import plan <path>\` before adoption.\n- After adoption, run \`topogram check <path>\`, \`topogram widget check <path>\`, and \`topogram widget behavior <path>\`.\n`
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
    `# App Import Report\n\nTracks: ${tracks.join(", ")}\n\n## DB\n\n- Entities: ${candidates.db?.entities?.length || 0}\n- Enums: ${candidates.db?.enums?.length || 0}\n- Relations: ${candidates.db?.relations?.length || 0}\n\n## API\n\n- Capabilities: ${candidates.api?.capabilities?.length || 0}\n- Routes: ${candidates.api?.routes?.length || 0}\n- Stacks: ${candidates.api?.stacks?.length ? candidates.api.stacks.join(", ") : "none"}\n\n## UI\n\n- Screens: ${candidates.ui?.screens?.length || 0}\n- Routes: ${candidates.ui?.routes?.length || 0}\n- Actions: ${candidates.ui?.actions?.length || 0}\n- Widgets: ${uiWidgetCandidates(candidates.ui).length}\n- Event payload shapes: ${candidates.ui?.shapes?.length || 0}\n- Stacks: ${candidates.ui?.stacks?.length ? candidates.ui.stacks.join(", ") : "none"}\n\n## Workflows\n\n- Workflows: ${candidates.workflows?.workflows?.length || 0}\n- States: ${candidates.workflows?.workflow_states?.length || 0}\n- Transitions: ${candidates.workflows?.workflow_transitions?.length || 0}\n\n## Verification\n\n- Verifications: ${candidates.verification?.verifications?.length || 0}\n- Scenarios: ${candidates.verification?.scenarios?.length || 0}\n- Frameworks: ${candidates.verification?.frameworks?.length ? candidates.verification.frameworks.join(", ") : "none"}\n- Scripts: ${candidates.verification?.scripts?.length || 0}\n`
  );
}

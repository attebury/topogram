// @ts-check
import { normalizeEndpointPathForMatch, SCALAR_FIELD_TYPES } from "../import-app/index.js";
import { canonicalCandidateTerm, ensureTrailingNewline, idHintify, titleCase } from "../../text-helpers.js";
import { renderMarkdownDoc } from "../shared.js";
import {
  buildAuthClaimReviewGuidance,
  buildAuthOwnershipReviewGuidance,
  buildAuthPermissionReviewGuidance,
  formatAuthClaimHintInline,
  formatAuthOwnershipHintInline,
  formatAuthPermissionHintInline
} from "./auth.js";

/** @param {string|null|undefined} value @returns {string} */
function quoteString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** @param {string} fieldType @param {Set<any>} knownEnums @returns {any} */
export function normalizeCandidateFieldType(fieldType, knownEnums = new Set()) {
  const normalized = idHintify(fieldType);
  if (SCALAR_FIELD_TYPES.has(normalized)) {
    return normalized;
  }
  if (knownEnums.has(normalized)) {
    return normalized;
  }
  return normalized || "string";
}

/** @param {WorkflowRecord} record @returns {any} */
export function renderCandidateMetadataComments(record) {
  const lines = [
    `# imported confidence: ${record.confidence || "unknown"}`,
    `# imported source_kind: ${record.source_kind || "unknown"}`
  ];
  if (record.inference_summary) {
    lines.push(`# imported inference: ${record.inference_summary}`);
  }
  for (const provenance of (record.provenance || []).slice(0, 3)) {
    lines.push(`# imported provenance: ${provenance}`);
  }
  if ((record.provenance || []).length > 3) {
    lines.push(`# imported provenance_more: ${(record.provenance || []).length - 3}`);
  }
  return lines.join("\n");
}

/** @param {WorkflowRecord} record @param {Set<any>} knownEnums @returns {any} */
export function renderCandidateEntity(record, knownEnums = new Set()) {
  const fields = record.fields || [];
  const primaryKeys = fields.filter((/** @type {any} */ field) => field.primary_key).map((/** @type {any} */ field) => field.name);
  const uniqueKeys = fields.filter((/** @type {any} */ field) => field.unique && !field.primary_key).map((/** @type {any} */ field) => field.name);
  const fieldLines = fields.map((/** @type {any} */ field) => {
    const fieldType = normalizeCandidateFieldType(field.field_type, knownEnums);
    const requiredness = field.required ? "required" : "optional";
    return `    ${field.name} ${fieldType} ${requiredness}`;
  });
  const lines = [
    `entity ${record.id_hint} {`,
    `  name "${record.label}"`,
    `  description "Candidate entity imported from brownfield schema evidence"`,
    "",
    "  fields {",
    ...fieldLines,
    "  }"
  ];
  if (primaryKeys.length > 0 || uniqueKeys.length > 0) {
    lines.push("", "  keys {");
    if (primaryKeys.length > 0) {
      lines.push(`    primary [${primaryKeys.join(", ")}]`);
    }
    if (uniqueKeys.length > 0) {
      lines.push(`    unique [${uniqueKeys.join(", ")}]`);
    }
    lines.push("  }");
  }
  lines.push("", "  status active", "}");
  return ensureTrailingNewline(`${renderCandidateMetadataComments(record)}\n${lines.join("\n")}`);
}

/** @param {WorkflowRecord} record @returns {any} */
export function renderCandidateEnum(record) {
  return ensureTrailingNewline(
    `${renderCandidateMetadataComments(record)}\n${[
      `enum ${record.id_hint} {`,
      `  values [${(record.values || []).join(", ")}]`,
      "}"
    ].join("\n")}`
  );
}

/** @param {WorkflowRecord} record @returns {any} */
export function inferCapabilityVerb(record) {
  const id = record.id_hint || "";
  if (id.startsWith("cap_create_")) return "creates";
  if (id.startsWith("cap_update_") || (record.endpoint?.method || "").toUpperCase() === "PATCH") return "updates";
  if (id.startsWith("cap_delete_") || (record.endpoint?.method || "").toUpperCase() === "DELETE") return "deletes";
  return "reads";
}

/** @param {WorkflowRecord} record @returns {any} */
export function inferCapabilityEntityId(record) {
  if (record.entity_id) {
    return record.entity_id;
  }
  const pathSegments = normalizeEndpointPathForMatch(record.endpoint?.path || "")
    .split("/")
    .filter(Boolean)
    .filter((/** @type {any} */ segment) => segment !== "{}");
  const resourceSegment = pathSegments[0] || record.id_hint.replace(/^cap_(create|update|delete|get|list)_/, "");
  return `entity_${idHintify(canonicalCandidateTerm(resourceSegment))}`;
}

/** @param {WorkflowRecord} record @param {string} direction @returns {any} */
export function shapeIdForCapability(record, direction) {
  const stem = record.id_hint.replace(/^cap_/, "");
  return direction === "input" ? `shape_input_${stem}` : `shape_output_${stem}`;
}

/** @param {string} shapeId @param {string} label @param {any[]} fields @param {string|null} [sourceKind] @returns {any} */
export function renderCandidateShape(shapeId, label, fields, sourceKind = null) {
  /** @param {any} field @returns {{ name: string, fieldType: string, requiredness: string }} */
  function normalizeField(field) {
    if (typeof field === "string") {
      return { name: field, fieldType: "string", requiredness: "optional" };
    }
    return {
      name: field?.name || "id",
      fieldType: field?.field_type || field?.type || "string",
      requiredness: field?.required ? "required" : "optional"
    };
  }
  const lines = [
    `shape ${shapeId} {`,
    `  name "${label}"`,
    sourceKind === "ui_widget_event"
      ? `  description "Candidate event payload shape imported from brownfield UI interaction evidence"`
      : `  description "Candidate shape imported from brownfield API evidence"`,
    "",
    "  fields {"
  ];
  for (const field of fields) {
    const normalized = normalizeField(field);
    lines.push(`    ${normalized.name} ${normalized.fieldType} ${normalized.requiredness}`);
  }
  lines.push("  }", "", "  status active", "}");
  return ensureTrailingNewline(lines.join("\n"));
}

/** @param {WorkflowRecord} record @param {any} inputShapeId @param {any} outputShapeId @returns {any} */
export function renderCandidateCapability(record, inputShapeId, outputShapeId) {
  if (record.track === "cli" || record.source_kind === "cli_command") {
    const lines = [
      `capability ${record.id_hint} {`,
      `  name "${record.label}"`,
      `  description "Candidate capability imported from brownfield CLI command evidence"`,
      "",
      "  status active",
      "}"
    ];
    return ensureTrailingNewline(`${renderCandidateMetadataComments(record)}\n${lines.join("\n")}`);
  }

  const operationKind = inferCapabilityVerb(record);
  const entityId = inferCapabilityEntityId(record);
  const lines = [
    `capability ${record.id_hint} {`,
    `  name "${record.label}"`,
    `  description "Candidate capability imported from brownfield API evidence"`,
    ""
  ];
  if (record.auth_hint === "secured") {
    lines.push("  actors [user]", "");
  }
  lines.push(`  ${operationKind} [${entityId}]`);
  if (inputShapeId) {
    lines.push("", `  input [${inputShapeId}]`);
  }
  if (outputShapeId) {
    lines.push(`  output [${outputShapeId}]`);
  }
  lines.push("", "  status active", "}");
  return ensureTrailingNewline(`${renderCandidateMetadataComments(record)}\n${lines.join("\n")}`);
}

/** @param {WorkflowRecord} record @param {any[]} scenarios @returns {any} */
export function renderCandidateVerification(record, scenarios = []) {
  const validates = [...new Set(record.related_capabilities || [])];
  const scenarioSymbols = scenarios.length > 0
    ? scenarios.map((/** @type {any} */ entry) => entry.id_hint)
    : (record.scenario_ids || []).map((/** @type {any} */ entry) => idHintify(entry));
  const lines = [
    `verification ${record.id_hint} {`,
    `  name "${record.label}"`,
    `  description "Candidate verification imported from brownfield test evidence"`,
    "",
    `  validates [${validates.join(", ")}]`,
    `  method ${record.method || "runtime"}`,
    "",
    `  scenarios [${scenarioSymbols.join(", ")}]`,
    "",
    "  status active",
    "}"
  ];
  return ensureTrailingNewline(`${renderCandidateMetadataComments(record)}\n${lines.join("\n")}`);
}

/** @param {WorkflowRecord} record @param {any[]} states @param {any[]} transitions @returns {any} */
export function renderCandidateWorkflowDecision(record, states, transitions) {
  const context = [
    ...states.map((/** @type {any} */ state) => state.state_id),
    ...transitions.map((/** @type {any} */ transition) => transition.capability_id).filter(Boolean)
  ].filter(Boolean);
  const consequences = transitions.map((/** @type {any} */ transition) => transition.to_state).filter(Boolean);
  return ensureTrailingNewline(
    `${renderCandidateMetadataComments(record)}\n${[
      `decision dec_${record.id_hint.replace(/^workflow_/, "")} {`,
      `  name "${record.label}"`,
      `  description "Candidate workflow decision imported from brownfield evidence"`,
      "",
      `  context [${[...new Set(context)].join(", ")}]`,
      `  consequences [${[...new Set(consequences)].join(", ")}]`,
      "",
      "  status proposed",
      "}"
    ].join("\n")}`
  );
}

/** @param {WorkflowRecord} record @param {any[]} states @param {any[]} transitions @returns {any} */
export function renderCandidateWorkflowDoc(record, states, transitions) {
  /** @type {WorkflowRecord} */
  const metadata = {
    id: record.id_hint,
    kind: "workflow",
    title: record.label,
    status: "inferred",
    source_of_truth: "imported",
    confidence: record.confidence || "medium",
    review_required: true,
    related_entities: [record.entity_id].filter(Boolean),
    related_capabilities: record.related_capabilities || [],
    provenance: record.provenance || [],
    tags: ["import", "workflow"]
  };
  const body = [
    "Candidate workflow imported from brownfield evidence.",
    "",
    `Entity: \`${record.entity_id}\``,
    `States: ${states.length ? states.map((/** @type {any} */ state) => `\`${state.state_id}\``).join(", ") : "_none_"}`,
    `Transitions: ${transitions.length ? transitions.map((/** @type {any} */ transition) => `\`${transition.capability_id || transition.id_hint}\` -> \`${transition.to_state}\``).join(", ") : "_none_"}`,
    "",
    "Review this workflow before promoting it as canonical."
  ].join("\n");
  return renderMarkdownDoc(metadata, body);
}

/** @param {WorkflowRecord} screen @param {any[]} routes @param {any[]} actions @returns {any} */
export function renderCandidateUiReportDoc(screen, routes, actions) {
  /** @type {WorkflowRecord} */
  const metadata = {
    id: `ui_${screen.id_hint}`,
    kind: "report",
    title: `${screen.label} UI Surface`,
    status: "inferred",
    source_of_truth: "imported",
    confidence: screen.confidence || "medium",
    review_required: true,
    provenance: screen.provenance || [],
    tags: ["import", "ui"]
  };
  const body = [
    "Candidate UI surface imported from brownfield route evidence.",
    "",
    `Screen: \`${screen.id_hint}\` (${screen.screen_kind})`,
    screen.entity_id ? `Inferred entity: \`${screen.entity_id}\`` : null,
    `Routes: ${routes.length ? routes.map((/** @type {any} */ route) => `\`${route.path}\``).join(", ") : "_none_"}`,
    `Actions: ${actions.length ? actions.map((/** @type {any} */ action) => `\`${action.capability_hint}\``).join(", ") : "_none_"}`,
    "",
    "Review this UI surface before promoting it into canonical docs or projections."
  ].filter(Boolean).join("\n");
  return renderMarkdownDoc(metadata, body);
}

/** @param {WorkflowRecord} flow @returns {any} */
export function renderCandidateUiFlowDoc(flow) {
  /** @type {WorkflowRecord} */
  const metadata = {
    id: `ui_flow_${flow.id_hint}`,
    kind: "report",
    title: `${flow.label || flow.id_hint} Review`,
    status: "inferred",
    source_of_truth: "imported",
    confidence: flow.confidence || "medium",
    review_required: true,
    provenance: flow.provenance || flow.evidence || [],
    tags: ["import", "ui", "flow"]
  };
  const body = [
    "Candidate non-resource UI flow imported from brownfield route evidence.",
    "",
    `Flow: \`${flow.id_hint}\` (${flow.flow_type || "unknown"})`,
    `Screens: ${(flow.screen_ids || []).map((/** @type {string} */ item) => `\`${item}\``).join(", ") || "_none_"}`,
    `Routes: ${(flow.route_paths || []).map((/** @type {string} */ item) => `\`${item}\``).join(", ") || "_none_"}`,
    `Missing decisions: ${(flow.missing_decisions || []).length ? flow.missing_decisions.join("; ") : "none"}`,
    "",
    "Proposed UI contract additions:",
    "",
    "```json",
    JSON.stringify(flow.proposed_ui_contract_additions || {}, null, 2),
    "```",
    "",
    "Review this flow before promoting it into shared UI contract behavior."
  ].join("\n");
  return renderMarkdownDoc(metadata, body);
}

/** @param {WorkflowRecord} widget @returns {any} */
export function renderCandidateWidget(widget) {
  const propName = widget.data_prop || "rows";
  const pattern = widget.pattern || "search_results";
  const region = widget.region || "results";
  const inferredEvents = Array.isArray(widget.inferred_events) ? widget.inferred_events : [];
  const eventLines = inferredEvents
    .filter((/** @type {any} */ event) => event.name && event.payload_shape)
    .map((/** @type {any} */ event) => `    ${event.name} ${event.payload_shape}`);
  const selectionEvent = inferredEvents.find((/** @type {any} */ event) => event.name);
  const eventComments = inferredEvents.map((/** @type {any} */ event) =>
    `  # Inferred event: ${event.name || "event"} ${event.action || "action"} ${event.target_screen || event.target || "target"}.`
  );
  const behaviorLines = eventLines.length > 0
    ? [
        "  events {",
        ...eventLines,
        "  }",
        "  behavior [selection]",
        "  behaviors {",
        `    selection mode single emits ${selectionEvent?.name || "row_select"}`,
        "  }"
      ]
    : [];
  return ensureTrailingNewline(
    [
      `widget ${widget.id_hint} {`,
      `  name "${widget.label || widget.id_hint}"`,
      '  description "Candidate reusable widget inferred from imported UI evidence. Review props, behavior, events, and reuse before adoption."',
      "  category collection",
      ...eventComments,
      "  props {",
      `    ${propName} array required`,
      "  }",
      ...behaviorLines,
      `  patterns [${pattern}]`,
      `  regions [${region}]`,
      "  status proposed",
      "}"
    ].join("\n")
  );
}

/** @param {WorkflowRecord} surface @returns {any} */
export function renderCandidateCliSurface(surface) {
  const commandRecords = surface.command_records || [];
  const commands = commandRecords.map((/** @type {any} */ command) =>
    `    command ${command.command_id} capability ${command.capability_id} usage "${quoteString(command.usage)}" mode ${command.mode || "read_only"}`
  );
  const options = (surface.options || []).map((/** @type {any} */ option) => {
    const parts = [
      `    command ${option.command_id} option ${option.name}`,
      `type ${option.type || "boolean"}`
    ];
    if (option.flag) parts.push(`flag ${option.flag}`);
    if (option.description) parts.push(`description "${quoteString(option.description)}"`);
    return parts.join(" ");
  });
  const outputs = (surface.outputs || []).map((/** @type {any} */ output) => {
    const parts = [`    command ${output.command_id} format ${output.format || "human"}`];
    if (output.schema_id) parts.push(`schema ${output.schema_id}`);
    if (output.description) parts.push(`description "${quoteString(output.description)}"`);
    return parts.join(" ");
  });
  const effects = (surface.effects || []).map((/** @type {any} */ effect) => {
    const parts = [`    command ${effect.command_id} effect ${effect.effect || "read_only"}`];
    if (effect.target) parts.push(`target ${effect.target}`);
    return parts.join(" ");
  });
  const examples = (surface.examples || []).map((/** @type {any} */ example) =>
    `    command ${example.command_id} example "${quoteString(example.example)}"`
  );
  const realizedCapabilities = [...new Set(commandRecords.map((/** @type {any} */ command) => command.capability_id).filter(Boolean))].sort();
  return ensureTrailingNewline(
    `${renderCandidateMetadataComments(surface)}\n${[
      `projection ${surface.id_hint} {`,
      `  name "${quoteString(surface.label || "CLI Surface")}"`,
      '  description "Candidate CLI surface inferred from imported command usage. Review commands, options, outputs, and side effects before adoption."',
      "  type cli_surface",
      `  realizes [${realizedCapabilities.join(", ")}]`,
      "  outputs [maintained_app]",
      "",
      "  commands {",
      ...commands,
      "  }",
      "",
      "  command_options {",
      ...options,
      "  }",
      "",
      "  command_outputs {",
      ...outputs,
      "  }",
      "",
      "  command_effects {",
      ...effects,
      "  }",
      "",
      "  command_examples {",
      ...examples,
      "  }",
      "",
      "  status proposed",
      "}"
    ].join("\n")}`
  );
}

/** @param {WorkflowRecord} patch @returns {any} */
export function renderProjectionPatchDoc(patch) {
  const lines = [
    `# ${patch.projection_id} Patch Candidate`,
    "",
    `Projection: \`${patch.projection_id}\``,
    `Kind: \`${patch.kind}\``,
    patch.projection_type ? `Projection type: \`${patch.projection_type}\`` : null,
    "",
    patch.reason || "Candidate additive projection patch inferred during reconcile.",
    ""
  ].filter(Boolean);

  if ((patch.missing_realizes || []).length > 0) {
    lines.push("## Missing Realizes", "");
    for (const item of patch.missing_realizes) {
      lines.push(`- \`${item}\``);
    }
    lines.push("");
  }

  if ((patch.missing_http || []).length > 0) {
    lines.push("## Missing HTTP Entries", "");
    for (const entry of patch.missing_http) {
      lines.push(`- \`${entry.capability_id}\` ${entry.method} \`${entry.path}\``);
    }
    lines.push("");
  }

  if ((patch.missing_screens || []).length > 0) {
    lines.push("## Missing UI Screens", "");
    for (const item of patch.missing_screens) {
      lines.push(`- \`${item}\``);
    }
    lines.push("");
  }

  if ((patch.missing_routes || []).length > 0) {
    lines.push("## Missing UI Routes", "");
    for (const entry of patch.missing_routes) {
      lines.push(`- \`${entry.screen_id}\` -> \`${entry.path}\``);
    }
    lines.push("");
  }

  if ((patch.missing_actions || []).length > 0) {
    lines.push("## Missing UI Actions", "");
    for (const entry of patch.missing_actions) {
      lines.push(`- \`${entry.capability_hint}\` on \`${entry.screen_id}\``);
    }
    lines.push("");
  }

  if ((patch.missing_auth_permissions || []).length > 0) {
    lines.push("## Inferred Permission Rules", "");
    for (const entry of patch.missing_auth_permissions) {
      lines.push(`- ${formatAuthPermissionHintInline(entry)} on ${entry.projection_surface === "visibility_rules" ? "`visibility_rules`" : "`authorization`"} for ${entry.related_capabilities.length ? entry.related_capabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_no direct capability match_"}`);
      lines.push(`  - why inferred: ${entry.why_inferred || entry.explanation}`);
      lines.push(`  - review next: ${entry.review_guidance || buildAuthPermissionReviewGuidance(entry)}`);
    }
    lines.push("");
  }

  if ((patch.missing_auth_claims || []).length > 0) {
    lines.push("## Inferred Auth Claim Rules", "");
    for (const entry of patch.missing_auth_claims) {
      lines.push(`- ${formatAuthClaimHintInline(entry)} on ${entry.projection_surface === "visibility_rules" ? "`visibility_rules`" : "`authorization`"} for ${entry.related_capabilities.length ? entry.related_capabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_no direct capability match_"}`);
      lines.push(`  - why inferred: ${entry.why_inferred || entry.explanation}`);
      lines.push(`  - review next: ${entry.review_guidance || buildAuthClaimReviewGuidance(entry)}`);
    }
    lines.push("");
  }

  if ((patch.missing_auth_ownerships || []).length > 0) {
    lines.push("## Inferred Ownership Rules", "");
    for (const entry of patch.missing_auth_ownerships) {
      lines.push(`- ${formatAuthOwnershipHintInline(entry)} on \`authorization\` for ${entry.related_capabilities.length ? entry.related_capabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_no direct capability match_"}`);
      lines.push(`  - why inferred: ${entry.why_inferred || entry.explanation}`);
      lines.push(`  - review next: ${entry.review_guidance || buildAuthOwnershipReviewGuidance(entry)}`);
    }
    lines.push("");
  }

  lines.push("## Review Notes", "", "- Review this patch before editing canonical projection files.", "- This artifact is additive guidance only and is not auto-applied.");
  return ensureTrailingNewline(lines.join("\n"));
}

/** @param {WorkflowRecord} patch @returns {any} */
export function renderDocLinkPatchDoc(patch) {
  /** @type {WorkflowRecord} */
  const metadata = {
    id: `doc-link-${patch.doc_id}`,
    kind: "report",
    title: `Doc Link Update for ${titleCase(String(patch.doc_id || "").replaceAll("_", " "))}`,
    status: "inferred",
    source_of_truth: "imported",
    confidence: "medium",
    review_required: true,
    related_docs: [patch.doc_id],
    related_actors: patch.add_related_actors || [],
    related_roles: patch.add_related_roles || [],
    related_capabilities: patch.add_related_capabilities || [],
    related_rules: patch.add_related_rules || [],
    related_workflows: patch.add_related_workflows || [],
    tags: ["import", "doc-link-update"]
  };
  const lines = [
    `Target doc: \`${patch.doc_id}\` (${patch.doc_kind})`,
    "",
    "Suggested metadata updates:"
  ];
  if ((patch.add_related_actors || []).length > 0) {
    lines.push("", "```yaml", "related_actors:");
    for (const actorId of patch.add_related_actors || []) {
      lines.push(`  - ${actorId}`);
    }
    lines.push("```");
  }
  if ((patch.add_related_roles || []).length > 0) {
    lines.push("", "```yaml", "related_roles:");
    for (const roleId of patch.add_related_roles || []) {
      lines.push(`  - ${roleId}`);
    }
    lines.push("```");
  }
  if ((patch.add_related_capabilities || []).length > 0) {
    lines.push("", "```yaml", "related_capabilities:");
    for (const capabilityId of patch.add_related_capabilities || []) {
      lines.push(`  - ${capabilityId}`);
    }
    lines.push("```");
  }
  if ((patch.add_related_rules || []).length > 0) {
    lines.push("", "```yaml", "related_rules:");
    for (const ruleId of patch.add_related_rules || []) {
      lines.push(`  - ${ruleId}`);
    }
    lines.push("```");
  }
  if ((patch.add_related_workflows || []).length > 0) {
    lines.push("", "```yaml", "related_workflows:");
    for (const workflowId of patch.add_related_workflows || []) {
      lines.push(`  - ${workflowId}`);
    }
    lines.push("```");
  }
  lines.push("", patch.recommendation, "", "Review this draft update before editing the canonical doc.");
  return renderMarkdownDoc(metadata, lines.join("\n"));
}

/** @param {WorkflowRecord} patch @returns {any} */
export function renderDocMetadataPatchDoc(patch) {
  /** @type {WorkflowRecord} */
  const metadata = {
    id: `doc-metadata-${patch.doc_id}`,
    kind: "report",
    title: `Doc Metadata Update for ${titleCase(String(patch.doc_id || "").replaceAll("_", " "))}`,
    status: "inferred",
    source_of_truth: "imported",
    confidence: patch.imported_confidence || "medium",
    review_required: true,
    related_docs: [patch.doc_id],
    tags: ["import", "doc-metadata-update"]
  };
  const lines = [
    `Target doc: \`${patch.doc_id}\` (${patch.doc_kind})`,
    "",
    "Suggested metadata updates:"
  ];
  if (patch.summary) {
    lines.push("", "```yaml", `summary: ${JSON.stringify(patch.summary)}`, "```");
  }
  if (patch.success_outcome) {
    lines.push("", "```yaml", `success_outcome: ${JSON.stringify(patch.success_outcome)}`, "```");
  }
  if ((patch.actors || []).length > 0) {
    lines.push("", "```yaml", "actors:");
    for (const actor of patch.actors || []) {
      lines.push(`  - ${actor}`);
    }
    lines.push("```");
  }
  lines.push("", patch.recommendation, "", "Review this draft update before editing the canonical doc.");
  return renderMarkdownDoc(metadata, lines.join("\n"));
}

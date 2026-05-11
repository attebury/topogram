// @ts-check

/** @param {WorkflowRecord} step @returns {any} */
export function reasonForAdoptionItem(step) {
  switch (step.action) {
    case "promote_actor":
      return "Promote this imported actor into canonical Topogram.";
    case "promote_role":
      return "Promote this imported role into canonical Topogram.";
    case "promote_entity":
      return "No canonical entity exists for this imported concept.";
    case "promote_enum":
      return step.target ? `Promote this enum to support merged concept ${step.target}.` : "Promote this imported enum into canonical Topogram.";
    case "promote_shape":
      return step.target ? `Promote this shape to support concept ${step.target}.` : "Promote this imported shape into canonical Topogram.";
    case "promote_capability":
      return "Promote this imported capability into canonical Topogram.";
    case "promote_widget":
      return "Promote this imported reusable UI widget into canonical Topogram.";
    case "promote_cli_surface":
      return "Promote this imported CLI surface projection into canonical Topogram.";
    case "merge_capability_into_existing_entity":
      return `Adopt this capability while preserving the existing canonical entity ${step.target}.`;
    case "promote_doc":
      return "Promote this imported companion doc into canonical Topogram docs.";
    case "promote_workflow_doc":
      return "Promote this imported workflow doc into canonical Topogram workflow docs.";
    case "promote_workflow_decision":
      return "Promote this imported workflow decision into canonical Topogram decisions.";
    case "promote_verification":
      return "Promote this imported verification into canonical Topogram verifications.";
    case "promote_ui_report":
      return "Promote this imported UI review report into canonical Topogram docs.";
    case "apply_projection_permission_patch":
      return `Apply inferred permission-based auth rules to canonical projection ${step.target}.`;
    case "apply_projection_auth_patch":
      return `Apply inferred claim-based auth rules to canonical projection ${step.target}.`;
    case "apply_projection_ownership_patch":
      return `Apply inferred ownership-based auth rules to canonical projection ${step.target}.`;
    case "apply_doc_link_patch":
      return "Apply this suggested actor/role metadata update to an existing canonical doc.";
    case "apply_doc_metadata_patch":
      return "Apply this suggested safe metadata update to an existing canonical doc.";
    case "skip_duplicate_shape":
      return step.target ? `Skip this shape because it duplicates canonical shape ${step.target}.` : "Skip this shape because it duplicates existing canonical surface.";
    default:
      return "Review this adoption suggestion before applying it.";
  }
}

/** @param {WorkflowRecord} step @returns {any} */
export function recommendationForAdoptionItem(step) {
  if (step.action === "apply_doc_link_patch") {
    return `Update \`${step.target}\` with the suggested related actor/role links.`;
  }
  if (step.action === "apply_doc_metadata_patch") {
    return `Update \`${step.target}\` with the suggested safe metadata changes.`;
  }
  if (step.action === "apply_projection_permission_patch") {
    return `Update \`${step.target}\` with inferred permission auth rules for ${(step.related_capabilities || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ") || "the related capabilities"}.`;
  }
  if (step.action === "apply_projection_auth_patch") {
    return `Update \`${step.target}\` with inferred claim auth rules for ${(step.related_capabilities || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ") || "the related capabilities"}.`;
  }
  if (step.action === "apply_projection_ownership_patch") {
    return `Update \`${step.target}\` with inferred ownership auth rules for ${(step.related_capabilities || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ") || "the related capabilities"}.`;
  }
  if (step.action === "promote_widget") {
    return "Promote this reviewed widget candidate before binding or reusing it from canonical projections.";
  }
  if (step.action === "promote_cli_surface") {
    return "Promote this reviewed CLI surface candidate after confirming commands, options, outputs, and side effects.";
  }
  if (!["promote_actor", "promote_role"].includes(step.action)) {
    return null;
  }
  const kindLabel = step.action === "promote_actor" ? "actor" : "role";
  /** @type {any[]} */
  const linkHints = [];
  if ((step.related_docs || []).length > 0) {
    linkHints.push(`link to docs ${step.related_docs.map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
  }
  if ((step.related_capabilities || []).length > 0) {
    linkHints.push(`check capabilities ${step.related_capabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
  }
  return `Promote this ${kindLabel}${step.confidence ? ` (${step.confidence})` : ""}${linkHints.length ? ` and ${linkHints.join("; ")}` : ""}.`;
}

/** @param {WorkflowRecord} item @returns {any} */
export function formatDocLinkSuggestionInline(item) {
  return `doc \`${item.doc_id}\`` +
    `${item.add_related_actors?.length ? ` add-actors=${item.add_related_actors.map((/** @type {any} */ entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.add_related_roles?.length ? ` add-roles=${item.add_related_roles.map((/** @type {any} */ entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.add_related_capabilities?.length ? ` add-capabilities=${item.add_related_capabilities.map((/** @type {any} */ entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.add_related_rules?.length ? ` add-rules=${item.add_related_rules.map((/** @type {any} */ entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.add_related_workflows?.length ? ` add-workflows=${item.add_related_workflows.map((/** @type {any} */ entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.patch_rel_path ? ` draft=\`${item.patch_rel_path}\`` : ""}`;
}

/** @param {WorkflowRecord} item @returns {any} */
export function formatDocDriftSummaryInline(item) {
  return `doc \`${item.doc_id}\` (${item.recommendation_type}) fields=${item.differing_fields.map((/** @type {any} */ entry) => entry.field).join(", ")} confidence=${item.imported_confidence}`;
}

/** @param {WorkflowRecord} item @returns {any} */
export function formatDocMetadataPatchInline(item) {
  return `doc \`${item.doc_id}\`` +
    `${item.summary ? " set-summary=yes" : ""}` +
    `${item.success_outcome ? " set-success_outcome=yes" : ""}` +
    `${item.actors?.length ? ` add-actors=${item.actors.map((/** @type {any} */ entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.patch_rel_path ? ` draft=\`${item.patch_rel_path}\`` : ""}`;
}

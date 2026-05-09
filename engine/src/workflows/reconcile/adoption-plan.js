// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

import { ensureTrailingNewline } from "../../text-helpers.js";
import { adoptionItemKey } from "../../adoption/plan.js";
import { confidenceRank } from "../docs.js";
import { dashedTopogramId } from "./ids.js";
import { readJsonIfExists, readTextIfExists } from "../shared.js";
import { buildProjectionReviewGroups, buildUiReviewGroups, buildWorkflowReviewGroups } from "../../adoption/review-groups.js";
import { buildProjectionImpacts, buildUiImpacts, buildWorkflowImpacts } from "./impacts.js";

export function canonicalRelativePathForItem(kind, item) {
  switch (kind) {
    case "actor":
      return `actors/${dashedTopogramId(item)}.tg`;
    case "role":
      return `roles/${dashedTopogramId(item)}.tg`;
    case "enum":
      return `enums/enum-${dashedTopogramId(String(item || "").replace(/^enum_/, ""))}.tg`;
    case "entity":
      return `entities/${dashedTopogramId(item)}.tg`;
    case "shape":
      return `shapes/${dashedTopogramId(item)}.tg`;
    case "capability":
      return `capabilities/${dashedTopogramId(item)}.tg`;
    case "widget":
      return `widgets/${dashedTopogramId(item)}.tg`;
    case "verification":
      return `verifications/${dashedTopogramId(item)}.tg`;
    default:
      return null;
  }
}

export function canonicalDisplayPathForItem(kind, item) {
  const relativePath = canonicalRelativePathForItem(kind, item);
  return relativePath ? `topogram/${relativePath}` : null;
}

export function candidateSourcePathForItem(bundle, kind, item) {
  const base = `candidates/reconcile/model/bundles/${bundle.slug}`;
  switch (kind) {
    case "actor":
      return `${base}/actors/${item}.tg`;
    case "role":
      return `${base}/roles/${item}.tg`;
    case "enum":
      return `${base}/enums/${item}.tg`;
    case "entity":
      return `${base}/entities/${item}.tg`;
    case "shape":
      return `${base}/shapes/${item}.tg`;
    case "capability":
      return `${base}/capabilities/${item}.tg`;
    case "widget":
      return `${base}/widgets/${item}.tg`;
    case "verification":
      return `${base}/verifications/${item}.tg`;
    default:
      return `${base}/README.md`;
  }
}

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

export function recommendationForAdoptionItem(step) {
  if (step.action === "apply_doc_link_patch") {
    return `Update \`${step.target}\` with the suggested related actor/role links.`;
  }
  if (step.action === "apply_doc_metadata_patch") {
    return `Update \`${step.target}\` with the suggested safe metadata changes.`;
  }
  if (step.action === "apply_projection_permission_patch") {
    return `Update \`${step.target}\` with inferred permission auth rules for ${(step.related_capabilities || []).map((item) => `\`${item}\``).join(", ") || "the related capabilities"}.`;
  }
  if (step.action === "apply_projection_auth_patch") {
    return `Update \`${step.target}\` with inferred claim auth rules for ${(step.related_capabilities || []).map((item) => `\`${item}\``).join(", ") || "the related capabilities"}.`;
  }
  if (step.action === "apply_projection_ownership_patch") {
    return `Update \`${step.target}\` with inferred ownership auth rules for ${(step.related_capabilities || []).map((item) => `\`${item}\``).join(", ") || "the related capabilities"}.`;
  }
  if (step.action === "promote_widget") {
    return "Promote this reviewed widget candidate before binding or reusing it from canonical projections.";
  }
  if (!["promote_actor", "promote_role"].includes(step.action)) {
    return null;
  }
  const kindLabel = step.action === "promote_actor" ? "actor" : "role";
  const linkHints = [];
  if ((step.related_docs || []).length > 0) {
    linkHints.push(`link to docs ${step.related_docs.map((item) => `\`${item}\``).join(", ")}`);
  }
  if ((step.related_capabilities || []).length > 0) {
    linkHints.push(`check capabilities ${step.related_capabilities.map((item) => `\`${item}\``).join(", ")}`);
  }
  return `Promote this ${kindLabel}${step.confidence ? ` (${step.confidence})` : ""}${linkHints.length ? ` and ${linkHints.join("; ")}` : ""}.`;
}

export function formatDocLinkSuggestionInline(item) {
  return `doc \`${item.doc_id}\`` +
    `${item.add_related_actors?.length ? ` add-actors=${item.add_related_actors.map((entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.add_related_roles?.length ? ` add-roles=${item.add_related_roles.map((entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.add_related_capabilities?.length ? ` add-capabilities=${item.add_related_capabilities.map((entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.add_related_rules?.length ? ` add-rules=${item.add_related_rules.map((entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.add_related_workflows?.length ? ` add-workflows=${item.add_related_workflows.map((entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.patch_rel_path ? ` draft=\`${item.patch_rel_path}\`` : ""}`;
}

export function formatDocDriftSummaryInline(item) {
  return `doc \`${item.doc_id}\` (${item.recommendation_type}) fields=${item.differing_fields.map((entry) => entry.field).join(", ")} confidence=${item.imported_confidence}`;
}

export function formatDocMetadataPatchInline(item) {
  return `doc \`${item.doc_id}\`` +
    `${item.summary ? " set-summary=yes" : ""}` +
    `${item.success_outcome ? " set-success_outcome=yes" : ""}` +
    `${item.actors?.length ? ` add-actors=${item.actors.map((entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.patch_rel_path ? ` draft=\`${item.patch_rel_path}\`` : ""}`;
}

export function adoptionStatusForStep(step, projectionImpacts = [], uiImpacts = [], workflowImpacts = []) {
  if (step.action === "skip_duplicate_shape") {
    return "skipped";
  }
  if (step.action === "apply_projection_permission_patch") {
    return "needs_projection_review";
  }
  if (step.action === "apply_projection_auth_patch") {
    return "needs_projection_review";
  }
  if (step.action === "apply_projection_ownership_patch") {
    return "needs_projection_review";
  }
  if (step.action.includes("capability") && projectionImpacts.length > 0) {
    return "needs_projection_review";
  }
  if (step.action.includes("ui_") && uiImpacts.length > 0) {
    return "needs_ui_review";
  }
  if (step.action.includes("workflow") && workflowImpacts.length > 0) {
    return "needs_workflow_review";
  }
  return "pending";
}

export function projectionImpactsForAdoptionItem(bundle, step) {
  if (!step.action.includes("capability")) {
    return [];
  }
  return (bundle.projectionImpacts || [])
    .filter((impact) => (impact.missing_capabilities || []).includes(step.item))
    .map((impact) => ({
      projection_id: impact.projection_id,
      kind: impact.kind,
      projection_type: impact.projection_type,
      reason: impact.reason
    }));
}

export function blockingDependenciesForProjectionImpacts(projectionImpacts) {
  return projectionImpacts.map((impact) => ({
    type: "projection_review",
    id: `projection_review:${impact.projection_id}`,
    projection_id: impact.projection_id,
    kind: impact.kind,
    projection_type: impact.projection_type,
    reason: impact.reason
  }));
}

export function blockingDependenciesForUiImpacts(uiImpacts) {
  return uiImpacts.map((impact) => ({
    type: "ui_review",
    id: `ui_review:${impact.projection_id}`,
    projection_id: impact.projection_id,
    kind: impact.kind,
    projection_type: impact.projection_type,
    reason: impact.reason
  }));
}

export function blockingDependenciesForWorkflowImpacts(workflowImpacts) {
  return workflowImpacts.map((impact) => ({
    type: "workflow_review",
    id: impact.review_group_id,
    reason: impact.reason
  }));
}

export function buildAdoptionPlan(bundles) {
  const items = [];
  for (const bundle of bundles) {
    for (const step of bundle.adoptionPlan || []) {
      const itemKind =
        step.action === "merge_bundle_into_existing_entity" ? "bundle" :
        step.action === "apply_projection_permission_patch" ? "projection_permission_patch" :
        step.action === "apply_projection_auth_patch" ? "projection_auth_patch" :
        step.action === "apply_projection_ownership_patch" ? "projection_ownership_patch" :
        step.action.includes("doc") ? "doc" :
        step.action.includes("decision") ? "decision" :
        step.action.includes("verification") ? "verification" :
        step.action.includes("widget") ? "widget" :
        step.action.includes("ui_") ? "ui" :
        step.action.includes("actor") ? "actor" :
        step.action.includes("role") ? "role" :
        step.action.includes("enum") ? "enum" :
        step.action.includes("shape") ? "shape" :
        step.action.includes("capability") ? "capability" :
        step.action.includes("entity") ? "entity" :
        "bundle";
      if (itemKind === "bundle") {
        continue;
      }
      const projectionImpacts = projectionImpactsForAdoptionItem(bundle, step);
      const directProjectionBlockingDependencies =
        (step.action === "apply_projection_permission_patch" || step.action === "apply_projection_auth_patch" || step.action === "apply_projection_ownership_patch") && step.target
          ? blockingDependenciesForProjectionImpacts([
              {
                projection_id: step.target,
                kind: step.projection_kind || "api",
                projection_type: null,
                reason: `Projection ${step.target} auth rules need explicit review before promotion.`
              }
            ])
          : [];
      const uiImpacts = step.action.includes("ui_") ? bundle.uiImpacts || [] : [];
      const workflowImpacts = step.action.includes("workflow") ? bundle.workflowImpacts || [] : [];
      const blockingDependencies = [
        ...blockingDependenciesForProjectionImpacts(projectionImpacts),
        ...directProjectionBlockingDependencies,
        ...blockingDependenciesForUiImpacts(uiImpacts),
        ...blockingDependenciesForWorkflowImpacts(workflowImpacts)
      ];
      items.push({
        bundle: bundle.slug,
        item: step.item,
        kind: itemKind,
        track:
          step.action.includes("workflow") ? "workflows" :
          step.action.includes("verification") ? "verification" :
          step.action.includes("ui_") ? "ui" :
          step.action === "apply_projection_permission_patch" ? "projection" :
          step.action === "apply_projection_auth_patch" ? "projection" :
          step.action === "apply_projection_ownership_patch" ? "projection" :
          step.action.includes("doc") ? "docs" :
          itemKind,
        suggested_action: step.action,
        target: step.target || null,
        confidence: step.confidence || null,
        inference_summary: step.inference_summary || null,
        related_docs: step.related_docs || [],
        related_capabilities: step.related_capabilities || [],
        permission: step.permission || null,
        claim: step.claim || null,
        claim_value: Object.prototype.hasOwnProperty.call(step, "claim_value") ? step.claim_value : null,
        ownership: step.ownership || null,
        ownership_field: step.ownership_field || null,
        projection_surface: step.projection_surface || null,
        status: adoptionStatusForStep(step, projectionImpacts, uiImpacts, workflowImpacts),
        source_path: step.source_path || candidateSourcePathForItem(bundle, itemKind, step.item),
        canonical_path:
          step.action === "skip_duplicate_shape"
            ? (step.target ? canonicalDisplayPathForItem("shape", step.target) : null)
            : (step.canonical_rel_path ? `topogram/${step.canonical_rel_path}` : canonicalDisplayPathForItem(itemKind, step.item)),
        canonical_rel_path: step.canonical_rel_path || canonicalRelativePathForItem(itemKind, step.item),
        reason: reasonForAdoptionItem(step),
        recommendation: recommendationForAdoptionItem(step),
        projection_impacts: projectionImpacts,
        ui_impacts: uiImpacts,
        workflow_impacts: workflowImpacts,
        blocking_dependencies: blockingDependencies
      });
    }
    for (const patch of bundle.projectionPatches || []) {
      items.push({
        bundle: bundle.slug,
        item: `projection_patch:${patch.projection_id}`,
        kind: "projection_patch",
        track: "projection",
        suggested_action: "review_projection_patch",
        target: patch.projection_id,
        status: "needs_projection_review",
        source_path: `candidates/reconcile/model/bundles/${bundle.slug}/${patch.patch_rel_path}`,
        canonical_path: null,
        canonical_rel_path: null,
        reason: patch.reason || `Projection ${patch.projection_id} needs additive review.`,
        projection_impacts: [
          {
            projection_id: patch.projection_id,
            kind: patch.kind,
            projection_type: patch.projection_type,
            missing_capabilities: patch.missing_realizes || []
          }
        ],
        ui_impacts: (patch.missing_screens || []).length > 0 ? [
          {
            projection_id: patch.projection_id,
            kind: patch.kind,
            projection_type: patch.projection_type,
            missing_screens: patch.missing_screens || []
          }
        ] : [],
        workflow_impacts: [],
        blocking_dependencies: blockingDependenciesForProjectionImpacts([
          {
            projection_id: patch.projection_id,
            kind: patch.kind,
            projection_type: patch.projection_type,
            reason: patch.reason || `Projection ${patch.projection_id} needs additive review.`
          }
        ])
      });
    }
    for (const patch of bundle.docLinkSuggestions || []) {
      items.push({
        bundle: bundle.slug,
        item: `doc_link_patch:${patch.doc_id}`,
        kind: "doc_link_patch",
        track: "docs",
        suggested_action: "apply_doc_link_patch",
        target: patch.doc_id,
        status: "pending",
        source_path: `candidates/reconcile/model/bundles/${bundle.slug}/${patch.patch_rel_path}`,
        canonical_path: patch.canonical_rel_path ? `topogram/${patch.canonical_rel_path}` : null,
        canonical_rel_path: patch.canonical_rel_path || null,
        reason: `Apply suggested related actor/role links to \`${patch.doc_id}\`.`,
        recommendation: recommendationForAdoptionItem({ action: "apply_doc_link_patch", target: patch.doc_id }),
        related_docs: [patch.doc_id],
        related_actors: patch.add_related_actors || [],
        related_roles: patch.add_related_roles || [],
        related_capabilities: patch.add_related_capabilities || [],
        related_rules: patch.add_related_rules || [],
        related_workflows: patch.add_related_workflows || [],
        projection_impacts: [],
        ui_impacts: [],
        workflow_impacts: [],
        blocking_dependencies: []
      });
    }
    for (const patch of bundle.docMetadataPatches || []) {
      items.push({
        bundle: bundle.slug,
        item: `doc_metadata_patch:${patch.doc_id}`,
        kind: "doc_metadata_patch",
        track: "docs",
        suggested_action: "apply_doc_metadata_patch",
        target: patch.doc_id,
        status: "pending",
        confidence: patch.imported_confidence || "low",
        source_path: `candidates/reconcile/model/bundles/${bundle.slug}/${patch.patch_rel_path}`,
        canonical_path: patch.canonical_rel_path ? `topogram/${patch.canonical_rel_path}` : null,
        canonical_rel_path: patch.canonical_rel_path || null,
        reason: `Apply suggested safe metadata updates to \`${patch.doc_id}\`.`,
        recommendation: recommendationForAdoptionItem({ action: "apply_doc_metadata_patch", target: patch.doc_id }),
        related_docs: [patch.doc_id],
        summary: patch.summary || null,
        success_outcome: patch.success_outcome || null,
        actors: patch.actors || [],
        projection_impacts: [],
        ui_impacts: [],
        workflow_impacts: [],
        blocking_dependencies: []
      });
    }
  }
  return items.sort((a, b) =>
    a.bundle.localeCompare(b.bundle) ||
    confidenceRank(b.confidence || "low") - confidenceRank(a.confidence || "low") ||
    a.kind.localeCompare(b.kind) ||
    a.item.localeCompare(b.item)
  );
}

const ADOPT_SELECTORS = new Set(["from-plan", "actors", "roles", "enums", "shapes", "entities", "capabilities", "widgets", "docs", "journeys", "workflows", "verification", "ui"]);

export function readAdoptionPlan(paths) {
  return readJsonIfExists(path.join(paths.topogramRoot, "candidates", "reconcile", "adoption-plan.json"));
}

export function buildCanonicalAdoptionOutputs(paths, candidateFiles, planItems, selectedItems, options = {}) {
  const refreshAdopted = Boolean(options.refreshAdopted);
  const files = {};
  const refreshedFiles = [];
  const selectedSet = new Set(selectedItems);
  const itemMap = new Map(planItems.map((item) => [adoptionItemKey(item), item]));
  const capabilityBundleSet = new Set(
    [...selectedSet]
      .map((key) => itemMap.get(key))
      .filter((item) => item?.kind === "capability")
      .map((item) => item.bundle)
  );
  for (const item of planItems) {
    if (item.kind === "shape" && item.status !== "skipped" && capabilityBundleSet.has(item.bundle)) {
      selectedSet.add(adoptionItemKey(item));
    }
  }
  for (const item of planItems) {
    if (!selectedSet.has(adoptionItemKey(item))) {
      continue;
    }
    if (item.suggested_action === "skip_duplicate_shape") {
      continue;
    }
    const relativeCanonicalPath = item.canonical_rel_path || canonicalRelativePathForItem(item.kind, item.item);
    if (!relativeCanonicalPath) {
      continue;
    }
    const canonicalPath = path.join(paths.topogramRoot, relativeCanonicalPath);
    if (item.suggested_action === "apply_doc_link_patch") {
      const baseContents = files[relativeCanonicalPath] || (fs.existsSync(canonicalPath) ? fs.readFileSync(canonicalPath, "utf8") : null);
      if (!baseContents) {
        continue;
      }
      const updatedContents = applyDocLinkPatchToMarkdownReconcile(baseContents, item);
      if (!updatedContents || updatedContents === baseContents) {
        continue;
      }
      files[relativeCanonicalPath] = updatedContents;
      refreshedFiles.push(relativeCanonicalPath.replaceAll(path.sep, "/"));
      continue;
    }
    if (item.suggested_action === "apply_doc_metadata_patch") {
      const baseContents = files[relativeCanonicalPath] || (fs.existsSync(canonicalPath) ? fs.readFileSync(canonicalPath, "utf8") : null);
      if (!baseContents) {
        continue;
      }
      const updatedContents = applyDocMetadataPatchToMarkdownReconcile(baseContents, item);
      if (!updatedContents || updatedContents === baseContents) {
        continue;
      }
      files[relativeCanonicalPath] = updatedContents;
      refreshedFiles.push(relativeCanonicalPath.replaceAll(path.sep, "/"));
      continue;
    }
    if (item.suggested_action === "apply_projection_permission_patch" || item.suggested_action === "apply_projection_auth_patch" || item.suggested_action === "apply_projection_ownership_patch") {
      const baseContents = files[relativeCanonicalPath] || (fs.existsSync(canonicalPath) ? fs.readFileSync(canonicalPath, "utf8") : null);
      if (!baseContents) {
        continue;
      }
      const updatedContents = applyProjectionAuthPatchToTopogram(baseContents, item);
      if (!updatedContents || updatedContents === baseContents) {
        continue;
      }
      files[relativeCanonicalPath] = updatedContents;
      refreshedFiles.push(relativeCanonicalPath.replaceAll(path.sep, "/"));
      continue;
    }
    if (fs.existsSync(canonicalPath)) {
      if (!refreshAdopted) {
        continue;
      }
      const existingContents = fs.readFileSync(canonicalPath, "utf8");
      const machineManagedImported =
        existingContents.startsWith("# imported ") ||
        /\bsource_of_truth:\s*imported\b/.test(existingContents);
      if (!machineManagedImported) {
        continue;
      }
    }
    const candidateContents =
      candidateFiles[item.source_path] ||
      (item.source_path ? readTextIfExists(path.join(paths.topogramRoot, item.source_path)) : null);
    if (!candidateContents) {
      continue;
    }
    files[relativeCanonicalPath] = candidateContents;
    if (fs.existsSync(canonicalPath)) {
      refreshedFiles.push(relativeCanonicalPath.replaceAll(path.sep, "/"));
    }
  }
  return { files, refreshedFiles: [...new Set(refreshedFiles)].sort() };
}

export function buildPromotedCanonicalItems(planItems, selectedItems, writtenCanonicalFiles, selector) {
  const itemMap = new Map((planItems || []).map((item) => [adoptionItemKey(item), item]));
  const writtenSet = new Set((writtenCanonicalFiles || []).map((item) => String(item).replaceAll(path.sep, "/")));
  return [...new Set(selectedItems || [])]
    .map((key) => itemMap.get(key))
    .filter(Boolean)
    .filter((item) => item.canonical_rel_path && writtenSet.has(String(item.canonical_rel_path).replaceAll(path.sep, "/")))
    .map((item) => ({
      selector: selector || null,
      bundle: item.bundle,
      item: item.item,
      kind: item.kind,
      track: item.track || null,
      source_path: item.source_path || null,
      canonical_rel_path: String(item.canonical_rel_path).replaceAll(path.sep, "/"),
      canonical_path: item.canonical_path || `topogram/${String(item.canonical_rel_path).replaceAll(path.sep, "/")}`,
      suggested_action: item.suggested_action || null
    }))
    .sort((a, b) =>
      (a.bundle || "").localeCompare(b.bundle || "") ||
      (a.track || "").localeCompare(b.track || "") ||
      (a.kind || "").localeCompare(b.kind || "") ||
      (a.item || "").localeCompare(b.item || "")
    );
}

export function ensureProjectionBlock(lines, blockName) {
  const startIndex = lines.findIndex((line) => new RegExp(`^\\s*${blockName}\\s*\\{\\s*$`).test(line));
  if (startIndex !== -1) {
    let endIndex = -1;
    for (let index = startIndex + 1; index < lines.length; index += 1) {
      if (/^\s*\}\s*$/.test(lines[index])) {
        endIndex = index;
        break;
      }
    }
    if (endIndex !== -1) {
      return { lines, startIndex, endIndex };
    }
  }
  const insertBeforeStatus = lines.findIndex((line) => /^\s*status\s+\w+/.test(line));
  const insertIndex = insertBeforeStatus === -1 ? lines.length : insertBeforeStatus;
  const blockLines = ["", `  ${blockName} {`, "  }"];
  lines.splice(insertIndex, 0, ...blockLines);
  return {
    lines,
    startIndex: insertIndex + 1,
    endIndex: insertIndex + 2
  };
}

export function ensureProjectionRealizes(lines, capabilityIds) {
  const startIndex = lines.findIndex((line) => /^\s*realizes\s*\[/.test(line));
  if (startIndex === -1) {
    return { changed: false, lines };
  }
  let endIndex = startIndex;
  while (endIndex < lines.length && !/\]/.test(lines[endIndex])) {
    endIndex += 1;
  }
  if (endIndex >= lines.length) {
    return { changed: false, lines };
  }
  const existingItems = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    const text = lines[index]
      .replace(/^\s*realizes\s*\[/, "")
      .replace(/\]\s*$/, "")
      .trim();
    if (!text) {
      continue;
    }
    for (const item of text.split(",").map((entry) => entry.trim()).filter(Boolean)) {
      existingItems.push(item);
    }
  }
  const merged = [...new Set([...existingItems, ...(capabilityIds || [])])];
  if (merged.length === existingItems.length) {
    return { changed: false, lines };
  }
  const replacement = ["  realizes [", ...merged.map((item, index) => `    ${item}${index === merged.length - 1 ? "" : ","}`), "  ]"];
  lines.splice(startIndex, endIndex - startIndex + 1, ...replacement);
  return { changed: true, lines };
}

export function applyProjectionAuthPatchToTopogram(baseContents, item) {
  const lines = String(baseContents || "").replace(/\r\n/g, "\n").split("\n");
  const capabilities = [...new Set(item.related_capabilities || [])];
  let changed = false;

  const realizesResult = ensureProjectionRealizes(lines, capabilities);
  changed = changed || realizesResult.changed;

  if (item.projection_surface === "authorization") {
    const block = ensureProjectionBlock(lines, "authorization");
    for (const capabilityId of capabilities) {
      const lineIndex = lines.findIndex((line, index) =>
        index > block.startIndex &&
        index < block.endIndex &&
        new RegExp(`^\\s*${capabilityId}(\\s|$)`).test(line)
      );
      if (item.suggested_action === "apply_projection_ownership_patch") {
        const ownershipFragment = `ownership ${item.ownership}${item.ownership_field ? ` ownership_field ${item.ownership_field}` : ""}`;
        if (lineIndex !== -1) {
          if (!/\bownership\s+/.test(lines[lineIndex])) {
            lines[lineIndex] = `${lines[lineIndex].trimEnd()} ${ownershipFragment}`;
            changed = true;
          }
          continue;
        }
        lines.splice(block.endIndex, 0, `    ${capabilityId} ${ownershipFragment}`);
        block.endIndex += 1;
        changed = true;
        continue;
      }

      if (item.suggested_action === "apply_projection_permission_patch") {
        const permissionFragment = `permission ${item.permission}`;
        if (lineIndex !== -1) {
          if (!/\bpermission\s+/.test(lines[lineIndex])) {
            lines[lineIndex] = `${lines[lineIndex].trimEnd()} ${permissionFragment}`;
            changed = true;
          }
          continue;
        }
        lines.splice(block.endIndex, 0, `    ${capabilityId} ${permissionFragment}`);
        block.endIndex += 1;
        changed = true;
        continue;
      }

      const claimFragment = `claim ${item.claim}${item.claim_value != null ? ` claim_value ${item.claim_value}` : ""}`;
      if (lineIndex !== -1) {
        if (!/\bclaim\s+/.test(lines[lineIndex])) {
          lines[lineIndex] = `${lines[lineIndex].trimEnd()} ${claimFragment}`;
          changed = true;
        }
        continue;
      }
      lines.splice(block.endIndex, 0, `    ${capabilityId} ${claimFragment}`);
      block.endIndex += 1;
      changed = true;
    }
  }

  if (item.projection_surface === "visibility_rules") {
    const block = ensureProjectionBlock(lines, "visibility_rules");
    for (const capabilityId of capabilities) {
      if (item.suggested_action === "apply_projection_permission_patch") {
        const hasExistingPermissionRule = lines.some((line, index) =>
          index > block.startIndex &&
          index < block.endIndex &&
          new RegExp(`^\\s*action\\s+${capabilityId}\\s+visible_if\\s+permission\\s+${item.permission}(\\s|$)`).test(line)
        );
        if (hasExistingPermissionRule) {
          continue;
        }
        const hasAnyVisibilityRule = lines.some((line, index) =>
          index > block.startIndex &&
          index < block.endIndex &&
          new RegExp(`^\\s*action\\s+${capabilityId}\\s+visible_if\\s+`).test(line)
        );
        if (hasAnyVisibilityRule) {
          continue;
        }
        lines.splice(block.endIndex, 0, `    action ${capabilityId} visible_if permission ${item.permission}`);
        block.endIndex += 1;
        changed = true;
        continue;
      }

      const hasExistingClaimRule = lines.some((line, index) =>
        index > block.startIndex &&
        index < block.endIndex &&
        new RegExp(`^\\s*action\\s+${capabilityId}\\s+visible_if\\s+claim\\s+${item.claim}(\\s|$)`).test(line)
      );
      if (hasExistingClaimRule) {
        continue;
      }
      const hasAnyVisibilityRule = lines.some((line, index) =>
        index > block.startIndex &&
        index < block.endIndex &&
        new RegExp(`^\\s*action\\s+${capabilityId}\\s+visible_if\\s+`).test(line)
      );
      if (hasAnyVisibilityRule) {
        continue;
      }
      lines.splice(block.endIndex, 0, `    action ${capabilityId} visible_if claim ${item.claim}${item.claim_value != null ? ` claim_value ${item.claim_value}` : ""}`);
      block.endIndex += 1;
      changed = true;
    }
  }

  return changed ? ensureTrailingNewline(lines.join("\n")) : baseContents;
}

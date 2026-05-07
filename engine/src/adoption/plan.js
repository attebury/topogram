import fs from "node:fs";
import path from "node:path";

import {
  ADOPTION_STATE_VOCABULARY,
  reviewBoundaryForImportProposal
} from "../policy/review-boundaries.js";

const ADOPT_SELECTORS = new Set(["from-plan", "actors", "roles", "enums", "shapes", "entities", "capabilities", "widgets", "docs", "journeys", "workflows", "verification", "ui"]);

function stableSortedStrings(values) {
  return [...new Set((values || []).filter(Boolean))].sort();
}

function severityRank(status) {
  if (status === "no_go") return 3;
  if (status === "manual_decision") return 2;
  if (status === "review_required") return 1;
  return 0;
}

function importProposalDependencyIds(proposalSurface = {}) {
  return stableSortedStrings([
    proposalSurface.item,
    ...(proposalSurface.requirements?.related_capabilities || []),
    ...(proposalSurface.requirements?.related_rules || []),
    ...(proposalSurface.requirements?.related_workflows || []),
    ...(proposalSurface.requirements?.related_docs || []),
    ...((proposalSurface.projection_impacts || []).map((impact) => impact.projection_id)),
    ...((proposalSurface.ui_impacts || []).map((impact) => impact.projection_id)),
    ...((proposalSurface.workflow_impacts || []).map((impact) => impact.id))
  ]);
}

function normalizePath(input) {
  return String(input || "")
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/");
}

function trimGlobSuffix(pathValue) {
  return normalizePath(pathValue).replace(/\/\*\*$/, "").replace(/\/\*$/, "");
}

function pathPrefixMatches(filePath, rootPath) {
  if (!filePath || !rootPath) return false;
  const normalizedFile = normalizePath(filePath);
  const normalizedRoot = trimGlobSuffix(rootPath);
  return normalizedRoot.length > 0 && normalizedFile.startsWith(normalizedRoot);
}

function pathTokens(pathValue) {
  const normalized = normalizePath(pathValue).replace(/\.[^.\/]+$/, "");
  const camelExpanded = normalized.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  const tokens = camelExpanded
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) =>
      token.length > 1 &&
      !["app", "src", "docs", "model", "bundles", "candidates", "topogram", "cap", "tg", "md"].includes(token)
    );

  return stableSortedStrings(tokens.flatMap((token) => {
    const variants = [token];
    if (token.endsWith("ies") && token.length > 4) {
      variants.push(`${token.slice(0, -3)}y`);
    } else if (token.endsWith("s") && token.length > 3) {
      variants.push(token.slice(0, -1));
    }
    return variants;
  }));
}

function sharedTokens(left, right) {
  const rightSet = new Set(right || []);
  return stableSortedStrings((left || []).filter((token) => rightSet.has(token)));
}

function semanticEvidenceForProposal(proposalSurface, seam) {
  const dependencyIds = importProposalDependencyIds(proposalSurface);
  const seamDependencies = stableSortedStrings(seam.emitted_dependencies || []);
  const matchedDependencies = seamDependencies.filter((dependency) => dependencyIds.includes(dependency));

  if (matchedDependencies.length === 0) {
    return {
      matched_dependencies: [],
      score: 0,
      reasons: []
    };
  }

  const specificity = matchedDependencies.length / Math.max(
    matchedDependencies.length,
    seamDependencies.length || 1,
    dependencyIds.length || 1
  );
  const score = 0.22 + Math.min(0.16, matchedDependencies.length * 0.08) + Math.min(0.2, specificity * 0.24) + (matchedDependencies.length >= 2 ? 0.04 : 0);
  return {
    matched_dependencies: matchedDependencies,
    score,
    reasons: [
      `semantic overlap: ${matchedDependencies.map((dependency) => `\`${dependency}\``).join(", ")}`
    ]
  };
}

function pathEvidenceForProposal(proposalSurface, seam) {
  const proposalPaths = stableSortedStrings([
    proposalSurface.source_path,
    proposalSurface.canonical_rel_path
  ]);
  const proposalTokenSet = stableSortedStrings(proposalPaths.flatMap((candidatePath) => pathTokens(candidatePath)));
  const maintainedModules = stableSortedStrings(seam.maintained_modules || []);

  let exactModuleMatches = [];
  let prefixModuleMatches = [];
  let tokenMatchedModules = [];
  let tokenMatchCount = 0;

  for (const modulePath of maintainedModules) {
    const moduleTokens = pathTokens(modulePath);
    const matchedTokens = sharedTokens(proposalTokenSet, moduleTokens);
    if (proposalPaths.some((candidatePath) => normalizePath(candidatePath) === normalizePath(modulePath))) {
      exactModuleMatches.push(modulePath);
      continue;
    }
    if (proposalPaths.some((candidatePath) =>
      pathPrefixMatches(candidatePath, modulePath) || pathPrefixMatches(modulePath, candidatePath)
    )) {
      prefixModuleMatches.push(modulePath);
    }
    if (matchedTokens.length > 0) {
      tokenMatchedModules.push({ modulePath, matchedTokens });
      tokenMatchCount = Math.max(tokenMatchCount, matchedTokens.length);
    }
  }

  const reasons = [];
  let score = 0;

  if (exactModuleMatches.length > 0) {
    score += 0.28;
    reasons.push(
      `exact maintained module match: ${stableSortedStrings(exactModuleMatches).map((modulePath) => `\`${modulePath}\``).join(", ")}`
    );
  }
  if (prefixModuleMatches.length > 0) {
    score += 0.18;
    reasons.push(
      `maintained module path proximity: ${stableSortedStrings(prefixModuleMatches).map((modulePath) => `\`${modulePath}\``).join(", ")}`
    );
  }
  if (tokenMatchCount > 0) {
    score += Math.min(0.18, 0.08 + (tokenMatchCount * 0.04));
    reasons.push(
      `path token corroboration: ${stableSortedStrings(tokenMatchedModules.flatMap((entry) => entry.matchedTokens)).map((token) => `\`${token}\``).join(", ")}`
    );
  }

  return {
    score,
    reasons,
    token_match_count: tokenMatchCount
  };
}

function outputEvidenceForProposal(proposalSurface, seam, outputRecord = null) {
  const proposalPaths = stableSortedStrings([
    proposalSurface.source_path,
    proposalSurface.canonical_rel_path
  ]);
  const proposalTokenSet = stableSortedStrings(proposalPaths.flatMap((candidatePath) => pathTokens(candidatePath)));
  const matchedOutputRoots = stableSortedStrings((outputRecord?.root_paths || []).filter((rootPath) =>
    proposalPaths.some((candidatePath) => pathPrefixMatches(candidatePath, rootPath))
  ));
  const outputTokenMatches = stableSortedStrings((outputRecord?.root_paths || []).flatMap((rootPath) =>
    sharedTokens(proposalTokenSet, pathTokens(rootPath))
  ));

  let score = 0;
  const reasons = [];

  if (matchedOutputRoots.length > 0) {
    score += 0.16;
    reasons.push(
      `output root alignment: ${matchedOutputRoots.map((rootPath) => `\`${rootPath}\``).join(", ")}`
    );
  } else if (outputTokenMatches.length > 0) {
    score += Math.min(0.1, 0.04 + (outputTokenMatches.length * 0.02));
    reasons.push(
      `output path corroboration: ${outputTokenMatches.map((token) => `\`${token}\``).join(", ")}`
    );
  }

  const proposalTrack = proposalSurface.track || null;
  const proposalKind = proposalSurface.kind || null;
  const seamKind = seam.kind || null;
  const kindAligned =
    ((proposalTrack === "ui" || proposalKind === "ui") && ["ui_presenter", "route_glue", "workflow_affordance"].includes(seamKind)) ||
    ((proposalTrack === "model" || proposalTrack === "capability" || proposalKind === "capability") && ["api_adapter", "route_glue", "policy_interpretation", "workflow_affordance"].includes(seamKind)) ||
    ((proposalTrack === "workflows" || proposalKind === "decision") && seamKind === "workflow_affordance");

  if (kindAligned) {
    score += 0.08;
    reasons.push(`proposal/seam kind alignment: \`${proposalTrack || proposalKind}\` -> \`${seamKind}\``);
  }

  return {
    score,
    reasons
  };
}

function dedupeReasons(reasons = []) {
  return stableSortedStrings(reasons);
}

function inferMaintainedSeamCandidates(proposalSurface, maintainedBoundaryArtifact = null) {
  if (!maintainedBoundaryArtifact || !Array.isArray(maintainedBoundaryArtifact.seams) || maintainedBoundaryArtifact.seams.length === 0) {
    return [];
  }

  const outputsById = new Map((maintainedBoundaryArtifact.outputs || []).map((output) => [output.output_id, output]));

  const provisionalCandidates = maintainedBoundaryArtifact.seams.map((seam) => {
    const outputRecord = outputsById.get(seam.output_id) || null;
    const semanticEvidence = semanticEvidenceForProposal(proposalSurface, seam);
    const pathEvidence = pathEvidenceForProposal(proposalSurface, seam);
    const outputEvidence = outputEvidenceForProposal(proposalSurface, seam, outputRecord);
    const rawScore = semanticEvidence.score + pathEvidence.score + outputEvidence.score;

    return {
      seam,
      rawScore,
      semantic_match_count: semanticEvidence.matched_dependencies.length,
      seam_id: seam.seam_id,
      output_id: seam.output_id || null,
      label: seam.label || null,
      kind: seam.kind || null,
      ownership_class: seam.ownership_class || null,
      status: seam.status || null,
      maintained_modules: stableSortedStrings(seam.maintained_modules || []),
      emitted_dependencies: stableSortedStrings(seam.emitted_dependencies || []),
      allowed_change_classes: stableSortedStrings(seam.allowed_change_classes || []),
      drift_signals: stableSortedStrings(seam.drift_signals || []),
      match_reasons: dedupeReasons([
        ...semanticEvidence.reasons,
        ...pathEvidence.reasons,
        ...outputEvidence.reasons
      ]),
      confidence: Math.min(1, Number(rawScore.toFixed(2)))
    };
  });

  const candidates = provisionalCandidates
    .map((candidate) => {
      const siblingCandidates = provisionalCandidates.filter((entry) =>
        entry.output_id &&
        entry.output_id === candidate.output_id &&
        entry.seam_id !== candidate.seam_id
      );
      const ambiguousSibling = siblingCandidates.find((sibling) =>
        sibling.rawScore >= 0.48 &&
        Math.abs(sibling.rawScore - candidate.rawScore) <= 0.12 &&
        Math.max(candidate.semantic_match_count, sibling.semantic_match_count) <= 1
      );
      const penalty = ambiguousSibling ? 0.18 : 0;

      return {
        ...candidate,
        match_reasons: ambiguousSibling
          ? [...candidate.match_reasons, `ambiguity penalty: sibling seam evidence in \`${candidate.output_id}\` is too similar`]
          : candidate.match_reasons,
        confidence: Math.max(0, Number((candidate.rawScore - penalty).toFixed(2)))
      };
    })
    .filter((candidate) => candidate.confidence >= 0.6 && candidate.match_reasons.length > 0)
    .sort((a, b) => {
      const severityCompare = severityRank(b.status) - severityRank(a.status);
      if (severityCompare !== 0) return severityCompare;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return String(a.seam_id || "").localeCompare(String(b.seam_id || ""));
    });

  return candidates.map(({ seam, rawScore, semantic_match_count, ...candidate }) => candidate);
}

export function selectorReviewGroupId(selector) {
  if (!selector) {
    return null;
  }
  if (selector.startsWith("projection-review:")) {
    return `projection_review:${selector.slice("projection-review:".length)}`;
  }
  if (selector.startsWith("ui-review:")) {
    return `ui_review:${selector.slice("ui-review:".length)}`;
  }
  if (selector.startsWith("workflow-review:")) {
    return `workflow_review:${selector.slice("workflow-review:".length)}`;
  }
  return null;
}

export function selectorBundleReviewSlug(selector) {
  if (!selector) {
    return null;
  }
  if (selector.startsWith("bundle-review:")) {
    const slug = selector.slice("bundle-review:".length);
    return slug || null;
  }
  return null;
}

export function parseAdoptSelector(value) {
  if (!value) {
    return null;
  }
  const selector = String(value).trim();
  if (ADOPT_SELECTORS.has(selector)) {
    return selector;
  }
  if (selectorReviewGroupId(selector)) {
    return selector;
  }
  if (selectorBundleReviewSlug(selector)) {
    return selector;
  }
  if (selector.startsWith("bundle:") && selector.length > "bundle:".length) {
    return selector;
  }
  throw new Error(`Unsupported adopt selector '${selector}'`);
}

export function adoptionItemKey(item) {
  return `${item.bundle}:${item.kind}:${item.item}`;
}

export function selectorMatchesItem(selector, item) {
  if (!selector) {
    return false;
  }
  const reviewGroupId = selectorReviewGroupId(selector);
  const bundleReviewSlug = selectorBundleReviewSlug(selector);
  if (reviewGroupId) {
    return (item.blocking_dependencies || []).some((dependency) => dependency.id === reviewGroupId);
  }
  if (bundleReviewSlug) {
    return item.bundle === bundleReviewSlug;
  }
  if (selector === "actors") return item.kind === "actor";
  if (selector === "roles") return item.kind === "role";
  if (selector === "enums") return item.kind === "enum";
  if (selector === "shapes") return item.kind === "shape";
  if (selector === "entities") return item.kind === "entity";
  if (selector === "capabilities") return item.kind === "capability";
  if (selector === "widgets") return item.kind === "widget";
  if (selector === "docs") return item.track === "docs";
  if (selector === "journeys") return item.track === "docs" && String(item.canonical_rel_path || "").startsWith("docs/journeys/");
  if (selector === "workflows") return item.track === "workflows" || item.kind === "decision";
  if (selector === "verification") return item.kind === "verification";
  if (selector === "ui") return item.track === "ui";
  if (selector.startsWith("bundle:")) return item.bundle === selector.slice("bundle:".length);
  return false;
}

function blockedStatusForItem(item) {
  if ((item.projection_impacts || []).length > 0) {
    return "needs_projection_review";
  }
  if ((item.blocking_dependencies || []).some((dependency) => dependency.type === "projection_review")) {
    return "needs_projection_review";
  }
  if ((item.ui_impacts || []).length > 0) {
    return "needs_ui_review";
  }
  if ((item.blocking_dependencies || []).some((dependency) => dependency.type === "ui_review")) {
    return "needs_ui_review";
  }
  if ((item.workflow_impacts || []).length > 0) {
    return "needs_workflow_review";
  }
  if ((item.blocking_dependencies || []).some((dependency) => dependency.type === "workflow_review")) {
    return "needs_workflow_review";
  }
  return "pending";
}

export function refreshDerivedStatuses(items, approvedReviewGroups = []) {
  const approvedSet = new Set(approvedReviewGroups || []);
  return items.map((item) => {
    if (item.status === "applied" || item.status === "skipped" || item.status === "approved") {
      return item;
    }
    const blockingDependencies = item.blocking_dependencies || [];
    if (blockingDependencies.length === 0) {
      return { ...item, status: item.status === "pending" ? "pending" : blockedStatusForItem(item) };
    }
    const fullyApproved = blockingDependencies.every((dependency) => approvedSet.has(dependency.id));
    return {
      ...item,
      status: fullyApproved ? "approved" : blockedStatusForItem(item)
    };
  });
}

export function mergeAdoptionPlanState(baseItems, existingPlan, topogramRoot) {
  const existingItems = new Map(
    (existingPlan?.items || []).map((item) => [`${item.bundle}:${item.kind}:${item.item}`, item])
  );
  const merged = baseItems.map((item) => {
    const existing = existingItems.get(`${item.bundle}:${item.kind}:${item.item}`);
    const mergedItem = existing ? { ...item, status: existing.status || item.status } : item;
    if (
      mergedItem.status !== "applied" &&
      mergedItem.status !== "skipped" &&
      mergedItem.suggested_action !== "apply_doc_link_patch" &&
      mergedItem.suggested_action !== "apply_doc_metadata_patch" &&
      mergedItem.suggested_action !== "apply_projection_permission_patch" &&
      mergedItem.suggested_action !== "apply_projection_auth_patch" &&
      mergedItem.suggested_action !== "apply_projection_ownership_patch" &&
      mergedItem.canonical_rel_path &&
      topogramRoot &&
      fs.existsSync(path.join(topogramRoot, mergedItem.canonical_rel_path))
    ) {
      return { ...mergedItem, status: "applied" };
    }
    return mergedItem;
  });
  for (const existing of existingPlan?.items || []) {
    const key = `${existing.bundle}:${existing.kind}:${existing.item}`;
    if (!merged.some((item) => adoptionItemKey(item) === key) && existing.status === "applied") {
      merged.push({ ...existing });
    }
  }
  return refreshDerivedStatuses(merged, existingPlan?.approved_review_groups || []);
}

function reviewGroupIdsForBundle(items, bundleSlug) {
  const ids = new Set();
  for (const item of items) {
    if (item.bundle !== bundleSlug) {
      continue;
    }
    for (const dependency of item.blocking_dependencies || []) {
      ids.add(dependency.id);
    }
  }
  return [...ids].sort();
}

export function applyAdoptionSelector(adoptionPlan, selector, writeMode) {
  const appliedItems = [];
  const approvedItems = [];
  const skippedItems = [];
  const blockedItems = [];
  const selectedItems = [];
  const reviewGroupId = selectorReviewGroupId(selector);
  const bundleReviewSlug = selectorBundleReviewSlug(selector);
  const updatedPlan = {
    ...adoptionPlan,
    approved_review_groups: [...new Set(adoptionPlan.approved_review_groups || [])],
    items: adoptionPlan.items.map((item) => ({ ...item }))
  };
  let updatedItems = updatedPlan.items;

  const expandSelectedItemsForDependentShapes = (keys) => {
    const expanded = new Set(keys);
    const selectedCapabilityBundles = new Set(
      [...expanded]
        .map((key) => updatedItems.find((item) => adoptionItemKey(item) === key))
        .filter((item) => item?.kind === "capability")
        .map((item) => item.bundle)
    );
    for (const item of updatedItems) {
      if (item.kind === "shape" && item.status !== "skipped" && selectedCapabilityBundles.has(item.bundle)) {
        expanded.add(adoptionItemKey(item));
      }
    }
    return [...expanded];
  };

  if (!selector) {
    return { plan: updatedPlan, appliedItems, approvedItems, skippedItems, blockedItems, selectedItems };
  }

  if (reviewGroupId || bundleReviewSlug) {
    const reviewGroupIds = reviewGroupId
      ? [reviewGroupId]
      : reviewGroupIdsForBundle(updatedItems, bundleReviewSlug);
    for (const id of reviewGroupIds) {
      if (!updatedPlan.approved_review_groups.includes(id)) {
        updatedPlan.approved_review_groups.push(id);
      }
    }
    updatedItems = refreshDerivedStatuses(updatedItems, updatedPlan.approved_review_groups);
    updatedPlan.items = updatedItems;
    for (const item of updatedItems) {
      if (!selectorMatchesItem(selector, item)) {
        continue;
      }
      if (item.status === "approved") {
        approvedItems.push(item.item);
      } else if (["needs_projection_review", "needs_ui_review", "needs_workflow_review"].includes(item.status)) {
        blockedItems.push(item.item);
      }
    }
    return { plan: updatedPlan, appliedItems, approvedItems, skippedItems, blockedItems, selectedItems };
  }

  if (selector === "from-plan") {
    const initiallySelected = [];
    for (const item of updatedItems) {
      if (item.status === "approved" || item.status === "pending") {
        initiallySelected.push(adoptionItemKey(item));
      } else if (item.status === "skipped") {
        skippedItems.push(item.item);
      } else if (["needs_projection_review", "needs_ui_review", "needs_workflow_review"].includes(item.status)) {
        blockedItems.push(item.item);
      }
    }
    const expandedSelected = expandSelectedItemsForDependentShapes(initiallySelected);
    for (const key of expandedSelected) {
      const item = updatedItems.find((entry) => adoptionItemKey(entry) === key);
      if (!item || item.status === "skipped") continue;
      selectedItems.push(key);
      appliedItems.push(item.item);
      if (writeMode) {
        item.status = "applied";
      }
    }
    updatedPlan.items = updatedItems;
    return { plan: updatedPlan, appliedItems, approvedItems, skippedItems, blockedItems, selectedItems };
  }

  const initiallySelected = [];
  for (const item of updatedItems) {
    if (item.status === "skipped") {
      skippedItems.push(item.item);
      continue;
    }
    if (["needs_projection_review", "needs_ui_review", "needs_workflow_review"].includes(item.status)) {
      if (selectorMatchesItem(selector, item)) {
        blockedItems.push(item.item);
      }
      continue;
    }
    if (selectorMatchesItem(selector, item)) {
      initiallySelected.push(adoptionItemKey(item));
    }
  }
  const expandedSelected = expandSelectedItemsForDependentShapes(initiallySelected);
  for (const key of expandedSelected) {
    const item = updatedItems.find((entry) => adoptionItemKey(entry) === key);
    if (!item || item.status === "skipped") {
      continue;
    }
    selectedItems.push(key);
    appliedItems.push(item.item);
    if (writeMode) {
      item.status = "applied";
    }
  }
  updatedPlan.items = updatedItems;
  return { plan: updatedPlan, appliedItems, approvedItems, skippedItems, blockedItems, selectedItems };
}

export function summarizeAdoptionPlanItems(items) {
  const summary = {
    approved_items: [],
    applied_items: [],
    skipped_items: [],
    blocked_items: []
  };
  for (const item of items || []) {
    if (item.status === "approved") {
      summary.approved_items.push(item.item);
    } else if (item.status === "applied") {
      summary.applied_items.push(item.item);
    } else if (item.status === "skipped") {
      summary.skipped_items.push(item.item);
    } else if (["needs_projection_review", "needs_ui_review", "needs_workflow_review"].includes(item.status)) {
      summary.blocked_items.push(item.item);
    }
  }
  for (const key of Object.keys(summary)) {
    summary[key] = [...new Set(summary[key])].sort();
  }
  return summary;
}

function inferRecommendedAdoptionState(item) {
  if (item.status === "skipped") {
    return "reject";
  }
  if (item.status === "applied") {
    return "accept";
  }
  if ((item.projection_impacts || []).length > 0 || (item.ui_impacts || []).length > 0 || (item.workflow_impacts || []).length > 0) {
    return "customize";
  }
  if (item.suggested_action && String(item.suggested_action).includes("_patch")) {
    return "customize";
  }
  return "accept";
}

function inferCurrentAdoptionState(item) {
  if (item.status === "skipped") {
    return "reject";
  }
  if (item.status === "applied") {
    return "accept";
  }
  return "stage";
}

function mappingSuggestionsForItem(item) {
  const suggestions = [];
  for (const dependency of item.blocking_dependencies || []) {
    suggestions.push({
      type: dependency.type || "review",
      id: dependency.id,
      reason: dependency.reason || null
    });
  }
  return suggestions;
}

export function buildAgentAdoptionPlan(adoptionPlan, maintainedBoundaryArtifact = null) {
  const items = (adoptionPlan?.items || []).map((item) => {
    const currentState = inferCurrentAdoptionState(item);
    const maintainedSeamCandidates = inferMaintainedSeamCandidates({
      item: item.item || null,
      kind: item.kind || null,
      track: item.track || null,
      source_path: item.source_path || null,
      canonical_rel_path: item.canonical_rel_path || null,
      requirements: {
        related_docs: [...new Set(item.related_docs || [])].sort(),
        related_capabilities: [...new Set(item.related_capabilities || [])].sort(),
        related_rules: [...new Set(item.related_rules || [])].sort(),
        related_workflows: [...new Set(item.related_workflows || [])].sort()
      },
      projection_impacts: [...(item.projection_impacts || [])],
      ui_impacts: [...(item.ui_impacts || [])],
      workflow_impacts: [...(item.workflow_impacts || [])]
    }, maintainedBoundaryArtifact);
    return {
      id: adoptionItemKey(item),
      bundle: item.bundle,
      item: item.item,
      kind: item.kind,
      track: item.track || null,
      source_path: item.source_path || null,
      canonical_rel_path: item.canonical_rel_path || null,
      review_boundary: reviewBoundaryForImportProposal(item),
      current_state: currentState,
      recommended_state: inferRecommendedAdoptionState(item),
      supported_states: ADOPTION_STATE_VOCABULARY,
      human_review_required:
        currentState === "stage" ||
        ["needs_projection_review", "needs_ui_review", "needs_workflow_review"].includes(item.status),
      provenance: {
        bundle: item.bundle,
        source_path: item.source_path || null,
        canonical_rel_path: item.canonical_rel_path || null
      },
      requirements: {
        related_docs: [...new Set(item.related_docs || [])].sort(),
        related_capabilities: [...new Set(item.related_capabilities || [])].sort(),
        related_rules: [...new Set(item.related_rules || [])].sort(),
        related_workflows: [...new Set(item.related_workflows || [])].sort(),
        blocking_dependencies: [...(item.blocking_dependencies || [])]
      },
      projection_impacts: [...(item.projection_impacts || [])],
      ui_impacts: [...(item.ui_impacts || [])],
      workflow_impacts: [...(item.workflow_impacts || [])],
      maintained_seam_candidates: maintainedSeamCandidates,
      mapping_suggestions: mappingSuggestionsForItem(item),
      available_actions: ADOPTION_STATE_VOCABULARY
    };
  });

  return {
    type: "agent_adoption_plan",
    version: 1,
    workspace: adoptionPlan?.workspace || null,
    source_plan_type: adoptionPlan?.type || null,
    adoption_state_vocabulary: ADOPTION_STATE_VOCABULARY,
    terminology: {
      candidate_workspace_term: "candidate",
      non_canonical_adoption_state: "stage"
    },
    approved_review_groups: [...new Set(adoptionPlan?.approved_review_groups || [])].sort(),
    imported_proposal_surfaces: items,
    staged_items: items.filter((item) => item.current_state === "stage").map((item) => item.id),
    accepted_items: items.filter((item) => item.current_state === "accept").map((item) => item.id),
    rejected_items: items.filter((item) => item.current_state === "reject").map((item) => item.id),
    requires_human_review: items.filter((item) => item.human_review_required).map((item) => item.id)
  };
}

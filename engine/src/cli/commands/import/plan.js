// @ts-check

import fs from "node:fs";
import path from "node:path";

import { readExtractionContext } from "../../../extraction-context.js";
import { runWorkflow } from "../../../workflows.js";
import {
  countByField,
  importAdoptCommand,
  importProjectCommandPath,
  normalizeProjectRoot,
  normalizeTopogramPath,
  readJsonIfExists
} from "./paths.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

export const BROWNFIELD_BROAD_ADOPT_SELECTORS = [
  {
    selector: "from-plan",
    kind: "plan",
    label: "approved or pending plan items",
    matches: (/** @type {AnyRecord} */ item) => item.current_state === "stage" || item.current_state === "accept"
  },
  { selector: "actors", kind: "kind", label: "actors", matches: (/** @type {AnyRecord} */ item) => item.kind === "actor" },
  { selector: "roles", kind: "kind", label: "roles", matches: (/** @type {AnyRecord} */ item) => item.kind === "role" },
  { selector: "enums", kind: "kind", label: "enums", matches: (/** @type {AnyRecord} */ item) => item.kind === "enum" },
  { selector: "shapes", kind: "kind", label: "shapes", matches: (/** @type {AnyRecord} */ item) => item.kind === "shape" },
  { selector: "entities", kind: "kind", label: "entities", matches: (/** @type {AnyRecord} */ item) => item.kind === "entity" },
  { selector: "capabilities", kind: "kind", label: "capabilities", matches: (/** @type {AnyRecord} */ item) => item.kind === "capability" },
  { selector: "widgets", kind: "kind", label: "widgets", matches: (/** @type {AnyRecord} */ item) => item.kind === "widget" },
  { selector: "docs", kind: "track", label: "docs", matches: (/** @type {AnyRecord} */ item) => item.track === "docs" },
  {
    selector: "journeys",
    kind: "track",
    label: "journey docs",
    matches: (/** @type {AnyRecord} */ item) => item.track === "docs" && String(item.canonical_rel_path || "").startsWith("docs/journeys/")
  },
  { selector: "workflows", kind: "track", label: "workflows", matches: (/** @type {AnyRecord} */ item) => item.track === "workflows" || item.kind === "decision" },
  { selector: "verification", kind: "kind", label: "verification", matches: (/** @type {AnyRecord} */ item) => item.kind === "verification" },
  {
    selector: "cli",
    kind: "track",
    label: "CLI surfaces",
    matches: (/** @type {AnyRecord} */ item) =>
      item.bundle === "cli" ||
      item.track === "cli" ||
      item.suggested_action === "promote_cli_surface"
  },
  {
    selector: "ui",
    kind: "track",
    label: "UI reports, widgets, and event shapes",
    matches: (/** @type {AnyRecord} */ item) =>
      item.track === "ui" ||
      item.kind === "widget" ||
      item.source_kind === "ui_widget_event"
  }
];

/**
 * @param {AnyRecord|null|undefined} extractionContext
 * @param {AnyRecord[]} bundleSurfaces
 * @param {string} bundleSlug
 * @returns {string[]}
 */
function tracksForBundle(extractionContext, bundleSurfaces, bundleSlug) {
  const tracks = new Set(bundleSurfaces.map((surface) => surface.track).filter(Boolean));
  if (bundleSlug === "database" || bundleSlug.includes("db")) tracks.add("db");
  if (bundleSlug === "cli") tracks.add("cli");
  if (bundleSlug === "ui") tracks.add("ui");
  if (bundleSlug.includes("api")) tracks.add("api");
  const knownTracks = new Set(Array.isArray(extractionContext?.tracks) ? extractionContext.tracks : []);
  return [...tracks].filter((track) => knownTracks.size === 0 || knownTracks.has(track)).sort((left, right) => left.localeCompare(right));
}

/**
 * @param {AnyRecord} extractor
 * @param {Set<string>} tracks
 * @returns {boolean}
 */
function extractorMatchesTracks(extractor, tracks) {
  const extractorTracks = Array.isArray(extractor.tracks) ? extractor.tracks : [];
  return tracks.size === 0 || extractorTracks.length === 0 || extractorTracks.some((track) => tracks.has(track));
}

/**
 * @param {AnyRecord|null|undefined} extractionContext
 * @param {AnyRecord[]} bundleSurfaces
 * @param {string} bundleSlug
 * @returns {AnyRecord|null}
 */
function extractorContextForBundle(extractionContext, bundleSurfaces, bundleSlug) {
  if (!extractionContext) {
    return null;
  }
  const tracks = tracksForBundle(extractionContext, bundleSurfaces, bundleSlug);
  const trackSet = new Set(tracks);
  const packageBackedExtractors = (extractionContext.package_backed_extractors || [])
    .filter((/** @type {AnyRecord} */ extractor) => extractorMatchesTracks(extractor, trackSet))
    .map((/** @type {AnyRecord} */ extractor) => ({
      id: extractor.id || null,
      version: extractor.version || null,
      manifestVersion: extractor.manifestVersion || extractor.version || null,
      packageName: extractor.packageName || null,
      packageVersion: extractor.packageVersion || null,
      packageVersionStatus: extractor.packageVersionStatus || null,
      compatibleCliRange: extractor.compatibleCliRange || null,
      policyPin: extractor.policyPin || null,
      extractors: Array.isArray(extractor.extractors) ? extractor.extractors : [],
      tracks: Array.isArray(extractor.tracks) ? extractor.tracks : []
    }));
  const bundledExtractors = (extractionContext.bundled_extractors || [])
    .filter((/** @type {AnyRecord} */ extractor) => extractorMatchesTracks(extractor, trackSet))
    .map((/** @type {AnyRecord} */ extractor) => ({
      id: extractor.id || null,
      version: extractor.version || null,
      extractors: Array.isArray(extractor.extractors) ? extractor.extractors : [],
      tracks: Array.isArray(extractor.tracks) ? extractor.tracks : []
    }));
  if (packageBackedExtractors.length === 0 && bundledExtractors.length === 0) {
    return null;
  }
  return {
    tracks,
    packageBackedExtractors,
    bundledExtractors,
    candidateCounts: extractionContext.candidate_counts || {},
    safetyNotes: extractionContext.safety_notes || []
  };
}

/**
 * @param {string} inputPath
 * @returns {AnyRecord}
 */
export function readImportAdoptionArtifacts(inputPath) {
  const projectRoot = normalizeProjectRoot(inputPath);
  const topogramRoot = normalizeTopogramPath(inputPath);
  const reconcileRoot = path.join(topogramRoot, "candidates", "reconcile");
  const paths = {
    reconcileRoot,
    adoptionPlanAgent: path.join(reconcileRoot, "adoption-plan.agent.json"),
    adoptionPlan: path.join(reconcileRoot, "adoption-plan.json"),
    adoptionStatus: path.join(reconcileRoot, "adoption-status.json"),
    reconcileReport: path.join(reconcileRoot, "report.json")
  };
  if (!fs.existsSync(paths.adoptionPlanAgent)) {
    throw new Error(`No extraction adoption plan found under '${reconcileRoot}'. Run 'topogram extract <app-path> --out <target>' first.`);
  }
  return {
    projectRoot,
    topogramRoot,
    paths,
    adoptionPlan: JSON.parse(fs.readFileSync(paths.adoptionPlanAgent, "utf8")),
    adoptionStatus: readJsonIfExists(paths.adoptionStatus),
    reconcileReport: readJsonIfExists(paths.reconcileReport),
    extractionContext: readExtractionContext(topogramRoot)
  };
}

/**
 * @param {string} projectRoot
 * @param {AnyRecord} adoptionPlan
 * @returns {AnyRecord[]}
 */
export function buildBrownfieldBroadAdoptSelectors(projectRoot, adoptionPlan) {
  const surfaces = /** @type {AnyRecord[]} */ (adoptionPlan.imported_proposal_surfaces || []);
  return BROWNFIELD_BROAD_ADOPT_SELECTORS.map((definition) => {
    const items = surfaces.filter(definition.matches);
    const pendingItems = items.filter((/** @type {AnyRecord} */ item) => !["accept", "accepted", "applied"].includes(item.current_state));
    const appliedItems = items.filter((/** @type {AnyRecord} */ item) => ["accept", "accepted", "applied"].includes(item.current_state));
    const blockedItems = items.filter((/** @type {AnyRecord} */ item) => item.human_review_required);
    return {
      selector: definition.selector,
      kind: definition.kind,
      label: definition.label,
      itemCount: items.length,
      pendingItemCount: pendingItems.length,
      appliedItemCount: appliedItems.length,
      blockedItemCount: blockedItems.length,
      previewCommand: importAdoptCommand(projectRoot, definition.selector, false),
      writeCommand: importAdoptCommand(projectRoot, definition.selector, true)
    };
  }).filter((selector) => selector.itemCount > 0);
}

/**
 * @param {AnyRecord} adoptionPlan
 * @param {AnyRecord} adoptionStatus
 * @param {string} projectRoot
 * @param {AnyRecord|null|undefined} extractionContext
 * @returns {AnyRecord}
 */
export function summarizeImportAdoption(adoptionPlan, adoptionStatus, projectRoot, extractionContext = null) {
  const surfaces = adoptionPlan.imported_proposal_surfaces || [];
  /** @type {string[]} */
  const slugs = [];
  /** @type {Map<string, AnyRecord[]>} */
  const surfaceMap = new Map();
  for (const surface of surfaces) {
    const slug = surface.bundle || "unbundled";
    if (!surfaceMap.has(slug)) {
      surfaceMap.set(slug, []);
      slugs.push(slug);
    }
    surfaceMap.get(slug)?.push(surface);
  }
  for (const item of /** @type {AnyRecord[]} */ (adoptionStatus?.bundle_priorities || [])) {
    if (item?.bundle && !surfaceMap.has(item.bundle)) {
      surfaceMap.set(item.bundle, []);
      slugs.push(item.bundle);
    }
  }
  const blockersByBundle = new Map((/** @type {AnyRecord[]} */ (adoptionStatus?.bundle_blockers || [])).map((item) => [item.bundle, item]));
  const prioritiesByBundle = new Map((/** @type {AnyRecord[]} */ (adoptionStatus?.bundle_priorities || [])).map((item) => [item.bundle, item]));
  const bundles = slugs.sort((left, right) => left.localeCompare(right)).map((slug) => {
    const bundleSurfaces = surfaceMap.get(slug) || [];
    const blocker = blockersByBundle.get(slug) || null;
    const priority = prioritiesByBundle.get(slug) || null;
    const pendingItems = blocker?.pending_items || bundleSurfaces
      .filter((/** @type {AnyRecord} */ item) => !["accept", "accepted", "applied"].includes(item.current_state))
      .map((/** @type {AnyRecord} */ item) => item.item);
    const appliedItems = blocker?.applied_items || [];
    const blockedItems = blocker?.blocked_items || [];
    return {
      bundle: slug,
      itemCount: bundleSurfaces.length,
      pendingItemCount: pendingItems.length,
      appliedItemCount: appliedItems.length,
      blockedItemCount: blockedItems.length,
      humanReviewRequiredCount: bundleSurfaces.filter((/** @type {AnyRecord} */ item) => item.human_review_required).length,
      kindCounts: countByField(bundleSurfaces, "kind"),
      complete: Boolean(priority?.is_complete) || (pendingItems.length === 0 && blockedItems.length === 0 && appliedItems.length > 0),
      evidenceScore: priority?.evidence_score || 0,
      why: priority?.operator_summary?.whyThisBundle || null,
      nextCommand: importAdoptCommand(projectRoot, `bundle:${slug}`, false),
      extractorContext: extractorContextForBundle(extractionContext, bundleSurfaces, slug)
    };
  });
  const nextBundle = bundles.find((bundle) => !bundle.complete && bundle.pendingItemCount > 0) || bundles.find((bundle) => !bundle.complete) || bundles[0] || null;
  const blockedCount = bundles.reduce((total, bundle) => total + bundle.blockedItemCount, 0);
  const pendingCount = bundles.reduce((total, bundle) => total + bundle.pendingItemCount, 0);
  const appliedCount = adoptionStatus?.applied_item_count ?? bundles.reduce((total, bundle) => total + bundle.appliedItemCount, 0);
  return {
    summary: {
      bundleCount: bundles.length,
      proposalItemCount: surfaces.length,
      pendingItemCount: pendingCount,
      appliedItemCount: appliedCount,
      blockedItemCount: blockedCount,
      requiresHumanReviewCount: (adoptionPlan.requires_human_review || []).length || surfaces.filter((/** @type {AnyRecord} */ item) => item.human_review_required).length
    },
    bundles,
    risks: [
      ...(blockedCount > 0 ? [`${blockedCount} adoption item(s) are blocked.`] : []),
      ...(((adoptionPlan.requires_human_review || []).length || surfaces.some((/** @type {AnyRecord} */ item) => item.human_review_required))
        ? ["Extracted proposal items require human review before adoption."]
        : [])
    ],
    nextCommand: nextBundle ? nextBundle.nextCommand : `topogram extract status ${importProjectCommandPath(projectRoot)}`
  };
}

/**
 * @param {string} inputPath
 * @returns {AnyRecord}
 */
export function buildBrownfieldImportPlanPayload(inputPath) {
  const artifacts = readImportAdoptionArtifacts(inputPath);
  const adoptionStatus = runWorkflow("adoption-status", artifacts.projectRoot).summary || artifacts.adoptionStatus || {};
  const adoption = summarizeImportAdoption(artifacts.adoptionPlan, adoptionStatus, artifacts.projectRoot, artifacts.extractionContext);
  return {
    ok: true,
    projectRoot: artifacts.projectRoot,
    workspaceRoot: artifacts.topogramRoot,
    topogramRoot: artifacts.topogramRoot,
    artifacts: {
      adoptionPlan: artifacts.paths.adoptionPlanAgent,
      adoptionStatus: artifacts.paths.adoptionStatus,
      reconcileReport: artifacts.paths.reconcileReport
    },
    extractorContext: artifacts.extractionContext ? {
      provenancePath: artifacts.extractionContext.provenance_path,
      packageBackedExtractors: artifacts.extractionContext.package_backed_extractors,
      bundledExtractors: artifacts.extractionContext.bundled_extractors,
      candidateCounts: artifacts.extractionContext.candidate_counts,
      safetyNotes: artifacts.extractionContext.safety_notes,
      summary: artifacts.extractionContext.summary
    } : null,
    ...adoption,
    commands: {
      check: `topogram extract check ${importProjectCommandPath(artifacts.projectRoot)}`,
      status: `topogram extract status ${importProjectCommandPath(artifacts.projectRoot)}`,
      next: adoption.nextCommand
    }
  };
}

/**
 * @param {AnyRecord} payload
 * @returns {void}
 */
export function printBrownfieldImportPlan(payload) {
  console.log(`Extraction adoption plan for ${payload.projectRoot}`);
  console.log(`Proposal items: ${payload.summary.proposalItemCount}`);
  console.log(`Bundles: ${payload.summary.bundleCount}`);
  for (const bundle of payload.bundles) {
    console.log(`- ${bundle.bundle}: ${bundle.itemCount} item(s), ${bundle.pendingItemCount} pending, ${bundle.appliedItemCount} applied`);
    if (bundle.why) {
      console.log(`  ${bundle.why}`);
    }
    if (bundle.extractorContext?.packageBackedExtractors?.length > 0) {
      const names = bundle.extractorContext.packageBackedExtractors
        .map((/** @type {AnyRecord} */ extractor) => {
          const name = extractor.packageName || extractor.id;
          const details = [
            extractor.manifestVersion ? `manifest ${extractor.manifestVersion}` : null,
            extractor.packageVersion ? `package ${extractor.packageVersion}` : null,
            extractor.compatibleCliRange ? `cli ${extractor.compatibleCliRange}` : null,
            extractor.policyPin?.state ? `pin ${extractor.policyPin.state}` : null
          ].filter(Boolean).join(", ");
          return details ? `${name} (${details})` : name;
        })
        .filter(Boolean)
        .join(", ");
      console.log(`  Extractors: ${names}`);
      console.log("  Safety: package-backed extractor candidates are review-only; run dry-run adoption before --write.");
    }
    console.log(`  Preview: ${bundle.nextCommand}`);
  }
  if (payload.risks.length > 0) {
    console.log("Risks:");
    for (const risk of payload.risks) {
      console.log(`- ${risk}`);
    }
  }
  console.log("");
  console.log(`Next: ${payload.nextCommand}`);
}

/**
 * @param {string} inputPath
 * @returns {AnyRecord}
 */
export function buildBrownfieldImportAdoptListPayload(inputPath) {
  const artifacts = readImportAdoptionArtifacts(inputPath);
  const plan = buildBrownfieldImportPlanPayload(inputPath);
  const selectors = plan.bundles.map((/** @type {AnyRecord} */ bundle) => ({
    selector: `bundle:${bundle.bundle}`,
    kind: "bundle",
    bundle: bundle.bundle,
    itemCount: bundle.itemCount,
    pendingItemCount: bundle.pendingItemCount,
    appliedItemCount: bundle.appliedItemCount,
    blockedItemCount: bundle.blockedItemCount,
    complete: bundle.complete,
    extractorContext: bundle.extractorContext || null,
    previewCommand: importAdoptCommand(plan.projectRoot, `bundle:${bundle.bundle}`, false),
    writeCommand: importAdoptCommand(plan.projectRoot, `bundle:${bundle.bundle}`, true)
  }));
  const broadSelectors = buildBrownfieldBroadAdoptSelectors(plan.projectRoot, artifacts.adoptionPlan);
  return {
    ok: true,
    projectRoot: plan.projectRoot,
    workspaceRoot: plan.topogramRoot,
    topogramRoot: plan.topogramRoot,
    selectorCount: selectors.length,
    selectors,
    broadSelectorCount: broadSelectors.length,
    broadSelectors,
    extractorContext: plan.extractorContext,
    nextCommand: selectors.find((/** @type {AnyRecord} */ selector) => !selector.complete)?.previewCommand || plan.commands.status
  };
}

/**
 * @param {AnyRecord} payload
 * @returns {void}
 */
export function printBrownfieldImportAdoptList(payload) {
  console.log(`Adoption selectors for ${payload.projectRoot}`);
  if (payload.selectors.length === 0) {
    console.log("No adoption selectors are available. Run `topogram extract plan` to inspect reconcile artifacts.");
    return;
  }
  for (const selector of payload.selectors) {
    console.log(`- ${selector.selector}: ${selector.itemCount} item(s), ${selector.pendingItemCount} pending, ${selector.appliedItemCount} applied`);
    if (selector.extractorContext?.packageBackedExtractors?.length > 0) {
      const names = selector.extractorContext.packageBackedExtractors
        .map((/** @type {AnyRecord} */ extractor) => {
          const name = extractor.packageName || extractor.id;
          const details = [
            extractor.manifestVersion ? `manifest ${extractor.manifestVersion}` : null,
            extractor.packageVersion ? `package ${extractor.packageVersion}` : null,
            extractor.compatibleCliRange ? `cli ${extractor.compatibleCliRange}` : null,
            extractor.policyPin?.state ? `pin ${extractor.policyPin.state}` : null
          ].filter(Boolean).join(", ");
          return details ? `${name} (${details})` : name;
        })
        .filter(Boolean)
        .join(", ");
      console.log(`  Extractors: ${names}`);
      console.log("  Safety: package-backed extractor candidates are review-only; run dry-run adoption before --write.");
    }
    console.log(`  Preview: ${selector.previewCommand}`);
    console.log(`  Write: ${selector.writeCommand}`);
  }
  if (payload.broadSelectors.length > 0) {
    console.log("");
    console.log("Broad selectors:");
    for (const selector of payload.broadSelectors) {
      console.log(`- ${selector.selector}: ${selector.itemCount} ${selector.label}`);
      console.log(`  Preview: ${selector.previewCommand}`);
      console.log(`  Write: ${selector.writeCommand}`);
    }
  }
  console.log("");
  console.log(`Next: ${payload.nextCommand}`);
}

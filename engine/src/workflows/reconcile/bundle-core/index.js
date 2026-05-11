// @ts-check
import { ensureTrailingNewline, idHintify, slugify, titleCase } from "../../../text-helpers.js";
import {
  annotateBundleAuthHintClosures,
  buildAuthClaimReviewGuidance,
  buildAuthHintClosureSummary,
  buildAuthOwnershipReviewGuidance,
  buildAuthPermissionReviewGuidance,
  buildAuthRoleReviewGuidance,
  formatAuthClaimHintInline,
  formatAuthOwnershipHintInline,
  formatAuthPermissionHintInline,
  formatAuthRoleGuidanceInline
} from "../auth.js";
import { collectBundleProvenance, collectBundleRuleIds, primaryEntityIdForBundle } from "../bundle-shared.js";
import { buildBundleOperatorSummary, summarizeBundleSurface } from "../summary.js";

/** @param {any} conceptId @returns {any} */
export function bundleKeyForConcept(conceptId) {
  return slugify(String(conceptId || "").replace(/^entity_/, "").replace(/^enum_/, "")) || "candidate";
}

/** @param {Map<string, CandidateBundle>} bundles @param {any} conceptId @param {string} label @returns {any} */
export function getOrCreateCandidateBundle(bundles, conceptId, label) {
  const key = conceptId || `bundle_${bundles.size + 1}`;
  if (!bundles.has(key)) {
    bundles.set(key, {
      id: key,
      slug: bundleKeyForConcept(key),
      label: label || titleCase(String(key).replace(/^entity_/, "").replace(/^enum_/, "")),
      actors: [],
      roles: [],
      entities: [],
      enums: [],
      capabilities: [],
      shapes: [],
      widgets: [],
      cliSurfaces: [],
      screens: [],
      uiRoutes: [],
      uiActions: [],
      workflows: [],
      verifications: [],
      workflowStates: [],
      workflowTransitions: [],
      docs: [],
      docLinkSuggestions: [],
      docMetadataPatches: [],
      projectionPatches: [],
      importedFieldEvidence: []
    });
  }
  return bundles.get(key);
}

/** @param {any} conceptId @returns {any} */
export function bundleLabelFromConceptId(conceptId) {
  return titleCase(String(conceptId || "").replace(/^(entity|flow|surface)_/, ""));
}

/** @param {ResolvedGraph} graph @returns {any} */
export function canonicalJourneyCoverage(graph) {
  const journeyDocs = (graph?.docs || []).filter((/** @type {any} */ doc) => doc.kind === "journey");
  return {
    byEntityId: new Set(journeyDocs.flatMap((/** @type {any} */ doc) => doc.relatedEntities || [])),
    byCapabilityId: new Set(journeyDocs.flatMap((/** @type {any} */ doc) => doc.relatedCapabilities || []))
  };
}

/** @param {CandidateBundle} bundle @returns {any} */
export function buildBundleJourneyDraft(bundle) {
  const relatedCapabilities = [...new Set((bundle.capabilities || []).map((/** @type {any} */ entry) => entry.id_hint))].sort();
  const relatedWorkflows = [...new Set((bundle.workflows || []).map((/** @type {any} */ entry) => entry.id_hint))].sort();
  const relatedRules = collectBundleRuleIds(bundle);
  const relatedActors = [...new Set((bundle.actors || []).map((/** @type {any} */ entry) => entry.id_hint))].sort();
  const relatedRoles = [...new Set((bundle.roles || []).map((/** @type {any} */ entry) => entry.id_hint))].sort();
  const primaryEntityId = primaryEntityIdForBundle(bundle);
  const relatedEntities = [...new Set([primaryEntityId, ...(bundle.entities || []).map((/** @type {any} */ entry) => entry.id_hint)].filter(Boolean))].slice(0, 4);
  const routePaths = [...new Set((bundle.uiRoutes || []).map((/** @type {any} */ entry) => entry.path).filter(Boolean))];
  const screenIds = [...new Set((bundle.screens || []).map((/** @type {any} */ entry) => entry.id_hint))];
  const screenKinds = [...new Set((bundle.screens || []).map((/** @type {any} */ entry) => entry.screen_kind).filter(Boolean))];
  const createCapabilities = relatedCapabilities.filter((/** @type {any} */ id) => /^cap_create_/.test(id));
  const browseCapabilities = relatedCapabilities.filter((/** @type {any} */ id) => /^cap_(list|get)_/.test(id));
  const lifecycleCapabilities = relatedCapabilities.filter((/** @type {any} */ id) => /^cap_(update|close|complete|archive|delete|submit|request)_/.test(id));
  const interactionCapabilities = relatedCapabilities.filter((/** @type {any} */ id) => /^cap_(favorite|unfavorite|follow|unfollow|vote|like|unlike)_/.test(id));
  const authCapabilities = relatedCapabilities.filter((/** @type {any} */ id) => /^cap_(sign_in|sign_out|register|authenticate|login|logout)_/.test(id));
  const participantActors = relatedActors;
  const participantRoles = relatedRoles;
  const hasListDetail = browseCapabilities.some((/** @type {any} */ id) => /^cap_list_/.test(id)) && browseCapabilities.some((/** @type {any} */ id) => /^cap_get_/.test(id));
  const hasCreateAndLifecycle = createCapabilities.length > 0 && lifecycleCapabilities.length > 0;
  const hasWorkflowEvidence = relatedWorkflows.length > 0;
  const flowShape =
    authCapabilities.length > 0 ? "auth" :
    hasCreateAndLifecycle && hasListDetail ? "create_browse_lifecycle" :
    hasListDetail && lifecycleCapabilities.length > 0 ? "browse_lifecycle" :
    hasListDetail ? "browse_detail" :
    createCapabilities.length > 0 ? "create" :
    lifecycleCapabilities.length > 0 ? "lifecycle" :
    interactionCapabilities.length > 0 ? "interaction" :
    hasWorkflowEvidence ? "workflow" :
    "general";
  const routeEvidence = routePaths.length > 0;
  const screenEvidence = screenIds.length > 0;
  const browsePhrase = browseCapabilities.length > 0
    ? browseCapabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ")
    : createCapabilities.length > 0
      ? createCapabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ")
      : relatedCapabilities.slice(0, 3).map((/** @type {any} */ item) => `\`${item}\``).join(", ");
  const lifecyclePhrase = lifecycleCapabilities.length > 0
    ? lifecycleCapabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ")
    : interactionCapabilities.length > 0
      ? interactionCapabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ")
      : browseCapabilities.slice(0, 2).map((/** @type {any} */ item) => `\`${item}\``).join(", ");
  const startSurface = routeEvidence
    ? routePaths.slice(0, 2).map((/** @type {any} */ item) => `\`${item}\``).join(" or ")
    : screenEvidence
      ? screenIds.slice(0, 2).map((/** @type {any} */ item) => `\`${item}\``).join(" or ")
      : `the ${bundle.label.toLowerCase()} API surface`;
  const continuationSurface = screenEvidence
    ? `${screenKinds.length > 0 ? screenKinds.join(", ") : "screen"} surfaces ${screenIds.slice(0, 3).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`
    : routeEvidence
      ? `the recovered route structure around ${routePaths.slice(0, 3).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`
      : `the recovered ${bundle.label.toLowerCase()} lifecycle`;
  const participantPhrase = [...participantActors, ...participantRoles].length > 0
    ? [...participantActors, ...participantRoles].map((/** @type {any} */ item) => `\`${item}\``).join(", ")
    : null;
  const participantVerb = participantPhrase && participantPhrase.includes(", ") ? "enter" : "enters";
  const title =
    flowShape === "auth" ? `${bundle.label} Sign-In and Session Flow` :
    flowShape === "create_browse_lifecycle" ? `${bundle.label} Creation, Detail, and Lifecycle Flow` :
    flowShape === "browse_lifecycle" ? `${bundle.label} Detail and Lifecycle Flow` :
    flowShape === "browse_detail" ? `${bundle.label} Discovery and Detail Flow` :
    flowShape === "create" ? `${bundle.label} Creation Flow` :
    flowShape === "lifecycle" ? `${bundle.label} Lifecycle Flow` :
    flowShape === "interaction" ? `${bundle.label} Interaction Flow` :
    flowShape === "workflow" ? `${bundle.label} Workflow Flow` :
    `${bundle.label} Core Journey`;
  const intentPhrase =
    flowShape === "auth"
      ? `signing in and establishing ${bundle.label.toLowerCase()} access cleanly`
      : flowShape === "create_browse_lifecycle"
        ? `creating ${bundle.label.toLowerCase()} work, finding it again, and moving it through lifecycle changes with confidence`
        : flowShape === "browse_lifecycle"
          ? `opening ${bundle.label.toLowerCase()} detail state and progressing it safely`
          : flowShape === "browse_detail"
            ? `finding and understanding ${bundle.label.toLowerCase()} state`
            : flowShape === "create"
              ? `creating ${bundle.label.toLowerCase()} work safely`
              : flowShape === "lifecycle"
                ? `moving ${bundle.label.toLowerCase()} work through its lifecycle without losing context`
                : flowShape === "interaction"
                  ? `performing repeated ${bundle.label.toLowerCase()} interactions without losing context`
                  : `moving through the recovered ${bundle.label.toLowerCase()} flow with confidence`;
  /** @type {WorkflowRecord} */
  const metadata = {
    id: `${idHintify(bundle.slug)}_journey`,
    kind: "journey",
    title,
    status: "inferred",
    summary: `Candidate ${bundle.label.toLowerCase()} journey inferred during reconcile from imported app evidence.`,
    source_of_truth: "imported",
    confidence: "medium",
    review_required: true,
    related_entities: relatedEntities,
    related_capabilities: relatedCapabilities,
    related_actors: relatedActors,
    related_roles: relatedRoles,
    related_rules: relatedRules,
    related_workflows: relatedWorkflows,
    provenance: [...collectBundleProvenance(bundle)].slice(0, 8),
    tags: ["import", "journey"]
  };
  const canonicalDestination = `docs/journeys/${metadata.id}.md`;
  const recoveredSignals = [
    `Capabilities: ${relatedCapabilities.length ? relatedCapabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_none_"}`,
    `Workflows: ${relatedWorkflows.length ? relatedWorkflows.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_none_"}`,
    `Rules: ${relatedRules.length ? relatedRules.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_none_"}`,
    `Screens: ${screenIds.length ? screenIds.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_none_"}`,
    `Routes: ${routePaths.length ? routePaths.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_none_"}`
  ];
  const body = [
    "Candidate journey inferred during reconcile from imported capabilities, UI surfaces, and workflow evidence.",
    "",
    "Review and rewrite this draft before promoting it as canonical.",
    "",
    `The user intent centers on ${intentPhrase} based on the brownfield capabilities, route evidence, and workflow signals recovered for this bundle.${participantPhrase ? ` The strongest inferred participants are ${participantPhrase}.` : ""}${relatedRules.length ? ` The strongest inferred constraints come from ${relatedRules.map((/** @type {any} */ item) => `\`${item}\``).join(", ")}.` : ""}`,
    "",
    "## Recovered Signals",
    "",
    ...recoveredSignals,
    "",
    "## Happy Path",
    "",
    flowShape === "auth"
      ? `1. ${participantPhrase ? `The flow begins for ${participantPhrase}` : "The user"} through ${startSurface} and provides the credentials or session input required by ${authCapabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ")}.`
      : `1. ${participantPhrase ? `${participantPhrase} ${participantVerb}` : "The user enters"} the flow through ${startSurface}.`,
    flowShape === "create_browse_lifecycle"
      ? `2. The recovered flow uses ${createCapabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ")} to create or submit new ${bundle.label.toLowerCase()} work, then ${browseCapabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ")} to find it again.`
      : flowShape === "browse_detail"
        ? `2. The recovered flow uses ${browsePhrase || `the inferred ${bundle.label.toLowerCase()} capabilities`} to load or establish the current ${bundle.label.toLowerCase()} state.`
        : flowShape === "auth"
          ? `2. The recovered flow returns the user to the authenticated ${bundle.label.toLowerCase()} state without losing the intended next step.`
          : `2. The recovered flow uses ${browsePhrase || `the inferred ${bundle.label.toLowerCase()} capabilities`} to load or establish the current ${bundle.label.toLowerCase()} state.`,
    flowShape === "create_browse_lifecycle"
      ? `3. The user continues through ${lifecyclePhrase || `the remaining ${bundle.label.toLowerCase()} actions`} while keeping ${continuationSurface} coherent.`
      : flowShape === "interaction"
        ? `3. The user can repeat ${interactionCapabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ")} while keeping ${continuationSurface} coherent.`
        : `3. The user continues through ${lifecyclePhrase || `the remaining ${bundle.label.toLowerCase()} actions`} while keeping ${continuationSurface} coherent.`,
    "",
    "## Alternate Paths",
    "",
    relatedWorkflows.length > 0
      ? `- Workflow evidence such as ${relatedWorkflows.map((/** @type {any} */ item) => `\`${item}\``).join(", ")} should stay aligned with the journey instead of drifting into an undocumented lifecycle.`
      : "- If the brownfield app exposes alternate lifecycle branches, capture them explicitly before promoting this journey.",
    relatedRules.length > 0
      ? `- Rule evidence such as ${relatedRules.map((/** @type {any} */ item) => `\`${item}\``).join(", ")} should remain visible in the journey instead of being lost during promotion.`
      : "- If the brownfield app enforces important constraints outside the imported model, capture them explicitly before promotion.",
    routeEvidence
      ? `- Recovered routes ${routePaths.slice(0, 3).map((/** @type {any} */ item) => `\`${item}\``).join(", ")} should remain understandable to the user instead of fragmenting the flow.`
      : screenEvidence
        ? `- Recovered screens ${screenIds.slice(0, 3).map((/** @type {any} */ item) => `\`${item}\``).join(", ")} should still read as one user-goal flow rather than disconnected views.`
        : "- If only API evidence exists today, add UI or docs context before promoting this journey as canonical.",
    "",
    "## Change Review Notes",
    "",
    `Review this journey when changing ${bundle.label.toLowerCase()} capabilities, screen surfaces, route structure, or workflow transitions.${relatedRules.length ? ` Re-check ${relatedRules.map((/** @type {any} */ item) => `\`${item}\``).join(", ")} when those changes could weaken the recovered constraints.` : ""}`,
    "",
    "## Promotion Notes",
    "",
    `- Canonical destination: \`${canonicalDestination}\`.`,
    "- Promote this draft with `reconcile adopt journeys --write` after reviewing participants, recovered signals, and change-review notes.",
    `- Keep the promoted journey aligned with bundle \`${bundle.slug}\` so future reconcile runs continue to explain the same user-goal flow.`
  ].join("\n");

  return {
    id: metadata.id,
    kind: "journey",
    title: metadata.title,
    existing_canonical: false,
    related_entities: metadata.related_entities,
    related_capabilities: metadata.related_capabilities,
    related_actors: metadata.related_actors,
    related_roles: metadata.related_roles,
    related_rules: metadata.related_rules,
    related_workflows: metadata.related_workflows,
    provenance: metadata.provenance,
    source_of_truth: metadata.source_of_truth,
    confidence: metadata.confidence,
    status: metadata.status,
    review_required: metadata.review_required,
    tags: metadata.tags,
    metadata,
    body
  };
}

/** @param {Map<string, CandidateBundle>} bundles @param {ResolvedGraph} graph @returns {any} */
export function addBundleJourneyDrafts(bundles, graph) {
  const coverage = canonicalJourneyCoverage(graph);
  for (const bundle of bundles.values()) {
    if ((bundle.docs || []).some((/** @type {any} */ entry) => entry.kind === "journey")) {
      continue;
    }
    if ((bundle.capabilities || []).length === 0 && (bundle.screens || []).length === 0 && (bundle.workflows || []).length === 0) {
      continue;
    }
    const primaryEntityId = primaryEntityIdForBundle(bundle);
    if (primaryEntityId && coverage.byEntityId.has(primaryEntityId)) {
      continue;
    }
    const bundleCapabilityIds = (bundle.capabilities || []).map((/** @type {any} */ entry) => entry.id_hint);
    if (bundleCapabilityIds.some((/** @type {any} */ id) => coverage.byCapabilityId.has(id))) {
      continue;
    }
    bundle.docs.push(buildBundleJourneyDraft(bundle));
  }
}

/** @param {CandidateBundle[]} bundles @param {any} previousReport @returns {any} */
export function annotateBundleAuthAging(bundles, previousReport) {
  const previousBundles = new Map(
    ((previousReport?.candidate_model_bundles) || []).map((/** @type {any} */ bundle) => [bundle.slug, bundle])
  );
  return (bundles || []).map((/** @type {any} */ bundle) => {
    const previousBundle = previousBundles.get(bundle.slug);
    const currentSummary = buildBundleOperatorSummary(bundle);
    const previousClosureStatus = previousBundle?.operator_summary?.authClosureSummary?.status || "no_auth_hints";
    const previousRepeatCount = previousBundle?.operator_summary?.authAging?.repeatCount || 0;
    const currentClosureStatus = currentSummary.authClosureSummary.status;
    const repeatCount =
      currentClosureStatus === "high_risk"
        ? (previousClosureStatus === "high_risk" ? previousRepeatCount + 1 : 1)
        : 0;
    const escalationLevel =
      currentClosureStatus !== "high_risk"
        ? "none"
        : repeatCount >= 2
          ? "stale_high_risk"
          : "fresh_high_risk";
    const escalationReason =
      escalationLevel === "stale_high_risk"
        ? `This bundle has stayed high risk for ${repeatCount} reconcile runs in a row.`
        : escalationLevel === "fresh_high_risk"
          ? "This bundle is newly high risk in the current reconcile run."
          : "This bundle is not currently high risk.";
    return {
      ...bundle,
      operatorSummary: {
        ...currentSummary,
        authAging: {
          repeatCount,
          escalationLevel,
          escalationReason
        }
      }
    };
  });
}

/** @param {CandidateBundle} bundle @param {any[]} proposalSurfaces @returns {any} */
export function renderCandidateBundleReadme(bundle, proposalSurfaces = []) {
  const summary = buildBundleOperatorSummary(bundle);
  const journeyDrafts = (bundle.docs || []).filter((/** @type {any} */ entry) => entry.kind === "journey" && entry.review_required !== false);
  const lines = [
    `# ${bundle.label} Candidate Bundle`,
    "",
    `Concept id: \`${bundle.id}\``,
    "",
    `Actors: ${bundle.actors.length}`,
    `Roles: ${bundle.roles.length}`,
    `Entities: ${bundle.entities.length}`,
    `Enums: ${bundle.enums.length}`,
    `Capabilities: ${bundle.capabilities.length}`,
    `Shapes: ${bundle.shapes.length}`,
    `Widgets: ${bundle.widgets.length}`,
    `CLI surfaces: ${(bundle.cliSurfaces || []).length}`,
    `Screens: ${bundle.screens.length}`,
    `UI routes: ${bundle.uiRoutes.length}`,
    `UI actions: ${bundle.uiActions.length}`,
    `Workflows: ${bundle.workflows.length}`,
    `Verifications: ${bundle.verifications.length}`,
    `Workflow states: ${bundle.workflowStates.length}`,
    `Workflow transitions: ${bundle.workflowTransitions.length}`,
    `Docs: ${bundle.docs.length}`
  ];
  lines.push(
    "",
    "## Operator Summary",
    "",
    `- Primary concept: \`${summary.primaryConcept}\``,
    `- Primary entity: ${summary.primaryEntityId ? `\`${summary.primaryEntityId}\`` : "_none_"}`,
    `- Participants: ${summary.participants.label}`,
    `- Main capabilities: ${summarizeBundleSurface(bundle, summary.capabilityIds)}`,
    `- Main widgets: ${summarizeBundleSurface(bundle, summary.widgetIds)}`,
    `- Main CLI surfaces: ${summarizeBundleSurface(bundle, summary.cliSurfaceIds)}`,
    `- Main screens: ${summarizeBundleSurface(bundle, summary.screenIds)}`,
    `- Main routes: ${summarizeBundleSurface(bundle, summary.routePaths)}`,
    `- Main workflows: ${summarizeBundleSurface(bundle, summary.workflowIds)}`,
    `- Auth permission hints: ${summary.authPermissionHints.length ? summary.authPermissionHints.map((/** @type {any} */ entry) => formatAuthPermissionHintInline(entry)).join(", ") : "_none_"}`,
    `- Auth claim hints: ${summary.authClaimHints.length ? summary.authClaimHints.map((/** @type {any} */ entry) => formatAuthClaimHintInline(entry)).join(", ") : "_none_"}`,
    `- Ownership hints: ${summary.authOwnershipHints.length ? summary.authOwnershipHints.map((/** @type {any} */ entry) => formatAuthOwnershipHintInline(entry)).join(", ") : "_none_"}`,
    `- Auth role guidance: ${summary.authRoleGuidance.length ? summary.authRoleGuidance.map((/** @type {any} */ entry) => formatAuthRoleGuidanceInline(entry)).join(", ") : "_none_"}`,
    `- Auth closure: ${summary.authClosureSummary.label} (adopted=${summary.authClosureSummary.adopted}, deferred=${summary.authClosureSummary.deferred}, unresolved=${summary.authClosureSummary.unresolved})`,
    ...(summary.authAging && summary.authAging.escalationLevel !== "none"
      ? [`- Auth escalation: ${summary.authAging.escalationLevel === "stale_high_risk" ? "escalated" : "fresh attention"} (high-risk runs=${summary.authAging.repeatCount})`]
      : []),
    "",
    "## Why This Bundle Exists",
    "",
    summary.whyThisBundle
  );
  if (summary.authPermissionHints.length > 0) {
    lines.push("", "## Auth Permission Hints", "");
    for (const hint of summary.authPermissionHints) {
      lines.push(`- ${formatAuthPermissionHintInline(hint)} <- ${hint.related_capabilities.length ? hint.related_capabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_no direct capability match_"}`);
      lines.push(`  - evidence capabilities=${hint.evidence.capability_hits}, routes=${hint.evidence.route_hits}, docs=${hint.evidence.doc_hits}, provenance=${hint.evidence.provenance_hits}`);
      lines.push(`  - closure: ${hint.closure_state || "unresolved"}`);
      lines.push(`  - closure reason: ${hint.closure_reason || "No reviewed projection patch has been applied for this inferred auth hint yet."}`);
      lines.push(`  - why inferred: ${hint.why_inferred || hint.explanation}`);
      lines.push(`  - review next: ${hint.review_guidance || buildAuthPermissionReviewGuidance(hint)}`);
    }
  }
  if (summary.authClaimHints.length > 0) {
    lines.push("", "## Auth Claim Hints", "");
    for (const hint of summary.authClaimHints) {
      lines.push(`- ${formatAuthClaimHintInline(hint)} <- ${hint.related_capabilities.length ? hint.related_capabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_no direct capability match_"}`);
      lines.push(`  - evidence capability=${hint.evidence.capability_hits}, route=${hint.evidence.route_hits}, participants=${hint.evidence.participant_hits}, docs=${hint.evidence.doc_hits}`);
      lines.push(`  - closure: ${hint.closure_state || "unresolved"}`);
      lines.push(`  - closure reason: ${hint.closure_reason || "No reviewed projection patch has been applied for this inferred auth hint yet."}`);
      lines.push(`  - why inferred: ${hint.why_inferred || hint.explanation}`);
      lines.push(`  - review next: ${hint.review_guidance || buildAuthClaimReviewGuidance(hint)}`);
    }
  }
  if (summary.authOwnershipHints.length > 0) {
    lines.push("", "## Auth Ownership Hints", "");
    for (const hint of summary.authOwnershipHints) {
      lines.push(`- ${formatAuthOwnershipHintInline(hint)} <- ${hint.related_capabilities.length ? hint.related_capabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_no direct capability match_"}`);
      lines.push(`  - related entities: ${hint.related_entities.length ? hint.related_entities.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_none_"}`);
      lines.push(`  - evidence fields=${hint.evidence.field_hits}, capabilities=${hint.evidence.capability_hits}, docs=${hint.evidence.doc_hits}`);
      lines.push(`  - closure: ${hint.closure_state || "unresolved"}`);
      lines.push(`  - closure reason: ${hint.closure_reason || "No reviewed projection patch has been applied for this inferred auth hint yet."}`);
      lines.push(`  - why inferred: ${hint.why_inferred || hint.explanation}`);
      lines.push(`  - review next: ${hint.review_guidance || buildAuthOwnershipReviewGuidance(hint)}`);
    }
  }
  if (summary.authRoleGuidance.length > 0) {
    lines.push("", "## Auth Role Guidance", "");
    for (const entry of summary.authRoleGuidance) {
      lines.push(`- ${formatAuthRoleGuidanceInline(entry)} <- ${entry.related_capabilities.length ? entry.related_capabilities.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : "_role naming only_"}`);
      if (entry.related_docs.length > 0) {
        lines.push(`  - related docs: ${entry.related_docs.map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
      }
      lines.push(`  - why inferred: ${entry.why_inferred}`);
      lines.push(`  - suggested follow-up: ${entry.followup_label} (${entry.followup_reason})`);
      lines.push(`  - review next: ${entry.review_guidance}`);
    }
  }
  if (bundle.mergeHints) {
    lines.push("", "## Suggested Merge", "");
    if (bundle.mergeHints.action) {
      lines.push(`- Action: \`${bundle.mergeHints.action}\``);
    }
    if (bundle.mergeHints.canonicalEntityTarget) {
      lines.push(`- Canonical entity target: \`${bundle.mergeHints.canonicalEntityTarget}\``);
    }
    if ((bundle.mergeHints.promoteEnums || []).length > 0) {
      lines.push(`- Promote enums: ${(bundle.mergeHints.promoteEnums || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
    }
    if ((bundle.mergeHints.promoteCapabilities || []).length > 0) {
      lines.push(`- Promote capabilities: ${(bundle.mergeHints.promoteCapabilities || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
    }
    if ((bundle.mergeHints.promoteShapes || []).length > 0) {
      lines.push(`- Promote shapes: ${(bundle.mergeHints.promoteShapes || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
    }
    if ((bundle.mergeHints.promoteActors || []).length > 0) {
      lines.push(`- Promote actors: ${(bundle.mergeHints.promoteActors || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
    }
    if ((bundle.mergeHints.promoteRoles || []).length > 0) {
      lines.push(`- Promote roles: ${(bundle.mergeHints.promoteRoles || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
    }
  }
  if ((bundle.adoptionPlan || []).length > 0) {
    lines.push("", "## Suggested Adoption", "");
    for (const step of bundle.adoptionPlan) {
      lines.push(`- \`${step.action}\` \`${step.item}\`${step.target ? ` -> \`${step.target}\`` : ""}`);
    }
  }
  const bundleProposalSurfaces = proposalSurfaces.filter((/** @type {any} */ surface) => surface.bundle === bundle.slug && (surface.maintained_seam_candidates || []).length > 0);
  if (bundleProposalSurfaces.length > 0) {
    lines.push("", "## Candidate Maintained Seam Mappings", "");
    for (const surface of bundleProposalSurfaces) {
      lines.push(`- proposal \`${surface.id}\` (${surface.kind})`);
      for (const candidate of surface.maintained_seam_candidates || []) {
        lines.push(`  - candidate maintained seam \`${candidate.seam_id}\` -> output \`${candidate.output_id}\` (${candidate.status}, ${candidate.ownership_class}, confidence=${candidate.confidence})`);
        lines.push(`    - label ${candidate.label}`);
        lines.push(`    - kind ${candidate.kind}`);
        lines.push(`    - why matched ${candidate.match_reasons.length ? candidate.match_reasons.join("; ") : "dependency overlap with maintained seam evidence"}`);
      }
    }
  }
  if (journeyDrafts.length > 0) {
    lines.push("", "## Journey Drafts", "");
    for (const entry of journeyDrafts) {
      lines.push(`- \`${entry.id}\` (${entry.title}) -> \`docs/journeys/${entry.id}.md\``);
    }
    lines.push("- Promote reviewed journey drafts with `reconcile adopt journeys --write`.");
  }
  if ((bundle.docLinkSuggestions || []).length > 0) {
    lines.push("", "## Suggested Doc Link Updates", "");
    for (const suggestion of bundle.docLinkSuggestions) {
      lines.push(`- ${suggestion.recommendation} Draft: \`${suggestion.patch_rel_path}\``);
      if ((suggestion.auth_role_followups || []).length > 0) {
        lines.push(`  - auth role follow-up: ${suggestion.auth_role_followups.map((/** @type {any} */ entry) => `${entry.followup_label} for \`${entry.role_id}\``).join(", ")}`);
      }
    }
  }
  if ((bundle.docDriftSummaries || []).length > 0) {
    lines.push("", "## Suggested Doc Drift Reviews", "");
    for (const summary of bundle.docDriftSummaries) {
      lines.push(`- ${summary.recommendation} Fields: ${summary.differing_fields.map((/** @type {any} */ entry) => `\`${entry.field}\``).join(", ")}`);
    }
  }
  if ((bundle.docMetadataPatches || []).length > 0) {
    lines.push("", "## Suggested Doc Metadata Patches", "");
    for (const patch of bundle.docMetadataPatches) {
      lines.push(`- Review safe metadata patch for \`${patch.doc_id}\`. Draft: \`${patch.patch_rel_path}\``);
    }
  }
  if ((bundle.projectionImpacts || []).length > 0) {
    lines.push("", "## Projection Impacts", "");
    for (const impact of bundle.projectionImpacts) {
      lines.push(`- \`${impact.projection_id}\` (${impact.kind}) missing ${(impact.missing_capabilities || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
    }
  }
  if ((bundle.uiImpacts || []).length > 0) {
    lines.push("", "## UI Impacts", "");
    for (const impact of bundle.uiImpacts) {
      lines.push(`- \`${impact.projection_id}\` missing screens ${(impact.missing_screens || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
    }
  }
  if ((bundle.workflowImpacts || []).length > 0) {
    lines.push("", "## Workflow Impacts", "");
    for (const impact of bundle.workflowImpacts) {
      lines.push(`- \`${impact.review_group_id}\` requires workflow review for ${(impact.items || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
    }
  }
  if ((bundle.projectionPatches || []).length > 0) {
    lines.push("", "## Projection Patch Candidates", "");
    for (const patch of bundle.projectionPatches) {
      lines.push(`- \`${patch.projection_id}\` -> \`${patch.patch_rel_path}\``);
    }
  }
  if (bundle.entities.length > 0) {
    lines.push("", "## Entity Evidence", "");
    for (const entry of bundle.entities) {
      lines.push(`- \`${entry.id_hint}\` from ${(entry.provenance || []).slice(0, 2).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
    }
  }
  if (bundle.actors.length > 0) {
    lines.push("", "## Actor Evidence", "");
    for (const entry of bundle.actors) {
      const details = [`- \`${entry.id_hint}\` from ${(entry.provenance || []).slice(0, 2).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`];
      if ((entry.related_docs || []).length > 0) {
        details.push(`related docs ${(entry.related_docs || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
      }
      if ((entry.related_capabilities || []).length > 0) {
        details.push(`related capabilities ${(entry.related_capabilities || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
      }
      lines.push(details.join("; "));
    }
  }
  if (bundle.roles.length > 0) {
    lines.push("", "## Role Evidence", "");
    for (const entry of bundle.roles) {
      const details = [`- \`${entry.id_hint}\` from ${(entry.provenance || []).slice(0, 2).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`];
      if ((entry.related_docs || []).length > 0) {
        details.push(`related docs ${(entry.related_docs || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
      }
      if ((entry.related_capabilities || []).length > 0) {
        details.push(`related capabilities ${(entry.related_capabilities || []).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
      }
      lines.push(details.join("; "));
    }
  }
  if (bundle.capabilities.length > 0) {
    lines.push("", "## API Evidence", "");
    for (const entry of bundle.capabilities) {
      lines.push(`- \`${entry.id_hint}\` at \`${entry.endpoint?.method || "?"} ${entry.endpoint?.path || "?"}\``);
    }
  }
  if (bundle.screens.length > 0) {
    lines.push("", "## UI Evidence", "");
    for (const entry of bundle.screens) {
      lines.push(`- \`${entry.id_hint}\` ${entry.screen_kind} at \`${entry.route_path}\``);
    }
  }
  if (bundle.workflows.length > 0) {
    lines.push("", "## Workflow Evidence", "");
    for (const entry of bundle.workflows) {
      lines.push(`- \`${entry.id_hint}\` for \`${entry.entity_id}\``);
    }
  }
  if (bundle.docs.length > 0) {
    lines.push("", "## Doc Evidence", "");
    for (const entry of bundle.docs) {
      lines.push(`- \`${entry.id}\` (${entry.kind}) from ${(entry.provenance || []).slice(0, 2).map((/** @type {any} */ item) => `\`${item}\``).join(", ")}`);
    }
  }
  return ensureTrailingNewline(lines.join("\n"));
}

/** @param {CandidateBundle} bundle @returns {any} */
export function renderMaintainedSeamCandidatesInline(bundle) {
  const entries = bundle.maintained_seam_candidates || [];
  if (!entries.length) {
    return "_none_";
  }
  return entries
    .map((/** @type {any} */ surface) => {
      const seams = (surface.maintained_seam_candidates || [])
        .map((/** @type {any} */ candidate) => `\`${candidate.seam_id}\` (${candidate.status}, ${candidate.ownership_class}, confidence=${candidate.confidence})`)
        .join(", ");
      return `${surface.id}: ${seams}`;
    })
    .join("; ");
}

/** @param {CandidateBundle} bundle @param {Set<any>} canonicalEntityIds @returns {any} */
export function buildBundleMergeHints(bundle, canonicalEntityIds) {
  const canonicalEntityTarget = bundle.id.startsWith("entity_") && canonicalEntityIds.has(bundle.id) ? bundle.id : null;
  return {
    action: canonicalEntityTarget ? "merge_into_existing_entity" : "promote_as_candidate_concept",
    canonicalEntityTarget,
    promoteActors: bundle.actors.map((/** @type {any} */ entry) => entry.id_hint),
    promoteRoles: bundle.roles.map((/** @type {any} */ entry) => entry.id_hint),
    promoteEnums: bundle.enums.map((/** @type {any} */ entry) => entry.id_hint),
    promoteCapabilities: bundle.capabilities.map((/** @type {any} */ entry) => entry.id_hint),
    promoteShapes: bundle.shapes.map((/** @type {any} */ entry) => entry.id),
    promoteScreens: bundle.screens.map((/** @type {any} */ entry) => entry.id_hint),
    promoteWorkflows: bundle.workflows.map((/** @type {any} */ entry) => entry.id_hint),
    promoteDocs: bundle.docs.map((/** @type {any} */ entry) => entry.id)
  };
}

function titleCase(value) {
  return String(value || "")
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function singularTitle(value) {
  return titleCase(String(value || "").replace(/s$/i, ""));
}

function bundleKeyForConcept(conceptId) {
  return String(conceptId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "candidate";
}

function primaryEntityIdForBundle(bundle) {
  return (
    bundle.mergeHints?.canonicalEntityTarget ||
    bundle.entities?.[0]?.id_hint ||
    (String(bundle.id || "").startsWith("entity_") ? bundle.id : null)
  );
}

function canonicalJourneyCoverage(graph) {
  const journeyDocs = (graph?.docs || []).filter((doc) => doc.kind === "journey");
  return {
    byEntityId: new Set(journeyDocs.flatMap((doc) => doc.relatedEntities || [])),
    byCapabilityId: new Set(journeyDocs.flatMap((doc) => doc.relatedCapabilities || []))
  };
}

function collectJourneyGenerationContext(graph) {
  const entities = graph.byKind.entity || [];
  const capabilities = graph.byKind.capability || [];
  const rules = graph.byKind.rule || [];
  const projections = graph.byKind.projection || [];
  const uiSharedScreens = projections
    .filter((projection) => projection.platform === "ui_contract")
    .flatMap((projection) => (projection.uiScreens || []).map((screen) => ({ ...screen, projectionId: projection.id })));
  const canonicalJourneys = (graph.docs || []).filter((doc) => doc.kind === "journey");
  const coveredEntityIds = new Set(canonicalJourneys.flatMap((doc) => doc.relatedEntities || []));

  return entities
    .map((entity) => {
      const entitySlug = entity.id.replace(/^entity_/, "");
      const title = singularTitle(entity.name || entitySlug);
      const touchedCapabilities = capabilities.filter((capability) => {
        const touchedIds = [
          ...(capability.reads || []).map((item) => item.id),
          ...(capability.creates || []).map((item) => item.id),
          ...(capability.updates || []).map((item) => item.id),
          ...(capability.deletes || []).map((item) => item.id)
        ];
        return touchedIds.includes(entity.id) || capability.id.includes(entitySlug);
      });
      const screens = uiSharedScreens.filter((screen) => screen.id === entitySlug || screen.id.startsWith(`${entitySlug}_`));
      const relatedRules = rules.filter((rule) => (rule.appliesTo || []).some((item) => item.id === entity.id));
      const supportEntityIds = [
        ...new Set(
          touchedCapabilities
            .flatMap((capability) => [...(capability.reads || []), ...(capability.creates || []), ...(capability.updates || []), ...(capability.deletes || [])])
            .map((item) => item.id)
            .filter((id) => id && id !== entity.id)
        )
      ].slice(0, 3);

      return {
        entity,
        entitySlug,
        title,
        touchedCapabilities,
        screens,
        relatedRules,
        supportEntityIds,
        coveredByCanonicalJourney: coveredEntityIds.has(entity.id)
      };
    })
    .filter((entry) => entry.touchedCapabilities.length > 0 || entry.screens.length > 0);
}

function journeyFlowGroups(entry) {
  const creationCapabilities = entry.touchedCapabilities.filter((capability) => {
    const id = capability.id;
    return id.startsWith(`cap_create_${entry.entitySlug}`) || id.startsWith(`cap_list_${entry.entitySlug}`) || id.startsWith(`cap_get_${entry.entitySlug}`);
  });
  const lifecycleCapabilities = entry.touchedCapabilities.filter((capability) => {
    const id = capability.id;
    return (
      id.startsWith(`cap_update_${entry.entitySlug}`) ||
      id.startsWith(`cap_close_${entry.entitySlug}`) ||
      id.startsWith(`cap_complete_${entry.entitySlug}`) ||
      id.startsWith(`cap_delete_${entry.entitySlug}`) ||
      id.startsWith(`cap_archive_${entry.entitySlug}`) ||
      id.startsWith(`cap_submit_${entry.entitySlug}`) ||
      id.startsWith(`cap_request_${entry.entitySlug}`)
    );
  });

  const groups = [];
  if (creationCapabilities.length > 0) {
    groups.push({
      id: `${entry.entitySlug}_creation_and_discovery`,
      title: `${entry.title} Creation and Discovery`,
      type: "creation",
      capabilities: creationCapabilities
    });
  }
  if (lifecycleCapabilities.length > 0) {
    groups.push({
      id: `${entry.entitySlug}_update_and_lifecycle`,
      title: `${entry.title} Update and Lifecycle`,
      type: "lifecycle",
      capabilities: lifecycleCapabilities
    });
  }
  if (groups.length === 0 && entry.touchedCapabilities.length >= 2) {
    groups.push({
      id: `${entry.entitySlug}_core_flow`,
      title: `${entry.title} Core Flow`,
      type: "general",
      capabilities: entry.touchedCapabilities
    });
  }
  return groups;
}

function formatCapabilityList(capabilities = []) {
  if (capabilities.length === 0) {
    return "_none_";
  }
  return capabilities.map((capability) => `\`${capability.id}\``).join(", ");
}

function renderJourneyDraftBody(entry, flow) {
  const listScreen = entry.screens.find((screen) => ["list", "board", "calendar", "feed"].includes(screen.kind));
  const detailScreen = entry.screens.find((screen) => screen.kind === "detail");
  const createScreen = entry.screens.find((screen) => ["form", "wizard"].includes(screen.kind) && screen.submit?.id?.startsWith(`cap_create_${entry.entitySlug}`));
  const editScreen = entry.screens.find((screen) => ["form", "wizard"].includes(screen.kind) && screen.submit?.id && !screen.submit.id.startsWith(`cap_create_${entry.entitySlug}`));
  const primaryActorIds = [...new Set(flow.capabilities.flatMap((capability) => (capability.actors || []).map((actor) => actor.id)))];
  const ruleMentions = entry.relatedRules.slice(0, 2).map((rule) => `\`${rule.id}\``);
  const startSurface =
    flow.type === "creation"
      ? createScreen?.title || listScreen?.title || `${entry.title} create flow`
      : detailScreen?.title || editScreen?.title || `${entry.title} detail flow`;
  const listSurface = listScreen?.title || `${entry.title} list`;
  const detailSurface = detailScreen?.title || `${entry.title} detail`;
  const lifecycleAction = flow.capabilities.find((capability) => /close|complete|archive|delete|submit|request/.test(capability.id)) || flow.capabilities.find((capability) => capability.id.startsWith(`cap_update_${entry.entitySlug}`));

  const lines = [
    "This draft journey was generated from canonical Topogram capabilities, UI screens, and related rules.",
    "",
    "Review and rewrite it before promotion as a canonical journey.",
    "",
    `The user intent centers on ${flow.type === "creation" ? `creating or locating ${entry.title.toLowerCase()} work safely` : flow.type === "lifecycle" ? `updating ${entry.title.toLowerCase()} work without losing lifecycle clarity` : `moving through the core ${entry.title.toLowerCase()} flow with confidence`}.`,
    "",
    "## Happy Path",
    ""
  ];

  if (flow.type === "creation") {
    lines.push(`1. The user starts from ${startSurface} and begins the ${entry.title.toLowerCase()} flow.`);
    lines.push(`2. The system accepts the request through ${formatCapabilityList(flow.capabilities.filter((capability) => /create|list|get/.test(capability.id)))}.`);
    lines.push(`3. The user can find the resulting ${entry.title.toLowerCase()} again in ${listSurface} and ${detailSurface}.`);
  } else if (flow.type === "lifecycle") {
    lines.push(`1. The user opens ${startSurface} and confirms the current ${entry.title.toLowerCase()} context.`);
    lines.push(`2. The user progresses the flow through ${formatCapabilityList(flow.capabilities)}.`);
    if (lifecycleAction) {
      lines.push(`3. The flow can conclude with \`${lifecycleAction.id}\` once the ${entry.title.toLowerCase()} is ready.`);
    } else {
      lines.push(`3. The user returns to ${detailSurface} with the updated lifecycle state visible.`);
    }
  } else {
    lines.push(`1. The user starts from ${startSurface}.`);
    lines.push(`2. The flow moves through ${formatCapabilityList(flow.capabilities)}.`);
    lines.push(`3. The resulting ${entry.title.toLowerCase()} remains visible in ${listSurface} and ${detailSurface}.`);
  }

  lines.push("", "## Alternate Paths", "");
  if (entry.relatedRules.length > 0) {
    for (const rule of entry.relatedRules.slice(0, 2)) {
      lines.push(`- The flow should stay aligned with ${rule.name ? `"${rule.name}"` : `\`${rule.id}\``} instead of silently allowing invalid state transitions.`);
    }
  } else {
    lines.push(`- If the request is invalid or unauthorized, the flow should fail clearly instead of leaving the ${entry.title.toLowerCase()} in an ambiguous state.`);
  }

  lines.push("", "## Change Review Notes", "");
  lines.push(`Review this journey when changing ${entry.title.toLowerCase()} screens, ${entry.title.toLowerCase()} capability contracts, or related rules${ruleMentions.length ? ` such as ${ruleMentions.join(", ")}` : ""}.`);
  if (primaryActorIds.length > 0) {
    lines.push("", `Primary actors: ${primaryActorIds.map((id) => `\`${id}\``).join(", ")}`);
  }
  return lines.join("\n");
}

export function buildJourneyDrafts(graph) {
  const draftEntries = [];
  const skippedEntities = [];
  for (const entry of collectJourneyGenerationContext(graph)) {
    if (entry.coveredByCanonicalJourney) {
      skippedEntities.push({
        entity_id: entry.entity.id,
        reason: "canonical_journey_exists"
      });
      continue;
    }

    for (const flow of journeyFlowGroups(entry)) {
      const relatedCapabilities = [...new Set(flow.capabilities.map((capability) => capability.id))].sort();
      const relatedActors = [...new Set(flow.capabilities.flatMap((capability) => (capability.actors || []).map((actor) => actor.id)))].sort();
      const relatedRoles = [...new Set(flow.capabilities.flatMap((capability) => (capability.roles || []).map((role) => role.id)))].sort();
      const relatedRules = [...new Set(entry.relatedRules.map((rule) => rule.id))].sort();
      const relatedProjections = [...new Set(entry.screens.map((screen) => screen.projectionId).filter(Boolean))].sort();
      const provenance = [
        ...relatedCapabilities.map((id) => `capability:${id}`),
        ...entry.screens.map((screen) => `screen:${screen.id}`)
      ].slice(0, 8);
      const metadata = {
        id: flow.id,
        kind: "journey",
        title: flow.title,
        status: "inferred",
        summary: `Draft ${entry.title.toLowerCase()} journey inferred from capabilities and UI surfaces.`,
        source_of_truth: "generated",
        confidence: "medium",
        review_required: true,
        related_entities: [entry.entity.id, ...entry.supportEntityIds].slice(0, 4),
        related_capabilities: relatedCapabilities,
        related_actors: relatedActors,
        related_roles: relatedRoles,
        related_rules: relatedRules,
        related_projections: relatedProjections,
        provenance,
        tags: ["generated", "journey", "draft"]
      };
      const relativePath = `candidates/docs/journeys/${flow.id.replaceAll("_", "-")}.md`;
      draftEntries.push({
        id: flow.id,
        title: flow.title,
        type: flow.type,
        entity_id: entry.entity.id,
        path: relativePath,
        related_capabilities: relatedCapabilities,
        related_entities: metadata.related_entities,
        metadata,
        body: renderJourneyDraftBody(entry, flow)
      });
    }
  }

  return {
    drafts: draftEntries.sort((left, right) => left.path.localeCompare(right.path)),
    skippedEntities: skippedEntities.sort((left, right) => left.entity_id.localeCompare(right.entity_id))
  };
}

export function buildBundleJourneyDraft(bundle) {
  const relatedCapabilities = [...new Set((bundle.capabilities || []).map((entry) => entry.id_hint))].sort();
  const relatedWorkflows = [...new Set((bundle.workflows || []).map((entry) => entry.id_hint))].sort();
  const relatedActors = [...new Set((bundle.actors || []).map((entry) => entry.id_hint))].sort();
  const relatedRoles = [...new Set((bundle.roles || []).map((entry) => entry.id_hint))].sort();
  const primaryEntityId = primaryEntityIdForBundle(bundle);
  const relatedEntities = [...new Set([primaryEntityId, ...(bundle.entities || []).map((entry) => entry.id_hint)].filter(Boolean))].slice(0, 4);
  const routePaths = [...new Set((bundle.uiRoutes || []).map((entry) => entry.path).filter(Boolean))];
  const screenIds = [...new Set((bundle.screens || []).map((entry) => entry.id_hint))];
  const screenKinds = [...new Set((bundle.screens || []).map((entry) => entry.screen_kind).filter(Boolean))];
  const createCapabilities = relatedCapabilities.filter((id) => /^cap_create_/.test(id));
  const browseCapabilities = relatedCapabilities.filter((id) => /^cap_(list|get)_/.test(id));
  const lifecycleCapabilities = relatedCapabilities.filter((id) => /^cap_(update|close|complete|archive|delete|submit|request)_/.test(id));
  const interactionCapabilities = relatedCapabilities.filter((id) => /^cap_(favorite|unfavorite|follow|unfollow|vote|like|unlike)_/.test(id));
  const authCapabilities = relatedCapabilities.filter((id) => /^cap_(sign_in|sign_out|register|authenticate|login|logout)_/.test(id));
  const participantActors = relatedActors;
  const participantRoles = relatedRoles;
  const hasListDetail = browseCapabilities.some((id) => /^cap_list_/.test(id)) && browseCapabilities.some((id) => /^cap_get_/.test(id));
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

  const humanLabel = bundle.label || titleCase(String(primaryEntityId || bundle.id || "journey").replace(/^entity_/, ""));
  const title =
    flowShape === "auth" ? `${humanLabel} Sign-In and Session Flow` :
    flowShape === "create_browse_lifecycle" ? `${humanLabel} Creation, Detail, and Lifecycle Flow` :
    flowShape === "browse_lifecycle" ? `${humanLabel} Detail and Lifecycle Flow` :
    flowShape === "browse_detail" ? `${humanLabel} Browse and Detail Flow` :
    flowShape === "create" ? `${humanLabel} Creation Flow` :
    flowShape === "lifecycle" ? `${humanLabel} Lifecycle Flow` :
    flowShape === "interaction" ? `${humanLabel} Interaction Flow` :
    `${humanLabel} Core Flow`;

  const idStem = String(primaryEntityId || bundle.id || "journey").replace(/^entity_/, "");
  const id = `${idStem}_journey`;
  const sourcePath = `candidates/reconcile/model/bundles/${bundle.slug}/docs/journeys/${id}.md`;
  const canonicalRelPath = `docs/journeys/${id}.md`;
  const participantText = [...participantActors, ...participantRoles].length > 0
    ? `The strongest inferred participants are ${[...participantActors, ...participantRoles].map((entry) => `\`${entry}\``).join(", ")}.`
    : "The strongest inferred participant is still unclear and should be confirmed during review.";
  const routeEvidence = routePaths.length > 0;
  const screenEvidence = screenIds.length > 0;
  const startSurface = routeEvidence
    ? routePaths.slice(0, 2).map((item) => `\`${item}\``).join(" or ")
    : screenEvidence
      ? screenIds.slice(0, 2).map((item) => `\`${item}\``).join(" or ")
      : `the ${humanLabel.toLowerCase()} API surface`;
  const continuationSurface = screenEvidence
    ? `${screenKinds.length > 0 ? screenKinds.join(", ") : "screen"} surfaces ${screenIds.slice(0, 3).map((item) => `\`${item}\``).join(", ")}`
    : routeEvidence
      ? `the recovered route structure around ${routePaths.slice(0, 3).map((item) => `\`${item}\``).join(", ")}`
      : `the recovered ${humanLabel.toLowerCase()} lifecycle`;
  const routeText = routePaths.length > 0
    ? `Recovered route evidence includes ${routePaths.slice(0, 3).map((entry) => `\`${entry}\``).join(", ")}.`
    : "No strong route evidence was recovered, so this draft leans on capability and workflow evidence.";
  const screenText = screenIds.length > 0
    ? `Recovered UI surface hints include ${screenIds.slice(0, 4).map((entry) => `\`${entry}\``).join(", ")}${screenKinds.length > 0 ? ` (${screenKinds.join(", ")})` : ""}.`
    : "No strong screen evidence was recovered, so UI touchpoints still need review.";

  let happyPathLines;
  if (flowShape === "auth") {
    happyPathLines = [
      `1. ${participantActors.length || participantRoles.length ? `${[...participantActors, ...participantRoles].map((entry) => `\`${entry}\``).join(", ")} enter` : "A user enters"} the flow through the recovered account/auth surface.`,
      `2. The system moves through ${authCapabilities.map((entry) => `\`${entry}\``).join(", ")} to establish authenticated state.`,
      `3. The recovered session/account state is then available to the rest of the application surface.`
    ];
  } else if (flowShape === "create_browse_lifecycle") {
    happyPathLines = [
      `1. The flow starts by creating or submitting ${humanLabel.toLowerCase()} data through ${createCapabilities.map((entry) => `\`${entry}\``).join(", ")}.`,
      `2. The created record becomes visible again through ${browseCapabilities.slice(0, 3).map((entry) => `\`${entry}\``).join(", ")}.`,
      `3. Follow-up lifecycle progress can continue through ${lifecycleCapabilities.slice(0, 3).map((entry) => `\`${entry}\``).join(", ")}.`
    ];
  } else if (flowShape === "browse_lifecycle") {
    happyPathLines = [
      `1. The flow starts by locating the current ${humanLabel.toLowerCase()} state through ${browseCapabilities.slice(0, 3).map((entry) => `\`${entry}\``).join(", ")}.`,
      `2. The user or system then advances the lifecycle through ${lifecycleCapabilities.slice(0, 3).map((entry) => `\`${entry}\``).join(", ")}.`,
      `3. The updated state remains visible through the same detail-oriented surface.`
    ];
  } else if (flowShape === "browse_detail") {
    happyPathLines = [
      `1. The flow starts by listing or locating ${humanLabel.toLowerCase()} data through ${browseCapabilities.slice(0, 3).map((entry) => `\`${entry}\``).join(", ")}.`,
      `2. The user drills into the recovered detail surface for one record.`,
      `3. The system preserves enough context to move back to the broader list or summary view.`
    ];
  } else if (flowShape === "lifecycle") {
    happyPathLines = [
      `1. The flow starts from an existing ${humanLabel.toLowerCase()} record.`,
      `2. The lifecycle proceeds through ${lifecycleCapabilities.slice(0, 3).map((entry) => `\`${entry}\``).join(", ")}.`,
      `3. The updated lifecycle state becomes visible in the recovered output surface.`
    ];
  } else if (flowShape === "interaction") {
    happyPathLines = [
      `1. The flow starts from an existing ${humanLabel.toLowerCase()} record or feed surface.`,
      `2. The user interaction proceeds through ${interactionCapabilities.slice(0, 3).map((entry) => `\`${entry}\``).join(", ")}.`,
      `3. The resulting state is reflected back in the surrounding list, detail, or profile context.`
    ];
  } else {
    happyPathLines = [
      `1. ${participantActors.length || participantRoles.length ? `${[...participantActors, ...participantRoles].map((entry) => `\`${entry}\``).join(", ")} enter` : "A user enters"} the flow through ${startSurface}.`,
      `2. The system accepts the request through ${relatedCapabilities.length > 0 ? relatedCapabilities.slice(0, 4).map((entry) => `\`${entry}\``).join(", ") : "_no inferred capability_"}.`,
      `3. The resulting state remains visible through ${continuationSurface}.`
    ];
  }

  const alternatePathLines = [];
  if (relatedWorkflows.length > 0) {
    alternatePathLines.push(`- Workflow evidence suggests ${relatedWorkflows.slice(0, 3).map((entry) => `\`${entry}\``).join(", ")} may impose additional state or review constraints.`);
  }
  if (routePaths.length === 0 && screenIds.length === 0) {
    alternatePathLines.push("- UI routing evidence is sparse, so this draft should be reviewed against the live app before promotion.");
  }
  if (alternatePathLines.length === 0) {
    alternatePathLines.push("- Missing, unauthorized, or invalid requests should fail clearly instead of leaving the flow in an ambiguous state.");
  }

  const body = [
    "Candidate journey inferred during reconcile from bundle-local capability, UI, workflow, and participant evidence.",
    "",
    participantText,
    routeText,
    screenText,
    "",
    "Review and rewrite this draft before promoting it as a canonical journey.",
    "",
    "## Happy Path",
    "",
    ...happyPathLines,
    "",
    "## Alternate Paths",
    "",
    ...alternatePathLines,
    "",
    "## Change Review Notes",
    "",
    `Review this journey when changing ${relatedCapabilities.length > 0 ? relatedCapabilities.slice(0, 4).map((entry) => `\`${entry}\``).join(", ") : "the recovered capability surface"}${relatedWorkflows.length > 0 ? `, related workflows such as ${relatedWorkflows.slice(0, 3).map((entry) => `\`${entry}\``).join(", ")}` : ""}, or the recovered ${screenIds.length > 0 ? "UI screens" : "API routes"}.`
  ].join("\n");

  return {
    id,
    kind: "journey",
    title,
    status: "inferred",
    summary: `Draft ${humanLabel.toLowerCase()} journey inferred during brownfield reconcile.`,
    source_of_truth: "imported",
    confidence: bundle.confidence || "medium",
    review_required: true,
    related_entities: relatedEntities,
    related_capabilities: relatedCapabilities,
    related_actors: relatedActors,
    related_roles: relatedRoles,
    related_workflows: relatedWorkflows,
    tags: ["import", "journey", "draft"],
    source_path: sourcePath,
    canonical_rel_path: canonicalRelPath,
    body
  };
}

export function shouldAddBundleJourneyDraft(bundle, graph) {
  const primaryEntityId = primaryEntityIdForBundle(bundle);
  const coverage = canonicalJourneyCoverage(graph);
  const capabilityIds = new Set((bundle.capabilities || []).map((entry) => entry.id_hint));
  return (
    ((bundle.capabilities || []).length > 0 || (bundle.screens || []).length > 0 || (bundle.workflows || []).length > 0) &&
    !coverage.byEntityId.has(primaryEntityId) &&
    ![...capabilityIds].some((id) => coverage.byCapabilityId.has(id))
  );
}

export function bundleKeyForJourneyConcept(conceptId) {
  return bundleKeyForConcept(String(conceptId || "").replace(/^entity_/, "").replace(/^enum_/, ""));
}

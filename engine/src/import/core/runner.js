import { IMPORT_TRACKS } from "./contracts.js";
import { dedupeCandidateRecords, ensureTrailingNewline, idHintify, makeCandidateRecord } from "./shared.js";
import { createImportContext } from "./context.js";
import { getEnrichersForTrack, getExtractorsForTrack } from "./registry.js";
import {
  collectionPatternFromPresentations
} from "../../ui/taxonomy.js";

function parseImportTracks(fromValue) {
  if (!fromValue) {
    return ["db", "api", "ui", "workflows", "verification"];
  }
  const tracks = String(fromValue).split(",").map((track) => track.trim().toLowerCase()).filter(Boolean);
  if (tracks.length === 0) {
    throw new Error("Expected --from to include at least one import track");
  }
  const invalid = tracks.filter((track) => !IMPORT_TRACKS.has(track));
  if (invalid.length > 0) {
    throw new Error(`Unsupported import track(s): ${invalid.join(", ")}`);
  }
  return [...new Set(tracks)];
}

function sortExtractors(context, extractors) {
  return extractors
    .map((extractor) => ({ extractor, detection: extractor.detect(context) || { score: 0, reasons: [] } }))
    .filter((entry) => entry.detection.score > 0)
    .sort((a, b) => b.detection.score - a.detection.score || a.extractor.id.localeCompare(b.extractor.id));
}

function selectDetectionsForTrack(track, detections) {
  if (track === "db") {
    const prisma = detections.find((entry) => entry.extractor.id === "db.prisma");
    if (prisma) return [prisma];
    const djangoModels = detections.find((entry) => entry.extractor.id === "db.django-models");
    if (djangoModels) return [djangoModels];
    const efCore = detections.find((entry) => entry.extractor.id === "db.ef-core");
    if (efCore) return [efCore];
    const room = detections.find((entry) => entry.extractor.id === "db.room");
    if (room) return [room];
    const swiftData = detections.find((entry) => entry.extractor.id === "db.swiftdata");
    if (swiftData) return [swiftData];
    const dotnetModels = detections.find((entry) => entry.extractor.id === "db.dotnet-models");
    if (dotnetModels) return [dotnetModels];
    const flutterEntities = detections.find((entry) => entry.extractor.id === "db.flutter-entities");
    if (flutterEntities) return [flutterEntities];
    const reactNativeEntities = detections.find((entry) => entry.extractor.id === "db.react-native-entities");
    if (reactNativeEntities) return [reactNativeEntities];
    const railsSchema = detections.find((entry) => entry.extractor.id === "db.rails-schema");
    if (railsSchema) return [railsSchema];
    const liquibase = detections.find((entry) => entry.extractor.id === "db.liquibase");
    if (liquibase) return [liquibase];
    const myBatisXml = detections.find((entry) => entry.extractor.id === "db.mybatis-xml");
    if (myBatisXml) return [myBatisXml];
    const jpa = detections.find((entry) => entry.extractor.id === "db.jpa");
    if (jpa) return [jpa];
    const drizzle = detections.find((entry) => entry.extractor.id === "db.drizzle");
    if (drizzle) return [drizzle];
    const sql = detections.find((entry) => entry.extractor.id === "db.sql");
    if (sql) return [sql];
    const snapshot = detections.find((entry) => entry.extractor.id === "db.snapshot");
    return snapshot ? [snapshot] : [];
  }
  if (track === "api") {
    const openApi = detections.find((entry) => entry.extractor.id === "api.openapi");
    if (openApi) return [openApi];
    const openApiCode = detections.find((entry) => entry.extractor.id === "api.openapi-code");
    if (openApiCode) return [openApiCode];
    const graphQlSdl = detections.find((entry) => entry.extractor.id === "api.graphql-sdl");
    if (graphQlSdl) return [graphQlSdl];
    const trpc = detections.find((entry) => entry.extractor.id === "api.trpc");
    if (trpc) return [trpc];
    const aspNetCore = detections.find((entry) => entry.extractor.id === "api.aspnet-core");
    if (aspNetCore) return [aspNetCore];
    const retrofit = detections.find((entry) => entry.extractor.id === "api.retrofit");
    if (retrofit) return [retrofit];
    const swiftWebApi = detections.find((entry) => entry.extractor.id === "api.swift-webapi");
    if (swiftWebApi) return [swiftWebApi];
    const flutterDio = detections.find((entry) => entry.extractor.id === "api.flutter-dio");
    if (flutterDio) return [flutterDio];
    const reactNativeRepository = detections.find((entry) => entry.extractor.id === "api.react-native-repository");
    if (reactNativeRepository) return [reactNativeRepository];
    const fastify = detections.find((entry) => entry.extractor.id === "api.fastify");
    if (fastify) return [fastify];
    const express = detections.find((entry) => entry.extractor.id === "api.express");
    if (express) return [express];
    const djangoRoutes = detections.find((entry) => entry.extractor.id === "api.django-routes");
    if (djangoRoutes) return [djangoRoutes];
    const railsRoutes = detections.find((entry) => entry.extractor.id === "api.rails-routes");
    if (railsRoutes) return [railsRoutes];
    const micronaut = detections.find((entry) => entry.extractor.id === "api.micronaut");
    if (micronaut) return [micronaut];
    const jaxrs = detections.find((entry) => entry.extractor.id === "api.jaxrs");
    if (jaxrs) return [jaxrs];
    const springWeb = detections.find((entry) => entry.extractor.id === "api.spring-web");
    if (springWeb) return [springWeb];
  }
  return detections;
}

function importedApiCapabilityIds(allCandidates) {
  return [...(allCandidates?.api?.capabilities || [])]
    .map((capability) => capability.id_hint)
    .filter(Boolean)
    .sort();
}

function loadCapabilityForScreen(screen) {
  return capabilityHintsForScreen(screen).find((hint) => /^cap_(list|get)_/.test(hint)) || null;
}

function normalizeCapabilityHint(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    return value.id_hint || value.id || value.capability_hint || value.capability?.id || null;
  }
  return null;
}

function capabilityHintsForScreen(screen) {
  const rawHints = Array.isArray(screen.capability_hints)
    ? screen.capability_hints
    : [screen.capability_hints].filter(Boolean);
  return rawHints.map(normalizeCapabilityHint).filter(Boolean);
}

function inferredDataSourceForComponent(component, allCandidates) {
  if (component.data_source) {
    return component.data_source;
  }
  const capabilityIds = importedApiCapabilityIds(allCandidates);
  const screenStem = String(component.screen_id || "")
    .replace(/_(list|index|table|grid|results)$/, "")
    .replace(/^list_/, "");
  return capabilityIds.find((id) => /^cap_(list|get)_/.test(id) && id.includes(screenStem)) ||
    capabilityIds.find((id) => /^cap_(list|get)_/.test(id)) ||
    null;
}

function deriveUiComponentCandidates(candidates) {
  const screens = candidates.screens || [];
  const actions = candidates.actions || [];
  const presentations = [...new Set(actions
    .filter((entry) => entry.kind === "ui_presentation")
    .map((entry) => entry.presentation)
    .filter(Boolean))].sort();
  const componentScreens = screens.filter((screen) => ["list", "dashboard", "analytics", "report", "feed", "inbox"].includes(screen.screen_kind));

  return componentScreens.map((screen) => {
    const pattern = collectionPatternFromPresentations(presentations);
    const componentStem = idHintify(`${screen.id_hint}_results`);
    const loadCapability = loadCapabilityForScreen(screen);
    return makeCandidateRecord({
      kind: "component",
      idHint: `component_ui_${componentStem}`,
      label: `${screen.label || screen.id_hint} results`,
      confidence: presentations.length > 0 ? "medium" : "low",
      sourceKind: "ui_projection_inference",
      sourceOfTruth: "candidate",
      provenance: screen.provenance || [],
      screen_id: screen.id_hint,
      region: "results",
      pattern,
      data_prop: "rows",
      data_source: loadCapability,
      inferred_props: [{ name: "rows", type: "array", required: true, source: loadCapability }],
      inferred_events: [],
      inferred_region: "results",
      inferred_pattern: pattern,
      evidence: screen.provenance || [],
      missing_decisions: [
        "confirm component reuse boundary",
        "confirm prop names and data source",
        "confirm events and behavior",
        "confirm supported regions and patterns"
      ],
      notes: [
        "Imported component candidates are review-only.",
        "Confirm props, behavior, events, and reuse before adoption."
      ]
    });
  });
}

function normalizeCandidatesForTrack(track, candidates) {
  if (track === "db") {
    return {
      entities: dedupeCandidateRecords(candidates.entities || [], (record) => record.id_hint),
      enums: dedupeCandidateRecords(candidates.enums || [], (record) => record.id_hint),
      relations: dedupeCandidateRecords(candidates.relations || [], (record) => record.id_hint),
      indexes: dedupeCandidateRecords(candidates.indexes || [], (record) => record.id_hint)
    };
  }
  if (track === "api") {
    return {
      capabilities: dedupeCandidateRecords(candidates.capabilities || [], (record) => record.id_hint),
      routes: dedupeCandidateRecords(
        (candidates.routes || []).map((route) => ({ ...route, id_hint: route.id_hint || `${route.method}_${route.path}` })),
        (record) => `${record.method}:${record.path}:${record.source_kind}`
      ).map(({ id_hint, ...route }) => route),
      stacks: [...new Set(candidates.stacks || [])].sort()
    };
  }
  if (track === "ui") {
    const explicitComponents = candidates.components || [];
    const derivedComponents = deriveUiComponentCandidates(candidates);
    return {
      screens: dedupeCandidateRecords(candidates.screens || [], (record) => record.id_hint),
      routes: dedupeCandidateRecords(candidates.routes || [], (record) => record.id_hint),
      actions: dedupeCandidateRecords(candidates.actions || [], (record) => record.id_hint),
      components: dedupeCandidateRecords([...explicitComponents, ...derivedComponents], (record) => record.id_hint),
      stacks: [...new Set(candidates.stacks || [])].sort()
    };
  }
  if (track === "verification") {
    return {
      verifications: dedupeCandidateRecords(candidates.verifications || [], (record) => record.id_hint),
      scenarios: dedupeCandidateRecords(candidates.scenarios || [], (record) => record.id_hint),
      frameworks: [...new Set(candidates.frameworks || [])].sort(),
      scripts: dedupeCandidateRecords(
        (candidates.scripts || []).map((script) => ({
          ...script,
          id_hint: script.id_hint || `${script.file || "package.json"}:${script.name || "test"}`
        })),
        (record) => record.id_hint
      ).map(({ id_hint, ...script }) => script)
    };
  }
  return {
    workflows: dedupeCandidateRecords(candidates.workflows || [], (record) => record.id_hint),
    workflow_states: dedupeCandidateRecords(candidates.workflow_states || [], (record) => record.id_hint),
    workflow_transitions: dedupeCandidateRecords(candidates.workflow_transitions || [], (record) => record.id_hint)
  };
}

function runTrack(context, track) {
  const findings = [];
  const rawCandidates = track === "db"
    ? { entities: [], enums: [], relations: [], indexes: [] }
    : track === "api"
      ? { capabilities: [], routes: [], stacks: [] }
      : track === "ui"
        ? { screens: [], routes: [], actions: [], stacks: [] }
        : track === "verification"
          ? { verifications: [], scenarios: [], frameworks: [], scripts: [] }
        : { workflows: [], workflow_states: [], workflow_transitions: [] };

  for (const { extractor, detection } of selectDetectionsForTrack(track, sortExtractors(context, getExtractorsForTrack(track)))) {
    const result = extractor.extract(context) || { findings: [], candidates: {} };
    findings.push({
      extractor: extractor.id,
      detection,
      findings: result.findings || []
    });
    for (const [key, value] of Object.entries(result.candidates || {})) {
      if (Array.isArray(rawCandidates[key])) {
        rawCandidates[key].push(...value);
      } else if (Array.isArray(value)) {
        rawCandidates[key] = [...value];
      }
    }
  }

  let candidates = normalizeCandidatesForTrack(track, rawCandidates);
  for (const enricher of getEnrichersForTrack(track)) {
    const applies = enricher.applies(context, candidates);
    if (!applies) continue;
    candidates = normalizeCandidatesForTrack(track, enricher.enrich(context, candidates) || candidates);
  }

  return {
    findings: findings.flatMap((entry) => entry.findings || []),
    candidates,
    extractor_detections: findings.map(({ extractor, detection }) => ({ extractor, ...detection }))
  };
}

function reportMarkdown(track, candidates) {
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
    const componentLines = (candidates.components || []).map((component) =>
      `- \`${component.id_hint}\` confidence ${component.confidence || "unknown"} pattern \`${component.pattern || component.inferred_pattern || "unknown"}\` region \`${component.region || component.inferred_region || "unknown"}\` evidence ${(component.evidence || component.provenance || []).length} missing decisions ${(component.missing_decisions || []).length}`
    );
    return ensureTrailingNewline(
      `# UI Import Report\n\n- Screens: ${candidates.screens.length}\n- Routes: ${candidates.routes.length}\n- Actions: ${candidates.actions.length}\n- Components: ${candidates.components.length}\n- Stacks: ${candidates.stacks.length ? candidates.stacks.join(", ") : "none"}\n\n## Component Candidates\n\n${componentLines.length ? componentLines.join("\n") : "- none"}\n\n## Next Validation\n\n- Review candidates under \`topogram/candidates/app/ui/drafts/components/**\`.\n- Run \`topogram import plan <path>\` before adoption.\n- After adoption, run \`topogram check <path>\`, \`topogram component check <path>\`, and \`topogram component behavior <path>\`.\n`
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

function uniqueSorted(values) {
  return [...new Set((values || []).filter(Boolean))].sort();
}

function projectionIdStem(workspaceRoot) {
  const base = String(workspaceRoot || "").split(/[\\/]/).filter(Boolean).pop() || "imported_app";
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "imported_app";
}

function componentCandidateFileName(component) {
  return `${String(component.id_hint || "component")
    .replace(/^component_/, "")
    .replace(/_/g, "-")}.tg`;
}

function renderComponentCandidate(component) {
  const evidenceCount = (component.evidence || component.provenance || []).length;
  const missingDecisions = component.missing_decisions || [
    "confirm component reuse boundary",
    "confirm prop names and data source",
    "confirm events and behavior"
  ];
  return `component ${component.id_hint} {
  # Import metadata: confidence ${component.confidence || "unknown"}; evidence ${evidenceCount}; inferred pattern ${component.pattern || component.inferred_pattern || "search_results"}; inferred region ${component.region || component.inferred_region || "results"}.
  # Missing decisions: ${missingDecisions.join("; ")}.
  name "${component.label || component.id_hint}"
  description "Candidate reusable component inferred from imported UI evidence. Review props, behavior, events, and reuse before adoption."
  category collection
  props {
    ${component.data_prop || "rows"} array required
  }
  patterns [${component.pattern || "search_results"}]
  regions [${component.region || "results"}]
  status proposed
}
`;
}

function uiComponentLinesForCandidates(componentCandidates, allCandidates) {
  return componentCandidates
    .filter((component) => component.screen_id && component.region && component.id_hint)
    .map((component) => {
      const dataSource = inferredDataSourceForComponent(component, allCandidates);
      const dataBinding = dataSource
        ? ` data ${component.data_prop || "rows"} from ${dataSource}`
        : "";
      return `    screen ${component.screen_id} region ${component.region} component ${component.id_hint}${dataBinding}`;
    });
}

function enrichUiComponentDataSources(uiCandidates, allCandidates) {
  if (!uiCandidates || !Array.isArray(uiCandidates.components)) {
    return uiCandidates;
  }
  return {
    ...uiCandidates,
    components: uiCandidates.components.map((component) => {
      const dataSource = inferredDataSourceForComponent(component, allCandidates);
      const dataProp = component.data_prop || "rows";
      return {
        ...component,
        data_source: component.data_source || dataSource,
        inferred_props: (component.inferred_props || []).map((prop) =>
          prop.name === dataProp ? { ...prop, source: prop.source || dataSource } : prop
        )
      };
    })
  };
}

function draftUiProjectionFiles(context, candidates, allCandidates = {}) {
  const ui = candidates || { screens: [], routes: [], actions: [], stacks: [] };
  const screens = [...(ui.screens || [])].sort((a, b) => String(a.route_path || "").localeCompare(String(b.route_path || "")) || a.id_hint.localeCompare(b.id_hint));
  const routes = new Map((ui.routes || []).map((route) => [route.screen_id, route.path]));
  const actions = ui.actions || [];
  const componentCandidates = [...(ui.components || [])].sort((a, b) => a.id_hint.localeCompare(b.id_hint));
  const shell = actions.find((entry) => entry.kind === "ui_shell")?.shell_kind || "topbar";
  const navigationPatterns = uniqueSorted(actions.filter((entry) => entry.kind === "ui_navigation").map((entry) => entry.navigation_pattern));
  const presentations = uniqueSorted(actions.filter((entry) => entry.kind === "ui_presentation").map((entry) => entry.presentation));
  const capabilityHints = uniqueSorted([
    ...screens.flatMap((screen) => capabilityHintsForScreen(screen)),
    ...actions.map((entry) => entry.capability_hint).filter(Boolean),
    ...importedApiCapabilityIds(allCandidates)
  ]);
  const stem = projectionIdStem(context.paths.workspaceRoot);
  const screenKinds = new Map(screens.map((screen) => [screen.id_hint, screen.screen_kind || "flow"]));
  const defaultScreenId = screens.find((screen) => screen.screen_kind === "list")?.id_hint || screens[0]?.id_hint || null;

  const uiScreensBlock = screens.length > 0
    ? screens.map((screen) => {
        const directives = [`kind ${screen.screen_kind || "flow"}`, `title "${screen.label || screen.id_hint}"`];
        const screenCapabilityHints = capabilityHintsForScreen(screen);
        if (screenCapabilityHints.length > 0) {
          const loadHint = screenCapabilityHints.find((hint) => /^cap_(list|get)_/.test(hint));
          const submitHint = screenCapabilityHints.find((hint) => /^cap_(create|update|sign_in|follow|delete)_/.test(hint));
          if (loadHint && ["list", "detail", "job_status", "feed", "inbox", "dashboard", "analytics", "report"].includes(screen.screen_kind)) {
            directives.push(`load ${loadHint}`);
          }
          if (submitHint && ["form", "wizard", "settings", "flow"].includes(screen.screen_kind)) {
            directives.push(`submit ${submitHint}`);
          }
        }
        return `    screen ${screen.id_hint} ${directives.join(" ")}`;
      }).join("\n")
    : "    // No imported screens detected";

  const collectionScreens = screens.filter((screen) => screen.screen_kind === "list");
  const uiCollectionsLines = [];
  for (const screen of collectionScreens) {
    const screenPresentations = presentations.filter((presentation) =>
      ["table", "data_grid", "cards", "board", "calendar", "gallery", "list"].includes(presentation)
    );
    const preferredView =
      screenPresentations.find((presentation) => ["data_grid", "table", "cards", "list"].includes(presentation))
      || "list";
    uiCollectionsLines.push(`    screen ${screen.id_hint} view ${preferredView}`);
    if (presentations.includes("pull_to_refresh")) {
      uiCollectionsLines.push(`    screen ${screen.id_hint} refresh pull_to_refresh`);
    }
    if (presentations.includes("search")) {
      uiCollectionsLines.push(`    screen ${screen.id_hint} search query`);
    }
  }

  const uiActionsLines = actions
    .filter((entry) => entry.kind === "ui_action" && entry.screen_id && entry.capability_hint)
    .map((entry) => `    screen ${entry.screen_id} action ${entry.capability_hint} prominence ${entry.prominence || "secondary"}`);

  const uiNavigationLines = [];
  if (defaultScreenId) {
    if (navigationPatterns.includes("command_palette")) {
      uiNavigationLines.push(`    group workspace label "Workspace" placement primary pattern command_palette`);
    } else {
      uiNavigationLines.push(`    group workspace label "Workspace" placement primary`);
    }
  }
  for (const screen of screens) {
    const directives = [
      "group workspace",
      `label "${screen.label || screen.id_hint}"`,
      screen.id_hint === defaultScreenId ? "default true" : null,
      screen.id_hint === defaultScreenId || screen.screen_kind === "list" ? "visible true" : "visible false"
    ].filter(Boolean);
    const matchedPattern =
      navigationPatterns.find((pattern) =>
        (pattern === "stack_navigation" && screen.screen_kind === "detail")
        || (pattern === "segmented_control" && screen.screen_kind === "list")
        || (pattern === "bottom_tabs" && screen.screen_kind === "list")
      ) || null;
    if (matchedPattern) {
      directives.push(`pattern ${matchedPattern}`);
    }
    if (screen.screen_kind === "detail" && defaultScreenId && screen.id_hint !== defaultScreenId) {
      directives.push(`breadcrumb ${defaultScreenId}`);
      directives.push("sitemap exclude");
    }
    uiNavigationLines.push(`    screen ${screen.id_hint} ${directives.join(" ")}`);
  }

  const uiScreenRegionLines = [];
  for (const screen of screens) {
    if (screen.screen_kind === "list") {
      uiScreenRegionLines.push(`    screen ${screen.id_hint} region toolbar pattern action_bar placement primary`);
      const preferredPattern =
        presentations.includes("data_grid") ? "data_grid_view"
        : presentations.includes("table") ? "resource_table"
        : presentations.includes("cards") ? "resource_cards"
        : "search_results";
      uiScreenRegionLines.push(`    screen ${screen.id_hint} region results pattern ${preferredPattern} placement primary`);
    }
    if (screen.screen_kind === "detail") {
      uiScreenRegionLines.push(`    screen ${screen.id_hint} region summary pattern detail_panel placement primary`);
      if (presentations.includes("inspector_pane")) {
        uiScreenRegionLines.push(`    screen ${screen.id_hint} region aside pattern inspector_pane placement supporting`);
      }
    }
  }
  const uiComponentLines = uiComponentLinesForCandidates(componentCandidates, allCandidates);

  const uiSharedDraft = `projection proj_ui_shared_imported_${stem} {
  name "Imported Shared UI Draft"
  description "Drafted from imported UI candidates. Review and adapt before adoption."

  platform ui_shared
  realizes [
${capabilityHints.length > 0 ? capabilityHints.map((hint) => `    ${hint}`).join(",\n") : "    // add capability ids"}
  ]
  outputs [ui_contract]

  ui_app_shell {
    brand "Imported ${stem.replace(/_/g, " ")}"
    shell ${shell}
${presentations.includes("search") ? "    global_search true\n" : ""}${presentations.includes("multi_window") ? "    windowing multi_window\n" : ""}  }

  ui_design {
    density comfortable
    tone operational
    radius_scale medium
    color_role primary accent
    color_role danger critical
    typography_role body readable
    typography_role heading prominent
    action_role primary prominent
    action_role destructive danger
    accessibility contrast aa
    accessibility focus visible
  }

  ui_screens {
${uiScreensBlock}
  }

${uiCollectionsLines.length > 0 ? `  ui_collections {\n${uiCollectionsLines.join("\n")}\n  }\n\n` : ""}${uiActionsLines.length > 0 ? `  ui_actions {\n${uiActionsLines.join("\n")}\n  }\n\n` : ""}  ui_navigation {
${uiNavigationLines.join("\n")}
  }

${uiScreenRegionLines.length > 0 ? `  ui_screen_regions {\n${uiScreenRegionLines.join("\n")}\n  }\n\n` : ""}${uiComponentLines.length > 0 ? `  ui_components {\n${uiComponentLines.join("\n")}\n  }\n\n` : ""}  status proposed
}
`;

  const webCapHints = capabilityHints.length > 0 ? capabilityHints.join(",\n    ") : "// add capability ids";
  const uiRouteLines = screens
    .filter((screen) => routes.has(screen.id_hint))
    .map((screen) => `    screen ${screen.id_hint} path ${routes.get(screen.id_hint)}`);
  const uiWebLines = [];
  for (const screen of screens) {
    if (!routes.has(screen.id_hint)) continue;
    if (screen.id_hint === defaultScreenId) {
      uiWebLines.push(`    screen ${screen.id_hint} shell ${shell}`);
    }
    if (screen.screen_kind === "list") {
      const preferredCollection =
        presentations.includes("data_grid") ? "data_grid"
        : presentations.includes("table") ? "table"
        : presentations.includes("cards") ? "cards"
        : "list";
      uiWebLines.push(`    screen ${screen.id_hint} collection ${preferredCollection}`);
      if (presentations.includes("cards")) {
        uiWebLines.push(`    screen ${screen.id_hint} mobile_variant cards`);
      }
    }
    if (screen.screen_kind === "detail" && presentations.includes("sheet")) {
      uiWebLines.push(`    screen ${screen.id_hint} present sheet`);
    }
    if (screen.screen_kind === "detail" && presentations.includes("popover")) {
      uiWebLines.push(`    screen ${screen.id_hint} present popover`);
    }
  }
  for (const entry of actions.filter((action) => action.kind === "ui_action" && action.capability_hint)) {
    const actionPresent =
      presentations.includes("fab") ? "fab"
      : presentations.includes("popover") ? "popover"
      : "button";
    uiWebLines.push(`    action ${entry.capability_hint} present ${actionPresent}`);
  }

  const uiWebDraft = `projection proj_ui_web_imported_${stem} {
  name "Imported Web UI Draft"
  description "Drafted from imported UI candidates. Review and adapt before adoption."

  platform ui_web
  realizes [
    proj_ui_shared_imported_${stem},
    ${webCapHints}
  ]
  outputs [ui_contract, web_app]

  ui_routes {
${uiRouteLines.length > 0 ? uiRouteLines.join("\n") : "    // add routes"}
  }

${uiWebLines.length > 0 ? `  ui_web {\n${uiWebLines.join("\n")}\n  }\n\n` : ""}  generator_defaults {
    profile react
    language typescript
    styling css
  }

  status proposed
}
`;

  const coverage = `# Imported UI Projection Drafts

- Draft shared projection: \`candidates/app/ui/drafts/proj-ui-shared.tg\`
- Draft web projection: \`candidates/app/ui/drafts/proj-ui-web.tg\`
- Draft component candidates: ${componentCandidates.length}
- Imported screens: ${screens.length}
- Imported routes: ${(ui.routes || []).length}
- Imported UI actions/presentations: ${actions.length}
- Imported navigation patterns: ${navigationPatterns.length ? navigationPatterns.join(", ") : "none"}
- Imported presentations: ${presentations.length ? presentations.join(", ") : "none"}

## Review Notes

- These files are drafts, not adopted canonical projections.
- Capability ids come from imported hints and may need renaming or pruning.
- Component candidates are suggested reusable contracts, not canonical ownership.
- Review component props, events, behavior, regions, and patterns before adopting.
- Search and refresh directives are inferred heuristically.
- Navigation groups currently default to a single \`workspace\` group unless stronger grouping evidence exists.
`;

  const files = {
    "candidates/app/ui/drafts/proj-ui-shared.tg": ensureTrailingNewline(uiSharedDraft),
    "candidates/app/ui/drafts/proj-ui-web.tg": ensureTrailingNewline(uiWebDraft),
    "candidates/app/ui/drafts/README.md": ensureTrailingNewline(coverage)
  };
  for (const component of componentCandidates) {
    files[`candidates/app/ui/drafts/components/${componentCandidateFileName(component)}`] = ensureTrailingNewline(renderComponentCandidate(component));
  }
  return files;
}

export function runImportApp(inputPath, options = {}) {
  const tracks = parseImportTracks(options.from);
  const context = createImportContext(inputPath, options);
  const resultsByTrack = {};
  context.priorResults = resultsByTrack;
  context.scanDocsSummary = options.scanDocsSummary || null;
  const findings = {};
  const candidates = {};
  const files = {};

  for (const track of tracks) {
    if (track === "workflows") {
      if (!resultsByTrack.db) {
        resultsByTrack.db = runTrack(context, "db");
      }
      if (!resultsByTrack.api) {
        resultsByTrack.api = runTrack(context, "api");
      }
    }
    if (track === "verification") {
      if (!resultsByTrack.api) {
        resultsByTrack.api = runTrack(context, "api");
      }
    }
    const result = runTrack(context, track);
    resultsByTrack[track] = result;
    findings[track] = result.findings;
    candidates[track] = result.candidates;
    files[`candidates/app/${track}/findings.json`] = `${JSON.stringify(result.findings, null, 2)}\n`;
    files[`candidates/app/${track}/candidates.json`] = `${JSON.stringify(result.candidates, null, 2)}\n`;
    files[`candidates/app/${track}/report.md`] = reportMarkdown(track, result.candidates);
  }

  if (candidates.ui) {
    candidates.ui = enrichUiComponentDataSources(candidates.ui, candidates);
    files["candidates/app/ui/candidates.json"] = `${JSON.stringify(candidates.ui, null, 2)}\n`;
    files["candidates/app/ui/report.md"] = reportMarkdown("ui", candidates.ui);
    Object.assign(files, draftUiProjectionFiles(context, candidates.ui, candidates));
  }

  const summary = {
    type: "import_app_report",
    workspace: context.paths.workspaceRoot,
    topogram_root: context.paths.topogramRoot,
    bootstrapped_topogram_root: context.paths.bootstrappedTopogramRoot,
    tracks,
    findings_count: Object.values(findings).reduce((total, entries) => total + entries.length, 0),
    extractor_detections: Object.fromEntries(Object.entries(resultsByTrack).map(([track, result]) => [track, result.extractor_detections])),
    candidates
  };

  files["candidates/app/findings.json"] = `${JSON.stringify(findings, null, 2)}\n`;
  files["candidates/app/candidates.json"] = `${JSON.stringify(candidates, null, 2)}\n`;
  files["candidates/app/report.md"] = ensureTrailingNewline(
    `# App Import Report\n\nTracks: ${tracks.join(", ")}\n\n## DB\n\n- Entities: ${candidates.db?.entities.length || 0}\n- Enums: ${candidates.db?.enums.length || 0}\n- Relations: ${candidates.db?.relations.length || 0}\n\n## API\n\n- Capabilities: ${candidates.api?.capabilities.length || 0}\n- Routes: ${candidates.api?.routes.length || 0}\n- Stacks: ${candidates.api?.stacks?.length ? candidates.api.stacks.join(", ") : "none"}\n\n## UI\n\n- Screens: ${candidates.ui?.screens.length || 0}\n- Routes: ${candidates.ui?.routes.length || 0}\n- Actions: ${candidates.ui?.actions.length || 0}\n- Components: ${candidates.ui?.components.length || 0}\n- Stacks: ${candidates.ui?.stacks?.length ? candidates.ui.stacks.join(", ") : "none"}\n\n## Workflows\n\n- Workflows: ${candidates.workflows?.workflows.length || 0}\n- States: ${candidates.workflows?.workflow_states.length || 0}\n- Transitions: ${candidates.workflows?.workflow_transitions.length || 0}\n\n## Verification\n\n- Verifications: ${candidates.verification?.verifications.length || 0}\n- Scenarios: ${candidates.verification?.scenarios.length || 0}\n- Frameworks: ${candidates.verification?.frameworks?.length ? candidates.verification.frameworks.join(", ") : "none"}\n- Scripts: ${candidates.verification?.scripts.length || 0}\n`
  );

  return {
    summary,
    files,
    defaultOutDir: context.paths.topogramRoot
  };
}

export { parseImportTracks };

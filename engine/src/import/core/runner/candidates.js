// @ts-check

import { collectionPatternFromPresentations } from "../../../ui/taxonomy.js";
import { dedupeCandidateRecords, idHintify, makeCandidateRecord } from "../shared.js";

/**
 * @param {Record<string, any>} allCandidates
 * @returns {string[]}
 */
export function importedApiCapabilityIds(allCandidates) {
  return [...(allCandidates?.api?.capabilities || [])]
    .map((capability) => capability.id_hint)
    .filter(Boolean)
    .sort();
}

/**
 * @param {any} screen
 * @returns {string|null}
 */
export function loadCapabilityForScreen(screen) {
  return capabilityHintsForScreen(screen).find((hint) => /^cap_(list|get)_/.test(hint)) || null;
}

/**
 * @param {any} value
 * @returns {string|null}
 */
function normalizeCapabilityHint(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    return value.id_hint || value.id || value.capability_hint || value.capability?.id || null;
  }
  return null;
}

/**
 * @param {any} screen
 * @returns {string[]}
 */
export function capabilityHintsForScreen(screen) {
  const rawHints = Array.isArray(screen.capability_hints)
    ? screen.capability_hints
    : [screen.capability_hints].filter(Boolean);
  return rawHints.map(normalizeCapabilityHint).filter(Boolean);
}

/**
 * @param {string|null|undefined} screenId
 * @returns {string}
 */
function screenConceptStem(screenId) {
  return String(screenId || "")
    .replace(/_(list|index|table|grid|results|detail|show|create|new|edit|form)$/, "")
    .replace(/^(list|show|create|edit)_/, "");
}

/**
 * @param {any} sourceScreen
 * @param {any[]} screens
 * @returns {any|null}
 */
function matchingDetailScreen(sourceScreen, screens) {
  const sourceStem = screenConceptStem(sourceScreen?.id_hint);
  if (!sourceStem) {
    return null;
  }
  return screens.find((screen) =>
    screen?.id_hint !== sourceScreen?.id_hint &&
    screen?.screen_kind === "detail" &&
    screenConceptStem(screen.id_hint) === sourceStem
  ) || null;
}

/**
 * @param {any} screen
 * @param {any[]} screens
 * @returns {any[]}
 */
function inferredEventsForWidgetScreen(screen, screens) {
  const detailScreen = matchingDetailScreen(screen, screens);
  if (!detailScreen) {
    return [];
  }
  return [{
    name: "row_select",
    kind: "selection",
    action: "navigate",
    target_screen: detailScreen.id_hint,
    confidence: "medium",
    evidence: detailScreen.provenance || [],
    requires_payload_shape_decision: true
  }];
}

/**
 * @param {any} candidates
 * @returns {any[]}
 */
export function uiWidgetCandidates(candidates) {
  return [
    ...(Array.isArray(candidates?.widgets) ? candidates.widgets : []),
    ...(Array.isArray(candidates?.components) ? candidates.components : [])
  ];
}

/**
 * @param {any} widget
 * @param {Record<string, any>} allCandidates
 * @returns {string|null}
 */
export function inferredDataSourceForWidget(widget, allCandidates) {
  if (widget.data_source) {
    return widget.data_source;
  }
  const capabilityIds = importedApiCapabilityIds(allCandidates);
  const screenStem = String(widget.screen_id || "")
    .replace(/_(list|index|table|grid|results)$/, "")
    .replace(/^list_/, "");
  return capabilityIds.find((id) => /^cap_(list|get)_/.test(id) && id.includes(screenStem)) ||
    capabilityIds.find((id) => /^cap_(list|get)_/.test(id)) ||
    null;
}

/**
 * @param {any} candidates
 * @returns {any[]}
 */
function deriveUiWidgetCandidates(candidates) {
  /** @type {any[]} */
  const screens = candidates.screens || [];
  /** @type {any[]} */
  const actions = candidates.actions || [];
  const presentations = [...new Set(actions
    .filter((entry) => entry.kind === "ui_presentation")
    .map((entry) => entry.presentation)
    .filter(Boolean))].sort();
  const widgetScreens = screens.filter((screen) => ["list", "dashboard", "analytics", "report", "feed", "inbox"].includes(screen.screen_kind));

  return widgetScreens.map((screen) => {
    const pattern = collectionPatternFromPresentations(presentations);
    const widgetStem = idHintify(`${screen.id_hint}_results`);
    const loadCapability = loadCapabilityForScreen(screen);
    const inferredEvents = inferredEventsForWidgetScreen(screen, screens);
    return makeCandidateRecord({
      kind: "widget",
      idHint: `widget_${widgetStem}`,
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
      inferred_events: inferredEvents,
      inferred_region: "results",
      inferred_pattern: pattern,
      evidence: [
        ...(screen.provenance || []),
        ...inferredEvents.flatMap((event) => event.evidence || [])
      ],
      missing_decisions: [
        "confirm widget reuse boundary",
        "confirm prop names and data source",
        "confirm events and behavior",
        "confirm supported regions and patterns"
      ],
      notes: [
        "Imported widget candidates are review-only.",
        "Confirm props, behavior, events, and reuse before adoption."
      ]
    });
  });
}

/**
 * @param {string} track
 * @param {any} candidates
 * @returns {any}
 */
export function normalizeCandidatesForTrack(track, candidates) {
  /** @param {any} record */
  const idHint = (record) => record.id_hint;
  /** @param {any} record */
  const apiRouteKey = (record) => `${record.method}:${record.path}:${record.source_kind}`;
  /** @param {any} entry */
  const withoutIdHint = ({ id_hint, ...entry }) => entry;
  if (track === "db") {
    return {
      entities: dedupeCandidateRecords(candidates.entities || [], idHint),
      enums: dedupeCandidateRecords(candidates.enums || [], idHint),
      relations: dedupeCandidateRecords(candidates.relations || [], idHint),
      indexes: dedupeCandidateRecords(candidates.indexes || [], idHint)
    };
  }
  if (track === "api") {
    return {
      capabilities: dedupeCandidateRecords(candidates.capabilities || [], idHint),
      routes: dedupeCandidateRecords(
        /** @type {any[]} */ (candidates.routes || []).map((route) => ({ ...route, id_hint: route.id_hint || `${route.method}_${route.path}` })),
        apiRouteKey
      ).map(withoutIdHint),
      stacks: [...new Set(candidates.stacks || [])].sort()
    };
  }
  if (track === "ui") {
    const explicitWidgets = uiWidgetCandidates(candidates);
    const derivedWidgets = deriveUiWidgetCandidates(candidates);
    return {
      screens: dedupeCandidateRecords(candidates.screens || [], idHint),
      routes: dedupeCandidateRecords(candidates.routes || [], idHint),
      actions: dedupeCandidateRecords(candidates.actions || [], idHint),
      widgets: dedupeCandidateRecords([...explicitWidgets, ...derivedWidgets], idHint),
      stacks: [...new Set(candidates.stacks || [])].sort()
    };
  }
  if (track === "verification") {
    return {
      verifications: dedupeCandidateRecords(candidates.verifications || [], idHint),
      scenarios: dedupeCandidateRecords(candidates.scenarios || [], idHint),
      frameworks: [...new Set(candidates.frameworks || [])].sort(),
      scripts: dedupeCandidateRecords(
        /** @type {any[]} */ (candidates.scripts || []).map((script) => ({
          ...script,
          id_hint: script.id_hint || `${script.file || "package.json"}:${script.name || "test"}`
        })),
        idHint
      ).map(withoutIdHint)
    };
  }
  return {
    workflows: dedupeCandidateRecords(candidates.workflows || [], idHint),
    workflow_states: dedupeCandidateRecords(candidates.workflow_states || [], idHint),
    workflow_transitions: dedupeCandidateRecords(candidates.workflow_transitions || [], idHint)
  };
}

/**
 * @param {any} uiCandidates
 * @param {Record<string, any>} allCandidates
 * @returns {any}
 */
export function enrichUiWidgetDataSources(uiCandidates, allCandidates) {
  if (!uiCandidates) {
    return uiCandidates;
  }
  const widgets = uiWidgetCandidates(uiCandidates);
  const { components, ...canonicalCandidates } = uiCandidates;
  return {
    ...canonicalCandidates,
    widgets: widgets.map((widget) => {
      const dataSource = inferredDataSourceForWidget(widget, allCandidates);
      const dataProp = widget.data_prop || "rows";
      return {
        ...widget,
        data_source: widget.data_source || dataSource,
        inferred_props: /** @type {any[]} */ (widget.inferred_props || []).map((prop) =>
          prop.name === dataProp ? { ...prop, source: prop.source || dataSource } : prop
        )
      };
    })
  };
}

import {
  dedupeCandidateRecords,
  detectUiPresentationFeatures,
  entityIdForRoute,
  inferNonResourceUiFlow,
  inferNavigationStructure,
  inferReactRoutes,
  makeCandidateRecord,
  navigationPatternsFromStructure,
  proposedUiContractAdditionsForFlow,
  relativeTo,
  shellKindFromNavigation,
  screenIdForRoute,
  screenKindForRoute,
  uiFlowIdForRoute,
  uiCapabilityHintsForRoute,
  titleCase,
  idHintify
} from "../../core/shared.js";
import path from "node:path";

export const reactRouterUiExtractor = {
  id: "ui.react-router",
  track: "ui",
  detect(context) {
    const roots = [
      path.join(context.paths.workspaceRoot, "apps", "web"),
      path.join(context.paths.workspaceRoot, "examples", "maintained", "proof-app")
    ];
    const count = roots.reduce((total, rootDir) => total + inferReactRoutes(rootDir, context.helpers).length, 0);
    return { score: count > 0 ? 70 : 0, reasons: count > 0 ? ["Found React Router UI routes"] : [] };
  },
  extract(context) {
    const findings = [];
    const candidates = { screens: [], routes: [], actions: [], flows: [], stacks: [] };
    const roots = [
      path.join(context.paths.workspaceRoot, "apps", "web"),
      path.join(context.paths.workspaceRoot, "examples", "maintained", "proof-app")
    ];
    for (const rootDir of roots) {
      const routes = inferReactRoutes(rootDir, context.helpers);
      if (routes.length === 0) continue;
      const provenance = relativeTo(context.paths.repoRoot, path.join(rootDir, "src", "App.tsx"));
      const navigation = inferNavigationStructure(rootDir);
      const features = detectUiPresentationFeatures(rootDir);
      const shellKind = shellKindFromNavigation(navigation);
      const navigationPatterns = navigationPatternsFromStructure(navigation);
      findings.push({ kind: "react_screen_routes", file: provenance, routes });
      findings.push({ kind: "react_navigation", file: provenance, navigation });
      findings.push({ kind: "react_surface_features", file: provenance, features });
      candidates.stacks.push("react_web");
      if (shellKind) {
        candidates.actions.push(makeCandidateRecord({
          kind: "ui_shell",
          idHint: `${path.basename(rootDir)}_shell`,
          label: titleCase(shellKind),
          confidence: "medium",
          sourceKind: "layout_code",
          provenance,
          track: "ui",
          shell_kind: shellKind,
          has_breadcrumbs: navigation.hasBreadcrumbs,
          has_tabs: navigation.hasTabs
        }));
      }
      for (const pattern of navigationPatterns) {
        candidates.actions.push(makeCandidateRecord({
          kind: "navigation",
          idHint: `${path.basename(rootDir)}_${idHintify(pattern)}`,
          label: pattern,
          confidence: "medium",
          sourceKind: "layout_code",
          provenance,
          track: "ui",
          navigation_pattern: pattern
        }));
      }
      for (const routePath of routes) {
        const screenId = screenIdForRoute(routePath);
        const screenKind = screenKindForRoute(routePath);
        const flow = inferNonResourceUiFlow(routePath);
        const capabilityHints = flow ? { load: null, submit: null, primary_action: null } : uiCapabilityHintsForRoute(routePath);
        const entityId = flow ? null : entityIdForRoute(routePath);
        const routeProvenance = `${provenance}#${routePath}`;
        candidates.screens.push(makeCandidateRecord({
          kind: "screen",
          idHint: screenId,
          label: titleCase(screenId),
          confidence: "medium",
          sourceKind: "route_code",
          provenance: routeProvenance,
          track: "ui",
          entity_id: entityId,
          concept_id: flow?.concept_id || entityId,
          screen_kind: screenKind,
          route_path: routePath,
          capability_hints: capabilityHints
        }));
        candidates.routes.push(makeCandidateRecord({
          kind: "ui_route",
          idHint: `${screenId}_route`,
          label: routePath,
          confidence: "medium",
          sourceKind: "route_code",
          provenance: routeProvenance,
          track: "ui",
          screen_id: screenId,
          entity_id: entityId,
          concept_id: flow?.concept_id || entityId,
          path: routePath
        }));
        if (flow) {
          candidates.flows.push(makeCandidateRecord({
            kind: "ui_flow",
            idHint: uiFlowIdForRoute(routePath, screenId),
            label: `${titleCase(flow.flow_type)} Flow`,
            confidence: flow.confidence,
            sourceKind: "route_code",
            sourceOfTruth: "candidate",
            provenance: routeProvenance,
            track: "ui",
            flow_type: flow.flow_type,
            concept_id: flow.concept_id,
            screen_ids: [screenId],
            route_paths: [routePath],
            evidence: [routeProvenance],
            missing_decisions: flow.missing_decisions,
            proposed_ui_contract_additions: proposedUiContractAdditionsForFlow(routePath, screenId, screenKind)
          }));
        }
        if (capabilityHints.primary_action) {
          candidates.actions.push(makeCandidateRecord({
            kind: "ui_action",
            idHint: `${screenId}_${idHintify(capabilityHints.primary_action)}`,
            label: capabilityHints.primary_action,
            confidence: "low",
            sourceKind: "route_code",
            provenance: `${provenance}#${routePath}`,
            track: "ui",
            screen_id: screenId,
            entity_id: entityIdForRoute(routePath),
            capability_hint: capabilityHints.primary_action,
            prominence: screenKind === "list" ? "primary" : "secondary"
          }));
        }
      }
      for (const feature of features) {
        candidates.actions.push(makeCandidateRecord({
          kind: "ui_presentation",
          idHint: `${path.basename(rootDir)}_${idHintify(feature)}`,
          label: feature,
          confidence: "low",
          sourceKind: "layout_code",
          provenance,
          track: "ui",
          presentation: feature
        }));
      }
    }
    candidates.screens = dedupeCandidateRecords(candidates.screens, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(candidates.routes, (record) => record.id_hint);
    candidates.actions = dedupeCandidateRecords(candidates.actions, (record) => record.id_hint);
    candidates.flows = dedupeCandidateRecords(candidates.flows, (record) => record.id_hint);
    candidates.stacks = [...new Set(candidates.stacks)].sort();
    return { findings, candidates };
  }
};

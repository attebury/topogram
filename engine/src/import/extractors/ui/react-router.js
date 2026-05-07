import {
  dedupeCandidateRecords,
  detectUiPresentationFeatures,
  entityIdForRoute,
  inferNavigationStructure,
  inferReactRoutes,
  makeCandidateRecord,
  navigationPatternsFromStructure,
  relativeTo,
  shellKindFromNavigation,
  screenIdForRoute,
  screenKindForRoute,
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
    const candidates = { screens: [], routes: [], actions: [], stacks: [] };
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
        const capabilityHints = uiCapabilityHintsForRoute(routePath);
        candidates.screens.push(makeCandidateRecord({
          kind: "screen",
          idHint: screenId,
          label: titleCase(screenId),
          confidence: "medium",
          sourceKind: "route_code",
          provenance: `${provenance}#${routePath}`,
          track: "ui",
          entity_id: entityIdForRoute(routePath),
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
          provenance: `${provenance}#${routePath}`,
          track: "ui",
          screen_id: screenId,
          entity_id: entityIdForRoute(routePath),
          path: routePath
        }));
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
    candidates.stacks = [...new Set(candidates.stacks)].sort();
    return { findings, candidates };
  }
};

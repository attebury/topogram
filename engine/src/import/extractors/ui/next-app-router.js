import { dedupeCandidateRecords, inferNextAppRoutes, inferNonResourceUiFlow, makeCandidateRecord, nextScreenIdForRoute, nextScreenKindForRoute, proposedUiContractAdditionsForFlow, uiCapabilityHintsForNextRoute, entityIdForNextRoute, conceptIdForNextRoute, relativeTo, titleCase, idHintify, uiFlowIdForRoute } from "../../core/shared.js";

export const nextAppRouterUiExtractor = {
  id: "ui.next-app-router",
  track: "ui",
  detect(context) {
    const routes = inferNextAppRoutes(context.paths.workspaceRoot, context.helpers);
    return {
      score: routes.length > 0 ? 100 : 0,
      reasons: routes.length > 0 ? ["Found Next.js App Router pages"] : []
    };
  },
  extract(context) {
    const routes = inferNextAppRoutes(context.paths.workspaceRoot, context.helpers);
    const findings = [];
    const candidates = { screens: [], routes: [], actions: [], flows: [], stacks: [] };
    if (routes.length > 0) {
      findings.push({
        kind: "next_app_routes",
        file: relativeTo(context.paths.repoRoot, `${context.paths.workspaceRoot}/app`),
        routes: routes.map((route) => route.path)
      });
      candidates.stacks.push("next_app_router");
      for (const route of routes) {
        if (route.kind !== "page") continue;
        const provenance = `${relativeTo(context.paths.repoRoot, route.file)}#${route.path}`;
        const screenId = nextScreenIdForRoute(route.path);
        const screenKind = nextScreenKindForRoute(route.path);
        const flow = inferNonResourceUiFlow(route.path);
        const capabilityHints = flow ? { load: null, submit: null, primary_action: null } : uiCapabilityHintsForNextRoute(route.path);
        const entityId = flow ? null : entityIdForNextRoute(route.path);
        const conceptId = flow?.concept_id || conceptIdForNextRoute(route.path);
        candidates.screens.push(makeCandidateRecord({
          kind: "screen",
          idHint: screenId,
          label: titleCase(screenId),
          confidence: "medium",
          sourceKind: "route_code",
          provenance,
          track: "ui",
          entity_id: entityId,
          concept_id: conceptId,
          screen_kind: screenKind,
          route_path: route.path,
          capability_hints: capabilityHints
        }));
        candidates.routes.push(makeCandidateRecord({
          kind: "ui_route",
          idHint: `${screenId}_route`,
          label: route.path,
          confidence: "medium",
          sourceKind: "route_code",
          provenance,
          track: "ui",
          screen_id: screenId,
          entity_id: entityId,
          concept_id: conceptId,
          path: route.path
        }));
        if (flow) {
          candidates.flows.push(makeCandidateRecord({
            kind: "ui_flow",
            idHint: uiFlowIdForRoute(route.path, screenId),
            label: `${titleCase(flow.flow_type)} Flow`,
            confidence: flow.confidence,
            sourceKind: "route_code",
            sourceOfTruth: "candidate",
            provenance,
            track: "ui",
            flow_type: flow.flow_type,
            concept_id: flow.concept_id,
            screen_ids: [screenId],
            route_paths: [route.path],
            evidence: [provenance],
            missing_decisions: flow.missing_decisions,
            proposed_ui_contract_additions: proposedUiContractAdditionsForFlow(route.path, screenId, screenKind)
          }));
        }
        if (capabilityHints.primary_action) {
          candidates.actions.push(makeCandidateRecord({
            kind: "ui_action",
            idHint: `${screenId}_${idHintify(capabilityHints.primary_action)}`,
            label: capabilityHints.primary_action,
            confidence: "low",
            sourceKind: "route_code",
            provenance,
            track: "ui",
            screen_id: screenId,
            entity_id: entityId,
            concept_id: conceptId,
            capability_hint: capabilityHints.primary_action,
            prominence: screenKind === "list" ? "primary" : "secondary"
          }));
        }
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

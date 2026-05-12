import path from "node:path";

import {
  dedupeCandidateRecords,
  findImportFiles,
  inferNonResourceUiFlow,
  makeCandidateRecord,
  proposedUiContractAdditionsForFlow,
  relativeTo,
  titleCase,
  uiFlowIdForRoute,
  idHintify
} from "../../core/shared.js";

function pagesRoutePath(pagesRoot, filePath) {
  const relative = relativeTo(pagesRoot, filePath);
  return `/${relative}`
    .replace(/\.(tsx|ts|jsx|js|mdx)$/, "")
    .replace(/\/index$/, "")
    .replace(/\[(\.\.\.)?([^\]]+)\]/g, (_match, catchAll, name) => catchAll ? `:${name}*` : `:${name}`)
    .replace(/^\/$/, "/") || "/";
}

function inferTrpcHooks(text) {
  const hooks = [];
  for (const match of String(text || "").matchAll(/trpc\.([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\.use(Query|InfiniteQuery|Mutation)\b/g)) {
    hooks.push({
      router: match[1],
      procedure: match[2],
      hook: match[3]
    });
  }
  return hooks;
}

function screenFromRouteAndHooks(routePath, hooks) {
  const hasPostHooks = hooks.some((hook) => hook.router === "post");
  if (routePath === "/" && hasPostHooks) return { id: "post_list", kind: "list", entity: "entity_post", concept: "entity_post" };
  if (/^\/post\/:[^/]+$/.test(routePath) && hasPostHooks) return { id: "post_detail", kind: "detail", entity: "entity_post", concept: "entity_post" };
  if (routePath === "/") return { id: "home", kind: "flow", entity: null, concept: "surface_home" };
  const resource = routePath.split("/").filter(Boolean)[0] || "home";
  const normalized = resource.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
  const kind = /\/:[^/]+$/.test(routePath) ? "detail" : "list";
  return {
    id: kind === "detail" ? `${normalized}_detail` : `${normalized}_list`,
    kind,
    entity: normalized === "home" ? null : `entity_${normalized}`,
    concept: normalized === "home" ? "surface_home" : `entity_${normalized}`
  };
}

function capabilityHint(router, procedure) {
  const resource = router.toLowerCase();
  if (procedure === "list") return `cap_list_${resource}s`;
  if (procedure === "byId") return `cap_get_${resource}`;
  if (procedure === "add") return `cap_create_${resource}`;
  return `cap_${idHintify(`${procedure}_${resource}`)}`;
}

export const nextPagesRouterUiExtractor = {
  id: "ui.next-pages-router",
  track: "ui",
  detect(context) {
    const pageFiles = findImportFiles(context.paths, (filePath) => /src\/pages\/.+\.(tsx|ts|jsx|js|mdx)$/i.test(filePath))
      .filter((filePath) => !/\/api\//.test(filePath) && !/\/_(app|document|error)\./.test(filePath) && !/\/404\./.test(filePath));
    return {
      score: pageFiles.length > 0 ? 85 : 0,
      reasons: pageFiles.length > 0 ? ["Found Next.js Pages Router pages"] : []
    };
  },
  extract(context) {
    const pagesRoot = path.join(context.paths.workspaceRoot, "src", "pages");
    const pageFiles = findImportFiles(context.paths, (filePath) => /src\/pages\/.+\.(tsx|ts|jsx|js|mdx)$/i.test(filePath))
      .filter((filePath) => !/\/api\//.test(filePath) && !/\/_(app|document|error)\./.test(filePath) && !/\/404\./.test(filePath));
    const findings = [];
    const candidates = { screens: [], routes: [], actions: [], flows: [], stacks: [] };
    if (pageFiles.length > 0) {
      const routes = [];
      for (const filePath of pageFiles) {
        const routePath = pagesRoutePath(pagesRoot, filePath);
        const text = context.helpers.readTextIfExists(filePath) || "";
        const hooks = inferTrpcHooks(text);
        const screen = screenFromRouteAndHooks(routePath, hooks);
        const flow = inferNonResourceUiFlow(routePath);
        const provenance = `${relativeTo(context.paths.repoRoot, filePath)}#${routePath}`;
        routes.push(routePath);
        candidates.screens.push(makeCandidateRecord({
          kind: "screen",
          idHint: screen.id,
          label: titleCase(screen.id),
          confidence: "medium",
          sourceKind: "route_code",
          provenance,
          track: "ui",
          entity_id: flow ? null : screen.entity,
          concept_id: flow?.concept_id || screen.concept,
          screen_kind: flow ? "flow" : screen.kind,
          route_path: routePath,
          capability_hints: flow ? [] : hooks.map((hook) => capabilityHint(hook.router, hook.procedure))
        }));
        candidates.routes.push(makeCandidateRecord({
          kind: "ui_route",
          idHint: `${screen.id}_route`,
          label: routePath,
          confidence: "medium",
          sourceKind: "route_code",
          provenance,
          track: "ui",
          screen_id: screen.id,
          entity_id: flow ? null : screen.entity,
          concept_id: flow?.concept_id || screen.concept,
          path: routePath
        }));
        if (flow) {
          candidates.flows.push(makeCandidateRecord({
            kind: "ui_flow",
            idHint: uiFlowIdForRoute(routePath, screen.id),
            label: `${titleCase(flow.flow_type)} Flow`,
            confidence: flow.confidence,
            sourceKind: "route_code",
            sourceOfTruth: "candidate",
            provenance,
            track: "ui",
            flow_type: flow.flow_type,
            concept_id: flow.concept_id,
            screen_ids: [screen.id],
            route_paths: [routePath],
            evidence: [provenance],
            missing_decisions: flow.missing_decisions,
            proposed_ui_contract_additions: proposedUiContractAdditionsForFlow(routePath, screen.id, "flow")
          }));
        }
        for (const hook of hooks.filter((hook) => hook.hook === "Mutation")) {
          const capability = capabilityHint(hook.router, hook.procedure);
          candidates.actions.push(makeCandidateRecord({
            kind: "ui_action",
            idHint: `${screen.id}_${idHintify(capability)}`,
            label: capability,
            confidence: "medium",
            sourceKind: "route_code",
            provenance,
            track: "ui",
            screen_id: screen.id,
            entity_id: screen.entity,
            concept_id: screen.concept,
            capability_hint: capability,
            prominence: "primary"
          }));
        }
      }
      findings.push({
        kind: "next_pages_routes",
        file: relativeTo(context.paths.repoRoot, pagesRoot),
        routes: [...new Set(routes)].sort()
      });
      candidates.stacks.push("next_pages_router");
    }
    candidates.screens = dedupeCandidateRecords(candidates.screens, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(candidates.routes, (record) => record.id_hint);
    candidates.actions = dedupeCandidateRecords(candidates.actions, (record) => record.id_hint);
    candidates.flows = dedupeCandidateRecords(candidates.flows, (record) => record.id_hint);
    candidates.stacks = [...new Set(candidates.stacks)].sort();
    return { findings, candidates };
  }
};

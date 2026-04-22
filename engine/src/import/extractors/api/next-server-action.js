import { inferCapabilityEntityId, inferFormDataFields, inferInputNames, inferNextServerActionCapabilities, makeCandidateRecord, normalizeOpenApiPath, relativeTo, titleCase } from "../../core/shared.js";

export const nextServerActionExtractor = {
  id: "api.next-server-action",
  track: "api",
  detect(context) {
    const actions = inferNextServerActionCapabilities(context.paths.workspaceRoot, context.helpers);
    return {
      score: actions.length > 0 ? 90 : 0,
      reasons: actions.length > 0 ? ["Found Next.js server actions"] : []
    };
  },
  extract(context) {
    const actions = inferNextServerActionCapabilities(context.paths.workspaceRoot, context.helpers);
    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };
    if (actions.length > 0) {
      findings.push({
        kind: "next_server_actions",
        files: [...new Set(actions.map((action) => relativeTo(context.paths.repoRoot, action.file)))],
        action_count: actions.length
      });
      candidates.capabilities.push(...actions.map((action) => makeCandidateRecord({
        kind: "capability",
        idHint: action.id_hint,
        label: titleCase(action.id_hint.replace(/^cap_/, "")),
        confidence: "medium",
        sourceKind: action.source_kind,
        provenance: `${relativeTo(context.paths.repoRoot, action.file)}#${action.function_name}`,
        endpoint: { method: action.method, path: normalizeOpenApiPath(action.path) },
        path_params: (action.path_params || []).map((name) => ({ name, required: true, type: null })),
        query_params: [],
        header_params: [],
        input_fields: action.input_fields || [],
        output_fields: action.output_fields || [],
        auth_hint: action.auth_hint || "unknown",
        entity_id: action.entity_id || inferCapabilityEntityId({ endpoint: { path: action.path }, id_hint: action.id_hint }),
        track: "api"
      })));
      candidates.routes.push(...actions.map((action) => ({
        path: normalizeOpenApiPath(action.path),
        method: action.method,
        confidence: "medium",
        source_kind: action.source_kind,
        provenance: `${relativeTo(context.paths.repoRoot, action.file)}#${action.function_name}`
      })));
      candidates.stacks.push("next_app_router");
    }
    return { findings, candidates };
  }
};

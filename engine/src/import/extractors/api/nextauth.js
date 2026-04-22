import { inferNextAuthCapabilities, makeCandidateRecord, normalizeOpenApiPath } from "../../core/shared.js";

export const nextAuthExtractor = {
  id: "api.nextauth",
  track: "api",
  detect(context) {
    const capabilities = inferNextAuthCapabilities(context.paths, context.helpers);
    return {
      score: capabilities.length > 0 ? 88 : 0,
      reasons: capabilities.length > 0 ? ["Found NextAuth-style auth flows"] : []
    };
  },
  extract(context) {
    const capabilities = inferNextAuthCapabilities(context.paths, context.helpers);
    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };
    if (capabilities.length > 0) {
      findings.push({
        kind: "next_auth_flows",
        files: [...new Set(capabilities.flatMap((capability) => capability.provenance || []))],
        capability_count: capabilities.length
      });
      candidates.capabilities.push(...capabilities.map((capability) => makeCandidateRecord({
        kind: "capability",
        idHint: capability.id_hint,
        label: capability.label,
        confidence: "medium",
        sourceKind: capability.source_kind,
        provenance: capability.provenance,
        endpoint: { method: capability.method, path: normalizeOpenApiPath(capability.path) },
        path_params: [],
        query_params: [],
        header_params: [],
        input_fields: capability.input_fields || [],
        output_fields: capability.output_fields || [],
        auth_hint: capability.auth_hint || "unknown",
        entity_id: capability.entity_id,
        target_state: capability.target_state || null,
        track: "api"
      })));
      candidates.routes.push(...capabilities.map((capability) => ({
        path: normalizeOpenApiPath(capability.path),
        method: capability.method,
        confidence: "medium",
        source_kind: capability.source_kind,
        provenance: capability.provenance
      })));
      candidates.stacks.push("nextauth");
    }
    return { findings, candidates };
  }
};

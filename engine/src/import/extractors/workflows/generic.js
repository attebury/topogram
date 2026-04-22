import { dedupeCandidateRecords, idHintify, inferCapabilityEntityId, makeCandidateRecord, titleCase } from "../../core/shared.js";

function findEntityStatusFields(entity, enumCandidatesById) {
  return (entity?.fields || []).filter((field) =>
    ["status", "state"].includes(field.name) && enumCandidatesById.has(idHintify(field.field_type))
  );
}

function targetStateForCapability(capability, knownStates) {
  if (capability.target_state) {
    const explicitState = idHintify(capability.target_state);
    if (knownStates.length === 0 || knownStates.includes(explicitState)) return explicitState;
  }
  const id = capability.id_hint || "";
  const method = String(capability.endpoint?.method || "").toUpperCase();
  for (const [needle, state] of [
    ["sign_in", "authenticated"],
    ["login", "authenticated"],
    ["authenticate", "authenticated"],
    ["register", "registered"],
    ["approve", "approved"],
    ["reject", "rejected"],
    ["revision", "needs_revision"],
    ["request_revision", "needs_revision"],
    ["submit", "submitted"],
    ["close", "closed"],
    ["complete", "completed"],
    ["archive", "archived"],
    ["delete", "deleted"],
    [method === "POST" && id.startsWith("cap_create_") ? "create" : "", knownStates[0] || "created"]
  ].filter(([needle]) => needle)) {
    if (id.includes(needle)) {
      const canonicalState = idHintify(state);
      if (knownStates.length === 0 || knownStates.includes(canonicalState)) return canonicalState;
    }
  }
  return null;
}

export const genericWorkflowExtractor = {
  id: "workflows.generic",
  track: "workflows",
  detect() {
    return { score: 50, reasons: ["Workflow inference runs over imported DB/API evidence"] };
  },
  extract(context) {
    const dbImport = context.priorResults.db || { findings: [], candidates: { entities: [], enums: [] } };
    const apiImport = context.priorResults.api || { findings: [], candidates: { capabilities: [] } };
    const docScan = context.scanDocsSummary ? context.scanDocsSummary() : { candidate_docs: [] };
    const findings = [];
    const candidates = { workflows: [], workflow_states: [], workflow_transitions: [] };
    const enumCandidatesById = new Map((dbImport.candidates.enums || []).map((entry) => [entry.id_hint, entry]));
    const entityCandidatesById = new Map((dbImport.candidates.entities || []).map((entry) => [entry.id_hint, entry]));
    const workflowDocs = (docScan.candidate_docs || []).filter((doc) => doc.kind === "workflow");
    const workflows = new Map();

    for (const capability of apiImport.candidates.capabilities || []) {
      const entityId = inferCapabilityEntityId(capability);
      const workflowId = `workflow_${entityId.replace(/^entity_/, "")}`;
      const capabilityActors =
        capability.auth_hint === "secured" ? ["user"] :
        capability.auth_hint === "public" ? ["anonymous"] :
        [];
      if (!workflows.has(workflowId)) {
        const entity = entityCandidatesById.get(entityId);
        const statusFields = findEntityStatusFields(entity, enumCandidatesById);
        const states = statusFields.flatMap((field) => enumCandidatesById.get(idHintify(field.field_type))?.values || []).map(idHintify);
        workflows.set(workflowId, {
          workflow: makeCandidateRecord({
            kind: "workflow",
            idHint: workflowId,
            label: `${titleCase(entityId.replace(/^entity_/, ""))} Workflow`,
            confidence: "medium",
            sourceKind: "generated_artifact",
            provenance: capability.provenance || [],
            track: "workflows",
            entity_id: entityId,
            actor_hints: capabilityActors,
            related_capabilities: []
          }),
          states: states.map((state) => makeCandidateRecord({
            kind: "workflow_state",
            idHint: `${workflowId}_${state}`,
            label: titleCase(state),
            confidence: "medium",
            sourceKind: "schema",
            provenance: entity?.provenance || capability.provenance || [],
            track: "workflows",
            workflow_id: workflowId,
            entity_id: entityId,
            state_id: state
          })),
          transitions: []
        });
      }
      const workflow = workflows.get(workflowId);
      workflow.workflow.related_capabilities.push(capability.id_hint);
      workflow.workflow.actor_hints = [...new Set([...(workflow.workflow.actor_hints || []), ...capabilityActors])].sort();
      const knownStates = workflow.states.map((entry) => entry.state_id);
      const targetState = targetStateForCapability(capability, knownStates);
      if (targetState) {
        workflow.transitions.push(makeCandidateRecord({
          kind: "workflow_transition",
          idHint: `${workflowId}_${idHintify(capability.id_hint)}`,
          label: titleCase(capability.id_hint.replace(/^cap_/, "")),
          confidence: "low",
          sourceKind: capability.source_kind || "generated_artifact",
          provenance: capability.provenance || [],
          track: "workflows",
          workflow_id: workflowId,
          entity_id: entityId,
          capability_id: capability.id_hint,
          actor_hints: capabilityActors,
          to_state: targetState
        }));
      }
    }

    for (const workflow of workflows.values()) {
      workflow.workflow.related_capabilities = [...new Set(workflow.workflow.related_capabilities)].sort();
      candidates.workflows.push(workflow.workflow);
      candidates.workflow_states.push(...workflow.states);
      candidates.workflow_transitions.push(...workflow.transitions);
    }

    findings.push({
      kind: "workflow_inference",
      workflow_count: candidates.workflows.length,
      workflow_doc_signals: workflowDocs.map((doc) => doc.id)
    });

    candidates.workflows = dedupeCandidateRecords(candidates.workflows, (record) => record.id_hint);
    candidates.workflow_states = dedupeCandidateRecords(candidates.workflow_states, (record) => record.id_hint);
    candidates.workflow_transitions = dedupeCandidateRecords(candidates.workflow_transitions, (record) => record.id_hint);
    return { findings, candidates };
  }
};

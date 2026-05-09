// @ts-check
import { idHintify, titleCase } from "../../text-helpers.js";
import { scanDocsWorkflow } from "../docs.js";
import { collectApiImport } from "./api.js";
import { collectDbImport } from "./db.js";
import { dedupeCandidateRecords, inferCapabilityEntityId, makeCandidateRecord } from "./shared.js";

/** @param {WorkflowRecord} capability @returns {any} */
function workflowEntityIdForCapability(capability) {
  return inferCapabilityEntityId(capability);
}

/** @param {WorkflowRecord} entity @param {any} enumCandidatesById @returns {any} */
function findEntityStatusFields(entity, enumCandidatesById) {
  return (entity?.fields || []).filter((/** @type {any} */ field) =>
    ["status", "state"].includes(field.name) && enumCandidatesById.has(idHintify(field.field_type))
  );
}

/** @param {WorkflowRecord} capability @param {any[]} knownStates @returns {any} */
function targetStateForCapability(capability, knownStates) {
  if (capability.target_state) {
    const explicitState = idHintify(capability.target_state);
    if (knownStates.length === 0 || knownStates.includes(explicitState)) {
      return explicitState;
    }
  }
  const id = capability.id_hint || "";
  const method = String(capability.endpoint?.method || "").toUpperCase();
  const candidates = [
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
  ].filter((/** @type {any} */ [needle]) => needle);
  for (const [needle, state] of candidates) {
    if (id.includes(needle) && state) {
      const canonicalState = idHintify(state);
      if (knownStates.length === 0 || knownStates.includes(canonicalState)) {
        return canonicalState;
      }
    }
  }
  return null;
}

/** @param {WorkspacePaths} paths @returns {any} */
export function collectWorkflowImport(paths) {
  /** @type {any[]} */
  const findings = [];
  /** @type {WorkflowRecord} */
  const candidates = {
    workflows: [],
    workflow_states: [],
    workflow_transitions: []
  };
  const dbImport = collectDbImport(paths);
  const apiImport = collectApiImport(paths);
  const docScan = scanDocsWorkflow(paths.topogramRoot).summary;
  const enumCandidatesById = new Map((dbImport.candidates.enums || []).map((/** @type {any} */ entry) => [entry.id_hint, entry]));
  const entityCandidatesById = new Map((dbImport.candidates.entities || []).map((/** @type {any} */ entry) => [entry.id_hint, entry]));
  const workflowDocs = (docScan.candidate_docs || []).filter((/** @type {any} */ doc) => doc.kind === "workflow");
  const workflows = new Map();

  for (const capability of apiImport.candidates.capabilities || []) {
    const entityId = workflowEntityIdForCapability(capability);
    const workflowId = `workflow_${entityId.replace(/^entity_/, "")}`;
    const capabilityActors =
      capability.auth_hint === "secured" ? ["user"] :
      capability.auth_hint === "public" ? ["anonymous"] :
      [];
    if (!workflows.has(workflowId)) {
      const entity = entityCandidatesById.get(entityId);
      const statusFields = findEntityStatusFields(entity, enumCandidatesById);
      const states = statusFields.flatMap((/** @type {any} */ field) => enumCandidatesById.get(idHintify(field.field_type))?.values || []).map(idHintify);
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
        states: states.map((/** @type {any} */ state) =>
          makeCandidateRecord({
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
          })
        ),
        transitions: []
      });
    }
    const workflow = workflows.get(workflowId);
    workflow.workflow.related_capabilities.push(capability.id_hint);
    workflow.workflow.actor_hints = [...new Set([...(workflow.workflow.actor_hints || []), ...capabilityActors])].sort();
    const knownStates = workflow.states.map((/** @type {any} */ entry) => entry.state_id);
    const targetState = targetStateForCapability(capability, knownStates);
    if (targetState) {
      workflow.transitions.push(
        makeCandidateRecord({
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
        })
      );
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
    workflow_doc_signals: workflowDocs.map((/** @type {any} */ doc) => doc.id)
  });

  candidates.workflows = dedupeCandidateRecords(candidates.workflows, (/** @type {any} */ record) => record.id_hint);
  candidates.workflow_states = dedupeCandidateRecords(candidates.workflow_states, (/** @type {any} */ record) => record.id_hint);
  candidates.workflow_transitions = dedupeCandidateRecords(candidates.workflow_transitions, (/** @type {any} */ record) => record.id_hint);

  return { findings, candidates };
}

// @ts-nocheck
import { generateApiContractGraph } from "../../generator/api.js";
import { confidenceRank } from "../docs.js";
import { normalizeEndpointPathForMatch, normalizeOpenApiPath } from "../import-app/index.js";

export function compareEntityFields(importedEntity, graphEntity) {
  const graphFields = new Map((graphEntity.fields || []).map((field) => [field.name, field]));
  const missing = [];
  const typeMismatches = [];
  const requiredMismatches = [];
  for (const field of importedEntity.fields || []) {
    const graphField = graphFields.get(field.name);
    if (!graphField) {
      missing.push(field.name);
      continue;
    }
    if (String(graphField.fieldType) !== String(field.field_type)) {
      typeMismatches.push({
        field: field.name,
        imported: field.field_type,
        topogram: graphField.fieldType
      });
    }
    if (Boolean(graphField.required) !== Boolean(field.required)) {
      requiredMismatches.push({
        field: field.name,
        imported: Boolean(field.required),
        topogram: Boolean(graphField.required)
      });
    }
  }
  return { missing, typeMismatches, requiredMismatches };
}

export function normalizeApiCandidateId(value) {
  return String(value || "").trim().toLowerCase();
}

export function collectContractFieldNames(fields, jsonSchema) {
  const names = new Set((fields || []).map((field) => field.name).filter(Boolean));
  for (const propertyName of Object.keys(jsonSchema?.properties || {})) {
    names.add(propertyName);
  }
  return [...names].sort();
}

export function buildTopogramApiCapabilityIndex(graph) {
  const contracts = generateApiContractGraph(graph);
  const records = [];
  for (const capability of graph.byKind.capability || []) {
    const contract = contracts[capability.id];
    if (!contract) {
      continue;
    }
    records.push({
      id: capability.id,
      endpoint: {
        method: contract.endpoint.method,
        path: normalizeOpenApiPath(contract.endpoint.path)
      },
      input_fields: collectContractFieldNames(contract.requestContract?.fields, contract.requestContract?.jsonSchema),
      output_fields: collectContractFieldNames(contract.responseContract?.fields, contract.responseContract?.jsonSchema),
      path_params: (contract.requestContract?.transport?.path || []).map((field) => field.name).filter(Boolean).sort(),
      query_params: (contract.requestContract?.transport?.query || []).map((field) => field.name).filter(Boolean).sort()
    });
  }
  return records;
}

export function matchImportedApiCapability(importedCapability, topogramCapabilities) {
  const importedId = normalizeApiCandidateId(importedCapability.id_hint);
  const importedMethod = String(importedCapability.endpoint?.method || "").toUpperCase();
  const importedPath = normalizeEndpointPathForMatch(importedCapability.endpoint?.path || "");
  return topogramCapabilities.find((capability) =>
    normalizeApiCandidateId(capability.id) === importedId ||
    (capability.endpoint.method === importedMethod && normalizeEndpointPathForMatch(capability.endpoint.path) === importedPath)
  ) || null;
}

export function compareApiCapabilityFields(importedCapability, topogramCapability) {
  const missingInputFields = (importedCapability.input_fields || []).filter((field) => !topogramCapability.input_fields.includes(field));
  const missingOutputFields = (importedCapability.output_fields || []).filter((field) => !topogramCapability.output_fields.includes(field));
  const missingPathParams = (importedCapability.path_params || []).map((entry) => entry.name).filter((name) => !topogramCapability.path_params.includes(name));
  const missingQueryParams = (importedCapability.query_params || []).map((entry) => entry.name).filter((name) => !topogramCapability.query_params.includes(name));
  return {
    missing_input_fields_in_topogram: missingInputFields,
    missing_output_fields_in_topogram: missingOutputFields,
    missing_path_params_in_topogram: missingPathParams,
    missing_query_params_in_topogram: missingQueryParams
  };
}

export function collectCanonicalUiSurface(graph) {
  const screens = new Set();
  const routes = new Set();
  for (const projection of graph.byKind.projection || []) {
    if (!["ui_contract", "web_surface"].includes(projection.type)) {
      continue;
    }
    for (const screen of projection.uiScreens || []) {
      screens.add(screen.id);
    }
    for (const route of projection.uiRoutes || []) {
      routes.add(route.path);
    }
  }
  return {
    screens: [...screens].sort(),
    routes: [...routes].sort()
  };
}

export function collectCanonicalWorkflowSurface(graph) {
  const docs = (graph.docs || []).filter((doc) => doc.kind === "workflow");
  const decisions = (graph.byKind.decision || []).map((decision) => decision.id);
  return {
    workflow_docs: docs.map((doc) => doc.id).sort(),
    decisions: decisions.sort()
  };
}

export function collectCanonicalActorRoleSurface(graph) {
  const journeyDocs = (graph.docs || []).filter((doc) => doc.kind === "journey");
  const workflowDocs = (graph.docs || []).filter((doc) => doc.kind === "workflow");
  return {
    actor_ids: ((graph.byKind.actor || []).map((entry) => entry.id)).sort(),
    role_ids: ((graph.byKind.role || []).map((entry) => entry.id)).sort(),
    journey_docs: journeyDocs,
    workflow_docs: workflowDocs
  };
}

export function buildBundleDocLinkSuggestions(bundle, graph) {
  if (!graph) {
    return [];
  }
  const canonicalDocs = new Map(
    (graph.docs || [])
      .filter((doc) => ["journey", "workflow"].includes(doc.kind))
      .map((doc) => [doc.id, doc])
  );
  const suggestions = new Map();
  const getOrCreateSuggestion = (doc) => {
    if (!suggestions.has(doc.id)) {
      suggestions.set(doc.id, {
        doc_id: doc.id,
        doc_kind: doc.kind,
        canonical_rel_path: doc.relativePath,
        add_related_actors: [],
        add_related_roles: [],
        add_related_capabilities: [],
        add_related_rules: [],
        add_related_workflows: []
      });
    }
    return suggestions.get(doc.id);
  };
  for (const entry of [...(bundle.actors || []), ...(bundle.roles || [])]) {
    const kind = entry.id_hint.startsWith("actor_") ? "actor" : "role";
    for (const docId of entry.related_docs || []) {
      const doc = canonicalDocs.get(docId);
      if (!doc) {
        continue;
      }
      const target = getOrCreateSuggestion(doc);
      if (kind === "actor" && !(doc.relatedActors || []).includes(entry.id_hint)) {
        target.add_related_actors.push(entry.id_hint);
      }
      if (kind === "role" && !(doc.relatedRoles || []).includes(entry.id_hint)) {
        target.add_related_roles.push(entry.id_hint);
      }
    }
  }
  for (const entry of bundle.docs || []) {
    const doc = canonicalDocs.get(entry.id);
    if (!doc) {
      continue;
    }
    const target = getOrCreateSuggestion(doc);
    for (const capabilityId of entry.related_capabilities || []) {
      if (!(doc.relatedCapabilities || []).includes(capabilityId)) {
        target.add_related_capabilities.push(capabilityId);
      }
    }
    for (const ruleId of entry.related_rules || []) {
      if (!(doc.relatedRules || []).includes(ruleId)) {
        target.add_related_rules.push(ruleId);
      }
    }
    for (const workflowId of entry.related_workflows || []) {
      if (!(doc.relatedWorkflows || []).includes(workflowId)) {
        target.add_related_workflows.push(workflowId);
      }
    }
  }
  return [...suggestions.values()]
    .map((entry) => ({
      ...entry,
      add_related_actors: [...new Set(entry.add_related_actors)].sort(),
      add_related_roles: [...new Set(entry.add_related_roles)].sort(),
      add_related_capabilities: [...new Set(entry.add_related_capabilities)].sort(),
      add_related_rules: [...new Set(entry.add_related_rules)].sort(),
      add_related_workflows: [...new Set(entry.add_related_workflows)].sort()
    }))
    .filter((entry) =>
      entry.add_related_actors.length > 0 ||
      entry.add_related_roles.length > 0 ||
      entry.add_related_capabilities.length > 0 ||
      entry.add_related_rules.length > 0 ||
      entry.add_related_workflows.length > 0
    )
    .map((entry) => ({
      ...entry,
      patch_rel_path: `doc-link-patches/${entry.doc_id}.md`,
      recommendation:
        `Update \`${entry.doc_id}\` to add` +
        `${entry.add_related_actors.length ? ` related_actors ${entry.add_related_actors.map((item) => `\`${item}\``).join(", ")}` : ""}` +
        `${entry.add_related_actors.length && (entry.add_related_roles.length || entry.add_related_capabilities.length || entry.add_related_rules.length || entry.add_related_workflows.length) ? " and" : ""}` +
        `${entry.add_related_roles.length ? ` related_roles ${entry.add_related_roles.map((item) => `\`${item}\``).join(", ")}` : ""}` +
        `${entry.add_related_roles.length && (entry.add_related_capabilities.length || entry.add_related_rules.length || entry.add_related_workflows.length) ? "," : ""}` +
        `${entry.add_related_capabilities.length ? ` related_capabilities ${entry.add_related_capabilities.map((item) => `\`${item}\``).join(", ")}` : ""}` +
        `${entry.add_related_capabilities.length && (entry.add_related_rules.length || entry.add_related_workflows.length) ? "," : ""}` +
        `${entry.add_related_rules.length ? ` related_rules ${entry.add_related_rules.map((item) => `\`${item}\``).join(", ")}` : ""}` +
        `${entry.add_related_rules.length && entry.add_related_workflows.length ? "," : ""}` +
        `${entry.add_related_workflows.length ? ` related_workflows ${entry.add_related_workflows.map((item) => `\`${item}\``).join(", ")}` : ""}.`
    }))
    .sort((a, b) =>
      (b.add_related_actors.length + b.add_related_roles.length) - (a.add_related_actors.length + a.add_related_roles.length) ||
      a.doc_id.localeCompare(b.doc_id)
    );
}

export function summarizeGapCandidates(records = []) {
  return records
    .map((record) => ({
      id: record.id_hint,
      confidence: record.confidence || "low",
      inference: record.inference_summary || null,
      related_docs: record.related_docs || [],
      related_capabilities: record.related_capabilities || []
    }))
    .sort((a, b) => {
      const confidenceDelta = confidenceRank(b.confidence) - confidenceRank(a.confidence);
      if (confidenceDelta !== 0) {
        return confidenceDelta;
      }
      return a.id.localeCompare(b.id);
    });
}

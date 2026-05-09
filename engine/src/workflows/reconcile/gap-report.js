// @ts-nocheck
import path from "node:path";

import { stableStringify } from "../../format.js";
import { ensureTrailingNewline } from "../../text-helpers.js";
import { tryLoadResolvedGraph, scanDocsWorkflow } from "../docs.js";
import { importAppWorkflow } from "../import-app/index.js";
import { normalizeWorkspacePaths, readJsonIfExists } from "../shared.js";
import {
  buildTopogramApiCapabilityIndex,
  collectCanonicalActorRoleSurface,
  collectCanonicalUiSurface,
  collectCanonicalWorkflowSurface,
  compareApiCapabilityFields,
  compareEntityFields,
  matchImportedApiCapability,
  summarizeGapCandidates
} from "./canonical-surface.js";

export function loadImportArtifacts(paths, inputPath) {
  const dbCandidates = readJsonIfExists(path.join(paths.topogramRoot, "candidates", "app", "db", "candidates.json"));
  const apiCandidates = readJsonIfExists(path.join(paths.topogramRoot, "candidates", "app", "api", "candidates.json"));
  const uiCandidates = readJsonIfExists(path.join(paths.topogramRoot, "candidates", "app", "ui", "candidates.json"));
  const workflowCandidates = readJsonIfExists(path.join(paths.topogramRoot, "candidates", "app", "workflows", "candidates.json"));
  const verificationCandidates = readJsonIfExists(path.join(paths.topogramRoot, "candidates", "app", "verification", "candidates.json"));
  const docsReport = readJsonIfExists(path.join(paths.topogramRoot, "candidates", "docs", "import-report.json"));
  if (dbCandidates || apiCandidates || uiCandidates || workflowCandidates || verificationCandidates || docsReport) {
    return {
      type: "import_app_report",
      workspace: paths.workspaceRoot,
      candidates: {
        db: dbCandidates || { entities: [], enums: [], relations: [], indexes: [] },
        api: apiCandidates || { capabilities: [], routes: [], stacks: [] },
        ui: uiCandidates || { screens: [], routes: [], actions: [], stacks: [] },
        workflows: workflowCandidates || { workflows: [], workflow_states: [], workflow_transitions: [] },
        verification: verificationCandidates || { verifications: [], scenarios: [], frameworks: [], scripts: [] },
        docs: docsReport?.candidate_docs || [],
        actors: docsReport?.candidate_actors || [],
        roles: docsReport?.candidate_roles || []
      }
    };
  }
  const imported = importAppWorkflow(inputPath, { from: "db,api,ui,workflows,verification" }).summary;
  const docsSummary = scanDocsWorkflow(inputPath).summary;
  imported.candidates.docs = docsSummary.candidate_docs || [];
  imported.candidates.actors = docsSummary.candidate_actors || [];
  imported.candidates.roles = docsSummary.candidate_roles || [];
  return imported;
}

export function reportGapsWorkflow(inputPath) {
  const paths = normalizeWorkspacePaths(inputPath);
  const graph = tryLoadResolvedGraph(paths.topogramRoot);
  const scan = graph ? scanDocsWorkflow(paths.topogramRoot).summary : { candidate_docs: [] };
  const appImport = loadImportArtifacts(paths, inputPath);

  const importedDb = appImport.candidates.db || { entities: [], enums: [], relations: [], indexes: [] };
  const importedApi = appImport.candidates.api || { capabilities: [], routes: [], stacks: [] };
  const importedUi = appImport.candidates.ui || { screens: [], routes: [], actions: [], stacks: [] };
  const importedWorkflows = appImport.candidates.workflows || { workflows: [], workflow_states: [], workflow_transitions: [] };
  const importedActors = appImport.candidates.actors || [];
  const importedRoles = appImport.candidates.roles || [];

  if (!graph) {
    const report = {
      type: "gap_report",
      workspace: paths.workspaceRoot,
      bootstrapped_topogram_root: paths.bootstrappedTopogramRoot,
      topogram_available: false,
      imported: {
        db: {
          entity_count: importedDb.entities.length,
          enum_count: importedDb.enums.length,
          relation_count: importedDb.relations.length
        },
        api: {
          capability_count: importedApi.capabilities.length,
          route_count: importedApi.routes.length
        },
        ui: {
          screen_count: importedUi.screens.length,
          route_count: importedUi.routes.length
        },
        workflows: {
          workflow_count: importedWorkflows.workflows.length,
          transition_count: importedWorkflows.workflow_transitions.length
        },
        actors_roles: {
          actor_count: importedActors.length,
          role_count: importedRoles.length
        }
      }
    };
    const files = {
      "candidates/reports/gap-report.json": `${stableStringify(report)}\n`,
      "candidates/reports/gap-report.md": ensureTrailingNewline(
        `# Gap Report\n\nNo canonical Topogram was found.\n\n- Imported DB entities: ${importedDb.entities.length}\n- Imported DB enums: ${importedDb.enums.length}\n- Imported API capabilities: ${importedApi.capabilities.length}\n- Imported API routes: ${importedApi.routes.length}\n- Imported UI screens: ${importedUi.screens.length}\n- Imported workflows: ${importedWorkflows.workflows.length}\n- Imported actors: ${importedActors.length}\n- Imported roles: ${importedRoles.length}\n`
      )
    };
    return {
      summary: report,
      files,
      defaultOutDir: paths.topogramRoot
    };
  }

  const glossaryDocs = new Set((graph.docs || []).filter((doc) => doc.kind === "glossary").map((doc) => doc.id));
  const workflowDocs = (graph.docs || []).filter((doc) => doc.kind === "workflow");
  const canonicalUi = collectCanonicalUiSurface(graph);
  const canonicalWorkflow = collectCanonicalWorkflowSurface(graph);
  const canonicalActorRole = collectCanonicalActorRoleSurface(graph);
  const entityMap = new Map((graph.byKind.entity || []).map((entity) => [entity.id.replace(/^entity_/, ""), entity]));
  const enumMap = new Map((graph.byKind.enum || []).map((entry) => [entry.id, entry]));
  const topogramApiCapabilities = buildTopogramApiCapabilityIndex(graph);
  const capabilityIds = new Set(topogramApiCapabilities.map((capability) => capability.id));
  const canonicalActorIds = new Set(canonicalActorRole.actor_ids);
  const canonicalRoleIds = new Set(canonicalActorRole.role_ids);
  const capabilityById = new Map((graph.byKind.capability || []).map((entry) => [entry.id, entry]));

  const missingGlossary = [...entityMap.keys()].filter((id) => !glossaryDocs.has(id));
  const missingWorkflowDocs = (graph.byKind.capability || [])
    .filter((capability) => [...capability.creates, ...capability.updates, ...capability.deletes].length > 0)
    .filter((capability) => !workflowDocs.some((doc) => doc.relatedCapabilities.includes(capability.id)))
    .map((capability) => capability.id);

  const dbEntitiesMissing = [];
  const dbFieldMismatches = [];
  for (const candidate of importedDb.entities || []) {
    const canonicalId = candidate.id_hint.replace(/^entity_/, "");
    const graphEntity = entityMap.get(canonicalId);
    if (!graphEntity) {
      dbEntitiesMissing.push(canonicalId);
      continue;
    }
    const mismatch = compareEntityFields(candidate, graphEntity);
    if (mismatch.missing.length || mismatch.typeMismatches.length || mismatch.requiredMismatches.length) {
      dbFieldMismatches.push({
        entity: canonicalId,
        missing_fields_in_topogram: mismatch.missing,
        type_mismatches: mismatch.typeMismatches,
        required_mismatches: mismatch.requiredMismatches
      });
    }
  }

  const dbEnumsMissing = [];
  const dbEnumValueMismatches = [];
  for (const candidate of importedDb.enums || []) {
    const graphEnum = enumMap.get(candidate.id_hint);
    if (!graphEnum) {
      dbEnumsMissing.push(candidate.id_hint);
      continue;
    }
    const graphValues = new Set((graphEnum.values || []).map((value) => value.id || value));
    const missingValues = (candidate.values || []).filter((value) => !graphValues.has(value));
    if (missingValues.length > 0) {
      dbEnumValueMismatches.push({
        enum: candidate.id_hint,
        missing_values_in_topogram: missingValues
      });
    }
  }

  const importedCapabilitiesMissing = [];
  const importedEndpointsWithoutMatchingCapabilities = [];
  const apiFieldMismatches = [];
  const matchedTopogramCapabilities = new Set();
  for (const entry of importedApi.capabilities || []) {
    const match = matchImportedApiCapability(entry, topogramApiCapabilities);
    if (!match) {
      importedCapabilitiesMissing.push(entry.id_hint);
      importedEndpointsWithoutMatchingCapabilities.push({
        capability: entry.id_hint,
        method: entry.endpoint?.method || null,
        path: entry.endpoint?.path || null
      });
      continue;
    }
    matchedTopogramCapabilities.add(match.id);
    const fieldMismatch = compareApiCapabilityFields(entry, match);
    if (
      fieldMismatch.missing_input_fields_in_topogram.length > 0 ||
      fieldMismatch.missing_output_fields_in_topogram.length > 0 ||
      fieldMismatch.missing_path_params_in_topogram.length > 0 ||
      fieldMismatch.missing_query_params_in_topogram.length > 0
    ) {
      apiFieldMismatches.push({
        capability: match.id,
        imported_capability: entry.id_hint,
        method: entry.endpoint?.method || null,
        path: entry.endpoint?.path || null,
        ...fieldMismatch
      });
    }
  }
  const topogramCapabilitiesWithoutImportedEndpointEvidence = topogramApiCapabilities
    .filter((capability) => !matchedTopogramCapabilities.has(capability.id))
    .map((capability) => capability.id);

  const scannedTermsMissingInGlossary = (scan.candidate_docs || [])
    .filter((doc) => doc.kind === "glossary")
    .map((doc) => doc.id)
    .filter((id) => entityMap.has(id) && !glossaryDocs.has(id));

  const importedScreensMissing = (importedUi.screens || [])
    .map((screen) => screen.id_hint)
    .filter((id) => !canonicalUi.screens.includes(id));
  const importedUiRoutesMissing = (importedUi.routes || [])
    .map((route) => route.path)
    .filter((route) => !canonicalUi.routes.includes(route));

  const importedWorkflowsMissing = (importedWorkflows.workflows || [])
    .map((workflow) => workflow.id_hint)
    .filter((id) => !canonicalWorkflow.workflow_docs.includes(id));
  const importedWorkflowTransitionsMissing = (importedWorkflows.workflow_transitions || []).map((transition) => ({
    workflow: transition.workflow_id,
    capability: transition.capability_id,
    to_state: transition.to_state
  }));

  const actorGapCandidates = summarizeGapCandidates(importedActors.filter((entry) => !canonicalActorIds.has(entry.id_hint)));
  const roleGapCandidates = summarizeGapCandidates(importedRoles.filter((entry) => !canonicalRoleIds.has(entry.id_hint)));
  const importedActorsMissing = importedActors
    .map((entry) => entry.id_hint)
    .filter((id) => !canonicalActorIds.has(id));
  const importedRolesMissing = importedRoles
    .map((entry) => entry.id_hint)
    .filter((id) => !canonicalRoleIds.has(id));
  const securedCapabilitiesWithoutCanonicalRoles = [];
  for (const entry of importedApi.capabilities || []) {
    if (entry.auth_hint !== "secured") {
      continue;
    }
    const match = matchImportedApiCapability(entry, topogramApiCapabilities);
    if (!match) {
      continue;
    }
    const canonicalCapability = capabilityById.get(match.id);
    if (!canonicalCapability || (canonicalCapability.roles || []).length > 0) {
      continue;
    }
    securedCapabilitiesWithoutCanonicalRoles.push(match.id);
  }
  const journeyDocsMissingActorLinks = canonicalActorRole.journey_docs
    .filter((doc) => (doc.relatedActors || []).length === 0)
    .filter((doc) => importedActors.some((entry) => (entry.related_docs || []).includes(doc.id)))
    .map((doc) => doc.id);
  const journeyDocsMissingRoleLinks = canonicalActorRole.journey_docs
    .filter((doc) => (doc.relatedRoles || []).length === 0)
    .filter((doc) => importedRoles.some((entry) => (entry.related_docs || []).includes(doc.id)))
    .map((doc) => doc.id);
  const workflowDocsMissingActorLinks = canonicalActorRole.workflow_docs
    .filter((doc) => (doc.relatedActors || []).length === 0)
    .filter((doc) => importedActors.some((entry) => (entry.related_docs || []).includes(doc.id)))
    .map((doc) => doc.id);
  const workflowDocsMissingRoleLinks = canonicalActorRole.workflow_docs
    .filter((doc) => (doc.relatedRoles || []).length === 0)
    .filter((doc) => importedRoles.some((entry) => (entry.related_docs || []).includes(doc.id)))
    .map((doc) => doc.id);

  const report = {
    type: "gap_report",
    workspace: paths.workspaceRoot,
    bootstrapped_topogram_root: paths.bootstrappedTopogramRoot,
    topogram_available: true,
    docs_vs_topogram: {
      missing_glossary_docs: missingGlossary,
      missing_workflow_docs: missingWorkflowDocs,
      scanned_terms_missing_in_glossary: scannedTermsMissingInGlossary
    },
    db_vs_topogram: {
      entities_missing_in_topogram: dbEntitiesMissing,
      field_mismatches: dbFieldMismatches,
      enums_missing_in_topogram: dbEnumsMissing,
      enum_value_mismatches: dbEnumValueMismatches
    },
    api_vs_topogram: {
      capabilities_missing_in_topogram: importedCapabilitiesMissing,
      endpoints_without_matching_capabilities: importedEndpointsWithoutMatchingCapabilities,
      field_mismatches: apiFieldMismatches,
      topogram_capabilities_without_imported_endpoint_evidence: topogramCapabilitiesWithoutImportedEndpointEvidence
    },
    ui_vs_topogram: {
      screens_missing_in_topogram: importedScreensMissing,
      routes_missing_in_topogram: importedUiRoutesMissing
    },
    workflows_vs_topogram: {
      workflows_missing_in_topogram: importedWorkflowsMissing,
      transitions_without_canonical_workflow_representation: importedWorkflowTransitionsMissing
    },
    actors_roles_vs_topogram: {
      actors_missing_in_topogram: importedActorsMissing,
      actor_gap_candidates: actorGapCandidates,
      roles_missing_in_topogram: importedRolesMissing,
      role_gap_candidates: roleGapCandidates,
      secured_capabilities_without_canonical_roles: [...new Set(securedCapabilitiesWithoutCanonicalRoles)].sort(),
      journey_docs_missing_actor_links: journeyDocsMissingActorLinks,
      journey_docs_missing_role_links: journeyDocsMissingRoleLinks,
      workflow_docs_missing_actor_links: workflowDocsMissingActorLinks,
      workflow_docs_missing_role_links: workflowDocsMissingRoleLinks
    }
  };

  const files = {
    "candidates/reports/gap-report.json": `${stableStringify(report)}\n`,
    "candidates/reports/gap-report.md": ensureTrailingNewline(
      `# Gap Report\n\n## Docs vs Topogram\n\n- Missing glossary docs: ${missingGlossary.length}\n- Missing workflow docs: ${missingWorkflowDocs.length}\n- Scanned terms not in glossary: ${scannedTermsMissingInGlossary.length}\n\n## DB vs Topogram\n\n- Imported entities missing in Topogram: ${dbEntitiesMissing.length}\n- Imported field mismatches: ${dbFieldMismatches.length}\n- Imported enums missing in Topogram: ${dbEnumsMissing.length}\n- Imported enum value mismatches: ${dbEnumValueMismatches.length}\n\n## API vs Topogram\n\n- Imported capabilities missing in Topogram: ${importedCapabilitiesMissing.length}\n- Imported endpoints without matching capabilities: ${importedEndpointsWithoutMatchingCapabilities.length}\n- Topogram capabilities without imported endpoint evidence: ${topogramCapabilitiesWithoutImportedEndpointEvidence.length}\n\n## UI vs Topogram\n\n- Imported screens missing in Topogram: ${importedScreensMissing.length}\n- Imported routes missing in Topogram: ${importedUiRoutesMissing.length}\n\n## Workflows vs Topogram\n\n- Imported workflows missing in Topogram: ${importedWorkflowsMissing.length}\n- Imported transitions without canonical workflow representation: ${importedWorkflowTransitionsMissing.length}\n\n## Actors/Roles vs Topogram\n\n- Imported actors missing in Topogram: ${importedActorsMissing.length}\n- Imported roles missing in Topogram: ${importedRolesMissing.length}\n- Secured capabilities without canonical roles: ${securedCapabilitiesWithoutCanonicalRoles.length}\n- Journey docs missing actor links: ${journeyDocsMissingActorLinks.length}\n- Journey docs missing role links: ${journeyDocsMissingRoleLinks.length}\n- Workflow docs missing actor links: ${workflowDocsMissingActorLinks.length}\n- Workflow docs missing role links: ${workflowDocsMissingRoleLinks.length}\n\n### Ranked Missing Actors\n\n${actorGapCandidates.length ? actorGapCandidates.map((entry) => `- \`${entry.id}\` (${entry.confidence})${entry.inference ? ` ${entry.inference}` : ""}`).join("\n") : "- None"}\n\n### Ranked Missing Roles\n\n${roleGapCandidates.length ? roleGapCandidates.map((entry) => `- \`${entry.id}\` (${entry.confidence})${entry.inference ? ` ${entry.inference}` : ""}`).join("\n") : "- None"}\n`
    )
  };

  return {
    summary: report,
    files,
    defaultOutDir: paths.topogramRoot
  };
}

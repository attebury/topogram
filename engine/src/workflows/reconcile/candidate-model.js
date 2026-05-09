// @ts-check
import { buildBundleDocDriftSummaries as buildBundleDocDriftSummariesReconcile, buildBundleDocMetadataPatches as buildBundleDocMetadataPatchesReconcile } from "../../reconcile/docs.js";
import { canonicalCandidateTerm, idHintify, titleCase } from "../../text-helpers.js";
import { confidenceRank, docDirForKind, renderCandidateActor, renderCandidateRole } from "../docs.js";
import { inferCapabilityEntityId } from "../import-app/index.js";
import { readTextIfExists, renderMarkdownDoc } from "../shared.js";
import {
  annotateDocLinkSuggestionsWithAuthRoleGuidance,
  classifyBundleAuthRoleGuidance,
  inferBundleAuthClaimHints,
  inferBundleAuthOwnershipHints,
  inferBundleAuthPermissionHints,
  inferBundleAuthRoleGuidance
} from "./auth.js";
import { collectBundleCapabilityIds, collectBundleDocIds, collectBundleProvenance, contextualEvidenceScore, provenanceList } from "./bundle-shared.js";
import { addBundleJourneyDrafts, buildBundleMergeHints, bundleLabelFromConceptId, getOrCreateCandidateBundle, renderCandidateBundleReadme } from "./bundle-core.js";
import { buildTopogramApiCapabilityIndex, buildBundleDocLinkSuggestions, collectCanonicalUiSurface, collectCanonicalWorkflowSurface, matchImportedApiCapability } from "./canonical-surface.js";
import { buildBundleAdoptionPlan, buildCanonicalShapeIndex, buildProjectionEntityIndex, buildProjectionImpacts, buildProjectionPatchCandidates, buildUiImpacts, buildWorkflowImpacts } from "./impacts.js";
import {
  renderCandidateCapability,
  renderCandidateEntity,
  renderCandidateEnum,
  renderCandidateShape,
  renderCandidateUiReportDoc,
  renderCandidateVerification,
  renderCandidateWidget,
  renderCandidateWorkflowDecision,
  renderCandidateWorkflowDoc,
  renderDocLinkPatchDoc,
  renderDocMetadataPatchDoc,
  renderProjectionPatchDoc,
  shapeIdForCapability
} from "./renderers.js";

/** @param {CandidateBundle} bundle @returns {any} */
export function bundleNoiseSuppressionReason(bundle) {
  if ((bundle.actors || []).length > 0 || (bundle.roles || []).length > 0 || (bundle.capabilities || []).length > 0 || (bundle.workflows || []).length > 0 || (bundle.docs || []).length > 0 || (bundle.screens || []).length > 0) {
    return null;
  }
  const noiseEntities = (bundle.entities || []).filter((/** @type {any} */ entry) => entry.noise_candidate);
  if (noiseEntities.length === 0) {
    return null;
  }
  if (noiseEntities.length === (bundle.entities || []).length) {
    return noiseEntities[0].noise_reason || "Rails implementation-noise bundle.";
  }
  return null;
}

/** @param {Map<string, CandidateBundle>} bundles @param {WorkflowRecord} candidate @returns {any} */
export function bestContextBundleForCandidate(bundles, candidate) {
  const candidateProvenance = new Set(provenanceList(candidate.provenance));
  const relatedDocs = new Set(candidate.related_docs || []);
  const relatedCapabilities = new Set(candidate.related_capabilities || []);
  let best = null;
  for (const bundle of bundles.values()) {
    const evidenceScore = contextualEvidenceScore(bundle);
    if (evidenceScore === 0) {
      continue;
    }
    const provenanceOverlap = candidateProvenance.size > 0
      ? [...candidateProvenance].filter((/** @type {any} */ item) => collectBundleProvenance(bundle).has(item)).length
      : 0;
    const docLinkOverlap = relatedDocs.size > 0
      ? [...relatedDocs].filter((/** @type {any} */ item) => collectBundleDocIds(bundle).has(item)).length
      : 0;
    const capabilityLinkOverlap = relatedCapabilities.size > 0
      ? [...relatedCapabilities].filter((/** @type {any} */ item) => collectBundleCapabilityIds(bundle).has(item)).length
      : 0;
    if (provenanceOverlap === 0 && docLinkOverlap === 0 && capabilityLinkOverlap === 0) {
      continue;
    }
    const score = docLinkOverlap * 1000 + capabilityLinkOverlap * 750 + provenanceOverlap * 100 + evidenceScore;
    if (!best || score > best.score || (score === best.score && bundle.slug.localeCompare(best.bundle.slug) < 0)) {
      best = { bundle, score };
    }
  }
  return best?.bundle || null;
}

/** @param {ResolvedGraph} graph @param {ImportArtifacts} appImport @param {any} topogramRoot @returns {any} */
export function buildCandidateModelBundles(graph, appImport, topogramRoot) {
  const dbCandidates = appImport.candidates.db || { entities: [], enums: [] };
  const apiCandidates = appImport.candidates.api || { capabilities: [] };
  const uiCandidates = appImport.candidates.ui || { screens: [], routes: [], actions: [], widgets: [] };
  const uiWidgetCandidates = uiCandidates.widgets || uiCandidates.components || [];
  const workflowCandidates = appImport.candidates.workflows || { workflows: [], workflow_states: [], workflow_transitions: [] };
  const verificationCandidates = appImport.candidates.verification || { verifications: [], scenarios: [], frameworks: [], scripts: [] };
  const docCandidates = appImport.candidates.docs || [];
  const actorCandidates = appImport.candidates.actors || [];
  const roleCandidates = appImport.candidates.roles || [];
  const knownEnums = new Set((dbCandidates.enums || []).map((/** @type {any} */ entry) => entry.id_hint));
  const canonicalActorIds = new Set((graph?.byKind.actor || []).map((/** @type {any} */ entry) => entry.id));
  const canonicalRoleIds = new Set((graph?.byKind.role || []).map((/** @type {any} */ entry) => entry.id));
  const canonicalEntityIds = new Set((graph?.byKind.entity || []).map((/** @type {any} */ entry) => entry.id));
  const canonicalEnumIds = new Set((graph?.byKind.enum || []).map((/** @type {any} */ entry) => entry.id));
  const canonicalWidgetIds = new Set((graph?.byKind.widget || []).map((/** @type {any} */ entry) => entry.id));
  const canonicalUi = collectCanonicalUiSurface(graph || { byKind: { projection: [] } });
  const canonicalWorkflow = collectCanonicalWorkflowSurface(graph || { byKind: { decision: [] }, docs: [] });
  const canonicalDocsByKind = new Map();
  for (const doc of graph?.docs || []) {
    if (!canonicalDocsByKind.has(doc.kind)) {
      canonicalDocsByKind.set(doc.kind, new Set());
    }
    canonicalDocsByKind.get(doc.kind).add(doc.id);
  }
  const topogramApiCapabilities = graph ? buildTopogramApiCapabilityIndex(graph) : [];
  const canonicalShapeIndex = buildCanonicalShapeIndex(graph);
  const canonicalVerificationIds = new Set((graph?.byKind.verification || []).map((/** @type {any} */ entry) => entry.id));
  const projectionIndex = buildProjectionEntityIndex(graph);
  const bundles = new Map();
  const enumCandidatesById = new Map((dbCandidates.enums || []).map((/** @type {any} */ entry) => [entry.id_hint, entry]));
  const verificationScenariosByVerificationId = new Map();
  for (const scenario of verificationCandidates.scenarios || []) {
    const bucket = verificationScenariosByVerificationId.get(scenario.verification_id) || [];
    bucket.push(scenario);
    verificationScenariosByVerificationId.set(scenario.verification_id, bucket);
  }

  for (const entry of dbCandidates.enums || []) {
    if (canonicalEnumIds.has(entry.id_hint)) continue;
    getOrCreateCandidateBundle(bundles, `enum_${entry.id_hint}`, titleCase(entry.id_hint)).enums.push(entry);
  }
  for (const entry of dbCandidates.entities || []) {
    const bundle = getOrCreateCandidateBundle(bundles, entry.id_hint, entry.label);
    bundle.importedFieldEvidence = [
      ...(bundle.importedFieldEvidence || []),
      ...((entry.fields || []).map((/** @type {any} */ field) => ({
        entity_id: entry.id_hint,
        name: field.name,
        field_type: field.field_type,
        required: field.required
      })))
    ];
    if (!canonicalEntityIds.has(entry.id_hint)) {
      bundle.entities.push(entry);
    }
    for (const field of entry.fields || []) {
      const enumId = idHintify(field.field_type);
      const enumEntry = enumCandidatesById.get(enumId);
      if (!enumEntry || canonicalEnumIds.has(enumId)) {
        continue;
      }
      if (!bundle.enums.some((/** @type {any} */ candidate) => candidate.id_hint === enumId)) {
        bundle.enums.push(enumEntry);
      }
      bundles.delete(`enum_${enumId}`);
    }
  }
  for (const entry of apiCandidates.capabilities || []) {
    const matchedCapability = graph ? matchImportedApiCapability(entry, topogramApiCapabilities) : null;
    if (matchedCapability) {
      continue;
    }
    const conceptId = inferCapabilityEntityId(entry);
    const bundle = getOrCreateCandidateBundle(bundles, conceptId, titleCase(conceptId.replace(/^entity_/, "")));
    bundle.capabilities.push(entry);
    const inputFields = entry.input_fields || [];
    const outputFields = entry.output_fields || [];
    if (inputFields.length > 0) {
      bundle.shapes.push({
        id: shapeIdForCapability(entry, "input"),
        label: `${titleCase(entry.id_hint.replace(/^cap_/, ""))} Input`,
        fields: inputFields
      });
    }
    if (outputFields.length > 0) {
      bundle.shapes.push({
        id: shapeIdForCapability(entry, "output"),
        label: `${titleCase(entry.id_hint.replace(/^cap_/, ""))} Output`,
        fields: outputFields
      });
    }
  }
  for (const entry of uiCandidates.screens || []) {
    if (canonicalUi.screens.includes(entry.id_hint)) {
      continue;
    }
    const conceptId = entry.entity_id || entry.concept_id || `entity_${canonicalCandidateTerm(entry.id_hint)}`;
    const bundle = getOrCreateCandidateBundle(bundles, conceptId, bundleLabelFromConceptId(conceptId || entry.id_hint));
    bundle.screens.push(entry);
  }
  for (const entry of uiCandidates.routes || []) {
    if (canonicalUi.routes.includes(entry.path)) {
      continue;
    }
    const conceptId = entry.entity_id || entry.concept_id || `entity_${canonicalCandidateTerm(entry.screen_id || entry.id_hint)}`;
    const bundle = getOrCreateCandidateBundle(bundles, conceptId, bundleLabelFromConceptId(conceptId || entry.screen_id || entry.id_hint));
    bundle.uiRoutes.push(entry);
  }
  for (const entry of uiCandidates.actions || []) {
    const conceptId = entry.entity_id || entry.concept_id || `entity_${canonicalCandidateTerm(entry.screen_id || entry.id_hint)}`;
    const bundle = getOrCreateCandidateBundle(bundles, conceptId, bundleLabelFromConceptId(conceptId || entry.screen_id || entry.id_hint));
    bundle.uiActions.push(entry);
  }
  /** @param {WorkflowRecord} entry @returns {any} */
  function widgetConceptId(entry) {
    if (entry.entity_id || entry.concept_id) {
      return entry.entity_id || entry.concept_id;
    }
    const screenStem = String(entry.screen_id || entry.id_hint || "")
      .replace(/_(list|index|table|grid|results)$/, "")
      .replace(/^list_/, "");
    return `entity_${canonicalCandidateTerm(screenStem || entry.id_hint)}`;
  }

  for (const entry of uiWidgetCandidates) {
    if (canonicalWidgetIds.has(entry.id_hint)) {
      continue;
    }
    const conceptId = widgetConceptId(entry);
    const bundle = getOrCreateCandidateBundle(bundles, conceptId, bundleLabelFromConceptId(conceptId || entry.screen_id || entry.id_hint));
    bundle.widgets.push(entry);
  }
  for (const entry of workflowCandidates.workflows || []) {
    if (canonicalWorkflow.workflow_docs.includes(entry.id_hint)) {
      continue;
    }
    const bundle = getOrCreateCandidateBundle(bundles, entry.entity_id || `entity_${canonicalCandidateTerm(entry.id_hint)}`, titleCase((entry.entity_id || entry.id_hint).replace(/^entity_/, "")));
    bundle.workflows.push(entry);
  }
  for (const entry of workflowCandidates.workflow_states || []) {
    if (canonicalWorkflow.workflow_docs.includes(entry.workflow_id)) {
      continue;
    }
    const bundle = getOrCreateCandidateBundle(bundles, entry.entity_id || `entity_${canonicalCandidateTerm(entry.workflow_id || entry.id_hint)}`, titleCase((entry.entity_id || entry.workflow_id || entry.id_hint).replace(/^entity_/, "")));
    bundle.workflowStates.push(entry);
  }
  for (const entry of workflowCandidates.workflow_transitions || []) {
    if (canonicalWorkflow.workflow_docs.includes(entry.workflow_id)) {
      continue;
    }
    const bundle = getOrCreateCandidateBundle(bundles, entry.entity_id || `entity_${canonicalCandidateTerm(entry.workflow_id || entry.id_hint)}`, titleCase((entry.entity_id || entry.workflow_id || entry.id_hint).replace(/^entity_/, "")));
    bundle.workflowTransitions.push(entry);
  }
  for (const entry of verificationCandidates.verifications || []) {
    if (canonicalVerificationIds.has(entry.id_hint)) {
      continue;
    }
    const relatedCapabilityId =
      entry.related_capabilities?.[0] ||
      verificationScenariosByVerificationId.get(entry.id_hint)?.flatMap((/** @type {any} */ scenario) => scenario.related_capabilities || [])[0] ||
      null;
    const conceptId = relatedCapabilityId
      ? inferCapabilityEntityId({
          id_hint: relatedCapabilityId,
          endpoint: { path: `/${relatedCapabilityId.replace(/^cap_(create|get|update|delete|list|complete|close|approve|reject|request_revision|export|download)_/, "").replace(/_/g, "-")}` }
        })
      : `surface_${canonicalCandidateTerm(entry.id_hint)}`;
    const bundle = getOrCreateCandidateBundle(bundles, conceptId, bundleLabelFromConceptId(conceptId || entry.id_hint));
    bundle.verifications.push({
      ...entry,
      scenarios: verificationScenariosByVerificationId.get(entry.id_hint) || []
    });
  }
  for (const entry of docCandidates || []) {
    const hasCanonicalDoc = (canonicalDocsByKind.get(entry.kind) || new Set()).has(entry.id);
    const canonicalEntityHint = `entity_${canonicalCandidateTerm(entry.id)}`;
    const semanticallyAnchored =
      (entry.related_entities || []).length > 0 ||
      (entry.related_capabilities || []).length > 0 ||
      canonicalEntityIds.has(canonicalEntityHint);
    if (!semanticallyAnchored && entry.kind !== "workflow") {
      continue;
    }
    const conceptId = semanticallyAnchored
      ? (
          entry.related_entities?.[0] ||
          (entry.related_capabilities?.[0] ? inferCapabilityEntityId({ id_hint: entry.related_capabilities[0], endpoint: { path: `/${entry.related_capabilities[0].replace(/^cap_(create|get|update|delete|list)_/, "").replace(/_/g, "-")}` } }) : `entity_${canonicalCandidateTerm(entry.id)}`)
        )
      : `flow_${canonicalCandidateTerm(entry.id)}`;
    const bundle = getOrCreateCandidateBundle(bundles, conceptId, titleCase(conceptId.replace(/^(entity|flow)_/, "")));
    bundle.docs.push({
      ...entry,
      existing_canonical: hasCanonicalDoc
    });
  }
  for (const entry of actorCandidates || []) {
    if (canonicalActorIds.has(entry.id_hint)) continue;
    const contextualBundle = bestContextBundleForCandidate(bundles, entry);
    (contextualBundle || getOrCreateCandidateBundle(bundles, entry.id_hint, entry.label)).actors.push(entry);
  }
  for (const entry of roleCandidates || []) {
    if (canonicalRoleIds.has(entry.id_hint)) continue;
    const contextualBundle = bestContextBundleForCandidate(bundles, entry);
    (contextualBundle || getOrCreateCandidateBundle(bundles, entry.id_hint, entry.label)).roles.push(entry);
  }

  addBundleJourneyDrafts(bundles, graph);

  /** @type {any[]} */

  const suppressedNoiseBundles = [];
  const finalizedBundles = [...bundles.values()]
    .filter((/** @type {any} */ bundle) =>
      bundle.actors.length > 0 ||
      bundle.roles.length > 0 ||
      bundle.entities.length > 0 ||
      bundle.enums.length > 0 ||
      bundle.capabilities.length > 0 ||
      bundle.shapes.length > 0 ||
      bundle.widgets.length > 0 ||
      bundle.screens.length > 0 ||
      bundle.uiRoutes.length > 0 ||
      bundle.uiActions.length > 0 ||
      bundle.workflows.length > 0 ||
      bundle.verifications.length > 0 ||
      bundle.workflowStates.length > 0 ||
      bundle.workflowTransitions.length > 0
    )
    .map((/** @type {any} */ bundle) => {
      const sortedBundle = {
        ...bundle,
        actors: bundle.actors.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id_hint.localeCompare(b.id_hint)),
        roles: bundle.roles.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id_hint.localeCompare(b.id_hint)),
        entities: bundle.entities.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id_hint.localeCompare(b.id_hint)),
        enums: bundle.enums.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id_hint.localeCompare(b.id_hint)),
        capabilities: bundle.capabilities.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id_hint.localeCompare(b.id_hint)),
        shapes: bundle.shapes.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id.localeCompare(b.id)),
        widgets: bundle.widgets.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id_hint.localeCompare(b.id_hint)),
        screens: bundle.screens.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id_hint.localeCompare(b.id_hint)),
        uiRoutes: bundle.uiRoutes.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id_hint.localeCompare(b.id_hint)),
        uiActions: bundle.uiActions.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id_hint.localeCompare(b.id_hint)),
        workflows: bundle.workflows.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id_hint.localeCompare(b.id_hint)),
        verifications: bundle.verifications.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id_hint.localeCompare(b.id_hint)),
        workflowStates: bundle.workflowStates.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id_hint.localeCompare(b.id_hint)),
        workflowTransitions: bundle.workflowTransitions.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id_hint.localeCompare(b.id_hint)),
        docs: bundle.docs.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id.localeCompare(b.id))
      };
      const mergeHints = buildBundleMergeHints(sortedBundle, canonicalEntityIds);
      const projectionImpacts = buildProjectionImpacts({ ...sortedBundle, mergeHints }, projectionIndex);
      const uiImpacts = buildUiImpacts(sortedBundle, graph);
      const workflowImpacts = buildWorkflowImpacts(sortedBundle, graph);
      const authPermissionHints = inferBundleAuthPermissionHints(sortedBundle);
      const authClaimHints = inferBundleAuthClaimHints(sortedBundle);
      const authOwnershipHints = inferBundleAuthOwnershipHints(sortedBundle);
      const authRoleGuidance = inferBundleAuthRoleGuidance({
        ...sortedBundle,
        authPermissionHints,
        authClaimHints,
        authOwnershipHints
      });
      const docLinkSuggestions = buildBundleDocLinkSuggestions(sortedBundle, graph);
      const enrichedBundle = {
        ...sortedBundle,
        mergeHints,
        projectionImpacts,
        uiImpacts,
        workflowImpacts,
        authPermissionHints,
        authClaimHints,
        authOwnershipHints,
        authRoleGuidance,
        docLinkSuggestions,
        docDriftSummaries: buildBundleDocDriftSummariesReconcile(sortedBundle, graph, topogramRoot, confidenceRank, readTextIfExists),
        docMetadataPatches: []
      };
      const projectionPatches = buildProjectionPatchCandidates(enrichedBundle);
      const adoptionPlan = buildBundleAdoptionPlan({ ...enrichedBundle, projectionPatches }, canonicalShapeIndex);
      const classifiedAuthRoleGuidance = classifyBundleAuthRoleGuidance({ ...enrichedBundle, projectionPatches, adoptionPlan });
      return {
        ...enrichedBundle,
        authRoleGuidance: classifiedAuthRoleGuidance,
        docLinkSuggestions: annotateDocLinkSuggestionsWithAuthRoleGuidance(docLinkSuggestions, classifiedAuthRoleGuidance),
        projectionPatches,
        adoptionPlan
      };
    })
    .map((/** @type {any} */ bundle) => ({
      ...bundle,
      docMetadataPatches: buildBundleDocMetadataPatchesReconcile(bundle, confidenceRank)
    }))
    .filter((/** @type {any} */ bundle) => {
      const reason = bundleNoiseSuppressionReason(bundle);
      if (!reason) {
        return true;
      }
      suppressedNoiseBundles.push({
        slug: bundle.slug,
        id: bundle.id,
        reason
      });
      return false;
    })
    .sort((/** @type {any} */ a, /** @type {any} */ b) => a.slug.localeCompare(b.slug));
  return { bundles: finalizedBundles, suppressedNoiseBundles };
}

/** @param {ResolvedGraph} graph @param {ImportArtifacts} appImport @param {any} topogramRoot @returns {any} */
export function buildCandidateModelFiles(graph, appImport, topogramRoot) {
  /** @type {WorkflowFiles} */
  /** @type {WorkflowFiles} */
  const files = {};
  const { bundles, suppressedNoiseBundles } = buildCandidateModelBundles(graph, appImport, topogramRoot);
  const knownEnums = new Set(
    bundles.flatMap((/** @type {any} */ bundle) => bundle.enums.map((/** @type {any} */ entry) => entry.id_hint))
  );

  for (const bundle of bundles) {
    const bundleRoot = `candidates/reconcile/model/bundles/${bundle.slug}`;
    files[`${bundleRoot}/README.md`] = renderCandidateBundleReadme(bundle);
    for (const entry of bundle.actors) {
      files[`${bundleRoot}/actors/${entry.id_hint}.tg`] = renderCandidateActor(entry);
    }
    for (const entry of bundle.roles) {
      files[`${bundleRoot}/roles/${entry.id_hint}.tg`] = renderCandidateRole(entry);
    }
    for (const entry of bundle.enums) {
      files[`${bundleRoot}/enums/${entry.id_hint}.tg`] = renderCandidateEnum(entry);
    }
    for (const entry of bundle.entities) {
      files[`${bundleRoot}/entities/${entry.id_hint}.tg`] = renderCandidateEntity(entry, knownEnums);
    }
    for (const shape of bundle.shapes) {
      files[`${bundleRoot}/shapes/${shape.id}.tg`] = renderCandidateShape(shape.id, shape.label, shape.fields);
    }
    for (const entry of bundle.capabilities) {
      const inputShapeId = bundle.shapes.find((/** @type {any} */ shape) => shape.id === shapeIdForCapability(entry, "input")) ? shapeIdForCapability(entry, "input") : null;
      const outputShapeId = bundle.shapes.find((/** @type {any} */ shape) => shape.id === shapeIdForCapability(entry, "output")) ? shapeIdForCapability(entry, "output") : null;
      files[`${bundleRoot}/capabilities/${entry.id_hint}.tg`] = renderCandidateCapability(entry, inputShapeId, outputShapeId);
    }
    for (const entry of bundle.verifications || []) {
      files[`${bundleRoot}/verifications/${entry.id_hint}.tg`] = renderCandidateVerification(entry, entry.scenarios || []);
    }
    for (const entry of bundle.widgets || []) {
      files[`${bundleRoot}/widgets/${entry.id_hint}.tg`] = renderCandidateWidget(entry);
    }
    for (const entry of bundle.docs) {
      if (entry.existing_canonical) {
        continue;
      }
      const docDir = docDirForKind(entry.kind);
      files[`${bundleRoot}/docs/${docDir}/${entry.id}.md`] = renderMarkdownDoc(
        entry.metadata || {
          id: entry.id,
          kind: entry.kind,
          title: entry.title,
          status: "inferred",
          source_of_truth: entry.source_of_truth || "imported",
          confidence: entry.confidence || "low",
          review_required: true,
          related_entities: entry.related_entities || [],
          related_capabilities: entry.related_capabilities || [],
          related_actors: entry.related_actors || [],
          related_roles: entry.related_roles || [],
          related_rules: entry.related_rules || [],
          related_workflows: entry.related_workflows || [],
          provenance: entry.provenance || [],
          tags: entry.tags || ["import", entry.kind]
        },
        entry.body || "Candidate imported doc."
      );
    }
    for (const entry of bundle.workflows) {
      const states = bundle.workflowStates.filter((/** @type {any} */ state) => state.workflow_id === entry.id_hint);
      const transitions = bundle.workflowTransitions.filter((/** @type {any} */ transition) => transition.workflow_id === entry.id_hint);
      files[`${bundleRoot}/docs/workflows/${entry.id_hint}.md`] = renderCandidateWorkflowDoc(entry, states, transitions);
      files[`${bundleRoot}/decisions/dec_${entry.id_hint.replace(/^workflow_/, "")}.tg`] = renderCandidateWorkflowDecision(entry, states, transitions);
    }
    for (const screen of bundle.screens) {
      const routes = bundle.uiRoutes.filter((/** @type {any} */ route) => route.screen_id === screen.id_hint);
      const actions = bundle.uiActions.filter((/** @type {any} */ action) => action.screen_id === screen.id_hint);
      files[`${bundleRoot}/docs/reports/ui-${screen.id_hint}.md`] = renderCandidateUiReportDoc(screen, routes, actions);
    }
    for (const patch of bundle.projectionPatches || []) {
      files[`${bundleRoot}/${patch.patch_rel_path}`] = renderProjectionPatchDoc(patch);
    }
    for (const patch of bundle.docLinkSuggestions || []) {
      files[`${bundleRoot}/${patch.patch_rel_path}`] = renderDocLinkPatchDoc(patch);
    }
    for (const patch of bundle.docMetadataPatches || []) {
      files[`${bundleRoot}/${patch.patch_rel_path}`] = renderDocMetadataPatchDoc(patch);
    }
  }

  return { files, bundles, suppressedNoiseBundles };
}

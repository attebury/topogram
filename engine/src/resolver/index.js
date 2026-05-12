import { buildRegistry, validateWorkspace } from "../validator.js";
import { loadArchive, mergeArchivedIntoGraph } from "../archive/resolver-bridge.js";
import { enrichPitch } from "./enrich/pitch.js";
import { enrichRequirement } from "./enrich/requirement.js";
import { enrichAcceptanceCriterion } from "./enrich/acceptance-criterion.js";
import { enrichTask } from "./enrich/task.js";
import { enrichBug } from "./enrich/bug.js";
import { normalizeStatement } from "./normalize.js";
import { groupBy } from "./shared.js";
import { buildShapeTransformGraph, projectShapeFields } from "./shapes.js";
import { buildWidgetContract } from "./widgets.js";
import {
  buildCapabilityFlow,
  buildDecisionRecord,
  buildOperationMonitoring,
  buildOrchestrationPlan,
  buildProjectionPlan,
  buildRulePolicy,
  buildTermVocabulary,
  buildVerificationPlan
} from "./plans.js";

export { normalizeStatement } from "./normalize.js";

function normalizeDoc(doc) {
  return {
    id: doc.metadata.id,
    kind: doc.metadata.kind,
    title: doc.metadata.title,
    status: doc.metadata.status,
    summary: doc.metadata.summary || null,
    successOutcome: doc.metadata.success_outcome || null,
    aliases: [...(doc.metadata.aliases || [])],
    actors: [...(doc.metadata.actors || [])],
    relatedEntities: [...(doc.metadata.related_entities || [])],
    relatedCapabilities: [...(doc.metadata.related_capabilities || [])],
    relatedActors: [...(doc.metadata.related_actors || [])],
    relatedRoles: [...(doc.metadata.related_roles || [])],
    relatedRules: [...(doc.metadata.related_rules || [])],
    relatedWorkflows: [...(doc.metadata.related_workflows || [])],
    relatedShapes: [...(doc.metadata.related_shapes || [])],
    relatedProjections: [...(doc.metadata.related_projections || [])],
    relatedDocs: [...(doc.metadata.related_docs || [])],
    sourceOfTruth: doc.metadata.source_of_truth || null,
    confidence: doc.metadata.confidence || null,
    reviewRequired: doc.metadata.review_required ?? false,
    provenance: [...(doc.metadata.provenance || [])],
    tags: [...(doc.metadata.tags || [])],
    domain: doc.metadata.domain || null,
    appVersion: doc.metadata.app_version || null,
    audience: doc.metadata.audience || null,
    priority: doc.metadata.priority || null,
    version: doc.metadata.version || null,
    affects: [...(doc.metadata.affects || [])],
    satisfies: [...(doc.metadata.satisfies || [])],
    approvals: [...(doc.metadata.approvals || [])],
    file: doc.file,
    relativePath: doc.relativePath,
    body: doc.body
  };
}

export function resolveWorkspace(workspaceAst) {
  const validation = validateWorkspace(workspaceAst);
  if (!validation.ok) {
    return {
      ok: false,
      validation
    };
  }

  const archive = loadArchive(workspaceAst.root);
  if (archive.errors.length > 0) {
    const archiveErrors = archive.errors.map((message) => ({
      message: `Invalid SDLC archive: ${message}`,
      loc: {
        file: workspaceAst.root,
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 1, offset: 0 }
      }
    }));
    return {
      ok: false,
      validation: {
        ...validation,
        ok: false,
        errorCount: validation.errorCount + archiveErrors.length,
        errors: [...validation.errors, ...archiveErrors]
      }
    };
  }

  const errors = [];
  const registry = buildRegistry(workspaceAst, errors);
  const statements = workspaceAst.files.flatMap((file) => file.statements);
  const resolvedStatements = statements.map((statement) => normalizeStatement(statement, registry));
  const byId = new Map(resolvedStatements.map((statement) => [statement.id, statement]));

  // Build domain.members back-links by reverse-indexing tagged statements.
  // Members are grouped per kind so consumers can ask for `domain.members.capabilities`
  // without re-walking the registry. Phase 2 extends with SDLC kinds; documents
  // are folded in below from workspaceAst.docs[].metadata.domain.
  const domainMembersById = new Map();
  for (const statement of resolvedStatements) {
    if (statement.kind === "domain") {
      domainMembersById.set(statement.id, {
        capabilities: [],
        entities: [],
        rules: [],
        verifications: [],
        orchestrations: [],
        operations: [],
        decisions: [],
        journeys: [],
        pitches: [],
        requirements: [],
        tasks: [],
        plans: [],
        bugs: [],
        documents: []
      });
    }
  }
  const memberKindToBucket = {
    capability: "capabilities",
    entity: "entities",
    rule: "rules",
    verification: "verifications",
    orchestration: "orchestrations",
    operation: "operations",
    decision: "decisions",
    journey: "journeys",
    pitch: "pitches",
    requirement: "requirements",
    task: "tasks",
    plan: "plans",
    bug: "bugs"
  };
  for (const statement of resolvedStatements) {
    const bucketKey = memberKindToBucket[statement.kind];
    if (!bucketKey || !statement.resolvedDomain) {
      continue;
    }
    const members = domainMembersById.get(statement.resolvedDomain.id);
    if (members) {
      members[bucketKey].push(statement.id);
    }
  }
  // Fold tagged documents into domain.members.documents.
  for (const doc of workspaceAst.docs || []) {
    if (doc.parseError) continue;
    const domainId = doc.metadata?.domain;
    if (!domainId) continue;
    const members = domainMembersById.get(domainId);
    if (members && doc.metadata.id) {
      members.documents.push(doc.metadata.id);
    }
  }
  for (const members of domainMembersById.values()) {
    for (const bucket of Object.values(members)) {
      bucket.sort();
    }
  }

  // Phase 2: build SDLC back-link indices in a single pass over the resolved
  // statements. Each index maps `targetId -> [sourceId,...]`.
  const sdlcIndex = {
    requirementsByPitch: new Map(),
    decisionsByPitch: new Map(),
    acsByRequirement: new Map(),
    tasksBySatisfiedRequirement: new Map(),
    tasksByAcceptanceRef: new Map(),
    verificationsByRequirementRef: new Map(),
    verificationsByAcceptanceRef: new Map(),
    verificationsFixingBug: new Map(),
    supersededByRequirements: new Map(),
    supersededByAcs: new Map(),
    documentsBySatisfies: new Map(),
    rulesByFromRequirement: new Map(),
    tasksThatBlockTarget: new Map(),
    tasksBlockedByTarget: new Map(),
    plansByTask: new Map(),
    affectedByPitches: new Map(),
    affectedByRequirements: new Map(),
    affectedByTasks: new Map(),
    affectedByBugs: new Map(),
    introducedRulesByRequirement: new Map(),
    respectedRulesByRequirement: new Map(),
    rulesViolatedByBug: new Map(),
    rulesSurfacedByBug: new Map(),
    decisionsIntroducedByTask: new Map()
  };
  function pushIndex(map, key, value) {
    if (!key || !value) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  }
  function pushIndexFromList(map, list, value) {
    if (!Array.isArray(list)) return;
    for (const ref of list) {
      const key = typeof ref === "string" ? ref : ref?.id;
      pushIndex(map, key, value);
    }
  }
  for (const statement of resolvedStatements) {
    switch (statement.kind) {
      case "requirement":
        pushIndex(sdlcIndex.requirementsByPitch, statement.pitch?.id, statement.id);
        pushIndexFromList(sdlcIndex.affectedByRequirements, statement.affects, statement.id);
        pushIndexFromList(sdlcIndex.introducedRulesByRequirement, statement.introducesRules, statement.id);
        pushIndexFromList(sdlcIndex.respectedRulesByRequirement, statement.respectsRules, statement.id);
        pushIndexFromList(sdlcIndex.supersededByRequirements, statement.supersedes, statement.id);
        break;
      case "acceptance_criterion":
        pushIndex(sdlcIndex.acsByRequirement, statement.requirement?.id, statement.id);
        pushIndexFromList(sdlcIndex.supersededByAcs, statement.supersedes, statement.id);
        break;
      case "decision":
        pushIndex(sdlcIndex.decisionsByPitch, statement.pitch?.id, statement.id);
        break;
      case "rule":
        pushIndex(sdlcIndex.rulesByFromRequirement, statement.fromRequirement?.id, statement.id);
        break;
      case "pitch":
        pushIndexFromList(sdlcIndex.affectedByPitches, statement.affects, statement.id);
        break;
      case "task":
        pushIndexFromList(sdlcIndex.affectedByTasks, statement.affects, statement.id);
        pushIndexFromList(sdlcIndex.tasksBySatisfiedRequirement, statement.satisfies, statement.id);
        pushIndexFromList(sdlcIndex.tasksByAcceptanceRef, statement.acceptanceRefs, statement.id);
        pushIndexFromList(sdlcIndex.decisionsIntroducedByTask, statement.introducesDecisions, statement.id);
        pushIndexFromList(sdlcIndex.tasksThatBlockTarget, statement.blocks, statement.id);
        pushIndexFromList(sdlcIndex.tasksBlockedByTarget, statement.blockedBy, statement.id);
        break;
      case "plan":
        pushIndex(sdlcIndex.plansByTask, statement.task?.id, statement.id);
        break;
      case "bug":
        pushIndexFromList(sdlcIndex.affectedByBugs, statement.affects, statement.id);
        pushIndexFromList(sdlcIndex.rulesViolatedByBug, statement.violates, statement.id);
        pushIndexFromList(sdlcIndex.rulesSurfacedByBug, statement.surfacesRule, statement.id);
        break;
      case "verification":
        pushIndexFromList(sdlcIndex.verificationsByRequirementRef, statement.requirementRefs, statement.id);
        pushIndexFromList(sdlcIndex.verificationsByAcceptanceRef, statement.acceptanceRefs, statement.id);
        pushIndexFromList(sdlcIndex.verificationsFixingBug, statement.fixesBugs, statement.id);
        break;
      default:
        break;
    }
  }
  // Documents `satisfies` frontmatter is folded in from workspaceAst.docs.
  for (const doc of workspaceAst.docs || []) {
    if (doc.parseError) continue;
    const satisfies = doc.metadata?.satisfies;
    if (!satisfies || !doc.metadata.id) continue;
    const ids = Array.isArray(satisfies) ? satisfies : [satisfies];
    for (const id of ids) {
      pushIndex(sdlcIndex.documentsBySatisfies, id, doc.metadata.id);
    }
  }

  const enrichedStatements = resolvedStatements.map((statement) => {
    switch (statement.kind) {
      case "shape":
        return {
          ...statement,
          projectedFields: projectShapeFields(statement, byId)
        };
      case "capability":
        return {
          ...statement,
          flow: buildCapabilityFlow(statement)
        };
    case "widget":
      return {
        ...statement,
          widgetContract: buildWidgetContract(statement)
        };
      case "rule":
        return {
          ...statement,
          policy: buildRulePolicy(statement)
        };
      case "decision":
        return {
          ...statement,
          record: buildDecisionRecord(statement)
        };
      case "projection":
        return {
          ...statement,
          plan: buildProjectionPlan(statement)
        };
      case "orchestration":
        return {
          ...statement,
          plan: buildOrchestrationPlan(statement)
        };
      case "verification":
        return {
          ...statement,
          plan: buildVerificationPlan(statement)
        };
      case "operation":
        return {
          ...statement,
          monitoring: buildOperationMonitoring(statement)
        };
      case "term":
        return {
          ...statement,
          vocabulary: buildTermVocabulary(statement)
        };
      case "domain":
        return {
          ...statement,
          members: domainMembersById.get(statement.id) || {
            capabilities: [],
            entities: [],
            rules: [],
            verifications: [],
            orchestrations: [],
            operations: [],
            decisions: [],
            journeys: [],
            pitches: [],
            requirements: [],
            tasks: [],
            bugs: [],
            documents: []
          }
        };
      case "pitch":
        return {
          ...statement,
          ...enrichPitch(statement, sdlcIndex)
        };
      case "requirement":
        return {
          ...statement,
          ...enrichRequirement(statement, sdlcIndex)
        };
      case "acceptance_criterion":
        return {
          ...statement,
          ...enrichAcceptanceCriterion(statement, sdlcIndex)
        };
      case "task":
        return {
          ...statement,
          ...enrichTask(statement, sdlcIndex)
        };
      case "bug":
        return {
          ...statement,
          ...enrichBug(statement, sdlcIndex)
        };
      default:
        return statement;
    }
  });

  // After per-kind enrichment, add `affectedBy*` lists onto the targets
  // (capability/entity/rule/projection/widget/orchestration/operation) and
  // the change-tracking lists onto the carrier kinds (rule, decision).
  const affectedByPitches = sdlcIndex.affectedByPitches;
  const affectedByRequirements = sdlcIndex.affectedByRequirements;
  const affectedByTasks = sdlcIndex.affectedByTasks;
  const affectedByBugs = sdlcIndex.affectedByBugs;
  const introducedRulesByRequirement = sdlcIndex.introducedRulesByRequirement;
  const respectedRulesByRequirement = sdlcIndex.respectedRulesByRequirement;
  const rulesViolatedByBug = sdlcIndex.rulesViolatedByBug;
  const rulesSurfacedByBug = sdlcIndex.rulesSurfacedByBug;
  const decisionsIntroducedByTask = sdlcIndex.decisionsIntroducedByTask;
  const sortedOr = (map, key) => (map.get(key) || []).slice().sort();
  const enrichedWithAffected = enrichedStatements.map((statement) => {
    switch (statement.kind) {
      case "capability":
      case "entity":
      case "projection":
      case "widget":
      case "orchestration":
      case "operation":
        return {
          ...statement,
          affectedByPitches: sortedOr(affectedByPitches, statement.id),
          affectedByRequirements: sortedOr(affectedByRequirements, statement.id),
          affectedByTasks: sortedOr(affectedByTasks, statement.id),
          affectedByBugs: sortedOr(affectedByBugs, statement.id)
        };
      case "rule":
        return {
          ...statement,
          affectedByPitches: sortedOr(affectedByPitches, statement.id),
          affectedByRequirements: sortedOr(affectedByRequirements, statement.id),
          affectedByTasks: sortedOr(affectedByTasks, statement.id),
          affectedByBugs: sortedOr(affectedByBugs, statement.id),
          introducedByRequirements: sortedOr(introducedRulesByRequirement, statement.id),
          respectedByRequirements: sortedOr(respectedRulesByRequirement, statement.id),
          violatedByBugs: sortedOr(rulesViolatedByBug, statement.id),
          surfacedByBugs: sortedOr(rulesSurfacedByBug, statement.id)
        };
      case "decision":
        return {
          ...statement,
          introducedByTasks: sortedOr(decisionsIntroducedByTask, statement.id)
        };
      default:
        return statement;
    }
  });
  const byKind = groupBy(enrichedWithAffected, (statement) => statement.kind);
  const finalStatements = enrichedWithAffected.map((statement) => {
    if (statement.kind !== "shape") {
      return statement;
    }

    return {
      ...statement,
      transformGraph: buildShapeTransformGraph(statement, byId)
    };
  });
  const finalByKind = groupBy(finalStatements, (statement) => statement.kind);

  const graph = mergeArchivedIntoGraph({
    root: workspaceAst.root,
    statements: finalStatements,
    byKind: finalByKind,
    docs: (workspaceAst.docs || []).filter((doc) => !doc.parseError).map(normalizeDoc)
  }, archive);

  return {
    ok: true,
    validation,
    graph
  };
}

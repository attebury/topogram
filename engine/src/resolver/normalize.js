import {
  collectFieldMap,
  getFieldValue,
  stringValue,
  symbolValue,
  symbolValues,
  valueAsArray
} from "../validator.js";
import {
  normalizeDomainScopeList,
  normalizeFieldsBlock,
  parseRuleExpression,
  resolveDomainTag,
  resolveReference,
  resolveReferenceList,
  toRef
} from "./shared.js";
import {
  normalizeWidgetBehaviors,
  normalizeWidgetEvents,
  normalizeWidgetProps,
  normalizeWidgetSlots
} from "./widgets.js";
import {
  parseInvariantBlock,
  parseKeyBlock,
  parseOverridesBlock,
  parseRelationBlock,
  parseRenameBlock
} from "./shapes.js";
import {
  parseProjectionHttpAsyncBlock,
  parseProjectionHttpAuthzBlock,
  parseProjectionHttpBlock,
  parseProjectionHttpCacheBlock,
  parseProjectionHttpCallbacksBlock,
  parseProjectionHttpDeleteBlock,
  parseProjectionHttpDownloadBlock,
  parseProjectionHttpErrorsBlock,
  parseProjectionHttpFieldsBlock,
  parseProjectionHttpIdempotencyBlock,
  parseProjectionHttpPreconditionsBlock,
  parseProjectionHttpResponsesBlock,
  parseProjectionHttpStatusBlock
} from "./projections-api.js";
import {
  parseProjectionCliCommandsBlock,
  parseProjectionCliEffectsBlock,
  parseProjectionCliExamplesBlock,
  parseProjectionCliOptionsBlock,
  parseProjectionCliOutputsBlock
} from "./projections-cli.js";
import {
  parseProjectionUiActionsBlock,
  parseProjectionUiAppShellBlock,
  parseProjectionUiCollectionsBlock,
  parseProjectionWidgetBindingsBlock,
  parseProjectionUiDesignBlock,
  parseProjectionUiIosBlock,
  parseProjectionUiLookupsBlock,
  parseProjectionUiNavigationBlock,
  parseProjectionUiRoutesBlock,
  parseProjectionUiScreenRegionsBlock,
  parseProjectionUiScreensBlock,
  parseProjectionUiVisibilityBlock,
  parseProjectionUiWebBlock
} from "./projections-ui.js";
import {
  parseProjectionDbColumnsBlock,
  parseProjectionDbIndexesBlock,
  parseProjectionDbKeysBlock,
  parseProjectionDbLifecycleBlock,
  parseProjectionDbRelationsBlock,
  parseProjectionDbTablesBlock,
  parseProjectionGeneratorDefaultsBlock
} from "./projections-db.js";

export function normalizeStatement(statement, registry) {
  const fieldMap = collectFieldMap(statement);
  const base = {
    kind: statement.kind,
    id: statement.id,
    name: stringValue(getFieldValue(statement, "name")),
    description: stringValue(getFieldValue(statement, "description")),
    status: symbolValue(getFieldValue(statement, "status")),
    from: statement.from
      ? {
          id: statement.from.value,
          target: toRef(resolveReference(registry, statement.from.value))
        }
      : null,
    loc: statement.loc
  };

  switch (statement.kind) {
    case "enum":
      return {
        ...base,
        values: symbolValues(getFieldValue(statement, "values"))
      };
    case "actor":
    case "role":
      return base;
    case "entity":
      return {
        ...base,
        usesTerms: resolveReferenceList(registry, getFieldValue(statement, "uses_terms")),
        fields: normalizeFieldsBlock(statement),
        keys: parseKeyBlock(statement),
        relations: parseRelationBlock(statement, registry),
        invariants: parseInvariantBlock(statement),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "shape":
      return {
        ...base,
        include: symbolValues(getFieldValue(statement, "include")),
        exclude: symbolValues(getFieldValue(statement, "exclude")),
        derivedFrom: resolveReferenceList(registry, getFieldValue(statement, "derived_from")),
        fields: normalizeFieldsBlock(statement),
        rename: parseRenameBlock(statement),
        overrides: parseOverridesBlock(statement)
      };
    case "capability":
      return {
        ...base,
        actors: resolveReferenceList(registry, getFieldValue(statement, "actors")),
        roles: resolveReferenceList(registry, getFieldValue(statement, "roles")),
        reads: resolveReferenceList(registry, getFieldValue(statement, "reads")),
        creates: resolveReferenceList(registry, getFieldValue(statement, "creates")),
        updates: resolveReferenceList(registry, getFieldValue(statement, "updates")),
        deletes: resolveReferenceList(registry, getFieldValue(statement, "deletes")),
        input: resolveReferenceList(registry, getFieldValue(statement, "input")),
        output: resolveReferenceList(registry, getFieldValue(statement, "output")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "widget":
      return {
        ...base,
        category: symbolValue(getFieldValue(statement, "category")),
        props: normalizeWidgetProps(statement),
        events: normalizeWidgetEvents(statement, registry),
        slots: normalizeWidgetSlots(statement),
        behavior: symbolValues(getFieldValue(statement, "behavior")),
        behaviors: normalizeWidgetBehaviors(statement),
        patterns: symbolValues(getFieldValue(statement, "patterns")),
        regions: symbolValues(getFieldValue(statement, "regions")),
        approvals: symbolValues(getFieldValue(statement, "approvals")),
        lookups: resolveReferenceList(registry, getFieldValue(statement, "lookups")),
        dependencies: resolveReferenceList(registry, getFieldValue(statement, "dependencies")),
        version: stringValue(getFieldValue(statement, "version"))
      };
    case "rule":
      return {
        ...base,
        appliesTo: resolveReferenceList(registry, getFieldValue(statement, "applies_to")),
        actors: resolveReferenceList(registry, getFieldValue(statement, "actors")),
        roles: resolveReferenceList(registry, getFieldValue(statement, "roles")),
        condition: valueAsArray(getFieldValue(statement, "condition")).map((item) => item.value),
        conditionNode: getFieldValue(statement, "condition") ? parseRuleExpression(getFieldValue(statement, "condition")) : null,
        requirement: valueAsArray(getFieldValue(statement, "requirement")).map((item) => item.value),
        requirementNode: getFieldValue(statement, "requirement") ? parseRuleExpression(getFieldValue(statement, "requirement")) : null,
        fromRequirement: getFieldValue(statement, "from_requirement")
          ? {
              id: symbolValue(getFieldValue(statement, "from_requirement")),
              target: toRef(resolveReference(registry, symbolValue(getFieldValue(statement, "from_requirement"))))
            }
          : null,
        severity: symbolValue(getFieldValue(statement, "severity")),
        sourceOfTruth: resolveReferenceList(registry, getFieldValue(statement, "source_of_truth")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "decision":
      return {
        ...base,
        context: symbolValues(getFieldValue(statement, "context")),
        consequences: symbolValues(getFieldValue(statement, "consequences")),
        pitch: getFieldValue(statement, "pitch")
          ? {
              id: symbolValue(getFieldValue(statement, "pitch")),
              target: toRef(resolveReference(registry, symbolValue(getFieldValue(statement, "pitch"))))
            }
          : null,
        supersedes: resolveReferenceList(registry, getFieldValue(statement, "supersedes")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "projection":
      return {
        ...base,
        type: symbolValue(getFieldValue(statement, "type")),
        realizes: resolveReferenceList(registry, getFieldValue(statement, "realizes")),
        outputs: symbolValues(getFieldValue(statement, "outputs")),
        endpoints: parseProjectionHttpBlock(statement, registry),
        errorResponses: parseProjectionHttpErrorsBlock(statement, registry),
        wireFields: parseProjectionHttpFieldsBlock(statement, registry),
        responses: parseProjectionHttpResponsesBlock(statement, registry),
        preconditions: parseProjectionHttpPreconditionsBlock(statement, registry),
        idempotency: parseProjectionHttpIdempotencyBlock(statement, registry),
        cache: parseProjectionHttpCacheBlock(statement, registry),
        deleteSemantics: parseProjectionHttpDeleteBlock(statement, registry),
        asyncJobs: parseProjectionHttpAsyncBlock(statement, registry),
        asyncStatus: parseProjectionHttpStatusBlock(statement, registry),
        downloads: parseProjectionHttpDownloadBlock(statement, registry),
        authorization: parseProjectionHttpAuthzBlock(statement, registry),
        callbacks: parseProjectionHttpCallbacksBlock(statement, registry),
        http: parseProjectionHttpBlock(statement, registry),
        httpErrors: parseProjectionHttpErrorsBlock(statement, registry),
        httpFields: parseProjectionHttpFieldsBlock(statement, registry),
        httpResponses: parseProjectionHttpResponsesBlock(statement, registry),
        httpPreconditions: parseProjectionHttpPreconditionsBlock(statement, registry),
        httpIdempotency: parseProjectionHttpIdempotencyBlock(statement, registry),
        httpCache: parseProjectionHttpCacheBlock(statement, registry),
        httpDelete: parseProjectionHttpDeleteBlock(statement, registry),
        httpAsync: parseProjectionHttpAsyncBlock(statement, registry),
        httpStatus: parseProjectionHttpStatusBlock(statement, registry),
        httpDownload: parseProjectionHttpDownloadBlock(statement, registry),
        httpAuthz: parseProjectionHttpAuthzBlock(statement, registry),
        httpCallbacks: parseProjectionHttpCallbacksBlock(statement, registry),
        commands: parseProjectionCliCommandsBlock(statement, registry),
        commandOptions: parseProjectionCliOptionsBlock(statement),
        commandOutputs: parseProjectionCliOutputsBlock(statement, registry),
        commandEffects: parseProjectionCliEffectsBlock(statement),
        commandExamples: parseProjectionCliExamplesBlock(statement),
        uiScreens: parseProjectionUiScreensBlock(statement, registry),
        screens: parseProjectionUiScreensBlock(statement, registry),
        uiCollections: parseProjectionUiCollectionsBlock(statement),
        collectionViews: parseProjectionUiCollectionsBlock(statement),
        uiActions: parseProjectionUiActionsBlock(statement, registry),
        screenActions: parseProjectionUiActionsBlock(statement, registry),
        uiVisibility: parseProjectionUiVisibilityBlock(statement, registry),
        visibilityRules: parseProjectionUiVisibilityBlock(statement, registry),
        uiLookups: parseProjectionUiLookupsBlock(statement, registry),
        fieldLookups: parseProjectionUiLookupsBlock(statement, registry),
        uiRoutes: parseProjectionUiRoutesBlock(statement),
        screenRoutes: parseProjectionUiRoutesBlock(statement),
        uiWeb: parseProjectionUiWebBlock(statement, registry),
        webHints: parseProjectionUiWebBlock(statement, registry),
        uiIos: parseProjectionUiIosBlock(statement, registry),
        iosHints: parseProjectionUiIosBlock(statement, registry),
        uiAppShell: parseProjectionUiAppShellBlock(statement),
        appShell: parseProjectionUiAppShellBlock(statement),
        uiDesign: parseProjectionUiDesignBlock(statement),
        designTokens: parseProjectionUiDesignBlock(statement),
        uiNavigation: parseProjectionUiNavigationBlock(statement),
        navigation: parseProjectionUiNavigationBlock(statement),
        uiScreenRegions: parseProjectionUiScreenRegionsBlock(statement),
        screenRegions: parseProjectionUiScreenRegionsBlock(statement),
        widgetBindings: parseProjectionWidgetBindingsBlock(statement, registry),
        dbTables: parseProjectionDbTablesBlock(statement, registry),
        tables: parseProjectionDbTablesBlock(statement, registry),
        dbColumns: parseProjectionDbColumnsBlock(statement, registry),
        columns: parseProjectionDbColumnsBlock(statement, registry),
        dbKeys: parseProjectionDbKeysBlock(statement, registry),
        keys: parseProjectionDbKeysBlock(statement, registry),
        dbIndexes: parseProjectionDbIndexesBlock(statement, registry),
        indexes: parseProjectionDbIndexesBlock(statement, registry),
        dbRelations: parseProjectionDbRelationsBlock(statement, registry),
        relations: parseProjectionDbRelationsBlock(statement, registry),
        dbLifecycle: parseProjectionDbLifecycleBlock(statement, registry),
        lifecycle: parseProjectionDbLifecycleBlock(statement, registry),
        generatorDefaults: parseProjectionGeneratorDefaultsBlock(statement)
      };
    case "orchestration":
      return {
        ...base,
        inputs: resolveReferenceList(registry, getFieldValue(statement, "inputs")),
        steps: symbolValues(getFieldValue(statement, "steps")),
        outputs: symbolValues(getFieldValue(statement, "outputs")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "verification":
      return {
        ...base,
        validates: resolveReferenceList(registry, getFieldValue(statement, "validates")),
        method: symbolValue(getFieldValue(statement, "method")),
        scenarios: symbolValues(getFieldValue(statement, "scenarios")),
        requirementRefs: resolveReferenceList(registry, getFieldValue(statement, "requirement_refs")),
        acceptanceRefs: resolveReferenceList(registry, getFieldValue(statement, "acceptance_refs")),
        fixesBugs: resolveReferenceList(registry, getFieldValue(statement, "fixes_bugs")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "operation":
      return {
        ...base,
        observes: resolveReferenceList(registry, getFieldValue(statement, "observes")),
        metrics: symbolValues(getFieldValue(statement, "metrics")),
        alerts: symbolValues(getFieldValue(statement, "alerts")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "term":
      return {
        ...base,
        aliases: symbolValues(getFieldValue(statement, "aliases")),
        excludes: symbolValues(getFieldValue(statement, "excludes"))
      };
    case "domain":
      return {
        ...base,
        inScope: normalizeDomainScopeList(statement, "in_scope"),
        outOfScope: normalizeDomainScopeList(statement, "out_of_scope"),
        owners: resolveReferenceList(registry, getFieldValue(statement, "owners")),
        parentDomain: getFieldValue(statement, "parent_domain")
          ? {
              id: symbolValue(getFieldValue(statement, "parent_domain")),
              target: toRef(resolveReference(registry, symbolValue(getFieldValue(statement, "parent_domain"))))
            }
          : null,
        aliases: normalizeDomainScopeList(statement, "aliases")
      };
    case "pitch":
      return {
        ...base,
        priority: symbolValue(getFieldValue(statement, "priority")),
        appetite: stringValue(getFieldValue(statement, "appetite")) || symbolValue(getFieldValue(statement, "appetite")),
        problem: stringValue(getFieldValue(statement, "problem")),
        solutionSketch: stringValue(getFieldValue(statement, "solution_sketch")),
        rabbitHoles: stringValue(getFieldValue(statement, "rabbit_holes")) || symbolValues(getFieldValue(statement, "rabbit_holes")),
        noGoAreas: stringValue(getFieldValue(statement, "no_go_areas")) || symbolValues(getFieldValue(statement, "no_go_areas")),
        affects: resolveReferenceList(registry, getFieldValue(statement, "affects")),
        decisions: resolveReferenceList(registry, getFieldValue(statement, "decisions")),
        updated: stringValue(getFieldValue(statement, "updated")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "requirement":
      return {
        ...base,
        priority: symbolValue(getFieldValue(statement, "priority")),
        pitch: getFieldValue(statement, "pitch")
          ? {
              id: symbolValue(getFieldValue(statement, "pitch")),
              target: toRef(resolveReference(registry, symbolValue(getFieldValue(statement, "pitch"))))
            }
          : null,
        affects: resolveReferenceList(registry, getFieldValue(statement, "affects")),
        introducesRules: resolveReferenceList(registry, getFieldValue(statement, "introduces_rules")),
        respectsRules: resolveReferenceList(registry, getFieldValue(statement, "respects_rules")),
        supersedes: resolveReferenceList(registry, getFieldValue(statement, "supersedes")),
        updated: stringValue(getFieldValue(statement, "updated")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "acceptance_criterion":
      return {
        ...base,
        requirement: getFieldValue(statement, "requirement")
          ? {
              id: symbolValue(getFieldValue(statement, "requirement")),
              target: toRef(resolveReference(registry, symbolValue(getFieldValue(statement, "requirement"))))
            }
          : null,
        supersedes: resolveReferenceList(registry, getFieldValue(statement, "supersedes")),
        updated: stringValue(getFieldValue(statement, "updated"))
      };
    case "task":
      return {
        ...base,
        priority: symbolValue(getFieldValue(statement, "priority")),
        workType: symbolValue(getFieldValue(statement, "work_type")),
        affects: resolveReferenceList(registry, getFieldValue(statement, "affects")),
        satisfies: resolveReferenceList(registry, getFieldValue(statement, "satisfies")),
        acceptanceRefs: resolveReferenceList(registry, getFieldValue(statement, "acceptance_refs")),
        blocks: resolveReferenceList(registry, getFieldValue(statement, "blocks")),
        blockedBy: resolveReferenceList(registry, getFieldValue(statement, "blocked_by")),
        claimedBy: resolveReferenceList(registry, getFieldValue(statement, "claimed_by")),
        introducesDecisions: resolveReferenceList(registry, getFieldValue(statement, "introduces_decisions")),
        modifies: resolveReferenceList(registry, getFieldValue(statement, "modifies")),
        introduces: resolveReferenceList(registry, getFieldValue(statement, "introduces")),
        removes: resolveReferenceList(registry, getFieldValue(statement, "removes")),
        updated: stringValue(getFieldValue(statement, "updated")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    case "bug":
      return {
        ...base,
        priority: symbolValue(getFieldValue(statement, "priority")),
        severity: symbolValue(getFieldValue(statement, "severity")),
        affects: resolveReferenceList(registry, getFieldValue(statement, "affects")),
        violates: resolveReferenceList(registry, getFieldValue(statement, "violates")),
        surfacesRule: resolveReferenceList(registry, getFieldValue(statement, "surfaces_rule")),
        introducedIn: resolveReferenceList(registry, getFieldValue(statement, "introduced_in")),
        fixedIn: resolveReferenceList(registry, getFieldValue(statement, "fixed_in")),
        fixedInRelease: stringValue(getFieldValue(statement, "fixed_in_release")) || symbolValue(getFieldValue(statement, "fixed_in_release")),
        fixedInVerification: resolveReferenceList(registry, getFieldValue(statement, "fixed_in_verification")),
        reproduction: stringValue(getFieldValue(statement, "reproduction")),
        modifies: resolveReferenceList(registry, getFieldValue(statement, "modifies")),
        introduces: resolveReferenceList(registry, getFieldValue(statement, "introduces")),
        removes: resolveReferenceList(registry, getFieldValue(statement, "removes")),
        updated: stringValue(getFieldValue(statement, "updated")),
        resolvedDomain: resolveDomainTag(statement, registry)
      };
    default:
      return {
        ...base,
        fields: [...fieldMap.keys()]
      };
  }
}

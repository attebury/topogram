import { validateCoreStatement, validateReferenceRules } from "./common.js";
import { validateDataModelStatement, validateShapeFrom } from "./data-model.js";
import { validateDocs } from "./docs.js";
import { validateExpressions } from "./expressions.js";
import { validateApiHttpProjection } from "./projections/api-http.js";
import { validateDbProjection } from "./projections/db.js";
import { validateProjectionGeneratorDefaults } from "./projections/generator-defaults.js";
import { validateCliProjection } from "./projections/cli.js";
import { validateUiProjection } from "./projections/ui.js";
import { buildRegistry } from "./registry.js";
import {
  collectFieldMap,
  formatLoc
} from "./utils.js";
import { validateWidget } from "./per-kind/widget.js";
import { validateDomain, validateDomainTag } from "./per-kind/domain.js";
import { validatePitch } from "./per-kind/pitch.js";
import { validateRequirement } from "./per-kind/requirement.js";
import { validateAcceptanceCriterion } from "./per-kind/acceptance-criterion.js";
import { validateTask } from "./per-kind/task.js";
import { validatePlan } from "./per-kind/plan.js";
import { validateBug } from "./per-kind/bug.js";
import { validateJourney } from "./per-kind/journey.js";

export {
  STATEMENT_KINDS,
  IDENTIFIER_PATTERN,
  DOMAIN_IDENTIFIER_PATTERN,
  DOMAIN_TAGGABLE_KINDS,
  PITCH_IDENTIFIER_PATTERN,
  REQUIREMENT_IDENTIFIER_PATTERN,
  ACCEPTANCE_CRITERION_IDENTIFIER_PATTERN,
  TASK_IDENTIFIER_PATTERN,
  PLAN_IDENTIFIER_PATTERN,
  BUG_IDENTIFIER_PATTERN,
  JOURNEY_IDENTIFIER_PATTERN,
  DOCUMENT_IDENTIFIER_PATTERN,
  GLOBAL_STATUSES,
  DECISION_STATUSES,
  RULE_SEVERITIES,
  VERIFICATION_METHODS,
  CLI_COMMAND_EFFECTS,
  CLI_COMMAND_OPTION_TYPES,
  CLI_COMMAND_OUTPUT_FORMATS,
  STATUS_SETS_BY_KIND,
  PITCH_STATUSES,
  REQUIREMENT_STATUSES,
  ACCEPTANCE_CRITERION_STATUSES,
  TASK_STATUSES,
  PLAN_STATUSES,
  PLAN_STEP_STATUSES,
  BUG_STATUSES,
  JOURNEY_STATUSES,
  PRIORITY_VALUES,
  WORK_TYPES,
  BUG_SEVERITIES,
  DOC_TYPES,
  AUDIENCES,
  UI_SCREEN_KINDS,
  UI_COLLECTION_PRESENTATIONS,
  UI_NAVIGATION_PATTERNS,
  UI_REGION_KINDS,
  UI_PATTERN_KINDS,
  UI_APP_SHELL_KINDS,
  UI_WINDOWING_MODES,
  UI_STATE_KINDS,
  UI_DESIGN_DENSITIES,
  UI_DESIGN_TONES,
  UI_DESIGN_RADIUS_SCALES,
  UI_DESIGN_COLOR_ROLES,
  UI_DESIGN_TYPOGRAPHY_ROLES,
  UI_DESIGN_ACTION_ROLES,
  UI_DESIGN_ACCESSIBILITY_VALUES,
  FIELD_SPECS
} from "./kinds.js";

export {
  blockEntries,
  collectFieldMap,
  formatLoc,
  getField,
  getFieldValue,
  pushError,
  stringValue,
  symbolValue,
  symbolValues,
  valueAsArray
} from "./utils.js";

export { buildRegistry } from "./registry.js";

export function validateWorkspace(workspaceAst) {
  const errors = [];
  const registry = buildRegistry(workspaceAst, errors);
  validateDocs(workspaceAst, registry, errors);

  for (const file of workspaceAst.files) {
    for (const statement of file.statements) {
      const fieldMap = collectFieldMap(statement);
      validateCoreStatement(errors, statement, fieldMap);
      validateShapeFrom(errors, statement, registry);
      validateReferenceRules(errors, statement, fieldMap, registry);
      validateDataModelStatement(errors, statement, fieldMap, registry);
      validateApiHttpProjection(errors, statement, fieldMap, registry);
      validateCliProjection(errors, statement, fieldMap, registry);
      validateUiProjection(errors, statement, fieldMap, registry);
      validateDbProjection(errors, statement, fieldMap, registry);
      validateProjectionGeneratorDefaults(errors, statement, fieldMap);
      validateWidget(errors, statement, fieldMap, registry);
      validateDomain(errors, statement, fieldMap, registry);
      validateDomainTag(errors, statement, fieldMap, registry);
      validatePitch(errors, statement, fieldMap, registry);
      validateRequirement(errors, statement, fieldMap, registry);
      validateAcceptanceCriterion(errors, statement, fieldMap, registry);
      validateTask(errors, statement, fieldMap, registry);
      validatePlan(errors, statement, fieldMap, registry);
      validateBug(errors, statement, fieldMap, registry);
      validateJourney(errors, statement, fieldMap, registry);
      validateExpressions(errors, statement, fieldMap);
    }
  }

  return {
    ok: errors.length === 0,
    errorCount: errors.length,
    errors,
    registry
  };
}

export function formatValidationErrors(result) {
  return result.errors.map((error) => `${formatLoc(error.loc)} ${error.message}`).join("\n");
}

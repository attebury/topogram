// @ts-check

import {
  validateProjectionUiOwnership,
  validateProjectionUiScreens,
  validateProjectionUiAppShell,
  validateProjectionUiDesign
} from "./ui-structure.js";
import {
  validateProjectionUiNavigation,
  validateProjectionUiScreenRegions,
  validateProjectionUiRoutes,
  validateProjectionUiWeb,
  validateProjectionUiIos
} from "./ui-navigation.js";
import {
  validateProjectionUiCollections,
  validateProjectionUiActions,
  validateProjectionUiComponents,
  validateProjectionUiVisibility,
  validateProjectionUiLookups
} from "./ui-widgets.js";

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
export function validateUiProjection(errors, statement, fieldMap, registry) {
  validateProjectionUiOwnership(errors, statement, fieldMap);
  validateProjectionUiScreens(errors, statement, fieldMap, registry);
  validateProjectionUiCollections(errors, statement, fieldMap, registry);
  validateProjectionUiActions(errors, statement, fieldMap, registry);
  validateProjectionUiVisibility(errors, statement, fieldMap, registry);
  validateProjectionUiLookups(errors, statement, fieldMap, registry);
  validateProjectionUiRoutes(errors, statement, fieldMap, registry);
  validateProjectionUiAppShell(errors, statement, fieldMap);
  validateProjectionUiDesign(errors, statement, fieldMap);
  validateProjectionUiNavigation(errors, statement, fieldMap, registry);
  validateProjectionUiScreenRegions(errors, statement, fieldMap, registry);
  validateProjectionUiComponents(errors, statement, fieldMap, registry);
  validateProjectionUiWeb(errors, statement, fieldMap, registry);
  validateProjectionUiIos(errors, statement, fieldMap, registry);
}

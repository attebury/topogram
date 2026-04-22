import { generateEnvironmentBundle, generateEnvironmentPlan } from "./environment.js";
import { generateDeploymentBundle, generateDeploymentPlan } from "./deployment.js";
import { generateRuntimeSmokeBundle, generateRuntimeSmokePlan } from "./smoke.js";
import { generateRuntimeCheckBundle, generateRuntimeCheckPlan } from "./runtime-check.js";
import { generateCompileCheckBundle, generateCompileCheckPlan } from "./compile-check.js";
import { generateAppBundle, generateAppBundlePlan } from "./app-bundle.js";

const RUNTIME_TARGETS = {
  "environment-plan": generateEnvironmentPlan,
  "environment-bundle": generateEnvironmentBundle,
  "deployment-plan": generateDeploymentPlan,
  "deployment-bundle": generateDeploymentBundle,
  "runtime-smoke-plan": generateRuntimeSmokePlan,
  "runtime-smoke-bundle": generateRuntimeSmokeBundle,
  "runtime-check-plan": generateRuntimeCheckPlan,
  "runtime-check-bundle": generateRuntimeCheckBundle,
  "compile-check-plan": generateCompileCheckPlan,
  "compile-check-bundle": generateCompileCheckBundle,
  "app-bundle-plan": generateAppBundlePlan,
  "app-bundle": generateAppBundle
};

export function generateRuntimeTarget(target, graph, options = {}) {
  const generator = RUNTIME_TARGETS[target];
  if (!generator) {
    throw new Error(`Unsupported runtime generator target '${target}'`);
  }
  return generator(graph, options);
}

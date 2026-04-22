export function buildReconcileResult(runWorkflow, inputPath, options = {}) {
  return runWorkflow("reconcile", inputPath, options);
}

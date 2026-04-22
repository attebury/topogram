export function buildAdoptionStatus(runWorkflow, inputPath, options = {}) {
  return runWorkflow("adoption-status", inputPath, options);
}

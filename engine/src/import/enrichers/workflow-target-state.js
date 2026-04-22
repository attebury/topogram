export const workflowTargetStateEnricher = {
  id: "enricher.workflow-target-state",
  track: "workflows",
  applies(_context, candidates) {
    return (candidates.workflow_transitions || []).length > 0;
  },
  enrich(_context, candidates) {
    return candidates;
  }
};

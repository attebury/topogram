export const docLinkingEnricher = {
  id: "enricher.doc-linking",
  track: "workflows",
  applies(context) {
    const docs = context.scanDocsSummary ? context.scanDocsSummary().candidate_docs || [] : [];
    return docs.length > 0;
  },
  enrich(context, candidates) {
    const docs = context.scanDocsSummary ? context.scanDocsSummary().candidate_docs || [] : [];
    if (docs.length === 0) return candidates;
    const workflowIds = new Set((docs || []).filter((doc) => doc.kind === "workflow").map((doc) => doc.id));
    return {
      ...candidates,
      workflows: (candidates.workflows || []).map((workflow) => ({
        ...workflow,
        documented: workflowIds.has(workflow.id_hint)
      }))
    };
  }
};

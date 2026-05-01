// Document DoD per status. Documents are markdown-only, so the input here
// is the normalized doc record from `engine/src/workspace-docs.js`.

export function checkDoD(doc, targetStatus, graph) {
  const errors = [];
  const warnings = [];

  if (targetStatus === "review" || targetStatus === "published") {
    if (!doc.title) errors.push("document must have a title");
    if (!doc.summary) warnings.push("document should have a summary for indexing");
  }

  if (targetStatus === "published") {
    if (!doc.appVersion && !doc.metadata?.app_version) {
      warnings.push("published document should record `app_version` to anchor staleness");
    }
    if (doc.confidence === "low") {
      warnings.push("publishing a low-confidence document — consider review first");
    }
  }

  return { satisfied: errors.length === 0, errors, warnings };
}

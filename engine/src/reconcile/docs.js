import fs from "node:fs";
import path from "node:path";

function buildFrontmatter(metadata) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(metadata)) {
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
      continue;
    }
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
      continue;
    }
    if (typeof value === "boolean") {
      lines.push(`${key}: ${value ? "true" : "false"}`);
      continue;
    }
    lines.push(`${key}: ${String(value).includes(":") ? JSON.stringify(value) : value}`);
  }
  lines.push("---");
  return lines.join("\n");
}

function renderMarkdownDoc(metadata, body) {
  const value = `${buildFrontmatter(metadata)}\n\n${String(body || "").trim()}\n`;
  return value.endsWith("\n") ? value : `${value}\n`;
}

function parseMarkdownFrontmatter(source) {
  const normalized = String(source || "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() !== "---") {
    return null;
  }
  let closingIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      closingIndex = index;
      break;
    }
  }
  if (closingIndex === -1) {
    return null;
  }
  const metadata = {};
  for (let index = 1; index < closingIndex; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }
    const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    if (rawValue.trim() === "") {
      const items = [];
      let cursor = index + 1;
      while (cursor < closingIndex) {
        const itemMatch = lines[cursor].match(/^\s*-\s*(.*)$/);
        if (!itemMatch) {
          break;
        }
        items.push(itemMatch[1]);
        cursor += 1;
      }
      metadata[key] = items;
      index = cursor - 1;
      continue;
    }
    metadata[key] = rawValue === "true" ? true : rawValue === "false" ? false : rawValue;
  }
  return {
    metadata,
    body: lines.slice(closingIndex + 1).join("\n").replace(/^\n+/, "")
  };
}

function normalizeComparableText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseMarkdownSections(body) {
  const normalized = String(body || "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const sections = new Map();
  let currentHeading = null;
  let buffer = [];
  const flush = () => {
    if (currentHeading) {
      sections.set(currentHeading, buffer.join("\n").trim());
    }
  };
  for (const line of lines) {
    const match = line.match(/^##+\s+(.+)$/);
    if (match) {
      flush();
      currentHeading = match[1].trim().toLowerCase();
      buffer = [];
      continue;
    }
    if (currentHeading) {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

function parseMarkdownBulletList(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.match(/^\s*[-*]\s+(.+)$/)?.[1]?.trim() || null)
    .filter(Boolean);
}

function extractComparableDocData(entry, markdownSource = null) {
  const parsed = markdownSource ? parseMarkdownFrontmatter(markdownSource) : null;
  const metadata = parsed?.metadata || {};
  const sections = parseMarkdownSections(parsed?.body || "");
  const changeReviewSection = sections.get("change review notes") || "";
  const failureSignalSection = sections.get("failure signals") || "";
  return {
    id: entry.id,
    kind: entry.kind || metadata.kind || null,
    confidence: entry.confidence || metadata.confidence || null,
    summary: entry.summary || metadata.summary || null,
    success_outcome: entry.success_outcome || entry.successOutcome || metadata.success_outcome || null,
    actors: [...new Set([...(entry.actors || []), ...((Array.isArray(metadata.actors) ? metadata.actors : []))])].sort(),
    related_actors: [...new Set([...(entry.related_actors || []), ...(entry.relatedActors || []), ...((Array.isArray(metadata.related_actors) ? metadata.related_actors : []))])].sort(),
    related_roles: [...new Set([...(entry.related_roles || []), ...(entry.relatedRoles || []), ...((Array.isArray(metadata.related_roles) ? metadata.related_roles : []))])].sort(),
    related_capabilities: [...new Set([...(entry.related_capabilities || []), ...(entry.relatedCapabilities || []), ...((Array.isArray(metadata.related_capabilities) ? metadata.related_capabilities : []))])].sort(),
    related_rules: [...new Set([...(entry.related_rules || []), ...(entry.relatedRules || []), ...((Array.isArray(metadata.related_rules) ? metadata.related_rules : []))])].sort(),
    related_workflows: [...new Set([...(entry.related_workflows || []), ...(entry.relatedWorkflows || []), ...((Array.isArray(metadata.related_workflows) ? metadata.related_workflows : []))])].sort(),
    failure_signals: [...new Set([...(entry.failure_signals || []), ...parseMarkdownBulletList(failureSignalSection)])].sort(),
    change_review_notes: [...new Set([
      ...(entry.change_review_notes || []),
      ...(changeReviewSection ? [changeReviewSection.replace(/\s+/g, " ").trim()] : [])
    ])].sort()
  };
}

function compareDocFieldSets(importedValues = [], canonicalValues = []) {
  const canonicalLookup = new Map((canonicalValues || []).map((value) => [normalizeComparableText(value), value]));
  const importedLookup = new Map((importedValues || []).map((value) => [normalizeComparableText(value), value]));
  const importedOnly = [...importedLookup.entries()].filter(([key]) => key && !canonicalLookup.has(key)).map(([, value]) => value).sort();
  const canonicalOnly = [...canonicalLookup.entries()].filter(([key]) => key && !importedLookup.has(key)).map(([, value]) => value).sort();
  return { imported_only: importedOnly, canonical_only: canonicalOnly };
}

export function buildBundleDocDriftSummaries(bundle, graph, topogramRoot, confidenceRank, readTextIfExists) {
  if (!graph) {
    return [];
  }
  const canonicalDocs = new Map(
    (graph.docs || [])
      .filter((doc) => ["journey", "workflow"].includes(doc.kind))
      .map((doc) => [doc.id, doc])
  );
  const summaries = [];
  for (const entry of bundle.docs || []) {
    if (!entry.existing_canonical) {
      continue;
    }
    const canonicalDoc = canonicalDocs.get(entry.id);
    if (!canonicalDoc) {
      continue;
    }
    const canonicalMarkdown = readTextIfExists(path.join(topogramRoot, canonicalDoc.relativePath));
    const importedMarkdown = entry.path ? readTextIfExists(path.join(topogramRoot, entry.path)) : null;
    const canonicalData = extractComparableDocData(canonicalDoc, canonicalMarkdown);
    const importedData = extractComparableDocData(entry, importedMarkdown);
    const differences = [];
    if (importedData.summary && normalizeComparableText(importedData.summary) !== normalizeComparableText(canonicalData.summary)) {
      differences.push({ field: "summary", canonical: canonicalData.summary || null, imported: importedData.summary });
    }
    if (importedData.success_outcome && normalizeComparableText(importedData.success_outcome) !== normalizeComparableText(canonicalData.success_outcome)) {
      differences.push({ field: "success_outcome", canonical: canonicalData.success_outcome || null, imported: importedData.success_outcome });
    }
    if ((importedData.actors || []).length > 0) {
      const actorDiff = compareDocFieldSets(importedData.actors, canonicalData.actors);
      if (actorDiff.imported_only.length > 0 || actorDiff.canonical_only.length > 0) differences.push({ field: "actors", ...actorDiff });
    }
    if ((importedData.failure_signals || []).length > 0) {
      const failureDiff = compareDocFieldSets(importedData.failure_signals, canonicalData.failure_signals);
      if (failureDiff.imported_only.length > 0 || failureDiff.canonical_only.length > 0) differences.push({ field: "failure_signals", ...failureDiff });
    }
    if ((importedData.change_review_notes || []).length > 0) {
      const notesDiff = compareDocFieldSets(importedData.change_review_notes, canonicalData.change_review_notes);
      if (notesDiff.imported_only.length > 0 || notesDiff.canonical_only.length > 0) differences.push({ field: "change_review_notes", ...notesDiff });
    }
    if (differences.length === 0) {
      continue;
    }
    const recommendation_type =
      ["summary", "success_outcome"].some((field) => differences.some((entryDiff) => entryDiff.field === field)) &&
      confidenceRank(importedData.confidence || "low") >= confidenceRank("high")
        ? "possible_canonical_drift"
        : "content_review_recommended";
    summaries.push({
      doc_id: entry.id,
      doc_kind: canonicalDoc.kind,
      canonical_rel_path: canonicalDoc.relativePath,
      imported_confidence: importedData.confidence || "low",
      differing_fields: differences,
      recommendation_type,
      recommendation:
        recommendation_type === "possible_canonical_drift"
          ? `Review \`${entry.id}\` for canonical drift before applying link-only updates.`
          : `Review \`${entry.id}\` content before treating imported evidence as link-only metadata.`
    });
  }
  return summaries.sort((a, b) =>
    confidenceRank(b.imported_confidence) - confidenceRank(a.imported_confidence) ||
    b.differing_fields.length - a.differing_fields.length ||
    a.doc_id.localeCompare(b.doc_id)
  );
}

export function buildBundleDocMetadataPatches(bundle, confidenceRank) {
  return (bundle.docDriftSummaries || [])
    .map((summary) => {
      const safeFields = new Map(summary.differing_fields.map((entry) => [entry.field, entry]));
      const patch = {
        doc_id: summary.doc_id,
        doc_kind: summary.doc_kind,
        canonical_rel_path: summary.canonical_rel_path,
        imported_confidence: summary.imported_confidence,
        patch_rel_path: `doc-metadata-patches/${summary.doc_id}.md`,
        recommendation: `Review and apply the safe metadata updates for \`${summary.doc_id}\`.`,
        summary: null,
        success_outcome: null,
        actors: []
      };
      if (safeFields.has("summary")) patch.summary = safeFields.get("summary").imported || null;
      if (safeFields.has("success_outcome")) patch.success_outcome = safeFields.get("success_outcome").imported || null;
      if (safeFields.has("actors")) patch.actors = safeFields.get("actors").imported_only || [];
      const safeFieldCount = Number(Boolean(patch.summary)) + Number(Boolean(patch.success_outcome)) + Number((patch.actors || []).length > 0);
      return safeFieldCount === 0 ? null : patch;
    })
    .filter(Boolean)
    .sort((a, b) =>
      confidenceRank(b.imported_confidence || "low") - confidenceRank(a.imported_confidence || "low") ||
      a.doc_id.localeCompare(b.doc_id)
    );
}

export function applyDocLinkPatchToMarkdown(source, item) {
  const parsed = parseMarkdownFrontmatter(source);
  if (!parsed) {
    return null;
  }
  const metadata = { ...parsed.metadata };
  metadata.related_actors = [...new Set([...(Array.isArray(metadata.related_actors) ? metadata.related_actors : []), ...((item.related_actors || []))])].sort();
  metadata.related_roles = [...new Set([...(Array.isArray(metadata.related_roles) ? metadata.related_roles : []), ...((item.related_roles || []))])].sort();
  metadata.related_capabilities = [...new Set([...(Array.isArray(metadata.related_capabilities) ? metadata.related_capabilities : []), ...((item.related_capabilities || []))])].sort();
  metadata.related_rules = [...new Set([...(Array.isArray(metadata.related_rules) ? metadata.related_rules : []), ...((item.related_rules || []))])].sort();
  metadata.related_workflows = [...new Set([...(Array.isArray(metadata.related_workflows) ? metadata.related_workflows : []), ...((item.related_workflows || []))])].sort();
  return renderMarkdownDoc(metadata, parsed.body || "");
}

export function applyDocMetadataPatchToMarkdown(source, item) {
  const parsed = parseMarkdownFrontmatter(source);
  if (!parsed) {
    return null;
  }
  const metadata = { ...parsed.metadata };
  if (item.summary) metadata.summary = item.summary;
  if (item.success_outcome) metadata.success_outcome = item.success_outcome;
  if ((item.actors || []).length > 0) {
    metadata.actors = [...new Set([...(Array.isArray(metadata.actors) ? metadata.actors : []), ...(item.actors || [])])].sort();
  }
  return renderMarkdownDoc(metadata, parsed.body || "");
}

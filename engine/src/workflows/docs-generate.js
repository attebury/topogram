// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../format.js";
import { parsePath } from "../parser.js";
import { resolveWorkspace } from "../resolver.js";
import { buildJourneyDrafts as buildJourneyDraftsReconcile } from "../reconcile/journeys.js";
import { relativeTo } from "../path-helpers.js";
import { ensureTrailingNewline, titleCase } from "../text-helpers.js";
import { listFilesRecursive, markdownTitle, normalizeWorkspacePaths, renderMarkdownDoc } from "./shared.js";

export function docDirForKind(kind) {
  if (kind === "glossary") {
    return "glossary";
  }
  if (kind === "workflow") {
    return "workflows";
  }
  if (kind === "journey") {
    return "journeys";
  }
  return "reports";
}

export function generateDocsBundleFromGraph(graph) {
  const files = {};
  for (const entity of graph.byKind.entity || []) {
    const id = entity.id.replace(/^entity_/, "");
    const metadata = {
      id,
      kind: "glossary",
      title: entity.name || titleCase(id),
      status: "canonical",
      summary: entity.description || `Generated glossary entry for ${entity.id}.`,
      related_entities: [entity.id],
      source_of_truth: "canonical",
      confidence: "high",
      review_required: false,
      tags: ["generated", "glossary"]
    };
    const body = [
      entity.description || `Canonical entity \`${entity.id}\`.`,
      "",
      "Fields:",
      ...(entity.fields || []).map((field) => `- \`${field.name}\` (${field.fieldType}) ${field.required ? "required" : "optional"}`)
    ].join("\n");
    files[`glossary/${id}.md`] = renderMarkdownDoc(metadata, body);
  }

  for (const capability of graph.byKind.capability || []) {
    const writes = [...capability.creates, ...capability.updates, ...capability.deletes];
    if (writes.length === 0) {
      continue;
    }
    const id = capability.id.replace(/^cap_/, "");
    const relatedEntities = [...new Set(writes.map((entry) => entry.id).filter(Boolean))];
    const metadata = {
      id,
      kind: "workflow",
      title: capability.name || titleCase(id),
      status: "canonical",
      summary: capability.description || `Generated workflow entry for ${capability.id}.`,
      related_capabilities: [capability.id],
      related_entities: relatedEntities,
      source_of_truth: "canonical",
      confidence: "high",
      review_required: false,
      tags: ["generated", "workflow"]
    };
    const body = [
      capability.description || `Canonical workflow surface for \`${capability.id}\`.`,
      "",
      `Actors: ${(capability.actors || []).map((actor) => `\`${actor.id}\``).join(", ") || "_none_"}`,
      `Creates: ${(capability.creates || []).map((ref) => `\`${ref.id}\``).join(", ") || "_none_"}`,
      `Updates: ${(capability.updates || []).map((ref) => `\`${ref.id}\``).join(", ") || "_none_"}`,
      `Deletes: ${(capability.deletes || []).map((ref) => `\`${ref.id}\``).join(", ") || "_none_"}`,
      `Input: ${capability.input?.id ? `\`${capability.input.id}\`` : "_none_"}`,
      `Output: ${capability.output?.id ? `\`${capability.output.id}\`` : "_none_"}`
    ].join("\n\n");
    files[`workflows/${id}.md`] = renderMarkdownDoc(metadata, body);
  }

  const reportMetadata = {
    id: "model_overview",
    kind: "report",
    title: "Model Overview",
    status: "canonical",
    summary: "Generated overview of the current Topogram model surface.",
    source_of_truth: "canonical",
    confidence: "high",
    review_required: false,
    tags: ["generated", "report"]
  };
  files["reports/model-overview.md"] = renderMarkdownDoc(
    reportMetadata,
    [
      `Entities: ${(graph.byKind.entity || []).length}`,
      `Capabilities: ${(graph.byKind.capability || []).length}`,
      `Shapes: ${(graph.byKind.shape || []).length}`,
      `Projections: ${(graph.byKind.projection || []).length}`,
      `Companion docs: ${(graph.docs || []).length}`
    ].join("\n\n")
  );

  const index = Object.entries(files).map(([filePath, contents]) => ({
    path: filePath,
    title: markdownTitle(filePath, contents)
  }));
  files["docs-index.json"] = `${stableStringify(index)}\n`;
  return files;
}

export function loadResolvedGraph(inputPath) {
  const ast = parsePath(inputPath);
  const resolved = resolveWorkspace(ast);
  if (!resolved.ok) {
    const error = new Error("Workspace validation failed");
    error.validation = resolved.validation;
    throw error;
  }
  return resolved.graph;
}

export function tryLoadResolvedGraph(inputPath) {
  try {
    return loadResolvedGraph(inputPath);
  } catch {
    return null;
  }
}

export function refreshDocsWorkflow(inputPath) {
  const paths = normalizeWorkspacePaths(inputPath);
  const graph = loadResolvedGraph(paths.topogramRoot);
  const generated = generateDocsBundleFromGraph(graph);
  const canonicalRoot = path.join(paths.topogramRoot, "docs");
  const generatedRoot = path.join(paths.topogramRoot, "candidates", "docs", "refreshed");
  const report = {
    type: "refresh_docs",
    workspace: paths.topogramRoot,
    missing: [],
    stale: [],
    orphaned: []
  };

  for (const [relativePath, contents] of Object.entries(generated)) {
    if (relativePath === "docs-index.json") {
      continue;
    }
    const canonicalPath = path.join(canonicalRoot, relativePath);
    if (!fs.existsSync(canonicalPath)) {
      report.missing.push(relativePath);
      continue;
    }
    if ((fs.readFileSync(canonicalPath, "utf8")) !== contents) {
      report.stale.push(relativePath);
    }
  }

  for (const filePath of listFilesRecursive(canonicalRoot, (child) => child.endsWith(".md"))) {
    const relativePath = relativeTo(canonicalRoot, filePath);
    if (!generated[relativePath]) {
      report.orphaned.push(relativePath);
    }
  }

  const files = {
    "candidates/docs/refreshed/report.json": `${stableStringify(report)}\n`,
    "candidates/docs/refreshed/report.md": ensureTrailingNewline(
      `# Docs Refresh Report\n\n## Missing\n\n${report.missing.length ? report.missing.map((item) => `- \`${item}\``).join("\n") : "- None"}\n\n## Stale\n\n${report.stale.length ? report.stale.map((item) => `- \`${item}\``).join("\n") : "- None"}\n\n## Orphaned\n\n${report.orphaned.length ? report.orphaned.map((item) => `- \`${item}\``).join("\n") : "- None"}\n`
    )
  };

  for (const [relativePath, contents] of Object.entries(generated)) {
    files[path.join("candidates/docs/refreshed/generated", relativePath).replaceAll(path.sep, "/")] = contents;
  }

  return {
    summary: report,
    files,
    defaultOutDir: paths.topogramRoot
  };
}

export function generateDocsWorkflow(inputPath) {
  const paths = normalizeWorkspacePaths(inputPath);
  const graph = loadResolvedGraph(paths.topogramRoot);
  const files = generateDocsBundleFromGraph(graph);
  return {
    summary: {
      type: "generate_docs",
      workspace: paths.topogramRoot,
      bootstrapped_topogram_root: paths.bootstrappedTopogramRoot,
      file_count: Object.keys(files).length
    },
    files,
    defaultOutDir: path.join(paths.topogramRoot, "docs-generated")
  };
}

export function generateJourneyDraftsWorkflow(inputPath) {
  const paths = normalizeWorkspacePaths(inputPath);
  const graph = loadResolvedGraph(paths.topogramRoot);
  const canonicalJourneys = (graph.docs || []).filter((doc) => doc.kind === "journey");
  const { drafts, skippedEntities } = buildJourneyDraftsReconcile(graph);
  const files = {};

  for (const draft of drafts) {
    files[draft.path] = renderMarkdownDoc(draft.metadata, draft.body);
  }

  const summary = {
    type: "generate_journeys",
    workspace: paths.topogramRoot,
    bootstrapped_topogram_root: paths.bootstrappedTopogramRoot,
    canonical_journey_count: canonicalJourneys.length,
    generated_draft_count: drafts.length,
    draft_journeys: drafts.map((draft) => ({
      id: draft.id,
      title: draft.title,
      entity_id: draft.entity_id,
      path: draft.path,
      type: draft.type,
      related_capabilities: draft.related_capabilities
    })),
    skipped_entities: skippedEntities
  };

  files["candidates/docs/journeys/import-report.json"] = `${stableStringify(summary)}\n`;
  files["candidates/docs/journeys/import-report.md"] = ensureTrailingNewline(
    `# Journey Draft Report\n\n` +
      `Canonical journeys: ${canonicalJourneys.length}\n\n` +
      `Generated drafts: ${drafts.length}\n\n` +
      `## Draft Journeys\n\n` +
      `${drafts.length === 0 ? "- None" : drafts.map((draft) => `- \`${draft.id}\` -> \`${draft.path}\``).join("\n")}\n\n` +
      `## Skipped Entities\n\n` +
      `${skippedEntities.length === 0 ? "- None" : skippedEntities.map((entry) => `- \`${entry.entity_id}\` (${entry.reason})`).join("\n")}\n`
  );

  return {
    summary,
    files,
    defaultOutDir: paths.topogramRoot
  };
}

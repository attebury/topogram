import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "./format.js";
import { generateApiContractGraph } from "./generator/api.js";
import { runImportAppWorkflow } from "./import/index.js";
import { parsePath } from "./parser.js";
import {
  adoptionItemKey,
  applyAdoptionSelector,
  buildAgentAdoptionPlan,
  mergeAdoptionPlanState,
  parseAdoptSelector,
  summarizeAdoptionPlanItems
} from "./adoption/plan.js";
import {
  attachBundleOperatorHints,
  annotateBundlePriorities,
  buildAdoptionStatusFiles as buildAdoptionStatusFilesReport,
  buildAdoptionStatusSummary as buildAdoptionStatusSummaryReport,
  buildPromotedCanonicalItems as buildPromotedCanonicalItemsReport,
  renderBundlePriorityActionsMarkdown,
  renderNextBestActionMarkdown,
  renderPreviewFollowupMarkdown,
  renderPreviewRiskMarkdown,
  renderPromotedCanonicalItemsMarkdown
} from "./adoption/reporting.js";
import {
  buildBundleAdoptionPriorities,
  buildBundleBlockerSummaries,
  buildProjectionReviewGroups,
  buildUiReviewGroups,
  buildWorkflowReviewGroups,
  selectNextBundle
} from "./adoption/review-groups.js";
import {
  applyDocLinkPatchToMarkdown as applyDocLinkPatchToMarkdownReconcile,
  applyDocMetadataPatchToMarkdown as applyDocMetadataPatchToMarkdownReconcile,
  buildBundleDocDriftSummaries as buildBundleDocDriftSummariesReconcile,
  buildBundleDocMetadataPatches as buildBundleDocMetadataPatchesReconcile
} from "./reconcile/docs.js";
import {
  buildJourneyDrafts as buildJourneyDraftsReconcile
} from "./reconcile/journeys.js";
import { resolveWorkspace } from "./resolver.js";
import { generateContextBundle } from "./generator/context/bundle.js";
import { buildLocalMaintainedBoundaryArtifact } from "./generator/context/shared.js";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "their",
  "have",
  "will",
  "when",
  "where",
  "what",
  "which",
  "then",
  "than",
  "been",
  "being",
  "does",
  "each",
  "just",
  "also",
  "through",
  "about",
  "because",
  "after",
  "before",
  "under",
  "over",
  "still",
  "they",
  "them",
  "there",
  "these",
  "those",
  "more",
  "most",
  "some",
  "only",
  "very",
  "same",
  "much",
  "many",
  "other",
  "into",
  "does",
  "used",
  "using",
  "readme",
  "docs",
  "topogram",
  "generated",
  "example",
  "examples",
  "app",
  "apps",
  "agreement",
  "api",
  "artifacts",
  "bash",
  "bundle",
  "bundles",
  "commands",
  "compile",
  "deployment",
  "deploy",
  "engine",
  "environment",
  "fixtures",
  "files",
  "fly",
  "getting",
  "implementation",
  "include",
  "layout",
  "local",
  "migrations",
  "model",
  "notes",
  "npm",
  "package",
  "proof",
  "react",
  "recommended",
  "report",
  "reports",
  "runnable",
  "run",
  "runtime",
  "scripts",
  "server",
  "smoke",
  "snapshot",
  "sqlite",
  "stack",
  "stages",
  "started",
  "state",
  "sveltekit",
  "current",
  "check",
  "checks",
  "env",
  "usage",
  "web",
  "workspace"
]);

function ensureTrailingNewline(value) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function findNearestGitRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

function normalizeWorkspacePaths(inputPath) {
  const absolute = path.resolve(inputPath);
  const inputExists = fs.existsSync(absolute);
  const hasTopogramChild = fs.existsSync(path.join(absolute, "topogram")) && fs.statSync(path.join(absolute, "topogram")).isDirectory();
  const isTopogramDir = path.basename(absolute) === "topogram" && inputExists;
  const bootstrapWorkspaceRoot = !isTopogramDir && !hasTopogramChild;
  const topogramRoot = isTopogramDir
    ? absolute
    : hasTopogramChild
      ? path.join(absolute, "topogram")
      : path.join(absolute, "topogram");
  const workspaceRoot = isTopogramDir ? path.dirname(topogramRoot) : absolute;
  const repoRoot = findNearestGitRoot(workspaceRoot);
  return {
    inputRoot: absolute,
    topogramRoot,
    workspaceRoot,
    exampleRoot: workspaceRoot,
    repoRoot,
    bootstrappedTopogramRoot: !fs.existsSync(topogramRoot)
  };
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}

function idHintify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "untitled";
}

function canonicalCandidateTerm(value) {
  const normalized = slugify(value);
  if (normalized.endsWith("ies")) {
    return `${normalized.slice(0, -3)}y`;
  }
  if (normalized.endsWith("s") && !normalized.endsWith("ss")) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function titleCase(value) {
  return String(value || "")
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function firstHeading(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function markdownTitle(filePath, markdown) {
  return firstHeading(markdown) || titleCase(path.basename(filePath, path.extname(filePath)));
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const DEFAULT_IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".yarn",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "tmp"
]);

function listFilesRecursive(rootDir, predicate = () => true, options = {}) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const ignoredDirs = options.ignoredDirs || DEFAULT_IGNORED_DIRS;
  const files = [];
  const walk = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const childPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) {
          continue;
        }
        walk(childPath);
        continue;
      }
      if (entry.isFile() && predicate(childPath)) {
        files.push(childPath);
      }
    }
  };
  walk(rootDir);
  return files.sort();
}

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
  return ensureTrailingNewline(`${buildFrontmatter(metadata)}\n\n${body.trim()}\n`);
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

function relativeTo(base, filePath) {
  return path.relative(base, filePath).replaceAll(path.sep, "/");
}

function discoverDocSources(paths) {
  const candidates = new Set();
  const pushIfExists = (filePath) => {
    if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      candidates.add(filePath);
    }
  };

  pushIfExists(path.join(paths.exampleRoot, "README.md"));
  pushIfExists(path.join(paths.exampleRoot, "apps", "README.md"));
  pushIfExists(path.join(paths.exampleRoot, "artifacts", "README.md"));
  pushIfExists(path.join(paths.exampleRoot, "implementation", "README.md"));

  for (const filePath of listFilesRecursive(path.join(paths.exampleRoot, "artifacts", "docs"), (child) => child.endsWith(".md"))) {
    candidates.add(filePath);
  }
  for (const filePath of listFilesRecursive(path.join(paths.exampleRoot, "apps"), (child) => path.basename(child).toLowerCase().startsWith("readme"))) {
    candidates.add(filePath);
  }

  return [...candidates].sort();
}

function extractTerms(markdown) {
  const normalized = markdown
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/\/Users\/[^\s)]+/g, " ")
    .replace(/https?:\/\/[^\s)]+/g, " ")
    .replace(/`([^`]+)`/g, " $1 ")
    .replace(/[_/]/g, " ");
  const frequency = new Map();
  const headings = normalized.match(/^#+\s+(.+)$/gm) || [];
  for (const heading of headings) {
    for (const word of heading.toLowerCase().match(/\b[a-z][a-z0-9-]{2,}\b/g) || []) {
      if (STOPWORDS.has(word)) {
        continue;
      }
      frequency.set(word, (frequency.get(word) || 0) + 3);
    }
  }
  for (const word of normalized.toLowerCase().match(/\b[a-z][a-z0-9-]{2,}\b/g) || []) {
    if (STOPWORDS.has(word)) {
      continue;
    }
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }
  return [...frequency.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([term]) => term);
}

function extractWorkflowSignals(markdown) {
  const text = markdown.toLowerCase();
  const signals = [];
  if (/(workflow|review|approve|reject|revision|resubmit)/.test(text)) {
    signals.push("review_workflow");
  }
  if (/(create|edit|update|close|resolve|archive|export)/.test(text)) {
    signals.push("lifecycle_flow");
  }
  return [...new Set(signals)];
}

function tokenizeCapabilityId(capabilityId) {
  return capabilityId
    .replace(/^cap_/, "")
    .split(/[_-]+/)
    .filter(Boolean);
}

function expandTokenVariants(token) {
  const variants = new Set([token]);
  if (token.endsWith("y")) {
    variants.add(`${token.slice(0, -1)}ies`);
  } else {
    variants.add(`${token}s`);
  }
  if (token === "close") {
    variants.add("closed");
    variants.add("closing");
  }
  if (token === "complete") {
    variants.add("completed");
    variants.add("completion");
  }
  if (token === "create") {
    variants.add("created");
    variants.add("creating");
    variants.add("new");
  }
  if (token === "update") {
    variants.add("updated");
    variants.add("updating");
    variants.add("edit");
    variants.add("edited");
    variants.add("editing");
  }
  if (token === "export") {
    variants.add("exports");
    variants.add("download");
    variants.add("downloaded");
  }
  if (token === "request") {
    variants.add("requested");
    variants.add("requesting");
  }
  if (token === "reject") {
    variants.add("rejected");
    variants.add("rejecting");
  }
  if (token === "approve") {
    variants.add("approved");
    variants.add("approving");
  }
  if (token === "revision") {
    variants.add("revise");
    variants.add("revisions");
  }
  return [...variants];
}

function includesAnyVariant(markdown, token) {
  const text = markdown.toLowerCase();
  return expandTokenVariants(token).some((variant) => includesTerm(text, variant));
}

function buildCapabilityWorkflowHints(graph) {
  const capabilities = graph?.byKind.capability || [];
  return capabilities
    .filter((capability) => {
      const id = capability.id.replace(/^cap_/, "");
      const tokens = tokenizeCapabilityId(capability.id);
      if (tokens[0] === "get" || tokens[0] === "list") {
        return false;
      }
      return (
        capability.creates.length > 0 ||
        capability.updates.length > 0 ||
        capability.deletes.length > 0 ||
        /(close|complete|export|download|approve|reject|request|revision)/.test(id)
      );
    })
    .map((capability) => {
      const id = capability.id.replace(/^cap_/, "");
      const tokens = tokenizeCapabilityId(capability.id);
      const actionTokens = tokens.filter((token) => !["task", "tasks", "issue", "issues", "user", "users", "project", "projects", "article", "articles", "board", "boards"].includes(token));
      const nounTokens = tokens.filter((token) => !actionTokens.includes(token));
      return {
        id,
        capabilityId: capability.id,
        title: capability.name || titleCase(id),
        actionTokens,
        nounTokens
      };
    });
}

function inferCapabilityWorkflowSignals(markdown, workflowHints) {
  const matches = [];
  for (const hint of workflowHints) {
    const actionMatched = hint.actionTokens.length === 0 || hint.actionTokens.some((token) => includesAnyVariant(markdown, token));
    const nounMatched = hint.nounTokens.length === 0 || hint.nounTokens.some((token) => includesAnyVariant(markdown, token));
    if (actionMatched && nounMatched) {
      matches.push(hint);
    }
  }
  return matches;
}

function workflowPriority(signal) {
  if (/export|download/.test(signal)) {
    return 7;
  }
  if (/request|revision|approve|reject/.test(signal)) {
    return 6;
  }
  if (/close|complete/.test(signal)) {
    return 5;
  }
  if (/create/.test(signal)) {
    return 4;
  }
  if (/update/.test(signal)) {
    return 3;
  }
  if (/delete/.test(signal)) {
    return 2;
  }
  if (signal === "review_workflow") {
    return 1;
  }
  if (signal === "lifecycle_flow") {
    return 0;
  }
  return 0;
}

function includesTerm(markdown, term) {
  if (!markdown || !term) {
    return false;
  }
  const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`, "i");
  return pattern.test(markdown);
}

const DOC_ACTOR_HINTS = [
  {
    id: "actor_user",
    title: "User",
    phrases: ["user", "users", "workspace member", "workspace members"],
    participantPatterns: [/\busers?\s+(?:(?:can|still)\s+)?(?:browse|view|open|return|sign\s+in|complete|create|update|see)\b/i, /\bworkspace members?\s+(?:browse|view|open|return|complete|see)\b/i]
  },
  {
    id: "actor_author",
    title: "Author",
    phrases: ["author", "authors"],
    participantPatterns: [/\bauthors?\s+(?:returns?|edits?|opens?|submits?|resubmits?|drafts?|updates?|sees?|receives?|understands?)\b/i]
  },
  {
    id: "actor_reviewer",
    title: "Reviewer",
    phrases: ["reviewer", "reviewers"],
    participantPatterns: [/\breviewers?\s+(?:reviews?|requests?|opens?|sees?|receives?|assigns?|returns?)\b/i]
  },
  {
    id: "actor_manager",
    title: "Manager",
    phrases: ["manager", "managers"],
    participantPatterns: [/\bmanagers?\s+(?:reviews?|assigns?|sees?|opens?|returns?)\b/i]
  },
  {
    id: "actor_admin",
    title: "Admin",
    phrases: ["admin", "admins", "administrator", "administrators"],
    participantPatterns: [/\badmins?\s+(?:reviews?|opens?|sees?|assigns?|returns?)\b/i, /\badministrators?\s+(?:reviews?|opens?|sees?|assigns?|returns?)\b/i]
  },
  {
    id: "actor_system_job",
    title: "System Job",
    phrases: ["system job", "background job", "worker process"],
    participantPatterns: [/\b(system job|background job|worker process)\s+(?:runs|retries|processes|updates)\b/i]
  }
];

const DOC_ROLE_HINTS = [
  {
    id: "role_author",
    title: "Author",
    exactPatterns: [/\brole[_\s-]?author\b/i, /\bauthors?\s+may\b/i, /\bauthors?\s+can\b/i]
  },
  {
    id: "role_reviewer",
    title: "Reviewer",
    exactPatterns: [/\brole[_\s-]?reviewer\b/i, /\breviewers?\s+may\b/i, /\breviewers?\s+can\b/i]
  },
  {
    id: "role_manager",
    title: "Manager",
    exactPatterns: [/\brole[_\s-]?manager\b/i, /\bonly\s+managers?\s+may\b/i, /\bmanagers?\s+may\b/i, /\bmanagers?\s+can\b/i]
  },
  {
    id: "role_admin",
    title: "Admin",
    exactPatterns: [/\brole[_\s-]?admin\b/i, /\bonly\s+admins?\s+may\b/i, /\badmins?\s+may\b/i, /\badmins?\s+can\b/i]
  },
  {
    id: "role_owner",
    title: "Owner",
    exactPatterns: [/\brole[_\s-]?owner\b/i, /\bowners?\s+may\b/i, /\bowners?\s+can\b/i]
  },
  {
    id: "role_assignee",
    title: "Assignee",
    exactPatterns: [/\brole[_\s-]?assignee\b/i, /\bassignees?\s+may\b/i, /\bassignees?\s+can\b/i]
  }
];

function countPhrase(markdown, phrase) {
  if (!markdown || !phrase) {
    return 0;
  }
  const pattern = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  return markdown.match(pattern)?.length || 0;
}

function countPatternMatches(markdown, patterns = []) {
  return patterns.reduce((total, pattern) => total + (markdown.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))?.length || 0), 0);
}

function confidenceRank(value) {
  if (value === "high") {
    return 3;
  }
  if (value === "medium") {
    return 2;
  }
  return 1;
}

function maxConfidence(a, b) {
  return confidenceRank(a) >= confidenceRank(b) ? a : b;
}

function inferRoleSignals(markdown) {
  const hits = [];
  for (const hint of DOC_ROLE_HINTS) {
    const explicitRolePatternCount = countPatternMatches(markdown, hint.exactPatterns.filter((pattern) => pattern.source.includes("role[")));
    const restrictivePatternCount = countPatternMatches(markdown, hint.exactPatterns.filter((pattern) => pattern.source.includes("only\\s+")));
    const permissionPatternCount = countPatternMatches(markdown, hint.exactPatterns);
    if (permissionPatternCount === 0) {
      continue;
    }
    hits.push({
      ...hint,
      confidence: explicitRolePatternCount > 0 || restrictivePatternCount > 0 ? "high" : "medium",
      evidence: {
        permission_pattern_count: permissionPatternCount,
        restrictive_pattern_count: restrictivePatternCount,
        explicit_role_pattern_count: explicitRolePatternCount
      }
    });
  }
  return hits;
}

function inferActorSignals(markdown, roleSignals = []) {
  const hits = [];
  const roleSignalsByTitle = new Map(roleSignals.map((signal) => [signal.title.toLowerCase(), signal]));
  for (const hint of DOC_ACTOR_HINTS) {
    const genericPhraseCount = hint.phrases.reduce((total, phrase) => total + countPhrase(markdown, phrase), 0);
    const participantPatternCount = countPatternMatches(markdown, hint.participantPatterns || []);
    if (genericPhraseCount === 0 && participantPatternCount === 0) {
      continue;
    }
    const relatedRoleSignal = roleSignalsByTitle.get(hint.title.toLowerCase());
    const permissionOverlapCount = relatedRoleSignal?.evidence?.permission_pattern_count || 0;
    if (participantPatternCount === 0 && permissionOverlapCount > 0 && genericPhraseCount <= permissionOverlapCount) {
      continue;
    }
    hits.push({
      ...hint,
      confidence: participantPatternCount > 0 ? "medium" : genericPhraseCount >= 2 ? "medium" : "low",
      evidence: {
        phrase_count: genericPhraseCount,
        participant_pattern_count: participantPatternCount,
        permission_overlap_count: permissionOverlapCount
      }
    });
  }
  return hits;
}

function renderCandidateActor(record) {
  const metadataLines = [renderCandidateMetadataComments(record)];
  for (const docId of (record.related_docs || []).slice(0, 3)) {
    metadataLines.push(`# imported related_doc: ${docId}`);
  }
  for (const capabilityId of (record.related_capabilities || []).slice(0, 3)) {
    metadataLines.push(`# imported related_capability: ${capabilityId}`);
  }
  return ensureTrailingNewline(
    `${metadataLines.join("\n")}\n` +
      `actor ${record.id_hint} {\n` +
      `  name "${record.label || titleCase(record.id_hint.replace(/^actor_/, ""))}"\n` +
      `  description "Candidate actor inferred from existing documentation"\n\n` +
      `  status proposed\n` +
      `}\n`
  );
}

function renderCandidateRole(record) {
  const metadataLines = [renderCandidateMetadataComments(record)];
  for (const docId of (record.related_docs || []).slice(0, 3)) {
    metadataLines.push(`# imported related_doc: ${docId}`);
  }
  for (const capabilityId of (record.related_capabilities || []).slice(0, 3)) {
    metadataLines.push(`# imported related_capability: ${capabilityId}`);
  }
  return ensureTrailingNewline(
    `${metadataLines.join("\n")}\n` +
      `role ${record.id_hint} {\n` +
      `  name "${record.label || titleCase(record.id_hint.replace(/^role_/, ""))}"\n` +
      `  description "Candidate role inferred from existing documentation"\n\n` +
      `  status proposed\n` +
      `}\n`
  );
}

function scanDocsWorkflow(inputPath) {
  const paths = normalizeWorkspacePaths(inputPath);
  const graph = tryLoadResolvedGraph(paths.topogramRoot);
  const sources = discoverDocSources(paths);
  const findings = [];
  const glossaryCandidates = new Map();
  const workflowCandidates = new Map();
  const actorCandidates = new Map();
  const roleCandidates = new Map();
  const exampleName = path.basename(paths.exampleRoot).toLowerCase();
  const exampleTerms = new Set(
    exampleName
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .flatMap((term) => [term, canonicalCandidateTerm(term)])
  );
  const preferredTerms = new Set([
    ...((graph?.byKind.entity || []).map((entity) => entity.id.replace(/^entity_/, ""))),
    ...((graph?.byKind.term || []).map((term) => term.id))
  ]);
  const workflowHints = buildCapabilityWorkflowHints(graph);

  for (const filePath of sources) {
    const markdown = readTextIfExists(filePath) || "";
    const title = markdownTitle(filePath, markdown);
    const terms = extractTerms(markdown).slice(0, 8);
    const workflowSignals = [
      ...extractWorkflowSignals(markdown),
      ...inferCapabilityWorkflowSignals(markdown, workflowHints).map((hint) => hint.id)
    ];
    const workflowHintsForFile = inferCapabilityWorkflowSignals(markdown, workflowHints);
    const relatedDocIdsForFile = [...new Set(workflowSignals.map((signal) => slugify(signal)))];
    const relatedCapabilityIdsForFile = [...new Set(workflowHintsForFile.map((hint) => hint.capabilityId).filter(Boolean))];
    const roleSignals = inferRoleSignals(markdown);
    const actorSignals = inferActorSignals(markdown, roleSignals);
    findings.push({
      file: filePath,
      relative_path: relativeTo(paths.repoRoot, filePath),
      title,
      term_candidates: terms,
      workflow_signals: workflowSignals,
      actor_signals: actorSignals.map((signal) => signal.id),
      role_signals: roleSignals.map((signal) => signal.id)
    });

    for (const term of terms) {
      if (!preferredTerms.has(term)) {
        continue;
      }
      if (!glossaryCandidates.has(term)) {
        glossaryCandidates.set(term, []);
      }
      glossaryCandidates.get(term).push(relativeTo(paths.repoRoot, filePath));
    }

    for (const term of preferredTerms) {
      if (!includesTerm(markdown, term)) {
        continue;
      }
      if (!glossaryCandidates.has(term)) {
        glossaryCandidates.set(term, []);
      }
      glossaryCandidates.get(term).push(relativeTo(paths.repoRoot, filePath));
    }

    for (const term of terms.slice(0, 4)) {
      if (!preferredTerms.has(term) && (exampleTerms.has(term) || exampleTerms.has(canonicalCandidateTerm(term)))) {
        continue;
      }
      if (!glossaryCandidates.has(term)) {
        glossaryCandidates.set(term, []);
      }
      glossaryCandidates.get(term).push(relativeTo(paths.repoRoot, filePath));
    }

    for (const signal of workflowSignals) {
      if (!workflowCandidates.has(signal)) {
        workflowCandidates.set(signal, []);
      }
      workflowCandidates.get(signal).push(relativeTo(paths.repoRoot, filePath));
    }

    for (const signal of actorSignals) {
      if (!actorCandidates.has(signal.id)) {
        actorCandidates.set(signal.id, {
          id_hint: signal.id,
          label: signal.title,
          confidence: signal.confidence,
          source_kind: "docs",
          provenance: [],
          related_docs: [],
          related_capabilities: [],
          evidence: []
        });
      }
      const candidate = actorCandidates.get(signal.id);
      candidate.confidence = maxConfidence(candidate.confidence, signal.confidence);
      candidate.provenance.push(relativeTo(paths.repoRoot, filePath));
      candidate.related_docs.push(...relatedDocIdsForFile);
      candidate.related_capabilities.push(...relatedCapabilityIdsForFile);
      candidate.evidence.push(signal.evidence);
    }

    for (const signal of roleSignals) {
      if (!roleCandidates.has(signal.id)) {
        roleCandidates.set(signal.id, {
          id_hint: signal.id,
          label: signal.title,
          confidence: signal.confidence,
          source_kind: "docs",
          provenance: [],
          related_docs: [],
          related_capabilities: [],
          evidence: []
        });
      }
      const candidate = roleCandidates.get(signal.id);
      candidate.confidence = maxConfidence(candidate.confidence, signal.confidence);
      candidate.provenance.push(relativeTo(paths.repoRoot, filePath));
      candidate.related_docs.push(...relatedDocIdsForFile);
      candidate.related_capabilities.push(...relatedCapabilityIdsForFile);
      candidate.evidence.push(signal.evidence);
    }
  }

  const files = {};
  const candidateDocs = [];
  const orderedGlossaryCandidates = [...glossaryCandidates.entries()]
    .filter(([term]) => preferredTerms.has(term) || (!exampleTerms.has(term) && !exampleTerms.has(canonicalCandidateTerm(term))))
    .sort((a, b) => {
    const aPreferred = preferredTerms.has(a[0]) ? 1 : 0;
    const bPreferred = preferredTerms.has(b[0]) ? 1 : 0;
    if (aPreferred !== bPreferred) {
      return bPreferred - aPreferred;
    }
    if (a[1].length !== b[1].length) {
      return b[1].length - a[1].length;
    }
    return a[0].localeCompare(b[0]);
  });
  const preferredGlossaryCandidates = orderedGlossaryCandidates.filter(([term]) => preferredTerms.has(term));
  const fallbackGlossaryCandidates = orderedGlossaryCandidates.filter(([term]) => !preferredTerms.has(term));
  const seenCanonicalTerms = new Set();
  for (const [term, provenance] of [...preferredGlossaryCandidates, ...fallbackGlossaryCandidates]) {
    const canonicalTerm = canonicalCandidateTerm(term);
    if (seenCanonicalTerms.has(canonicalTerm)) {
      continue;
    }
    seenCanonicalTerms.add(canonicalTerm);
    const metadata = {
      id: slugify(term),
      kind: "glossary",
      title: titleCase(term),
      status: "inferred",
      source_of_truth: "imported",
      confidence: "low",
      review_required: true,
      provenance,
      tags: ["import", "glossary"]
    };
    const body = `Candidate glossary term inferred from existing documentation.\n\nObserved term: \`${term}\`\n\nThis entry should be reviewed and either promoted, renamed, merged, or discarded.`;
    const relativePath = `candidates/docs/glossary/${slugify(term)}.md`;
    files[relativePath] = renderMarkdownDoc(metadata, body);
    candidateDocs.push({
      id: metadata.id,
      kind: metadata.kind,
      title: metadata.title,
      path: relativePath,
      confidence: metadata.confidence,
      provenance: metadata.provenance,
      related_entities: metadata.related_entities || [],
      related_capabilities: metadata.related_capabilities || [],
      source_of_truth: metadata.source_of_truth
    });
    if (candidateDocs.filter((doc) => doc.kind === "glossary").length >= 6) {
      break;
    }
  }

  const genericWorkflowSignals = new Set(["review_workflow", "lifecycle_flow"]);
  const orderedWorkflowCandidates = [...workflowCandidates.entries()].sort((a, b) => {
    const aGeneric = genericWorkflowSignals.has(a[0]) ? 1 : 0;
    const bGeneric = genericWorkflowSignals.has(b[0]) ? 1 : 0;
    if (aGeneric !== bGeneric) {
      return aGeneric - bGeneric;
    }
    const aPriority = workflowPriority(a[0]);
    const bPriority = workflowPriority(b[0]);
    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }
    if (a[1].length !== b[1].length) {
      return b[1].length - a[1].length;
    }
    return a[0].localeCompare(b[0]);
  });
  let specificWorkflowCount = 0;
  let genericWorkflowCount = 0;
  for (const [signal, provenance] of orderedWorkflowCandidates) {
    const workflowHint = workflowHints.find((hint) => hint.id === signal);
    const isGeneric = genericWorkflowSignals.has(signal);
    if (isGeneric && genericWorkflowCount >= 2) {
      continue;
    }
    if (!isGeneric && specificWorkflowCount >= 4) {
      continue;
    }
    const title = workflowHint?.title || (signal === "review_workflow" ? "Review Workflow" : "Lifecycle Flow");
    const metadata = {
      id: slugify(signal),
      kind: "workflow",
      title,
      status: "inferred",
      source_of_truth: "imported",
      confidence: genericWorkflowSignals.has(signal) ? "low" : "medium",
      review_required: true,
      related_capabilities: workflowHint ? [workflowHint.capabilityId] : [],
      provenance,
      tags: ["import", "workflow"]
    };
    const body = workflowHint
      ? `Candidate workflow inferred from existing documentation.\n\nMatched capability: \`${workflowHint.capabilityId}\`\n\nThis entry should be reconciled with the eventual capability and UI model before promotion.`
      : `Candidate workflow inferred from existing documentation.\n\nWorkflow signal: \`${signal}\`\n\nThis entry should be reconciled with the eventual capability and UI model before promotion.`;
    const relativePath = `candidates/docs/workflows/${slugify(signal)}.md`;
    files[relativePath] = renderMarkdownDoc(metadata, body);
    candidateDocs.push({
      id: metadata.id,
      kind: metadata.kind,
      title: metadata.title,
      path: relativePath,
      confidence: metadata.confidence,
      provenance: metadata.provenance,
      related_entities: metadata.related_entities || [],
      related_capabilities: metadata.related_capabilities || [],
      source_of_truth: metadata.source_of_truth
    });
    if (isGeneric) {
      genericWorkflowCount += 1;
    } else {
      specificWorkflowCount += 1;
    }
  }

  const candidateActors = [...actorCandidates.values()]
    .map((record) => ({
      ...record,
      provenance: [...new Set(record.provenance)].sort(),
      related_docs: [...new Set(record.related_docs || [])].sort(),
      related_capabilities: [...new Set(record.related_capabilities || [])].sort(),
      inference_summary: `phrases=${(record.evidence || []).reduce((total, item) => total + (item?.phrase_count || 0), 0)}, participant_hits=${(record.evidence || []).reduce((total, item) => total + (item?.participant_pattern_count || 0), 0)}, permission_overlap=${(record.evidence || []).reduce((total, item) => total + (item?.permission_overlap_count || 0), 0)}`
    }))
    .sort((a, b) => a.id_hint.localeCompare(b.id_hint))
    .slice(0, 6);
  for (const record of candidateActors) {
    const relativePath = `candidates/docs/actors/${record.id_hint.replace(/^actor_/, "").replaceAll("_", "-")}.tg`;
    files[relativePath] = renderCandidateActor(record);
  }

  const candidateRoles = [...roleCandidates.values()]
    .map((record) => ({
      ...record,
      provenance: [...new Set(record.provenance)].sort(),
      related_docs: [...new Set(record.related_docs || [])].sort(),
      related_capabilities: [...new Set(record.related_capabilities || [])].sort(),
      inference_summary: `permission_hits=${(record.evidence || []).reduce((total, item) => total + (item?.permission_pattern_count || 0), 0)}, restrictive_hits=${(record.evidence || []).reduce((total, item) => total + (item?.restrictive_pattern_count || 0), 0)}, explicit_role_hits=${(record.evidence || []).reduce((total, item) => total + (item?.explicit_role_pattern_count || 0), 0)}`
    }))
    .sort((a, b) => a.id_hint.localeCompare(b.id_hint))
    .slice(0, 6);
  for (const record of candidateRoles) {
    const relativePath = `candidates/docs/roles/${record.id_hint.replace(/^role_/, "").replaceAll("_", "-")}.tg`;
    files[relativePath] = renderCandidateRole(record);
  }

  const report = {
    type: "scan_docs_report",
    workspace: paths.topogramRoot,
    bootstrapped_topogram_root: paths.bootstrappedTopogramRoot,
    source_count: sources.length,
    sources: sources.map((filePath) => relativeTo(paths.repoRoot, filePath)),
    findings,
    candidate_docs: candidateDocs,
    candidate_actors: candidateActors,
    candidate_roles: candidateRoles
  };
  files["candidates/docs/findings.json"] = `${stableStringify(findings)}\n`;
  files["candidates/docs/import-report.json"] = `${stableStringify(report)}\n`;
  files["candidates/docs/import-report.md"] = ensureTrailingNewline(
    `# Docs Import Report\n\nScanned ${sources.length} source document(s).\n\n## Candidate Docs\n\n${candidateDocs.length === 0 ? "- None" : candidateDocs.map((doc) => `- \`${doc.kind}\` ${doc.title}`).join("\n")}\n\n## Candidate Actors\n\n${candidateActors.length === 0 ? "- None" : candidateActors.map((actor) => `- \`${actor.id_hint}\` (${actor.confidence})`).join("\n")}\n\n## Candidate Roles\n\n${candidateRoles.length === 0 ? "- None" : candidateRoles.map((role) => `- \`${role.id_hint}\` (${role.confidence})`).join("\n")}\n`
  );

  return {
    summary: report,
    files,
    defaultOutDir: paths.topogramRoot
  };
}

function docDirForKind(kind) {
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

function generateDocsBundleFromGraph(graph) {
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

function loadResolvedGraph(inputPath) {
  const ast = parsePath(inputPath);
  const resolved = resolveWorkspace(ast);
  if (!resolved.ok) {
    const error = new Error("Workspace validation failed");
    error.validation = resolved.validation;
    throw error;
  }
  return resolved.graph;
}

function tryLoadResolvedGraph(inputPath) {
  try {
    return loadResolvedGraph(inputPath);
  } catch {
    return null;
  }
}

function generateDocsWorkflow(inputPath) {
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

function generateJourneyDraftsWorkflow(inputPath) {
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

function normalizeCandidateFieldType(fieldType, knownEnums = new Set()) {
  const normalized = idHintify(fieldType);
  if (SCALAR_FIELD_TYPES.has(normalized)) {
    return normalized;
  }
  if (knownEnums.has(normalized)) {
    return normalized;
  }
  return normalized || "string";
}

function renderCandidateMetadataComments(record) {
  const lines = [
    `# imported confidence: ${record.confidence || "unknown"}`,
    `# imported source_kind: ${record.source_kind || "unknown"}`
  ];
  if (record.inference_summary) {
    lines.push(`# imported inference: ${record.inference_summary}`);
  }
  for (const provenance of (record.provenance || []).slice(0, 3)) {
    lines.push(`# imported provenance: ${provenance}`);
  }
  if ((record.provenance || []).length > 3) {
    lines.push(`# imported provenance_more: ${(record.provenance || []).length - 3}`);
  }
  return lines.join("\n");
}

function renderCandidateEntity(record, knownEnums = new Set()) {
  const fields = record.fields || [];
  const primaryKeys = fields.filter((field) => field.primary_key).map((field) => field.name);
  const uniqueKeys = fields.filter((field) => field.unique && !field.primary_key).map((field) => field.name);
  const fieldLines = fields.map((field) => {
    const fieldType = normalizeCandidateFieldType(field.field_type, knownEnums);
    const requiredness = field.required ? "required" : "optional";
    return `    ${field.name} ${fieldType} ${requiredness}`;
  });
  const lines = [
    `entity ${record.id_hint} {`,
    `  name "${record.label}"`,
    `  description "Candidate entity imported from brownfield schema evidence"`,
    "",
    "  fields {",
    ...fieldLines,
    "  }"
  ];
  if (primaryKeys.length > 0 || uniqueKeys.length > 0) {
    lines.push("", "  keys {");
    if (primaryKeys.length > 0) {
      lines.push(`    primary [${primaryKeys.join(", ")}]`);
    }
    if (uniqueKeys.length > 0) {
      lines.push(`    unique [${uniqueKeys.join(", ")}]`);
    }
    lines.push("  }");
  }
  lines.push("", "  status active", "}");
  return ensureTrailingNewline(`${renderCandidateMetadataComments(record)}\n${lines.join("\n")}`);
}

function renderCandidateEnum(record) {
  return ensureTrailingNewline(
    `${renderCandidateMetadataComments(record)}\n${[
      `enum ${record.id_hint} {`,
      `  values [${(record.values || []).join(", ")}]`,
      "}"
    ].join("\n")}`
  );
}

function inferCapabilityVerb(record) {
  const id = record.id_hint || "";
  if (id.startsWith("cap_create_")) return "creates";
  if (id.startsWith("cap_update_") || (record.endpoint?.method || "").toUpperCase() === "PATCH") return "updates";
  if (id.startsWith("cap_delete_") || (record.endpoint?.method || "").toUpperCase() === "DELETE") return "deletes";
  return "reads";
}

function inferCapabilityEntityId(record) {
  if (record.entity_id) {
    return record.entity_id;
  }
  const pathSegments = normalizeEndpointPathForMatch(record.endpoint?.path || "")
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment !== "{}");
  const resourceSegment = pathSegments[0] || record.id_hint.replace(/^cap_(create|update|delete|get|list)_/, "");
  return `entity_${idHintify(canonicalCandidateTerm(resourceSegment))}`;
}

function shapeIdForCapability(record, direction) {
  const stem = record.id_hint.replace(/^cap_/, "");
  return direction === "input" ? `shape_input_${stem}` : `shape_output_${stem}`;
}

function renderCandidateShape(shapeId, label, fields) {
  const lines = [
    `shape ${shapeId} {`,
    `  name "${label}"`,
    `  description "Candidate shape imported from brownfield API evidence"`,
    "",
    "  fields {"
  ];
  for (const field of fields) {
    lines.push(`    ${field} string optional`);
  }
  lines.push("  }", "", "  status active", "}");
  return ensureTrailingNewline(lines.join("\n"));
}

function renderCandidateCapability(record, inputShapeId, outputShapeId) {
  const operationKind = inferCapabilityVerb(record);
  const entityId = inferCapabilityEntityId(record);
  const lines = [
    `capability ${record.id_hint} {`,
    `  name "${record.label}"`,
    `  description "Candidate capability imported from brownfield API evidence"`,
    ""
  ];
  if (record.auth_hint === "secured") {
    lines.push("  actors [user]", "");
  }
  lines.push(`  ${operationKind} [${entityId}]`);
  if (inputShapeId) {
    lines.push("", `  input [${inputShapeId}]`);
  }
  if (outputShapeId) {
    lines.push(`  output [${outputShapeId}]`);
  }
  lines.push("", "  status active", "}");
  return ensureTrailingNewline(`${renderCandidateMetadataComments(record)}\n${lines.join("\n")}`);
}

function renderCandidateVerification(record, scenarios = []) {
  const validates = [...new Set(record.related_capabilities || [])];
  const scenarioSymbols = scenarios.length > 0
    ? scenarios.map((entry) => entry.id_hint)
    : (record.scenario_ids || []).map((entry) => idHintify(entry));
  const lines = [
    `verification ${record.id_hint} {`,
    `  name "${record.label}"`,
    `  description "Candidate verification imported from brownfield test evidence"`,
    "",
    `  validates [${validates.join(", ")}]`,
    `  method ${record.method || "runtime"}`,
    "",
    `  scenarios [${scenarioSymbols.join(", ")}]`,
    "",
    "  status active",
    "}"
  ];
  return ensureTrailingNewline(`${renderCandidateMetadataComments(record)}\n${lines.join("\n")}`);
}

function renderCandidateWorkflowDecision(record, states, transitions) {
  const context = [
    ...states.map((state) => state.state_id),
    ...transitions.map((transition) => transition.capability_id).filter(Boolean)
  ].filter(Boolean);
  const consequences = transitions.map((transition) => transition.to_state).filter(Boolean);
  return ensureTrailingNewline(
    `${renderCandidateMetadataComments(record)}\n${[
      `decision dec_${record.id_hint.replace(/^workflow_/, "")} {`,
      `  name "${record.label}"`,
      `  description "Candidate workflow decision imported from brownfield evidence"`,
      "",
      `  context [${[...new Set(context)].join(", ")}]`,
      `  consequences [${[...new Set(consequences)].join(", ")}]`,
      "",
      "  status proposed",
      "}"
    ].join("\n")}`
  );
}

function renderCandidateWorkflowDoc(record, states, transitions) {
  const metadata = {
    id: record.id_hint,
    kind: "workflow",
    title: record.label,
    status: "inferred",
    source_of_truth: "imported",
    confidence: record.confidence || "medium",
    review_required: true,
    related_entities: [record.entity_id].filter(Boolean),
    related_capabilities: record.related_capabilities || [],
    provenance: record.provenance || [],
    tags: ["import", "workflow"]
  };
  const body = [
    "Candidate workflow imported from brownfield evidence.",
    "",
    `Entity: \`${record.entity_id}\``,
    `States: ${states.length ? states.map((state) => `\`${state.state_id}\``).join(", ") : "_none_"}`,
    `Transitions: ${transitions.length ? transitions.map((transition) => `\`${transition.capability_id || transition.id_hint}\` -> \`${transition.to_state}\``).join(", ") : "_none_"}`,
    "",
    "Review this workflow before promoting it as canonical."
  ].join("\n");
  return renderMarkdownDoc(metadata, body);
}

function renderCandidateUiReportDoc(screen, routes, actions) {
  const metadata = {
    id: `ui_${screen.id_hint}`,
    kind: "report",
    title: `${screen.label} UI Surface`,
    status: "inferred",
    source_of_truth: "imported",
    confidence: screen.confidence || "medium",
    review_required: true,
    related_entities: [screen.entity_id].filter(Boolean),
    provenance: screen.provenance || [],
    tags: ["import", "ui"]
  };
  const body = [
    "Candidate UI surface imported from brownfield route evidence.",
    "",
    `Screen: \`${screen.id_hint}\` (${screen.screen_kind})`,
    `Routes: ${routes.length ? routes.map((route) => `\`${route.path}\``).join(", ") : "_none_"}`,
    `Actions: ${actions.length ? actions.map((action) => `\`${action.capability_hint}\``).join(", ") : "_none_"}`,
    "",
    "Review this UI surface before promoting it into canonical docs or projections."
  ].join("\n");
  return renderMarkdownDoc(metadata, body);
}

function renderCandidateComponent(component) {
  const propName = component.data_prop || "rows";
  const pattern = component.pattern || "search_results";
  const region = component.region || "results";
  return ensureTrailingNewline(
    [
      `widget ${component.id_hint} {`,
      `  name "${component.label || component.id_hint}"`,
      '  description "Candidate reusable widget inferred from imported UI evidence. Review props, behavior, events, and reuse before adoption."',
      "  category collection",
      "  props {",
      `    ${propName} array required`,
      "  }",
      `  patterns [${pattern}]`,
      `  regions [${region}]`,
      "  status proposed",
      "}"
    ].join("\n")
  );
}

function renderProjectionPatchDoc(patch) {
  const lines = [
    `# ${patch.projection_id} Patch Candidate`,
    "",
    `Projection: \`${patch.projection_id}\``,
    `Kind: \`${patch.kind}\``,
    patch.platform ? `Platform: \`${patch.platform}\`` : null,
    "",
    patch.reason || "Candidate additive projection patch inferred during reconcile.",
    ""
  ].filter(Boolean);

  if ((patch.missing_realizes || []).length > 0) {
    lines.push("## Missing Realizes", "");
    for (const item of patch.missing_realizes) {
      lines.push(`- \`${item}\``);
    }
    lines.push("");
  }

  if ((patch.missing_http || []).length > 0) {
    lines.push("## Missing HTTP Entries", "");
    for (const entry of patch.missing_http) {
      lines.push(`- \`${entry.capability_id}\` ${entry.method} \`${entry.path}\``);
    }
    lines.push("");
  }

  if ((patch.missing_screens || []).length > 0) {
    lines.push("## Missing UI Screens", "");
    for (const item of patch.missing_screens) {
      lines.push(`- \`${item}\``);
    }
    lines.push("");
  }

  if ((patch.missing_routes || []).length > 0) {
    lines.push("## Missing UI Routes", "");
    for (const entry of patch.missing_routes) {
      lines.push(`- \`${entry.screen_id}\` -> \`${entry.path}\``);
    }
    lines.push("");
  }

  if ((patch.missing_actions || []).length > 0) {
    lines.push("## Missing UI Actions", "");
    for (const entry of patch.missing_actions) {
      lines.push(`- \`${entry.capability_hint}\` on \`${entry.screen_id}\``);
    }
    lines.push("");
  }

  if ((patch.missing_auth_permissions || []).length > 0) {
    lines.push("## Inferred Permission Rules", "");
    for (const entry of patch.missing_auth_permissions) {
      lines.push(`- ${formatAuthPermissionHintInline(entry)} on ${entry.projection_surface === "visibility_rules" ? "`visibility_rules`" : "`authorization`"} for ${entry.related_capabilities.length ? entry.related_capabilities.map((item) => `\`${item}\``).join(", ") : "_no direct capability match_"}`);
      lines.push(`  - why inferred: ${entry.why_inferred || entry.explanation}`);
      lines.push(`  - review next: ${entry.review_guidance || buildAuthPermissionReviewGuidance(entry)}`);
    }
    lines.push("");
  }

  if ((patch.missing_auth_claims || []).length > 0) {
    lines.push("## Inferred Auth Claim Rules", "");
    for (const entry of patch.missing_auth_claims) {
      lines.push(`- ${formatAuthClaimHintInline(entry)} on ${entry.projection_surface === "visibility_rules" ? "`visibility_rules`" : "`authorization`"} for ${entry.related_capabilities.length ? entry.related_capabilities.map((item) => `\`${item}\``).join(", ") : "_no direct capability match_"}`);
      lines.push(`  - why inferred: ${entry.why_inferred || entry.explanation}`);
      lines.push(`  - review next: ${entry.review_guidance || buildAuthClaimReviewGuidance(entry)}`);
    }
    lines.push("");
  }

  if ((patch.missing_auth_ownerships || []).length > 0) {
    lines.push("## Inferred Ownership Rules", "");
    for (const entry of patch.missing_auth_ownerships) {
      lines.push(`- ${formatAuthOwnershipHintInline(entry)} on \`authorization\` for ${entry.related_capabilities.length ? entry.related_capabilities.map((item) => `\`${item}\``).join(", ") : "_no direct capability match_"}`);
      lines.push(`  - why inferred: ${entry.why_inferred || entry.explanation}`);
      lines.push(`  - review next: ${entry.review_guidance || buildAuthOwnershipReviewGuidance(entry)}`);
    }
    lines.push("");
  }

  lines.push("## Review Notes", "", "- Review this patch before editing canonical projection files.", "- This artifact is additive guidance only and is not auto-applied.");
  return ensureTrailingNewline(lines.join("\n"));
}

function renderDocLinkPatchDoc(patch) {
  const metadata = {
    id: `doc-link-${patch.doc_id}`,
    kind: "report",
    title: `Doc Link Update for ${titleCase(String(patch.doc_id || "").replaceAll("_", " "))}`,
    status: "inferred",
    source_of_truth: "imported",
    confidence: "medium",
    review_required: true,
    related_docs: [patch.doc_id],
    related_actors: patch.add_related_actors || [],
    related_roles: patch.add_related_roles || [],
    related_capabilities: patch.add_related_capabilities || [],
    related_rules: patch.add_related_rules || [],
    related_workflows: patch.add_related_workflows || [],
    tags: ["import", "doc-link-update"]
  };
  const lines = [
    `Target doc: \`${patch.doc_id}\` (${patch.doc_kind})`,
    "",
    "Suggested metadata updates:"
  ];
  if ((patch.add_related_actors || []).length > 0) {
    lines.push("", "```yaml", "related_actors:");
    for (const actorId of patch.add_related_actors || []) {
      lines.push(`  - ${actorId}`);
    }
    lines.push("```");
  }
  if ((patch.add_related_roles || []).length > 0) {
    lines.push("", "```yaml", "related_roles:");
    for (const roleId of patch.add_related_roles || []) {
      lines.push(`  - ${roleId}`);
    }
    lines.push("```");
  }
  if ((patch.add_related_capabilities || []).length > 0) {
    lines.push("", "```yaml", "related_capabilities:");
    for (const capabilityId of patch.add_related_capabilities || []) {
      lines.push(`  - ${capabilityId}`);
    }
    lines.push("```");
  }
  if ((patch.add_related_rules || []).length > 0) {
    lines.push("", "```yaml", "related_rules:");
    for (const ruleId of patch.add_related_rules || []) {
      lines.push(`  - ${ruleId}`);
    }
    lines.push("```");
  }
  if ((patch.add_related_workflows || []).length > 0) {
    lines.push("", "```yaml", "related_workflows:");
    for (const workflowId of patch.add_related_workflows || []) {
      lines.push(`  - ${workflowId}`);
    }
    lines.push("```");
  }
  lines.push("", patch.recommendation, "", "Review this draft update before editing the canonical doc.");
  return renderMarkdownDoc(metadata, lines.join("\n"));
}

function renderDocMetadataPatchDoc(patch) {
  const metadata = {
    id: `doc-metadata-${patch.doc_id}`,
    kind: "report",
    title: `Doc Metadata Update for ${titleCase(String(patch.doc_id || "").replaceAll("_", " "))}`,
    status: "inferred",
    source_of_truth: "imported",
    confidence: patch.imported_confidence || "medium",
    review_required: true,
    related_docs: [patch.doc_id],
    tags: ["import", "doc-metadata-update"]
  };
  const lines = [
    `Target doc: \`${patch.doc_id}\` (${patch.doc_kind})`,
    "",
    "Suggested metadata updates:"
  ];
  if (patch.summary) {
    lines.push("", "```yaml", `summary: ${JSON.stringify(patch.summary)}`, "```");
  }
  if (patch.success_outcome) {
    lines.push("", "```yaml", `success_outcome: ${JSON.stringify(patch.success_outcome)}`, "```");
  }
  if ((patch.actors || []).length > 0) {
    lines.push("", "```yaml", "actors:");
    for (const actor of patch.actors || []) {
      lines.push(`  - ${actor}`);
    }
    lines.push("```");
  }
  lines.push("", patch.recommendation, "", "Review this draft update before editing the canonical doc.");
  return renderMarkdownDoc(metadata, lines.join("\n"));
}

function summarizeBundleParticipants(bundle) {
  const actors = [...new Set((bundle.actors || []).map((entry) => entry.id_hint))];
  const roles = [...new Set((bundle.roles || []).map((entry) => entry.id_hint))];
  return {
    actors,
    roles,
    label: [...actors, ...roles].length
      ? [...actors, ...roles].map((item) => `\`${item}\``).join(", ")
      : "_none_"
  };
}

function summarizeBundleSurface(bundle, values, empty = "_none_") {
  const list = Array.isArray(values) ? values : [];
  return list.length ? list.map((item) => `\`${item}\``).join(", ") : empty;
}

function buildBundleOperatorSummary(bundle) {
  const primaryEntityId = primaryEntityIdForBundle(bundle);
  const primaryConcept =
    primaryEntityId ||
    bundle.capabilities?.[0]?.id_hint ||
    bundle.workflows?.[0]?.id_hint ||
    bundle.screens?.[0]?.id_hint ||
    bundle.enums?.[0]?.id_hint ||
    bundle.id;
  const participants = summarizeBundleParticipants(bundle);
  const capabilityIds = [...new Set((bundle.capabilities || []).map((entry) => entry.id_hint))].slice(0, 4);
  const componentIds = [...new Set((bundle.components || []).map((entry) => entry.id_hint))].slice(0, 4);
  const screenIds = [...new Set((bundle.screens || []).map((entry) => entry.id_hint))].slice(0, 4);
  const routePaths = [...new Set((bundle.uiRoutes || []).map((entry) => entry.path).filter(Boolean))].slice(0, 4);
  const workflowIds = [...new Set((bundle.workflows || []).map((entry) => entry.id_hint))].slice(0, 4);
  const authPermissionHints = bundle.authPermissionHints || inferBundleAuthPermissionHints(bundle);
  const authClaimHints = bundle.authClaimHints || inferBundleAuthClaimHints(bundle);
  const authOwnershipHints = bundle.authOwnershipHints || inferBundleAuthOwnershipHints(bundle);
  const authRoleGuidance = bundle.authRoleGuidance || inferBundleAuthRoleGuidance({
    ...bundle,
    authPermissionHints,
    authClaimHints,
    authOwnershipHints
  });
  const evidenceKinds = [
    (bundle.entities || []).length > 0 ? "entity evidence" : null,
    (bundle.capabilities || []).length > 0 ? "API capability evidence" : null,
    (bundle.components || []).length > 0 ? "UI widget evidence" : null,
    (bundle.screens || []).length > 0 || (bundle.uiRoutes || []).length > 0 ? "UI screen/route evidence" : null,
    (bundle.workflows || []).length > 0 ? "workflow evidence" : null,
    (bundle.docs || []).length > 0 ? "doc evidence" : null,
    (bundle.actors || []).length > 0 || (bundle.roles || []).length > 0 ? "actor/role evidence" : null
  ].filter(Boolean);
  const whyThisBundle =
    evidenceKinds.length > 0
      ? `This bundle exists because ${evidenceKinds.join(", ")} converges on the same ${bundle.label.toLowerCase()} concept.`
      : `This bundle exists because multiple imported signals point at the same ${bundle.label.toLowerCase()} concept.`;

  return {
    primaryConcept,
    primaryEntityId,
    participants,
    capabilityIds,
    componentIds,
    screenIds,
    routePaths,
    workflowIds,
    authPermissionHints,
    authClaimHints,
    authOwnershipHints,
    authRoleGuidance,
    authAging: bundle.operatorSummary?.authAging || null,
    authClosureSummary: buildAuthHintClosureSummary({
      authPermissionHints,
      authClaimHints,
      authOwnershipHints
    }),
    whyThisBundle
  };
}

function authClaimPatternMatches(text, patterns = []) {
  return patterns.some((pattern) => pattern.test(text));
}

function collectAuthClaimSignalMatches(entries, patterns, toText) {
  return (entries || []).filter((entry) => authClaimPatternMatches(toText(entry), patterns));
}

function formatAuthClaimValueInline(value) {
  return value == null ? "_dynamic_" : `\`${value}\``;
}

function formatAuthClaimHintInline(hint) {
  return `claim \`${hint.claim}\` = ${formatAuthClaimValueInline(hint.claim_value)} (${hint.confidence})`;
}

function formatAuthPermissionHintInline(hint) {
  return `permission \`${hint.permission}\` (${hint.confidence})`;
}

function formatAuthOwnershipHintInline(hint) {
  return `ownership \`${hint.ownership}\` field \`${hint.ownership_field}\` (${hint.confidence})`;
}

function describeAuthPermissionWhyInferred(hint) {
  const signals = [];
  if (hint?.evidence?.capability_hits) {
    signals.push(`${hint.evidence.capability_hits} secured capability match${hint.evidence.capability_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.route_hits) {
    signals.push(`${hint.evidence.route_hits} route/resource match${hint.evidence.route_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.doc_hits) {
    signals.push(`${hint.evidence.doc_hits} imported doc or policy match${hint.evidence.doc_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.provenance_hits) {
    signals.push(`${hint.evidence.provenance_hits} auth middleware or policy hint${hint.evidence.provenance_hits === 1 ? "" : "s"}`);
  }
  if (signals.length === 0) {
    return hint?.explanation || "Imported auth evidence suggests a permission rule may gate this surface.";
  }
  return `${hint?.explanation || "Imported auth evidence suggests a permission rule may gate this surface."} This inference is based on ${signals.join(", ")}.`;
}

function buildAuthPermissionReviewGuidance(hint) {
  return `Confirm whether permission \`${hint.permission}\` should gate the related auth-sensitive capabilities before promoting this bundle into canonical auth rules or UI visibility.`;
}

function describeAuthClaimWhyInferred(hint) {
  const signals = [];
  if (hint?.evidence?.capability_hits) {
    signals.push(`${hint.evidence.capability_hits} secured capability match${hint.evidence.capability_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.route_hits) {
    signals.push(`${hint.evidence.route_hits} route match${hint.evidence.route_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.participant_hits) {
    signals.push(`${hint.evidence.participant_hits} participant match${hint.evidence.participant_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.doc_hits) {
    signals.push(`${hint.evidence.doc_hits} imported doc match${hint.evidence.doc_hits === 1 ? "" : "es"}`);
  }
  if (signals.length === 0) {
    return hint?.explanation || "Imported auth-related evidence suggests this claim may matter here.";
  }
  return `${hint?.explanation || "Imported auth-related evidence suggests this claim may matter here."} This inference is based on ${signals.join(", ")}.`;
}

function buildAuthClaimReviewGuidance(hint) {
  const claimTarget = `claim \`${hint.claim}\` = ${formatAuthClaimValueInline(hint.claim_value)}`;
  return `Confirm whether ${claimTarget} should gate the related auth-sensitive capabilities before promoting this bundle into canonical auth rules or UI visibility.`;
}

function describeAuthOwnershipWhyInferred(hint) {
  const signals = [];
  if (hint?.evidence?.field_hits) {
    signals.push(`${hint.evidence.field_hits} ownership-style field match${hint.evidence.field_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.capability_hits) {
    signals.push(`${hint.evidence.capability_hits} secured lifecycle/detail capability match${hint.evidence.capability_hits === 1 ? "" : "es"}`);
  }
  if (hint?.evidence?.doc_hits) {
    signals.push(`${hint.evidence.doc_hits} imported doc match${hint.evidence.doc_hits === 1 ? "" : "es"}`);
  }
  if (signals.length === 0) {
    return hint?.explanation || "Imported field and auth evidence suggests ownership-based access control may matter here.";
  }
  return `${hint?.explanation || "Imported field and auth evidence suggests ownership-based access control may matter here."} This inference is based on ${signals.join(", ")}.`;
}

function buildAuthOwnershipReviewGuidance(hint) {
  return `Confirm whether field \`${hint.ownership_field}\` should drive \`${hint.ownership}\` access for the related auth-sensitive capabilities before promoting this bundle into canonical auth rules or UI visibility.`;
}

function formatAuthRoleGuidanceInline(entry) {
  return `role \`${entry.role_id}\` (${entry.confidence})`;
}

function buildAuthRoleReviewGuidance(entry) {
  if (entry.followup_action === "promote_role") {
    return `Promote role \`${entry.role_id}\` first, then confirm it remains the primary participant for the related auth-sensitive capabilities before promoting linked auth changes from this bundle.`;
  }
  if (entry.followup_action === "link_role_to_docs") {
    const docList = (entry.followup_doc_ids || []).length
      ? ` docs ${(entry.followup_doc_ids || []).map((item) => `\`${item}\``).join(", ")}`
      : " the existing canonical docs";
    return `Link role \`${entry.role_id}\` into${docList} before promoting more auth-sensitive changes from this bundle.`;
  }
  return `Confirm whether role \`${entry.role_id}\` should remain the primary participant for the related auth-sensitive capabilities before promoting role or auth changes from this bundle.`;
}

function formatAuthRoleFollowupInline(entry) {
  if (entry.followup_action === "promote_role") {
    return "promote role";
  }
  if (entry.followup_action === "link_role_to_docs") {
    return entry.followup_doc_ids?.length
      ? `link role to docs ${(entry.followup_doc_ids || []).map((item) => `\`${item}\``).join(", ")}`
      : "link role to docs";
  }
  return "review only";
}

function summarizeHintClosureState(items) {
  const statuses = (items || []).map((item) => item.status).filter(Boolean);
  if (statuses.length === 0) {
    return {
      closure_state: "unresolved",
      closure_reason: "No reviewed projection patch has been applied for this inferred auth hint yet."
    };
  }
  if (statuses.every((status) => status === "applied")) {
    return {
      closure_state: "adopted",
      closure_reason: "All matching projection patch actions for this inferred auth hint have been applied."
    };
  }
  if (statuses.every((status) => ["applied", "approved", "skipped"].includes(status))) {
    return {
      closure_state: "deferred",
      closure_reason: "This inferred auth hint has been reviewed or intentionally held back, but not every matching projection patch has been applied yet."
    };
  }
  return {
    closure_state: "unresolved",
    closure_reason: "At least one matching projection patch for this inferred auth hint is still blocked on review or waiting to be applied."
  };
}

function annotateBundleAuthHintClosures(bundle, planItems) {
  const bundleItems = (planItems || []).filter((item) => item.bundle === bundle.slug);
  const annotatedPermissions = (bundle.authPermissionHints || []).map((hint) => ({
    ...hint,
    ...summarizeHintClosureState(bundleItems.filter((item) =>
      item.suggested_action === "apply_projection_permission_patch" &&
      item.permission === hint.permission
    ))
  }));
  const annotatedClaims = (bundle.authClaimHints || []).map((hint) => ({
    ...hint,
    ...summarizeHintClosureState(bundleItems.filter((item) =>
      item.suggested_action === "apply_projection_auth_patch" &&
      item.claim === hint.claim &&
      item.claim_value === (Object.prototype.hasOwnProperty.call(hint, "claim_value") ? hint.claim_value : null)
    ))
  }));
  const annotatedOwnerships = (bundle.authOwnershipHints || []).map((hint) => ({
    ...hint,
    ...summarizeHintClosureState(bundleItems.filter((item) =>
      item.suggested_action === "apply_projection_ownership_patch" &&
      item.ownership === hint.ownership &&
      item.ownership_field === hint.ownership_field
    ))
  }));
  return {
    ...bundle,
    authPermissionHints: annotatedPermissions,
    authClaimHints: annotatedClaims,
    authOwnershipHints: annotatedOwnerships
  };
}

function buildAuthHintClosureSummary(bundle) {
  const hints = [
    ...(bundle.authPermissionHints || []),
    ...(bundle.authClaimHints || []),
    ...(bundle.authOwnershipHints || [])
  ];
  const counts = hints.reduce(
    (acc, hint) => {
      const state = hint.closure_state || "unresolved";
      if (state === "adopted") {
        acc.adopted += 1;
      } else if (state === "deferred") {
        acc.deferred += 1;
      } else {
        acc.unresolved += 1;
      }
      return acc;
    },
    { total: hints.length, adopted: 0, deferred: 0, unresolved: 0 }
  );
  if (counts.total === 0) {
    return {
      status: "no_auth_hints",
      label: "no auth hints",
      reason: "This bundle does not currently carry inferred permission, claim, or ownership hints.",
      ...counts
    };
  }
  if (counts.unresolved === 0 && counts.deferred === 0) {
    return {
      status: "mostly_closed",
      label: "mostly closed",
      reason: "All inferred auth hints for this bundle have been adopted into canonical projection rules.",
      ...counts
    };
  }
  if (counts.unresolved === 0) {
    return {
      status: "partially_closed",
      label: "partially closed",
      reason: "Every inferred auth hint has been reviewed, but at least one is still intentionally deferred instead of adopted.",
      ...counts
    };
  }
  return {
    status: "high_risk",
    label: "high risk",
    reason: "At least one inferred auth hint is still unresolved, so the recovered auth story for this bundle is not closed yet.",
    ...counts
  };
}

function inferBundleAuthRoleGuidance(bundle) {
  const roles = bundle.roles || [];
  if (roles.length === 0) {
    return [];
  }
  const authSensitiveCapabilities = new Set([
    ...(bundle.authPermissionHints || []).flatMap((hint) => hint.related_capabilities || []),
    ...(bundle.authClaimHints || []).flatMap((hint) => hint.related_capabilities || []),
    ...(bundle.authOwnershipHints || []).flatMap((hint) => hint.related_capabilities || [])
  ]);
  const claimPreferredRoles = new Set(
    (bundle.authClaimHints || []).flatMap((hint) => {
      if (hint.claim === "reviewer") return ["role_reviewer"];
      if (hint.claim === "tenant") return ["role_admin", "role_manager"];
      return [];
    })
  );
  const ownershipPreferredRoles = new Set(
    (bundle.authOwnershipHints || []).flatMap((hint) => {
      if (hint.ownership_field === "owner_id") return ["role_owner"];
      if (hint.ownership_field === "assignee_id") return ["role_assignee"];
      return [];
    })
  );

  return roles
    .map((role) => {
      const relatedCapabilities = [...new Set((role.related_capabilities || []).filter((capabilityId) => authSensitiveCapabilities.has(capabilityId)))];
      const directRoleMatch = claimPreferredRoles.has(role.id_hint) || ownershipPreferredRoles.has(role.id_hint);
      if (!directRoleMatch && relatedCapabilities.length === 0) {
        return null;
      }
      const reasonParts = [];
      if (directRoleMatch) {
        reasonParts.push("role naming lines up with inferred auth semantics");
      }
      if (relatedCapabilities.length > 0) {
        reasonParts.push(`${relatedCapabilities.length} related auth-sensitive capability match${relatedCapabilities.length === 1 ? "" : "es"}`);
      }
      return {
        role_id: role.id_hint,
        confidence: role.confidence || "low",
        related_capabilities: relatedCapabilities.sort(),
        related_docs: [...new Set(role.related_docs || [])].sort(),
        why_inferred: `Imported role evidence suggests \`${role.id_hint}\` is likely part of the recovered auth story because ${reasonParts.join(" and ")}.`,
        review_guidance: buildAuthRoleReviewGuidance({ role_id: role.id_hint })
      };
    })
    .filter(Boolean)
    .sort((a, b) =>
      confidenceRank(b.confidence) - confidenceRank(a.confidence) ||
      (b.related_capabilities.length - a.related_capabilities.length) ||
      a.role_id.localeCompare(b.role_id)
    );
}

function classifyBundleAuthRoleGuidance(bundle) {
  return (bundle.authRoleGuidance || []).map((entry) => {
    const matchingDocLinks = (bundle.docLinkSuggestions || [])
      .filter((item) => (item.add_related_roles || []).includes(entry.role_id));
    const hasRolePromotion = (bundle.adoptionPlan || [])
      .some((step) => step.action === "promote_role" && step.item === entry.role_id);
    const followupDocIds = matchingDocLinks.map((item) => item.doc_id).sort();
    const followupPatchPaths = matchingDocLinks.map((item) => item.patch_rel_path).filter(Boolean).sort();
    let followupAction = "review_only";
    let followupReason = "Role evidence is still thin enough that this should stay review-only until the participant story is clearer.";
    if (matchingDocLinks.length > 0 && entry.related_capabilities.length === 0) {
      followupAction = "link_role_to_docs";
      followupReason = "Imported docs already exist for this participant signal, and the safer next step is to link the role into those docs before promoting more auth-sensitive changes.";
    } else if (hasRolePromotion && (confidenceRank(entry.confidence) >= confidenceRank("medium") || entry.related_capabilities.length > 0)) {
      followupAction = "promote_role";
      followupReason = "Recovered role evidence is strong enough to promote this role candidate before adopting linked auth-sensitive changes.";
    } else if (matchingDocLinks.length > 0) {
      followupAction = "link_role_to_docs";
      followupReason = "This role already has useful canonical doc anchors, so linking the participant context into docs is the safest next step.";
    }
    const classified = {
      ...entry,
      followup_action: followupAction,
      followup_label: formatAuthRoleFollowupInline({
        ...entry,
        followup_action: followupAction,
        followup_doc_ids: followupDocIds
      }),
      followup_reason: followupReason,
      followup_doc_ids: followupDocIds,
      followup_patch_paths: followupPatchPaths
    };
    return {
      ...classified,
      review_guidance: buildAuthRoleReviewGuidance(classified)
    };
  });
}

function annotateDocLinkSuggestionsWithAuthRoleGuidance(docLinkSuggestions, authRoleGuidance) {
  const authRoleMap = new Map((authRoleGuidance || []).map((entry) => [entry.role_id, entry]));
  return (docLinkSuggestions || []).map((item) => {
    const authRoleFollowups = [...new Set(item.add_related_roles || [])]
      .map((roleId) => authRoleMap.get(roleId))
      .filter(Boolean)
      .map((entry) => ({
        role_id: entry.role_id,
        followup_action: entry.followup_action,
        followup_label: entry.followup_label
      }));
    return authRoleFollowups.length > 0
      ? { ...item, auth_role_followups: authRoleFollowups }
      : item;
  });
}

function permissionResourceStemForCapability(capability) {
  const endpointPath = normalizeOpenApiPath(capability?.endpoint?.path || "");
  const pathSegments = endpointPath
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment !== "{}");
  const firstPathSegment = idHintify(pathSegments[0] || "");
  if (firstPathSegment) {
    return firstPathSegment;
  }
  const entityId = String(capability?.entity_id || inferCapabilityEntityId(capability) || "").replace(/^entity_/, "");
  if (!entityId) {
    return "resource";
  }
  return entityId.endsWith("s") ? entityId : `${entityId}s`;
}

function singularizePermissionResource(resource) {
  return String(resource || "").endsWith("s") ? String(resource).slice(0, -1) : String(resource || "");
}

function inferPermissionActionForCapability(capability, resourceStem) {
  const capabilityId = String(capability?.id_hint || "");
  const capabilityMatch = capabilityId.match(/^cap_([^_]+)_(.+)$/);
  const resourceSingular = singularizePermissionResource(resourceStem);
  const resourcePrefixes = [resourceStem, resourceSingular].filter(Boolean);
  if (!capabilityMatch) {
    const method = String(capability?.endpoint?.method || "").toUpperCase();
    if (method === "GET") return "read";
    if (method === "POST") return "create";
    if (method === "PATCH" || method === "PUT") return "update";
    if (method === "DELETE") return "delete";
    return null;
  }
  const [, verb, remainder] = capabilityMatch;
  if (verb === "get" || verb === "list") {
    return "read";
  }
  let suffix = remainder;
  for (const prefix of resourcePrefixes) {
    if (suffix === prefix) {
      suffix = "";
      break;
    }
    if (suffix.startsWith(`${prefix}_`)) {
      suffix = suffix.slice(prefix.length + 1);
      break;
    }
  }
  if (!suffix) {
    return verb;
  }
  if (verb === "request") {
    return `request_${suffix}`;
  }
  return ["create", "update", "delete"].includes(verb) ? verb : `${verb}${suffix ? `_${suffix}` : ""}`;
}

function inferBundleAuthPermissionHints(bundle) {
  const securedCapabilities = (bundle.capabilities || []).filter((entry) => entry.auth_hint === "secured");
  if (securedCapabilities.length === 0) {
    return [];
  }

  const docEntries = bundle.docs || [];
  const grouped = new Map();
  for (const capability of securedCapabilities) {
    const resourceStem = permissionResourceStemForCapability(capability);
    const action = inferPermissionActionForCapability(capability, resourceStem);
    if (!resourceStem || !action) {
      continue;
    }
    const permission = `${resourceStem}.${action}`;
    const docPatterns = [
      new RegExp(`\\b${permission.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
      new RegExp(`\\b${resourceStem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
      new RegExp(`\\b${action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
    ];
    const docMatches = collectAuthClaimSignalMatches(
      docEntries,
      docPatterns,
      (entry) => [entry.id, entry.title, ...(entry.provenance || []), entry.body || ""].filter(Boolean).join(" ")
    );
    const provenanceText = [capability.id_hint, capability.label, capability.endpoint?.path, ...(capability.provenance || [])]
      .filter(Boolean)
      .join(" ");
    const provenanceHits = /\b(permission|policy|scope|authorize|authoriz|allow|guard|access)\b/i.test(provenanceText) ? 1 : 0;
    const existing = grouped.get(permission) || {
      permission,
      confidence: "low",
      review_required: true,
      related_capabilities: [],
      evidence: {
        capability_hits: 0,
        route_hits: 0,
        doc_hits: 0,
        provenance_hits: 0
      },
      explanation: "Secured capability naming and imported route evidence suggest this permission may gate the recovered surface."
    };
    existing.related_capabilities.push(capability.id_hint);
    existing.evidence.capability_hits += 1;
    existing.evidence.route_hits += capability.endpoint?.path ? 1 : 0;
    existing.evidence.doc_hits += docMatches.length;
    existing.evidence.provenance_hits += provenanceHits;
    const confidence = provenanceHits > 0 || docMatches.length > 0 || capability.endpoint?.path ? "medium" : "low";
    if (confidenceRank(confidence) > confidenceRank(existing.confidence)) {
      existing.confidence = confidence;
    }
    grouped.set(permission, existing);
  }

  return [...grouped.values()]
    .map((entry) => ({
      ...entry,
      related_capabilities: [...new Set(entry.related_capabilities)].sort(),
      why_inferred: describeAuthPermissionWhyInferred(entry),
      review_guidance: buildAuthPermissionReviewGuidance(entry)
    }))
    .sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence) || a.permission.localeCompare(b.permission));
}

function inferBundleAuthClaimHints(bundle) {
  const securedCapabilities = (bundle.capabilities || []).filter((entry) => entry.auth_hint === "secured");
  if (securedCapabilities.length === 0) {
    return [];
  }

  const candidates = [
    {
      claim: "reviewer",
      claim_value: "true",
      confidenceFloor: "medium",
      capabilityPatterns: [/\breviewer\b/i, /\breview\b/i, /\bapprove\b/i, /\breject\b/i, /\brevision\b/i],
      routePatterns: [/\breviewer\b/i, /\breview\b/i, /\bapprove\b/i, /\breject\b/i, /\brevision\b/i],
      participantPatterns: [/\breviewer\b/i],
      docPatterns: [/\breviewer\b/i, /\breview\b/i, /\bapprove\b/i, /\breject\b/i, /\brevision\b/i],
      explanation: "Review-oriented capability, route, or participant evidence suggests a reviewer claim may gate these actions."
    },
    {
      claim: "tenant",
      claim_value: null,
      confidenceFloor: "low",
      capabilityPatterns: [/\btenant\b/i, /\bworkspace\b/i, /\borganization\b/i, /\borg\b/i],
      routePatterns: [/\btenant\b/i, /\bworkspace\b/i, /\borganization\b/i, /\borg\b/i],
      participantPatterns: [],
      docPatterns: [/\btenant\b/i, /\bworkspace\b/i, /\borganization\b/i, /\borg\b/i],
      explanation: "Tenant or workspace naming suggests a request-scoped claim may be part of access control here."
    }
  ];

  const routeEntries = [...(bundle.uiRoutes || []), ...securedCapabilities];
  const participantEntries = [...(bundle.actors || []), ...(bundle.roles || [])];
  const docEntries = bundle.docs || [];

  return candidates
    .map((candidate) => {
      const capabilityMatches = collectAuthClaimSignalMatches(
        securedCapabilities,
        candidate.capabilityPatterns,
        (entry) => [entry.id_hint, entry.label, entry.endpoint?.path, ...(entry.provenance || [])].filter(Boolean).join(" ")
      );
      const routeMatches = collectAuthClaimSignalMatches(
        routeEntries,
        candidate.routePatterns,
        (entry) => [entry.path, entry.route_path, entry.id_hint, entry.label, ...(entry.provenance || [])].filter(Boolean).join(" ")
      );
      const participantMatches = collectAuthClaimSignalMatches(
        participantEntries,
        candidate.participantPatterns,
        (entry) => [entry.id_hint, entry.label, ...(entry.provenance || [])].filter(Boolean).join(" ")
      );
      const docMatches = collectAuthClaimSignalMatches(
        docEntries,
        candidate.docPatterns,
        (entry) => [entry.id, entry.title, ...(entry.provenance || []), entry.body || ""].filter(Boolean).join(" ")
      );
      const signalCount = [
        capabilityMatches.length > 0,
        routeMatches.length > 0,
        participantMatches.length > 0,
        docMatches.length > 0
      ].filter(Boolean).length;

      if (signalCount === 0) {
        return null;
      }
      if (candidate.claim === "reviewer" && signalCount < 2) {
        return null;
      }

      const confidence =
        participantMatches.length > 0 || (capabilityMatches.length > 0 && routeMatches.length > 0)
          ? candidate.confidenceFloor
          : "low";

      return {
        claim: candidate.claim,
        claim_value: candidate.claim_value,
        confidence,
        review_required: true,
        related_capabilities: [...new Set(capabilityMatches.map((entry) => entry.id_hint))].sort(),
        evidence: {
          capability_hits: capabilityMatches.length,
          route_hits: routeMatches.length,
          participant_hits: participantMatches.length,
          doc_hits: docMatches.length
        },
        explanation: candidate.explanation,
        why_inferred: describeAuthClaimWhyInferred({
          claim: candidate.claim,
          claim_value: candidate.claim_value,
          explanation: candidate.explanation,
          evidence: {
            capability_hits: capabilityMatches.length,
            route_hits: routeMatches.length,
            participant_hits: participantMatches.length,
            doc_hits: docMatches.length
          }
        }),
        review_guidance: buildAuthClaimReviewGuidance({
          claim: candidate.claim,
          claim_value: candidate.claim_value
        })
      };
    })
    .filter(Boolean)
    .sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence) || a.claim.localeCompare(b.claim));
}

function inferBundleAuthOwnershipHints(bundle) {
  const securedCapabilities = (bundle.capabilities || []).filter((entry) => entry.auth_hint === "secured");
  if (securedCapabilities.length === 0) {
    return [];
  }

  const entityFieldEntries = ((bundle.importedFieldEvidence || []).length > 0 ? bundle.importedFieldEvidence : (bundle.entities || []).flatMap((entity) => (entity.fields || []).map((field) => ({
    entity_id: entity.id_hint,
    name: field.name,
    field_type: field.field_type,
    required: field.required
  }))));
  const docEntries = bundle.docs || [];
  const ownershipScopedCapabilities = securedCapabilities.filter((entry) =>
    /^cap_(get|update|close|complete|archive|delete|submit|request|approve|reject)_/.test(entry.id_hint || "")
  );
  if (entityFieldEntries.length === 0 || ownershipScopedCapabilities.length === 0) {
    return [];
  }

  const candidates = [
    {
      ownership: "owner_or_admin",
      ownership_field: "owner_id",
      confidenceFloor: "medium",
      fieldPatterns: [/^owner_id$/i, /^author_id$/i],
      docPatterns: [/\bowner\b/i, /\bauthor\b/i],
      explanation: "Ownership-style field naming suggests this bundle may authorize detail or lifecycle actions based on resource ownership."
    },
    {
      ownership: "owner_or_admin",
      ownership_field: "assignee_id",
      confidenceFloor: "medium",
      fieldPatterns: [/^assignee_id$/i],
      docPatterns: [/\bassignee\b/i, /\bassigned\b/i],
      explanation: "Assignment-style field naming suggests this bundle may authorize detail or lifecycle actions based on the assigned user."
    }
  ];

  return candidates
    .map((candidate) => {
      const fieldMatches = entityFieldEntries.filter((entry) => candidate.fieldPatterns.some((pattern) => pattern.test(entry.name || "")));
      const docMatches = collectAuthClaimSignalMatches(
        docEntries,
        candidate.docPatterns,
        (entry) => [entry.id, entry.title, ...(entry.provenance || []), entry.body || ""].filter(Boolean).join(" ")
      );
      if (fieldMatches.length === 0) {
        return null;
      }
      const relatedCapabilities = ownershipScopedCapabilities.map((entry) => entry.id_hint).sort();
      const evidence = {
        field_hits: fieldMatches.length,
        capability_hits: relatedCapabilities.length,
        doc_hits: docMatches.length
      };
      return {
        ownership: candidate.ownership,
        ownership_field: candidate.ownership_field,
        confidence: candidate.confidenceFloor,
        review_required: true,
        related_capabilities: relatedCapabilities,
        related_entities: [...new Set(fieldMatches.map((entry) => entry.entity_id))].sort(),
        evidence,
        explanation: candidate.explanation,
        why_inferred: describeAuthOwnershipWhyInferred({
          ownership: candidate.ownership,
          ownership_field: candidate.ownership_field,
          explanation: candidate.explanation,
          evidence
        }),
        review_guidance: buildAuthOwnershipReviewGuidance({
          ownership: candidate.ownership,
          ownership_field: candidate.ownership_field
        })
      };
    })
    .filter(Boolean)
    .sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence) || a.ownership_field.localeCompare(b.ownership_field));
}

function bundleKeyForConcept(conceptId) {
  return slugify(String(conceptId || "").replace(/^entity_/, "").replace(/^enum_/, "")) || "candidate";
}

function getOrCreateCandidateBundle(bundles, conceptId, label) {
  const key = conceptId || `bundle_${bundles.size + 1}`;
  if (!bundles.has(key)) {
    bundles.set(key, {
      id: key,
      slug: bundleKeyForConcept(key),
      label: label || titleCase(String(key).replace(/^entity_/, "").replace(/^enum_/, "")),
      actors: [],
      roles: [],
      entities: [],
      enums: [],
      capabilities: [],
      shapes: [],
      components: [],
      screens: [],
      uiRoutes: [],
      uiActions: [],
      workflows: [],
      verifications: [],
      workflowStates: [],
      workflowTransitions: [],
      docs: [],
      projectionPatches: []
      ,
      importedFieldEvidence: []
    });
  }
  return bundles.get(key);
}

function bundleLabelFromConceptId(conceptId) {
  return titleCase(String(conceptId || "").replace(/^(entity|flow|surface)_/, ""));
}

function primaryEntityIdForBundle(bundle) {
  return (
    bundle.mergeHints?.canonicalEntityTarget ||
    bundle.entities?.[0]?.id_hint ||
    (String(bundle.id || "").startsWith("entity_") ? bundle.id : null)
  );
}

function canonicalJourneyCoverage(graph) {
  const journeyDocs = (graph?.docs || []).filter((doc) => doc.kind === "journey");
  return {
    byEntityId: new Set(journeyDocs.flatMap((doc) => doc.relatedEntities || [])),
    byCapabilityId: new Set(journeyDocs.flatMap((doc) => doc.relatedCapabilities || []))
  };
}

function buildBundleJourneyDraft(bundle) {
  const relatedCapabilities = [...new Set((bundle.capabilities || []).map((entry) => entry.id_hint))].sort();
  const relatedWorkflows = [...new Set((bundle.workflows || []).map((entry) => entry.id_hint))].sort();
  const relatedRules = collectBundleRuleIds(bundle);
  const relatedActors = [...new Set((bundle.actors || []).map((entry) => entry.id_hint))].sort();
  const relatedRoles = [...new Set((bundle.roles || []).map((entry) => entry.id_hint))].sort();
  const primaryEntityId = primaryEntityIdForBundle(bundle);
  const relatedEntities = [...new Set([primaryEntityId, ...(bundle.entities || []).map((entry) => entry.id_hint)].filter(Boolean))].slice(0, 4);
  const routePaths = [...new Set((bundle.uiRoutes || []).map((entry) => entry.path).filter(Boolean))];
  const screenIds = [...new Set((bundle.screens || []).map((entry) => entry.id_hint))];
  const screenKinds = [...new Set((bundle.screens || []).map((entry) => entry.screen_kind).filter(Boolean))];
  const createCapabilities = relatedCapabilities.filter((id) => /^cap_create_/.test(id));
  const browseCapabilities = relatedCapabilities.filter((id) => /^cap_(list|get)_/.test(id));
  const lifecycleCapabilities = relatedCapabilities.filter((id) => /^cap_(update|close|complete|archive|delete|submit|request)_/.test(id));
  const interactionCapabilities = relatedCapabilities.filter((id) => /^cap_(favorite|unfavorite|follow|unfollow|vote|like|unlike)_/.test(id));
  const authCapabilities = relatedCapabilities.filter((id) => /^cap_(sign_in|sign_out|register|authenticate|login|logout)_/.test(id));
  const participantActors = relatedActors;
  const participantRoles = relatedRoles;
  const hasListDetail = browseCapabilities.some((id) => /^cap_list_/.test(id)) && browseCapabilities.some((id) => /^cap_get_/.test(id));
  const hasCreateAndLifecycle = createCapabilities.length > 0 && lifecycleCapabilities.length > 0;
  const hasWorkflowEvidence = relatedWorkflows.length > 0;
  const flowShape =
    authCapabilities.length > 0 ? "auth" :
    hasCreateAndLifecycle && hasListDetail ? "create_browse_lifecycle" :
    hasListDetail && lifecycleCapabilities.length > 0 ? "browse_lifecycle" :
    hasListDetail ? "browse_detail" :
    createCapabilities.length > 0 ? "create" :
    lifecycleCapabilities.length > 0 ? "lifecycle" :
    interactionCapabilities.length > 0 ? "interaction" :
    hasWorkflowEvidence ? "workflow" :
    "general";
  const routeEvidence = routePaths.length > 0;
  const screenEvidence = screenIds.length > 0;
  const browsePhrase = browseCapabilities.length > 0
    ? browseCapabilities.map((item) => `\`${item}\``).join(", ")
    : createCapabilities.length > 0
      ? createCapabilities.map((item) => `\`${item}\``).join(", ")
      : relatedCapabilities.slice(0, 3).map((item) => `\`${item}\``).join(", ");
  const lifecyclePhrase = lifecycleCapabilities.length > 0
    ? lifecycleCapabilities.map((item) => `\`${item}\``).join(", ")
    : interactionCapabilities.length > 0
      ? interactionCapabilities.map((item) => `\`${item}\``).join(", ")
      : browseCapabilities.slice(0, 2).map((item) => `\`${item}\``).join(", ");
  const startSurface = routeEvidence
    ? routePaths.slice(0, 2).map((item) => `\`${item}\``).join(" or ")
    : screenEvidence
      ? screenIds.slice(0, 2).map((item) => `\`${item}\``).join(" or ")
      : `the ${bundle.label.toLowerCase()} API surface`;
  const continuationSurface = screenEvidence
    ? `${screenKinds.length > 0 ? screenKinds.join(", ") : "screen"} surfaces ${screenIds.slice(0, 3).map((item) => `\`${item}\``).join(", ")}`
    : routeEvidence
      ? `the recovered route structure around ${routePaths.slice(0, 3).map((item) => `\`${item}\``).join(", ")}`
      : `the recovered ${bundle.label.toLowerCase()} lifecycle`;
  const participantPhrase = [...participantActors, ...participantRoles].length > 0
    ? [...participantActors, ...participantRoles].map((item) => `\`${item}\``).join(", ")
    : null;
  const participantVerb = participantPhrase && participantPhrase.includes(", ") ? "enter" : "enters";
  const title =
    flowShape === "auth" ? `${bundle.label} Sign-In and Session Flow` :
    flowShape === "create_browse_lifecycle" ? `${bundle.label} Creation, Detail, and Lifecycle Flow` :
    flowShape === "browse_lifecycle" ? `${bundle.label} Detail and Lifecycle Flow` :
    flowShape === "browse_detail" ? `${bundle.label} Discovery and Detail Flow` :
    flowShape === "create" ? `${bundle.label} Creation Flow` :
    flowShape === "lifecycle" ? `${bundle.label} Lifecycle Flow` :
    flowShape === "interaction" ? `${bundle.label} Interaction Flow` :
    flowShape === "workflow" ? `${bundle.label} Workflow Flow` :
    `${bundle.label} Core Journey`;
  const intentPhrase =
    flowShape === "auth"
      ? `signing in and establishing ${bundle.label.toLowerCase()} access cleanly`
      : flowShape === "create_browse_lifecycle"
        ? `creating ${bundle.label.toLowerCase()} work, finding it again, and moving it through lifecycle changes with confidence`
        : flowShape === "browse_lifecycle"
          ? `opening ${bundle.label.toLowerCase()} detail state and progressing it safely`
          : flowShape === "browse_detail"
            ? `finding and understanding ${bundle.label.toLowerCase()} state`
            : flowShape === "create"
              ? `creating ${bundle.label.toLowerCase()} work safely`
              : flowShape === "lifecycle"
                ? `moving ${bundle.label.toLowerCase()} work through its lifecycle without losing context`
                : flowShape === "interaction"
                  ? `performing repeated ${bundle.label.toLowerCase()} interactions without losing context`
                  : `moving through the recovered ${bundle.label.toLowerCase()} flow with confidence`;
  const metadata = {
    id: `${idHintify(bundle.slug)}_journey`,
    kind: "journey",
    title,
    status: "inferred",
    summary: `Candidate ${bundle.label.toLowerCase()} journey inferred during reconcile from imported app evidence.`,
    source_of_truth: "imported",
    confidence: "medium",
    review_required: true,
    related_entities: relatedEntities,
    related_capabilities: relatedCapabilities,
    related_actors: relatedActors,
    related_roles: relatedRoles,
    related_rules: relatedRules,
    related_workflows: relatedWorkflows,
    provenance: [...collectBundleProvenance(bundle)].slice(0, 8),
    tags: ["import", "journey"]
  };
  const canonicalDestination = `docs/journeys/${metadata.id}.md`;
  const recoveredSignals = [
    `Capabilities: ${relatedCapabilities.length ? relatedCapabilities.map((item) => `\`${item}\``).join(", ") : "_none_"}`,
    `Workflows: ${relatedWorkflows.length ? relatedWorkflows.map((item) => `\`${item}\``).join(", ") : "_none_"}`,
    `Rules: ${relatedRules.length ? relatedRules.map((item) => `\`${item}\``).join(", ") : "_none_"}`,
    `Screens: ${screenIds.length ? screenIds.map((item) => `\`${item}\``).join(", ") : "_none_"}`,
    `Routes: ${routePaths.length ? routePaths.map((item) => `\`${item}\``).join(", ") : "_none_"}`
  ];
  const body = [
    "Candidate journey inferred during reconcile from imported capabilities, UI surfaces, and workflow evidence.",
    "",
    "Review and rewrite this draft before promoting it as canonical.",
    "",
    `The user intent centers on ${intentPhrase} based on the brownfield capabilities, route evidence, and workflow signals recovered for this bundle.${participantPhrase ? ` The strongest inferred participants are ${participantPhrase}.` : ""}${relatedRules.length ? ` The strongest inferred constraints come from ${relatedRules.map((item) => `\`${item}\``).join(", ")}.` : ""}`,
    "",
    "## Recovered Signals",
    "",
    ...recoveredSignals,
    "",
    "## Happy Path",
    "",
    flowShape === "auth"
      ? `1. ${participantPhrase ? `The flow begins for ${participantPhrase}` : "The user"} through ${startSurface} and provides the credentials or session input required by ${authCapabilities.map((item) => `\`${item}\``).join(", ")}.`
      : `1. ${participantPhrase ? `${participantPhrase} ${participantVerb}` : "The user enters"} the flow through ${startSurface}.`,
    flowShape === "create_browse_lifecycle"
      ? `2. The recovered flow uses ${createCapabilities.map((item) => `\`${item}\``).join(", ")} to create or submit new ${bundle.label.toLowerCase()} work, then ${browseCapabilities.map((item) => `\`${item}\``).join(", ")} to find it again.`
      : flowShape === "browse_detail"
        ? `2. The recovered flow uses ${browsePhrase || `the inferred ${bundle.label.toLowerCase()} capabilities`} to load or establish the current ${bundle.label.toLowerCase()} state.`
        : flowShape === "auth"
          ? `2. The recovered flow returns the user to the authenticated ${bundle.label.toLowerCase()} state without losing the intended next step.`
          : `2. The recovered flow uses ${browsePhrase || `the inferred ${bundle.label.toLowerCase()} capabilities`} to load or establish the current ${bundle.label.toLowerCase()} state.`,
    flowShape === "create_browse_lifecycle"
      ? `3. The user continues through ${lifecyclePhrase || `the remaining ${bundle.label.toLowerCase()} actions`} while keeping ${continuationSurface} coherent.`
      : flowShape === "interaction"
        ? `3. The user can repeat ${interactionCapabilities.map((item) => `\`${item}\``).join(", ")} while keeping ${continuationSurface} coherent.`
        : `3. The user continues through ${lifecyclePhrase || `the remaining ${bundle.label.toLowerCase()} actions`} while keeping ${continuationSurface} coherent.`,
    "",
    "## Alternate Paths",
    "",
    relatedWorkflows.length > 0
      ? `- Workflow evidence such as ${relatedWorkflows.map((item) => `\`${item}\``).join(", ")} should stay aligned with the journey instead of drifting into an undocumented lifecycle.`
      : "- If the brownfield app exposes alternate lifecycle branches, capture them explicitly before promoting this journey.",
    relatedRules.length > 0
      ? `- Rule evidence such as ${relatedRules.map((item) => `\`${item}\``).join(", ")} should remain visible in the journey instead of being lost during promotion.`
      : "- If the brownfield app enforces important constraints outside the imported model, capture them explicitly before promotion.",
    routeEvidence
      ? `- Recovered routes ${routePaths.slice(0, 3).map((item) => `\`${item}\``).join(", ")} should remain understandable to the user instead of fragmenting the flow.`
      : screenEvidence
        ? `- Recovered screens ${screenIds.slice(0, 3).map((item) => `\`${item}\``).join(", ")} should still read as one user-goal flow rather than disconnected views.`
        : "- If only API evidence exists today, add UI or docs context before promoting this journey as canonical.",
    "",
    "## Change Review Notes",
    "",
    `Review this journey when changing ${bundle.label.toLowerCase()} capabilities, screen surfaces, route structure, or workflow transitions.${relatedRules.length ? ` Re-check ${relatedRules.map((item) => `\`${item}\``).join(", ")} when those changes could weaken the recovered constraints.` : ""}`,
    "",
    "## Promotion Notes",
    "",
    `- Canonical destination: \`${canonicalDestination}\`.`,
    "- Promote this draft with `reconcile adopt journeys --write` after reviewing participants, recovered signals, and change-review notes.",
    `- Keep the promoted journey aligned with bundle \`${bundle.slug}\` so future reconcile runs continue to explain the same user-goal flow.`
  ].join("\n");

  return {
    id: metadata.id,
    kind: "journey",
    title: metadata.title,
    existing_canonical: false,
    related_entities: metadata.related_entities,
    related_capabilities: metadata.related_capabilities,
    related_actors: metadata.related_actors,
    related_roles: metadata.related_roles,
    related_rules: metadata.related_rules,
    related_workflows: metadata.related_workflows,
    provenance: metadata.provenance,
    source_of_truth: metadata.source_of_truth,
    confidence: metadata.confidence,
    status: metadata.status,
    review_required: metadata.review_required,
    tags: metadata.tags,
    metadata,
    body
  };
}

function addBundleJourneyDrafts(bundles, graph) {
  const coverage = canonicalJourneyCoverage(graph);
  for (const bundle of bundles.values()) {
    if ((bundle.docs || []).some((entry) => entry.kind === "journey")) {
      continue;
    }
    if ((bundle.capabilities || []).length === 0 && (bundle.screens || []).length === 0 && (bundle.workflows || []).length === 0) {
      continue;
    }
    const primaryEntityId = primaryEntityIdForBundle(bundle);
    if (primaryEntityId && coverage.byEntityId.has(primaryEntityId)) {
      continue;
    }
    const bundleCapabilityIds = (bundle.capabilities || []).map((entry) => entry.id_hint);
    if (bundleCapabilityIds.some((id) => coverage.byCapabilityId.has(id))) {
      continue;
    }
    bundle.docs.push(buildBundleJourneyDraft(bundle));
  }
}

function annotateBundleAuthAging(bundles, previousReport) {
  const previousBundles = new Map(
    ((previousReport?.candidate_model_bundles) || []).map((bundle) => [bundle.slug, bundle])
  );
  return (bundles || []).map((bundle) => {
    const previousBundle = previousBundles.get(bundle.slug);
    const currentSummary = buildBundleOperatorSummary(bundle);
    const previousClosureStatus = previousBundle?.operator_summary?.authClosureSummary?.status || "no_auth_hints";
    const previousRepeatCount = previousBundle?.operator_summary?.authAging?.repeatCount || 0;
    const currentClosureStatus = currentSummary.authClosureSummary.status;
    const repeatCount =
      currentClosureStatus === "high_risk"
        ? (previousClosureStatus === "high_risk" ? previousRepeatCount + 1 : 1)
        : 0;
    const escalationLevel =
      currentClosureStatus !== "high_risk"
        ? "none"
        : repeatCount >= 2
          ? "stale_high_risk"
          : "fresh_high_risk";
    const escalationReason =
      escalationLevel === "stale_high_risk"
        ? `This bundle has stayed high risk for ${repeatCount} reconcile runs in a row.`
        : escalationLevel === "fresh_high_risk"
          ? "This bundle is newly high risk in the current reconcile run."
          : "This bundle is not currently high risk.";
    return {
      ...bundle,
      operatorSummary: {
        ...currentSummary,
        authAging: {
          repeatCount,
          escalationLevel,
          escalationReason
        }
      }
    };
  });
}

function renderCandidateBundleReadme(bundle, proposalSurfaces = []) {
  const summary = buildBundleOperatorSummary(bundle);
  const journeyDrafts = (bundle.docs || []).filter((entry) => entry.kind === "journey" && entry.review_required !== false);
  const lines = [
    `# ${bundle.label} Candidate Bundle`,
    "",
    `Concept id: \`${bundle.id}\``,
    "",
    `Actors: ${bundle.actors.length}`,
    `Roles: ${bundle.roles.length}`,
    `Entities: ${bundle.entities.length}`,
    `Enums: ${bundle.enums.length}`,
    `Capabilities: ${bundle.capabilities.length}`,
    `Shapes: ${bundle.shapes.length}`,
    `Widgets: ${bundle.components.length}`,
    `Screens: ${bundle.screens.length}`,
    `UI routes: ${bundle.uiRoutes.length}`,
    `UI actions: ${bundle.uiActions.length}`,
    `Workflows: ${bundle.workflows.length}`,
    `Verifications: ${bundle.verifications.length}`,
    `Workflow states: ${bundle.workflowStates.length}`,
    `Workflow transitions: ${bundle.workflowTransitions.length}`,
    `Docs: ${bundle.docs.length}`
  ];
  lines.push(
    "",
    "## Operator Summary",
    "",
    `- Primary concept: \`${summary.primaryConcept}\``,
    `- Primary entity: ${summary.primaryEntityId ? `\`${summary.primaryEntityId}\`` : "_none_"}`,
    `- Participants: ${summary.participants.label}`,
    `- Main capabilities: ${summarizeBundleSurface(bundle, summary.capabilityIds)}`,
    `- Main widgets: ${summarizeBundleSurface(bundle, summary.componentIds)}`,
    `- Main screens: ${summarizeBundleSurface(bundle, summary.screenIds)}`,
    `- Main routes: ${summarizeBundleSurface(bundle, summary.routePaths)}`,
    `- Main workflows: ${summarizeBundleSurface(bundle, summary.workflowIds)}`,
    `- Auth permission hints: ${summary.authPermissionHints.length ? summary.authPermissionHints.map((entry) => formatAuthPermissionHintInline(entry)).join(", ") : "_none_"}`,
    `- Auth claim hints: ${summary.authClaimHints.length ? summary.authClaimHints.map((entry) => formatAuthClaimHintInline(entry)).join(", ") : "_none_"}`,
    `- Ownership hints: ${summary.authOwnershipHints.length ? summary.authOwnershipHints.map((entry) => formatAuthOwnershipHintInline(entry)).join(", ") : "_none_"}`,
    `- Auth role guidance: ${summary.authRoleGuidance.length ? summary.authRoleGuidance.map((entry) => formatAuthRoleGuidanceInline(entry)).join(", ") : "_none_"}`,
    `- Auth closure: ${summary.authClosureSummary.label} (adopted=${summary.authClosureSummary.adopted}, deferred=${summary.authClosureSummary.deferred}, unresolved=${summary.authClosureSummary.unresolved})`,
    ...(summary.authAging && summary.authAging.escalationLevel !== "none"
      ? [`- Auth escalation: ${summary.authAging.escalationLevel === "stale_high_risk" ? "escalated" : "fresh attention"} (high-risk runs=${summary.authAging.repeatCount})`]
      : []),
    "",
    "## Why This Bundle Exists",
    "",
    summary.whyThisBundle
  );
  if (summary.authPermissionHints.length > 0) {
    lines.push("", "## Auth Permission Hints", "");
    for (const hint of summary.authPermissionHints) {
      lines.push(`- ${formatAuthPermissionHintInline(hint)} <- ${hint.related_capabilities.length ? hint.related_capabilities.map((item) => `\`${item}\``).join(", ") : "_no direct capability match_"}`);
      lines.push(`  - evidence capabilities=${hint.evidence.capability_hits}, routes=${hint.evidence.route_hits}, docs=${hint.evidence.doc_hits}, provenance=${hint.evidence.provenance_hits}`);
      lines.push(`  - closure: ${hint.closure_state || "unresolved"}`);
      lines.push(`  - closure reason: ${hint.closure_reason || "No reviewed projection patch has been applied for this inferred auth hint yet."}`);
      lines.push(`  - why inferred: ${hint.why_inferred || hint.explanation}`);
      lines.push(`  - review next: ${hint.review_guidance || buildAuthPermissionReviewGuidance(hint)}`);
    }
  }
  if (summary.authClaimHints.length > 0) {
    lines.push("", "## Auth Claim Hints", "");
    for (const hint of summary.authClaimHints) {
      lines.push(`- ${formatAuthClaimHintInline(hint)} <- ${hint.related_capabilities.length ? hint.related_capabilities.map((item) => `\`${item}\``).join(", ") : "_no direct capability match_"}`);
      lines.push(`  - evidence capability=${hint.evidence.capability_hits}, route=${hint.evidence.route_hits}, participants=${hint.evidence.participant_hits}, docs=${hint.evidence.doc_hits}`);
      lines.push(`  - closure: ${hint.closure_state || "unresolved"}`);
      lines.push(`  - closure reason: ${hint.closure_reason || "No reviewed projection patch has been applied for this inferred auth hint yet."}`);
      lines.push(`  - why inferred: ${hint.why_inferred || hint.explanation}`);
      lines.push(`  - review next: ${hint.review_guidance || buildAuthClaimReviewGuidance(hint)}`);
    }
  }
  if (summary.authOwnershipHints.length > 0) {
    lines.push("", "## Auth Ownership Hints", "");
    for (const hint of summary.authOwnershipHints) {
      lines.push(`- ${formatAuthOwnershipHintInline(hint)} <- ${hint.related_capabilities.length ? hint.related_capabilities.map((item) => `\`${item}\``).join(", ") : "_no direct capability match_"}`);
      lines.push(`  - related entities: ${hint.related_entities.length ? hint.related_entities.map((item) => `\`${item}\``).join(", ") : "_none_"}`);
      lines.push(`  - evidence fields=${hint.evidence.field_hits}, capabilities=${hint.evidence.capability_hits}, docs=${hint.evidence.doc_hits}`);
      lines.push(`  - closure: ${hint.closure_state || "unresolved"}`);
      lines.push(`  - closure reason: ${hint.closure_reason || "No reviewed projection patch has been applied for this inferred auth hint yet."}`);
      lines.push(`  - why inferred: ${hint.why_inferred || hint.explanation}`);
      lines.push(`  - review next: ${hint.review_guidance || buildAuthOwnershipReviewGuidance(hint)}`);
    }
  }
  if (summary.authRoleGuidance.length > 0) {
    lines.push("", "## Auth Role Guidance", "");
    for (const entry of summary.authRoleGuidance) {
      lines.push(`- ${formatAuthRoleGuidanceInline(entry)} <- ${entry.related_capabilities.length ? entry.related_capabilities.map((item) => `\`${item}\``).join(", ") : "_role naming only_"}`);
      if (entry.related_docs.length > 0) {
        lines.push(`  - related docs: ${entry.related_docs.map((item) => `\`${item}\``).join(", ")}`);
      }
      lines.push(`  - why inferred: ${entry.why_inferred}`);
      lines.push(`  - suggested follow-up: ${entry.followup_label} (${entry.followup_reason})`);
      lines.push(`  - review next: ${entry.review_guidance}`);
    }
  }
  if (bundle.mergeHints) {
    lines.push("", "## Suggested Merge", "");
    if (bundle.mergeHints.action) {
      lines.push(`- Action: \`${bundle.mergeHints.action}\``);
    }
    if (bundle.mergeHints.canonicalEntityTarget) {
      lines.push(`- Canonical entity target: \`${bundle.mergeHints.canonicalEntityTarget}\``);
    }
    if ((bundle.mergeHints.promoteEnums || []).length > 0) {
      lines.push(`- Promote enums: ${(bundle.mergeHints.promoteEnums || []).map((item) => `\`${item}\``).join(", ")}`);
    }
    if ((bundle.mergeHints.promoteCapabilities || []).length > 0) {
      lines.push(`- Promote capabilities: ${(bundle.mergeHints.promoteCapabilities || []).map((item) => `\`${item}\``).join(", ")}`);
    }
    if ((bundle.mergeHints.promoteShapes || []).length > 0) {
      lines.push(`- Promote shapes: ${(bundle.mergeHints.promoteShapes || []).map((item) => `\`${item}\``).join(", ")}`);
    }
    if ((bundle.mergeHints.promoteActors || []).length > 0) {
      lines.push(`- Promote actors: ${(bundle.mergeHints.promoteActors || []).map((item) => `\`${item}\``).join(", ")}`);
    }
    if ((bundle.mergeHints.promoteRoles || []).length > 0) {
      lines.push(`- Promote roles: ${(bundle.mergeHints.promoteRoles || []).map((item) => `\`${item}\``).join(", ")}`);
    }
  }
  if ((bundle.adoptionPlan || []).length > 0) {
    lines.push("", "## Suggested Adoption", "");
    for (const step of bundle.adoptionPlan) {
      lines.push(`- \`${step.action}\` \`${step.item}\`${step.target ? ` -> \`${step.target}\`` : ""}`);
    }
  }
  const bundleProposalSurfaces = proposalSurfaces.filter((surface) => surface.bundle === bundle.slug && (surface.maintained_seam_candidates || []).length > 0);
  if (bundleProposalSurfaces.length > 0) {
    lines.push("", "## Candidate Maintained Seam Mappings", "");
    for (const surface of bundleProposalSurfaces) {
      lines.push(`- proposal \`${surface.id}\` (${surface.kind})`);
      for (const candidate of surface.maintained_seam_candidates || []) {
        lines.push(`  - candidate maintained seam \`${candidate.seam_id}\` -> output \`${candidate.output_id}\` (${candidate.status}, ${candidate.ownership_class}, confidence=${candidate.confidence})`);
        lines.push(`    - label ${candidate.label}`);
        lines.push(`    - kind ${candidate.kind}`);
        lines.push(`    - why matched ${candidate.match_reasons.length ? candidate.match_reasons.join("; ") : "dependency overlap with maintained seam evidence"}`);
      }
    }
  }
  if (journeyDrafts.length > 0) {
    lines.push("", "## Journey Drafts", "");
    for (const entry of journeyDrafts) {
      lines.push(`- \`${entry.id}\` (${entry.title}) -> \`docs/journeys/${entry.id}.md\``);
    }
    lines.push("- Promote reviewed journey drafts with `reconcile adopt journeys --write`.");
  }
  if ((bundle.docLinkSuggestions || []).length > 0) {
    lines.push("", "## Suggested Doc Link Updates", "");
    for (const suggestion of bundle.docLinkSuggestions) {
      lines.push(`- ${suggestion.recommendation} Draft: \`${suggestion.patch_rel_path}\``);
      if ((suggestion.auth_role_followups || []).length > 0) {
        lines.push(`  - auth role follow-up: ${suggestion.auth_role_followups.map((entry) => `${entry.followup_label} for \`${entry.role_id}\``).join(", ")}`);
      }
    }
  }
  if ((bundle.docDriftSummaries || []).length > 0) {
    lines.push("", "## Suggested Doc Drift Reviews", "");
    for (const summary of bundle.docDriftSummaries) {
      lines.push(`- ${summary.recommendation} Fields: ${summary.differing_fields.map((entry) => `\`${entry.field}\``).join(", ")}`);
    }
  }
  if ((bundle.docMetadataPatches || []).length > 0) {
    lines.push("", "## Suggested Doc Metadata Patches", "");
    for (const patch of bundle.docMetadataPatches) {
      lines.push(`- Review safe metadata patch for \`${patch.doc_id}\`. Draft: \`${patch.patch_rel_path}\``);
    }
  }
  if ((bundle.projectionImpacts || []).length > 0) {
    lines.push("", "## Projection Impacts", "");
    for (const impact of bundle.projectionImpacts) {
      lines.push(`- \`${impact.projection_id}\` (${impact.kind}) missing ${(impact.missing_capabilities || []).map((item) => `\`${item}\``).join(", ")}`);
    }
  }
  if ((bundle.uiImpacts || []).length > 0) {
    lines.push("", "## UI Impacts", "");
    for (const impact of bundle.uiImpacts) {
      lines.push(`- \`${impact.projection_id}\` missing screens ${(impact.missing_screens || []).map((item) => `\`${item}\``).join(", ")}`);
    }
  }
  if ((bundle.workflowImpacts || []).length > 0) {
    lines.push("", "## Workflow Impacts", "");
    for (const impact of bundle.workflowImpacts) {
      lines.push(`- \`${impact.review_group_id}\` requires workflow review for ${(impact.items || []).map((item) => `\`${item}\``).join(", ")}`);
    }
  }
  if ((bundle.projectionPatches || []).length > 0) {
    lines.push("", "## Projection Patch Candidates", "");
    for (const patch of bundle.projectionPatches) {
      lines.push(`- \`${patch.projection_id}\` -> \`${patch.patch_rel_path}\``);
    }
  }
  if (bundle.entities.length > 0) {
    lines.push("", "## Entity Evidence", "");
    for (const entry of bundle.entities) {
      lines.push(`- \`${entry.id_hint}\` from ${(entry.provenance || []).slice(0, 2).map((item) => `\`${item}\``).join(", ")}`);
    }
  }
  if (bundle.actors.length > 0) {
    lines.push("", "## Actor Evidence", "");
    for (const entry of bundle.actors) {
      const details = [`- \`${entry.id_hint}\` from ${(entry.provenance || []).slice(0, 2).map((item) => `\`${item}\``).join(", ")}`];
      if ((entry.related_docs || []).length > 0) {
        details.push(`related docs ${(entry.related_docs || []).map((item) => `\`${item}\``).join(", ")}`);
      }
      if ((entry.related_capabilities || []).length > 0) {
        details.push(`related capabilities ${(entry.related_capabilities || []).map((item) => `\`${item}\``).join(", ")}`);
      }
      lines.push(details.join("; "));
    }
  }
  if (bundle.roles.length > 0) {
    lines.push("", "## Role Evidence", "");
    for (const entry of bundle.roles) {
      const details = [`- \`${entry.id_hint}\` from ${(entry.provenance || []).slice(0, 2).map((item) => `\`${item}\``).join(", ")}`];
      if ((entry.related_docs || []).length > 0) {
        details.push(`related docs ${(entry.related_docs || []).map((item) => `\`${item}\``).join(", ")}`);
      }
      if ((entry.related_capabilities || []).length > 0) {
        details.push(`related capabilities ${(entry.related_capabilities || []).map((item) => `\`${item}\``).join(", ")}`);
      }
      lines.push(details.join("; "));
    }
  }
  if (bundle.capabilities.length > 0) {
    lines.push("", "## API Evidence", "");
    for (const entry of bundle.capabilities) {
      lines.push(`- \`${entry.id_hint}\` at \`${entry.endpoint?.method || "?"} ${entry.endpoint?.path || "?"}\``);
    }
  }
  if (bundle.screens.length > 0) {
    lines.push("", "## UI Evidence", "");
    for (const entry of bundle.screens) {
      lines.push(`- \`${entry.id_hint}\` ${entry.screen_kind} at \`${entry.route_path}\``);
    }
  }
  if (bundle.workflows.length > 0) {
    lines.push("", "## Workflow Evidence", "");
    for (const entry of bundle.workflows) {
      lines.push(`- \`${entry.id_hint}\` for \`${entry.entity_id}\``);
    }
  }
  if (bundle.docs.length > 0) {
    lines.push("", "## Doc Evidence", "");
    for (const entry of bundle.docs) {
      lines.push(`- \`${entry.id}\` (${entry.kind}) from ${(entry.provenance || []).slice(0, 2).map((item) => `\`${item}\``).join(", ")}`);
    }
  }
  return ensureTrailingNewline(lines.join("\n"));
}

function renderMaintainedSeamCandidatesInline(bundle) {
  const entries = bundle.maintained_seam_candidates || [];
  if (!entries.length) {
    return "_none_";
  }
  return entries
    .map((surface) => {
      const seams = (surface.maintained_seam_candidates || [])
        .map((candidate) => `\`${candidate.seam_id}\` (${candidate.status}, ${candidate.ownership_class}, confidence=${candidate.confidence})`)
        .join(", ");
      return `${surface.id}: ${seams}`;
    })
    .join("; ");
}

function buildBundleMergeHints(bundle, canonicalEntityIds) {
  const canonicalEntityTarget = bundle.id.startsWith("entity_") && canonicalEntityIds.has(bundle.id) ? bundle.id : null;
  return {
    action: canonicalEntityTarget ? "merge_into_existing_entity" : "promote_as_candidate_concept",
    canonicalEntityTarget,
    promoteActors: bundle.actors.map((entry) => entry.id_hint),
    promoteRoles: bundle.roles.map((entry) => entry.id_hint),
    promoteEnums: bundle.enums.map((entry) => entry.id_hint),
    promoteCapabilities: bundle.capabilities.map((entry) => entry.id_hint),
    promoteShapes: bundle.shapes.map((entry) => entry.id),
    promoteScreens: bundle.screens.map((entry) => entry.id_hint),
    promoteWorkflows: bundle.workflows.map((entry) => entry.id_hint),
    promoteDocs: bundle.docs.map((entry) => entry.id)
  };
}

function shapeFieldSignature(fields) {
  return [...new Set((fields || []).filter(Boolean))].sort().join("|");
}

function buildCanonicalShapeIndex(graph) {
  const bySignature = new Map();
  for (const shape of graph?.byKind.shape || []) {
    const fields = (shape.projectedFields || shape.fields || []).map((field) => field.name).filter(Boolean);
    const signature = shapeFieldSignature(fields);
    if (!signature) {
      continue;
    }
    if (!bySignature.has(signature)) {
      bySignature.set(signature, []);
    }
    bySignature.get(signature).push(shape.id);
  }
  return bySignature;
}

function capabilityEntityTargets(capability) {
  return [
    ...(capability.creates || []),
    ...(capability.updates || []),
    ...(capability.deletes || []),
    ...(capability.reads || [])
  ]
    .map((ref) => ref?.id || ref?.target?.id || null)
    .filter((id) => typeof id === "string" && id.startsWith("entity_"));
}

function projectionKindForImpact(projection) {
  if ((projection.http || []).length > 0 || projection.platform === "api_contract") {
    return "api";
  }
  if (
    (projection.uiRoutes || []).length > 0 ||
    (projection.uiWeb || []).length > 0 ||
    (projection.uiIos || []).length > 0 ||
    projection.platform === "web_surface" ||
    projection.platform === "ios_surface"
  ) {
    return "ui";
  }
  if ((projection.dbTables || []).length > 0) {
    return "db";
  }
  return "other";
}

function buildProjectionEntityIndex(graph) {
  const projections = graph?.byKind.projection || [];
  const capabilities = new Map((graph?.byKind.capability || []).map((capability) => [capability.id, capability]));
  const projectionsById = new Map(projections.map((projection) => [projection.id, projection]));
  const memo = new Map();

  function collectEntities(projectionId, stack = new Set()) {
    if (memo.has(projectionId)) {
      return memo.get(projectionId);
    }
    if (stack.has(projectionId)) {
      return new Set();
    }
    stack.add(projectionId);
    const projection = projectionsById.get(projectionId);
    const entities = new Set();
    for (const realized of projection?.realizes || []) {
      const realizedKind = realized?.target?.kind || realized?.kind || null;
      const realizedId = realized?.target?.id || realized?.id || null;
      if (realizedKind === "capability") {
        const capability = capabilities.get(realizedId);
        for (const entityId of capabilityEntityTargets(capability || {})) {
          entities.add(entityId);
        }
      } else if (realizedKind === "projection") {
        for (const entityId of collectEntities(realizedId, stack)) {
          entities.add(entityId);
        }
      }
    }
    memo.set(projectionId, entities);
    stack.delete(projectionId);
    return entities;
  }

  return projections.map((projection) => ({
    id: projection.id,
    platform: projection.platform || null,
    kind: projectionKindForImpact(projection),
    realizes: (projection.realizes || []).map((entry) => entry.id),
    entityIds: [...collectEntities(projection.id)].sort()
  }));
}

function buildBundleAdoptionPlan(bundle, canonicalShapeIndex) {
  const steps = [];
  for (const entry of bundle.actors) {
    steps.push({
      action: "promote_actor",
      item: entry.id_hint,
      target: null,
      confidence: entry.confidence || "low",
      inference_summary: entry.inference_summary || null,
      related_docs: entry.related_docs || [],
      related_capabilities: entry.related_capabilities || [],
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/actors/${entry.id_hint}.tg`,
      canonical_rel_path: `actors/${dashedTopogramId(entry.id_hint)}.tg`
    });
  }
  for (const entry of bundle.roles) {
    steps.push({
      action: "promote_role",
      item: entry.id_hint,
      target: null,
      confidence: entry.confidence || "low",
      inference_summary: entry.inference_summary || null,
      related_docs: entry.related_docs || [],
      related_capabilities: entry.related_capabilities || [],
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/roles/${entry.id_hint}.tg`,
      canonical_rel_path: `roles/${dashedTopogramId(entry.id_hint)}.tg`
    });
  }
  if (bundle.mergeHints?.canonicalEntityTarget) {
    steps.push({
      action: "merge_bundle_into_existing_entity",
      item: bundle.slug,
      target: bundle.mergeHints.canonicalEntityTarget
    });
  } else if (bundle.entities.length > 0) {
    for (const entry of bundle.entities) {
      steps.push({
        action: "promote_entity",
        item: entry.id_hint,
        target: null
      });
    }
  }
  for (const entry of bundle.enums) {
    steps.push({
      action: "promote_enum",
      item: entry.id_hint,
      target: bundle.mergeHints?.canonicalEntityTarget || null
    });
  }
  for (const entry of bundle.capabilities) {
    steps.push({
      action: bundle.mergeHints?.canonicalEntityTarget ? "merge_capability_into_existing_entity" : "promote_capability",
      item: entry.id_hint,
      target: bundle.mergeHints?.canonicalEntityTarget || null
    });
  }
  for (const entry of bundle.shapes) {
    const signature = shapeFieldSignature(entry.fields || []);
    const duplicateTargets = canonicalShapeIndex.get(signature) || [];
    if (duplicateTargets.length > 0) {
      steps.push({
        action: "skip_duplicate_shape",
        item: entry.id,
        target: duplicateTargets[0]
      });
      continue;
    }
    steps.push({
      action: "promote_shape",
      item: entry.id,
      target: bundle.mergeHints?.canonicalEntityTarget || null
    });
  }
  for (const entry of bundle.docs) {
    if (entry.existing_canonical) {
      continue;
    }
    steps.push({
      action: entry.kind === "workflow" ? "promote_workflow_doc" : "promote_doc",
      item: entry.id,
      target: null,
      doc_kind: entry.kind,
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/docs/${docDirForKind(entry.kind)}/${entry.id}.md`,
      canonical_rel_path: `docs/${docDirForKind(entry.kind)}/${entry.id}.md`
    });
  }
  for (const entry of bundle.workflows) {
    steps.push({
      action: "promote_workflow_decision",
      item: `dec_${entry.id_hint.replace(/^workflow_/, "")}`,
      target: null,
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/decisions/dec_${entry.id_hint.replace(/^workflow_/, "")}.tg`,
      canonical_rel_path: `decisions/decision-${dashedTopogramId(entry.id_hint.replace(/^workflow_/, ""))}.tg`
    });
    steps.push({
      action: "promote_workflow_doc",
      item: entry.id_hint,
      target: null,
      doc_kind: "workflow",
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/docs/workflows/${entry.id_hint}.md`,
      canonical_rel_path: `docs/workflows/${entry.id_hint}.md`
    });
  }
  for (const entry of bundle.verifications || []) {
    steps.push({
      action: "promote_verification",
      item: entry.id_hint,
      target: null,
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/verifications/${entry.id_hint}.tg`,
      canonical_rel_path: `verifications/${dashedTopogramId(entry.id_hint)}.tg`
    });
  }
  for (const entry of bundle.components || []) {
    steps.push({
      action: "promote_widget",
      item: entry.id_hint,
      target: null,
      confidence: entry.confidence || "low",
      inference_summary: entry.inference_summary || null,
      related_capabilities: [entry.data_source].filter(Boolean),
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/widgets/${entry.id_hint}.tg`,
      canonical_rel_path: `widgets/${dashedTopogramId(entry.id_hint)}.tg`
    });
  }
  for (const screen of bundle.screens) {
    steps.push({
      action: "promote_ui_report",
      item: `ui_${screen.id_hint}`,
      target: null,
      source_path: `candidates/reconcile/model/bundles/${bundle.slug}/docs/reports/ui-${screen.id_hint}.md`,
      canonical_rel_path: `docs/reports/ui-${screen.id_hint}.md`
    });
  }
  for (const patch of bundle.projectionPatches || []) {
    for (const hint of patch.missing_auth_permissions || []) {
      steps.push({
        action: "apply_projection_permission_patch",
        item: `projection_permission_patch:${patch.projection_id}:${hint.projection_surface}:${hint.permission}`,
        target: patch.projection_id,
        projection_kind: patch.kind,
        projection_surface: hint.projection_surface,
        permission: hint.permission,
        confidence: hint.confidence || "low",
        inference_summary: hint.why_inferred || hint.explanation || null,
        related_capabilities: hint.related_capabilities || [],
        source_path: `candidates/reconcile/model/bundles/${bundle.slug}/${patch.patch_rel_path}`,
        canonical_rel_path: `projections/${dashedTopogramId(patch.projection_id)}.tg`
      });
    }
    for (const hint of patch.missing_auth_claims || []) {
      steps.push({
        action: "apply_projection_auth_patch",
        item: `projection_auth_patch:${patch.projection_id}:${hint.projection_surface}:${hint.claim}`,
        target: patch.projection_id,
        projection_kind: patch.kind,
        projection_surface: hint.projection_surface,
        claim: hint.claim,
        claim_value: hint.claim_value,
        confidence: hint.confidence || "low",
        inference_summary: hint.why_inferred || hint.explanation || null,
        related_capabilities: hint.related_capabilities || [],
        source_path: `candidates/reconcile/model/bundles/${bundle.slug}/${patch.patch_rel_path}`,
        canonical_rel_path: `projections/${dashedTopogramId(patch.projection_id)}.tg`
      });
    }
    for (const hint of patch.missing_auth_ownerships || []) {
      steps.push({
        action: "apply_projection_ownership_patch",
        item: `projection_ownership_patch:${patch.projection_id}:${hint.ownership_field}`,
        target: patch.projection_id,
        projection_kind: patch.kind,
        projection_surface: "authorization",
        ownership: hint.ownership,
        ownership_field: hint.ownership_field,
        confidence: hint.confidence || "low",
        inference_summary: hint.why_inferred || hint.explanation || null,
        related_capabilities: hint.related_capabilities || [],
        source_path: `candidates/reconcile/model/bundles/${bundle.slug}/${patch.patch_rel_path}`,
        canonical_rel_path: `projections/${dashedTopogramId(patch.projection_id)}.tg`
      });
    }
  }
  return steps;
}

function buildProjectionImpacts(bundle, projectionIndex) {
  const bundleEntityIds = new Set([
    bundle.mergeHints?.canonicalEntityTarget || null,
    ...bundle.entities.map((entry) => entry.id_hint)
  ].filter(Boolean));
  if (bundle.capabilities.length === 0 || bundleEntityIds.size === 0) {
    return [];
  }
  return projectionIndex
    .filter((projection) => projection.kind === "api" || projection.kind === "ui")
    .filter((projection) => projection.entityIds.some((entityId) => bundleEntityIds.has(entityId)))
    .map((projection) => {
      const missingCapabilities = bundle.capabilities
        .map((entry) => entry.id_hint)
        .filter((id) => !projection.realizes.includes(id));
      if (missingCapabilities.length === 0) {
        return null;
      }
      return {
        projection_id: projection.id,
        platform: projection.platform,
        kind: projection.kind,
        missing_capabilities: missingCapabilities,
        reason: `Projection ${projection.id} already covers the same entity surface but does not realize these imported capabilities.`
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.projection_id.localeCompare(b.projection_id));
}

function buildUiImpacts(bundle, graph) {
  if ((bundle.screens || []).length === 0) {
    return [];
  }
  const uiProjections = (graph?.byKind.projection || []).filter((projection) => ["ui_contract", "web_surface"].includes(projection.platform));
  const bundleScreenIds = bundle.screens.map((screen) => screen.id_hint);
  return uiProjections
    .map((projection) => {
      const projectionScreens = new Set((projection.uiScreens || []).map((screen) => screen.id));
      const missingScreens = bundleScreenIds.filter((screenId) => !projectionScreens.has(screenId));
      if (missingScreens.length === 0) {
        return null;
      }
      return {
        projection_id: projection.id,
        kind: "ui",
        platform: projection.platform,
        missing_screens: missingScreens,
        reason: `UI projection ${projection.id} does not currently represent these imported screens.`
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.projection_id.localeCompare(b.projection_id));
}

function buildWorkflowImpacts(bundle, graph) {
  if ((bundle.workflows || []).length === 0) {
    return [];
  }
  const canonicalWorkflowDocs = new Set((graph?.docs || []).filter((doc) => doc.kind === "workflow").map((doc) => doc.id));
  const impacted = bundle.workflows
    .map((workflow) => workflow.id_hint)
    .filter((id) => !canonicalWorkflowDocs.has(id));
  if (impacted.length === 0) {
    return [];
  }
  return [
    {
      review_group_id: `workflow_review:${bundle.slug}`,
      kind: "workflow",
      items: impacted,
      reason: `Workflow semantics for ${bundle.slug} need canonical review before promotion.`
    }
  ];
}

function buildProjectionPatchCandidates(bundle) {
  const capabilityById = new Map((bundle.capabilities || []).map((entry) => [entry.id_hint, entry]));
  const routesByScreen = new Map();
  for (const route of bundle.uiRoutes || []) {
    const screenId = route.screen_id || route.id_hint;
    if (!routesByScreen.has(screenId)) {
      routesByScreen.set(screenId, []);
    }
    routesByScreen.get(screenId).push(route);
  }
  const actionsByScreen = new Map();
  for (const action of bundle.uiActions || []) {
    const screenId = action.screen_id || action.id_hint;
    if (!actionsByScreen.has(screenId)) {
      actionsByScreen.set(screenId, []);
    }
    actionsByScreen.get(screenId).push(action);
  }

  const patches = [];
  for (const impact of bundle.projectionImpacts || []) {
    const missingRealizes = [...(impact.missing_capabilities || [])];
    const missingHttp = impact.kind === "api"
      ? missingRealizes
          .map((capabilityId) => capabilityById.get(capabilityId))
          .filter(Boolean)
          .map((entry) => ({
            capability_id: entry.id_hint,
            method: entry.endpoint?.method || "GET",
            path: entry.endpoint?.path || "/"
          }))
      : [];
    patches.push({
      projection_id: impact.projection_id,
      kind: impact.kind,
      platform: impact.platform,
      reason: impact.reason,
      missing_realizes: missingRealizes,
      missing_http: missingHttp,
      missing_screens: [],
      missing_routes: [],
      missing_actions: []
    });
  }

  for (const impact of bundle.uiImpacts || []) {
    const existing = patches.find((patch) => patch.projection_id === impact.projection_id);
    const missingScreens = [...(impact.missing_screens || [])];
    const missingRoutes = missingScreens.flatMap((screenId) => routesByScreen.get(screenId) || []).map((route) => ({
      screen_id: route.screen_id,
      path: route.path
    }));
    const missingActions = missingScreens.flatMap((screenId) => actionsByScreen.get(screenId) || []).map((action) => ({
      screen_id: action.screen_id,
      capability_hint: action.capability_hint
    }));
    if (existing) {
      existing.missing_screens = [...new Set([...(existing.missing_screens || []), ...missingScreens])];
      existing.missing_routes = [...(existing.missing_routes || []), ...missingRoutes];
      existing.missing_actions = [...(existing.missing_actions || []), ...missingActions];
      continue;
    }
    patches.push({
      projection_id: impact.projection_id,
      kind: impact.kind,
      platform: impact.platform,
      reason: impact.reason,
      missing_realizes: [],
      missing_http: [],
      missing_screens: missingScreens,
      missing_routes: missingRoutes,
      missing_actions: missingActions
    });
  }

  for (const hint of bundle.authClaimHints || []) {
    for (const impact of bundle.projectionImpacts || []) {
      const relatedCapabilities = (impact.missing_capabilities || []).filter((capabilityId) => (hint.related_capabilities || []).includes(capabilityId));
      if (relatedCapabilities.length === 0) {
        continue;
      }
      const projectionSurface = impact.kind === "ui" ? "visibility_rules" : "authorization";
      const entry = {
        claim: hint.claim,
        claim_value: hint.claim_value,
        confidence: hint.confidence,
        review_required: true,
        explanation: hint.explanation,
        why_inferred: hint.why_inferred || describeAuthClaimWhyInferred(hint),
        review_guidance: hint.review_guidance || buildAuthClaimReviewGuidance(hint),
        related_capabilities: relatedCapabilities,
        projection_surface: projectionSurface,
        evidence: hint.evidence || {}
      };
      const existing = patches.find((patch) => patch.projection_id === impact.projection_id);
      if (existing) {
        existing.missing_auth_claims = existing.missing_auth_claims || [];
        const duplicate = existing.missing_auth_claims.some((candidate) =>
          candidate.claim === entry.claim &&
          String(candidate.claim_value || "") === String(entry.claim_value || "") &&
          candidate.projection_surface === entry.projection_surface &&
          stableStringify(candidate.related_capabilities || []) === stableStringify(entry.related_capabilities || [])
        );
        if (!duplicate) {
          existing.missing_auth_claims.push(entry);
        }
        continue;
      }
      patches.push({
        projection_id: impact.projection_id,
        kind: impact.kind,
        platform: impact.platform,
        reason: `Projection ${impact.projection_id} likely needs claim-based auth rules for the imported ${bundle.label.toLowerCase()} surface.`,
        missing_realizes: relatedCapabilities,
        missing_http: [],
        missing_screens: [],
        missing_routes: [],
        missing_actions: [],
        missing_auth_claims: [entry]
      });
    }
  }

  for (const hint of bundle.authPermissionHints || []) {
    for (const impact of bundle.projectionImpacts || []) {
      const relatedCapabilities = (impact.missing_capabilities || []).filter((capabilityId) => (hint.related_capabilities || []).includes(capabilityId));
      if (relatedCapabilities.length === 0) {
        continue;
      }
      const projectionSurface = impact.kind === "ui" ? "visibility_rules" : "authorization";
      const entry = {
        permission: hint.permission,
        confidence: hint.confidence,
        review_required: true,
        explanation: hint.explanation,
        why_inferred: hint.why_inferred || describeAuthPermissionWhyInferred(hint),
        review_guidance: hint.review_guidance || buildAuthPermissionReviewGuidance(hint),
        related_capabilities: relatedCapabilities,
        projection_surface: projectionSurface,
        evidence: hint.evidence || {}
      };
      const existing = patches.find((patch) => patch.projection_id === impact.projection_id);
      if (existing) {
        existing.missing_auth_permissions = existing.missing_auth_permissions || [];
        const duplicate = existing.missing_auth_permissions.some((candidate) =>
          candidate.permission === entry.permission &&
          candidate.projection_surface === entry.projection_surface &&
          stableStringify(candidate.related_capabilities || []) === stableStringify(entry.related_capabilities || [])
        );
        if (!duplicate) {
          existing.missing_auth_permissions.push(entry);
        }
        continue;
      }
      patches.push({
        projection_id: impact.projection_id,
        kind: impact.kind,
        platform: impact.platform,
        reason: `Projection ${impact.projection_id} likely needs permission-based auth rules for the imported ${bundle.label.toLowerCase()} surface.`,
        missing_realizes: relatedCapabilities,
        missing_http: [],
        missing_screens: [],
        missing_routes: [],
        missing_actions: [],
        missing_auth_permissions: [entry]
      });
    }
  }

  for (const hint of bundle.authOwnershipHints || []) {
    for (const impact of bundle.projectionImpacts || []) {
      if (impact.kind !== "api") {
        continue;
      }
      const relatedCapabilities = (impact.missing_capabilities || []).filter((capabilityId) => (hint.related_capabilities || []).includes(capabilityId));
      if (relatedCapabilities.length === 0) {
        continue;
      }
      const entry = {
        ownership: hint.ownership,
        ownership_field: hint.ownership_field,
        confidence: hint.confidence,
        review_required: true,
        explanation: hint.explanation,
        why_inferred: hint.why_inferred || describeAuthOwnershipWhyInferred(hint),
        review_guidance: hint.review_guidance || buildAuthOwnershipReviewGuidance(hint),
        related_capabilities: relatedCapabilities,
        related_entities: hint.related_entities || [],
        evidence: hint.evidence || {}
      };
      const existing = patches.find((patch) => patch.projection_id === impact.projection_id);
      if (existing) {
        existing.missing_auth_ownerships = existing.missing_auth_ownerships || [];
        const duplicate = existing.missing_auth_ownerships.some((candidate) =>
          candidate.ownership === entry.ownership &&
          candidate.ownership_field === entry.ownership_field &&
          stableStringify(candidate.related_capabilities || []) === stableStringify(entry.related_capabilities || [])
        );
        if (!duplicate) {
          existing.missing_auth_ownerships.push(entry);
        }
        continue;
      }
      patches.push({
        projection_id: impact.projection_id,
        kind: impact.kind,
        platform: impact.platform,
        reason: `Projection ${impact.projection_id} likely needs ownership-based auth rules for the imported ${bundle.label.toLowerCase()} surface.`,
        missing_realizes: relatedCapabilities,
        missing_http: [],
        missing_screens: [],
        missing_routes: [],
        missing_actions: [],
        missing_auth_ownerships: [entry]
      });
    }
  }

  return patches
    .map((patch) => ({
      ...patch,
      missing_auth_permissions: (patch.missing_auth_permissions || []).sort((a, b) =>
        (a.projection_surface || "").localeCompare(b.projection_surface || "") ||
        (a.permission || "").localeCompare(b.permission || "") ||
        stableStringify(a.related_capabilities || []).localeCompare(stableStringify(b.related_capabilities || []))
      ),
      missing_auth_claims: (patch.missing_auth_claims || []).sort((a, b) =>
        (a.projection_surface || "").localeCompare(b.projection_surface || "") ||
        (a.claim || "").localeCompare(b.claim || "") ||
        stableStringify(a.related_capabilities || []).localeCompare(stableStringify(b.related_capabilities || []))
      ),
      missing_auth_ownerships: (patch.missing_auth_ownerships || []).sort((a, b) =>
        (a.ownership_field || "").localeCompare(b.ownership_field || "") ||
        stableStringify(a.related_capabilities || []).localeCompare(stableStringify(b.related_capabilities || []))
      ),
      patch_rel_path: `projection-patches/${patch.projection_id}.md`
    }))
    .sort((a, b) => a.projection_id.localeCompare(b.projection_id));
}

function bundleNoiseSuppressionReason(bundle) {
  if ((bundle.actors || []).length > 0 || (bundle.roles || []).length > 0 || (bundle.capabilities || []).length > 0 || (bundle.workflows || []).length > 0 || (bundle.docs || []).length > 0 || (bundle.screens || []).length > 0) {
    return null;
  }
  const noiseEntities = (bundle.entities || []).filter((entry) => entry.noise_candidate);
  if (noiseEntities.length === 0) {
    return null;
  }
  if (noiseEntities.length === (bundle.entities || []).length) {
    return noiseEntities[0].noise_reason || "Rails implementation-noise bundle.";
  }
  return null;
}

function provenanceList(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

function collectBundleProvenance(bundle) {
  const values = new Set();
  for (const entry of bundle.docs || []) {
    for (const provenance of provenanceList(entry.provenance)) values.add(provenance);
  }
  for (const entry of bundle.workflows || []) {
    for (const provenance of provenanceList(entry.provenance)) values.add(provenance);
  }
  for (const entry of bundle.capabilities || []) {
    for (const provenance of provenanceList(entry.provenance)) values.add(provenance);
  }
  for (const entry of bundle.screens || []) {
    for (const provenance of provenanceList(entry.provenance)) values.add(provenance);
  }
  for (const entry of bundle.entities || []) {
    for (const provenance of provenanceList(entry.provenance)) values.add(provenance);
  }
  return values;
}

function contextualEvidenceScore(bundle) {
  return (
    (bundle.docs || []).length * 4 +
    (bundle.workflows || []).length * 4 +
    (bundle.capabilities || []).length * 3 +
    (bundle.screens || []).length * 2 +
    (bundle.entities || []).length * 2
  );
}

function collectBundleDocIds(bundle) {
  return new Set((bundle.docs || []).map((entry) => entry.id));
}

function collectBundleCapabilityIds(bundle) {
  return new Set([
    ...(bundle.capabilities || []).map((entry) => entry.id_hint),
    ...(bundle.verifications || []).flatMap((entry) => entry.related_capabilities || [])
  ]);
}

function collectBundleRuleIds(bundle) {
  return [...new Set([
    ...(bundle.docs || []).flatMap((entry) => entry.related_rules || []),
    ...(bundle.docLinkSuggestions || []).flatMap((entry) => entry.add_related_rules || []),
    ...(bundle.docMetadataPatches || []).flatMap((entry) => entry.related_rules || [])
  ])].sort();
}

function bestContextBundleForCandidate(bundles, candidate) {
  const candidateProvenance = new Set(provenanceList(candidate.provenance));
  const relatedDocs = new Set(candidate.related_docs || []);
  const relatedCapabilities = new Set(candidate.related_capabilities || []);
  let best = null;
  for (const bundle of bundles.values()) {
    const evidenceScore = contextualEvidenceScore(bundle);
    if (evidenceScore === 0) {
      continue;
    }
    const provenanceOverlap = candidateProvenance.size > 0
      ? [...candidateProvenance].filter((item) => collectBundleProvenance(bundle).has(item)).length
      : 0;
    const docLinkOverlap = relatedDocs.size > 0
      ? [...relatedDocs].filter((item) => collectBundleDocIds(bundle).has(item)).length
      : 0;
    const capabilityLinkOverlap = relatedCapabilities.size > 0
      ? [...relatedCapabilities].filter((item) => collectBundleCapabilityIds(bundle).has(item)).length
      : 0;
    if (provenanceOverlap === 0 && docLinkOverlap === 0 && capabilityLinkOverlap === 0) {
      continue;
    }
    const score = docLinkOverlap * 1000 + capabilityLinkOverlap * 750 + provenanceOverlap * 100 + evidenceScore;
    if (!best || score > best.score || (score === best.score && bundle.slug.localeCompare(best.bundle.slug) < 0)) {
      best = { bundle, score };
    }
  }
  return best?.bundle || null;
}

function buildCandidateModelBundles(graph, appImport, topogramRoot) {
  const dbCandidates = appImport.candidates.db || { entities: [], enums: [] };
  const apiCandidates = appImport.candidates.api || { capabilities: [] };
  const uiCandidates = appImport.candidates.ui || { screens: [], routes: [], actions: [], components: [] };
  const workflowCandidates = appImport.candidates.workflows || { workflows: [], workflow_states: [], workflow_transitions: [] };
  const verificationCandidates = appImport.candidates.verification || { verifications: [], scenarios: [], frameworks: [], scripts: [] };
  const docCandidates = appImport.candidates.docs || [];
  const actorCandidates = appImport.candidates.actors || [];
  const roleCandidates = appImport.candidates.roles || [];
  const knownEnums = new Set((dbCandidates.enums || []).map((entry) => entry.id_hint));
  const canonicalActorIds = new Set((graph?.byKind.actor || []).map((entry) => entry.id));
  const canonicalRoleIds = new Set((graph?.byKind.role || []).map((entry) => entry.id));
  const canonicalEntityIds = new Set((graph?.byKind.entity || []).map((entry) => entry.id));
  const canonicalEnumIds = new Set((graph?.byKind.enum || []).map((entry) => entry.id));
  const canonicalComponentIds = new Set((graph?.byKind.component || []).map((entry) => entry.id));
  const canonicalUi = collectCanonicalUiSurface(graph || { byKind: { projection: [] } });
  const canonicalWorkflow = collectCanonicalWorkflowSurface(graph || { byKind: { decision: [] }, docs: [] });
  const canonicalDocsByKind = new Map();
  for (const doc of graph?.docs || []) {
    if (!canonicalDocsByKind.has(doc.kind)) {
      canonicalDocsByKind.set(doc.kind, new Set());
    }
    canonicalDocsByKind.get(doc.kind).add(doc.id);
  }
  const topogramApiCapabilities = graph ? buildTopogramApiCapabilityIndex(graph) : [];
  const canonicalShapeIndex = buildCanonicalShapeIndex(graph);
  const canonicalVerificationIds = new Set((graph?.byKind.verification || []).map((entry) => entry.id));
  const projectionIndex = buildProjectionEntityIndex(graph);
  const bundles = new Map();
  const enumCandidatesById = new Map((dbCandidates.enums || []).map((entry) => [entry.id_hint, entry]));
  const verificationScenariosByVerificationId = new Map();
  for (const scenario of verificationCandidates.scenarios || []) {
    const bucket = verificationScenariosByVerificationId.get(scenario.verification_id) || [];
    bucket.push(scenario);
    verificationScenariosByVerificationId.set(scenario.verification_id, bucket);
  }

  for (const entry of dbCandidates.enums || []) {
    if (canonicalEnumIds.has(entry.id_hint)) continue;
    getOrCreateCandidateBundle(bundles, `enum_${entry.id_hint}`, titleCase(entry.id_hint)).enums.push(entry);
  }
  for (const entry of dbCandidates.entities || []) {
    const bundle = getOrCreateCandidateBundle(bundles, entry.id_hint, entry.label);
    bundle.importedFieldEvidence = [
      ...(bundle.importedFieldEvidence || []),
      ...((entry.fields || []).map((field) => ({
        entity_id: entry.id_hint,
        name: field.name,
        field_type: field.field_type,
        required: field.required
      })))
    ];
    if (!canonicalEntityIds.has(entry.id_hint)) {
      bundle.entities.push(entry);
    }
    for (const field of entry.fields || []) {
      const enumId = idHintify(field.field_type);
      const enumEntry = enumCandidatesById.get(enumId);
      if (!enumEntry || canonicalEnumIds.has(enumId)) {
        continue;
      }
      if (!bundle.enums.some((candidate) => candidate.id_hint === enumId)) {
        bundle.enums.push(enumEntry);
      }
      bundles.delete(`enum_${enumId}`);
    }
  }
  for (const entry of apiCandidates.capabilities || []) {
    const matchedCapability = graph ? matchImportedApiCapability(entry, topogramApiCapabilities) : null;
    if (matchedCapability) {
      continue;
    }
    const conceptId = inferCapabilityEntityId(entry);
    const bundle = getOrCreateCandidateBundle(bundles, conceptId, titleCase(conceptId.replace(/^entity_/, "")));
    bundle.capabilities.push(entry);
    const inputFields = entry.input_fields || [];
    const outputFields = entry.output_fields || [];
    if (inputFields.length > 0) {
      bundle.shapes.push({
        id: shapeIdForCapability(entry, "input"),
        label: `${titleCase(entry.id_hint.replace(/^cap_/, ""))} Input`,
        fields: inputFields
      });
    }
    if (outputFields.length > 0) {
      bundle.shapes.push({
        id: shapeIdForCapability(entry, "output"),
        label: `${titleCase(entry.id_hint.replace(/^cap_/, ""))} Output`,
        fields: outputFields
      });
    }
  }
  for (const entry of uiCandidates.screens || []) {
    if (canonicalUi.screens.includes(entry.id_hint)) {
      continue;
    }
    const conceptId = entry.entity_id || entry.concept_id || `entity_${canonicalCandidateTerm(entry.id_hint)}`;
    const bundle = getOrCreateCandidateBundle(bundles, conceptId, bundleLabelFromConceptId(conceptId || entry.id_hint));
    bundle.screens.push(entry);
  }
  for (const entry of uiCandidates.routes || []) {
    if (canonicalUi.routes.includes(entry.path)) {
      continue;
    }
    const conceptId = entry.entity_id || entry.concept_id || `entity_${canonicalCandidateTerm(entry.screen_id || entry.id_hint)}`;
    const bundle = getOrCreateCandidateBundle(bundles, conceptId, bundleLabelFromConceptId(conceptId || entry.screen_id || entry.id_hint));
    bundle.uiRoutes.push(entry);
  }
  for (const entry of uiCandidates.actions || []) {
    const conceptId = entry.entity_id || entry.concept_id || `entity_${canonicalCandidateTerm(entry.screen_id || entry.id_hint)}`;
    const bundle = getOrCreateCandidateBundle(bundles, conceptId, bundleLabelFromConceptId(conceptId || entry.screen_id || entry.id_hint));
    bundle.uiActions.push(entry);
  }
  function componentConceptId(entry) {
    if (entry.entity_id || entry.concept_id) {
      return entry.entity_id || entry.concept_id;
    }
    const screenStem = String(entry.screen_id || entry.id_hint || "")
      .replace(/_(list|index|table|grid|results)$/, "")
      .replace(/^list_/, "");
    return `entity_${canonicalCandidateTerm(screenStem || entry.id_hint)}`;
  }

  for (const entry of uiCandidates.components || []) {
    if (canonicalComponentIds.has(entry.id_hint)) {
      continue;
    }
    const conceptId = componentConceptId(entry);
    const bundle = getOrCreateCandidateBundle(bundles, conceptId, bundleLabelFromConceptId(conceptId || entry.screen_id || entry.id_hint));
    bundle.components.push(entry);
  }
  for (const entry of workflowCandidates.workflows || []) {
    if (canonicalWorkflow.workflow_docs.includes(entry.id_hint)) {
      continue;
    }
    const bundle = getOrCreateCandidateBundle(bundles, entry.entity_id || `entity_${canonicalCandidateTerm(entry.id_hint)}`, titleCase((entry.entity_id || entry.id_hint).replace(/^entity_/, "")));
    bundle.workflows.push(entry);
  }
  for (const entry of workflowCandidates.workflow_states || []) {
    if (canonicalWorkflow.workflow_docs.includes(entry.workflow_id)) {
      continue;
    }
    const bundle = getOrCreateCandidateBundle(bundles, entry.entity_id || `entity_${canonicalCandidateTerm(entry.workflow_id || entry.id_hint)}`, titleCase((entry.entity_id || entry.workflow_id || entry.id_hint).replace(/^entity_/, "")));
    bundle.workflowStates.push(entry);
  }
  for (const entry of workflowCandidates.workflow_transitions || []) {
    if (canonicalWorkflow.workflow_docs.includes(entry.workflow_id)) {
      continue;
    }
    const bundle = getOrCreateCandidateBundle(bundles, entry.entity_id || `entity_${canonicalCandidateTerm(entry.workflow_id || entry.id_hint)}`, titleCase((entry.entity_id || entry.workflow_id || entry.id_hint).replace(/^entity_/, "")));
    bundle.workflowTransitions.push(entry);
  }
  for (const entry of verificationCandidates.verifications || []) {
    if (canonicalVerificationIds.has(entry.id_hint)) {
      continue;
    }
    const relatedCapabilityId =
      entry.related_capabilities?.[0] ||
      verificationScenariosByVerificationId.get(entry.id_hint)?.flatMap((scenario) => scenario.related_capabilities || [])[0] ||
      null;
    const conceptId = relatedCapabilityId
      ? inferCapabilityEntityId({
          id_hint: relatedCapabilityId,
          endpoint: { path: `/${relatedCapabilityId.replace(/^cap_(create|get|update|delete|list|complete|close|approve|reject|request_revision|export|download)_/, "").replace(/_/g, "-")}` }
        })
      : `surface_${canonicalCandidateTerm(entry.id_hint)}`;
    const bundle = getOrCreateCandidateBundle(bundles, conceptId, bundleLabelFromConceptId(conceptId || entry.id_hint));
    bundle.verifications.push({
      ...entry,
      scenarios: verificationScenariosByVerificationId.get(entry.id_hint) || []
    });
  }
  for (const entry of docCandidates || []) {
    const hasCanonicalDoc = (canonicalDocsByKind.get(entry.kind) || new Set()).has(entry.id);
    const canonicalEntityHint = `entity_${canonicalCandidateTerm(entry.id)}`;
    const semanticallyAnchored =
      (entry.related_entities || []).length > 0 ||
      (entry.related_capabilities || []).length > 0 ||
      canonicalEntityIds.has(canonicalEntityHint);
    if (!semanticallyAnchored && entry.kind !== "workflow") {
      continue;
    }
    const conceptId = semanticallyAnchored
      ? (
          entry.related_entities?.[0] ||
          (entry.related_capabilities?.[0] ? inferCapabilityEntityId({ id_hint: entry.related_capabilities[0], endpoint: { path: `/${entry.related_capabilities[0].replace(/^cap_(create|get|update|delete|list)_/, "").replace(/_/g, "-")}` } }) : `entity_${canonicalCandidateTerm(entry.id)}`)
        )
      : `flow_${canonicalCandidateTerm(entry.id)}`;
    const bundle = getOrCreateCandidateBundle(bundles, conceptId, titleCase(conceptId.replace(/^(entity|flow)_/, "")));
    bundle.docs.push({
      ...entry,
      existing_canonical: hasCanonicalDoc
    });
  }
  for (const entry of actorCandidates || []) {
    if (canonicalActorIds.has(entry.id_hint)) continue;
    const contextualBundle = bestContextBundleForCandidate(bundles, entry);
    (contextualBundle || getOrCreateCandidateBundle(bundles, entry.id_hint, entry.label)).actors.push(entry);
  }
  for (const entry of roleCandidates || []) {
    if (canonicalRoleIds.has(entry.id_hint)) continue;
    const contextualBundle = bestContextBundleForCandidate(bundles, entry);
    (contextualBundle || getOrCreateCandidateBundle(bundles, entry.id_hint, entry.label)).roles.push(entry);
  }

  addBundleJourneyDrafts(bundles, graph);

  const suppressedNoiseBundles = [];
  const finalizedBundles = [...bundles.values()]
    .filter((bundle) =>
      bundle.actors.length > 0 ||
      bundle.roles.length > 0 ||
      bundle.entities.length > 0 ||
      bundle.enums.length > 0 ||
      bundle.capabilities.length > 0 ||
      bundle.shapes.length > 0 ||
      bundle.components.length > 0 ||
      bundle.screens.length > 0 ||
      bundle.uiRoutes.length > 0 ||
      bundle.uiActions.length > 0 ||
      bundle.workflows.length > 0 ||
      bundle.verifications.length > 0 ||
      bundle.workflowStates.length > 0 ||
      bundle.workflowTransitions.length > 0
    )
    .map((bundle) => {
      const sortedBundle = {
        ...bundle,
        actors: bundle.actors.sort((a, b) => a.id_hint.localeCompare(b.id_hint)),
        roles: bundle.roles.sort((a, b) => a.id_hint.localeCompare(b.id_hint)),
        entities: bundle.entities.sort((a, b) => a.id_hint.localeCompare(b.id_hint)),
        enums: bundle.enums.sort((a, b) => a.id_hint.localeCompare(b.id_hint)),
        capabilities: bundle.capabilities.sort((a, b) => a.id_hint.localeCompare(b.id_hint)),
        shapes: bundle.shapes.sort((a, b) => a.id.localeCompare(b.id)),
        components: bundle.components.sort((a, b) => a.id_hint.localeCompare(b.id_hint)),
        screens: bundle.screens.sort((a, b) => a.id_hint.localeCompare(b.id_hint)),
        uiRoutes: bundle.uiRoutes.sort((a, b) => a.id_hint.localeCompare(b.id_hint)),
        uiActions: bundle.uiActions.sort((a, b) => a.id_hint.localeCompare(b.id_hint)),
        workflows: bundle.workflows.sort((a, b) => a.id_hint.localeCompare(b.id_hint)),
        verifications: bundle.verifications.sort((a, b) => a.id_hint.localeCompare(b.id_hint)),
        workflowStates: bundle.workflowStates.sort((a, b) => a.id_hint.localeCompare(b.id_hint)),
        workflowTransitions: bundle.workflowTransitions.sort((a, b) => a.id_hint.localeCompare(b.id_hint)),
        docs: bundle.docs.sort((a, b) => a.id.localeCompare(b.id))
      };
      const mergeHints = buildBundleMergeHints(sortedBundle, canonicalEntityIds);
      const projectionImpacts = buildProjectionImpacts({ ...sortedBundle, mergeHints }, projectionIndex);
      const uiImpacts = buildUiImpacts(sortedBundle, graph);
      const workflowImpacts = buildWorkflowImpacts(sortedBundle, graph);
      const authPermissionHints = inferBundleAuthPermissionHints(sortedBundle);
      const authClaimHints = inferBundleAuthClaimHints(sortedBundle);
      const authOwnershipHints = inferBundleAuthOwnershipHints(sortedBundle);
      const authRoleGuidance = inferBundleAuthRoleGuidance({
        ...sortedBundle,
        authPermissionHints,
        authClaimHints,
        authOwnershipHints
      });
      const docLinkSuggestions = buildBundleDocLinkSuggestions(sortedBundle, graph);
      const enrichedBundle = {
        ...sortedBundle,
        mergeHints,
        projectionImpacts,
        uiImpacts,
        workflowImpacts,
        authPermissionHints,
        authClaimHints,
        authOwnershipHints,
        authRoleGuidance,
        docLinkSuggestions,
        docDriftSummaries: buildBundleDocDriftSummariesReconcile(sortedBundle, graph, topogramRoot, confidenceRank, readTextIfExists),
        docMetadataPatches: []
      };
      const projectionPatches = buildProjectionPatchCandidates(enrichedBundle);
      const adoptionPlan = buildBundleAdoptionPlan({ ...enrichedBundle, projectionPatches }, canonicalShapeIndex);
      const classifiedAuthRoleGuidance = classifyBundleAuthRoleGuidance({ ...enrichedBundle, projectionPatches, adoptionPlan });
      return {
        ...enrichedBundle,
        authRoleGuidance: classifiedAuthRoleGuidance,
        docLinkSuggestions: annotateDocLinkSuggestionsWithAuthRoleGuidance(docLinkSuggestions, classifiedAuthRoleGuidance),
        projectionPatches,
        adoptionPlan
      };
    })
    .map((bundle) => ({
      ...bundle,
      docMetadataPatches: buildBundleDocMetadataPatchesReconcile(bundle, confidenceRank)
    }))
    .filter((bundle) => {
      const reason = bundleNoiseSuppressionReason(bundle);
      if (!reason) {
        return true;
      }
      suppressedNoiseBundles.push({
        slug: bundle.slug,
        id: bundle.id,
        reason
      });
      return false;
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
  return { bundles: finalizedBundles, suppressedNoiseBundles };
}

function buildCandidateModelFiles(graph, appImport, topogramRoot) {
  const files = {};
  const { bundles, suppressedNoiseBundles } = buildCandidateModelBundles(graph, appImport, topogramRoot);
  const knownEnums = new Set(
    bundles.flatMap((bundle) => bundle.enums.map((entry) => entry.id_hint))
  );

  for (const bundle of bundles) {
    const bundleRoot = `candidates/reconcile/model/bundles/${bundle.slug}`;
    files[`${bundleRoot}/README.md`] = renderCandidateBundleReadme(bundle);
    for (const entry of bundle.actors) {
      files[`${bundleRoot}/actors/${entry.id_hint}.tg`] = renderCandidateActor(entry);
    }
    for (const entry of bundle.roles) {
      files[`${bundleRoot}/roles/${entry.id_hint}.tg`] = renderCandidateRole(entry);
    }
    for (const entry of bundle.enums) {
      files[`${bundleRoot}/enums/${entry.id_hint}.tg`] = renderCandidateEnum(entry);
    }
    for (const entry of bundle.entities) {
      files[`${bundleRoot}/entities/${entry.id_hint}.tg`] = renderCandidateEntity(entry, knownEnums);
    }
    for (const shape of bundle.shapes) {
      files[`${bundleRoot}/shapes/${shape.id}.tg`] = renderCandidateShape(shape.id, shape.label, shape.fields);
    }
    for (const entry of bundle.capabilities) {
      const inputShapeId = bundle.shapes.find((shape) => shape.id === shapeIdForCapability(entry, "input")) ? shapeIdForCapability(entry, "input") : null;
      const outputShapeId = bundle.shapes.find((shape) => shape.id === shapeIdForCapability(entry, "output")) ? shapeIdForCapability(entry, "output") : null;
      files[`${bundleRoot}/capabilities/${entry.id_hint}.tg`] = renderCandidateCapability(entry, inputShapeId, outputShapeId);
    }
    for (const entry of bundle.verifications || []) {
      files[`${bundleRoot}/verifications/${entry.id_hint}.tg`] = renderCandidateVerification(entry, entry.scenarios || []);
    }
    for (const entry of bundle.components || []) {
      files[`${bundleRoot}/widgets/${entry.id_hint}.tg`] = renderCandidateComponent(entry);
    }
    for (const entry of bundle.docs) {
      if (entry.existing_canonical) {
        continue;
      }
      const docDir = docDirForKind(entry.kind);
      files[`${bundleRoot}/docs/${docDir}/${entry.id}.md`] = renderMarkdownDoc(
        entry.metadata || {
          id: entry.id,
          kind: entry.kind,
          title: entry.title,
          status: "inferred",
          source_of_truth: entry.source_of_truth || "imported",
          confidence: entry.confidence || "low",
          review_required: true,
          related_entities: entry.related_entities || [],
          related_capabilities: entry.related_capabilities || [],
          related_actors: entry.related_actors || [],
          related_roles: entry.related_roles || [],
          related_rules: entry.related_rules || [],
          related_workflows: entry.related_workflows || [],
          provenance: entry.provenance || [],
          tags: entry.tags || ["import", entry.kind]
        },
        entry.body || "Candidate imported doc."
      );
    }
    for (const entry of bundle.workflows) {
      const states = bundle.workflowStates.filter((state) => state.workflow_id === entry.id_hint);
      const transitions = bundle.workflowTransitions.filter((transition) => transition.workflow_id === entry.id_hint);
      files[`${bundleRoot}/docs/workflows/${entry.id_hint}.md`] = renderCandidateWorkflowDoc(entry, states, transitions);
      files[`${bundleRoot}/decisions/dec_${entry.id_hint.replace(/^workflow_/, "")}.tg`] = renderCandidateWorkflowDecision(entry, states, transitions);
    }
    for (const screen of bundle.screens) {
      const routes = bundle.uiRoutes.filter((route) => route.screen_id === screen.id_hint);
      const actions = bundle.uiActions.filter((action) => action.screen_id === screen.id_hint);
      files[`${bundleRoot}/docs/reports/ui-${screen.id_hint}.md`] = renderCandidateUiReportDoc(screen, routes, actions);
    }
    for (const patch of bundle.projectionPatches || []) {
      files[`${bundleRoot}/${patch.patch_rel_path}`] = renderProjectionPatchDoc(patch);
    }
    for (const patch of bundle.docLinkSuggestions || []) {
      files[`${bundleRoot}/${patch.patch_rel_path}`] = renderDocLinkPatchDoc(patch);
    }
    for (const patch of bundle.docMetadataPatches || []) {
      files[`${bundleRoot}/${patch.patch_rel_path}`] = renderDocMetadataPatchDoc(patch);
    }
  }

  return { files, bundles, suppressedNoiseBundles };
}

function dashedTopogramId(id) {
  return String(id || "").replaceAll("_", "-");
}

function canonicalRelativePathForItem(kind, item) {
  switch (kind) {
    case "actor":
      return `actors/${dashedTopogramId(item)}.tg`;
    case "role":
      return `roles/${dashedTopogramId(item)}.tg`;
    case "enum":
      return `enums/enum-${dashedTopogramId(String(item || "").replace(/^enum_/, ""))}.tg`;
    case "entity":
      return `entities/${dashedTopogramId(item)}.tg`;
    case "shape":
      return `shapes/${dashedTopogramId(item)}.tg`;
    case "capability":
      return `capabilities/${dashedTopogramId(item)}.tg`;
    case "widget":
      return `widgets/${dashedTopogramId(item)}.tg`;
    case "verification":
      return `verifications/${dashedTopogramId(item)}.tg`;
    default:
      return null;
  }
}

function canonicalDisplayPathForItem(kind, item) {
  const relativePath = canonicalRelativePathForItem(kind, item);
  return relativePath ? `topogram/${relativePath}` : null;
}

function candidateSourcePathForItem(bundle, kind, item) {
  const base = `candidates/reconcile/model/bundles/${bundle.slug}`;
  switch (kind) {
    case "actor":
      return `${base}/actors/${item}.tg`;
    case "role":
      return `${base}/roles/${item}.tg`;
    case "enum":
      return `${base}/enums/${item}.tg`;
    case "entity":
      return `${base}/entities/${item}.tg`;
    case "shape":
      return `${base}/shapes/${item}.tg`;
    case "capability":
      return `${base}/capabilities/${item}.tg`;
    case "widget":
      return `${base}/widgets/${item}.tg`;
    case "verification":
      return `${base}/verifications/${item}.tg`;
    default:
      return `${base}/README.md`;
  }
}

function reasonForAdoptionItem(step) {
  switch (step.action) {
    case "promote_actor":
      return "Promote this imported actor into canonical Topogram.";
    case "promote_role":
      return "Promote this imported role into canonical Topogram.";
    case "promote_entity":
      return "No canonical entity exists for this imported concept.";
    case "promote_enum":
      return step.target ? `Promote this enum to support merged concept ${step.target}.` : "Promote this imported enum into canonical Topogram.";
    case "promote_shape":
      return step.target ? `Promote this shape to support concept ${step.target}.` : "Promote this imported shape into canonical Topogram.";
    case "promote_capability":
      return "Promote this imported capability into canonical Topogram.";
    case "promote_widget":
      return "Promote this imported reusable UI widget into canonical Topogram.";
    case "merge_capability_into_existing_entity":
      return `Adopt this capability while preserving the existing canonical entity ${step.target}.`;
    case "promote_doc":
      return "Promote this imported companion doc into canonical Topogram docs.";
    case "promote_workflow_doc":
      return "Promote this imported workflow doc into canonical Topogram workflow docs.";
    case "promote_workflow_decision":
      return "Promote this imported workflow decision into canonical Topogram decisions.";
    case "promote_verification":
      return "Promote this imported verification into canonical Topogram verifications.";
    case "promote_ui_report":
      return "Promote this imported UI review report into canonical Topogram docs.";
    case "apply_projection_permission_patch":
      return `Apply inferred permission-based auth rules to canonical projection ${step.target}.`;
    case "apply_projection_auth_patch":
      return `Apply inferred claim-based auth rules to canonical projection ${step.target}.`;
    case "apply_projection_ownership_patch":
      return `Apply inferred ownership-based auth rules to canonical projection ${step.target}.`;
    case "apply_doc_link_patch":
      return "Apply this suggested actor/role metadata update to an existing canonical doc.";
    case "apply_doc_metadata_patch":
      return "Apply this suggested safe metadata update to an existing canonical doc.";
    case "skip_duplicate_shape":
      return step.target ? `Skip this shape because it duplicates canonical shape ${step.target}.` : "Skip this shape because it duplicates existing canonical surface.";
    default:
      return "Review this adoption suggestion before applying it.";
  }
}

function recommendationForAdoptionItem(step) {
  if (step.action === "apply_doc_link_patch") {
    return `Update \`${step.target}\` with the suggested related actor/role links.`;
  }
  if (step.action === "apply_doc_metadata_patch") {
    return `Update \`${step.target}\` with the suggested safe metadata changes.`;
  }
  if (step.action === "apply_projection_permission_patch") {
    return `Update \`${step.target}\` with inferred permission auth rules for ${(step.related_capabilities || []).map((item) => `\`${item}\``).join(", ") || "the related capabilities"}.`;
  }
  if (step.action === "apply_projection_auth_patch") {
    return `Update \`${step.target}\` with inferred claim auth rules for ${(step.related_capabilities || []).map((item) => `\`${item}\``).join(", ") || "the related capabilities"}.`;
  }
  if (step.action === "apply_projection_ownership_patch") {
    return `Update \`${step.target}\` with inferred ownership auth rules for ${(step.related_capabilities || []).map((item) => `\`${item}\``).join(", ") || "the related capabilities"}.`;
  }
  if (step.action === "promote_widget") {
    return "Promote this reviewed widget candidate before binding or reusing it from canonical projections.";
  }
  if (!["promote_actor", "promote_role"].includes(step.action)) {
    return null;
  }
  const kindLabel = step.action === "promote_actor" ? "actor" : "role";
  const linkHints = [];
  if ((step.related_docs || []).length > 0) {
    linkHints.push(`link to docs ${step.related_docs.map((item) => `\`${item}\``).join(", ")}`);
  }
  if ((step.related_capabilities || []).length > 0) {
    linkHints.push(`check capabilities ${step.related_capabilities.map((item) => `\`${item}\``).join(", ")}`);
  }
  return `Promote this ${kindLabel}${step.confidence ? ` (${step.confidence})` : ""}${linkHints.length ? ` and ${linkHints.join("; ")}` : ""}.`;
}

function formatDocLinkSuggestionInline(item) {
  return `doc \`${item.doc_id}\`` +
    `${item.add_related_actors?.length ? ` add-actors=${item.add_related_actors.map((entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.add_related_roles?.length ? ` add-roles=${item.add_related_roles.map((entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.add_related_capabilities?.length ? ` add-capabilities=${item.add_related_capabilities.map((entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.add_related_rules?.length ? ` add-rules=${item.add_related_rules.map((entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.add_related_workflows?.length ? ` add-workflows=${item.add_related_workflows.map((entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.patch_rel_path ? ` draft=\`${item.patch_rel_path}\`` : ""}`;
}

function formatDocDriftSummaryInline(item) {
  return `doc \`${item.doc_id}\` (${item.recommendation_type}) fields=${item.differing_fields.map((entry) => entry.field).join(", ")} confidence=${item.imported_confidence}`;
}

function formatDocMetadataPatchInline(item) {
  return `doc \`${item.doc_id}\`` +
    `${item.summary ? " set-summary=yes" : ""}` +
    `${item.success_outcome ? " set-success_outcome=yes" : ""}` +
    `${item.actors?.length ? ` add-actors=${item.actors.map((entry) => `\`${entry}\``).join(", ")}` : ""}` +
    `${item.patch_rel_path ? ` draft=\`${item.patch_rel_path}\`` : ""}`;
}

function adoptionStatusForStep(step, projectionImpacts = [], uiImpacts = [], workflowImpacts = []) {
  if (step.action === "skip_duplicate_shape") {
    return "skipped";
  }
  if (step.action === "apply_projection_permission_patch") {
    return "needs_projection_review";
  }
  if (step.action === "apply_projection_auth_patch") {
    return "needs_projection_review";
  }
  if (step.action === "apply_projection_ownership_patch") {
    return "needs_projection_review";
  }
  if (step.action.includes("capability") && projectionImpacts.length > 0) {
    return "needs_projection_review";
  }
  if (step.action.includes("ui_") && uiImpacts.length > 0) {
    return "needs_ui_review";
  }
  if (step.action.includes("workflow") && workflowImpacts.length > 0) {
    return "needs_workflow_review";
  }
  return "pending";
}

function projectionImpactsForAdoptionItem(bundle, step) {
  if (!step.action.includes("capability")) {
    return [];
  }
  return (bundle.projectionImpacts || [])
    .filter((impact) => (impact.missing_capabilities || []).includes(step.item))
    .map((impact) => ({
      projection_id: impact.projection_id,
      kind: impact.kind,
      platform: impact.platform,
      reason: impact.reason
    }));
}

function blockingDependenciesForProjectionImpacts(projectionImpacts) {
  return projectionImpacts.map((impact) => ({
    type: "projection_review",
    id: `projection_review:${impact.projection_id}`,
    projection_id: impact.projection_id,
    kind: impact.kind,
    platform: impact.platform,
    reason: impact.reason
  }));
}

function blockingDependenciesForUiImpacts(uiImpacts) {
  return uiImpacts.map((impact) => ({
    type: "ui_review",
    id: `ui_review:${impact.projection_id}`,
    projection_id: impact.projection_id,
    kind: impact.kind,
    platform: impact.platform,
    reason: impact.reason
  }));
}

function blockingDependenciesForWorkflowImpacts(workflowImpacts) {
  return workflowImpacts.map((impact) => ({
    type: "workflow_review",
    id: impact.review_group_id,
    reason: impact.reason
  }));
}


function buildAdoptionPlan(bundles) {
  const items = [];
  for (const bundle of bundles) {
    for (const step of bundle.adoptionPlan || []) {
      const itemKind =
        step.action === "merge_bundle_into_existing_entity" ? "bundle" :
        step.action === "apply_projection_permission_patch" ? "projection_permission_patch" :
        step.action === "apply_projection_auth_patch" ? "projection_auth_patch" :
        step.action === "apply_projection_ownership_patch" ? "projection_ownership_patch" :
        step.action.includes("doc") ? "doc" :
        step.action.includes("decision") ? "decision" :
        step.action.includes("verification") ? "verification" :
        step.action.includes("widget") ? "widget" :
        step.action.includes("ui_") ? "ui" :
        step.action.includes("actor") ? "actor" :
        step.action.includes("role") ? "role" :
        step.action.includes("enum") ? "enum" :
        step.action.includes("shape") ? "shape" :
        step.action.includes("capability") ? "capability" :
        step.action.includes("entity") ? "entity" :
        "bundle";
      if (itemKind === "bundle") {
        continue;
      }
      const projectionImpacts = projectionImpactsForAdoptionItem(bundle, step);
      const directProjectionBlockingDependencies =
        (step.action === "apply_projection_permission_patch" || step.action === "apply_projection_auth_patch" || step.action === "apply_projection_ownership_patch") && step.target
          ? blockingDependenciesForProjectionImpacts([
              {
                projection_id: step.target,
                kind: step.projection_kind || "api",
                platform: null,
                reason: `Projection ${step.target} auth rules need explicit review before promotion.`
              }
            ])
          : [];
      const uiImpacts = step.action.includes("ui_") ? bundle.uiImpacts || [] : [];
      const workflowImpacts = step.action.includes("workflow") ? bundle.workflowImpacts || [] : [];
      const blockingDependencies = [
        ...blockingDependenciesForProjectionImpacts(projectionImpacts),
        ...directProjectionBlockingDependencies,
        ...blockingDependenciesForUiImpacts(uiImpacts),
        ...blockingDependenciesForWorkflowImpacts(workflowImpacts)
      ];
      items.push({
        bundle: bundle.slug,
        item: step.item,
        kind: itemKind,
        track:
          step.action.includes("workflow") ? "workflows" :
          step.action.includes("verification") ? "verification" :
          step.action.includes("ui_") ? "ui" :
          step.action === "apply_projection_permission_patch" ? "projection" :
          step.action === "apply_projection_auth_patch" ? "projection" :
          step.action === "apply_projection_ownership_patch" ? "projection" :
          step.action.includes("doc") ? "docs" :
          itemKind,
        suggested_action: step.action,
        target: step.target || null,
        confidence: step.confidence || null,
        inference_summary: step.inference_summary || null,
        related_docs: step.related_docs || [],
        related_capabilities: step.related_capabilities || [],
        permission: step.permission || null,
        claim: step.claim || null,
        claim_value: Object.prototype.hasOwnProperty.call(step, "claim_value") ? step.claim_value : null,
        ownership: step.ownership || null,
        ownership_field: step.ownership_field || null,
        projection_surface: step.projection_surface || null,
        status: adoptionStatusForStep(step, projectionImpacts, uiImpacts, workflowImpacts),
        source_path: step.source_path || candidateSourcePathForItem(bundle, itemKind, step.item),
        canonical_path:
          step.action === "skip_duplicate_shape"
            ? (step.target ? canonicalDisplayPathForItem("shape", step.target) : null)
            : (step.canonical_rel_path ? `topogram/${step.canonical_rel_path}` : canonicalDisplayPathForItem(itemKind, step.item)),
        canonical_rel_path: step.canonical_rel_path || canonicalRelativePathForItem(itemKind, step.item),
        reason: reasonForAdoptionItem(step),
        recommendation: recommendationForAdoptionItem(step),
        projection_impacts: projectionImpacts,
        ui_impacts: uiImpacts,
        workflow_impacts: workflowImpacts,
        blocking_dependencies: blockingDependencies
      });
    }
    for (const patch of bundle.projectionPatches || []) {
      items.push({
        bundle: bundle.slug,
        item: `projection_patch:${patch.projection_id}`,
        kind: "projection_patch",
        track: "projection",
        suggested_action: "review_projection_patch",
        target: patch.projection_id,
        status: "needs_projection_review",
        source_path: `candidates/reconcile/model/bundles/${bundle.slug}/${patch.patch_rel_path}`,
        canonical_path: null,
        canonical_rel_path: null,
        reason: patch.reason || `Projection ${patch.projection_id} needs additive review.`,
        projection_impacts: [
          {
            projection_id: patch.projection_id,
            kind: patch.kind,
            platform: patch.platform,
            missing_capabilities: patch.missing_realizes || []
          }
        ],
        ui_impacts: (patch.missing_screens || []).length > 0 ? [
          {
            projection_id: patch.projection_id,
            kind: patch.kind,
            platform: patch.platform,
            missing_screens: patch.missing_screens || []
          }
        ] : [],
        workflow_impacts: [],
        blocking_dependencies: blockingDependenciesForProjectionImpacts([
          {
            projection_id: patch.projection_id,
            kind: patch.kind,
            platform: patch.platform,
            reason: patch.reason || `Projection ${patch.projection_id} needs additive review.`
          }
        ])
      });
    }
    for (const patch of bundle.docLinkSuggestions || []) {
      items.push({
        bundle: bundle.slug,
        item: `doc_link_patch:${patch.doc_id}`,
        kind: "doc_link_patch",
        track: "docs",
        suggested_action: "apply_doc_link_patch",
        target: patch.doc_id,
        status: "pending",
        source_path: `candidates/reconcile/model/bundles/${bundle.slug}/${patch.patch_rel_path}`,
        canonical_path: patch.canonical_rel_path ? `topogram/${patch.canonical_rel_path}` : null,
        canonical_rel_path: patch.canonical_rel_path || null,
        reason: `Apply suggested related actor/role links to \`${patch.doc_id}\`.`,
        recommendation: recommendationForAdoptionItem({ action: "apply_doc_link_patch", target: patch.doc_id }),
        related_docs: [patch.doc_id],
        related_actors: patch.add_related_actors || [],
        related_roles: patch.add_related_roles || [],
        related_capabilities: patch.add_related_capabilities || [],
        related_rules: patch.add_related_rules || [],
        related_workflows: patch.add_related_workflows || [],
        projection_impacts: [],
        ui_impacts: [],
        workflow_impacts: [],
        blocking_dependencies: []
      });
    }
    for (const patch of bundle.docMetadataPatches || []) {
      items.push({
        bundle: bundle.slug,
        item: `doc_metadata_patch:${patch.doc_id}`,
        kind: "doc_metadata_patch",
        track: "docs",
        suggested_action: "apply_doc_metadata_patch",
        target: patch.doc_id,
        status: "pending",
        confidence: patch.imported_confidence || "low",
        source_path: `candidates/reconcile/model/bundles/${bundle.slug}/${patch.patch_rel_path}`,
        canonical_path: patch.canonical_rel_path ? `topogram/${patch.canonical_rel_path}` : null,
        canonical_rel_path: patch.canonical_rel_path || null,
        reason: `Apply suggested safe metadata updates to \`${patch.doc_id}\`.`,
        recommendation: recommendationForAdoptionItem({ action: "apply_doc_metadata_patch", target: patch.doc_id }),
        related_docs: [patch.doc_id],
        summary: patch.summary || null,
        success_outcome: patch.success_outcome || null,
        actors: patch.actors || [],
        projection_impacts: [],
        ui_impacts: [],
        workflow_impacts: [],
        blocking_dependencies: []
      });
    }
  }
  return items.sort((a, b) =>
    a.bundle.localeCompare(b.bundle) ||
    confidenceRank(b.confidence || "low") - confidenceRank(a.confidence || "low") ||
    a.kind.localeCompare(b.kind) ||
    a.item.localeCompare(b.item)
  );
}

const ADOPT_SELECTORS = new Set(["from-plan", "actors", "roles", "enums", "shapes", "entities", "capabilities", "widgets", "docs", "journeys", "workflows", "verification", "ui"]);

function readAdoptionPlan(paths) {
  return readJsonIfExists(path.join(paths.topogramRoot, "candidates", "reconcile", "adoption-plan.json"));
}


function buildCanonicalAdoptionOutputs(paths, candidateFiles, planItems, selectedItems, options = {}) {
  const refreshAdopted = Boolean(options.refreshAdopted);
  const files = {};
  const refreshedFiles = [];
  const selectedSet = new Set(selectedItems);
  const itemMap = new Map(planItems.map((item) => [adoptionItemKey(item), item]));
  const capabilityBundleSet = new Set(
    [...selectedSet]
      .map((key) => itemMap.get(key))
      .filter((item) => item?.kind === "capability")
      .map((item) => item.bundle)
  );
  for (const item of planItems) {
    if (item.kind === "shape" && item.status !== "skipped" && capabilityBundleSet.has(item.bundle)) {
      selectedSet.add(adoptionItemKey(item));
    }
  }
  for (const item of planItems) {
    if (!selectedSet.has(adoptionItemKey(item))) {
      continue;
    }
    if (item.suggested_action === "skip_duplicate_shape") {
      continue;
    }
    const relativeCanonicalPath = item.canonical_rel_path || canonicalRelativePathForItem(item.kind, item.item);
    if (!relativeCanonicalPath) {
      continue;
    }
    const canonicalPath = path.join(paths.topogramRoot, relativeCanonicalPath);
    if (item.suggested_action === "apply_doc_link_patch") {
      const baseContents = files[relativeCanonicalPath] || (fs.existsSync(canonicalPath) ? fs.readFileSync(canonicalPath, "utf8") : null);
      if (!baseContents) {
        continue;
      }
      const updatedContents = applyDocLinkPatchToMarkdownReconcile(baseContents, item);
      if (!updatedContents || updatedContents === baseContents) {
        continue;
      }
      files[relativeCanonicalPath] = updatedContents;
      refreshedFiles.push(relativeCanonicalPath.replaceAll(path.sep, "/"));
      continue;
    }
    if (item.suggested_action === "apply_doc_metadata_patch") {
      const baseContents = files[relativeCanonicalPath] || (fs.existsSync(canonicalPath) ? fs.readFileSync(canonicalPath, "utf8") : null);
      if (!baseContents) {
        continue;
      }
      const updatedContents = applyDocMetadataPatchToMarkdownReconcile(baseContents, item);
      if (!updatedContents || updatedContents === baseContents) {
        continue;
      }
      files[relativeCanonicalPath] = updatedContents;
      refreshedFiles.push(relativeCanonicalPath.replaceAll(path.sep, "/"));
      continue;
    }
    if (item.suggested_action === "apply_projection_permission_patch" || item.suggested_action === "apply_projection_auth_patch" || item.suggested_action === "apply_projection_ownership_patch") {
      const baseContents = files[relativeCanonicalPath] || (fs.existsSync(canonicalPath) ? fs.readFileSync(canonicalPath, "utf8") : null);
      if (!baseContents) {
        continue;
      }
      const updatedContents = applyProjectionAuthPatchToTopogram(baseContents, item);
      if (!updatedContents || updatedContents === baseContents) {
        continue;
      }
      files[relativeCanonicalPath] = updatedContents;
      refreshedFiles.push(relativeCanonicalPath.replaceAll(path.sep, "/"));
      continue;
    }
    if (fs.existsSync(canonicalPath)) {
      if (!refreshAdopted) {
        continue;
      }
      const existingContents = fs.readFileSync(canonicalPath, "utf8");
      const machineManagedImported =
        existingContents.startsWith("# imported ") ||
        /\bsource_of_truth:\s*imported\b/.test(existingContents);
      if (!machineManagedImported) {
        continue;
      }
    }
    const candidateContents =
      candidateFiles[item.source_path] ||
      (item.source_path ? readTextIfExists(path.join(paths.topogramRoot, item.source_path)) : null);
    if (!candidateContents) {
      continue;
    }
    files[relativeCanonicalPath] = candidateContents;
    if (fs.existsSync(canonicalPath)) {
      refreshedFiles.push(relativeCanonicalPath.replaceAll(path.sep, "/"));
    }
  }
  return { files, refreshedFiles: [...new Set(refreshedFiles)].sort() };
}

function buildPromotedCanonicalItems(planItems, selectedItems, writtenCanonicalFiles, selector) {
  const itemMap = new Map((planItems || []).map((item) => [adoptionItemKey(item), item]));
  const writtenSet = new Set((writtenCanonicalFiles || []).map((item) => String(item).replaceAll(path.sep, "/")));
  return [...new Set(selectedItems || [])]
    .map((key) => itemMap.get(key))
    .filter(Boolean)
    .filter((item) => item.canonical_rel_path && writtenSet.has(String(item.canonical_rel_path).replaceAll(path.sep, "/")))
    .map((item) => ({
      selector: selector || null,
      bundle: item.bundle,
      item: item.item,
      kind: item.kind,
      track: item.track || null,
      source_path: item.source_path || null,
      canonical_rel_path: String(item.canonical_rel_path).replaceAll(path.sep, "/"),
      canonical_path: item.canonical_path || `topogram/${String(item.canonical_rel_path).replaceAll(path.sep, "/")}`,
      suggested_action: item.suggested_action || null
    }))
    .sort((a, b) =>
      (a.bundle || "").localeCompare(b.bundle || "") ||
      (a.track || "").localeCompare(b.track || "") ||
      (a.kind || "").localeCompare(b.kind || "") ||
      (a.item || "").localeCompare(b.item || "")
    );
}

function ensureProjectionBlock(lines, blockName) {
  const startIndex = lines.findIndex((line) => new RegExp(`^\\s*${blockName}\\s*\\{\\s*$`).test(line));
  if (startIndex !== -1) {
    let endIndex = -1;
    for (let index = startIndex + 1; index < lines.length; index += 1) {
      if (/^\s*\}\s*$/.test(lines[index])) {
        endIndex = index;
        break;
      }
    }
    if (endIndex !== -1) {
      return { lines, startIndex, endIndex };
    }
  }
  const insertBeforeStatus = lines.findIndex((line) => /^\s*status\s+\w+/.test(line));
  const insertIndex = insertBeforeStatus === -1 ? lines.length : insertBeforeStatus;
  const blockLines = ["", `  ${blockName} {`, "  }"];
  lines.splice(insertIndex, 0, ...blockLines);
  return {
    lines,
    startIndex: insertIndex + 1,
    endIndex: insertIndex + 2
  };
}

function ensureProjectionRealizes(lines, capabilityIds) {
  const startIndex = lines.findIndex((line) => /^\s*realizes\s*\[/.test(line));
  if (startIndex === -1) {
    return { changed: false, lines };
  }
  let endIndex = startIndex;
  while (endIndex < lines.length && !/\]/.test(lines[endIndex])) {
    endIndex += 1;
  }
  if (endIndex >= lines.length) {
    return { changed: false, lines };
  }
  const existingItems = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    const text = lines[index]
      .replace(/^\s*realizes\s*\[/, "")
      .replace(/\]\s*$/, "")
      .trim();
    if (!text) {
      continue;
    }
    for (const item of text.split(",").map((entry) => entry.trim()).filter(Boolean)) {
      existingItems.push(item);
    }
  }
  const merged = [...new Set([...existingItems, ...(capabilityIds || [])])];
  if (merged.length === existingItems.length) {
    return { changed: false, lines };
  }
  const replacement = ["  realizes [", ...merged.map((item, index) => `    ${item}${index === merged.length - 1 ? "" : ","}`), "  ]"];
  lines.splice(startIndex, endIndex - startIndex + 1, ...replacement);
  return { changed: true, lines };
}

function applyProjectionAuthPatchToTopogram(baseContents, item) {
  const lines = String(baseContents || "").replace(/\r\n/g, "\n").split("\n");
  const capabilities = [...new Set(item.related_capabilities || [])];
  let changed = false;

  const realizesResult = ensureProjectionRealizes(lines, capabilities);
  changed = changed || realizesResult.changed;

  if (item.projection_surface === "authorization") {
    const block = ensureProjectionBlock(lines, "authorization");
    for (const capabilityId of capabilities) {
      const lineIndex = lines.findIndex((line, index) =>
        index > block.startIndex &&
        index < block.endIndex &&
        new RegExp(`^\\s*${capabilityId}(\\s|$)`).test(line)
      );
      if (item.suggested_action === "apply_projection_ownership_patch") {
        const ownershipFragment = `ownership ${item.ownership}${item.ownership_field ? ` ownership_field ${item.ownership_field}` : ""}`;
        if (lineIndex !== -1) {
          if (!/\bownership\s+/.test(lines[lineIndex])) {
            lines[lineIndex] = `${lines[lineIndex].trimEnd()} ${ownershipFragment}`;
            changed = true;
          }
          continue;
        }
        lines.splice(block.endIndex, 0, `    ${capabilityId} ${ownershipFragment}`);
        block.endIndex += 1;
        changed = true;
        continue;
      }

      if (item.suggested_action === "apply_projection_permission_patch") {
        const permissionFragment = `permission ${item.permission}`;
        if (lineIndex !== -1) {
          if (!/\bpermission\s+/.test(lines[lineIndex])) {
            lines[lineIndex] = `${lines[lineIndex].trimEnd()} ${permissionFragment}`;
            changed = true;
          }
          continue;
        }
        lines.splice(block.endIndex, 0, `    ${capabilityId} ${permissionFragment}`);
        block.endIndex += 1;
        changed = true;
        continue;
      }

      const claimFragment = `claim ${item.claim}${item.claim_value != null ? ` claim_value ${item.claim_value}` : ""}`;
      if (lineIndex !== -1) {
        if (!/\bclaim\s+/.test(lines[lineIndex])) {
          lines[lineIndex] = `${lines[lineIndex].trimEnd()} ${claimFragment}`;
          changed = true;
        }
        continue;
      }
      lines.splice(block.endIndex, 0, `    ${capabilityId} ${claimFragment}`);
      block.endIndex += 1;
      changed = true;
    }
  }

  if (item.projection_surface === "visibility_rules") {
    const block = ensureProjectionBlock(lines, "visibility_rules");
    for (const capabilityId of capabilities) {
      if (item.suggested_action === "apply_projection_permission_patch") {
        const hasExistingPermissionRule = lines.some((line, index) =>
          index > block.startIndex &&
          index < block.endIndex &&
          new RegExp(`^\\s*action\\s+${capabilityId}\\s+visible_if\\s+permission\\s+${item.permission}(\\s|$)`).test(line)
        );
        if (hasExistingPermissionRule) {
          continue;
        }
        const hasAnyVisibilityRule = lines.some((line, index) =>
          index > block.startIndex &&
          index < block.endIndex &&
          new RegExp(`^\\s*action\\s+${capabilityId}\\s+visible_if\\s+`).test(line)
        );
        if (hasAnyVisibilityRule) {
          continue;
        }
        lines.splice(block.endIndex, 0, `    action ${capabilityId} visible_if permission ${item.permission}`);
        block.endIndex += 1;
        changed = true;
        continue;
      }

      const hasExistingClaimRule = lines.some((line, index) =>
        index > block.startIndex &&
        index < block.endIndex &&
        new RegExp(`^\\s*action\\s+${capabilityId}\\s+visible_if\\s+claim\\s+${item.claim}(\\s|$)`).test(line)
      );
      if (hasExistingClaimRule) {
        continue;
      }
      const hasAnyVisibilityRule = lines.some((line, index) =>
        index > block.startIndex &&
        index < block.endIndex &&
        new RegExp(`^\\s*action\\s+${capabilityId}\\s+visible_if\\s+`).test(line)
      );
      if (hasAnyVisibilityRule) {
        continue;
      }
      lines.splice(block.endIndex, 0, `    action ${capabilityId} visible_if claim ${item.claim}${item.claim_value != null ? ` claim_value ${item.claim_value}` : ""}`);
      block.endIndex += 1;
      changed = true;
    }
  }

  return changed ? ensureTrailingNewline(lines.join("\n")) : baseContents;
}

function refreshDocsWorkflow(inputPath) {
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

const IMPORT_TRACKS = new Set(["db", "api", "ui", "workflows", "verification"]);
const SCALAR_FIELD_TYPES = new Set([
  "bigint",
  "boolean",
  "bytes",
  "datetime",
  "decimal",
  "float",
  "int",
  "json",
  "string",
  "text",
  "uuid"
]);

function parseImportTracks(fromValue) {
  if (!fromValue) {
    return ["db", "api"];
  }
  const tracks = String(fromValue)
    .split(",")
    .map((track) => track.trim().toLowerCase())
    .filter(Boolean);
  if (tracks.length === 0) {
    throw new Error("Expected --from to include at least one import track");
  }
  const invalid = tracks.filter((track) => !IMPORT_TRACKS.has(track));
  if (invalid.length > 0) {
    throw new Error(`Unsupported import track(s): ${invalid.join(", ")}`);
  }
  return [...new Set(tracks)];
}

function importSearchRoots(paths) {
  return [...new Set([paths.workspaceRoot, paths.topogramRoot].filter(Boolean))];
}

function normalizeImportRelativePath(paths, filePath) {
  return relativeTo(paths.repoRoot, filePath);
}

function canonicalSourceRank(paths, filePath, kind) {
  const relativePath = normalizeImportRelativePath(paths, filePath);
  const normalizedPath = relativePath.replaceAll(path.sep, "/");
  const penalties = [
    { pattern: /\/apps\/local-stack\//, weight: 80 },
    { pattern: /\/artifacts\/environment\//, weight: 60 },
    { pattern: /\/artifacts\/deploy\//, weight: 60 },
    { pattern: /\/artifacts\/compile-check\//, weight: 50 },
    { pattern: /\/artifacts\/db-lifecycle\//, weight: 50 },
    { pattern: /\/artifacts\/migrations\//, weight: 40 }
  ];

  let rank = 100;
  if (kind === "prisma") {
    if (/\/prisma\/schema\.prisma$/i.test(normalizedPath) && !normalizedPath.includes("/artifacts/")) {
      rank = 0;
    } else if (/\/apps\/backend\/prisma\/schema\.prisma$/i.test(normalizedPath)) {
      rank = 0;
    } else if (/\/artifacts\/prisma\/schema\.prisma$/i.test(normalizedPath)) {
      rank = 10;
    }
  } else if (kind === "sql") {
    if (/\/db\/schema\.sql$/i.test(normalizedPath) || /\/schema\.sql$/i.test(normalizedPath)) {
      rank = 0;
    } else if (/\/artifacts\/db\/.+\.sql$/i.test(normalizedPath)) {
      rank = 10;
    } else if (/migration/i.test(path.basename(normalizedPath))) {
      rank = 30;
    }
  } else if (kind === "openapi") {
    if (/\/artifacts\/openapi\/openapi\.(json|ya?ml)$/i.test(normalizedPath)) {
      rank = 0;
    } else if (/\/openapi\.(json|ya?ml)$/i.test(normalizedPath) || /\/swagger\.(json|ya?ml)$/i.test(normalizedPath)) {
      rank = 10;
    }
  }

  for (const penalty of penalties) {
    if (penalty.pattern.test(normalizedPath)) {
      rank += penalty.weight;
    }
  }
  return rank;
}

function selectPreferredImportFiles(paths, files, kind) {
  if (files.length === 0) {
    return [];
  }
  const rankedFiles = files.map((filePath) => ({
    filePath,
    rank: canonicalSourceRank(paths, filePath, kind)
  }));
  const bestRank = Math.min(...rankedFiles.map((entry) => entry.rank));
  return rankedFiles
    .filter((entry) => entry.rank === bestRank)
    .map((entry) => entry.filePath)
    .sort();
}

function findImportFiles(paths, predicate) {
  const files = new Set();
  for (const rootDir of importSearchRoots(paths)) {
    for (const filePath of listFilesRecursive(rootDir, predicate)) {
      if (
        filePath.includes(`${path.sep}candidates${path.sep}`) ||
        filePath.includes(`${path.sep}docs-generated${path.sep}`) ||
        filePath.includes(`${path.sep}topogram${path.sep}tests${path.sep}fixtures${path.sep}expected${path.sep}`)
      ) {
        continue;
      }
      files.add(filePath);
    }
  }
  return [...files].sort();
}

function makeCandidateRecord({
  kind,
  idHint,
  label,
  confidence = "medium",
  sourceKind,
  sourceOfTruth = "imported",
  provenance,
  track = null,
  ...payload
}) {
  const inferredTrack =
    track ||
    (["entity", "enum", "relation", "index"].includes(kind)
      ? "db"
      : kind === "capability"
        ? "api"
        : null);
  return {
    kind,
    id_hint: idHint,
    label,
    confidence,
    source_kind: sourceKind,
    source_of_truth: sourceOfTruth,
    provenance: Array.isArray(provenance) ? provenance : [provenance].filter(Boolean),
    track: inferredTrack,
    ...payload
  };
}

function dedupeCandidateRecords(records, keyFn) {
  const seen = new Map();
  for (const record of records) {
    const key = keyFn(record);
    const recordProvenance = Array.isArray(record.provenance) ? record.provenance : [record.provenance].filter(Boolean);
    if (!seen.has(key)) {
      seen.set(key, { ...record, provenance: recordProvenance });
      continue;
    }
    const current = seen.get(key);
    const currentProvenance = Array.isArray(current.provenance) ? current.provenance : [current.provenance].filter(Boolean);
    current.provenance = [...new Set([...currentProvenance, ...recordProvenance])];
  }
  return [...seen.values()];
}

function normalizePrismaType(typeName) {
  const normalized = String(typeName || "").toLowerCase();
  switch (normalized) {
    case "string":
      return "string";
    case "int":
      return "int";
    case "bigint":
      return "bigint";
    case "float":
      return "float";
    case "decimal":
      return "decimal";
    case "boolean":
    case "bool":
      return "boolean";
    case "datetime":
      return "datetime";
    case "bytes":
      return "bytes";
    case "json":
      return "json";
    default:
      return typeName;
  }
}

function parsePrismaSchema(schemaText) {
  const enums = [];
  const entities = [];
  const relations = [];
  const indexes = [];
  const enumNames = new Set();
  const modelNames = [];

  for (const match of schemaText.matchAll(/^enum\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, enumName, body] = match;
    const values = body
      .split(/\r?\n/)
      .map((line) => line.replace(/\/\/.*$/, "").trim())
      .filter((line) => line && !line.startsWith("@@"))
      .map((line) => line.split(/\s+/)[0]);
    enumNames.add(enumName);
    enums.push({ name: enumName, values });
  }

  for (const match of schemaText.matchAll(/^model\s+([A-Za-z0-9_]+)\s*\{/gm)) {
    modelNames.push(match[1]);
  }
  const modelNameSet = new Set(modelNames);

  for (const match of schemaText.matchAll(/^model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, modelName, body] = match;
    const fields = [];
    const localIndexes = [];
    const lines = body
      .split(/\r?\n/)
      .map((line) => line.replace(/\/\/.*$/, "").trim())
      .filter(Boolean);

    for (const line of lines) {
      if (line.startsWith("@@")) {
        const indexMatch = line.match(/^@@(unique|index)\(\[([^\]]+)\]/);
        if (indexMatch) {
          const [, type, rawFields] = indexMatch;
          localIndexes.push({
            id_hint: `index_${slugify(`${modelName}_${rawFields}`)}`,
            fields: rawFields.split(",").map((field) => field.trim()),
            unique: type === "unique"
          });
        }
        continue;
      }

      const fieldMatch = line.match(/^([A-Za-z0-9_]+)\s+([^\s]+)(.*)$/);
      if (!fieldMatch) {
        continue;
      }
      const [, fieldName, rawTypeToken, remainder] = fieldMatch;
      const list = rawTypeToken.endsWith("[]");
      const optional = rawTypeToken.endsWith("?");
      const baseType = rawTypeToken.replace(/\?|\[\]/g, "");
      const referencesModel = modelNameSet.has(baseType) && !enumNames.has(baseType);
      const hasRelationDirective = remainder.includes("@relation(");

      if (referencesModel && hasRelationDirective) {
        const relationMatch = remainder.match(/@relation\(([^)]*)\)/);
        const relationArgs = relationMatch?.[1] || "";
        const fieldsMatch = relationArgs.match(/fields:\s*\[([^\]]+)\]/);
        const refsMatch = relationArgs.match(/references:\s*\[([^\]]+)\]/);
        relations.push({
          from_entity: `entity_${slugify(modelName)}`,
          to_entity: `entity_${slugify(baseType)}`,
          relation_field: fieldName,
          fields: fieldsMatch ? fieldsMatch[1].split(",").map((field) => field.trim()) : [],
          references: refsMatch ? refsMatch[1].split(",").map((field) => field.trim()) : []
        });
        continue;
      }

      if (referencesModel) {
        continue;
      }

      const fieldType = enumNames.has(baseType) ? baseType : normalizePrismaType(baseType);
      fields.push({
        name: fieldName,
        field_type: fieldType,
        required: !optional && !list,
        list,
        unique: /@unique\b/.test(remainder),
        primary_key: /@id\b/.test(remainder)
      });

      if (/@unique\b/.test(remainder)) {
        localIndexes.push({
          id_hint: `index_${slugify(`${modelName}_${fieldName}_unique`)}`,
          fields: [fieldName],
          unique: true
        });
      }
    }

    entities.push({ name: modelName, fields });
    indexes.push(...localIndexes.map((index) => ({ ...index, entity: `entity_${slugify(modelName)}` })));
  }

  return { entities, enums, relations, indexes };
}

function splitSqlSegments(body) {
  return body
    .split(/,\s*\n/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function parseSqlSchema(sqlText) {
  const entities = [];
  const enums = [];
  const relations = [];
  const indexes = [];

  for (const match of sqlText.matchAll(/CREATE\s+TYPE\s+([A-Za-z0-9_"]+)\s+AS\s+ENUM\s*\(([\s\S]*?)\);/gi)) {
    const enumName = match[1].replace(/"/g, "");
    const values = [...match[2].matchAll(/'([^']+)'/g)].map((valueMatch) => valueMatch[1]);
    enums.push({ name: enumName, values });
  }

  for (const match of sqlText.matchAll(/CREATE\s+TABLE\s+([A-Za-z0-9_"]+)\s*\(([\s\S]*?)\);/gi)) {
    const tableName = match[1].replace(/"/g, "");
    const entityId = `entity_${slugify(tableName.replace(/s$/, ""))}`;
    const fields = [];
    for (const segment of splitSqlSegments(match[2])) {
      if (/^(PRIMARY\s+KEY|UNIQUE|CONSTRAINT|FOREIGN\s+KEY)/i.test(segment)) {
        const foreignKeyMatch = segment.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([A-Za-z0-9_"]+)\s*\(([^)]+)\)/i);
        if (foreignKeyMatch) {
          relations.push({
            from_entity: entityId,
            to_entity: `entity_${slugify(foreignKeyMatch[2].replace(/"/g, "").replace(/s$/, ""))}`,
            relation_field: foreignKeyMatch[1].replace(/"/g, "").trim(),
            fields: foreignKeyMatch[1].split(",").map((field) => field.replace(/"/g, "").trim()),
            references: foreignKeyMatch[3].split(",").map((field) => field.replace(/"/g, "").trim())
          });
        }
        const uniqueMatch = segment.match(/UNIQUE\s*\(([^)]+)\)/i);
        if (uniqueMatch) {
          indexes.push({
            entity: entityId,
            id_hint: `index_${slugify(`${tableName}_${uniqueMatch[1]}`)}`,
            fields: uniqueMatch[1].split(",").map((field) => field.replace(/"/g, "").trim()),
            unique: true
          });
        }
        continue;
      }
      const fieldMatch = segment.match(/^"?([A-Za-z0-9_]+)"?\s+([A-Za-z0-9_()[\]]+)(.*)$/i);
      if (!fieldMatch) {
        continue;
      }
      const [, fieldName, rawType, remainder] = fieldMatch;
      fields.push({
        name: fieldName,
        field_type: normalizePrismaType(rawType.replace(/\(.+$/, "")),
        required: /NOT\s+NULL/i.test(remainder),
        list: false,
        unique: /\bUNIQUE\b/i.test(remainder),
        primary_key: /\bPRIMARY\s+KEY\b/i.test(remainder)
      });
      const inlineReferenceMatch = remainder.match(/REFERENCES\s+([A-Za-z0-9_"]+)\s*\(([^)]+)\)/i);
      if (inlineReferenceMatch) {
        relations.push({
          from_entity: entityId,
          to_entity: `entity_${slugify(inlineReferenceMatch[1].replace(/"/g, "").replace(/s$/, ""))}`,
          relation_field: fieldName,
          fields: [fieldName],
          references: inlineReferenceMatch[2].split(",").map((field) => field.replace(/"/g, "").trim())
        });
      }
      if (/\bUNIQUE\b/i.test(remainder)) {
        indexes.push({
          entity: entityId,
          id_hint: `index_${slugify(`${tableName}_${fieldName}_unique`)}`,
          fields: [fieldName],
          unique: true
        });
      }
    }
    entities.push({ name: tableName.replace(/s$/, ""), table_name: tableName, fields });
  }

  for (const match of sqlText.matchAll(/CREATE\s+(UNIQUE\s+)?INDEX\s+([A-Za-z0-9_"]+)\s+ON\s+([A-Za-z0-9_"]+)\s*\(([^)]+)\)/gi)) {
    indexes.push({
      entity: `entity_${slugify(match[3].replace(/"/g, "").replace(/s$/, ""))}`,
      id_hint: `index_${slugify(match[2].replace(/"/g, ""))}`,
      fields: match[4].split(",").map((field) => field.replace(/"/g, "").trim()),
      unique: Boolean(match[1])
    });
  }

  return { entities, enums, relations, indexes };
}

function parseDbSchemaSnapshot(snapshot) {
  return {
    entities: (snapshot.tables || []).map((table) => ({
      name: table.entity?.name || table.table.replace(/s$/, ""),
      table_name: table.table,
      fields: (table.columns || []).map((column) => ({
        name: column.name,
        field_type: column.type,
        required: !column.nullable,
        list: false,
        unique: false,
        primary_key: false
      }))
    })),
    enums: (snapshot.enums || []).map((entry) => ({
      name: entry.name || entry.id,
      values: entry.values || []
    })),
    relations: (snapshot.tables || []).flatMap((table) =>
      (table.foreignKeys || []).map((foreignKey) => ({
        from_entity: table.entity?.id || `entity_${slugify(table.table.replace(/s$/, ""))}`,
        to_entity: foreignKey.references?.id || foreignKey.reference?.id || `entity_${slugify((foreignKey.references?.table || "").replace(/s$/, ""))}`,
        relation_field: foreignKey.columns?.[0] || "",
        fields: foreignKey.columns || [],
        references: foreignKey.references?.columns || []
      }))
    ),
    indexes: (snapshot.tables || []).flatMap((table) =>
      (table.indexes || []).map((index) => ({
        entity: table.entity?.id || `entity_${slugify(table.table.replace(/s$/, ""))}`,
        id_hint: `index_${slugify(index.name || `${table.table}_${(index.columns || []).join("_")}`)}`,
        fields: index.columns || [],
        unique: Boolean(index.unique)
      }))
    )
  };
}

function discoverDbSources(paths) {
  const allPrismaFiles = findImportFiles(paths, (filePath) => filePath.endsWith(path.join("prisma", "schema.prisma")) || filePath.endsWith("/prisma/schema.prisma"));
  const allSqlFiles = findImportFiles(paths, (filePath) => filePath.endsWith(".sql") && /(schema|migration|migrations|db)/i.test(filePath));
  const snapshotFiles = findImportFiles(paths, (filePath) => filePath.endsWith(".db-schema-snapshot.json"));
  const prismaFiles = selectPreferredImportFiles(paths, allPrismaFiles, "prisma");
  const schemaSqlFiles = allSqlFiles.filter((filePath) => !/migration/i.test(path.basename(filePath)));
  const migrationSqlFiles = allSqlFiles.filter((filePath) => /migration/i.test(path.basename(filePath)));
  const sqlFiles =
    prismaFiles.length > 0
      ? []
      : schemaSqlFiles.length > 0
        ? selectPreferredImportFiles(paths, schemaSqlFiles, "sql")
        : selectPreferredImportFiles(paths, migrationSqlFiles, "sql");
  return { prismaFiles, sqlFiles, snapshotFiles };
}

function discoverApiSources(paths) {
  const allOpenApiFiles = findImportFiles(
    paths,
    (filePath) =>
      /(openapi|swagger)\.(json|ya?ml)$/i.test(path.basename(filePath))
  );
  const openApiFiles = selectPreferredImportFiles(paths, allOpenApiFiles, "openapi");
  const routeFiles = findImportFiles(
    paths,
    (filePath) =>
      /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) &&
      /(server|api|routes|src)/i.test(filePath)
  );
  return { openApiFiles, routeFiles };
}

function collectDbImport(paths) {
  const findings = [];
  const candidates = {
    entities: [],
    enums: [],
    relations: [],
    indexes: []
  };
  const { prismaFiles, sqlFiles, snapshotFiles } = discoverDbSources(paths);
  let hasPrimarySchemaSource = false;

  for (const filePath of prismaFiles) {
    const parsed = parsePrismaSchema(readTextIfExists(filePath) || "");
    const provenance = relativeTo(paths.repoRoot, filePath);
    hasPrimarySchemaSource = true;
    findings.push({
      kind: "prisma_schema",
      file: provenance,
      entity_count: parsed.entities.length,
      enum_count: parsed.enums.length
    });
    candidates.entities.push(
      ...parsed.entities.map((entity) =>
        makeCandidateRecord({
          kind: "entity",
          idHint: `entity_${slugify(entity.name)}`,
          label: titleCase(entity.name),
          confidence: "high",
          sourceKind: "schema",
          provenance,
          table_name: slugify(entity.table_name || entity.name),
          fields: entity.fields
        })
      )
    );
    candidates.enums.push(
      ...parsed.enums.map((entry) =>
        makeCandidateRecord({
          kind: "enum",
          idHint: idHintify(entry.name),
          label: titleCase(entry.name),
          confidence: "high",
          sourceKind: "schema",
          provenance,
          values: entry.values
        })
      )
    );
    candidates.relations.push(
      ...parsed.relations.map((relation) =>
        makeCandidateRecord({
          kind: "relation",
          idHint: slugify(`${relation.from_entity}_${relation.relation_field}_${relation.to_entity}`),
          label: `${relation.from_entity} -> ${relation.to_entity}`,
          confidence: "high",
          sourceKind: "schema",
          provenance,
          ...relation
        })
      )
    );
    candidates.indexes.push(
      ...parsed.indexes.map((index) =>
        makeCandidateRecord({
          kind: "index",
          idHint: index.id_hint,
          label: titleCase(index.id_hint.replace(/^index_/, "")),
          confidence: "medium",
          sourceKind: "schema",
          provenance,
          entity: index.entity,
          fields: index.fields,
          unique: index.unique
        })
      )
    );
  }

  for (const filePath of sqlFiles) {
    const parsed = parseSqlSchema(readTextIfExists(filePath) || "");
    const provenance = relativeTo(paths.repoRoot, filePath);
    hasPrimarySchemaSource = true;
    findings.push({
      kind: "sql_schema",
      file: provenance,
      entity_count: parsed.entities.length,
      enum_count: parsed.enums.length
    });
    candidates.entities.push(
      ...parsed.entities.map((entity) =>
        makeCandidateRecord({
          kind: "entity",
          idHint: `entity_${slugify(entity.name)}`,
          label: titleCase(entity.name),
          confidence: /migration/i.test(filePath) ? "medium" : "high",
          sourceKind: /migration/i.test(filePath) ? "migration" : "schema",
          provenance,
          table_name: entity.table_name || slugify(entity.name),
          fields: entity.fields
        })
      )
    );
    candidates.enums.push(
      ...parsed.enums.map((entry) =>
        makeCandidateRecord({
          kind: "enum",
          idHint: idHintify(entry.name),
          label: titleCase(entry.name),
          confidence: /migration/i.test(filePath) ? "medium" : "high",
          sourceKind: /migration/i.test(filePath) ? "migration" : "schema",
          provenance,
          values: entry.values
        })
      )
    );
    candidates.relations.push(
      ...parsed.relations.map((relation) =>
        makeCandidateRecord({
          kind: "relation",
          idHint: slugify(`${relation.from_entity}_${relation.relation_field}_${relation.to_entity}`),
          label: `${relation.from_entity} -> ${relation.to_entity}`,
          confidence: "medium",
          sourceKind: /migration/i.test(filePath) ? "migration" : "schema",
          provenance,
          ...relation
        })
      )
    );
    candidates.indexes.push(
      ...parsed.indexes.map((index) =>
        makeCandidateRecord({
          kind: "index",
          idHint: index.id_hint,
          label: titleCase(index.id_hint.replace(/^index_/, "")),
          confidence: "medium",
          sourceKind: /migration/i.test(filePath) ? "migration" : "schema",
          provenance,
          entity: index.entity,
          fields: index.fields,
          unique: index.unique
        })
      )
    );
  }

  if (!hasPrimarySchemaSource) {
    for (const filePath of snapshotFiles) {
      const snapshot = readJsonIfExists(filePath);
      if (!snapshot) {
        continue;
      }
      const parsed = parseDbSchemaSnapshot(snapshot);
      const provenance = relativeTo(paths.repoRoot, filePath);
      findings.push({
        kind: "db_schema_snapshot",
        file: provenance,
        entity_count: parsed.entities.length,
        enum_count: parsed.enums.length
      });
      candidates.entities.push(
        ...parsed.entities.map((entity) =>
          makeCandidateRecord({
            kind: "entity",
            idHint: `entity_${slugify(entity.name)}`,
            label: titleCase(entity.name),
            confidence: "medium",
            sourceKind: "generated_artifact",
            provenance,
            table_name: entity.table_name || slugify(entity.name),
            fields: entity.fields
          })
        )
      );
      candidates.enums.push(
        ...parsed.enums.map((entry) =>
          makeCandidateRecord({
            kind: "enum",
            idHint: idHintify(entry.name),
            label: titleCase(entry.name),
            confidence: "medium",
            sourceKind: "generated_artifact",
            provenance,
            values: entry.values
          })
        )
      );
      candidates.relations.push(
        ...parsed.relations.map((relation) =>
          makeCandidateRecord({
            kind: "relation",
            idHint: slugify(`${relation.from_entity}_${relation.relation_field}_${relation.to_entity}`),
            label: `${relation.from_entity} -> ${relation.to_entity}`,
            confidence: "medium",
            sourceKind: "generated_artifact",
            provenance,
            ...relation
          })
        )
      );
      candidates.indexes.push(
        ...parsed.indexes.map((index) =>
          makeCandidateRecord({
            kind: "index",
            idHint: index.id_hint,
            label: titleCase(index.id_hint.replace(/^index_/, "")),
            confidence: "medium",
            sourceKind: "generated_artifact",
            provenance,
            entity: index.entity,
            fields: index.fields,
            unique: index.unique
          })
        )
      );
    }
  } else {
    for (const filePath of snapshotFiles) {
      findings.push({
        kind: "db_schema_snapshot",
        file: relativeTo(paths.repoRoot, filePath),
        used_as_primary: false
      });
    }
  }

  candidates.entities = dedupeCandidateRecords(candidates.entities, (record) => record.id_hint);
  candidates.enums = dedupeCandidateRecords(candidates.enums, (record) => record.id_hint);
  candidates.relations = dedupeCandidateRecords(candidates.relations, (record) => record.id_hint);
  candidates.indexes = dedupeCandidateRecords(candidates.indexes, (record) => record.id_hint);

  return { findings, candidates };
}

function parseOpenApiDocument(document, provenance, sourceKind = "openapi") {
  const capabilities = [];
  const routes = [];
  const pathsObject = document.paths || {};
  for (const [endpointPath, operations] of Object.entries(pathsObject)) {
    for (const [method, operation] of Object.entries(operations || {})) {
      const normalizedMethod = method.toUpperCase();
      const operationId = operation.operationId || `candidate_${normalizedMethod.toLowerCase()}_${slugify(endpointPath)}`;
      const requestSchema =
        operation.requestBody?.content?.["application/json"]?.schema?.$ref ||
        operation.requestBody?.content?.["application/json"]?.schema?.type ||
        null;
      const successResponse = Object.entries(operation.responses || {}).find(([status]) => /^2/.test(status));
      const responseSchema =
        successResponse?.[1]?.content?.["application/json"]?.schema?.$ref ||
        successResponse?.[1]?.content?.["application/json"]?.schema?.type ||
        null;
      const parameterHints = extractOpenApiParameterHints(document, endpointPath, operation);
      const requestFieldHints = extractOpenApiSchemaFieldHints(document, operation.requestBody?.content?.["application/json"]?.schema);
      const responseFieldHints = extractOpenApiSchemaFieldHints(document, successResponse?.[1]?.content?.["application/json"]?.schema);
      const securitySchemes = extractOpenApiSecuritySchemes(document, operation);
      capabilities.push(
        makeCandidateRecord({
          kind: "capability",
          idHint: operationId,
          label: operation.summary || titleCase(operationId.replace(/^cap_/, "")),
          confidence: "high",
          sourceKind,
          provenance: `${provenance}#${normalizedMethod} ${endpointPath}`,
          endpoint: {
            method: normalizedMethod,
            path: endpointPath
          },
          input_hint: requestSchema,
          output_hint: responseSchema,
          input_fields: requestFieldHints.body_fields,
          output_fields: responseFieldHints.body_fields,
          path_params: parameterHints.path,
          query_params: parameterHints.query,
          header_params: parameterHints.header,
          security_schemes: securitySchemes,
          auth_hint: securitySchemes.length > 0 ? "secured" : "unknown"
        })
      );
      routes.push({
        path: endpointPath,
        method: normalizedMethod,
        source_kind: sourceKind,
        provenance: `${provenance}#${normalizedMethod} ${endpointPath}`
      });
    }
  }
  return { capabilities, routes };
}

function normalizeOpenApiPath(pathValue) {
  return String(pathValue || "")
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{$1}")
    .replace(/\/+$/, "") || "/";
}

function normalizeEndpointPathForMatch(pathValue) {
  const normalizedPath = normalizeOpenApiPath(pathValue);
  const segments = normalizedPath
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (/^\{[^}]+\}$/.test(segment)) {
        return "{}";
      }
      return segment
        .split("-")
        .map((part) => canonicalCandidateTerm(part))
        .join("-");
    });
  return `/${segments.join("/")}`.replace(/\/+$/, "") || "/";
}

function openApiRefName(ref) {
  if (!ref || typeof ref !== "string") {
    return null;
  }
  return ref.split("/").pop() || null;
}

function resolveOpenApiSchema(document, schema, seen = new Set()) {
  if (!schema || typeof schema !== "object") {
    return null;
  }
  if (schema.$ref) {
    if (seen.has(schema.$ref)) {
      return null;
    }
    seen.add(schema.$ref);
    if (!schema.$ref.startsWith("#/")) {
      return null;
    }
    const segments = schema.$ref.slice(2).split("/");
    let current = document;
    for (const segment of segments) {
      current = current?.[segment];
      if (current == null) {
        return null;
      }
    }
    return resolveOpenApiSchema(document, current, seen) || current;
  }
  return schema;
}

function collectOpenApiObjectFields(document, schema, fields = new Set(), seen = new Set()) {
  const resolved = resolveOpenApiSchema(document, schema, seen);
  if (!resolved || typeof resolved !== "object") {
    return fields;
  }
  if (resolved.type === "array" && resolved.items) {
    collectOpenApiObjectFields(document, resolved.items, fields, seen);
    return fields;
  }
  for (const propertyName of Object.keys(resolved.properties || {})) {
    fields.add(propertyName);
  }
  for (const entry of resolved.allOf || []) {
    collectOpenApiObjectFields(document, entry, fields, seen);
  }
  for (const entry of resolved.oneOf || []) {
    collectOpenApiObjectFields(document, entry, fields, seen);
  }
  for (const entry of resolved.anyOf || []) {
    collectOpenApiObjectFields(document, entry, fields, seen);
  }
  return fields;
}

function extractOpenApiSchemaFieldHints(document, schema) {
  const fieldNames = [...collectOpenApiObjectFields(document, schema)].sort();
  return {
    schema_ref: openApiRefName(schema?.$ref || null),
    body_fields: fieldNames
  };
}

function collectOpenApiParameters(endpointPath, operation) {
  const pathParams = [...String(endpointPath || "").matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: "path",
    required: true
  }));
  return [...pathParams, ...((operation.parameters || []).filter(Boolean))];
}

function extractOpenApiParameterHints(document, endpointPath, operation) {
  const grouped = {
    path: [],
    query: [],
    header: []
  };
  for (const parameter of collectOpenApiParameters(endpointPath, operation)) {
    const schema = resolveOpenApiSchema(document, parameter.schema || null);
    const target = parameter.in === "query" ? "query" : parameter.in === "header" ? "header" : "path";
    grouped[target].push({
      name: parameter.name,
      required: Boolean(parameter.required),
      type: schema?.type || null
    });
  }
  for (const key of Object.keys(grouped)) {
    grouped[key] = grouped[key].sort((a, b) => a.name.localeCompare(b.name));
  }
  return grouped;
}

function extractOpenApiSecuritySchemes(document, operation) {
  const securityEntries = [...(operation.security || []), ...(document.security || [])];
  const schemes = new Set();
  for (const entry of securityEntries) {
    for (const key of Object.keys(entry || {})) {
      schemes.add(key);
    }
  }
  return [...schemes].sort();
}

function parseOpenApiYaml(text) {
  const doc = { paths: {} };
  let currentPath = null;
  let currentMethod = null;
  let inRequestBody = false;
  let inResponses = false;
  let currentResponseStatus = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "");
    if (!line.trim()) {
      continue;
    }
    const pathMatch = line.match(/^\s{2}(\/[^:]+):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      currentMethod = null;
      doc.paths[currentPath] = doc.paths[currentPath] || {};
      inRequestBody = false;
      inResponses = false;
      currentResponseStatus = null;
      continue;
    }
    const methodMatch = line.match(/^\s{4}(get|post|put|patch|delete):\s*$/i);
    if (methodMatch && currentPath) {
      currentMethod = methodMatch[1].toLowerCase();
      doc.paths[currentPath][currentMethod] = { responses: {} };
      inRequestBody = false;
      inResponses = false;
      currentResponseStatus = null;
      continue;
    }
    if (!currentPath || !currentMethod) {
      continue;
    }
    const operation = doc.paths[currentPath][currentMethod];
    const operationIdMatch = line.match(/^\s{6}operationId:\s*(.+)$/);
    if (operationIdMatch) {
      operation.operationId = operationIdMatch[1].trim().replace(/^["']|["']$/g, "");
      continue;
    }
    const summaryMatch = line.match(/^\s{6}summary:\s*(.+)$/);
    if (summaryMatch) {
      operation.summary = summaryMatch[1].trim().replace(/^["']|["']$/g, "");
      continue;
    }
    if (/^\s{6}requestBody:\s*$/.test(line)) {
      inRequestBody = true;
      inResponses = false;
      currentResponseStatus = null;
      continue;
    }
    if (/^\s{6}responses:\s*$/.test(line)) {
      inResponses = true;
      inRequestBody = false;
      currentResponseStatus = null;
      continue;
    }
    const responseStatusMatch = line.match(/^\s{8}['"]?([0-9Xx]{3})['"]?:\s*$/);
    if (inResponses && responseStatusMatch) {
      currentResponseStatus = responseStatusMatch[1];
      operation.responses[currentResponseStatus] = operation.responses[currentResponseStatus] || {};
      continue;
    }
    const refMatch = line.match(/^\s+\$ref:\s*(.+)$/);
    if (refMatch) {
      const ref = refMatch[1].trim().replace(/^["']|["']$/g, "");
      if (inRequestBody) {
        operation.requestBody = operation.requestBody || { content: { "application/json": { schema: {} } } };
        operation.requestBody.content["application/json"].schema.$ref = ref;
      } else if (inResponses && currentResponseStatus) {
        operation.responses[currentResponseStatus].content = operation.responses[currentResponseStatus].content || { "application/json": { schema: {} } };
        operation.responses[currentResponseStatus].content["application/json"].schema.$ref = ref;
      }
    }
  }

  return doc;
}

function inferServerRoutes(paths) {
  const routes = [];
  const routeFiles = findImportFiles(
    paths,
    (filePath) =>
      /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) &&
      /(server|api|routes|src)/i.test(filePath)
  );
  for (const filePath of routeFiles) {
    const text = readTextIfExists(filePath) || "";
    for (const match of text.matchAll(/\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]\s*,([\s\S]*?)\)\s*;?/gi)) {
      const handlerTokens = [...match[3].matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g)].map((entry) => entry[1]);
      const handlerHint = handlerTokens.length > 0 ? handlerTokens[handlerTokens.length - 1] : null;
      const pathParams = [...normalizeOpenApiPath(match[2]).matchAll(/\{([^}]+)\}/g)].map((entry) => entry[1]);
      const handlerContext = handlerHint ? extractHandlerContext(text, handlerHint) : "";
      const queryParams = inferRouteQueryParams(handlerContext);
      const authHint = inferRouteAuthHint(match[3], handlerContext);
      routes.push({
        file: filePath,
        method: match[1].toUpperCase(),
        path: match[2],
        handler_hint: handlerHint,
        path_params: pathParams,
        query_params: queryParams,
        auth_hint: authHint
      });
    }
  }
  return routes;
}

function inferNextApiRoutes(paths) {
  const apiRoot = path.join(paths.workspaceRoot, "app", "api");
  if (!fs.existsSync(apiRoot)) {
    return [];
  }
  const routeFiles = listFilesRecursive(
    apiRoot,
    (child) => /\/route\.(tsx|ts|jsx|js)$/.test(child) || /^route\.(tsx|ts|jsx|js)$/.test(path.basename(child))
  );
  const routes = [];
  for (const filePath of routeFiles) {
    const text = readTextIfExists(filePath) || "";
    const relative = relativeTo(apiRoot, filePath);
    const routePath = `/${relative}`
      .replace(/\/route\.(tsx|ts|jsx|js)$/, "")
      .replace(/\[(\.\.\.)?([^\]]+)\]/g, (_match, catchAll, name) => catchAll ? `:${name}*` : `:${name}`);
    for (const match of text.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(([^)]*)\)/g)) {
      const method = match[1].toUpperCase();
      const handlerContext = extractNamedExportBlock(text, match[1]) || "";
      const queryParams = inferNextRequestSearchParams(handlerContext);
      const outputFields = inferNextJsonFields(handlerContext);
      const authHint = inferRouteAuthHint(match[0], handlerContext);
      routes.push({
        file: filePath,
        method,
        path: routePath === "" ? "/" : routePath,
        handler_hint: match[1].toLowerCase(),
        path_params: [...normalizeOpenApiPath(routePath).matchAll(/\{([^}]+)\}/g)].map((entry) => entry[1]),
        query_params: queryParams,
        output_fields: outputFields,
        auth_hint: authHint,
        source_kind: "route_code"
      });
    }
  }
  return routes;
}

function nextAppRoutePathFromFile(appRoot, filePath) {
  const relative = relativeTo(appRoot, filePath);
  return `/${relative}`
    .replace(/\/actions\.(tsx|ts|jsx|js)$/, "")
    .replace(/\/page\.(tsx|ts|jsx|js|mdx)$/, "")
    .replace(/\[(\.\.\.)?([^\]]+)\]/g, (_match, catchAll, name) => catchAll ? `:${name}*` : `:${name}`)
    .replace(/\/index$/, "")
    .replace(/^\/$/, "/") || "/";
}

function inferFormDataFields(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/formData\.get\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    fields.add(match[1]);
  }
  return [...fields].sort();
}

function inferInputNames(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/\bname=["'`]([^"'`]+)["'`]/g)) {
    fields.add(match[1]);
  }
  return [...fields].sort();
}

function inferNextAuthCapabilities(paths) {
  const authConfigPath = path.join(paths.workspaceRoot, "auth.ts");
  const authConfigText = readTextIfExists(authConfigPath) || "";
  const hasCredentialsProvider = /CredentialsProvider\s*\(/.test(authConfigText);
  const createsUserOnAuthorize = /prisma\.user\.create\s*\(/.test(authConfigText);
  const loginPagePath = path.join(paths.workspaceRoot, "app", "login", "page.tsx");
  const registerPagePath = path.join(paths.workspaceRoot, "app", "register", "page.tsx");
  const pages = [
    {
      file: loginPagePath,
      path: "/login",
      id_hint: "cap_sign_in_user",
      label: "Sign In User",
      target_state: "authenticated"
    },
    {
      file: registerPagePath,
      path: "/register",
      id_hint: "cap_register_user",
      label: "Register User",
      target_state: createsUserOnAuthorize ? "registered" : "created"
    }
  ];
  const capabilities = [];
  for (const page of pages) {
    const text = readTextIfExists(page.file) || "";
    if (!text || !/signIn\(\s*["'`]credentials["'`]/.test(text)) {
      continue;
    }
    const inputFields = inferInputNames(text);
    capabilities.push({
      file: page.file,
      function_name: page.id_hint.replace(/^cap_/, ""),
      method: "POST",
      path: page.path,
      id_hint: page.id_hint,
      label: page.label,
      input_fields: inputFields,
      output_fields: [],
      path_params: [],
      auth_hint: "public",
      entity_id: "entity_user",
      target_state: page.target_state,
      provenance: [
        relativeTo(paths.repoRoot, page.file),
        ...(hasCredentialsProvider ? [relativeTo(paths.repoRoot, authConfigPath)] : [])
      ],
      source_kind: "route_code"
    });
  }
  return capabilities.sort((a, b) => a.id_hint.localeCompare(b.id_hint));
}

function inferNextServerActionCapabilities(paths) {
  const appRoot = path.join(paths.workspaceRoot, "app");
  if (!fs.existsSync(appRoot)) {
    return [];
  }
  const actionFiles = listFilesRecursive(
    appRoot,
    (child) =>
      /\/actions\.(tsx|ts|jsx|js)$/.test(child) ||
      /\/page\.(tsx|ts|jsx|js|mdx)$/.test(child) ||
      /^page\.(tsx|ts|jsx|js|mdx)$/.test(path.basename(child))
  );
  const capabilities = [];
  for (const filePath of actionFiles) {
    const text = readTextIfExists(filePath) || "";
    const routePath = nextAppRoutePathFromFile(appRoot, filePath);
    for (const match of text.matchAll(/(?:export\s+)?async\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{([\s\S]{0,2400}?)\n\}/g)) {
      const functionName = match[1];
      const body = match[3] || "";
      const trimmedBody = body.trimStart();
      const isServerAction =
        /\/actions\.(tsx|ts|jsx|js)$/.test(filePath) ||
        trimmedBody.startsWith('"use server"') ||
        trimmedBody.startsWith("'use server'");
      if (!isServerAction) {
        continue;
      }
      const routeLike = {
        file: filePath,
        method: "POST",
        path: routePath,
        handler_hint: functionName,
        auth_hint: inferRouteAuthHint(functionName, body)
      };
      capabilities.push({
        file: filePath,
        function_name: functionName,
        method: "POST",
        path: routePath,
        id_hint: inferRouteCapabilityId(routeLike),
        input_fields: inferFormDataFields(body),
        output_fields: [],
        path_params: [...normalizeOpenApiPath(routePath).matchAll(/\{([^}]+)\}/g)].map((entry) => entry[1]),
        auth_hint: routeLike.auth_hint,
        entity_id: inferCapabilityEntityId({ endpoint: { path: routePath }, id_hint: inferRouteCapabilityId(routeLike) }),
        source_kind: "route_code"
      });
    }
  }
  return capabilities.sort((a, b) => a.id_hint.localeCompare(b.id_hint) || a.path.localeCompare(b.path));
}

function extractNamedExportBlock(text, exportName) {
  const escapedName = exportName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`export\\s+async\\s+function\\s+${escapedName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,2000}?)\\n\\}`, "m"));
  return match ? match[1] : "";
}

function inferNextRequestSearchParams(text) {
  const params = new Set();
  for (const match of String(text || "").matchAll(/searchParams\.get\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    params.add(match[1]);
  }
  return [...params].sort();
}

function inferNextJsonFields(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/NextResponse\.json\(\s*\{([\s\S]{0,400}?)\}\s*\)/g)) {
    for (const fieldMatch of match[1].matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b\s*[:,]/g)) {
      fields.add(fieldMatch[1]);
    }
  }
  return [...fields].sort();
}

function extractHandlerContext(text, handlerName) {
  if (!handlerName) {
    return "";
  }
  const escapedName = handlerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`function\\s+${escapedName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,1200}?)\\n\\}`, "m"),
    new RegExp(`const\\s+${escapedName}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{([\\s\\S]{0,1200}?)\\n\\}`, "m")
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return "";
}

function inferRouteQueryParams(text) {
  const params = new Set();
  for (const match of String(text || "").matchAll(/\bquery\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    params.add(match[1]);
  }
  for (const match of String(text || "").matchAll(/\bquery\.([A-Za-z_][A-Za-z0-9_]*)\b/g)) {
    params.add(match[1]);
  }
  return [...params].sort();
}

function inferRouteAuthHint(routeArguments, handlerContext) {
  const combined = `${routeArguments || ""}\n${handlerContext || ""}`.toLowerCase();
  return /\b(auth|session|permission|guard|protected|require_auth|requireauth|ensureauth)\b/.test(combined)
    ? "secured"
    : "unknown";
}

function inferRouteCapabilityId(route) {
  if (route.handler_hint) {
    const genericHttpHandler = /^(get|post|put|patch|delete)$/i.test(route.handler_hint);
    if (!genericHttpHandler) {
      const normalizedHandler = route.handler_hint
        .replace(/^(handle|on)/i, "")
        .replace(/(handler|route|controller|action)$/i, "");
      const handlerTokens = normalizedHandler
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((token) => token.toLowerCase());
      if (handlerTokens.length > 0) {
        return `cap_${handlerTokens.join("_")}`;
      }
    }
  }
  const method = String(route.method || "").toUpperCase();
  const segments = routeSegments(normalizeOpenApiPath(route.path));
  const resource = canonicalCandidateTerm(segments[0] || "item");
  if (method === "GET" && segments.length <= 1) {
    return `cap_list_${resource}s`;
  }
  if (method === "GET" && segments.length > 1) {
    return `cap_get_${resource}`;
  }
  if (method === "POST") {
    return `cap_create_${resource}`;
  }
  if (method === "PATCH" || method === "PUT") {
    return `cap_update_${resource}`;
  }
  if (method === "DELETE") {
    return `cap_delete_${resource}`;
  }
  return `candidate_${route.method.toLowerCase()}_${slugify(route.path)}`;
}

function collectApiImport(paths) {
  const findings = [];
  const candidates = {
    capabilities: [],
    routes: [],
    stacks: []
  };
  const { openApiFiles } = discoverApiSources(paths);
  let usedOpenApi = false;

  for (const filePath of openApiFiles) {
    const provenance = relativeTo(paths.repoRoot, filePath);
    const text = readTextIfExists(filePath) || "";
    const document = filePath.endsWith(".json") ? JSON.parse(text) : parseOpenApiYaml(text);
    const parsed = parseOpenApiDocument(document, provenance, "openapi");
    usedOpenApi = true;
    findings.push({
      kind: "openapi",
      file: provenance,
      capability_count: parsed.capabilities.length
    });
    candidates.capabilities.push(...parsed.capabilities);
    candidates.routes.push(...parsed.routes.map((route) => ({
      path: route.path,
      method: route.method,
      confidence: "high",
      source_kind: route.source_kind,
      provenance: route.provenance
    })));
  }

  if (!usedOpenApi) {
    const inferredRoutes = [
      ...inferNextApiRoutes(paths),
      ...inferServerRoutes(paths)
    ];
    const inferredServerActions = inferNextServerActionCapabilities(paths);
    const inferredAuthCapabilities = inferNextAuthCapabilities(paths);
    if (inferredRoutes.length > 0) {
      findings.push({
        kind: "route_inventory",
        files: [...new Set(inferredRoutes.map((route) => relativeTo(paths.repoRoot, route.file)))],
        route_count: inferredRoutes.length
      });
      candidates.capabilities.push(
        ...inferredRoutes.map((route) =>
          makeCandidateRecord({
            kind: "capability",
            idHint: inferRouteCapabilityId(route),
            label: `${route.method} ${route.path}`,
            confidence: "medium",
            sourceKind: "route_code",
            provenance: `${relativeTo(paths.repoRoot, route.file)}#${route.method} ${route.path}`,
            endpoint: {
              method: route.method,
              path: normalizeOpenApiPath(route.path)
            },
            path_params: (route.path_params || []).map((name) => ({ name, required: true, type: null })),
            query_params: (route.query_params || []).map((name) => ({ name, required: false, type: null })),
            header_params: [],
            input_fields: [],
            output_fields: route.output_fields || [],
            auth_hint: route.auth_hint || "unknown"
          })
        )
      );
      candidates.routes.push(
        ...inferredRoutes.map((route) => ({
          path: normalizeOpenApiPath(route.path),
          method: route.method,
          confidence: "medium",
          source_kind: "route_code",
          provenance: `${relativeTo(paths.repoRoot, route.file)}#${route.method} ${route.path}`
        }))
      );
    }
    if (inferredServerActions.length > 0) {
      findings.push({
        kind: "next_server_actions",
        files: [...new Set(inferredServerActions.map((action) => relativeTo(paths.repoRoot, action.file)))],
        action_count: inferredServerActions.length
      });
      candidates.capabilities.push(
        ...inferredServerActions.map((action) =>
          makeCandidateRecord({
            kind: "capability",
            idHint: action.id_hint,
            label: titleCase(action.id_hint.replace(/^cap_/, "")),
            confidence: "medium",
            sourceKind: action.source_kind,
            provenance: `${relativeTo(paths.repoRoot, action.file)}#${action.function_name}`,
            endpoint: {
              method: action.method,
              path: normalizeOpenApiPath(action.path)
            },
            path_params: (action.path_params || []).map((name) => ({ name, required: true, type: null })),
            query_params: [],
            header_params: [],
            input_fields: action.input_fields || [],
            output_fields: action.output_fields || [],
            auth_hint: action.auth_hint || "unknown"
          })
        )
      );
      candidates.routes.push(
        ...inferredServerActions.map((action) => ({
          path: normalizeOpenApiPath(action.path),
          method: action.method,
          confidence: "medium",
          source_kind: action.source_kind,
          provenance: `${relativeTo(paths.repoRoot, action.file)}#${action.function_name}`
        }))
      );
    }
    if (inferredAuthCapabilities.length > 0) {
      findings.push({
        kind: "next_auth_flows",
        files: [...new Set(inferredAuthCapabilities.flatMap((capability) => capability.provenance || []))],
        capability_count: inferredAuthCapabilities.length
      });
      candidates.capabilities.push(
        ...inferredAuthCapabilities.map((capability) =>
          makeCandidateRecord({
            kind: "capability",
            idHint: capability.id_hint,
            label: capability.label,
            confidence: "medium",
            sourceKind: capability.source_kind,
            provenance: capability.provenance,
            endpoint: {
              method: capability.method,
              path: normalizeOpenApiPath(capability.path)
            },
            path_params: [],
            query_params: [],
            header_params: [],
            input_fields: capability.input_fields || [],
            output_fields: capability.output_fields || [],
            auth_hint: capability.auth_hint || "unknown",
            entity_id: capability.entity_id,
            target_state: capability.target_state || null
          })
        )
      );
      candidates.routes.push(
        ...inferredAuthCapabilities.map((capability) => ({
          path: normalizeOpenApiPath(capability.path),
          method: capability.method,
          confidence: "medium",
          source_kind: capability.source_kind,
          provenance: capability.provenance
        }))
      );
    }
  }

  const reactRoutes = inferReactRoutes(path.join(paths.workspaceRoot, "apps", "web"));
  if (reactRoutes.length > 0) {
    findings.push({
      kind: "react_routes",
      file: relativeTo(paths.repoRoot, path.join(paths.workspaceRoot, "apps", "web", "src", "App.tsx")),
      routes: reactRoutes
    });
    candidates.routes.push(...reactRoutes.map((route) => ({
      path: route,
      method: "GET",
      confidence: "medium",
      source_kind: "generated_artifact",
      provenance: relativeTo(paths.repoRoot, path.join(paths.workspaceRoot, "apps", "web", "src", "App.tsx"))
    })));
    candidates.stacks.push("react_web");
  }

  const svelteRoutes = inferSvelteRoutes(path.join(paths.workspaceRoot, "apps", "web-sveltekit"));
  if (svelteRoutes.length > 0) {
    findings.push({
      kind: "sveltekit_routes",
      file: relativeTo(paths.repoRoot, path.join(paths.workspaceRoot, "apps", "web-sveltekit", "src", "routes")),
      routes: svelteRoutes
    });
    candidates.routes.push(...svelteRoutes.map((route) => ({
      path: route,
      method: "GET",
      confidence: "medium",
      source_kind: "generated_artifact",
      provenance: relativeTo(paths.repoRoot, path.join(paths.workspaceRoot, "apps", "web-sveltekit", "src", "routes"))
    })));
    candidates.stacks.push("sveltekit_web");
  }

  candidates.capabilities = dedupeCandidateRecords(candidates.capabilities, (record) => record.id_hint);
  candidates.routes = dedupeCandidateRecords(
    candidates.routes.map((route) => ({
      ...route,
      id_hint: route.id_hint || `${route.method}_${route.path}`
    })),
    (record) => `${record.method}:${record.path}:${record.source_kind}`
  ).map(({ id_hint, ...route }) => route);

  return { findings, candidates };
}

function inferSvelteRoutes(rootDir) {
  const routesRoot = path.join(rootDir, "src", "routes");
  if (!fs.existsSync(routesRoot)) {
    return [];
  }
  const files = listFilesRecursive(routesRoot, (child) => child.endsWith("+page.svelte") || child.endsWith("+page.ts") || child.endsWith("+page.server.ts"));
  const routes = new Set();
  for (const filePath of files) {
    const relative = relativeTo(routesRoot, filePath)
      .replace(/(^|\/)\+page(\.server|)\.(svelte|ts)$/, "")
      .replace(/\[(.+?)\]/g, ":$1")
      .replace(/^$/, "/");
    routes.add(relative.startsWith("/") ? relative : `/${relative}`);
  }
  return [...routes].sort();
}

function inferReactRoutes(rootDir) {
  const appPath = path.join(rootDir, "src", "App.tsx");
  const text = readTextIfExists(appPath);
  if (!text) {
    return [];
  }
  const routes = new Set();
  for (const match of text.matchAll(/path:\s*"([^"]+)"/g)) {
    routes.add(match[1]);
  }
  for (const match of text.matchAll(/path="([^"]+)"/g)) {
    routes.add(match[1]);
  }
  return [...routes].sort();
}

function inferNextAppRoutes(rootDir) {
  const appDir = path.join(rootDir, "app");
  if (!fs.existsSync(appDir)) {
    return [];
  }
  const routeFiles = listFilesRecursive(
    appDir,
    (child) =>
      /\/page\.(tsx|ts|jsx|js|mdx)$/.test(child) ||
      /\/route\.(tsx|ts|jsx|js)$/.test(child)
  );
  const routes = [];
  for (const filePath of routeFiles) {
    const relative = relativeTo(appDir, filePath);
    const isPage = /\/page\.(tsx|ts|jsx|js|mdx)$/.test(`/${relative}`) || /^page\.(tsx|ts|jsx|js|mdx)$/.test(relative);
    const normalizedPath = `/${relative}`
      .replace(/\/page\.(tsx|ts|jsx|js|mdx)$/, "")
      .replace(/\/route\.(tsx|ts|jsx|js)$/, "")
      .replace(/\[(\.\.\.)?([^\]]+)\]/g, (_match, catchAll, name) => catchAll ? `:${name}*` : `:${name}`)
      .replace(/\/index$/, "")
      .replace(/^\/$/, "/");
    routes.push({
      path: normalizedPath === "" ? "/" : normalizedPath,
      kind: isPage ? "page" : "route",
      file: filePath
    });
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind));
}

function nextScreenKindForRoute(routePath) {
  const normalized = String(routePath || "");
  if (/\/(login|register|setup)$/.test(normalized)) {
    return "flow";
  }
  return screenKindForRoute(routePath);
}

function nextScreenIdForRoute(routePath) {
  const normalized = String(routePath || "");
  if (normalized === "/") {
    return "home";
  }
  if (/\/login$/.test(normalized)) {
    return "login";
  }
  if (/\/register$/.test(normalized)) {
    return "register";
  }
  if (/\/setup$/.test(normalized)) {
    return "setup";
  }
  return screenIdForRoute(routePath);
}

function entityIdForNextRoute(routePath) {
  const normalized = String(routePath || "");
  if (/^\/posts(\/|$)/.test(normalized)) {
    return "entity_post";
  }
  if (/^\/users(\/|$)/.test(normalized)) {
    return "entity_user";
  }
  return null;
}

function conceptIdForNextRoute(routePath) {
  const normalized = String(routePath || "");
  if (normalized === "/") {
    return "surface_home";
  }
  if (/\/login$/.test(normalized)) {
    return "flow_login";
  }
  if (/\/register$/.test(normalized)) {
    return "flow_register";
  }
  if (/\/setup$/.test(normalized)) {
    return "flow_setup";
  }
  return entityIdForNextRoute(routePath) || entityIdForRoute(routePath);
}

function uiCapabilityHintsForNextRoute(routePath) {
  const normalized = String(routePath || "");
  if (normalized === "/") {
    return { load: null, submit: null, primary_action: null };
  }
  if (/\/login$/.test(normalized)) {
    return { load: null, submit: "cap_sign_in_user", primary_action: "cap_sign_in_user" };
  }
  if (/\/register$/.test(normalized)) {
    return { load: null, submit: "cap_register_user", primary_action: "cap_register_user" };
  }
  if (/\/setup$/.test(normalized)) {
    return { load: null, submit: null, primary_action: null };
  }
  if (/^\/posts\/new$/.test(normalized)) {
    return { load: null, submit: "cap_create_post", primary_action: "cap_create_post" };
  }
  if (/^\/posts\/:id$/.test(normalized) || /^\/posts\/:[^/]+$/.test(normalized)) {
    return { load: "cap_get_post", submit: null, primary_action: "cap_update_post" };
  }
  if (/^\/posts$/.test(normalized)) {
    return { load: "cap_list_posts", submit: null, primary_action: "cap_create_post" };
  }
  if (/^\/users\/new$/.test(normalized)) {
    return { load: null, submit: "cap_create_user", primary_action: "cap_create_user" };
  }
  return uiCapabilityHintsForRoute(routePath);
}

function routeSegments(routePath) {
  return String(routePath || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/^:/, ""));
}

function screenKindForRoute(routePath) {
  const normalized = String(routePath || "");
  const segments = routeSegments(normalized);
  if (/\/new$/.test(normalized)) {
    return "form";
  }
  if (/\/:?[A-Za-z0-9_]+\/edit$/.test(normalized)) {
    return "form";
  }
  if (segments.length >= 2 && !/\/new$/.test(normalized) && !/\/edit$/.test(normalized)) {
    return "detail";
  }
  return "list";
}

function screenIdForRoute(routePath) {
  const segments = routeSegments(routePath);
  const resource = canonicalCandidateTerm(segments[0] || "home");
  const kind = screenKindForRoute(routePath);
  if (kind === "form" && /\/new$/.test(routePath)) {
    return `${resource}_create`;
  }
  if (kind === "form" && /\/edit$/.test(routePath)) {
    return `${resource}_edit`;
  }
  if (kind === "detail") {
    return `${resource}_detail`;
  }
  return `${resource}_list`;
}

function uiCapabilityHintsForRoute(routePath) {
  const segments = routeSegments(routePath);
  const resource = canonicalCandidateTerm(segments[0] || "item");
  const idSegment = segments[1] || null;
  if (/\/new$/.test(routePath)) {
    return { load: null, submit: `cap_create_${resource}`, primary_action: `cap_create_${resource}` };
  }
  if (/\/edit$/.test(routePath)) {
    return { load: `cap_get_${resource}`, submit: `cap_update_${resource}`, primary_action: `cap_update_${resource}` };
  }
  if (idSegment && !/new|edit/.test(idSegment)) {
    return { load: `cap_get_${resource}`, submit: null, primary_action: `cap_update_${resource}` };
  }
  return { load: `cap_list_${resource}s`, submit: null, primary_action: `cap_create_${resource}` };
}

function entityIdForRoute(routePath) {
  const segments = routeSegments(routePath);
  return `entity_${canonicalCandidateTerm(segments[0] || "item")}`;
}

function collectUiImport(paths) {
  const findings = [];
  const candidates = {
    screens: [],
    routes: [],
    actions: [],
    stacks: []
  };

  const reactRoots = [
    path.join(paths.workspaceRoot, "apps", "web"),
    path.join(paths.workspaceRoot, "examples", "maintained", "proof-app")
  ];
  const svelteRoots = [
    path.join(paths.workspaceRoot, "apps", "web-sveltekit"),
    path.join(paths.workspaceRoot, "apps", "local-stack", "web")
  ];
  const nextRoots = [paths.workspaceRoot];

  for (const rootDir of reactRoots) {
    const routes = inferReactRoutes(rootDir);
    if (routes.length === 0) {
      continue;
    }
    const provenance = relativeTo(paths.repoRoot, path.join(rootDir, "src", "App.tsx"));
    findings.push({
      kind: "react_screen_routes",
      file: provenance,
      routes
    });
    candidates.stacks.push("react_web");
    for (const routePath of routes) {
      const screenId = screenIdForRoute(routePath);
      const screenKind = screenKindForRoute(routePath);
      const capabilityHints = uiCapabilityHintsForRoute(routePath);
      candidates.screens.push(
        makeCandidateRecord({
          kind: "screen",
          idHint: screenId,
          label: titleCase(screenId),
          confidence: "medium",
          sourceKind: "route_code",
          provenance: `${provenance}#${routePath}`,
          track: "ui",
          entity_id: entityIdForRoute(routePath),
          screen_kind: screenKind,
          route_path: routePath,
          capability_hints: capabilityHints
        })
      );
      candidates.routes.push(
        makeCandidateRecord({
          kind: "ui_route",
          idHint: `${screenId}_route`,
          label: routePath,
          confidence: "medium",
          sourceKind: "route_code",
          provenance: `${provenance}#${routePath}`,
          track: "ui",
          screen_id: screenId,
          entity_id: entityIdForRoute(routePath),
          path: routePath
        })
      );
      if (capabilityHints.primary_action) {
        candidates.actions.push(
          makeCandidateRecord({
            kind: "ui_action",
            idHint: `${screenId}_${idHintify(capabilityHints.primary_action)}`,
            label: capabilityHints.primary_action,
            confidence: "low",
            sourceKind: "route_code",
            provenance: `${provenance}#${routePath}`,
            track: "ui",
            screen_id: screenId,
            entity_id: entityIdForRoute(routePath),
            capability_hint: capabilityHints.primary_action,
            prominence: screenKind === "list" ? "primary" : "secondary"
          })
        );
      }
    }
  }

  for (const rootDir of svelteRoots) {
    const routes = inferSvelteRoutes(rootDir);
    if (routes.length === 0) {
      continue;
    }
    const provenance = relativeTo(paths.repoRoot, path.join(rootDir, "src", "routes"));
    findings.push({
      kind: "sveltekit_screen_routes",
      file: provenance,
      routes
    });
    candidates.stacks.push("sveltekit_web");
    for (const routePath of routes) {
      const screenId = screenIdForRoute(routePath);
      const screenKind = screenKindForRoute(routePath);
      const capabilityHints = uiCapabilityHintsForRoute(routePath);
      candidates.screens.push(
        makeCandidateRecord({
          kind: "screen",
          idHint: screenId,
          label: titleCase(screenId),
          confidence: "medium",
          sourceKind: "route_code",
          provenance: `${provenance}#${routePath}`,
          track: "ui",
          entity_id: entityIdForRoute(routePath),
          screen_kind: screenKind,
          route_path: routePath,
          capability_hints: capabilityHints
        })
      );
      candidates.routes.push(
        makeCandidateRecord({
          kind: "ui_route",
          idHint: `${screenId}_route`,
          label: routePath,
          confidence: "medium",
          sourceKind: "route_code",
          provenance: `${provenance}#${routePath}`,
          track: "ui",
          screen_id: screenId,
          entity_id: entityIdForRoute(routePath),
          path: routePath
        })
      );
    }
  }

  for (const rootDir of nextRoots) {
    const routes = inferNextAppRoutes(rootDir);
    if (routes.length === 0) {
      continue;
    }
    const provenanceRoot = relativeTo(paths.repoRoot, path.join(rootDir, "app"));
    findings.push({
      kind: "next_app_routes",
      file: provenanceRoot,
      routes: routes.map((route) => route.path)
    });
    candidates.stacks.push("next_app_router");
    for (const route of routes) {
      if (route.kind !== "page") {
        continue;
      }
      const routeProvenance = `${relativeTo(paths.repoRoot, route.file)}#${route.path}`;
      const screenId = nextScreenIdForRoute(route.path);
      const screenKind = nextScreenKindForRoute(route.path);
      const capabilityHints = uiCapabilityHintsForNextRoute(route.path);
      const entityId = entityIdForNextRoute(route.path);
      const conceptId = conceptIdForNextRoute(route.path);
      candidates.screens.push(
        makeCandidateRecord({
          kind: "screen",
          idHint: screenId,
          label: titleCase(screenId),
          confidence: "medium",
          sourceKind: "route_code",
          provenance: routeProvenance,
          track: "ui",
          entity_id: entityId,
          concept_id: conceptId,
          screen_kind: screenKind,
          route_path: route.path,
          capability_hints: capabilityHints
        })
      );
      candidates.routes.push(
        makeCandidateRecord({
          kind: "ui_route",
          idHint: `${screenId}_route`,
          label: route.path,
          confidence: "medium",
          sourceKind: "route_code",
          provenance: routeProvenance,
          track: "ui",
          screen_id: screenId,
          entity_id: entityId,
          concept_id: conceptId,
          path: route.path
        })
      );
      if (capabilityHints.primary_action) {
        candidates.actions.push(
          makeCandidateRecord({
            kind: "ui_action",
            idHint: `${screenId}_${idHintify(capabilityHints.primary_action)}`,
            label: capabilityHints.primary_action,
            confidence: "low",
            sourceKind: "route_code",
            provenance: routeProvenance,
            track: "ui",
            screen_id: screenId,
            entity_id: entityId,
            concept_id: conceptId,
            capability_hint: capabilityHints.primary_action,
            prominence: screenKind === "list" ? "primary" : "secondary"
          })
        );
      }
    }
  }

  candidates.screens = dedupeCandidateRecords(candidates.screens, (record) => record.id_hint);
  candidates.routes = dedupeCandidateRecords(candidates.routes, (record) => record.id_hint);
  candidates.actions = dedupeCandidateRecords(candidates.actions, (record) => record.id_hint);
  candidates.stacks = [...new Set(candidates.stacks)].sort();

  return { findings, candidates };
}

function workflowEntityIdForCapability(capability) {
  return inferCapabilityEntityId(capability);
}

function findEntityStatusFields(entity, enumCandidatesById) {
  return (entity?.fields || []).filter((field) =>
    ["status", "state"].includes(field.name) && enumCandidatesById.has(idHintify(field.field_type))
  );
}

function targetStateForCapability(capability, knownStates) {
  if (capability.target_state) {
    const explicitState = idHintify(capability.target_state);
    if (knownStates.length === 0 || knownStates.includes(explicitState)) {
      return explicitState;
    }
  }
  const id = capability.id_hint || "";
  const method = String(capability.endpoint?.method || "").toUpperCase();
  const candidates = [
    ["sign_in", "authenticated"],
    ["login", "authenticated"],
    ["authenticate", "authenticated"],
    ["register", "registered"],
    ["approve", "approved"],
    ["reject", "rejected"],
    ["revision", "needs_revision"],
    ["request_revision", "needs_revision"],
    ["submit", "submitted"],
    ["close", "closed"],
    ["complete", "completed"],
    ["archive", "archived"],
    ["delete", "deleted"],
    [method === "POST" && id.startsWith("cap_create_") ? "create" : "", knownStates[0] || "created"]
  ].filter(([needle]) => needle);
  for (const [needle, state] of candidates) {
    if (id.includes(needle) && state) {
      const canonicalState = idHintify(state);
      if (knownStates.length === 0 || knownStates.includes(canonicalState)) {
        return canonicalState;
      }
    }
  }
  return null;
}

function collectWorkflowImport(paths) {
  const findings = [];
  const candidates = {
    workflows: [],
    workflow_states: [],
    workflow_transitions: []
  };
  const dbImport = collectDbImport(paths);
  const apiImport = collectApiImport(paths);
  const docScan = scanDocsWorkflow(paths.topogramRoot).summary;
  const enumCandidatesById = new Map((dbImport.candidates.enums || []).map((entry) => [entry.id_hint, entry]));
  const entityCandidatesById = new Map((dbImport.candidates.entities || []).map((entry) => [entry.id_hint, entry]));
  const workflowDocs = (docScan.candidate_docs || []).filter((doc) => doc.kind === "workflow");
  const workflows = new Map();

  for (const capability of apiImport.candidates.capabilities || []) {
    const entityId = workflowEntityIdForCapability(capability);
    const workflowId = `workflow_${entityId.replace(/^entity_/, "")}`;
    const capabilityActors =
      capability.auth_hint === "secured" ? ["user"] :
      capability.auth_hint === "public" ? ["anonymous"] :
      [];
    if (!workflows.has(workflowId)) {
      const entity = entityCandidatesById.get(entityId);
      const statusFields = findEntityStatusFields(entity, enumCandidatesById);
      const states = statusFields.flatMap((field) => enumCandidatesById.get(idHintify(field.field_type))?.values || []).map(idHintify);
      workflows.set(workflowId, {
        workflow: makeCandidateRecord({
          kind: "workflow",
          idHint: workflowId,
          label: `${titleCase(entityId.replace(/^entity_/, ""))} Workflow`,
          confidence: "medium",
          sourceKind: "generated_artifact",
          provenance: capability.provenance || [],
          track: "workflows",
          entity_id: entityId,
          actor_hints: capabilityActors,
          related_capabilities: []
        }),
        states: states.map((state) =>
          makeCandidateRecord({
            kind: "workflow_state",
            idHint: `${workflowId}_${state}`,
            label: titleCase(state),
            confidence: "medium",
            sourceKind: "schema",
            provenance: entity?.provenance || capability.provenance || [],
            track: "workflows",
            workflow_id: workflowId,
            entity_id: entityId,
            state_id: state
          })
        ),
        transitions: []
      });
    }
    const workflow = workflows.get(workflowId);
    workflow.workflow.related_capabilities.push(capability.id_hint);
    workflow.workflow.actor_hints = [...new Set([...(workflow.workflow.actor_hints || []), ...capabilityActors])].sort();
    const knownStates = workflow.states.map((entry) => entry.state_id);
    const targetState = targetStateForCapability(capability, knownStates);
    if (targetState) {
      workflow.transitions.push(
        makeCandidateRecord({
          kind: "workflow_transition",
          idHint: `${workflowId}_${idHintify(capability.id_hint)}`,
          label: titleCase(capability.id_hint.replace(/^cap_/, "")),
          confidence: "low",
          sourceKind: capability.source_kind || "generated_artifact",
          provenance: capability.provenance || [],
          track: "workflows",
          workflow_id: workflowId,
          entity_id: entityId,
          capability_id: capability.id_hint,
          actor_hints: capabilityActors,
          to_state: targetState
        })
      );
    }
  }

  for (const workflow of workflows.values()) {
    workflow.workflow.related_capabilities = [...new Set(workflow.workflow.related_capabilities)].sort();
    candidates.workflows.push(workflow.workflow);
    candidates.workflow_states.push(...workflow.states);
    candidates.workflow_transitions.push(...workflow.transitions);
  }

  findings.push({
    kind: "workflow_inference",
    workflow_count: candidates.workflows.length,
    workflow_doc_signals: workflowDocs.map((doc) => doc.id)
  });

  candidates.workflows = dedupeCandidateRecords(candidates.workflows, (record) => record.id_hint);
  candidates.workflow_states = dedupeCandidateRecords(candidates.workflow_states, (record) => record.id_hint);
  candidates.workflow_transitions = dedupeCandidateRecords(candidates.workflow_transitions, (record) => record.id_hint);

  return { findings, candidates };
}

function importAppWorkflow(inputPath, options = {}) {
  return runImportAppWorkflow(inputPath, {
    ...options,
    scanDocsSummary: () => scanDocsWorkflow(inputPath).summary
  });
}

function loadImportArtifacts(paths, inputPath) {
  const dbCandidates = readJsonIfExists(path.join(paths.topogramRoot, "candidates", "app", "db", "candidates.json"));
  const apiCandidates = readJsonIfExists(path.join(paths.topogramRoot, "candidates", "app", "api", "candidates.json"));
  const uiCandidates = readJsonIfExists(path.join(paths.topogramRoot, "candidates", "app", "ui", "candidates.json"));
  const workflowCandidates = readJsonIfExists(path.join(paths.topogramRoot, "candidates", "app", "workflows", "candidates.json"));
  const verificationCandidates = readJsonIfExists(path.join(paths.topogramRoot, "candidates", "app", "verification", "candidates.json"));
  const docsReport = readJsonIfExists(path.join(paths.topogramRoot, "candidates", "docs", "import-report.json"));
  if (dbCandidates || apiCandidates || uiCandidates || workflowCandidates || verificationCandidates || docsReport) {
    return {
      type: "import_app_report",
      workspace: paths.workspaceRoot,
      candidates: {
        db: dbCandidates || { entities: [], enums: [], relations: [], indexes: [] },
        api: apiCandidates || { capabilities: [], routes: [], stacks: [] },
        ui: uiCandidates || { screens: [], routes: [], actions: [], stacks: [] },
        workflows: workflowCandidates || { workflows: [], workflow_states: [], workflow_transitions: [] },
        verification: verificationCandidates || { verifications: [], scenarios: [], frameworks: [], scripts: [] },
        docs: docsReport?.candidate_docs || [],
        actors: docsReport?.candidate_actors || [],
        roles: docsReport?.candidate_roles || []
      }
    };
  }
  const imported = importAppWorkflow(inputPath, { from: "db,api,ui,workflows,verification" }).summary;
  const docsSummary = scanDocsWorkflow(inputPath).summary;
  imported.candidates.docs = docsSummary.candidate_docs || [];
  imported.candidates.actors = docsSummary.candidate_actors || [];
  imported.candidates.roles = docsSummary.candidate_roles || [];
  return imported;
}

function compareEntityFields(importedEntity, graphEntity) {
  const graphFields = new Map((graphEntity.fields || []).map((field) => [field.name, field]));
  const missing = [];
  const typeMismatches = [];
  const requiredMismatches = [];
  for (const field of importedEntity.fields || []) {
    const graphField = graphFields.get(field.name);
    if (!graphField) {
      missing.push(field.name);
      continue;
    }
    if (String(graphField.fieldType) !== String(field.field_type)) {
      typeMismatches.push({
        field: field.name,
        imported: field.field_type,
        topogram: graphField.fieldType
      });
    }
    if (Boolean(graphField.required) !== Boolean(field.required)) {
      requiredMismatches.push({
        field: field.name,
        imported: Boolean(field.required),
        topogram: Boolean(graphField.required)
      });
    }
  }
  return { missing, typeMismatches, requiredMismatches };
}

function normalizeApiCandidateId(value) {
  return String(value || "").trim().toLowerCase();
}

function collectContractFieldNames(fields, jsonSchema) {
  const names = new Set((fields || []).map((field) => field.name).filter(Boolean));
  for (const propertyName of Object.keys(jsonSchema?.properties || {})) {
    names.add(propertyName);
  }
  return [...names].sort();
}

function buildTopogramApiCapabilityIndex(graph) {
  const contracts = generateApiContractGraph(graph);
  const records = [];
  for (const capability of graph.byKind.capability || []) {
    const contract = contracts[capability.id];
    if (!contract) {
      continue;
    }
    records.push({
      id: capability.id,
      endpoint: {
        method: contract.endpoint.method,
        path: normalizeOpenApiPath(contract.endpoint.path)
      },
      input_fields: collectContractFieldNames(contract.requestContract?.fields, contract.requestContract?.jsonSchema),
      output_fields: collectContractFieldNames(contract.responseContract?.fields, contract.responseContract?.jsonSchema),
      path_params: (contract.requestContract?.transport?.path || []).map((field) => field.name).filter(Boolean).sort(),
      query_params: (contract.requestContract?.transport?.query || []).map((field) => field.name).filter(Boolean).sort()
    });
  }
  return records;
}

function matchImportedApiCapability(importedCapability, topogramCapabilities) {
  const importedId = normalizeApiCandidateId(importedCapability.id_hint);
  const importedMethod = String(importedCapability.endpoint?.method || "").toUpperCase();
  const importedPath = normalizeEndpointPathForMatch(importedCapability.endpoint?.path || "");
  return topogramCapabilities.find((capability) =>
    normalizeApiCandidateId(capability.id) === importedId ||
    (capability.endpoint.method === importedMethod && normalizeEndpointPathForMatch(capability.endpoint.path) === importedPath)
  ) || null;
}

function compareApiCapabilityFields(importedCapability, topogramCapability) {
  const missingInputFields = (importedCapability.input_fields || []).filter((field) => !topogramCapability.input_fields.includes(field));
  const missingOutputFields = (importedCapability.output_fields || []).filter((field) => !topogramCapability.output_fields.includes(field));
  const missingPathParams = (importedCapability.path_params || []).map((entry) => entry.name).filter((name) => !topogramCapability.path_params.includes(name));
  const missingQueryParams = (importedCapability.query_params || []).map((entry) => entry.name).filter((name) => !topogramCapability.query_params.includes(name));
  return {
    missing_input_fields_in_topogram: missingInputFields,
    missing_output_fields_in_topogram: missingOutputFields,
    missing_path_params_in_topogram: missingPathParams,
    missing_query_params_in_topogram: missingQueryParams
  };
}

function collectCanonicalUiSurface(graph) {
  const screens = new Set();
  const routes = new Set();
  for (const projection of graph.byKind.projection || []) {
    if (!["ui_contract", "web_surface"].includes(projection.platform)) {
      continue;
    }
    for (const screen of projection.uiScreens || []) {
      screens.add(screen.id);
    }
    for (const route of projection.uiRoutes || []) {
      routes.add(route.path);
    }
  }
  return {
    screens: [...screens].sort(),
    routes: [...routes].sort()
  };
}

function collectCanonicalWorkflowSurface(graph) {
  const docs = (graph.docs || []).filter((doc) => doc.kind === "workflow");
  const decisions = (graph.byKind.decision || []).map((decision) => decision.id);
  return {
    workflow_docs: docs.map((doc) => doc.id).sort(),
    decisions: decisions.sort()
  };
}

function collectCanonicalActorRoleSurface(graph) {
  const journeyDocs = (graph.docs || []).filter((doc) => doc.kind === "journey");
  const workflowDocs = (graph.docs || []).filter((doc) => doc.kind === "workflow");
  return {
    actor_ids: ((graph.byKind.actor || []).map((entry) => entry.id)).sort(),
    role_ids: ((graph.byKind.role || []).map((entry) => entry.id)).sort(),
    journey_docs: journeyDocs,
    workflow_docs: workflowDocs
  };
}

function buildBundleDocLinkSuggestions(bundle, graph) {
  if (!graph) {
    return [];
  }
  const canonicalDocs = new Map(
    (graph.docs || [])
      .filter((doc) => ["journey", "workflow"].includes(doc.kind))
      .map((doc) => [doc.id, doc])
  );
  const suggestions = new Map();
  const getOrCreateSuggestion = (doc) => {
    if (!suggestions.has(doc.id)) {
      suggestions.set(doc.id, {
        doc_id: doc.id,
        doc_kind: doc.kind,
        canonical_rel_path: doc.relativePath,
        add_related_actors: [],
        add_related_roles: [],
        add_related_capabilities: [],
        add_related_rules: [],
        add_related_workflows: []
      });
    }
    return suggestions.get(doc.id);
  };
  for (const entry of [...(bundle.actors || []), ...(bundle.roles || [])]) {
    const kind = entry.id_hint.startsWith("actor_") ? "actor" : "role";
    for (const docId of entry.related_docs || []) {
      const doc = canonicalDocs.get(docId);
      if (!doc) {
        continue;
      }
      const target = getOrCreateSuggestion(doc);
      if (kind === "actor" && !(doc.relatedActors || []).includes(entry.id_hint)) {
        target.add_related_actors.push(entry.id_hint);
      }
      if (kind === "role" && !(doc.relatedRoles || []).includes(entry.id_hint)) {
        target.add_related_roles.push(entry.id_hint);
      }
    }
  }
  for (const entry of bundle.docs || []) {
    const doc = canonicalDocs.get(entry.id);
    if (!doc) {
      continue;
    }
    const target = getOrCreateSuggestion(doc);
    for (const capabilityId of entry.related_capabilities || []) {
      if (!(doc.relatedCapabilities || []).includes(capabilityId)) {
        target.add_related_capabilities.push(capabilityId);
      }
    }
    for (const ruleId of entry.related_rules || []) {
      if (!(doc.relatedRules || []).includes(ruleId)) {
        target.add_related_rules.push(ruleId);
      }
    }
    for (const workflowId of entry.related_workflows || []) {
      if (!(doc.relatedWorkflows || []).includes(workflowId)) {
        target.add_related_workflows.push(workflowId);
      }
    }
  }
  return [...suggestions.values()]
    .map((entry) => ({
      ...entry,
      add_related_actors: [...new Set(entry.add_related_actors)].sort(),
      add_related_roles: [...new Set(entry.add_related_roles)].sort(),
      add_related_capabilities: [...new Set(entry.add_related_capabilities)].sort(),
      add_related_rules: [...new Set(entry.add_related_rules)].sort(),
      add_related_workflows: [...new Set(entry.add_related_workflows)].sort()
    }))
    .filter((entry) =>
      entry.add_related_actors.length > 0 ||
      entry.add_related_roles.length > 0 ||
      entry.add_related_capabilities.length > 0 ||
      entry.add_related_rules.length > 0 ||
      entry.add_related_workflows.length > 0
    )
    .map((entry) => ({
      ...entry,
      patch_rel_path: `doc-link-patches/${entry.doc_id}.md`,
      recommendation:
        `Update \`${entry.doc_id}\` to add` +
        `${entry.add_related_actors.length ? ` related_actors ${entry.add_related_actors.map((item) => `\`${item}\``).join(", ")}` : ""}` +
        `${entry.add_related_actors.length && (entry.add_related_roles.length || entry.add_related_capabilities.length || entry.add_related_rules.length || entry.add_related_workflows.length) ? " and" : ""}` +
        `${entry.add_related_roles.length ? ` related_roles ${entry.add_related_roles.map((item) => `\`${item}\``).join(", ")}` : ""}` +
        `${entry.add_related_roles.length && (entry.add_related_capabilities.length || entry.add_related_rules.length || entry.add_related_workflows.length) ? "," : ""}` +
        `${entry.add_related_capabilities.length ? ` related_capabilities ${entry.add_related_capabilities.map((item) => `\`${item}\``).join(", ")}` : ""}` +
        `${entry.add_related_capabilities.length && (entry.add_related_rules.length || entry.add_related_workflows.length) ? "," : ""}` +
        `${entry.add_related_rules.length ? ` related_rules ${entry.add_related_rules.map((item) => `\`${item}\``).join(", ")}` : ""}` +
        `${entry.add_related_rules.length && entry.add_related_workflows.length ? "," : ""}` +
        `${entry.add_related_workflows.length ? ` related_workflows ${entry.add_related_workflows.map((item) => `\`${item}\``).join(", ")}` : ""}.`
    }))
    .sort((a, b) =>
      (b.add_related_actors.length + b.add_related_roles.length) - (a.add_related_actors.length + a.add_related_roles.length) ||
      a.doc_id.localeCompare(b.doc_id)
    );
}

function summarizeGapCandidates(records = []) {
  return records
    .map((record) => ({
      id: record.id_hint,
      confidence: record.confidence || "low",
      inference: record.inference_summary || null,
      related_docs: record.related_docs || [],
      related_capabilities: record.related_capabilities || []
    }))
    .sort((a, b) => {
      const confidenceDelta = confidenceRank(b.confidence) - confidenceRank(a.confidence);
      if (confidenceDelta !== 0) {
        return confidenceDelta;
      }
      return a.id.localeCompare(b.id);
    });
}

function reportGapsWorkflow(inputPath) {
  const paths = normalizeWorkspacePaths(inputPath);
  const graph = tryLoadResolvedGraph(paths.topogramRoot);
  const scan = graph ? scanDocsWorkflow(paths.topogramRoot).summary : { candidate_docs: [] };
  const appImport = loadImportArtifacts(paths, inputPath);

  const importedDb = appImport.candidates.db || { entities: [], enums: [], relations: [], indexes: [] };
  const importedApi = appImport.candidates.api || { capabilities: [], routes: [], stacks: [] };
  const importedUi = appImport.candidates.ui || { screens: [], routes: [], actions: [], stacks: [] };
  const importedWorkflows = appImport.candidates.workflows || { workflows: [], workflow_states: [], workflow_transitions: [] };
  const importedActors = appImport.candidates.actors || [];
  const importedRoles = appImport.candidates.roles || [];

  if (!graph) {
    const report = {
      type: "gap_report",
      workspace: paths.workspaceRoot,
      bootstrapped_topogram_root: paths.bootstrappedTopogramRoot,
      topogram_available: false,
      imported: {
        db: {
          entity_count: importedDb.entities.length,
          enum_count: importedDb.enums.length,
          relation_count: importedDb.relations.length
        },
        api: {
          capability_count: importedApi.capabilities.length,
          route_count: importedApi.routes.length
        },
        ui: {
          screen_count: importedUi.screens.length,
          route_count: importedUi.routes.length
        },
        workflows: {
          workflow_count: importedWorkflows.workflows.length,
          transition_count: importedWorkflows.workflow_transitions.length
        },
        actors_roles: {
          actor_count: importedActors.length,
          role_count: importedRoles.length
        }
      }
    };
    const files = {
      "candidates/reports/gap-report.json": `${stableStringify(report)}\n`,
      "candidates/reports/gap-report.md": ensureTrailingNewline(
        `# Gap Report\n\nNo canonical Topogram was found.\n\n- Imported DB entities: ${importedDb.entities.length}\n- Imported DB enums: ${importedDb.enums.length}\n- Imported API capabilities: ${importedApi.capabilities.length}\n- Imported API routes: ${importedApi.routes.length}\n- Imported UI screens: ${importedUi.screens.length}\n- Imported workflows: ${importedWorkflows.workflows.length}\n- Imported actors: ${importedActors.length}\n- Imported roles: ${importedRoles.length}\n`
      )
    };
    return {
      summary: report,
      files,
      defaultOutDir: paths.topogramRoot
    };
  }

  const glossaryDocs = new Set((graph.docs || []).filter((doc) => doc.kind === "glossary").map((doc) => doc.id));
  const workflowDocs = (graph.docs || []).filter((doc) => doc.kind === "workflow");
  const canonicalUi = collectCanonicalUiSurface(graph);
  const canonicalWorkflow = collectCanonicalWorkflowSurface(graph);
  const canonicalActorRole = collectCanonicalActorRoleSurface(graph);
  const entityMap = new Map((graph.byKind.entity || []).map((entity) => [entity.id.replace(/^entity_/, ""), entity]));
  const enumMap = new Map((graph.byKind.enum || []).map((entry) => [entry.id, entry]));
  const topogramApiCapabilities = buildTopogramApiCapabilityIndex(graph);
  const capabilityIds = new Set(topogramApiCapabilities.map((capability) => capability.id));
  const canonicalActorIds = new Set(canonicalActorRole.actor_ids);
  const canonicalRoleIds = new Set(canonicalActorRole.role_ids);
  const capabilityById = new Map((graph.byKind.capability || []).map((entry) => [entry.id, entry]));

  const missingGlossary = [...entityMap.keys()].filter((id) => !glossaryDocs.has(id));
  const missingWorkflowDocs = (graph.byKind.capability || [])
    .filter((capability) => [...capability.creates, ...capability.updates, ...capability.deletes].length > 0)
    .filter((capability) => !workflowDocs.some((doc) => doc.relatedCapabilities.includes(capability.id)))
    .map((capability) => capability.id);

  const dbEntitiesMissing = [];
  const dbFieldMismatches = [];
  for (const candidate of importedDb.entities || []) {
    const canonicalId = candidate.id_hint.replace(/^entity_/, "");
    const graphEntity = entityMap.get(canonicalId);
    if (!graphEntity) {
      dbEntitiesMissing.push(canonicalId);
      continue;
    }
    const mismatch = compareEntityFields(candidate, graphEntity);
    if (mismatch.missing.length || mismatch.typeMismatches.length || mismatch.requiredMismatches.length) {
      dbFieldMismatches.push({
        entity: canonicalId,
        missing_fields_in_topogram: mismatch.missing,
        type_mismatches: mismatch.typeMismatches,
        required_mismatches: mismatch.requiredMismatches
      });
    }
  }

  const dbEnumsMissing = [];
  const dbEnumValueMismatches = [];
  for (const candidate of importedDb.enums || []) {
    const graphEnum = enumMap.get(candidate.id_hint);
    if (!graphEnum) {
      dbEnumsMissing.push(candidate.id_hint);
      continue;
    }
    const graphValues = new Set((graphEnum.values || []).map((value) => value.id || value));
    const missingValues = (candidate.values || []).filter((value) => !graphValues.has(value));
    if (missingValues.length > 0) {
      dbEnumValueMismatches.push({
        enum: candidate.id_hint,
        missing_values_in_topogram: missingValues
      });
    }
  }

  const importedCapabilitiesMissing = [];
  const importedEndpointsWithoutMatchingCapabilities = [];
  const apiFieldMismatches = [];
  const matchedTopogramCapabilities = new Set();
  for (const entry of importedApi.capabilities || []) {
    const match = matchImportedApiCapability(entry, topogramApiCapabilities);
    if (!match) {
      importedCapabilitiesMissing.push(entry.id_hint);
      importedEndpointsWithoutMatchingCapabilities.push({
        capability: entry.id_hint,
        method: entry.endpoint?.method || null,
        path: entry.endpoint?.path || null
      });
      continue;
    }
    matchedTopogramCapabilities.add(match.id);
    const fieldMismatch = compareApiCapabilityFields(entry, match);
    if (
      fieldMismatch.missing_input_fields_in_topogram.length > 0 ||
      fieldMismatch.missing_output_fields_in_topogram.length > 0 ||
      fieldMismatch.missing_path_params_in_topogram.length > 0 ||
      fieldMismatch.missing_query_params_in_topogram.length > 0
    ) {
      apiFieldMismatches.push({
        capability: match.id,
        imported_capability: entry.id_hint,
        method: entry.endpoint?.method || null,
        path: entry.endpoint?.path || null,
        ...fieldMismatch
      });
    }
  }
  const topogramCapabilitiesWithoutImportedEndpointEvidence = topogramApiCapabilities
    .filter((capability) => !matchedTopogramCapabilities.has(capability.id))
    .map((capability) => capability.id);

  const scannedTermsMissingInGlossary = (scan.candidate_docs || [])
    .filter((doc) => doc.kind === "glossary")
    .map((doc) => doc.id)
    .filter((id) => entityMap.has(id) && !glossaryDocs.has(id));

  const importedScreensMissing = (importedUi.screens || [])
    .map((screen) => screen.id_hint)
    .filter((id) => !canonicalUi.screens.includes(id));
  const importedUiRoutesMissing = (importedUi.routes || [])
    .map((route) => route.path)
    .filter((route) => !canonicalUi.routes.includes(route));

  const importedWorkflowsMissing = (importedWorkflows.workflows || [])
    .map((workflow) => workflow.id_hint)
    .filter((id) => !canonicalWorkflow.workflow_docs.includes(id));
  const importedWorkflowTransitionsMissing = (importedWorkflows.workflow_transitions || []).map((transition) => ({
    workflow: transition.workflow_id,
    capability: transition.capability_id,
    to_state: transition.to_state
  }));

  const actorGapCandidates = summarizeGapCandidates(importedActors.filter((entry) => !canonicalActorIds.has(entry.id_hint)));
  const roleGapCandidates = summarizeGapCandidates(importedRoles.filter((entry) => !canonicalRoleIds.has(entry.id_hint)));
  const importedActorsMissing = importedActors
    .map((entry) => entry.id_hint)
    .filter((id) => !canonicalActorIds.has(id));
  const importedRolesMissing = importedRoles
    .map((entry) => entry.id_hint)
    .filter((id) => !canonicalRoleIds.has(id));
  const securedCapabilitiesWithoutCanonicalRoles = [];
  for (const entry of importedApi.capabilities || []) {
    if (entry.auth_hint !== "secured") {
      continue;
    }
    const match = matchImportedApiCapability(entry, topogramApiCapabilities);
    if (!match) {
      continue;
    }
    const canonicalCapability = capabilityById.get(match.id);
    if (!canonicalCapability || (canonicalCapability.roles || []).length > 0) {
      continue;
    }
    securedCapabilitiesWithoutCanonicalRoles.push(match.id);
  }
  const journeyDocsMissingActorLinks = canonicalActorRole.journey_docs
    .filter((doc) => (doc.relatedActors || []).length === 0)
    .filter((doc) => importedActors.some((entry) => (entry.related_docs || []).includes(doc.id)))
    .map((doc) => doc.id);
  const journeyDocsMissingRoleLinks = canonicalActorRole.journey_docs
    .filter((doc) => (doc.relatedRoles || []).length === 0)
    .filter((doc) => importedRoles.some((entry) => (entry.related_docs || []).includes(doc.id)))
    .map((doc) => doc.id);
  const workflowDocsMissingActorLinks = canonicalActorRole.workflow_docs
    .filter((doc) => (doc.relatedActors || []).length === 0)
    .filter((doc) => importedActors.some((entry) => (entry.related_docs || []).includes(doc.id)))
    .map((doc) => doc.id);
  const workflowDocsMissingRoleLinks = canonicalActorRole.workflow_docs
    .filter((doc) => (doc.relatedRoles || []).length === 0)
    .filter((doc) => importedRoles.some((entry) => (entry.related_docs || []).includes(doc.id)))
    .map((doc) => doc.id);

  const report = {
    type: "gap_report",
    workspace: paths.workspaceRoot,
    bootstrapped_topogram_root: paths.bootstrappedTopogramRoot,
    topogram_available: true,
    docs_vs_topogram: {
      missing_glossary_docs: missingGlossary,
      missing_workflow_docs: missingWorkflowDocs,
      scanned_terms_missing_in_glossary: scannedTermsMissingInGlossary
    },
    db_vs_topogram: {
      entities_missing_in_topogram: dbEntitiesMissing,
      field_mismatches: dbFieldMismatches,
      enums_missing_in_topogram: dbEnumsMissing,
      enum_value_mismatches: dbEnumValueMismatches
    },
    api_vs_topogram: {
      capabilities_missing_in_topogram: importedCapabilitiesMissing,
      endpoints_without_matching_capabilities: importedEndpointsWithoutMatchingCapabilities,
      field_mismatches: apiFieldMismatches,
      topogram_capabilities_without_imported_endpoint_evidence: topogramCapabilitiesWithoutImportedEndpointEvidence
    },
    ui_vs_topogram: {
      screens_missing_in_topogram: importedScreensMissing,
      routes_missing_in_topogram: importedUiRoutesMissing
    },
    workflows_vs_topogram: {
      workflows_missing_in_topogram: importedWorkflowsMissing,
      transitions_without_canonical_workflow_representation: importedWorkflowTransitionsMissing
    },
    actors_roles_vs_topogram: {
      actors_missing_in_topogram: importedActorsMissing,
      actor_gap_candidates: actorGapCandidates,
      roles_missing_in_topogram: importedRolesMissing,
      role_gap_candidates: roleGapCandidates,
      secured_capabilities_without_canonical_roles: [...new Set(securedCapabilitiesWithoutCanonicalRoles)].sort(),
      journey_docs_missing_actor_links: journeyDocsMissingActorLinks,
      journey_docs_missing_role_links: journeyDocsMissingRoleLinks,
      workflow_docs_missing_actor_links: workflowDocsMissingActorLinks,
      workflow_docs_missing_role_links: workflowDocsMissingRoleLinks
    }
  };

  const files = {
    "candidates/reports/gap-report.json": `${stableStringify(report)}\n`,
    "candidates/reports/gap-report.md": ensureTrailingNewline(
      `# Gap Report\n\n## Docs vs Topogram\n\n- Missing glossary docs: ${missingGlossary.length}\n- Missing workflow docs: ${missingWorkflowDocs.length}\n- Scanned terms not in glossary: ${scannedTermsMissingInGlossary.length}\n\n## DB vs Topogram\n\n- Imported entities missing in Topogram: ${dbEntitiesMissing.length}\n- Imported field mismatches: ${dbFieldMismatches.length}\n- Imported enums missing in Topogram: ${dbEnumsMissing.length}\n- Imported enum value mismatches: ${dbEnumValueMismatches.length}\n\n## API vs Topogram\n\n- Imported capabilities missing in Topogram: ${importedCapabilitiesMissing.length}\n- Imported endpoints without matching capabilities: ${importedEndpointsWithoutMatchingCapabilities.length}\n- Topogram capabilities without imported endpoint evidence: ${topogramCapabilitiesWithoutImportedEndpointEvidence.length}\n\n## UI vs Topogram\n\n- Imported screens missing in Topogram: ${importedScreensMissing.length}\n- Imported routes missing in Topogram: ${importedUiRoutesMissing.length}\n\n## Workflows vs Topogram\n\n- Imported workflows missing in Topogram: ${importedWorkflowsMissing.length}\n- Imported transitions without canonical workflow representation: ${importedWorkflowTransitionsMissing.length}\n\n## Actors/Roles vs Topogram\n\n- Imported actors missing in Topogram: ${importedActorsMissing.length}\n- Imported roles missing in Topogram: ${importedRolesMissing.length}\n- Secured capabilities without canonical roles: ${securedCapabilitiesWithoutCanonicalRoles.length}\n- Journey docs missing actor links: ${journeyDocsMissingActorLinks.length}\n- Journey docs missing role links: ${journeyDocsMissingRoleLinks.length}\n- Workflow docs missing actor links: ${workflowDocsMissingActorLinks.length}\n- Workflow docs missing role links: ${workflowDocsMissingRoleLinks.length}\n\n### Ranked Missing Actors\n\n${actorGapCandidates.length ? actorGapCandidates.map((entry) => `- \`${entry.id}\` (${entry.confidence})${entry.inference ? ` ${entry.inference}` : ""}`).join("\n") : "- None"}\n\n### Ranked Missing Roles\n\n${roleGapCandidates.length ? roleGapCandidates.map((entry) => `- \`${entry.id}\` (${entry.confidence})${entry.inference ? ` ${entry.inference}` : ""}`).join("\n") : "- None"}\n`
    )
  };

  return {
    summary: report,
    files,
    defaultOutDir: paths.topogramRoot
  };
}

function reconcileWorkflow(inputPath, options = {}) {
  const paths = normalizeWorkspacePaths(inputPath);
  const graph = tryLoadResolvedGraph(paths.topogramRoot);
  const candidatesRoot = path.join(paths.topogramRoot, "candidates", "docs");
  const appImport = loadImportArtifacts(paths, inputPath);
  const adoptSelector = parseAdoptSelector(options.adopt);
  const files = {};
  const promoted = [];
  const skipped = [];

  for (const filePath of listFilesRecursive(candidatesRoot, (child) => child.endsWith(".md"))) {
    const relativeCandidate = relativeTo(candidatesRoot, filePath);
    const destination = path.join("docs", relativeCandidate);
    const canonicalPath = path.join(paths.topogramRoot, destination);
    if (fs.existsSync(canonicalPath)) {
      skipped.push(destination.replaceAll(path.sep, "/"));
      continue;
    }
    files[destination.replaceAll(path.sep, "/")] = fs.readFileSync(filePath, "utf8");
    promoted.push(destination.replaceAll(path.sep, "/"));
  }

  const candidateModel = buildCandidateModelFiles(graph, appImport, paths.topogramRoot);
  const defaultPlanItems = buildAdoptionPlan(candidateModel.bundles);
  const existingPlan = readAdoptionPlan(paths);
  const previousReconcileReport = readJsonIfExists(path.join(paths.topogramRoot, "candidates", "reconcile", "report.json"));
  const mergedPlanItems = mergeAdoptionPlanState(defaultPlanItems, existingPlan, paths.topogramRoot);
  const adoptionPlan = {
    type: "reconcile_adoption_plan",
    workspace: paths.topogramRoot,
    approved_review_groups: [...new Set(existingPlan?.approved_review_groups || [])],
    items: mergedPlanItems,
    projection_review_groups: buildProjectionReviewGroups(mergedPlanItems),
    ui_review_groups: buildUiReviewGroups(mergedPlanItems),
    workflow_review_groups: buildWorkflowReviewGroups(mergedPlanItems)
  };

  const maintainedBoundaryArtifact = graph
    ? generateContextBundle(graph, { taskId: "maintained-app" }).maintained_boundary || null
    : buildLocalMaintainedBoundaryArtifact(paths.workspaceRoot) || null;
  let bundlesWithAuthHintClosures = annotateBundleAuthAging(
    candidateModel.bundles.map((bundle) => annotateBundleAuthHintClosures(bundle, adoptionPlan.items)),
    previousReconcileReport
  );
  let candidateModelFiles = {
    ...candidateModel.files
  };
  let writtenCanonicalFiles = [];
  let reportRefreshedCanonicalFiles = [];
  let appliedItems = [];
  let approvedItems = [];
  let skippedItems = [];
  let blockedItems = [];
  let adoptionRun = null;

  if (adoptSelector) {
    adoptionRun = applyAdoptionSelector(adoptionPlan, adoptSelector, Boolean(options.write));
    adoptionPlan.items = adoptionRun.plan.items;
    adoptionPlan.approved_review_groups = adoptionRun.plan.approved_review_groups;
    adoptionPlan.projection_review_groups = buildProjectionReviewGroups(adoptionPlan.items);
    adoptionPlan.ui_review_groups = buildUiReviewGroups(adoptionPlan.items);
    adoptionPlan.workflow_review_groups = buildWorkflowReviewGroups(adoptionPlan.items);
    appliedItems = adoptionRun.appliedItems;
    approvedItems = adoptionRun.approvedItems;
    skippedItems = adoptionRun.skippedItems;
    blockedItems = adoptionRun.blockedItems;
    bundlesWithAuthHintClosures = annotateBundleAuthAging(
      candidateModel.bundles.map((bundle) => annotateBundleAuthHintClosures(bundle, adoptionPlan.items)),
      previousReconcileReport
    );
    candidateModelFiles = {};
    const canonicalOutputs = buildCanonicalAdoptionOutputs(
      paths,
      candidateModel.files,
      adoptionPlan.items,
      adoptionRun.selectedItems,
      { refreshAdopted: options.refreshAdopted }
    );
    for (const [relativePath, contents] of Object.entries(canonicalOutputs.files)) {
      files[relativePath.replaceAll(path.sep, "/")] = contents;
    }
    writtenCanonicalFiles = Object.keys(canonicalOutputs.files).sort();
    reportRefreshedCanonicalFiles = canonicalOutputs.refreshedFiles || [];
  } else {
    for (const [relativePath, contents] of Object.entries(candidateModelFiles)) {
      files[relativePath.replaceAll(path.sep, "/")] = contents;
    }
  }

  const planItemSummary = summarizeAdoptionPlanItems(adoptionPlan.items);
  const agentAdoptionPlan = buildAgentAdoptionPlan(adoptionPlan, maintainedBoundaryArtifact);
  for (const bundle of bundlesWithAuthHintClosures) {
    const readmePath = `candidates/reconcile/model/bundles/${bundle.slug}/README.md`;
    const readme = renderCandidateBundleReadme(bundle, agentAdoptionPlan.imported_proposal_surfaces || []);
    candidateModelFiles[readmePath] = readme;
    files[readmePath] = readme;
  }
  appliedItems = planItemSummary.applied_items;
  approvedItems = planItemSummary.approved_items;
  skippedItems = planItemSummary.skipped_items;
  blockedItems = planItemSummary.blocked_items;

  files["candidates/reconcile/adoption-plan.json"] = `${stableStringify(adoptionPlan)}\n`;
  files["candidates/reconcile/adoption-plan.agent.json"] = `${stableStringify(agentAdoptionPlan)}\n`;
  const report = {
    type: "reconcile_report",
    workspace: paths.topogramRoot,
    bootstrapped_topogram_root: paths.bootstrappedTopogramRoot,
    adoption_plan_path: "candidates/reconcile/adoption-plan.json",
    agent_adoption_plan_path: "candidates/reconcile/adoption-plan.agent.json",
    adopt_selector: adoptSelector,
    adopt_write_mode: Boolean(options.write),
    promoted,
    skipped,
    applied_items: appliedItems,
    approved_items: approvedItems,
    skipped_items: skippedItems,
    blocked_items: blockedItems,
    written_canonical_files: writtenCanonicalFiles,
    promoted_canonical_items: buildPromotedCanonicalItemsReport(
      adoptionPlan.items,
      adoptionRun?.selectedItems || [],
      writtenCanonicalFiles,
      adoptSelector,
      adoptionItemKey,
      reportRefreshedCanonicalFiles
    ),
    refreshed_canonical_files: reportRefreshedCanonicalFiles,
    approved_review_groups: adoptionPlan.approved_review_groups,
    staged_items: agentAdoptionPlan.staged_items,
    adoption_plan_items: adoptionPlan.items.map((item) => ({
      bundle: item.bundle,
      item: item.item,
      kind: item.kind,
      status: item.status,
      confidence: item.confidence || null,
      recommendation: item.recommendation || null,
      related_docs: item.related_docs || [],
      related_capabilities: item.related_capabilities || [],
      related_rules: item.related_rules || [],
      related_workflows: item.related_workflows || []
    })),
    agent_adoption_plan_items: agentAdoptionPlan.imported_proposal_surfaces,
    projection_review_groups: adoptionPlan.projection_review_groups,
    ui_review_groups: adoptionPlan.ui_review_groups,
    workflow_review_groups: adoptionPlan.workflow_review_groups,
    bundle_blockers: buildBundleBlockerSummaries(adoptionPlan.items),
    projection_dependent_items: adoptionPlan.items
      .filter((item) => (item.projection_impacts || []).length > 0)
      .map((item) => ({
        item: item.item,
        kind: item.kind,
        bundle: item.bundle,
        projection_impacts: item.projection_impacts
      })),
    suppressed_noise_bundles: candidateModel.suppressedNoiseBundles || [],
    candidate_model_files: Object.keys(candidateModelFiles).sort(),
    candidate_model_bundles: bundlesWithAuthHintClosures.map((bundle) => ({
      operator_summary: buildBundleOperatorSummary(bundle),
      auth_permission_hints: bundle.authPermissionHints || [],
      auth_claim_hints: bundle.authClaimHints || [],
      auth_ownership_hints: bundle.authOwnershipHints || [],
      auth_role_guidance: bundle.authRoleGuidance || [],
      id: bundle.id,
      slug: bundle.slug,
      label: bundle.label,
      merge_hints: bundle.mergeHints,
      projection_impacts: bundle.projectionImpacts,
      projection_patches: bundle.projectionPatches,
      ui_impacts: bundle.uiImpacts,
      workflow_impacts: bundle.workflowImpacts,
      doc_link_suggestions: bundle.docLinkSuggestions,
      doc_drift_summaries: bundle.docDriftSummaries,
      doc_metadata_patches: bundle.docMetadataPatches,
      adoption_plan: bundle.adoptionPlan,
      actors: bundle.actors.map((entry) => entry.id_hint),
      actor_details: bundle.actors.map((entry) => ({
        id: entry.id_hint,
        related_docs: entry.related_docs || [],
        related_capabilities: entry.related_capabilities || []
      })),
      roles: bundle.roles.map((entry) => entry.id_hint),
      role_details: bundle.roles.map((entry) => ({
        id: entry.id_hint,
        related_docs: entry.related_docs || [],
        related_capabilities: entry.related_capabilities || []
      })),
      entities: bundle.entities.map((entry) => entry.id_hint),
      enums: bundle.enums.map((entry) => entry.id_hint),
      capabilities: bundle.capabilities.map((entry) => entry.id_hint),
      shapes: bundle.shapes.map((entry) => entry.id),
      components: bundle.components.map((entry) => entry.id_hint),
      widgets: bundle.components.map((entry) => entry.id_hint),
      screens: bundle.screens.map((entry) => entry.id_hint),
      workflows: bundle.workflows.map((entry) => entry.id_hint),
      docs: bundle.docs.map((entry) => entry.id),
      maintained_seam_candidates: (agentAdoptionPlan.imported_proposal_surfaces || [])
        .filter((surface) => surface.bundle === bundle.slug && (surface.maintained_seam_candidates || []).length > 0)
        .map((surface) => ({
          id: surface.id,
          kind: surface.kind,
          maintained_seam_candidates: surface.maintained_seam_candidates
        }))
    }))
  };
  report.bundle_priorities = annotateBundlePriorities(
    attachBundleOperatorHints(
      buildBundleAdoptionPriorities(report, confidenceRank),
      report.candidate_model_bundles
    )
  );
  const canonicalChangeTitle = report.adopt_selector && !report.adopt_write_mode
    ? "## Preview Canonical Changes"
    : "## Promoted Canonical Items";
  files["candidates/reconcile/report.json"] = `${stableStringify(report)}\n`;
  const candidateModelBundlesMarkdown = report.candidate_model_bundles.length
    ? report.candidate_model_bundles.map((bundle) => `- \`${bundle.slug}\` (${bundle.actors.length} actors, ${bundle.roles.length} roles, ${bundle.entities.length} entities, ${bundle.enums.length} enums, ${bundle.capabilities.length} capabilities, ${bundle.shapes.length} shapes, ${bundle.components.length} widgets, ${bundle.screens.length} screens, ${bundle.workflows.length} workflows, ${bundle.docs.length} docs)
  - primary concept \`${bundle.operator_summary.primaryConcept}\`${bundle.operator_summary.primaryEntityId ? `, primary entity \`${bundle.operator_summary.primaryEntityId}\`` : ""}
  - participants ${bundle.operator_summary.participants.label}
  - main capabilities ${summarizeBundleSurface(bundle, bundle.operator_summary.capabilityIds)}
  - main widgets ${summarizeBundleSurface(bundle, bundle.operator_summary.componentIds)}
  - main routes ${summarizeBundleSurface(bundle, bundle.operator_summary.routePaths)}
  - candidate maintained seam mappings ${renderMaintainedSeamCandidatesInline(bundle)}
  - permission hints ${bundle.auth_permission_hints?.length ? bundle.auth_permission_hints.map((entry) => formatAuthPermissionHintInline(entry)).join(", ") : "_none_"}
  - auth claims ${bundle.auth_claim_hints?.length ? bundle.auth_claim_hints.map((entry) => formatAuthClaimHintInline(entry)).join(", ") : "_none_"}
  - ownership hints ${bundle.auth_ownership_hints?.length ? bundle.auth_ownership_hints.map((entry) => formatAuthOwnershipHintInline(entry)).join(", ") : "_none_"}
  - auth role guidance ${bundle.auth_role_guidance?.length ? bundle.auth_role_guidance.map((entry) => formatAuthRoleGuidanceInline(entry)).join(", ") : "_none_"}
  - auth closure ${bundle.operator_summary.authClosureSummary.label} (adopted=${bundle.operator_summary.authClosureSummary.adopted}, deferred=${bundle.operator_summary.authClosureSummary.deferred}, unresolved=${bundle.operator_summary.authClosureSummary.unresolved})
  ${bundle.operator_summary.authAging && bundle.operator_summary.authAging.escalationLevel !== "none" ? `- auth escalation ${bundle.operator_summary.authAging.escalationLevel === "stale_high_risk" ? "escalated" : "fresh attention"} (high-risk runs=${bundle.operator_summary.authAging.repeatCount})\n` : ""}  - why ${bundle.operator_summary.whyThisBundle}${bundle.auth_permission_hints?.length ? `\n${bundle.auth_permission_hints.map((entry) => `  - permission ${formatAuthPermissionHintInline(entry)} <- ${entry.related_capabilities.length ? entry.related_capabilities.map((item) => `\`${item}\``).join(", ") : "_no direct capability match_"}\n    - closure ${entry.closure_state || "unresolved"}\n    - closure reason ${entry.closure_reason || "No reviewed projection patch has been applied for this inferred auth hint yet."}\n    - why inferred ${entry.why_inferred || entry.explanation}\n    - review next ${entry.review_guidance || buildAuthPermissionReviewGuidance(entry)}`).join("\n")}` : ""}${bundle.auth_claim_hints?.length ? `\n${bundle.auth_claim_hints.map((entry) => `  - auth ${formatAuthClaimHintInline(entry)} <- ${entry.related_capabilities.length ? entry.related_capabilities.map((item) => `\`${item}\``).join(", ") : "_no direct capability match_"}\n    - closure ${entry.closure_state || "unresolved"}\n    - closure reason ${entry.closure_reason || "No reviewed projection patch has been applied for this inferred auth hint yet."}\n    - why inferred ${entry.why_inferred || entry.explanation}\n    - review next ${entry.review_guidance || buildAuthClaimReviewGuidance(entry)}`).join("\n")}` : ""}${bundle.auth_ownership_hints?.length ? `\n${bundle.auth_ownership_hints.map((entry) => `  - ownership ${formatAuthOwnershipHintInline(entry)} <- ${entry.related_capabilities.length ? entry.related_capabilities.map((item) => `\`${item}\``).join(", ") : "_no direct capability match_"}\n    - closure ${entry.closure_state || "unresolved"}\n    - closure reason ${entry.closure_reason || "No reviewed projection patch has been applied for this inferred auth hint yet."}\n    - why inferred ${entry.why_inferred || entry.explanation}\n    - review next ${entry.review_guidance || buildAuthOwnershipReviewGuidance(entry)}`).join("\n")}` : ""}${bundle.auth_role_guidance?.length ? `\n${bundle.auth_role_guidance.map((entry) => `  - role ${formatAuthRoleGuidanceInline(entry)} <- ${entry.related_capabilities.length ? entry.related_capabilities.map((item) => `\`${item}\``).join(", ") : "_role naming only_"}\n    - why inferred ${entry.why_inferred}\n    - suggested follow-up ${entry.followup_label} (${entry.followup_reason})\n    - review next ${entry.review_guidance}`).join("\n")}` : ""}${bundle.actor_details.length || bundle.role_details.length ? `\n${bundle.actor_details.map((entry) => `  - actor \`${entry.id}\`${entry.related_docs.length ? ` docs=${entry.related_docs.map((item) => `\`${item}\``).join(", ")}` : ""}${entry.related_capabilities.length ? ` capabilities=${entry.related_capabilities.map((item) => `\`${item}\``).join(", ")}` : ""}`).concat(bundle.role_details.map((entry) => `  - role \`${entry.id}\`${entry.related_docs.length ? ` docs=${entry.related_docs.map((item) => `\`${item}\``).join(", ")}` : ""}${entry.related_capabilities.length ? ` capabilities=${entry.related_capabilities.map((item) => `\`${item}\``).join(", ")}` : ""}`)).join("\n")}` : ""}${bundle.doc_link_suggestions?.length ? `\n${bundle.doc_link_suggestions.map((item) => `  - ${formatDocLinkSuggestionInline(item).replace(/^doc /, "doc-link ")}${item.auth_role_followups?.length ? `\n    - auth role follow-up ${item.auth_role_followups.map((entry) => `${entry.followup_label} for \`${entry.role_id}\``).join(", ")}` : ""}`).join("\n")}` : ""}${bundle.doc_drift_summaries?.length ? `\n${bundle.doc_drift_summaries.map((item) => `  - drift ${formatDocDriftSummaryInline(item)}`).join("\n")}` : ""}${bundle.doc_metadata_patches?.length ? `\n${bundle.doc_metadata_patches.map((item) => `  - metadata ${formatDocMetadataPatchInline(item)}`).join("\n")}` : ""}`).join("\n")
    : "- None";
  files["candidates/reconcile/report.md"] = ensureTrailingNewline(
      `# Reconcile Report\n\n## Promoted\n\n${promoted.length ? promoted.map((item) => `- \`${item}\``).join("\n") : "- None"}\n\n## Skipped\n\n${skipped.length ? skipped.map((item) => `- \`${item}\``).join("\n") : "- None"}\n\n## Adoption\n\n- Plan: \`${report.adoption_plan_path}\`\n- Selector: \`${report.adopt_selector || "none"}\`\n- Write mode: ${report.adopt_write_mode ? "yes" : "no"}\n- Approved items: ${report.approved_items.length}\n- Applied items: ${report.applied_items.length}\n- Skipped items: ${report.skipped_items.length}\n- Blocked items: ${report.blocked_items.length}\n- Canonical files: ${report.written_canonical_files.length}\n- Refreshed canonical files: ${report.refreshed_canonical_files.length}\n- Approved review groups: ${report.approved_review_groups.length}\n- Projection-dependent items: ${report.projection_dependent_items.length}\n- Projection review groups: ${report.projection_review_groups.length}\n- UI review groups: ${report.ui_review_groups.length}\n- Workflow review groups: ${report.workflow_review_groups.length}\n\n${renderPromotedCanonicalItemsMarkdown(report.promoted_canonical_items, { title: canonicalChangeTitle })}${renderPreviewRiskMarkdown(report)}${renderPreviewFollowupMarkdown(buildAdoptionStatusSummaryReport(report, selectNextBundle))}${renderNextBestActionMarkdown(selectNextBundle(report.bundle_priorities))}## Approved Review Groups\n\n${report.approved_review_groups.length ? report.approved_review_groups.map((item) => `- \`${item}\``).join("\n") : "- None"}\n\n## Projection Review Groups\n\n${report.projection_review_groups.length ? report.projection_review_groups.map((group) => `- \`${group.projection_id}\` (${group.kind}) <- ${group.items.map((item) => `\`${item.item}\``).join(", ")}`).join("\n") : "- None"}\n\n## UI Review Groups\n\n${report.ui_review_groups.length ? report.ui_review_groups.map((group) => `- \`${group.projection_id}\` (${group.kind}) <- ${group.items.map((item) => `\`${item.item}\``).join(", ")}`).join("\n") : "- None"}\n\n## Workflow Review Groups\n\n${report.workflow_review_groups.length ? report.workflow_review_groups.map((group) => `- \`${group.id}\` <- ${group.items.map((item) => `\`${item.item}\``).join(", ")}`).join("\n") : "- None"}\n\n## Bundle Blockers\n\n${report.bundle_blockers.length ? report.bundle_blockers.map((bundle) => `- \`${bundle.bundle}\`: blocked=${bundle.blocked_items.length}, approved=${bundle.approved_items.length}, applied=${bundle.applied_items.length}, pending=${bundle.pending_items.length}, dependencies=${bundle.blocking_dependencies.length ? bundle.blocking_dependencies.map((item) => `\`${item}\``).join(", ") : "_none_"}`).join("\n") : "- None"}\n\n${renderBundlePriorityActionsMarkdown(report.bundle_priorities)}## Suppressed Noise Bundles\n\n${report.suppressed_noise_bundles.length ? report.suppressed_noise_bundles.map((bundle) => `- \`${bundle.slug}\`: ${bundle.reason}`).join("\n") : "- None"}\n\n## Projection Dependencies\n\n${report.projection_dependent_items.length ? report.projection_dependent_items.map((item) => `- \`${item.item}\` -> ${item.projection_impacts.map((impact) => `\`${impact.projection_id}\``).join(", ")}`).join("\n") : "- None"}\n\n## Blocked Adoption Items\n\n${report.blocked_items.length ? report.blocked_items.map((item) => `- \`${item}\``).join("\n") : "- None"}\n\n## Candidate Model Bundles\n\n${candidateModelBundlesMarkdown}\n\n## Candidate Model Files\n\n${report.candidate_model_files.length ? report.candidate_model_files.map((item) => `- \`${item}\``).join("\n") : "- None"}\n\n## Canonical Outputs\n\n${report.written_canonical_files.length ? report.written_canonical_files.map((item) => `- \`${item}\``).join("\n") : "- None"}\n`
  );
  Object.assign(files, buildAdoptionStatusFilesReport(buildAdoptionStatusSummaryReport(report, selectNextBundle), formatDocLinkSuggestionInline, formatDocDriftSummaryInline, formatDocMetadataPatchInline));

  return {
    summary: report,
    files,
    defaultOutDir: paths.topogramRoot
  };
}

function adoptionStatusWorkflow(inputPath) {
  const reconcile = reconcileWorkflow(inputPath);
  const report = reconcile.summary;
  const summary = buildAdoptionStatusSummaryReport(report, selectNextBundle);
  const files = buildAdoptionStatusFilesReport(summary, formatDocLinkSuggestionInline, formatDocDriftSummaryInline, formatDocMetadataPatchInline);
  return {
    summary,
    files,
    defaultOutDir: normalizeWorkspacePaths(inputPath).topogramRoot
  };
}

export function runWorkflow(name, inputPath, options = {}) {
  switch (name) {
    case "scan-docs":
      return scanDocsWorkflow(inputPath);
    case "generate-docs":
      return generateDocsWorkflow(inputPath);
    case "generate-journeys":
      return generateJourneyDraftsWorkflow(inputPath);
    case "refresh-docs":
      return refreshDocsWorkflow(inputPath);
    case "import-app":
      return importAppWorkflow(inputPath, options);
    case "report-gaps":
      return reportGapsWorkflow(inputPath);
    case "reconcile":
      return reconcileWorkflow(inputPath, options);
    case "adoption-status":
      return adoptionStatusWorkflow(inputPath);
    default:
      throw new Error(`Unsupported workflow '${name}'`);
  }
}

// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../format.js";
import { canonicalCandidateTerm, ensureTrailingNewline, extractRankedTerms, idHintify, slugify, titleCase } from "../text-helpers.js";
import { listFilesRecursive, normalizeWorkspacePaths, readTextIfExists } from "./shared.js";
import { tryLoadResolvedGraph } from "./docs-generate.js";

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
  return extractRankedTerms(markdown, { technicalStopwords: true });
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

export function confidenceRank(value) {
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

export function renderCandidateActor(record) {
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

export function renderCandidateRole(record) {
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

export function scanDocsWorkflow(inputPath) {
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

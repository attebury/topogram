// @ts-check

export const GENERIC_STOPWORDS = new Set([
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
  "used",
  "using"
]);

export const TECHNICAL_STOPWORDS = new Set([
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

/**
 * @param {string} value
 * @returns {string}
 */
export function ensureTrailingNewline(value) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function idHintify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "untitled";
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalCandidateTerm(value) {
  const normalized = slugify(value);
  if (normalized.endsWith("ies")) {
    return `${normalized.slice(0, -3)}y`;
  }
  if (normalized === "status" || normalized === "stats") {
    return normalized;
  }
  if (normalized.endsWith("s") && !normalized.endsWith("ss") && !normalized.endsWith("us") && !normalized.endsWith("is")) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function pluralizeCandidateTerm(value) {
  const normalized = String(value || "");
  if (!normalized) return "items";
  const parts = normalized.split("_");
  const last = parts.pop() || "item";
  let plural = last;
  if (last === "stats") {
    plural = "stats";
  } else if (last.endsWith("sis")) {
    plural = `${last.slice(0, -2)}es`;
  } else if (last.endsWith("y") && !/[aeiou]y$/.test(last)) {
    plural = `${last.slice(0, -1)}ies`;
  } else if (/(s|x|z|ch|sh)$/.test(last)) {
    plural = `${last}es`;
  } else {
    plural = `${last}s`;
  }
  return [...parts, plural].join("_");
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function titleCase(value) {
  return String(value || "")
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * @param {{ technicalStopwords?: boolean }} [options]
 * @returns {Set<string>}
 */
export function stopwordSet(options = {}) {
  const includeTechnical = options.technicalStopwords !== false;
  return new Set([
    ...GENERIC_STOPWORDS,
    ...(includeTechnical ? TECHNICAL_STOPWORDS : [])
  ]);
}

/**
 * @param {string} markdown
 * @param {{ technicalStopwords?: boolean }} [options]
 * @returns {string[]}
 */
export function extractRankedTerms(markdown, options = {}) {
  const stopwords = stopwordSet(options);
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
      if (stopwords.has(word)) {
        continue;
      }
      frequency.set(word, (frequency.get(word) || 0) + 3);
    }
  }
  for (const word of normalized.toLowerCase().match(/\b[a-z][a-z0-9-]{2,}\b/g) || []) {
    if (stopwords.has(word)) {
      continue;
    }
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }
  return [...frequency.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([term]) => term);
}

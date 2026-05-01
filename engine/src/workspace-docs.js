import fs from "node:fs";
import path from "node:path";

export const DOC_KINDS = new Set([
  "glossary",
  "workflow",
  "journey",
  "report",
  // Phase 2 SDLC document kinds. Documents are markdown-only (vs. SDLC `.tg`
  // kinds like pitch/task/bug); `kind:` in frontmatter selects which
  // template/template-validation applies.
  "user-guide",
  "api",
  "architecture",
  "operations",
  "getting-started",
  "reference",
  "development"
]);
export const DOC_STATUSES = new Set([
  "canonical",
  "draft",
  "inferred",
  "deprecated",
  // Phase 2 SDLC document lifecycle statuses (per the SDLC plan).
  "review",
  "published",
  "archived"
]);
export const DOC_CONFIDENCE = new Set(["low", "medium", "high"]);
export const DOC_AUDIENCES = new Set(["developers", "operators", "end-users", "all"]);
export const DOC_PRIORITIES = new Set(["critical", "high", "medium", "low"]);
export const DOC_ARRAY_FIELDS = new Set([
  "aliases",
  "actors",
  "related_actors",
  "related_roles",
  "related_entities",
  "related_capabilities",
  "related_rules",
  "related_workflows",
  "related_decisions",
  "related_shapes",
  "related_projections",
  "related_docs",
  "failure_signals",
  "provenance",
  "tags",
  // Phase 2 SDLC array fields. `affects` lets a document declare which
  // graph statements it documents; `satisfies` lets a document satisfy a
  // requirement directly (lightweight alternative to a task).
  "affects",
  "satisfies",
  "approvals"
]);

// Singular reference fields recognized in doc frontmatter. These are validated
// as references to specific statement kinds in `validator/index.js`. The
// `domain` field (singular id) was added in the Phase 1 domain-support work
// and is validated against `domain` kind statements.
export const DOC_REFERENCE_FIELDS = {
  domain: "domain"
};

// Scalar fields recognized in doc frontmatter beyond the DOC_KINDS/STATUSES
// keys. Listed here primarily for documentation purposes — the parser
// accepts any scalar key, but validators use this list to know which fields
// are first-class.
export const DOC_SCALAR_FIELDS = new Set([
  "id",
  "kind",
  "title",
  "status",
  "summary",
  "success_outcome",
  "source_of_truth",
  "confidence",
  "review_required",
  "domain",
  "app_version",
  "audience",
  "priority",
  "version"
]);

function docLoc(filePath, line = 1, column = 1) {
  const offset = 0;
  return {
    file: filePath,
    start: { line, column, offset },
    end: { line, column, offset }
  };
}

function parseScalar(rawValue) {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  return trimmed;
}

function parseFrontmatter(frontmatter, filePath) {
  const metadata = {};
  const lines = frontmatter.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }

    const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!match) {
      return {
        metadata,
        error: {
          message: "Invalid YAML frontmatter line",
          loc: docLoc(filePath, index + 2, 1)
        }
      };
    }

    const [, key, rawValue] = match;
    if (Object.hasOwn(metadata, key)) {
      return {
        metadata,
        error: {
          message: `Duplicate doc metadata field '${key}'`,
          loc: docLoc(filePath, index + 2, 1)
        }
      };
    }

    if (rawValue.trim() === "") {
      const items = [];
      let cursor = index + 1;
      while (cursor < lines.length) {
        const candidate = lines[cursor];
        if (!candidate.trim()) {
          cursor += 1;
          continue;
        }
        const itemMatch = candidate.match(/^\s*-\s*(.*)$/);
        if (!itemMatch) {
          break;
        }
        items.push(parseScalar(itemMatch[1]));
        cursor += 1;
      }
      metadata[key] = items;
      index = cursor - 1;
      continue;
    }

    metadata[key] = parseScalar(rawValue);
  }

  return {
    metadata,
    error: null
  };
}

export function collectTopogramDocFiles(inputPath) {
  const absolutePath = path.resolve(inputPath);
  let docsRoot = null;

  if (fs.existsSync(path.join(absolutePath, "docs")) && fs.statSync(path.join(absolutePath, "docs")).isDirectory()) {
    docsRoot = path.join(absolutePath, "docs");
  } else if (path.basename(absolutePath) === "docs" && fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
    docsRoot = absolutePath;
  }

  if (!docsRoot) {
    return [];
  }

  const files = [];
  const walk = (currentDir) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const childPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(childPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(childPath);
      }
    }
  };

  walk(docsRoot);
  return files.sort();
}

export function parseDocFile(filePath, workspaceRoot) {
  const source = fs.readFileSync(filePath, "utf8");
  const normalized = source.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  if (lines[0]?.trim() !== "---") {
    return {
      type: "doc",
      file: filePath,
      relativePath: path.relative(workspaceRoot, filePath),
      metadata: {},
      body: normalized,
      loc: docLoc(filePath),
      parseError: {
        message: "Topogram docs must start with YAML frontmatter delimited by '---'",
        loc: docLoc(filePath, 1, 1)
      }
    };
  }

  let closingIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      closingIndex = index;
      break;
    }
  }

  if (closingIndex === -1) {
    return {
      type: "doc",
      file: filePath,
      relativePath: path.relative(workspaceRoot, filePath),
      metadata: {},
      body: "",
      loc: docLoc(filePath),
      parseError: {
        message: "Unterminated YAML frontmatter in Topogram doc",
        loc: docLoc(filePath, 1, 1)
      }
    };
  }

  const { metadata, error } = parseFrontmatter(lines.slice(1, closingIndex).join("\n"), filePath);
  return {
    type: "doc",
    file: filePath,
    relativePath: path.relative(workspaceRoot, filePath),
    metadata,
    body: lines.slice(closingIndex + 1).join("\n").replace(/^\n+/, ""),
    loc: docLoc(filePath),
    parseError: error
  };
}

export function parseDocsPath(inputPath) {
  const workspaceRoot = path.resolve(inputPath);
  return collectTopogramDocFiles(inputPath).map((filePath) => parseDocFile(filePath, workspaceRoot));
}

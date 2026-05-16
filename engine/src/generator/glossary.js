// @ts-check

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {any[]|undefined|null} refs
 * @returns {string[]}
 */
function refIds(refs) {
  return [...new Set((refs || []).map((ref) => ref?.id || ref).filter(Boolean))].sort();
}

/**
 * @param {string|null|undefined} value
 * @returns {string}
 */
function categoryId(value) {
  return value || "uncategorized";
}

/**
 * @param {string} id
 * @returns {string}
 */
function categoryName(id) {
  const known = {
    sdlc: "SDLC",
    ui_widgets: "UI Widgets",
    extract_adopt: "Extract/Adopt"
  };
  if (known[id]) return known[id];
  return id
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ") || "Uncategorized";
}

/**
 * @param {AnyRecord} term
 * @returns {AnyRecord}
 */
function summarizeGlossaryTerm(term) {
  return {
    id: term.id,
    name: term.name || term.id,
    description: term.description || null,
    status: term.status || null,
    category: term.category || null,
    domain: term.resolvedDomain?.id || null,
    aliases: [...(term.aliases || [])].sort(),
    excludes: [...(term.excludes || [])].sort(),
    related_terms: refIds(term.relatedTerms)
  };
}

/**
 * @param {AnyRecord} graph
 * @returns {AnyRecord}
 */
export function generateGlossary(graph) {
  const terms = (graph.byKind?.term || [])
    .map(summarizeGlossaryTerm)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const categoryMap = new Map();
  for (const term of terms) {
    const id = categoryId(term.category);
    if (!categoryMap.has(id)) {
      categoryMap.set(id, {
        id,
        name: categoryName(id),
        terms: []
      });
    }
    categoryMap.get(id).terms.push(term);
  }

  return {
    type: "glossary",
    version: 1,
    terms,
    categories: [...categoryMap.values()].sort((a, b) => a.name.localeCompare(b.name))
  };
}

/**
 * @param {AnyRecord} glossary
 * @returns {string}
 */
export function renderGlossaryMarkdown(glossary) {
  const lines = [
    "# Glossary",
    "",
    "Generated from `term` records in the Topogram workspace. Use `topogram emit glossary ./topo --write --out-dir docs/concepts` to refresh this file.",
    ""
  ];

  for (const category of glossary.categories || []) {
    lines.push(`## ${category.name}`, "");
    for (const term of category.terms || []) {
      lines.push(`### ${term.name}`);
      lines.push("");
      lines.push(term.description || "No description.");
      lines.push("");
      lines.push(`- ID: \`${term.id}\``);
      if (term.domain) lines.push(`- Domain: \`${term.domain}\``);
      if ((term.aliases || []).length > 0) lines.push(`- Aliases: ${(term.aliases || []).map((item) => `\`${item}\``).join(", ")}`);
      if ((term.excludes || []).length > 0) lines.push(`- Excludes: ${(term.excludes || []).map((item) => `\`${item}\``).join(", ")}`);
      if ((term.related_terms || []).length > 0) lines.push(`- Related terms: ${(term.related_terms || []).map((item) => `\`${item}\``).join(", ")}`);
      lines.push("");
    }
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

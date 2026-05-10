// Render a single document as a published-page markdown artifact with a
// cross-reference sidebar (related entities, capabilities, projections,
// rules pulled from the doc's frontmatter back-links).

import { documentById } from "../context/shared.js";

function bulletList(label, ids) {
  if (!ids || ids.length === 0) return "";
  const sorted = [...ids].sort();
  const items = sorted.map((id) => `- \`${id}\``).join("\n");
  return `### ${label}\n${items}\n\n`;
}

export function generateSdlcDocPage(graph, options = {}) {
  if (!options.documentId) {
    throw new Error("sdlc-doc-page requires --document <id>");
  }
  const doc = documentById(graph, options.documentId);
  if (!doc) {
    throw new Error(`No document found with id '${options.documentId}'`);
  }

  const headerLines = [
    `# ${doc.title || doc.id}`,
    "",
    `**Status:** ${doc.status || "draft"}  `,
    doc.kind ? `**Kind:** ${doc.kind}  ` : null,
    doc.summary ? `**Summary:** ${doc.summary}  ` : null,
    doc.domain ? `**Domain:** \`${doc.domain}\`  ` : null,
    "",
    "---",
    ""
  ].filter((l) => l !== null);

  let sidebar = "";
  sidebar += bulletList("Related entities", doc.relatedEntities);
  sidebar += bulletList("Related capabilities", doc.relatedCapabilities);
  sidebar += bulletList("Related projections", doc.relatedProjections);
  sidebar += bulletList("Related rules", doc.relatedRules);
  sidebar += bulletList("Related actors", doc.relatedActors);
  sidebar += bulletList("Related roles", doc.relatedRoles);

  const body = doc.body || "";
  const markdown = headerLines.join("\n") + body + (sidebar ? "\n\n## Cross-references\n\n" + sidebar : "");

  return {
    type: "sdlc_doc_page",
    version: 1,
    document_id: doc.id,
    output_path: `topo/docs-generated/sdlc/${doc.id}.md`,
    markdown
  };
}

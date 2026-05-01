import {
  domainById,
  relatedCapabilitiesForDomain,
  relatedEntitiesForDomain,
  relatedProjectionsForDomain,
  relatedRulesForDomain,
  relatedVerificationsForDomain,
  summarizeDomain
} from "./shared.js";
import { generateDomainCoverage } from "./domain-coverage.js";

function summarizeStatementForRow(graph, id, kind) {
  const statement = (graph?.byKind?.[kind] || []).find((item) => item.id === id);
  if (!statement) return { id, name: id, status: null };
  return {
    id,
    name: statement.name || id,
    status: statement.status || null
  };
}

function renderTable(headers, rows) {
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`)
  ];
  return lines.join("\n");
}

function renderMembersSection(graph, title, ids, kind) {
  if (!ids.length) {
    return `### ${title}\n\nNone.`;
  }
  const rows = ids.map((id) => {
    const summary = summarizeStatementForRow(graph, id, kind);
    return [`\`${summary.id}\``, summary.name, summary.status || "—"];
  });
  return `### ${title}\n\n${renderTable(["Id", "Name", "Status"], rows)}`;
}

export function generateDomainPage(graph, options = {}) {
  if (!options.domainId) {
    throw new Error("generateDomainPage requires options.domainId");
  }
  const domain = domainById(graph, options.domainId);
  if (!domain) {
    throw new Error(`No domain found with id '${options.domainId}'`);
  }
  const summary = summarizeDomain(domain);
  const coverage = generateDomainCoverage(graph, options);

  const lines = [];
  lines.push(`# ${summary.name || domain.id}`);
  lines.push("");
  lines.push(`> ${summary.description || ""}`);
  lines.push("");
  lines.push(`- Identifier: \`${domain.id}\``);
  lines.push(`- Status: \`${summary.status || "unknown"}\``);
  if (summary.parent_domain) {
    lines.push(`- Parent domain: \`${summary.parent_domain}\``);
  }
  if (summary.aliases.length) {
    lines.push(`- Aliases: ${summary.aliases.map((a) => `\`${a}\``).join(", ")}`);
  }
  lines.push("");

  if (summary.in_scope.length) {
    lines.push("## In scope");
    lines.push("");
    for (const item of summary.in_scope) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (summary.out_of_scope.length) {
    lines.push("## Out of scope");
    lines.push("");
    for (const item of summary.out_of_scope) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  lines.push("## Members");
  lines.push("");
  lines.push(renderMembersSection(graph, "Capabilities", relatedCapabilitiesForDomain(graph, domain.id), "capability"));
  lines.push("");
  lines.push(renderMembersSection(graph, "Entities", relatedEntitiesForDomain(graph, domain.id), "entity"));
  lines.push("");
  lines.push(renderMembersSection(graph, "Rules", relatedRulesForDomain(graph, domain.id), "rule"));
  lines.push("");
  lines.push(renderMembersSection(graph, "Verifications", relatedVerificationsForDomain(graph, domain.id), "verification"));
  lines.push("");

  if (coverage.platforms.length) {
    lines.push("## Per-platform coverage");
    lines.push("");
    const headers = ["Capability", ...coverage.platforms];
    const rows = coverage.capabilities.map((capabilityId) => {
      const cells = coverage.platforms.map((platform) =>
        coverage.coverage_matrix[capabilityId]?.[platform] ? "✓" : "—"
      );
      return [`\`${capabilityId}\``, ...cells];
    });
    lines.push(renderTable(headers, rows));
    lines.push("");
    lines.push(`Projections involved: ${coverage.projections.map((id) => `\`${id}\``).join(", ") || "none"}`);
  } else {
    lines.push("## Per-platform coverage");
    lines.push("");
    lines.push("No projections currently realize capabilities in this domain.");
  }

  return {
    type: "domain_page",
    version: 1,
    focus: { kind: "domain", id: domain.id },
    output: {
      path: `topogram/docs-generated/domains/${domain.id}.md`,
      contents: lines.join("\n") + "\n"
    },
    summary
  };
}

export function generateAllDomainPages(graph) {
  const pages = (graph?.byKind?.domain || []).map((domain) =>
    generateDomainPage(graph, { domainId: domain.id })
  );
  return {
    type: "domain_pages",
    version: 1,
    pages
  };
}

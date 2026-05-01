import {
  domainById,
  relatedCapabilitiesForDomain,
  relatedEntitiesForDomain,
  relatedProjectionsForDomain,
  relatedRulesForDomain,
  relatedVerificationsForDomain,
  stableSortedStrings,
  summarizeDomain
} from "./shared.js";

function platformsFromProjections(projections) {
  const platforms = new Set();
  for (const projection of projections) {
    if (projection?.platform) {
      platforms.add(projection.platform);
    }
  }
  return [...platforms].sort();
}

export function generateDomainCoverage(graph, options = {}) {
  if (!options.domainId) {
    throw new Error("generateDomainCoverage requires options.domainId");
  }
  const domain = domainById(graph, options.domainId);
  if (!domain) {
    throw new Error(`No domain found with id '${options.domainId}'`);
  }
  const capabilities = relatedCapabilitiesForDomain(graph, options.domainId);
  const entities = relatedEntitiesForDomain(graph, options.domainId);
  const rules = relatedRulesForDomain(graph, options.domainId);
  const verifications = relatedVerificationsForDomain(graph, options.domainId);
  const projectionIds = relatedProjectionsForDomain(graph, options.domainId);
  const projectionsByCapability = {};
  const projectionStatements = (graph?.byKind?.projection || []).filter((projection) =>
    projectionIds.includes(projection.id)
  );

  for (const capabilityId of capabilities) {
    projectionsByCapability[capabilityId] = stableSortedStrings(
      projectionStatements
        .filter((projection) => (projection.realizes || []).some((entry) => entry.id === capabilityId))
        .map((projection) => projection.id)
    );
  }

  const platforms = platformsFromProjections(projectionStatements);
  const matrix = {};
  for (const capabilityId of capabilities) {
    matrix[capabilityId] = {};
    for (const platform of platforms) {
      const realized = projectionStatements.some(
        (projection) =>
          projection.platform === platform &&
          (projection.realizes || []).some((entry) => entry.id === capabilityId)
      );
      matrix[capabilityId][platform] = realized;
    }
  }

  return {
    type: "domain_coverage",
    version: 1,
    focus: { kind: "domain", id: domain.id },
    summary: summarizeDomain(domain),
    platforms,
    capabilities,
    entities,
    rules,
    verifications,
    projections: stableSortedStrings(projectionStatements.map((p) => p.id)),
    projections_by_capability: projectionsByCapability,
    coverage_matrix: matrix
  };
}

export function generateDomainList(graph) {
  const domains = (graph?.byKind?.domain || []).map((domain) => ({
    id: domain.id,
    name: domain.name,
    description: domain.description,
    status: domain.status,
    parent_domain: domain.parentDomain ? domain.parentDomain.id : null,
    members_count: Object.values(domain.members || {}).reduce((total, list) => total + list.length, 0)
  }));
  domains.sort((a, b) => a.id.localeCompare(b.id));

  return {
    type: "domain_list",
    version: 1,
    domains
  };
}

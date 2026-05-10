// @ts-check
// Resolver enrichment for requirements.
//
// Back-link arrays:
//   acceptanceCriteria  — ACs whose `requirement` points here
//   tasks               — tasks whose `satisfies` includes this requirement
//   verifications       — verifications whose `requirement_refs` includes this
//   supersededBy        — requirements that supersede *this* one
//   documents           — docs whose `satisfies` frontmatter points here
//   rules               — rules whose `from_requirement` is this requirement

/** @param {TopogramStatement} requirement @param {ResolverBacklinkIndex} index */
export function enrichRequirement(requirement, index) {
  return {
    acceptanceCriteria: (index.acsByRequirement.get(requirement.id) || []).slice().sort(),
    tasks: (index.tasksBySatisfiedRequirement.get(requirement.id) || []).slice().sort(),
    verifications: (index.verificationsByRequirementRef.get(requirement.id) || []).slice().sort(),
    supersededBy: (index.supersededByRequirements.get(requirement.id) || []).slice().sort(),
    documents: (index.documentsBySatisfies.get(requirement.id) || []).slice().sort(),
    rules: (index.rulesByFromRequirement.get(requirement.id) || []).slice().sort()
  };
}

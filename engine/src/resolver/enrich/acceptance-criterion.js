// Resolver enrichment for acceptance criteria.
//
// Back-link arrays:
//   tasks          — tasks whose `acceptance_refs` includes this AC
//   verifications  — verifications whose `acceptance_refs` includes this AC
//   supersededBy   — ACs that supersede *this* one

export function enrichAcceptanceCriterion(ac, index) {
  return {
    tasks: (index.tasksByAcceptanceRef.get(ac.id) || []).slice().sort(),
    verifications: (index.verificationsByAcceptanceRef.get(ac.id) || []).slice().sort(),
    supersededBy: (index.supersededByAcs.get(ac.id) || []).slice().sort()
  };
}

// Resolver enrichment for bugs.
//
// Back-link arrays:
//   verifiedBy  — verifications whose `fixes_bugs` includes this bug
//                 (typically same set as bug.fixedInVerification, but the
//                 author may set only one side; we surface both)

export function enrichBug(bug, index) {
  return {
    verifiedBy: (index.verificationsFixingBug.get(bug.id) || []).slice().sort()
  };
}

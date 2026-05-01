// Resolver enrichment for pitches.
//
// Builds back-link arrays so consumers can ask a pitch "who follows you?"
// without re-walking the workspace each time. All lists are arrays of
// statement ids (strings); look-ups happen against `byId` in the caller.
//
// Inputs:
//   pitch          — the normalized pitch statement
//   index          — { requirementsByPitch, decisionsByPitch }
//
// Output is merged into the statement by `resolveWorkspace`.

export function enrichPitch(pitch, index) {
  return {
    requirements: (index.requirementsByPitch.get(pitch.id) || []).slice().sort(),
    decisionsFromPitch: (index.decisionsByPitch.get(pitch.id) || []).slice().sort()
  };
}

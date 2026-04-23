---
classification: accepted_change
maintained_files:
  - src/handlers/profiles/profiles.methods.ts
emitted_dependencies:
  - cap_update_profile
  - workflow_profile
human_owned_seams:
  - workspace profile route update handling
---

# Maintained Profile Update Story

## Goal

Show one real brownfield trial seam that should map cleanly into the maintained-boundary model.

This trial keeps its route and persistence composition hand-owned, but the imported Topogram model now makes one part of that contract explicit:

- `cap_update_profile`
- `workflow_profile`

## Maintained File

- [src/handlers/profiles/profiles.methods.ts](../src/handlers/profiles/profiles.methods.ts)

## Seam Summary

- seam: `workspace profile route update handling`
- emitted dependencies:
  - `cap_update_profile`
  - `workflow_profile`
- review class: `review_required`

## Why This Stays Human-Owned

Topogram should be able to tell that this maintained source file implements the imported profile update contract.

Topogram should not decide:

- the exact handler decomposition
- the internal query/update structure
- logging or validation style

That remains human-owned implementation detail.

What Topogram can say is narrower and useful:

- this maintained code path is bound to the imported profile update contract
- changes to that contract should surface here as a reviewable maintained seam
- the seam is a positive, contract-bound case rather than a no-go boundary

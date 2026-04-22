# Skeptical Evaluator Guide

This page answers the strongest fair objections to Topogram as it exists today.

The goal is not to win every argument. The goal is to make the current proof boundary legible and honest.

## “What problem does Topogram solve first?”

Topogram’s first credible job is controlled software evolution for humans and agents.

It is strongest today when teams need to:

- recover structure from an existing system
- propagate a change through emitted contracts and generated artifacts
- mirror that change in hand-maintained code
- keep verification attached to the same source of truth
- stop clearly when a change should not be automated

It is less convincing if evaluated first as a generic “prompt to full product” platform.

## “Is this just another app generator?”

No, but that is a fair concern.

Topogram does generate artifacts and runtimes. The stronger claim is that it also models:

- domain and workflow semantics
- emitted contract surfaces
- verification intent
- maintained-app change boundaries

The maintained-app proof package and brownfield proof matrix are the best current evidence that Topogram is broader than a reference-app generator.

## “Is Topogram too example-shaped?”

Partially, yes. This is still under active proof.

What is already true:

- three example domains exist
- brownfield recovery has been exercised across a broad set of real stacks
- maintained-app proof now covers additive, guarded, and no-go cases

What is not yet fully proven:

- full generality across domain shape
- symmetric multi-target support on the same example
- long-term ergonomics at larger product scale

The current claim should be “meaningful proof exists,” not “generality is solved.”

## “Is the verification story too self-referential?”

That critique is partly valid.

Topogram currently generates some of the same verification layers that it later uses to increase confidence. That is useful, but not sufficient on its own.

The current answer is:

- generated verification is only one layer
- brownfield proof and maintained-app proof add additional trust anchors
- the maintained-app proof package also includes evaluator-facing contract review material outside the generated runtime loop
- auth now has its own evaluator-facing path, centered on signed-token proof and explicit limits, in [auth-evaluator-path.md](/Users/attebury/Documents/topogram/docs/auth-evaluator-path.md)

The stronger long-term answer is to keep adding independent validation layers over time.

## “Why not just use coding agents directly?”

Because coding agents can change code without preserving durable intent, boundaries, or proof.

Topogram’s pitch is not “replace the agent.”
It is “give the agent a system to work within.”

That matters when the team needs:

- explicit workflow semantics
- emitted contracts people can inspect
- a clearer generator-vs-maintained boundary
- verification that follows the modeled change

## Seam-Aware FAQ

### “Is seam-awareness just file tagging?”

No.

Files are part of the evidence, but the seam model is narrower and more structured than “this file seems related.”

A seam ties together:

- one maintained output
- one maintained boundary point
- emitted dependencies that explain why that boundary moved
- proof stories that explain the intended interpretation
- verification targets that go with that seam

That is why the seam-aware queries can answer more than “which file changed?” They can also answer:

- which seam moved?
- which output owns it?
- why is it safe, guarded, or no-go?
- which checks go with it?

### “Can Topogram compare Topogram to maintained code?”

Partially, yes, and conservatively.

Today the strongest direction is:

- Topogram change -> maintained drift and seam impact

That is what `maintained-drift`, `change-plan`, and seam-aware review surfaces are for.

The reverse direction is still narrower. Topogram can now add lightweight implementation corroboration through:

- maintained-module files existing
- proof-story files existing
- proof-story maintained files remaining in seam or output scope
- dependency-token matches in maintained modules
- verification-target coverage for the seam kind

That is useful evidence, but it is not a claim of full semantic understanding of arbitrary maintained code.

### “How does seam-awareness work with multiple outputs?”

Seams are output-scoped now.

That means the model is no longer “there is one maintained app somewhere in the repo.” It is:

- workspace
- outputs
- seams inside outputs

So a change can affect:

- one output only
- multiple outputs with different severities
- different verification targets per output

This is why the maintained query surfaces now report output-aware boundary, drift, conformance, risk, and verification information instead of one flat maintained-file bucket.

### “Why does this matter for the alpha wedge?”

Because the maintained-app claim is not just that Topogram can point at hand-owned code.

The stronger alpha claim is that Topogram can help humans and agents reason about governed maintained change through:

- explicit seams
- emitted dependencies
- proof stories
- output-aware verification targets
- clear safe, guarded, and no-go boundaries

That is the part of the story that distinguishes Topogram from a generic code generator or a free-form coding-agent workflow.

## “Is there too much DSL/adoption tax?”

That risk is real.

Topogram asks teams to model intent explicitly, which adds discipline and some upfront cost. That is why the alpha wedge should stay narrow:

- brownfield recovery
- existing-app evolution
- agent-guided changes that need stronger boundaries

The current claim should not be that every app team should adopt a new modeling layer immediately.

## “What should I evaluate first?”

Use the canonical evaluator flow:

- [evaluator-path.md](/Users/attebury/Documents/topogram/docs/evaluator-path.md)

That path is designed to answer the right question first:

- not “can Topogram generate files?”
- but “can Topogram help humans and agents evolve software safely?”

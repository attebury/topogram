# Alpha First-Call Guide

Use this guide for a first conversation with a serious design partner candidate.

The goal is not to pitch everything.
The goal is to learn whether the current wedge is real for them.

## Outcomes To Aim For

By the end of the call, you should know:

- what kind of system they need to evolve
- how coding agents fit into their current workflow
- where trust breaks down today
- whether Topogram's current wedge resonates
- whether there is one contained first pressure test worth trying

## Opening

Start simple:

> Topogram is an early spec-and-proof layer for teams using coding agents to evolve real software. The current focus is keeping intent, generated outputs, and verification aligned, especially around brownfield recovery, maintained-code change, and review boundaries.

Then ask:

1. What kind of system are you working on right now?
2. Where are coding agents already helping?
3. Where do they currently drift or become hard to trust?

## Core Discovery Questions

### System and workflow

- What is the shape of the codebase?
- What kinds of changes are frequent and risky?
- Where do workflow semantics or review boundaries matter most?

### Current agent use

- Which tools or agents are you using today?
- What do you trust them with?
- What still requires too much manual checking or cleanup?

### Team shape

- Who would need to trust a workflow like this?
- Is the pain mostly engineering pain, design/UX pain, product pain, or some mix?
- Where do decisions currently get lost between product, design, and implementation?

### Pressure-test candidate

- If we looked at one contained workflow or subsystem, what should it be?
- What would count as a useful first result?
- What would immediately make this feel like a bad fit?

## Things To Watch For

Good signs:

- they have a real brownfield or maintained-code problem
- they already feel drift between intent, code, and verification
- they care about review boundaries, not just speed
- they can name one concrete workflow to test

Weak signs:

- they mainly want auto-generated apps from prompts
- they want fully autonomous agents with minimal review
- they want production-readiness guarantees that are outside the current alpha
- they cannot identify a contained place to start

## Suggested Call Shape

Use a rough 30-minute structure:

1. `5 min`
   Quick framing of what Topogram is and is not
2. `10 min`
   Understand their codebase, workflow, and current agent use
3. `10 min`
   Explore one contained pressure-test candidate
4. `5 min`
   Decide whether there is a concrete next step

## Close

End with one explicit next step:

- send evaluator path
- send proof points and limits
- schedule a live demo
- ask for one example workflow or subsystem
- politely decline if fit is weak

## After The Call

Immediately capture:

- fit rating
- strongest quote
- strongest objection
- likely next step
- whether this validates the current wedge or points to post-alpha work


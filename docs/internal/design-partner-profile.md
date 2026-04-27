# Design Partner Profile

This note defines who Topogram is for right now.

Use it as the filter for the invite-led alpha.

## One-Sentence Fit

Topogram is for technical teams already using coding agents who need stronger structure, review boundaries, and proof while evolving real software.

## Best Early Design Partners

The strongest current fit is a team that:

- already has real software they need to change, not only a blank-slate product idea
- is comfortable reading code, contracts, and architecture notes
- is actively experimenting with coding agents or agent-assisted engineering
- cares about workflow semantics, emitted contracts, and review boundaries
- can tolerate an early tool with explicit limits

## Strong Initial Use Cases

The best near-term design partner work looks like:

- brownfield recovery on an existing service or app
- agent-guided changes that need stronger review boundaries
- keeping generated and hand-maintained surfaces aligned
- workflow-heavy software where semantics matter more than UI polish

## Weak Fit Right Now

Topogram is a weak fit today for teams looking for:

- a no-code product builder
- a production-ready auth platform
- polished enterprise deployment workflows
- a generic prompt-to-product generator with minimal modeling overhead
- a tool that hides review and adoption decisions

## Good First Conversation

The best early alpha conversation usually starts with:

1. what existing system or maintained codebase do you need to evolve?
2. where do coding agents help today, and where do they currently drift?
3. which changes feel risky because contracts, workflows, or verification move out of sync?

If those questions resonate, the team is probably a good alpha candidate.

## Good First Alpha Trial

The best first alpha trial is:

- one real brownfield repo or subsystem
- one contained workflow-heavy or contract-sensitive change
- one proof-oriented review loop with humans and agents both in the process

This is a better fit than treating Topogram as the platform boundary for a whole product on day one.

For the operator-side triage and feedback workflow, use:

- [alpha-interest-triage-rubric.md](./alpha-interest-triage-rubric.md)
- [partner-feedback-template.md](./partner-feedback-template.md)
- [alpha-first-call-guide.md](./alpha-first-call-guide.md)

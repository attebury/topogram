# Alpha Interest Triage Rubric

Use this rubric for inbound GitHub issues, direct replies, DMs, or warm intros.

The point is to avoid two common mistakes:

- spending too much time on weak-fit interest
- broadening the product story to match every inbound request

## Primary Sort

Put each inbound into one of three buckets.

### 1. Validates current wedge

This is the best category.

Signals:

- they already have real software, not just an idea
- they are already using coding agents or actively evaluating them
- they feel pain around review boundaries, workflow drift, or verification trust
- they have a contained workflow or subsystem to pressure-test
- they understand this is early and still want to engage

Action:

- prioritize follow-up
- aim for a concrete conversation
- capture detailed feedback

### 2. Useful but post-alpha

This interest is real, but not for the current alpha story.

Signals:

- they want something adjacent but broader
- they are interested mainly in future platform expansion
- they want richer deployment, production auth, or broader integrations
- they like the direction but their use case depends on work outside the current proof boundary

Action:

- respond positively
- do not promise near-term support
- park under post-alpha shaping

### 3. Off-strategy

This is not the right fit right now.

Signals:

- they want a no-code builder
- they want a generic prompt-to-product engine
- they want a hosted agent runtime or orchestration platform
- they expect production-ready auth or enterprise deployment claims today
- they are not interested in modeling, review, or proof boundaries

Action:

- reply briefly and honestly
- do not over-invest

## Scoring Heuristic

Use a lightweight 0-2 score for each area.

- Real software pressure
  - `0`: mostly hypothetical
  - `1`: some real pressure
  - `2`: active pain on a real system

- Agent maturity
  - `0`: not using agents
  - `1`: experimenting
  - `2`: already using agents in real work

- Wedge alignment
  - `0`: weak match
  - `1`: partial match
  - `2`: strong match to brownfield / maintained / proof boundary story

- Alpha readiness
  - `0`: expects polished product
  - `1`: tolerant but unclear
  - `2`: explicitly comfortable with early infrastructure

- Cross-functional pull
  - `0`: one curious person only
  - `1`: one role with some team interest
  - `2`: clear engineering + design/UX/product pull

Suggested interpretation:

- `8-10`: high-priority fit
- `5-7`: medium-priority fit
- `0-4`: low-priority or off-strategy

## Red Flags

Treat these as caution signals even if the score looks decent.

- they want you to broaden the alpha claim immediately
- they are mostly looking for free consulting
- they want production guarantees that the repo explicitly does not make
- they want fully autonomous change with minimal human review

## Response Pattern

### High-priority fit

- thank them
- confirm the wedge in one sentence
- propose one concrete next step

### Medium-priority fit

- thank them
- point them to evaluator path and proof boundary
- ask one clarifying question or offer a lighter next step

### Low-priority / off-strategy

- be honest
- keep it short
- do not try to force-fit them into the current alpha

## Normalized Blocker Taxonomy

After triage or a real conversation, normalize the strongest concern into one of:

- `story blocker`
  - the wedge, proof boundary, or evaluator story does not read clearly enough
- `proof blocker`
  - the current proof path or verification surface is not strong enough for their pressure test
- `product-shaping request`
  - the request is interesting but belongs in post-alpha shaping rather than the current alpha bar
- `off-strategy ask`
  - the ask conflicts with the current wedge or explicit claim boundary

## Normalized Next-Step Taxonomy

When there is a follow-up, normalize it into one of:

- `repo/evaluator-path only`
- `async follow-up`
- `live demo`
- `deeper technical session`
- `no follow-up`

Use the same categories in [partner-feedback-template.md](./partner-feedback-template.md) so triage and post-conversation capture stay comparable.

# Auth Evaluator Path

This is the shortest honest path for evaluating Topogram auth today.

Use it when the question is not "does Topogram have auth at all?" but:

- what auth does Topogram actually prove?
- where is that proof strongest?
- what is still outside scope?

## 1. Start With The Auth Boundary

Read:

- [auth-profile-bearer-jwt-hs256.md](./auth-profile-bearer-jwt-hs256.md)
- [proof-points-and-limits.md](./proof-points-and-limits.md)

The key question here is:

- what is the real auth claim today?

The intended answer is:

- Topogram is alpha-complete for modeled auth semantics with signed bearer tokens.
- Topogram is not claiming production auth readiness.

## 2. Check The Modeled Auth Surface

Read:

- [auth-modeling.md](./auth-modeling.md)

The key question here is:

- what kinds of auth rules can Topogram model explicitly?

The intended answer is:

- `permission`
- `ownership`
- `claim`

## 3. Check The Generated Proof Matrix

Inspect:

- [examples/generated/issues](../examples/generated/issues)
- [examples/generated/content-approval](../examples/generated/content-approval)

Use this proof mapping:

- `permission`: `issues`
- `ownership`: `issues`
- `claim`: `content-approval`

The key questions here are:

- do signed tokens actually gate backend behavior?
- does generated UI visibility follow the same auth model?
- are negative cases proven?

What those examples prove today:

- `issues` proves signed-token permission checks, explicit ownership enforcement, `401` missing/invalid/expired token behavior, and `403` forbidden behavior
- `content-approval` proves reviewer-claim enforcement in both backend and generated UI visibility, including `403` for a valid token that lacks the reviewer claim

## 4. Check The Brownfield Auth Loop

Read:

- [brownfield-import-roadmap.md](./brownfield-import-roadmap.md)
- [agent-query-contract.md](./agent-query-contract.md)

Then inspect the two brownfield auth query surfaces:

- `node ./src/cli.js query auth-hints <path>`
- `node ./src/cli.js query auth-review-packet <path> --bundle <slug>`

The key question here is:

- can Topogram help an operator recover, review, and adopt auth rules from a brownfield system?

The intended answer is:

- yes, across `permission`, `ownership`, and `claim`
- but through explicit review and adoption, not silent promotion

## 5. End On The Limits

Read:

- [auth-profile-bearer-demo.md](./auth-profile-bearer-demo.md)
- [bearer-demo-launch-checklist.md](./bearer-demo-launch-checklist.md)

The key question here is:

- what is still outside the alpha auth claim?

The intended answer is:

- session or cookie auth
- external identity providers
- rotation, revocation, and refresh lifecycle
- production auth operations
- broader enterprise auth claims

## Short Version

Topogram auth is alpha-complete when evaluated this way:

- one primary auth profile: signed JWT
- one complete modeled auth story: `permission`, `ownership`, `claim`
- one generated proof loop for those auth shapes
- one brownfield review and adoption loop for the same auth shapes
- one explicit boundary that stops short of production auth claims

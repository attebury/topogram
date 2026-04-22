# Docs

This directory collects planning and architecture notes for Topogram outside the engine-specific docs.

Current docs:

- [Human/Agent Collaboration Model](./human-agent-collaboration.md)
- [Agent Query Contract](./agent-query-contract.md)
- [Agent Task Modes](./agent-task-modes.md)
- [Topogram Workspace Layout](./topogram-workspace-layout.md)
- [Proof Points And Limits](./proof-points-and-limits.md)
- [Auth Evaluator Path](./auth-evaluator-path.md)
- [Alpha Plan](./alpha-plan.md)
- [Alpha Overview](./alpha-overview.md)
- [Alpha-Ready Checklist](./alpha-ready-checklist.md)
- [Alpha Launch Tracker](./alpha-launch-tracker.md)
- [Alpha Launch And Repository Shaping Plan](./alpha-launch-and-repo-shaping-plan.md)
- [Invite-Led Alpha](./invite-led-alpha.md)
- [Dev.to Limited Partner Review Draft](./devto-limited-partner-review.md)
- [Design Partner Profile](./design-partner-profile.md)
- [Partner Feedback Template](./partner-feedback-template.md)
- [Alpha Interest Triage Rubric](./alpha-interest-triage-rubric.md)
- [Alpha First-Call Guide](./alpha-first-call-guide.md)
- [Demo Path Confirmation Plan](./demo-path-confirmation-plan.md)
- [Skeptical Evaluator Guide](./skeptical-evaluator.md)
- [Evaluator Path](./evaluator-path.md)
- [Testing Strategy](./testing-strategy.md)
- [Topogram Product Glossary](./topogram-product-glossary.md)
- [Steady-State Development Loop](./steady-state-development-loop.md)
- [Maintained-App Boundary Mechanics](./maintained-app-boundary-mechanics.md)
- [Bearer JWT HS256 Auth Profile](./auth-profile-bearer-jwt-hs256.md)
- [Bearer Demo Auth Profile](./auth-profile-bearer-demo.md)
- [Auth Modeling](./auth-modeling.md)
- [Topogram + Graphify Integration Sketch](./topogram-graphify-integration-sketch.md)
- [Graphify Optional Evidence Integration Plan](./graphify-optional-evidence-plan.md)
- [Topogram + Agentic Stack Integration Sketch](./topogram-agentic-stack-integration-sketch.md)
- [Brownfield Import Roadmap](./brownfield-import-roadmap.md)
- [Confirmed Proof Matrix](./confirmed-proof-matrix.md)
- [Development Decisions](./development-decisions.md)
- [Brownfield Trial: Supabase Express API](./brownfield-trial-supabase-express-api.md)
- [Brownfield Trial: Rails RealWorld Example App](./brownfield-trial-rails-realworld-example-app.md)
- [Brownfield Trial: Django RealWorld Example App](./brownfield-trial-django-realworld-example-app.md)
- [Brownfield Trial: Clean Architecture SwiftUI](./brownfield-trial-clean-architecture-swiftui.md)
- [Brownfield Trial: eShopOnWeb Razor Pages MVC](./brownfield-trial-eshoponweb-razor-pages-mvc.md)

These docs focus on:

- human/agent collaboration boundaries
- canonical vs candidate vs generated workspace structure
- testing and verification strategy
- generated auth profile behavior and limits, with signed JWT as the primary alpha auth profile and bearer-demo as a lighter demo/local profile
- authorization modeling guidance
- brownfield import architecture
- development-time product and modeling decisions
- workflow and adoption planning
- agent-queryable context and adoption surfaces
- real-trial findings and next steps

Notable current adoption behavior:

- use `reconcile adopt <selector> ... --write` for normal selective promotion
- use `reconcile adopt <selector> ... --refresh-adopted --write` only when you want to refresh existing machine-managed canonical files from improved candidate imports

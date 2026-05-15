---
title: "Specs before pixels: why I want product intent out of the chat window"
published: false
tags: productivity, documentation, ai, architecture, webdev
---

Most “specs” are not missing. They’re **everywhere**—README, tickets, comments, and the code that **actually** shipped. Agents don’t fix that by writing faster; they **amplify drift** unless there’s a **single, checkable place** for what you’re building.

That’s the problem I keep chewing on with **Topogram** (`@topogram/cli`): normalize durable **intent** in a `topo/` workspace, **validate** it, then let humans, generators, or agents implement against **contracts**—not against vibes.

## Three failures that don’t need “more AI”

**Spec disarray** — No shared graph means no shared truth: the API “sort of” matches the UI, and nobody can answer “what did we decide?” from one artifact.

**Drift** — The repo is always “right,” but the story you tell about it lags. Over time you maintain a bundle of almost-compatible narratives.

**Agent coding** — Models are eager and fast. Without **explicit intent** and **verification**, they ship plausible patches that don’t match the product you think you’re building.

## What “normalize” means here (not “type more markdown”)

Topogram isn’t a Figma kit. It’s closer to **API-first design**, but for **UI semantics** too: **widgets** (reusable meaning: props, events, behaviors), **projections** for shared `ui_contract` vs concrete **web_surface** / **ios_surface**, and **`design_tokens`** as **roles** (density, contrast, primary vs destructive)—not every hex in the graph.

Stack code—SvelteKit, React, SwiftUI, your OSS or commercial design system—**implements** those roles. A thin **token bridge** (e.g. `--topogram-*` on the web, a `Theme` type on iOS) keeps **platform sugar** out of the spec unless it’s a real product promise.

## Extraction vs “let the agent read the whole repo”

Brownfield **extract** is **bounded**: heuristics and extractor packs emit **review-only candidates** and plans without mutating your legacy app. That’s usually **cheaper and more repeatable** than one giant agent pass—*when* your stack is covered.

Agents still shine at **review, merge, and explanation**—especially when extractors don’t match your framework. The boring middle ground: **machine candidates + human or agent review** beats prose-only or vibe-only migration.

## Two passes (so “normalize” doesn’t mean “rewrite the app in week one”)

**Pass 1:** adopt **`topo/`**—widgets, shapes, merge draft **`widget_bindings`** into a canonical **`ui_contract`**, run **`topogram check`** (and widget checks).

**Pass 2 (optional):** **`emit`**, **`query slice`**, then **your** adapters, CSS, and optional **`data-topogram-widget`** markers for conformance—not magic sprayed into `src/` by default.

## Why this isn’t only “AI hype”

Spec-driven work is older than chatbots. LLMs are one **consumer** of good specs, not the **reason** to have them. The bet is simple: if intent is **structured and checkable**, agents stop being chaos gremlins and start being leverage—**including** on-prem or air-gapped workflows where prompts never leave your network.

---

*If this resonates: `npx topogram doctor`, then skim [docs/README](../README.md) and [Agent First Run](../agent-first-run.md). More on maintained UI (tokens, adapters, brownfield): [sveltekit-realization-shape.md](./sveltekit-realization-shape.md).*

For dev.to, set `canonical_url` to your published post and use absolute URLs for those links.

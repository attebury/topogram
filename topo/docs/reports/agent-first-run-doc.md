---
id: agent_first_run_doc
kind: report
title: Agent First Run Evidence
status: draft
source_of_truth: repo-local
confidence: high
related_rules:
  - rule_agents_start_with_focused_context
related_capabilities:
  - cap_brief_agent
  - cap_query_context
---

# Agent First Run Evidence

`docs/agent-first-run.md` defines the agent workflow shape: start with the agent brief, use focused query packets, respect edit boundaries, and verify with the smallest meaningful command before broader gates.

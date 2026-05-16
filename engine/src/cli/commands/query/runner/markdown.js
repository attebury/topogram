// @ts-check

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function text(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean);
}

/**
 * @param {string[]} lines
 * @param {string} label
 * @param {unknown} value
 * @returns {void}
 */
function pushField(lines, label, value) {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return;
  if (Array.isArray(value)) {
    lines.push(`- ${label}: ${value.map((item) => `\`${text(item)}\``).join(", ")}`);
    return;
  }
  lines.push(`- ${label}: ${text(value)}`);
}

/**
 * @param {AnyRecord|null|undefined} item
 * @returns {string}
 */
function itemLabel(item) {
  if (!item) return "";
  const id = text(item.id);
  const name = text(item.name);
  if (id && name && id !== name) return `\`${id}\` — ${name}`;
  if (id) return `\`${id}\``;
  return name;
}

/**
 * @param {string[]} lines
 * @param {string} heading
 * @param {Record<string, unknown>|null|undefined} groups
 * @returns {void}
 */
function pushIdGroups(lines, heading, groups) {
  if (!groups || typeof groups !== "object") return;
  /** @type {[string, string[]][]} */
  const entries = Object.entries(groups)
    .map(/** @returns {[string, string[]]} */ ([key, value]) => [key, stringList(value)])
    .filter(([, values]) => values.length > 0);
  if (entries.length === 0) return;
  lines.push("", `## ${heading}`);
  for (const [key, values] of entries) {
    lines.push(`- ${key}: ${values.map((value) => `\`${value}\``).join(", ")}`);
  }
}

/**
 * @param {string[]} lines
 * @param {string} heading
 * @param {Record<string, unknown>|null|undefined} related
 * @returns {void}
 */
function pushRelated(lines, heading, related) {
  if (!related || typeof related !== "object") return;
  const sections = Object.entries(related)
    .map(([key, value]) => [key, Array.isArray(value) ? value : []])
    .filter(([key]) => key !== "terms")
    .filter(([, values]) => values.length > 0);
  if (sections.length === 0) return;
  lines.push("", `## ${heading}`);
  for (const [key, values] of sections) {
    lines.push(`### ${key}`);
    for (const value of values.slice(0, 12)) {
      if (value && typeof value === "object") {
        const item = /** @type {AnyRecord} */ (value);
        const label = itemLabel(item);
        lines.push(`- ${label || text(value)}`);
        if (item.description) lines.push(`  - ${text(item.description)}`);
      } else {
        lines.push(`- \`${text(value)}\``);
      }
    }
    if (values.length > 12) {
      lines.push(`- ... ${values.length - 12} more`);
    }
  }
}

/**
 * @param {string[]} lines
 * @param {AnyRecord|null|undefined} guidance
 * @returns {void}
 */
function pushAgentGuidance(lines, guidance) {
  if (!guidance || typeof guidance !== "object") return;
  lines.push("", "## Agent Guidance");
  pushField(lines, "Mode", guidance.mode);
  pushField(lines, "Read first", guidance.read_first);
  const nextQueries = stringList(guidance.next_queries);
  if (nextQueries.length > 0) {
    lines.push("- Next queries:");
    for (const command of nextQueries) lines.push(`  - \`${command}\``);
  }
  const commands = stringList(guidance.required_commands);
  if (commands.length > 0) {
    lines.push("- Required commands:");
    for (const command of commands) lines.push(`  - \`${command}\``);
  }
  pushField(lines, "Completion command", guidance.completion_command);
  pushField(lines, "Write scope summary", guidance.write_scope_summary);
  const warnings = stringList(guidance.warnings);
  if (warnings.length > 0) {
    lines.push("- Warnings:");
    for (const warning of warnings) lines.push(`  - ${warning}`);
  }
}

/**
 * @param {string[]} lines
 * @param {AnyRecord[]|null|undefined} terms
 * @returns {void}
 */
function pushGlossaryTerms(lines, terms) {
  if (!Array.isArray(terms) || terms.length === 0) return;
  lines.push("", "## Glossary Terms");
  for (const term of terms.slice(0, 12)) {
    const label = itemLabel(term);
    lines.push(`- ${label || text(term)}`);
    if (term.description) lines.push(`  - ${text(term.description)}`);
    if (term.category) lines.push(`  - Category: \`${text(term.category)}\``);
  }
  if (terms.length > 12) {
    lines.push(`- ... ${terms.length - 12} more`);
  }
}

/**
 * @param {string[]} lines
 * @param {AnyRecord[]|null|undefined} rules
 * @returns {void}
 */
function pushStandingRules(lines, rules) {
  if (!Array.isArray(rules) || rules.length === 0) return;
  lines.push("", "## Standing Rules");
  for (const rule of rules) {
    const label = itemLabel(rule);
    lines.push(`- ${label || text(rule)}`);
    if (rule.severity || rule.status) {
      lines.push(`  - ${[rule.severity ? `severity: ${text(rule.severity)}` : null, rule.status ? `status: ${text(rule.status)}` : null].filter(Boolean).join(", ")}`);
    }
    if (rule.description) lines.push(`  - ${text(rule.description)}`);
  }
}

/**
 * @param {string[]} lines
 * @param {AnyRecord[]} steps
 * @returns {void}
 */
function pushSteps(lines, steps) {
  if (!Array.isArray(steps) || steps.length === 0) return;
  lines.push("", "## Steps");
  for (const [index, step] of steps.entries()) {
    lines.push(`### ${index + 1}. ${text(step.id)}`);
    pushField(lines, "Intent", step.intent);
    pushField(lines, "After", step.after);
    const commands = stringList(step.commands);
    if (commands.length > 0) {
      lines.push("- Commands:");
      for (const command of commands) lines.push(`  - \`${command}\``);
    }
    const expects = stringList(step.expects);
    if (expects.length > 0) {
      lines.push("- Expects:");
      for (const expected of expects) lines.push(`  - ${expected}`);
    }
    pushField(lines, "Notes", step.notes);
  }
}

/**
 * @param {string[]} lines
 * @param {AnyRecord[]} alternates
 * @returns {void}
 */
function pushAlternates(lines, alternates) {
  if (!Array.isArray(alternates) || alternates.length === 0) return;
  lines.push("", "## Alternates");
  for (const alternate of alternates) {
    lines.push(`### ${text(alternate.id)}`);
    pushField(lines, "From", alternate.from);
    pushField(lines, "Condition", alternate.condition);
    const commands = stringList(alternate.commands);
    if (commands.length > 0) {
      lines.push("- Commands:");
      for (const command of commands) lines.push(`  - \`${command}\``);
    }
  }
}

/**
 * @param {string[]} lines
 * @param {AnyRecord|null|undefined} targets
 * @returns {void}
 */
function pushVerificationTargets(lines, targets) {
  if (!targets || typeof targets !== "object") return;
  lines.push("", "## Verification Targets");
  pushField(lines, "Rationale", targets.rationale);
  pushField(lines, "Verifications", targets.verification_ids);
  pushField(lines, "Generated checks", targets.generated_checks);
  pushField(lines, "Maintained app checks", targets.maintained_app_checks);
}

/**
 * @param {string[]} lines
 * @param {AnyRecord|null|undefined} writeScope
 * @returns {void}
 */
function pushWriteScope(lines, writeScope) {
  if (!writeScope || typeof writeScope !== "object") return;
  lines.push("", "## Write Scope");
  pushField(lines, "Safe to edit", writeScope.safe_to_edit);
  pushField(lines, "Generator owned", writeScope.generator_owned);
  pushField(lines, "Human owned review required", writeScope.human_owned_review_required);
  pushField(lines, "Out of bounds", writeScope.out_of_bounds);
}

/**
 * @param {AnyRecord} slice
 * @returns {string}
 */
export function formatContextSliceMarkdown(slice) {
  const focus = slice.focus || {};
  const summary = slice.summary || {};
  const title = itemLabel({ id: focus.id, name: summary.name }) || "context slice";
  const lines = [`# Context Slice: ${text(focus.kind || "unknown")} ${title}`, ""];

  lines.push("## Summary");
  pushField(lines, "Type", slice.type);
  pushField(lines, "Status", summary.status);
  pushField(lines, "Description", summary.description);
  pushField(lines, "Goal", summary.goal);
  pushField(lines, "Domain", summary.domain);
  pushField(lines, "Priority", summary.priority);
  pushField(lines, "Appetite", summary.appetite);
  pushField(lines, "Actors", summary.actors);

  if (slice.review_boundary) {
    lines.push("", "## Review Boundary");
    pushField(lines, "Automation class", slice.review_boundary.automation_class);
    pushField(lines, "Reasons", slice.review_boundary.reasons);
  }

  pushSteps(lines, slice.steps || []);
  pushAlternates(lines, slice.alternates || []);
  pushAgentGuidance(lines, slice.agent_guidance);
  pushStandingRules(lines, slice.standing_rules);
  pushGlossaryTerms(lines, slice.related?.terms);
  pushIdGroups(lines, "Depends On", slice.depends_on);
  pushRelated(lines, "Related", slice.related);
  pushVerificationTargets(lines, slice.verification_targets);
  pushWriteScope(lines, slice.write_scope);

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

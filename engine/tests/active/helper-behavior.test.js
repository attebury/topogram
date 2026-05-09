import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { relativeTo, toPosixPath } from "../../src/path-helpers.js";
import {
  GENERIC_STOPWORDS,
  TECHNICAL_STOPWORDS,
  canonicalCandidateTerm,
  extractRankedTerms,
  idHintify,
  pluralizeCandidateTerm,
  slugify,
  titleCase
} from "../../src/text-helpers.js";
import {
  canonicalCandidateTerm as importCanonicalCandidateTerm,
  pluralizeCandidateTerm as importPluralizeCandidateTerm,
  relativeTo as importRelativeTo
} from "../../src/import/core/shared.js";

test("candidate term canonicalization and pluralization handle edge cases", () => {
  const cases = [
    ["tasks", "task", "tasks"],
    ["metrics", "metric", "metrics"],
    ["status", "status", "statuses"],
    ["stats", "stats", "stats"],
    ["bus", "bus", "buses"],
    ["analysis", "analysis", "analyses"],
    ["category", "category", "categories"],
    ["categories", "category", "categories"],
    ["users", "user", "users"],
    ["business", "business", "businesses"]
  ];

  for (const [input, canonical, plural] of cases) {
    assert.equal(canonicalCandidateTerm(input), canonical, input);
    assert.equal(pluralizeCandidateTerm(canonical), plural, input);
    assert.equal(importCanonicalCandidateTerm(input), canonical, input);
    assert.equal(importPluralizeCandidateTerm(canonical), plural, input);
  }
});

test("shared text helpers preserve current id, slug, and title behavior", () => {
  assert.equal(slugify("Hello, API World"), "hello-api-world");
  assert.equal(idHintify("Hello, API World"), "hello_api_world");
  assert.equal(titleCase("hello_api-world"), "Hello Api World");
});

test("technical stopwords are separate so stack terms can survive where needed", () => {
  assert.equal(GENERIC_STOPWORDS.has("api"), false);
  assert.equal(GENERIC_STOPWORDS.has("react"), false);
  assert.equal(GENERIC_STOPWORDS.has("sveltekit"), false);
  assert.equal(TECHNICAL_STOPWORDS.has("api"), true);
  assert.equal(TECHNICAL_STOPWORDS.has("react"), true);
  assert.equal(TECHNICAL_STOPWORDS.has("sveltekit"), true);

  const markdown = "# React API SvelteKit Workflow\n\nReact and SvelteKit call an API for approval metrics.";
  const domainTerms = extractRankedTerms(markdown, { technicalStopwords: false });
  assert.equal(domainTerms.includes("react"), true);
  assert.equal(domainTerms.includes("api"), true);
  assert.equal(domainTerms.includes("sveltekit"), true);

  const documentTerms = extractRankedTerms(markdown);
  assert.equal(documentTerms.includes("react"), false);
  assert.equal(documentTerms.includes("api"), false);
  assert.equal(documentTerms.includes("sveltekit"), false);
  assert.equal(documentTerms.includes("approval"), true);
});

test("relative path helpers normalize to posix paths", () => {
  assert.equal(toPosixPath("apps\\web\\src"), "apps/web/src");
  const base = path.join("workspace", "topogram");
  const file = path.join("workspace", "topogram", "domains", "orders", "entity.tg");
  assert.equal(relativeTo(base, file), "domains/orders/entity.tg");
  assert.equal(importRelativeTo(base, file), "domains/orders/entity.tg");
});

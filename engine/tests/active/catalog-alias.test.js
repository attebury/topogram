import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCatalogTemplateAliasError,
  isCatalogAliasCandidate
} from "../../src/cli/catalog-alias.js";

test("catalog alias candidates exclude package specs, paths, and tarballs", () => {
  assert.equal(isCatalogAliasCandidate("hello-web"), true);
  assert.equal(isCatalogAliasCandidate("todo"), true);
  assert.equal(isCatalogAliasCandidate("@attebury/topogram-template-todo"), false);
  assert.equal(isCatalogAliasCandidate("./local-template"), false);
  assert.equal(isCatalogAliasCandidate("../local-template"), false);
  assert.equal(isCatalogAliasCandidate("/tmp/local-template"), false);
  assert.equal(isCatalogAliasCandidate("scope/template"), false);
  assert.equal(isCatalogAliasCandidate("template.tgz"), false);
});

test("catalog-disabled default starter guidance is explicit", () => {
  const message = formatCatalogTemplateAliasError("hello-web", "none", null);
  assert.match(message, /Catalog access is disabled/);
  assert.match(message, /The default starter 'hello-web' is catalog-backed/);
  assert.match(message, /Unset TOPOGRAM_CATALOG_SOURCE=none/);
  assert.doesNotMatch(message, /For the private default catalog/);
});

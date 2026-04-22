import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");

function readJson(relativePathParts) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, ...relativePathParts), "utf8"));
}

export function readContentApprovalOpenApi() {
  return readJson([
    "examples",
    "content-approval",
    "topogram",
    "tests",
    "fixtures",
    "expected",
    "openapi.json"
  ]);
}

export function readContentApprovalDocsIndex() {
  return readJson([
    "examples",
    "content-approval",
    "topogram",
    "tests",
    "fixtures",
    "expected",
    "docs-index.json"
  ]);
}

export function readTodoServerContract() {
  return readJson([
    "examples",
    "todo",
    "topogram",
    "tests",
    "fixtures",
    "expected",
    "proj_api.server-contract.json"
  ]);
}

export function readTodoDbSnapshot() {
  return readJson([
    "examples",
    "todo",
    "topogram",
    "tests",
    "fixtures",
    "expected",
    "proj_db_sqlite.db-schema-snapshot.json"
  ]);
}

export function readTodoDocsIndex() {
  return readJson([
    "examples",
    "todo",
    "topogram",
    "tests",
    "fixtures",
    "expected",
    "docs-index.json"
  ]);
}

export function readTodoUiWebContract() {
  return readJson([
    "examples",
    "todo",
    "topogram",
    "tests",
    "fixtures",
    "expected",
    "proj_ui_web.ui-web-contract.json"
  ]);
}

export function readTodoTaskCardSchema() {
  return readJson([
    "examples",
    "todo",
    "topogram",
    "tests",
    "fixtures",
    "expected",
    "shape_output_task_card.schema.json"
  ]);
}

export function readIssuesUiWebContract() {
  return readJson([
    "examples",
    "issues",
    "topogram",
    "tests",
    "fixtures",
    "expected",
    "proj_ui_web.ui-web-contract.json"
  ]);
}

export function readIssuesOpenApi() {
  return readJson([
    "examples",
    "issues",
    "topogram",
    "tests",
    "fixtures",
    "expected",
    "openapi.json"
  ]);
}

export function readIssuesDocsIndex() {
  return readJson([
    "examples",
    "issues",
    "topogram",
    "tests",
    "fixtures",
    "expected",
    "docs-index.json"
  ]);
}

export function readIssuesDocsMarkdown() {
  return fs.readFileSync(path.join(
    repoRoot,
    "examples",
    "issues",
    "topogram",
    "tests",
    "fixtures",
    "expected",
    "issues.docs.md"
  ), "utf8");
}

export function openApiSchema(document, schemaName) {
  const schema = document.components?.schemas?.[schemaName];
  assert.ok(schema, `Expected emitted OpenAPI to include ${schemaName}`);
  return schema;
}

export function routeByCapability(contract, capabilityId) {
  const route = (contract.routes || []).find((entry) => entry.capabilityId === capabilityId);
  assert.ok(route, `Expected emitted server contract to include ${capabilityId}`);
  return route;
}

export function fieldNames(fields = []) {
  return fields.map((field) => field.name);
}

export function tableWithColumns(snapshot, requiredColumns) {
  const table = (snapshot.tables || []).find((entry) => {
    const names = new Set((entry.columns || []).map((column) => column.name));
    return requiredColumns.every((name) => names.has(name));
  });
  assert.ok(table, `Expected emitted DB snapshot to include a table with columns: ${requiredColumns.join(", ")}`);
  return table;
}

export function docById(index, docId) {
  const doc = (index.docs || []).find((entry) => entry.id === docId);
  assert.ok(doc, `Expected emitted docs index to include ${docId}`);
  return doc;
}

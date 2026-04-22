import { generateDbContractGraph } from "../contract.js";
import { normalizeDbSchemaSnapshot } from "../snapshot.js";
import {
  indexGraphStatements,
  renderCreateTable,
  renderIndexes
} from "../shared.js";
import { resolveSqliteCapabilities } from "./capabilities.js";

export function generateSqliteSqlSchema(graph, options = {}) {
  resolveSqliteCapabilities(options.profileId);
  const contract = generateDbContractGraph(graph, options);
  const byId = indexGraphStatements(graph);
  const snapshot = normalizeDbSchemaSnapshot(contract, byId);
  const statements = ["pragma foreign_keys = on;", ""];

  for (const table of snapshot.tables) {
    statements.push(renderCreateTable(table, "sqlite", { byId }));
    statements.push("");
    for (const index of renderIndexes(table)) {
      statements.push(index);
    }
    statements.push("");
  }

  return `${statements.join("\n").trimEnd()}\n`;
}

import { generateDbContractGraph } from "../contract.js";
import { normalizeDbSchemaSnapshot } from "../snapshot.js";
import {
  enumStatementsForSnapshot,
  indexGraphStatements,
  renderCreateEnumType,
  renderCreateTable,
  renderIndexes
} from "../shared.js";
import { resolvePostgresCapabilities } from "./capabilities.js";

export function generatePostgresSqlSchema(graph, options = {}) {
  resolvePostgresCapabilities(options.profileId);
  const contract = generateDbContractGraph(graph, options);
  const byId = indexGraphStatements(graph);
  const snapshot = normalizeDbSchemaSnapshot(contract, byId);
  const statements = [];

  for (const enumStatement of enumStatementsForSnapshot(snapshot, byId)) {
    statements.push(renderCreateEnumType(enumStatement));
    statements.push("");
  }

  for (const table of snapshot.tables) {
    statements.push(renderCreateTable(table, "postgres", { byId }));
    statements.push("");
    for (const index of renderIndexes(table)) {
      statements.push(index);
    }
    statements.push("");
  }

  return `${statements.join("\n").trimEnd()}\n`;
}

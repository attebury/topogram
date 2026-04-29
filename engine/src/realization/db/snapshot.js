import { generateDbSchemaSnapshot } from "../../generator/surfaces/databases/snapshot.js";

export function buildDbSnapshotRealization(graph, options = {}) {
  return generateDbSchemaSnapshot(graph, options);
}

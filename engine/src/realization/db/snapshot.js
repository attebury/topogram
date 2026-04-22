import { generateDbSchemaSnapshot } from "../../generator/db/snapshot.js";

export function buildDbSnapshotRealization(graph, options = {}) {
  return generateDbSchemaSnapshot(graph, options);
}

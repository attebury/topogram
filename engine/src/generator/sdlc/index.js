// Dispatch for SDLC generator targets.

import { generateSdlcBoard } from "./board.js";
import { generateSdlcDocPage } from "./doc-page.js";
import { generateSdlcReleaseNotes } from "./release-notes.js";
import { generateSdlcTraceabilityMatrix } from "./traceability-matrix.js";

export function generateSdlcTarget(target, graph, options = {}) {
  switch (target) {
    case "sdlc-board":
      return generateSdlcBoard(graph, options);
    case "sdlc-doc-page":
      return generateSdlcDocPage(graph, options);
    case "sdlc-release-notes":
      return generateSdlcReleaseNotes(graph, options);
    case "sdlc-traceability-matrix":
      return generateSdlcTraceabilityMatrix(graph, options);
    default:
      throw new Error(`Unsupported SDLC target '${target}'`);
  }
}

export { generateSdlcBoard, generateSdlcDocPage, generateSdlcReleaseNotes, generateSdlcTraceabilityMatrix };

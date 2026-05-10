// @ts-check

import { IMPORT_TRACKS } from "../contracts.js";

/**
 * @param {unknown} fromValue
 * @returns {string[]}
 */
export function parseImportTracks(fromValue) {
  if (!fromValue) {
    return ["db", "api", "ui", "workflows", "verification"];
  }
  const tracks = String(fromValue).split(",").map((track) => track.trim().toLowerCase()).filter(Boolean);
  if (tracks.length === 0) {
    throw new Error("Expected --from to include at least one import track");
  }
  const invalid = tracks.filter((track) => !IMPORT_TRACKS.has(track));
  if (invalid.length > 0) {
    throw new Error(`Unsupported import track(s): ${invalid.join(", ")}`);
  }
  return [...new Set(tracks)];
}

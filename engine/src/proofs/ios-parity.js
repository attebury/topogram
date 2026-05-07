import { stableStringify } from "../format.js";
import { normalizeScreens } from "./web-parity.js";

/** Semantic fingerprint of screens slice embedded in Swift ui-surface-contract JSON (matches web normalization). */
export function fingerprintIosEmbeddedUiContract(contract) {
  return stableStringify(normalizeScreens(contract));
}

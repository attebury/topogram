// @ts-check

import { ensureTrailingNewline } from "../../../text-helpers.js";

/** @param {any[]} lines @param {string} blockName @returns {any} */
export function ensureProjectionBlock(lines, blockName) {
  const startIndex = lines.findIndex((/** @type {any} */ line) => new RegExp(`^\\s*${blockName}\\s*\\{\\s*$`).test(line));
  if (startIndex !== -1) {
    let endIndex = -1;
    for (let index = startIndex + 1; index < lines.length; index += 1) {
      if (/^\s*\}\s*$/.test(lines[index])) {
        endIndex = index;
        break;
      }
    }
    if (endIndex !== -1) {
      return { lines, startIndex, endIndex };
    }
  }
  const insertBeforeStatus = lines.findIndex((/** @type {any} */ line) => /^\s*status\s+\w+/.test(line));
  const insertIndex = insertBeforeStatus === -1 ? lines.length : insertBeforeStatus;
  const blockLines = ["", `  ${blockName} {`, "  }"];
  lines.splice(insertIndex, 0, ...blockLines);
  return {
    lines,
    startIndex: insertIndex + 1,
    endIndex: insertIndex + 2
  };
}

/** @param {any[]} lines @param {any[]} capabilityIds @returns {any} */
export function ensureProjectionRealizes(lines, capabilityIds) {
  const startIndex = lines.findIndex((/** @type {any} */ line) => /^\s*realizes\s*\[/.test(line));
  if (startIndex === -1) {
    return { changed: false, lines };
  }
  let endIndex = startIndex;
  while (endIndex < lines.length && !/\]/.test(lines[endIndex])) {
    endIndex += 1;
  }
  if (endIndex >= lines.length) {
    return { changed: false, lines };
  }
  /** @type {any[]} */
  const existingItems = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    const text = lines[index]
      .replace(/^\s*realizes\s*\[/, "")
      .replace(/\]\s*$/, "")
      .trim();
    if (!text) {
      continue;
    }
    for (const item of text.split(",").map((/** @type {any} */ entry) => entry.trim()).filter(Boolean)) {
      existingItems.push(item);
    }
  }
  const merged = [...new Set([...existingItems, ...(capabilityIds || [])])];
  if (merged.length === existingItems.length) {
    return { changed: false, lines };
  }
  const replacement = ["  realizes [", ...merged.map((/** @type {any} */ item, /** @type {any} */ index) => `    ${item}${index === merged.length - 1 ? "" : ","}`), "  ]"];
  lines.splice(startIndex, endIndex - startIndex + 1, ...replacement);
  return { changed: true, lines };
}

/** @param {string} baseContents @param {WorkflowRecord} item @returns {any} */
export function applyProjectionAuthPatchToTopogram(baseContents, item) {
  const lines = String(baseContents || "").replace(/\r\n/g, "\n").split("\n");
  const capabilities = [...new Set(item.related_capabilities || [])];
  let changed = false;

  const realizesResult = ensureProjectionRealizes(lines, capabilities);
  changed = changed || realizesResult.changed;

  if (item.projection_surface === "authorization") {
    const block = ensureProjectionBlock(lines, "authorization");
    for (const capabilityId of capabilities) {
      const lineIndex = lines.findIndex((/** @type {any} */ line, /** @type {any} */ index) =>
        index > block.startIndex &&
        index < block.endIndex &&
        new RegExp(`^\\s*${capabilityId}(\\s|$)`).test(line)
      );
      if (item.suggested_action === "apply_projection_ownership_patch") {
        const ownershipFragment = `ownership ${item.ownership}${item.ownership_field ? ` ownership_field ${item.ownership_field}` : ""}`;
        if (lineIndex !== -1) {
          if (!/\bownership\s+/.test(lines[lineIndex])) {
            lines[lineIndex] = `${lines[lineIndex].trimEnd()} ${ownershipFragment}`;
            changed = true;
          }
          continue;
        }
        lines.splice(block.endIndex, 0, `    ${capabilityId} ${ownershipFragment}`);
        block.endIndex += 1;
        changed = true;
        continue;
      }

      if (item.suggested_action === "apply_projection_permission_patch") {
        const permissionFragment = `permission ${item.permission}`;
        if (lineIndex !== -1) {
          if (!/\bpermission\s+/.test(lines[lineIndex])) {
            lines[lineIndex] = `${lines[lineIndex].trimEnd()} ${permissionFragment}`;
            changed = true;
          }
          continue;
        }
        lines.splice(block.endIndex, 0, `    ${capabilityId} ${permissionFragment}`);
        block.endIndex += 1;
        changed = true;
        continue;
      }

      const claimFragment = `claim ${item.claim}${item.claim_value != null ? ` claim_value ${item.claim_value}` : ""}`;
      if (lineIndex !== -1) {
        if (!/\bclaim\s+/.test(lines[lineIndex])) {
          lines[lineIndex] = `${lines[lineIndex].trimEnd()} ${claimFragment}`;
          changed = true;
        }
        continue;
      }
      lines.splice(block.endIndex, 0, `    ${capabilityId} ${claimFragment}`);
      block.endIndex += 1;
      changed = true;
    }
  }

  if (item.projection_surface === "visibility_rules") {
    const block = ensureProjectionBlock(lines, "visibility_rules");
    for (const capabilityId of capabilities) {
      if (item.suggested_action === "apply_projection_permission_patch") {
        const hasExistingPermissionRule = lines.some((/** @type {any} */ line, /** @type {any} */ index) =>
          index > block.startIndex &&
          index < block.endIndex &&
          new RegExp(`^\\s*action\\s+${capabilityId}\\s+visible_if\\s+permission\\s+${item.permission}(\\s|$)`).test(line)
        );
        if (hasExistingPermissionRule) {
          continue;
        }
        const hasAnyVisibilityRule = lines.some((/** @type {any} */ line, /** @type {any} */ index) =>
          index > block.startIndex &&
          index < block.endIndex &&
          new RegExp(`^\\s*action\\s+${capabilityId}\\s+visible_if\\s+`).test(line)
        );
        if (hasAnyVisibilityRule) {
          continue;
        }
        lines.splice(block.endIndex, 0, `    action ${capabilityId} visible_if permission ${item.permission}`);
        block.endIndex += 1;
        changed = true;
        continue;
      }

      const hasExistingClaimRule = lines.some((/** @type {any} */ line, /** @type {any} */ index) =>
        index > block.startIndex &&
        index < block.endIndex &&
        new RegExp(`^\\s*action\\s+${capabilityId}\\s+visible_if\\s+claim\\s+${item.claim}(\\s|$)`).test(line)
      );
      if (hasExistingClaimRule) {
        continue;
      }
      const hasAnyVisibilityRule = lines.some((/** @type {any} */ line, /** @type {any} */ index) =>
        index > block.startIndex &&
        index < block.endIndex &&
        new RegExp(`^\\s*action\\s+${capabilityId}\\s+visible_if\\s+`).test(line)
      );
      if (hasAnyVisibilityRule) {
        continue;
      }
      lines.splice(block.endIndex, 0, `    action ${capabilityId} visible_if claim ${item.claim}${item.claim_value != null ? ` claim_value ${item.claim_value}` : ""}`);
      block.endIndex += 1;
      changed = true;
    }
  }

  return changed ? ensureTrailingNewline(lines.join("\n")) : baseContents;
}

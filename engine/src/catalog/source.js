// @ts-check

import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { readGithubCatalogSourceText } from "../github-client.js";
import { remotePayloadMaxBytes } from "../remote-payload-limits.js";
import { defaultCatalogSource } from "../topogram-config.js";
import { GITHUB_TOKEN_HOSTS } from "./constants.js";
import { validateCatalog } from "./validation.js";

const FETCH_URL_SCRIPT = `
const source = process.argv[1];
const maxBytes = Number.parseInt(process.env.TOPOGRAM_FETCH_MAX_BYTES || "", 10) || 5242880;
const token = process.env.TOPOGRAM_FETCH_TOKEN || "";
const tokenHosts = new Set(["github.com", "api.github.com", "raw.githubusercontent.com"]);
function tokenAllowed(url) {
  const hostname = new URL(url).hostname.toLowerCase();
  return tokenHosts.has(hostname) || hostname.endsWith(".github.com");
}
async function readResponseText(response, url) {
  const declaredLength = Number.parseInt(response.headers.get("content-length") || "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Response from " + url + " exceeded " + maxBytes + " byte limit.");
  }
  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new Error("Response from " + url + " exceeded " + maxBytes + " byte limit.");
    }
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {}
      throw new Error("Response from " + url + " exceeded " + maxBytes + " byte limit.");
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join("");
}
async function readUrl(url, redirects = 0) {
  if (redirects > 5) {
    throw new Error("Too many redirects.");
  }
  if (process.env.TOPOGRAM_CATALOG_URL_FIXTURE_PATH) {
    const fs = await import("node:fs");
    const fixturePath = process.env.TOPOGRAM_CATALOG_URL_FIXTURE_PATH;
    const fixtureSize = fs.statSync(fixturePath).size;
    if (fixtureSize > maxBytes) {
      throw new Error("Response from " + url + " exceeded " + maxBytes + " byte limit.");
    }
    return fs.readFileSync(fixturePath, "utf8");
  }
  const headers = {};
  if (token && tokenAllowed(url)) {
    headers.authorization = "Bearer " + token;
  }
  const response = await fetch(url, { headers, redirect: "manual" });
  if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
    const next = new URL(response.headers.get("location"), url).toString();
    return readUrl(next, redirects + 1);
  }
  const text = await readResponseText(response, url);
  if (!response.ok) {
    const preview = text.trim().slice(0, 400);
    throw new Error(String(response.status) + " " + response.statusText + (preview ? "\\n" + preview : ""));
  }
  return text;
}
try {
  process.stdout.write(await readUrl(source));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
`;

/**
 * @param {string|undefined|null} source
 * @returns {string}
 */
export function catalogSourceOrDefault(source = null) {
  return source || process.env.TOPOGRAM_CATALOG_SOURCE || defaultCatalogSource();
}

/**
 * @param {string|undefined|null} source
 * @returns {boolean}
 */
export function isCatalogSourceDisabled(source) {
  const normalized = String(source || "").trim().toLowerCase();
  return normalized === "none" || normalized === "off" || normalized === "false";
}

/**
 * @param {string|undefined|null} sourceInput
 * @returns {{ source: string, catalog: any, diagnostics: any[] }}
 */
export function loadCatalog(sourceInput = null) {
  const source = catalogSourceOrDefault(sourceInput);
  if (isCatalogSourceDisabled(source)) {
    throw new Error("Catalog source is disabled.");
  }
  const text = readCatalogText(source);
  const parsed = JSON.parse(text);
  const validation = validateCatalog(parsed, source);
  if (!validation.ok || !validation.catalog) {
    throw new Error(validation.errors.join("\n") || `Catalog '${source}' is invalid.`);
  }
  return {
    source,
    catalog: validation.catalog,
    diagnostics: validation.diagnostics
  };
}

/**
 * @param {string} source
 * @returns {{ source: string, ok: boolean, catalog: any|null, diagnostics: any[], errors: string[] }}
 */
export function checkCatalogSource(source) {
  const text = readCatalogText(source);
  const parsed = JSON.parse(text);
  return {
    source,
    ...validateCatalog(parsed, source)
  };
}

/**
 * @param {string} source
 * @returns {string}
 */
function readCatalogText(source) {
  if (source.startsWith("github:")) {
    return readGithubCatalogSourceText(source);
  }
  if (source.startsWith("https://") || source.startsWith("http://")) {
    return readUrlText(source);
  }
  const resolvedPath = path.resolve(source);
  return fs.readFileSync(resolvedPath, "utf8");
}

/**
 * @param {string} source
 * @returns {string}
 */
function readUrlText(source) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  const maxBytes = remotePayloadMaxBytes(
    ["TOPOGRAM_CATALOG_FETCH_MAX_BYTES", "TOPOGRAM_REMOTE_FETCH_MAX_BYTES"],
    undefined,
    ["catalogFetchMaxBytes", "remoteFetchMaxBytes"]
  );
  const tokenEnv = token && githubTokenAllowedForCatalogUrl(source)
    ? { TOPOGRAM_FETCH_TOKEN: token }
    : {};
  const result = childProcess.spawnSync(process.execPath, ["--input-type=module", "-e", FETCH_URL_SCRIPT, source], {
    encoding: "utf8",
    maxBuffer: maxBytes + 4096,
    env: {
      ...process.env,
      ...tokenEnv,
      TOPOGRAM_FETCH_MAX_BYTES: String(maxBytes),
      PATH: process.env.PATH || ""
    }
  });
  if (result.status !== 0) {
    const reason = result.error?.message || result.stderr || result.stdout || "unknown error";
    throw new Error(`Failed to read catalog URL '${source}'.\n${reason}`.trim());
  }
  return result.stdout;
}

/**
 * @param {string} source
 * @returns {boolean}
 */
function githubTokenAllowedForCatalogUrl(source) {
  try {
    const hostname = new URL(source).hostname.toLowerCase();
    return GITHUB_TOKEN_HOSTS.has(hostname) || hostname.endsWith(".github.com");
  } catch {
    return false;
  }
}

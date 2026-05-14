// @ts-check

import childProcess from "node:child_process";

import { remotePayloadMaxBytes } from "./remote-payload-limits.js";

const DEFAULT_GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_REST_SCRIPT = `
const request = JSON.parse(process.argv[1]);
const maxBytes = Number.parseInt(String(request.maxBytes || ""), 10) || 5242880;
const base = String(request.baseUrl || "https://api.github.com").replace(/\\/+$/, "") + "/";
const path = String(request.path || "").replace(/^\\/+/, "");
const url = new URL(path, base);
for (const [key, value] of Object.entries(request.query || {})) {
  if (value === null || value === undefined || value === "") continue;
  url.searchParams.set(key, String(value));
}
function canAttachToken(urlValue) {
  const hostname = new URL(urlValue).hostname.toLowerCase();
  return hostname === "api.github.com" || hostname.endsWith(".github.com");
}
const headers = {
  accept: "application/vnd.github+json",
  "user-agent": "topogram-cli",
  "x-github-api-version": "2022-11-28"
};
if (request.token && canAttachToken(url)) {
  headers.authorization = "Bearer " + request.token;
}
async function readResponseText(response) {
  const declaredLength = Number.parseInt(response.headers.get("content-length") || "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("GitHub REST response exceeded " + maxBytes + " byte limit.");
  }
  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new Error("GitHub REST response exceeded " + maxBytes + " byte limit.");
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
      throw new Error("GitHub REST response exceeded " + maxBytes + " byte limit.");
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join("");
}
if (process.env.TOPOGRAM_GITHUB_API_FIXTURE_ROOT) {
  const fs = await import("node:fs");
  const pathModule = await import("node:path");
  const segments = path.split("/").filter(Boolean);
  if (segments.some((segment) => segment === ".." || segment.includes("\\\\") || segment.includes("\\0"))) {
    process.stderr.write("Unsafe GitHub API fixture path.");
    process.exit(1);
  }
  if (process.env.TOPOGRAM_GITHUB_API_FIXTURE_LOG) {
    fs.appendFileSync(process.env.TOPOGRAM_GITHUB_API_FIXTURE_LOG, JSON.stringify({
      path,
      search: url.search,
      tokenPresent: Boolean(request.token),
      tokenWouldAttach: Boolean(request.token && canAttachToken(url))
    }) + "\\n", "utf8");
  }
  const fixturePath = pathModule.join(process.env.TOPOGRAM_GITHUB_API_FIXTURE_ROOT, ...segments) + ".json";
  if (!fs.existsSync(fixturePath)) {
    process.stderr.write(JSON.stringify({
      status: 404,
      statusText: "Not Found",
      body: JSON.stringify({ message: "Fixture Not Found", path }),
      url: url.toString()
    }));
    process.exit(2);
  }
  const fixtureSize = fs.statSync(fixturePath).size;
  if (fixtureSize > maxBytes) {
    process.stderr.write("GitHub REST fixture response exceeded " + maxBytes + " byte limit.");
    process.exit(1);
  }
  process.stdout.write(JSON.stringify({
    status: 200,
    body: fs.readFileSync(fixturePath, "utf8"),
    url: url.toString()
  }));
  process.exit(0);
}
try {
  const response = await fetch(url, { headers });
  const text = await readResponseText(response);
  if (!response.ok) {
    process.stderr.write(JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      body: text,
      url: url.toString()
    }));
    process.exit(2);
  }
  process.stdout.write(JSON.stringify({
    status: response.status,
    body: text,
    url: url.toString()
  }));
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
`;

/**
 * @typedef {Object} GitHubCliStatus
 * @property {boolean} checked
 * @property {boolean} available
 * @property {boolean} authenticated
 * @property {string|null} reason
 */

/**
 * @typedef {Object} GitHubRun
 * @property {number|string|undefined} [databaseId]
 * @property {string|undefined} [workflowName]
 * @property {string|undefined} [status]
 * @property {string|undefined} [conclusion]
 * @property {string|undefined} [headSha]
 * @property {string|undefined} [url]
 */

/**
 * @typedef {Object} GitHubJob
 * @property {number|string|undefined} [databaseId]
 * @property {string|undefined} [name]
 * @property {string|undefined} [status]
 * @property {string|undefined} [conclusion]
 * @property {string|undefined} [url]
 */

export class GitHubClientError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number|null, statusText?: string|null, body?: string|null, url?: string|null, command?: string|null }} [details]
   */
  constructor(message, details = {}) {
    super(message);
    this.name = "GitHubClientError";
    this.status = details.status ?? null;
    this.statusText = details.statusText ?? null;
    this.body = details.body ?? null;
    this.url = details.url ?? null;
    this.command = details.command ?? null;
  }
}

/**
 * @returns {string|null}
 */
export function githubTokenFromEnv() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
}

/**
 * @returns {string}
 */
export function githubApiBaseUrl() {
  return process.env.TOPOGRAM_GITHUB_API_BASE_URL || DEFAULT_GITHUB_API_BASE_URL;
}

/**
 * @returns {boolean}
 */
function shouldUseRestApi() {
  return Boolean(githubTokenFromEnv());
}

/**
 * @param {string} path
 * @param {{ query?: Record<string, string|number|boolean|null|undefined> }} [options]
 * @returns {any}
 */
function githubRequestJson(path, options = {}) {
  const maxBytes = remotePayloadMaxBytes(
    ["TOPOGRAM_GITHUB_FETCH_MAX_BYTES", "TOPOGRAM_REMOTE_FETCH_MAX_BYTES"],
    undefined,
    ["githubFetchMaxBytes", "remoteFetchMaxBytes"]
  );
  const result = childProcess.spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    GITHUB_REST_SCRIPT,
    JSON.stringify({
      baseUrl: githubApiBaseUrl(),
      path,
      query: options.query || {},
      token: githubTokenFromEnv() || "",
      maxBytes
    })
  ], {
    encoding: "utf8",
    maxBuffer: (maxBytes * 2) + 8192,
    env: {
      ...process.env,
      PATH: process.env.PATH || ""
    }
  });
  if (result.status !== 0) {
    const error = parseRestError(result);
    throw new GitHubClientError(formatRestErrorMessage(error), error);
  }
  /** @type {any} */
  let payload = {};
  try {
    payload = JSON.parse(String(result.stdout || "{}"));
  } catch (error) {
    throw new GitHubClientError(`GitHub REST response was not valid JSON: ${messageFromError(error)}`);
  }
  const body = typeof payload.body === "string" ? payload.body : "";
  try {
    return body ? JSON.parse(body) : null;
  } catch (error) {
    throw new GitHubClientError(`GitHub REST body was not valid JSON: ${messageFromError(error)}`, {
      body,
      url: typeof payload.url === "string" ? payload.url : null
    });
  }
}

/**
 * @param {ReturnType<typeof childProcess.spawnSync>} result
 * @returns {{ status: number|null, statusText: string|null, body: string|null, url: string|null }}
 */
function parseRestError(result) {
  if (result.status === 2) {
    try {
      const payload = JSON.parse(String(result.stderr || "{}"));
      return {
        status: Number.isFinite(payload.status) ? payload.status : null,
        statusText: typeof payload.statusText === "string" ? payload.statusText : null,
        body: typeof payload.body === "string" ? payload.body : null,
        url: typeof payload.url === "string" ? payload.url : null
      };
    } catch {
      // Fall through to the generic shape below.
    }
  }
  return {
    status: null,
    statusText: null,
    body: [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n").trim() || null,
    url: null
  };
}

/**
 * @param {{ status: number|null, statusText: string|null, body: string|null, url: string|null }} error
 * @returns {string}
 */
function formatRestErrorMessage(error) {
  const status = error.status ? `${error.status}${error.statusText ? ` ${error.statusText}` : ""}` : "failed";
  const body = String(error.body || "").trim();
  return [`GitHub REST request ${status}.`, body.slice(0, 800)].filter(Boolean).join("\n");
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {string} source
 * @returns {{ owner: string, repo: string, filePath: string, ref: string|null }}
 */
export function parseGithubCatalogSource(source) {
  const spec = source.slice("github:".length);
  const [pathPart, ref] = spec.split("?ref=");
  const segments = pathPart.split("/").filter(Boolean);
  if (segments.length < 3) {
    throw new Error(`Invalid GitHub catalog source '${source}'. Expected github:owner/repo/path/to/catalog.json.`);
  }
  const [owner, repo, ...fileSegments] = segments;
  return {
    owner,
    repo,
    filePath: fileSegments.join("/"),
    ref: ref || null
  };
}

/**
 * @param {string} source
 * @returns {string}
 */
export function readGithubCatalogSourceText(source) {
  const parsed = parseGithubCatalogSource(source);
  if (shouldUseRestApi()) {
    try {
      const payload = githubRequestJson(`repos/${parsed.owner}/${parsed.repo}/contents/${parsed.filePath}`, {
        query: parsed.ref ? { ref: parsed.ref } : {}
      });
      const content = typeof payload?.content === "string" ? payload.content : "";
      return Buffer.from(content.replace(/\s+/g, ""), "base64").toString("utf8");
    } catch (error) {
      throw new Error(formatGithubCatalogError(source, error, "rest"));
    }
  }
  const result = runGh(githubCatalogGhArgs(parsed));
  if (result.status !== 0) {
    throw new Error(formatGithubCatalogError(source, result, "gh"));
  }
  return Buffer.from(String(result.stdout || "").replace(/\s+/g, ""), "base64").toString("utf8");
}

/**
 * @param {{ owner: string, repo: string, filePath: string, ref: string|null }} parsed
 * @returns {string[]}
 */
function githubCatalogGhArgs(parsed) {
  const args = ["api", `repos/${parsed.owner}/${parsed.repo}/contents/${parsed.filePath}`, "--jq", ".content"];
  if (parsed.ref) {
    args.splice(2, 0, "-f", `ref=${parsed.ref}`);
  }
  return args;
}

/**
 * @param {string} source
 * @param {unknown} error
 * @param {"rest"|"gh"} mode
 * @returns {string}
 */
function formatGithubCatalogError(source, error, mode) {
  const output = githubErrorOutput(error);
  const normalized = output.toLowerCase();
  const commandError = error && typeof error === "object" && "error" in error
    ? /** @type {{ error?: { code?: string } }} */ (error)
    : null;
  if (mode === "gh" && commandError?.error?.code === "ENOENT") {
    return [
      `GitHub CLI (gh) is required to read catalog '${source}' without GITHUB_TOKEN or GH_TOKEN.`,
      "Install gh, set GITHUB_TOKEN or GH_TOKEN, or set TOPOGRAM_CATALOG_SOURCE to a local topograms.catalog.json file."
    ].join("\n");
  }
  if (/\b(401|403)\b/.test(normalized) || normalized.includes("authentication") || normalized.includes("not logged in") || normalized.includes("forbidden")) {
    return [
      `Authentication is required to read private catalog '${source}'.`,
      "Set GITHUB_TOKEN or GH_TOKEN with repository read access, or run gh auth login as a local fallback.",
      output
    ].filter(Boolean).join("\n");
  }
  if (/\b404\b/.test(normalized) || normalized.includes("not found")) {
    return [
      `Catalog source '${source}' was not found, or the current token does not have repository access.`,
      "Check the github:owner/repo/path source and grant repository read access to the token or GitHub Actions workflow.",
      output
    ].filter(Boolean).join("\n");
  }
  return [
    `Failed to read catalog '${source}' with ${mode === "rest" ? "GitHub REST API" : "gh api"}.`,
    "Set GITHUB_TOKEN or GH_TOKEN, or run gh auth login as a local fallback.",
    output || "unknown error"
  ].join("\n");
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function githubErrorOutput(error) {
  if (error instanceof GitHubClientError) {
    return [error.message, error.body].filter(Boolean).join("\n").trim();
  }
  if (error && typeof error === "object" && ("stdout" in error || "stderr" in error || "error" in error)) {
    const result = /** @type {{ stdout?: string, stderr?: string, error?: Error }} */ (error);
    return [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n").trim();
  }
  return messageFromError(error);
}

/**
 * @param {{ repoSlug: string, branch?: string, workflowName: string, cwd?: string|null }} input
 * @returns {GitHubRun|null}
 */
export function latestWorkflowRun(input) {
  if (shouldUseRestApi()) {
    const payload = githubRequestJson(`repos/${input.repoSlug}/actions/runs`, {
      query: {
        branch: input.branch || "main",
        per_page: 50
      }
    });
    const runs = /** @type {any[]} */ (Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : []);
    const run = runs.find((candidate) => workflowRunName(candidate) === input.workflowName) || null;
    return run ? normalizeWorkflowRun(run, input.workflowName) : null;
  }
  const result = runGh([
    "run",
    "list",
    "--repo",
    input.repoSlug,
    "--branch",
    input.branch || "main",
    "--workflow",
    input.workflowName,
    "--limit",
    "1",
    "--json",
    "databaseId,workflowName,status,conclusion,headSha,url"
  ], input.cwd || undefined);
  if (result.status !== 0) {
    throw new GitHubClientError("GitHub CLI workflow run lookup failed.", {
      body: githubErrorOutput(result),
      command: "gh run list"
    });
  }
  /** @type {any[]} */
  let runs = [];
  try {
    runs = JSON.parse(String(result.stdout || "[]"));
  } catch (error) {
    throw new GitHubClientError(`GitHub CLI workflow run output was not valid JSON: ${messageFromError(error)}`, {
      body: String(result.stdout || "")
    });
  }
  return Array.isArray(runs) && runs.length > 0 ? normalizeWorkflowRun(runs[0], input.workflowName) : null;
}

/**
 * @param {any} run
 * @returns {string|null}
 */
function workflowRunName(run) {
  return typeof run?.workflowName === "string"
    ? run.workflowName
    : typeof run?.name === "string"
      ? run.name
      : null;
}

/**
 * @param {any} run
 * @param {string} fallbackWorkflowName
 * @returns {GitHubRun}
 */
function normalizeWorkflowRun(run, fallbackWorkflowName) {
  return {
    databaseId: run.databaseId ?? run.id,
    workflowName: run.workflowName || run.name || fallbackWorkflowName,
    status: run.status,
    conclusion: run.conclusion,
    headSha: run.headSha || run.head_sha,
    url: run.html_url || run.url
  };
}

/**
 * @param {{ repoSlug: string, runId: number|string, cwd?: string|null }} input
 * @returns {GitHubJob[]}
 */
export function workflowRunJobs(input) {
  if (shouldUseRestApi()) {
    const payload = githubRequestJson(`repos/${input.repoSlug}/actions/runs/${input.runId}/jobs`, {
      query: { per_page: 100 }
    });
    const jobs = /** @type {any[]} */ (Array.isArray(payload?.jobs) ? payload.jobs : []);
    return jobs.map(normalizeWorkflowJob);
  }
  const result = runGh([
    "run",
    "view",
    String(input.runId),
    "--repo",
    input.repoSlug,
    "--json",
    "jobs"
  ], input.cwd || undefined);
  if (result.status !== 0) {
    throw new GitHubClientError("GitHub CLI workflow job lookup failed.", {
      body: githubErrorOutput(result),
      command: "gh run view"
    });
  }
  /** @type {any} */
  let payload = {};
  try {
    payload = JSON.parse(String(result.stdout || "{}"));
  } catch (error) {
    throw new GitHubClientError(`GitHub CLI workflow job output was not valid JSON: ${messageFromError(error)}`, {
      body: String(result.stdout || "")
    });
  }
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  return jobs.map(normalizeWorkflowJob);
}

/**
 * @param {any} job
 * @returns {GitHubJob}
 */
function normalizeWorkflowJob(job) {
  return {
    databaseId: job.databaseId ?? job.id,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    url: job.html_url || job.url
  };
}

/**
 * @param {string[]} args
 * @param {string} [cwd]
 * @returns {ReturnType<typeof childProcess.spawnSync>}
 */
function runGh(args, cwd = process.cwd()) {
  const maxBytes = remotePayloadMaxBytes(
    ["TOPOGRAM_GITHUB_FETCH_MAX_BYTES", "TOPOGRAM_REMOTE_FETCH_MAX_BYTES"],
    undefined,
    ["githubFetchMaxBytes", "remoteFetchMaxBytes"]
  );
  return childProcess.spawnSync("gh", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: maxBytes + 4096,
    env: {
      ...process.env,
      GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "",
      PATH: process.env.PATH || ""
    }
  });
}

/**
 * @param {{ checkGh?: boolean }} [options]
 * @returns {{ githubTokenEnv: boolean, ghTokenEnv: boolean, ghCli: GitHubCliStatus }}
 */
export function githubAuthStatus(options = {}) {
  /** @type {GitHubCliStatus} */
  const ghCli = {
    checked: Boolean(options.checkGh),
    available: false,
    authenticated: false,
    reason: null
  };
  if (options.checkGh) {
    const result = runGh(["auth", "token"]);
    ghCli.available = result.error?.code !== "ENOENT";
    ghCli.authenticated = result.status === 0 && Boolean(String(result.stdout || "").trim());
    if (!ghCli.available) {
      ghCli.reason = "GitHub CLI (gh) is not installed or not on PATH.";
    } else if (!ghCli.authenticated) {
      ghCli.reason = (result.stderr || result.stdout || result.error?.message || "gh auth token failed.").trim();
    }
  }
  return {
    githubTokenEnv: Boolean(process.env.GITHUB_TOKEN),
    ghTokenEnv: Boolean(process.env.GH_TOKEN),
    ghCli
  };
}

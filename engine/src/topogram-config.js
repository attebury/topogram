// @ts-check

import fs from "node:fs";
import path from "node:path";

export const TOPOGRAM_CONFIG_FILE = "topogram.config.json";

export const DEFAULT_FIRST_PARTY_GENERATOR_REPOS = [
  "topogram-generator-express-api",
  "topogram-generator-hono-api",
  "topogram-generator-postgres-db",
  "topogram-generator-react-web",
  "topogram-generator-sqlite-db",
  "topogram-generator-sveltekit-web",
  "topogram-generator-swiftui-native",
  "topogram-generator-vanilla-web"
];

export const DEFAULT_RELEASE_CONSUMER_REPOS = [
  ...DEFAULT_FIRST_PARTY_GENERATOR_REPOS,
  "topogram-starters",
  "topogram-template-todo",
  "topogram-demo-todo",
  "topogram-hello",
  "topograms"
];

export const DEFAULT_RELEASE_CONSUMER_WORKFLOWS = {
  "topogram-generator-express-api": "Generator Verification",
  "topogram-generator-hono-api": "Generator Verification",
  "topogram-generator-postgres-db": "Generator Verification",
  "topogram-generator-react-web": "Generator Verification",
  "topogram-generator-sqlite-db": "Generator Verification",
  "topogram-generator-sveltekit-web": "Generator Verification",
  "topogram-generator-swiftui-native": "Generator Verification",
  "topogram-generator-vanilla-web": "Generator Verification",
  "topogram-starters": "Starter Verification",
  "topogram-template-todo": "Template Verification",
  "topogram-demo-todo": "Demo Verification",
  "topogram-hello": "Topogram Package Verification",
  "topograms": "Catalog Verification"
};

export const DEFAULT_RELEASE_CONSUMER_WORKFLOW_JOBS = {
  topograms: [
    "Validate catalog",
    "Smoke native starter",
    "Smoke starter alias (hello-web)",
    "Smoke starter alias (hello-api)",
    "Smoke starter alias (hello-db)",
    "Smoke starter alias (web-api)",
    "Smoke starter alias (web-api-db)"
  ]
};

export const DEFAULT_TOPOGRAM_CONFIG = {
  github: {
    owner: "attebury",
    repo: "topogram"
  },
  catalog: {
    owner: "attebury",
    repo: "topograms",
    ref: "main",
    path: "topograms.catalog.json",
    source: null
  },
  release: {
    consumers: DEFAULT_RELEASE_CONSUMER_REPOS,
    workflows: DEFAULT_RELEASE_CONSUMER_WORKFLOWS,
    workflowJobs: DEFAULT_RELEASE_CONSUMER_WORKFLOW_JOBS
  }
};

export const DEFAULT_CATALOG_SOURCE = `https://raw.githubusercontent.com/${DEFAULT_TOPOGRAM_CONFIG.catalog.owner}/${DEFAULT_TOPOGRAM_CONFIG.catalog.repo}/${DEFAULT_TOPOGRAM_CONFIG.catalog.ref}/${DEFAULT_TOPOGRAM_CONFIG.catalog.path}`;

/**
 * @typedef {Object} TopogramRuntimeConfig
 * @property {{ owner: string, repo: string }} github
 * @property {{ owner: string, repo: string, ref: string, path: string, source: string|null }} catalog
 * @property {{ consumers: string[], workflows: Record<string, string>, workflowJobs: Record<string, string[]> }} release
 */

/**
 * @param {string} cwd
 * @returns {string|null}
 */
export function findTopogramConfigFile(cwd = process.cwd()) {
  if (process.env.TOPOGRAM_CONFIG_PATH) {
    return path.resolve(process.env.TOPOGRAM_CONFIG_PATH);
  }
  let current = path.resolve(cwd);
  while (true) {
    const candidate = path.join(current, TOPOGRAM_CONFIG_FILE);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

/**
 * @param {string} cwd
 * @returns {Record<string, any>}
 */
export function readTopogramConfigFile(cwd = process.cwd()) {
  const filePath = findTopogramConfigFile(cwd);
  if (!filePath) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * @param {string|null|undefined} value
 * @returns {string[]|null}
 */
function parseListEnv(value) {
  if (!value) {
    return null;
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * @param {string|null|undefined} value
 * @returns {Record<string, any>|null}
 */
function parseJsonEnv(value) {
  if (!value) {
    return null;
  }
  return JSON.parse(value);
}

/**
 * @param {Record<string, any>} fileConfig
 * @returns {Record<string, any>}
 */
function envConfig(fileConfig = {}) {
  const consumers = parseListEnv(process.env.TOPOGRAM_RELEASE_CONSUMERS);
  const workflows = parseJsonEnv(process.env.TOPOGRAM_RELEASE_WORKFLOWS || process.env.TOPOGRAM_RELEASE_CONSUMER_WORKFLOWS_JSON);
  const workflowJobs = parseJsonEnv(process.env.TOPOGRAM_RELEASE_WORKFLOW_JOBS || process.env.TOPOGRAM_RELEASE_CONSUMER_WORKFLOW_JOBS_JSON);
  return {
    github: {
      owner: process.env.TOPOGRAM_GITHUB_OWNER || fileConfig.github?.owner,
      repo: process.env.TOPOGRAM_GITHUB_REPO || process.env.TOPOGRAM_REPO_NAME || fileConfig.github?.repo
    },
    catalog: {
      owner: process.env.TOPOGRAM_CATALOG_OWNER || fileConfig.catalog?.owner,
      repo: process.env.TOPOGRAM_CATALOG_REPO || fileConfig.catalog?.repo,
      ref: process.env.TOPOGRAM_CATALOG_REF || fileConfig.catalog?.ref,
      path: process.env.TOPOGRAM_CATALOG_PATH || fileConfig.catalog?.path,
      source: fileConfig.catalog?.source
    },
    release: {
      consumers: consumers || fileConfig.release?.consumers,
      workflows: workflows || fileConfig.release?.workflows,
      workflowJobs: workflowJobs || fileConfig.release?.workflowJobs
    }
  };
}

/**
 * @param {unknown} value
 * @param {string[]} fallback
 * @returns {string[]}
 */
function normalizeStringList(value, fallback) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const items = value.map((item) => String(item || "").trim()).filter(Boolean);
  return [...new Set(items)];
}

/**
 * @param {unknown} value
 * @param {Record<string, string>} fallback
 * @returns {Record<string, string>}
 */
function normalizeStringMap(value, fallback) {
  const output = { ...fallback };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return output;
  }
  for (const [key, item] of Object.entries(value)) {
    const name = String(key || "").trim();
    const text = String(item || "").trim();
    if (name && text) {
      output[name] = text;
    }
  }
  return output;
}

/**
 * @param {unknown} value
 * @param {Record<string, string[]>} fallback
 * @returns {Record<string, string[]>}
 */
function normalizeStringListMap(value, fallback) {
  const output = Object.fromEntries(Object.entries(fallback).map(([key, items]) => [key, [...items]]));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return output;
  }
  for (const [key, item] of Object.entries(value)) {
    const name = String(key || "").trim();
    if (!name) {
      continue;
    }
    output[name] = normalizeStringList(item, []);
  }
  return output;
}

/**
 * @param {string} cwd
 * @returns {TopogramRuntimeConfig}
 */
export function topogramRuntimeConfig(cwd = process.cwd()) {
  const fileConfig = readTopogramConfigFile(cwd);
  const overrides = envConfig(fileConfig);
  return {
    github: {
      owner: overrides.github.owner || DEFAULT_TOPOGRAM_CONFIG.github.owner,
      repo: overrides.github.repo || DEFAULT_TOPOGRAM_CONFIG.github.repo
    },
    catalog: {
      owner: overrides.catalog.owner || DEFAULT_TOPOGRAM_CONFIG.catalog.owner,
      repo: overrides.catalog.repo || DEFAULT_TOPOGRAM_CONFIG.catalog.repo,
      ref: overrides.catalog.ref || DEFAULT_TOPOGRAM_CONFIG.catalog.ref,
      path: overrides.catalog.path || DEFAULT_TOPOGRAM_CONFIG.catalog.path,
      source: overrides.catalog.source || DEFAULT_TOPOGRAM_CONFIG.catalog.source
    },
    release: {
      consumers: normalizeStringList(overrides.release.consumers, DEFAULT_TOPOGRAM_CONFIG.release.consumers),
      workflows: normalizeStringMap(overrides.release.workflows, DEFAULT_TOPOGRAM_CONFIG.release.workflows),
      workflowJobs: normalizeStringListMap(overrides.release.workflowJobs, DEFAULT_TOPOGRAM_CONFIG.release.workflowJobs)
    }
  };
}

/**
 * @param {TopogramRuntimeConfig} [config]
 * @returns {string}
 */
export function defaultCatalogSource(config = topogramRuntimeConfig()) {
  if (config.catalog.source) {
    return config.catalog.source;
  }
  return `https://raw.githubusercontent.com/${config.catalog.owner}/${config.catalog.repo}/${config.catalog.ref}/${config.catalog.path}`;
}

/**
 * @param {string|null|undefined} repo
 * @param {string} [cwd]
 * @param {string|null|undefined} owner
 * @returns {string}
 */
export function githubRepoSlug(repo, cwd = process.cwd(), owner = null) {
  const config = topogramRuntimeConfig(cwd);
  return `${owner || config.github.owner}/${repo || config.github.repo}`;
}

/**
 * @param {string} [cwd]
 * @returns {string}
 */
export function catalogRepoSlug(cwd = process.cwd()) {
  const config = topogramRuntimeConfig(cwd);
  return githubRepoSlug(config.catalog.repo, cwd, config.catalog.owner);
}

/**
 * @param {string} [cwd]
 * @returns {string[]}
 */
export function releaseConsumerRepos(cwd = process.cwd()) {
  return [...topogramRuntimeConfig(cwd).release.consumers];
}

/**
 * @param {string} name
 * @param {string} [cwd]
 * @returns {string|null}
 */
export function releaseConsumerWorkflowName(name, cwd = process.cwd()) {
  return topogramRuntimeConfig(cwd).release.workflows[name] || null;
}

/**
 * @param {string} name
 * @param {string} [cwd]
 * @returns {string[]}
 */
export function releaseConsumerWorkflowJobs(name, cwd = process.cwd()) {
  return [...(topogramRuntimeConfig(cwd).release.workflowJobs[name] || [])];
}

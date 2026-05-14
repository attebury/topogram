import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_CATALOG_SOURCE,
  catalogRepoSlug,
  defaultCatalogSource,
  githubRepoSlug,
  releaseConsumerRepos,
  releaseConsumerWorkflowJobs,
  releaseConsumerWorkflowName,
  topogramRuntimeConfig
} from "../../src/topogram-config.js";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "topogram-config-"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function withEnv(values, callback) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === undefined || values[key] === null) {
      delete process.env[key];
    } else {
      process.env[key] = String(values[key]);
    }
  }
  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("runtime config preserves current public defaults", () => {
  const root = tempRoot();
  const config = topogramRuntimeConfig(root);

  assert.equal(config.github.owner, "attebury");
  assert.equal(config.github.repo, "topogram");
  assert.equal(catalogRepoSlug(root), "attebury/topograms");
  assert.equal(defaultCatalogSource(config), DEFAULT_CATALOG_SOURCE);
  assert.equal(defaultCatalogSource(config), "https://raw.githubusercontent.com/attebury/topograms/main/topograms.catalog.json");
  assert.ok(releaseConsumerRepos(root).includes("topogram-generator-react-web"));
  assert.ok(releaseConsumerRepos(root).includes("topogram-extractor-node-cli"));
  assert.ok(releaseConsumerRepos(root).includes("topogram-extractor-react-router"));
  assert.ok(releaseConsumerRepos(root).includes("topogram-extractor-prisma-db"));
  assert.ok(releaseConsumerRepos(root).includes("topogram-extractor-express-api"));
  assert.ok(releaseConsumerRepos(root).includes("topogram-extractor-drizzle-db"));
  assert.equal(releaseConsumerWorkflowName("topogram-starters", root), "Starter Verification");
  assert.equal(releaseConsumerWorkflowName("topogram-extractor-node-cli", root), "Extractor Verification");
  assert.equal(releaseConsumerWorkflowName("topogram-extractor-react-router", root), "Extractor Verification");
  assert.equal(releaseConsumerWorkflowName("topogram-extractor-prisma-db", root), "Extractor Verification");
  assert.equal(releaseConsumerWorkflowName("topogram-extractor-express-api", root), "Extractor Verification");
  assert.equal(releaseConsumerWorkflowName("topogram-extractor-drizzle-db", root), "Extractor Verification");
  assert.equal(config.limits.remoteFetchMaxBytes, 5 * 1024 * 1024);
  assert.equal(config.limits.catalogFetchMaxBytes, null);
  assert.equal(config.limits.githubFetchMaxBytes, null);
  assert.deepEqual(releaseConsumerWorkflowJobs("topograms", root), [
    "Validate catalog",
    "Smoke native starter",
    "Smoke starter alias (hello-web)",
    "Smoke starter alias (hello-api)",
    "Smoke starter alias (hello-db)",
    "Smoke starter alias (web-api)",
    "Smoke starter alias (web-api-db)"
  ]);
});

test("runtime config reads repo-local catalog and release overrides", () => {
  const root = tempRoot();
  writeJson(path.join(root, "topogram.config.json"), {
    github: {
      owner: "example-org",
      repo: "example-cli"
    },
    catalog: {
      owner: "example-org",
      repo: "example-topograms",
      ref: "stable",
      path: "catalog/topograms.catalog.json"
    },
    release: {
      consumers: ["example-generator"],
      workflows: {
        "example-generator": "Example Verification"
      },
      workflowJobs: {
        "example-generator": ["Check package", "Compile generated app"]
      }
    },
    limits: {
      remoteFetchMaxBytes: 1024,
      catalogFetchMaxBytes: 2048,
      githubFetchMaxBytes: 4096
    }
  });

  const config = topogramRuntimeConfig(path.join(root, "nested"));
  assert.equal(config.github.owner, "example-org");
  assert.equal(config.github.repo, "example-cli");
  assert.equal(githubRepoSlug(null, root), "example-org/example-cli");
  assert.equal(githubRepoSlug("example-generator", root), "example-org/example-generator");
  assert.equal(catalogRepoSlug(root), "example-org/example-topograms");
  assert.equal(
    defaultCatalogSource(config),
    "https://raw.githubusercontent.com/example-org/example-topograms/stable/catalog/topograms.catalog.json"
  );
  assert.deepEqual(releaseConsumerRepos(root), ["example-generator"]);
  assert.equal(releaseConsumerWorkflowName("example-generator", root), "Example Verification");
  assert.deepEqual(releaseConsumerWorkflowJobs("example-generator", root), ["Check package", "Compile generated app"]);
  assert.equal(config.limits.remoteFetchMaxBytes, 1024);
  assert.equal(config.limits.catalogFetchMaxBytes, 2048);
  assert.equal(config.limits.githubFetchMaxBytes, 4096);
});

test("runtime config env overrides win over repo-local config", () => {
  const root = tempRoot();
  writeJson(path.join(root, "topogram.config.json"), {
    github: {
      owner: "file-org",
      repo: "file-cli"
    },
    release: {
      consumers: ["file-consumer"],
      workflows: {
        "file-consumer": "File Workflow"
      }
    }
  });

  withEnv({
    TOPOGRAM_GITHUB_OWNER: "env-org",
    TOPOGRAM_REPO_NAME: "env-cli",
    TOPOGRAM_CATALOG_OWNER: "env-org",
    TOPOGRAM_CATALOG_REPO: "env-catalog",
    TOPOGRAM_CATALOG_REF: "next",
    TOPOGRAM_CATALOG_PATH: "index.json",
    TOPOGRAM_RELEASE_CONSUMERS: "env-consumer, second-consumer",
    TOPOGRAM_RELEASE_CONSUMER_WORKFLOWS_JSON: JSON.stringify({
      "env-consumer": "Env Workflow"
    }),
    TOPOGRAM_RELEASE_CONSUMER_WORKFLOW_JOBS_JSON: JSON.stringify({
      "env-consumer": ["Env Job"]
    }),
    TOPOGRAM_REMOTE_FETCH_MAX_BYTES: "1234",
    TOPOGRAM_CATALOG_FETCH_MAX_BYTES: "2345",
    TOPOGRAM_GITHUB_FETCH_MAX_BYTES: "3456"
  }, () => {
    const config = topogramRuntimeConfig(root);
    assert.equal(config.github.owner, "env-org");
    assert.equal(config.github.repo, "env-cli");
    assert.equal(githubRepoSlug(null, root), "env-org/env-cli");
    assert.equal(catalogRepoSlug(root), "env-org/env-catalog");
    assert.equal(defaultCatalogSource(config), "https://raw.githubusercontent.com/env-org/env-catalog/next/index.json");
    assert.deepEqual(releaseConsumerRepos(root), ["env-consumer", "second-consumer"]);
    assert.equal(releaseConsumerWorkflowName("env-consumer", root), "Env Workflow");
    assert.deepEqual(releaseConsumerWorkflowJobs("env-consumer", root), ["Env Job"]);
    assert.equal(config.limits.remoteFetchMaxBytes, 1234);
    assert.equal(config.limits.catalogFetchMaxBytes, 2345);
    assert.equal(config.limits.githubFetchMaxBytes, 3456);
  });
});

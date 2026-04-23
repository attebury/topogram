#!/usr/bin/env node

import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const surveyRoot = path.join(repoRoot, "trials", "ui-survey");
const fixtureRoot = path.join(repoRoot, "engine", "tests", "fixtures", "ui-survey");
const manifestPath = path.join(surveyRoot, "manifest.json");
const cloneStatusPath = path.join(surveyRoot, "analysis", "clone-status.json");

function parseArgs(argv) {
  const options = {
    platforms: null,
    ids: null,
    onlyMissing: true
  };

  for (const arg of argv) {
    if (arg.startsWith("--platforms=")) {
      options.platforms = new Set(arg.slice("--platforms=".length).split(",").map((value) => value.trim()).filter(Boolean));
    } else if (arg.startsWith("--ids=")) {
      options.ids = new Set(arg.slice("--ids=".length).split(",").map((value) => value.trim()).filter(Boolean));
    } else if (arg === "--all") {
      options.onlyMissing = false;
    }
  }

  return options;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function seedSurveyRoot() {
  ensureDir(surveyRoot);
  for (const fileName of ["manifest.json", "concept-taxonomy.json"]) {
    const sourcePath = path.join(fixtureRoot, fileName);
    const destinationPath = path.join(surveyRoot, fileName);
    if (!fs.existsSync(destinationPath) && fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function removeIfEmpty(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  if (fs.readdirSync(dirPath).length === 0) {
    fs.rmdirSync(dirPath);
  }
}

function runClone(args) {
  return childProcess.spawnSync("git", args, {
    encoding: "utf8",
    cwd: repoRoot,
    env: {
      ...process.env,
      PATH: process.env.PATH || ""
    }
  });
}

function cloneRepo(url, destination, strategy) {
  const filteredArgs = ["clone", "--depth", "1", "--filter=blob:none", url, destination];
  const shallowArgs = ["clone", "--depth", "1", url, destination];
  const fullArgs = ["clone", url, destination];

  const candidates =
    strategy === "full"
      ? [fullArgs]
      : strategy === "shallow"
        ? [shallowArgs]
        : [filteredArgs, shallowArgs];

  let lastRun = null;
  for (const args of candidates) {
    lastRun = runClone(args);
    if (lastRun.status === 0) {
      return {
        ok: true,
        strategy: args.includes("--filter=blob:none") ? "shallow_filtered" : args.includes("--depth") ? "shallow" : "full",
        stdout: lastRun.stdout,
        stderr: lastRun.stderr
      };
    }
    fs.rmSync(destination, { recursive: true, force: true });
  }

  return {
    ok: false,
    strategy,
    stdout: lastRun?.stdout || "",
    stderr: lastRun?.stderr || ""
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  seedSurveyRoot();
  const manifest = readJson(manifestPath, null);
  if (!manifest || !Array.isArray(manifest.repos)) {
    throw new Error(`Expected valid survey manifest at ${manifestPath}`);
  }

  ensureDir(path.dirname(cloneStatusPath));
  const previousStatus = readJson(cloneStatusPath, { generated_at: null, repos: {} });
  const status = {
    generated_at: new Date().toISOString(),
    repos: {
      ...previousStatus.repos
    }
  };

  const selectedRepos = manifest.repos.filter((repo) => {
    if (options.platforms && !options.platforms.has(repo.platform_family)) return false;
    if (options.ids && !options.ids.has(repo.id)) return false;
    if (!options.onlyMissing) return true;
    return !fs.existsSync(path.join(surveyRoot, repo.path));
  });

  process.stdout.write(`Selected ${selectedRepos.length} survey repos for cloning.\n`);

  for (const repo of selectedRepos) {
    const destination = path.join(surveyRoot, repo.path);
    const parentDir = path.dirname(destination);
    ensureDir(parentDir);

    if (fs.existsSync(destination)) {
      status.repos[repo.id] = {
        repo: repo.repo,
        platform_family: repo.platform_family,
        status: "existing",
        path: repo.path,
        updated_at: new Date().toISOString()
      };
      process.stdout.write(`Skipping existing ${repo.id} at ${repo.path}\n`);
      continue;
    }

    process.stdout.write(`Cloning ${repo.id} from ${repo.repo}...\n`);
    const result = cloneRepo(`https://github.com/${repo.repo}.git`, destination, repo.clone_strategy);
    if (!result.ok) {
      status.repos[repo.id] = {
        repo: repo.repo,
        platform_family: repo.platform_family,
        status: "deferred",
        path: repo.path,
        attempted_strategy: repo.clone_strategy,
        updated_at: new Date().toISOString(),
        error: (result.stderr || result.stdout || "clone failed").trim().split("\n").slice(-5).join("\n")
      };
      removeIfEmpty(parentDir);
      process.stdout.write(`Deferred ${repo.id}: clone failed\n`);
      continue;
    }

    fs.rmSync(path.join(destination, ".git"), { recursive: true, force: true });
    status.repos[repo.id] = {
      repo: repo.repo,
      platform_family: repo.platform_family,
      status: "cloned",
      path: repo.path,
      strategy_used: result.strategy,
      updated_at: new Date().toISOString()
    };
    process.stdout.write(`Cloned ${repo.id} using ${result.strategy}\n`);
  }

  fs.writeFileSync(cloneStatusPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote ${cloneStatusPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

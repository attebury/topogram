#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE_PACKAGE="$ROOT_DIR/engine/package.json"
ENGINE_LOCK="$ROOT_DIR/engine/package-lock.json"

node --input-type=module - "$ENGINE_PACKAGE" "$ENGINE_LOCK" "${EXPECTED_TOPOGRAM_VERSION:-}" "${GITHUB_REF_TYPE:-}" "${GITHUB_REF_NAME:-}" <<'NODE'
import fs from "node:fs";

const [packagePath, lockPath, expectedVersion, refType, refName] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (pkg.name !== "@attebury/topogram") {
  fail(`Expected engine package name @attebury/topogram, found ${pkg.name}`);
}

const packageVersion = pkg.version;
const lockVersion = lock.version;
const lockRootVersion = lock.packages?.[""]?.version;

if (!packageVersion) {
  fail("engine/package.json is missing version");
}

if (lockVersion !== packageVersion) {
  fail(`engine/package-lock.json version ${lockVersion} does not match package version ${packageVersion}`);
}

if (lockRootVersion !== packageVersion) {
  fail(`engine/package-lock.json root package version ${lockRootVersion} does not match package version ${packageVersion}`);
}

if (expectedVersion && expectedVersion !== packageVersion) {
  fail(`Requested publish version ${expectedVersion} does not match committed package version ${packageVersion}. Run npm run release:prepare -- ${expectedVersion} and commit it first.`);
}

if (refType === "tag" && refName?.startsWith("topogram-v")) {
  const tagVersion = refName.slice("topogram-v".length);
  if (tagVersion !== packageVersion) {
    fail(`Release tag ${refName} does not match committed package version ${packageVersion}`);
  }
}

console.log(`Topogram release version check passed: ${packageVersion}`);
NODE

import assert from "node:assert/strict";
import test from "node:test";

import { parseSplitCommandArgs } from "../../src/cli/command-parser.js";

test("split command parser handles extracted command families", () => {
  assert.deepEqual(parseSplitCommandArgs(["new", "./starter", "--template", "hello-web"]), {
    newProject: true,
    inputPath: "./starter"
  });
  assert.deepEqual(parseSplitCommandArgs(["create", "./starter"]), {
    newProject: true,
    inputPath: "./starter"
  });
  assert.deepEqual(parseSplitCommandArgs(["new", "--list-templates"]), {
    templateCommand: "list",
    inputPath: null
  });
  assert.deepEqual(parseSplitCommandArgs(["generate"]), {
    generateTarget: "app-bundle",
    write: true,
    inputPath: "./topo",
    defaultOutDir: "./app"
  });
  assert.deepEqual(parseSplitCommandArgs(["generate", "./custom-topogram"]), {
    generateTarget: "app-bundle",
    write: true,
    inputPath: "./custom-topogram",
    defaultOutDir: "./app"
  });
  assert.deepEqual(parseSplitCommandArgs(["generate", "app", "./custom-topogram"]), {
    generateTarget: "app-bundle",
    write: true,
    inputPath: "./custom-topogram",
    defaultOutDir: "./app"
  });
  assert.deepEqual(parseSplitCommandArgs(["generate", "journeys", "./custom-topogram"]), {
    workflowName: "generate-journeys",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["emit", "ui-widget-contract"]), {
    generateTarget: "ui-widget-contract",
    inputPath: "./topo",
    emitArtifact: true
  });
  assert.deepEqual(parseSplitCommandArgs(["emit", "ui-widget-contract", "./custom-topogram"]), {
    generateTarget: "ui-widget-contract",
    inputPath: "./custom-topogram",
    emitArtifact: true
  });
  assert.deepEqual(parseSplitCommandArgs(["emit"]), {
    emitHelp: true,
    inputPath: null
  });
  assert.deepEqual(parseSplitCommandArgs(["version"]), { version: true, inputPath: null });
  assert.deepEqual(parseSplitCommandArgs(["--version"]), { version: true, inputPath: null });
  assert.deepEqual(parseSplitCommandArgs(["query", "list", "--json"]), { queryList: true, inputPath: null });
  assert.deepEqual(parseSplitCommandArgs(["query", "show", "widget-behavior", "--json"]), {
    queryShow: true,
    queryShowName: "widget-behavior",
    inputPath: null
  });
  assert.deepEqual(parseSplitCommandArgs(["query", "show"]), {
    queryShow: true,
    queryShowName: null,
    inputPath: null
  });
  assert.deepEqual(parseSplitCommandArgs(["query", "show", "--json"]), {
    queryShow: true,
    queryShowName: "--json",
    inputPath: null
  });
  assert.deepEqual(parseSplitCommandArgs(["query", "slice", "./custom-topogram"]), {
    queryName: "slice",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["query", "change-plan", "./custom-topogram"]), {
    queryName: "change-plan",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["query", "workflow-preset", "customize", "./custom-topogram"]), {
    workflowPresetCommand: "customize",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["workflow-preset", "customize", "./custom-topogram"]), {
    workflowPresetCommand: "customize",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["check"]), { check: true, inputPath: "./topo" });
  assert.deepEqual(parseSplitCommandArgs(["check", "./custom-topogram"]), {
    check: true,
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["validate", "./custom-topogram"]), {
    validate: true,
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["agent", "brief"]), {
    agentBrief: true,
    inputPath: "./topo"
  });
  assert.deepEqual(parseSplitCommandArgs(["agent", "brief", "./custom-topogram", "--json"]), {
    agentBrief: true,
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["widget", "check"]), {
    widgetCheck: true,
    inputPath: "./topo"
  });
  assert.deepEqual(parseSplitCommandArgs(["widget", "behavior", "./custom-topogram", "--json"]), {
    widgetBehavior: true,
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["generator", "list", "--json"]), {
    generatorCommand: "list",
    inputPath: null
  });
  assert.deepEqual(parseSplitCommandArgs(["generator", "show", "@topogram/generator-react-web"]), {
    generatorCommand: "show",
    inputPath: "@topogram/generator-react-web"
  });
  assert.deepEqual(parseSplitCommandArgs(["generator", "check", "./generator-package"]), {
    generatorCommand: "check",
    inputPath: "./generator-package"
  });
  assert.deepEqual(parseSplitCommandArgs(["generator", "policy", "init", "./custom-topogram"]), {
    generatorPolicyCommand: "init",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["generator", "policy", "status"]), {
    generatorPolicyCommand: "status",
    inputPath: "./topo"
  });
  assert.deepEqual(parseSplitCommandArgs(["generator", "policy", "check", "./custom-topogram"]), {
    generatorPolicyCommand: "check",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["generator", "policy", "explain", "./custom-topogram"]), {
    generatorPolicyCommand: "explain",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["generator", "policy", "pin", "@topogram/generator-react-web@1", "./custom-topogram"]), {
    generatorPolicyCommand: "pin",
    generatorPolicyPinSpec: "@topogram/generator-react-web@1",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["template", "list", "--json"]), {
    templateCommand: "list",
    inputPath: null
  });
  assert.deepEqual(parseSplitCommandArgs(["template", "show", "hello-web"]), {
    templateCommand: "show",
    inputPath: "hello-web"
  });
  assert.deepEqual(parseSplitCommandArgs(["template", "explain", "./custom-topogram"]), {
    templateCommand: "explain",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["template", "status"]), {
    templateCommand: "status",
    inputPath: "./topo"
  });
  assert.deepEqual(parseSplitCommandArgs(["template", "detach", "./custom-topogram", "--dry-run"]), {
    templateCommand: "detach",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["template", "policy", "init", "./custom-topogram"]), {
    templateCommand: "policy:init",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["template", "policy", "check", "./custom-topogram"]), {
    templateCommand: "policy:check",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["template", "policy", "explain", "./custom-topogram"]), {
    templateCommand: "policy:explain",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["template", "policy", "pin", "topogram/hello-web@0.1.0", "./custom-topogram"]), {
    templateCommand: "policy:pin",
    templatePolicyPinSpec: "topogram/hello-web@0.1.0",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["template", "check", "./local-template"]), {
    templateCommand: "check",
    inputPath: "./local-template"
  });
  assert.deepEqual(parseSplitCommandArgs(["template", "update", "./custom-topogram", "--recommend"]), {
    templateCommand: "update",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["source", "status", "./custom-topogram", "--local"]), {
    sourceCommand: "status",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["trust", "template", "./custom-topogram", "--force"]), {
    trustCommand: "template",
    force: true,
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["trust", "status"]), {
    trustCommand: "status",
    inputPath: "./topo"
  });
  assert.deepEqual(parseSplitCommandArgs(["trust", "diff", "./custom-topogram"]), {
    trustCommand: "diff",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["catalog", "list", "--json"]), {
    catalogCommand: "list",
    inputPath: null
  });
  assert.deepEqual(parseSplitCommandArgs(["catalog", "show", "hello-web"]), {
    catalogCommand: "show",
    inputPath: "hello-web"
  });
  assert.deepEqual(parseSplitCommandArgs(["catalog", "doctor", "./topograms.catalog.json"]), {
    catalogCommand: "doctor",
    inputPath: "./topograms.catalog.json"
  });
  assert.deepEqual(parseSplitCommandArgs(["catalog", "check", "./topograms.catalog.json"]), {
    catalogCommand: "check",
    inputPath: "./topograms.catalog.json"
  });
  assert.deepEqual(parseSplitCommandArgs(["catalog", "copy", "hello", "./target"]), {
    catalogCommand: "copy",
    catalogId: "hello",
    inputPath: "./target"
  });
  assert.deepEqual(parseSplitCommandArgs(["package", "update-cli", "0.3.63"]), {
    packageCommand: "update-cli",
    inputPath: "0.3.63"
  });
  assert.deepEqual(parseSplitCommandArgs(["package", "update-cli", "--latest"]), {
    packageCommand: "update-cli",
    inputPath: "latest"
  });
  assert.deepEqual(parseSplitCommandArgs(["release", "status", "--strict"]), {
    releaseCommand: "status",
    inputPath: null
  });
  assert.deepEqual(parseSplitCommandArgs(["release", "roll-consumers", "0.3.63", "--watch"]), {
    releaseCommand: "roll-consumers",
    releaseRollVersion: "0.3.63",
    inputPath: null
  });
  assert.deepEqual(parseSplitCommandArgs(["import", "app", "./legacy-app"]), {
    workflowName: "import-app",
    inputPath: "./legacy-app"
  });
  assert.deepEqual(parseSplitCommandArgs(["import", "docs", "./legacy-app"]), {
    workflowName: "scan-docs",
    inputPath: "./legacy-app"
  });
  assert.deepEqual(parseSplitCommandArgs(["import", "diff", "./imported-topogram"]), {
    importCommand: "diff",
    inputPath: "./imported-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["import", "refresh", "--from", "./legacy-app"]), {
    importCommand: "refresh",
    inputPath: "."
  });
  assert.deepEqual(parseSplitCommandArgs(["import", "check", "./imported-topogram"]), {
    importCommand: "check",
    inputPath: "./imported-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["import", "plan", "./imported-topogram"]), {
    importCommand: "plan",
    inputPath: "./imported-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["import", "adopt", "--list", "./imported-topogram"]), {
    importCommand: "adopt-list",
    inputPath: "./imported-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["import", "adopt", "bundle:record", "./imported-topogram"]), {
    importCommand: "adopt",
    importAdoptSelector: "bundle:record",
    inputPath: "./imported-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["import", "status", "./imported-topogram"]), {
    importCommand: "status",
    inputPath: "./imported-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["import", "history", "./imported-topogram", "--verify"]), {
    importCommand: "history",
    verify: true,
    inputPath: "./imported-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["import", "./legacy-app", "--out", "./imported-topogram"]), {
    importCommand: "workspace",
    inputPath: "./legacy-app"
  });
  assert.deepEqual(parseSplitCommandArgs(["report", "gaps", "./custom-topogram"]), {
    workflowName: "report-gaps",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["reconcile", "adopt", "bundle-x", "./custom-topogram"]), {
    workflowName: "reconcile",
    inputPath: "./custom-topogram",
    adoptValue: "bundle-x"
  });
  assert.deepEqual(parseSplitCommandArgs(["reconcile", "./custom-topogram"]), {
    workflowName: "reconcile",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["adoption", "status", "./custom-topogram"]), {
    workflowName: "adoption-status",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "transition", "task_one", "done", "./custom-topogram"]), {
    sdlcCommand: "transition",
    inputPath: "./custom-topogram",
    sdlcId: "task_one",
    sdlcTargetStatus: "done"
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "check", "--strict"]), {
    sdlcCommand: "check",
    inputPath: "."
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "policy", "explain", "./custom-topogram"]), {
    sdlcCommand: "policy:explain",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "gate", "./custom-topogram", "--base", "main", "--head", "HEAD"]), {
    sdlcCommand: "gate",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "link", "task_one", "verification_one", "./custom-topogram"]), {
    sdlcCommand: "link",
    sdlcFromId: "task_one",
    sdlcToId: "verification_one",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "complete", "task_one", "./custom-topogram", "--verification", "verification_one"]), {
    sdlcCommand: "complete",
    sdlcId: "task_one",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "plan", "create", "task_one", "implement_one", "./custom-topogram"]), {
    sdlcCommand: "plan:create",
    sdlcId: "task_one",
    sdlcSlug: "implement_one",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "plan", "explain", "plan_one", "./custom-topogram"]), {
    sdlcCommand: "plan:explain",
    sdlcId: "plan_one",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "plan", "step", "transition", "plan_one", "inspect", "done", "./custom-topogram"]), {
    sdlcCommand: "plan:step:transition",
    sdlcId: "plan_one",
    sdlcStepId: "inspect",
    sdlcTargetStatus: "done",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "plan", "step", "complete", "plan_one", "inspect", "./custom-topogram"]), {
    sdlcCommand: "plan:step:complete",
    sdlcId: "plan_one",
    sdlcStepId: "inspect",
    sdlcTargetStatus: "done",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "explain", "task_one", "--brief"]), {
    sdlcCommand: "explain",
    sdlcId: "task_one",
    inputPath: "."
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "archive", "--status", "verified"]), {
    sdlcCommand: "archive",
    inputPath: "."
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "unarchive", "bug_old", "./custom-topogram"]), {
    sdlcCommand: "unarchive",
    sdlcId: "bug_old",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "compact", "topo/_archive/tasks.jsonl"]), {
    sdlcCommand: "compact",
    sdlcArchiveFile: "topo/_archive/tasks.jsonl",
    inputPath: "."
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "new", "task", "extract-query", "./custom-topogram"]), {
    sdlcCommand: "new",
    sdlcNewKind: "task",
    sdlcNewSlug: "extract-query",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["sdlc", "adopt", "./custom-topogram"]), {
    sdlcCommand: "adopt",
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["release", "./custom-topogram"]), {
    sdlcCommand: "release",
    inputPath: "./custom-topogram"
  });
});

test("split command parser leaves unsplit command families to the legacy parser", () => {
  assert.equal(parseSplitCommandArgs(["parse", "./custom-topogram"]), null);
});

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function run() {
  const packageJson = JSON.parse(read("package.json"));
  const verifyRenderer = String(packageJson.scripts?.["verify:renderer"] || "");
  const workbenchContract = String(packageJson.scripts?.["test:workbench-contract"] || "");
  const bridgeSkill = read("assets/agent-skills/meodesk-bridge/SKILL.md");
  const runtimeContext = read("src/main/agent-runtime-context-service.js");
  const agentInterface = read("src/main/agent-interface-service.js");
  const appSource = read("src/renderer-app/src/app/App.tsx");
  const mainSource = read("src/main.js");
  const preloadSource = read("src/preload.js");
  const archiveDoc = read("docs/ui-rebuild/workflow-beta-archive-2026-07-10.md");

  const archivedRuntimePaths = [
    "scripts/workflow-agent-smoke.js",
    "scripts/workflow-bus-baseline.test.js",
    "scripts/workflow-e2e-smoke.js",
    "src/main/workflow-service.js",
    "src/renderer-app/src/features/workflow/workflow-route.tsx"
  ];
  for (const relativePath of archivedRuntimePaths) {
    assert.equal(exists(relativePath), false, relativePath + " must stay archived outside the MVP baseline.");
  }

  for (const forbidden of [
    "MEODESK_WORKFLOW_MESSAGE",
    "meodesk.workflow.message.v1",
    "Workflow Battery Mode"
  ]) {
    assert.equal(bridgeSkill.includes(forbidden), false, "Bridge skill must not advertise archived capability: " + forbidden);
    assert.equal(runtimeContext.includes(forbidden), false, "Runtime context must not advertise archived capability: " + forbidden);
    assert.equal(agentInterface.includes(forbidden), false, "Agent interface must not advertise archived capability: " + forbidden);
  }

  assert(bridgeSkill.includes("Current MVP Capability Boundary"), "Bridge skill must explain the current MVP boundary.");
  assert(bridgeSkill.includes("Only use capabilities and schemas listed in `MEODESK_RUNTIME_FILE`"), "Bridge skill must defer to runtime capabilities.");
  assert(runtimeContext.includes("meodesk-bridge skill"), "Runtime context must keep the supported bridge skill discoverable.");
  assert(agentInterface.includes("MEODESK_SKILLS_DIR/meodesk-bridge"), "Agent interface must keep the supported bridge skill discoverable.");

  for (const [label, source] of [
    ["App", appSource],
    ["main process", mainSource],
    ["preload", preloadSource]
  ]) {
    assert.equal(source.includes("WorkflowRoute"), false, label + " must not restore WorkflowRoute.");
    assert.equal(source.includes("workflow:"), false, label + " must not restore Workflow IPC channels.");
  }

  assert(archiveDoc.includes("archive/workflow-beta-2026-07-10"), "Archive branch must remain documented.");
  assert(archiveDoc.includes("workflow-beta-archive-2026-07-10"), "Archive tag must remain documented.");
  assert(archiveDoc.includes("Do not route users into Workflow Beta"), "Archive policy must prohibit active MVP routing.");

  const requiredVerifyCommands = [
    "npm run test:workbench-contract",
    "npm run test:runtime-safety",
    "npm run test:agent-lifecycle",
    "npm run test:product-shell-contract",
    "npm run test:runtime-ownership",
    "npm run test:vs-legacy-isolation"
  ];
  for (const command of requiredVerifyCommands) {
    assert(verifyRenderer.includes(command), "verify:renderer must include current MVP baseline command: " + command);
  }
  assert(workbenchContract.includes("npm run test:mvp-baseline"), "Workbench contract must compose the current MVP baseline contract.");

  const workflowScripts = Object.keys(packageJson.scripts || {}).filter((name) => name.includes("workflow"));
  assert.deepEqual(workflowScripts, [], "Active package scripts must not restore Workflow Beta commands.");

  console.log(JSON.stringify({
    ok: true,
    archivedRuntimePaths: archivedRuntimePaths.length,
    requiredVerifyCommands: requiredVerifyCommands.length,
    bridgeCapabilityAligned: true
  }));
}

run();

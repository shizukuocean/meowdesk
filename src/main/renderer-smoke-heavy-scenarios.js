"use strict";

const { runRendererSmokeRegisteredScenario } = require("./renderer-smoke-scenarios");

const rendererSmokeHeavyScenarioNames = Object.freeze([
  "r1-functions",
  "r15-r2a-functions",
  "r2-workspace-idle-visual",
  "r3-product-surfaces",
  "studio-create-draft",
  "studio-meow-viewer-shared-core",
  "workspace-output-renderer",
  "workspace-output-renderer-claude-chat",
  "workspace-output-renderer-claude-startup",
  "workspace-route-keepalive"
]);
const rendererSmokeHeavyScenarioSet = new Set(rendererSmokeHeavyScenarioNames);

async function runRendererSmokeHeavyScenario(win, scenario, dependencies = {}) {
  if (!rendererSmokeHeavyScenarioSet.has(scenario)) return undefined;
  return runRendererSmokeRegisteredScenario(win, dependencies, scenario);
}

module.exports = {
  rendererSmokeHeavyScenarioNames,
  runRendererSmokeHeavyScenario
};

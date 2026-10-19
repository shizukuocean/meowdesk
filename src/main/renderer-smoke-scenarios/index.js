"use strict";

const { workshopSmokeScenarios } = require("./workshop-scenarios");
const { shellSmokeScenarios } = require("./shell-scenarios");
const { lobbySmokeScenarios } = require("./lobby-scenarios");
const { studioBoundarySmokeScenarios } = require("./studio-boundary-scenarios");
const { agentAccessSmokeScenarios } = require("./agent-access-scenarios");
const { workspaceSmokeScenarios } = require("./workspace-scenarios");
const { productSmokeScenarios } = require("./product-scenarios");

const rendererSmokeScenarioRegistry = Object.freeze({
  ...workshopSmokeScenarios,
  ...shellSmokeScenarios,
  ...lobbySmokeScenarios,
  ...studioBoundarySmokeScenarios,
  ...agentAccessSmokeScenarios,
  ...workspaceSmokeScenarios,
  ...productSmokeScenarios,
});

const rendererSmokeScenarioNames = Object.freeze(Object.keys(rendererSmokeScenarioRegistry).sort());

async function runRendererSmokeRegisteredScenario(win, dependencies = {}, scenario) {
  const handler = rendererSmokeScenarioRegistry[scenario];
  if (!handler) {
    throw new Error(`Unknown renderer smoke scenario: ${scenario}`);
  }
  return handler(win, dependencies, scenario);
}

module.exports = {
  rendererSmokeScenarioNames,
  rendererSmokeScenarioRegistry,
  runRendererSmokeRegisteredScenario
};

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const runnerPath = path.join(repoRoot, "src", "main", "renderer-smoke-runner.js");
const heavyPath = path.join(repoRoot, "src", "main", "renderer-smoke-heavy-scenarios.js");
const scenarioDir = path.join(repoRoot, "src", "main", "renderer-smoke-scenarios");
const {
  rendererSmokeScenarioNames,
  rendererSmokeScenarioRegistry
} = require("../src/main/renderer-smoke-scenarios");

function lineCount(filePath) {
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).length;
}

function smokeScriptScenarios() {
  const scripts = packageJson.scripts || {};
  const scenarios = new Set();
  Object.entries(scripts).forEach(([name, command]) => {
    if (!name.startsWith("smoke:renderer:")) return;
    const match = String(command).match(/--scenario\s+([^\s&]+)/);
    if (match) scenarios.add(match[1]);
  });
  return Array.from(scenarios).sort();
}

assert.ok(fs.existsSync(scenarioDir), "renderer smoke scenario directory exists");
assert.ok(rendererSmokeScenarioNames.length >= 30, "renderer smoke registry keeps broad scenario coverage");
assert.deepStrictEqual(
  rendererSmokeScenarioNames,
  Object.keys(rendererSmokeScenarioRegistry).sort(),
  "scenario names mirror registry keys"
);

smokeScriptScenarios().forEach((scenarioName) => {
  assert.ok(
    rendererSmokeScenarioRegistry[scenarioName],
    `package smoke script scenario is registered: ${scenarioName}`
  );
});

assert.ok(
  !fs.readFileSync(runnerPath, "utf8").includes("if (scenario ==="),
  "renderer smoke runner stays dispatch-only"
);
assert.ok(lineCount(runnerPath) < 120, "renderer smoke runner stays compact");
assert.ok(lineCount(heavyPath) < 120, "heavy scenario compatibility wrapper stays compact");

console.log(`Renderer smoke registry coverage OK (${rendererSmokeScenarioNames.length} scenarios).`);

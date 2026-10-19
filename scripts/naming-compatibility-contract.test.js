"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function assertIncludes(source, needle, message) {
  assert(source.includes(needle), message);
}

function run() {
  const packageJson = JSON.parse(read("package.json"));
  const mainSource = read("src/main.js");
  const homeSource = read("src/main/meodesk-home-service.js");
  const agentInterfaceSource = read("src/main/agent-interface-service.js");
  const workshopSource = read("src/main/workshop-service.js");

  assert.equal(packageJson.name, "meowdesk", "package name should use the current product spelling.");
  assert.match(mainSource, /app\.setName\(["']Meowdesk["']\)/, "Electron display name should use Meowdesk.");
  assert.doesNotMatch(mainSource, /app\.setName\(["']Meodesk["']\)/, "Electron display name must not regress to legacy Meodesk.");

  assertIncludes(homeSource, 'const MEODESK_HOME_DIR_NAME = "Meodesk Home"', "Legacy Meodesk Home directory name is a protected data path.");
  assertIncludes(homeSource, 'type: "meodesk-home"', "Legacy meodesk-home manifest type is a protected data contract.");
  assertIncludes(homeSource, "MEODESK_*", "Generated Home README should explain MEODESK_* compatibility.");
  assertIncludes(homeSource, "meodesk.*", "Generated Home README should explain meodesk.* compatibility.");
  assertIncludes(homeSource, "用户可见产品名采用 Meowdesk", "Generated Home README should name Meowdesk as the user-visible product.");

  for (const [sourceName, source] of [
    ["agent-interface-service", agentInterfaceSource],
    ["workshop-service", workshopSource]
  ]) {
    assertIncludes(source, "meodesk.meow.package.v0", `${sourceName} should keep the legacy .meow package schema id.`);
    assertIncludes(source, "meodesk.extension.manifest.v0", `${sourceName} should keep the legacy extension manifest schema id.`);
    assertIncludes(source, "meodesk.theme.v0", `${sourceName} should keep the legacy theme token protocol id.`);
  }

  assertIncludes(agentInterfaceSource, "MEODESK_RUNTIME_FILE", "MEODESK_* Agent environment variables remain the compatibility protocol.");
  assertIncludes(agentInterfaceSource, "MEODESK_EXTENSIONS_DIR", "MEODESK_* workshop environment variables remain the compatibility protocol.");
  assertIncludes(workshopSource, "MEODESK_PROJECT.md", "Existing workshop project file names remain compatible.");
  assertIncludes(workshopSource, "MEODESK_PACKAGE.md", "Existing workshop package file names remain compatible.");

  console.log(JSON.stringify({
    ok: true,
    displayName: "Meowdesk",
    protectedCompatibilityNames: [
      "Meodesk Home",
      "meodesk-home",
      "MEODESK_*",
      "meodesk.*",
      "MEODESK_PROJECT.md",
      "MEODESK_PACKAGE.md"
    ]
  }));
}

run();

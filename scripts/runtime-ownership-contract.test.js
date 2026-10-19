const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");

const repoRoot = path.resolve(__dirname, "..");
const identityPath = path.join(repoRoot, "src", "renderer-app", "src", "lib", "identity.ts");
const runtimeManagerPath = path.join(
  repoRoot,
  "src",
  "renderer-app",
  "src",
  "features",
  "agent-runtime",
  "agent-runtime-manager.ts"
);

function transpileTs(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove
    }
  }).outputText;
}

function loadIdentity() {
  const module = { exports: {} };
  const context = {
    exports: module.exports,
    module,
    require(id) {
      throw new Error(`Identity contract should not require runtime modules: ${id}`);
    }
  };
  vm.runInNewContext(transpileTs(identityPath), context, {
    filename: identityPath,
    displayErrors: true
  });
  return module.exports;
}

function loadRuntimeManager(identity) {
  const module = { exports: {} };
  const context = {
    exports: module.exports,
    module,
    require(id) {
      if (id === "@/lib/identity") return identity;
      if (id === "@/lib/workbench-api") {
        return {
          killTerminalSession() {},
          listAgentRuntimeDescriptors() { return []; },
          onTerminalData() { return () => {}; },
          onTerminalExit() { return () => {}; },
          resizeTerminalSession() {},
          setTerminalSourceAdapter() { return { active: false }; },
          startTerminalSession() { return { ok: true }; },
          writeTerminalSession() {}
        };
      }
      throw new Error(`Unexpected runtime ownership contract import: ${id}`);
    }
  };
  vm.runInNewContext(transpileTs(runtimeManagerPath), context, {
    filename: runtimeManagerPath,
    displayErrors: true
  });
  return module.exports;
}

function assert(condition, message, detail) {
  if (!condition) {
    throw new Error(`${message}${detail ? `: ${JSON.stringify(detail)}` : ""}`);
  }
}

function main() {
  const identity = loadIdentity();
  const runtimeManager = loadRuntimeManager(identity);
  const { createRuntimeOwnershipScope, DEFAULT_PROJECT_ID } = identity;
  const { ownershipMatches } = runtimeManager.__runtimeOwnershipContract;

  assert(typeof createRuntimeOwnershipScope === "function", "Missing createRuntimeOwnershipScope export");
  assert(typeof ownershipMatches === "function", "Missing ownershipMatches contract export");

  const prefixedProject = createRuntimeOwnershipScope({
    surfaceKind: "studio-agent",
    surfaceLocalId: "workshop-agent",
    sessionId: "studio-claude",
    projectId: "project:local-workbench"
  });
  assert(prefixedProject.projectId === "project:local-workbench", "Prefixed project id must not be double-prefixed", prefixedProject);

  const bareProject = createRuntimeOwnershipScope({
    surfaceKind: "studio-agent",
    surfaceLocalId: "workshop-agent",
    sessionId: "studio-claude",
    projectId: "Local Workbench"
  });
  assert(bareProject.projectId === "project:local-workbench", "Bare project id should normalize to a single project prefix", bareProject);

  const defaultProject = createRuntimeOwnershipScope({
    surfaceKind: "workspace-pane",
    surfaceLocalId: "left",
    sessionId: "workspace-left"
  });
  assert(defaultProject.projectId === DEFAULT_PROJECT_ID, "Missing project id should use the default project", defaultProject);

  const expected = {
    surfaceId: "surface:workspace-pane:left",
    conversationId: "conversation:workspace-pane:left:workspace-left",
    projectId: "project:local-workbench"
  };
  assert(
    ownershipMatches({
      surfaceId: expected.surfaceId,
      conversationId: expected.conversationId,
      projectId: expected.projectId,
      sourceId: "source:workspace-left"
    }, expected),
    "Exact ownership fields should match"
  );
  assert(
    !ownershipMatches({
      surfaceId: expected.surfaceId,
      projectId: expected.projectId
    }, expected),
    "Events missing an expected ownership field must not match"
  );
  assert(
    !ownershipMatches({
      surfaceId: "surface:studio-agent:workshop-agent",
      conversationId: expected.conversationId,
      projectId: expected.projectId
    }, expected),
    "Different ownership field values must not match"
  );

  console.log(JSON.stringify({
    ok: true,
    prefixedProjectId: prefixedProject.projectId,
    bareProjectId: bareProject.projectId,
    strictMissingFieldMatch: false
  }));
}

main();

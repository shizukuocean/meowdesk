const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { createTerminalRuntimeService } = require("../src/main/terminal-runtime-service");

function testMainSingleInstanceContract() {
  const mainPath = path.join(__dirname, "..", "src", "main.js");
  const source = fs.readFileSync(mainPath, "utf8");
  const userDataIndex = source.indexOf('app.setPath("userData"');
  const lockIndex = source.indexOf("app.requestSingleInstanceLock");

  assert.ok(lockIndex >= 0, "main process must request a single instance lock.");
  assert.ok(userDataIndex >= 0 && userDataIndex < lockIndex, "single instance lock must use the final userData path.");
  assert.ok(source.includes("let mainWindow = null;"), "main process must keep a primary window reference.");
  assert.ok(source.includes('app.on("second-instance"'), "second-instance must be handled.");
  assert.ok(source.includes("focusExistingWindow"), "second-instance must focus the existing window.");
  assert.ok(source.includes("win.restore()"), "second-instance focus must restore minimized windows.");
  assert.ok(source.includes("win.show()"), "second-instance focus must show hidden windows.");
  assert.ok(source.includes("win.focus()"), "second-instance focus must focus the window.");
  assert.match(
    source,
    /app\.whenReady\(\)\.then\(\(\) => \{\s*if \(!hasSingleInstanceLock\) return;\s*createWindow\(\);/s,
    "window creation must be guarded when another instance already owns the lock."
  );
  assert.ok(source.includes('win.on("closed"'), "closed windows must clear the primary window reference.");
  assert.ok(source.includes('app.on("before-quit"'), "before-quit must be part of the runtime cleanup path.");
  assert.ok(source.includes('app.on("window-all-closed"'), "window-all-closed must be part of the runtime cleanup path.");
}

function createMockRuntimeService(options = {}) {
  const spawned = [];
  const sent = [];
  const sourceAdapterStarts = [];
  const sourceAdapterStops = [];
  const prepared = [];
  const killed = [];
  let spawnCount = 0;

  const service = createTerminalRuntimeService({
    pty: {
      spawn: (command, args, spawnOptions) => {
        spawnCount += 1;
        if (options.throwOnSpawn) throw new Error("spawn boom");
        const shell = {
          id: `shell-${spawnCount}`,
          onDataHandler: null,
          onExitHandler: null,
          onData(handler) {
            this.onDataHandler = handler;
          },
          onExit(handler) {
            this.onExitHandler = handler;
          },
          kill() {
            killed.push(this.id);
            if (options.throwOnKill) throw new Error("kill boom");
          },
          write() {},
          resize() {}
        };
        spawned.push({ command, args, spawnOptions, shell });
        return shell;
      }
    },
    BrowserWindow: { fromWebContents: () => ({ id: "fallback-win", isDestroyed: () => false }) },
    resolveToolCwd: () => "C:\\work",
    prepareAgentRuntime: (sessionId, tool, cwd, runtimeOptions) => {
      prepared.push({ sessionId, tool, cwd, runtimeOptions });
      return { sessionId };
    },
    meodeskRuntimeEnv: () => ({}),
    withWorkshopRuntimeArgs: (_command, args) => args,
    withWslRuntimeArgs: (_command, args) => args,
    launchCommandSpec: (command, args) => ({ command, args, resolved: command }),
    packagedAgentResourceBlockReason: () => "",
    normalizeTerminalSpawnDimension: (value, fallback) => Number(value) || fallback,
    sendTerminalEvent: (_win, channel, payload) => sent.push({ channel, payload }),
    recordTerminalSourceAdapterInput: () => {},
    startTerminalSourceAdapter: (...args) => {
      sourceAdapterStarts.push(args);
      if (options.throwOnSourceAdapterStart) throw new Error("source adapter boom");
    },
    stopTerminalSourceAdapter: (id) => sourceAdapterStops.push(id),
    isQuitting: () => false
  });

  return { service, spawned, sent, sourceAdapterStarts, sourceAdapterStops, prepared, killed };
}

function runtimeTool(overrides = {}) {
  return {
    id: "known-tool",
    name: "Known Tool",
    command: "node",
    args: ["--version"],
    cwd: ".",
    ...overrides
  };
}

function runtimeWindow() {
  return { id: "win", isDestroyed: () => false };
}

function testDuplicateStartReusesExistingRuntime() {
  const { service, spawned, killed } = createMockRuntimeService();

  const first = service.spawnTerminal(runtimeWindow(), "runtime-key", runtimeTool(), {
    ownership: { runtimeId: "runtime:one", sessionId: "session:one" }
  });
  const second = service.spawnTerminal(runtimeWindow(), "runtime-key", runtimeTool(), {
    ownership: { runtimeId: "runtime:one", sessionId: "session:one" }
  });

  assert.equal(first.ok, true);
  assert.deepEqual(second, { ok: true, active: true, reused: true, sessionId: "runtime-key" });
  assert.equal(spawned.length, 1, "duplicate start without replaceExisting must not spawn a second process.");
  assert.deepEqual(killed, [], "duplicate start without replaceExisting must not kill the active process.");
  assert.equal(service.runtimeDescriptors().length, 1);
}

function testReplaceExistingRuntimeKillsOldSession() {
  const { service, spawned, killed, sourceAdapterStops } = createMockRuntimeService();

  service.spawnTerminal(runtimeWindow(), "runtime-key", runtimeTool({ id: "old-tool" }), {
    ownership: { runtimeId: "runtime:old", sessionId: "session:old" }
  });
  const result = service.spawnTerminal(runtimeWindow(), "runtime-key", runtimeTool({ id: "new-tool", replaceExisting: true }), {
    ownership: { runtimeId: "runtime:new", sessionId: "session:new" }
  });

  assert.equal(result.ok, true);
  assert.equal(result.replaced, true);
  assert.deepEqual(killed, ["shell-1"]);
  assert.deepEqual(sourceAdapterStops, ["runtime-key"]);
  assert.equal(spawned.length, 2);
  assert.equal(service.runtimeDescriptors().length, 1);
  assert.equal(service.runtimeDescriptors()[0].toolId, "new-tool");
  assert.equal(service.runtimeDescriptors()[0].runtimeId, "runtime:new");
}

function testKillRuntimeIsIdempotent() {
  const { service, killed, sourceAdapterStops } = createMockRuntimeService();

  service.spawnTerminal(runtimeWindow(), "runtime-key", runtimeTool(), {
    ownership: { runtimeId: "runtime:one", sessionId: "session:one" }
  });
  const first = service.killTerminalById("runtime-key");
  const second = service.killTerminalById("runtime-key");

  assert.equal(first.ok, true);
  assert.equal(first.killed, true);
  assert.equal(second.ok, true);
  assert.equal(second.killed, false);
  assert.deepEqual(killed, ["shell-1"]);
  assert.deepEqual(sourceAdapterStops, ["runtime-key"]);
  assert.equal(service.runtimeDescriptors().length, 0);
}

function testKillAllRuntimeCleansEverySession() {
  const { service, killed } = createMockRuntimeService();

  service.spawnTerminal(runtimeWindow(), "runtime-a", runtimeTool({ id: "tool-a" }), {
    ownership: { runtimeId: "runtime:a" }
  });
  service.spawnTerminal(runtimeWindow(), "runtime-b", runtimeTool({ id: "tool-b" }), {
    ownership: { runtimeId: "runtime:b" }
  });
  const result = service.killAllTerminals();

  assert.deepEqual(result, { ok: true, active: false, count: 2 });
  assert.deepEqual(killed, ["shell-1", "shell-2"]);
  assert.equal(service.runtimeDescriptors().length, 0);
}

function testSpawnFailureLeavesNoRuntimeDescriptor() {
  const { service, prepared } = createMockRuntimeService({ throwOnSpawn: true });

  assert.throws(() => {
    service.spawnTerminal(runtimeWindow(), "runtime-key", runtimeTool(), {
      ownership: { runtimeId: "runtime:failed" }
    });
  }, /spawn boom/);
  assert.equal(prepared.length, 1, "runtime context may be prepared before pty spawn is attempted.");
  assert.equal(service.runtimeDescriptors().length, 0, "failed pty spawn must not leave reattachable metadata.");
}

function testSourceAdapterFailureRollsBackRuntime() {
  const { service, spawned, killed, sourceAdapterStarts, sourceAdapterStops } = createMockRuntimeService({
    throwOnSourceAdapterStart: true
  });

  assert.throws(() => {
    service.spawnTerminal(runtimeWindow(), "runtime-key", runtimeTool(), {
      sourceAdapter: true,
      ownership: { runtimeId: "runtime:adapter-failed" }
    });
  }, /source adapter boom/);

  assert.equal(sourceAdapterStarts.length, 1);
  assert.deepEqual(sourceAdapterStops, ["runtime-key"]);
  assert.deepEqual(killed, ["shell-1"]);
  assert.equal(spawned.length, 1);
  assert.equal(service.runtimeDescriptors().length, 0, "partial source adapter setup must not leave runtime metadata.");
}

function main() {
  testMainSingleInstanceContract();
  testDuplicateStartReusesExistingRuntime();
  testReplaceExistingRuntimeKillsOldSession();
  testKillRuntimeIsIdempotent();
  testKillAllRuntimeCleansEverySession();
  testSpawnFailureLeavesNoRuntimeDescriptor();
  testSourceAdapterFailureRollsBackRuntime();
  console.log(JSON.stringify({
    ok: true,
    checked: [
      "main process single instance lock",
      "second-instance focuses existing window",
      "duplicate runtime start reuses active session",
      "replaceExisting kills old session before restart",
      "terminal kill is idempotent",
      "killAll clears every runtime",
      "pty spawn failure leaves no runtime descriptor",
      "source adapter setup failure rolls back runtime"
    ]
  }));
}

main();

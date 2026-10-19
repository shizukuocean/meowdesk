const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createRuntimePermissionService } = require("../src/main/runtime-permission-service");
const {
  createTerminalSourceAdapterService,
  __test: terminalSourceAdapterTest
} = require("../src/main/terminal-source-adapter-service");
const { createCommandResolver } = require("../src/main/command-resolver");
const { createTerminalRuntimeService } = require("../src/main/terminal-runtime-service");
const { createTerminalStartHandler } = require("../src/main/terminal-start-policy");
const { createWorkshopService } = require("../src/main/workshop-service");

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFileIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) return;
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "meowdesk-runtime-safety-"));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function claudeProjectFolderNameForTest(cwd) {
  return path.resolve(cwd || ".")
    .replace(/[:\\/]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function expectReject(label, action, pattern) {
  try {
    await action();
  } catch (error) {
    assert.match(String(error?.message || error), pattern, label);
    return;
  }
  throw new Error(`${label} should reject.`);
}

function withProcessEnv(overrides, action) {
  const original = {};
  for (const [key, value] of Object.entries(overrides)) {
    original[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return action();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function makePackageObject(overrides = {}) {
  return {
    schema: "meodesk.meow.package.v0",
    kind: "meodesk-extension-package",
    package: {
      id: "safe-widget",
      name: "Safe Widget",
      type: "sidebar-widget",
      target: "workspace-sidebar",
      version: "0.1.0"
    },
    manifest: {
      id: "safe-widget",
      name: "Safe Widget",
      type: "sidebar-widget",
      target: "workspace-sidebar",
      runtime: "meodesk-sidebar-widget",
      entry: "index.html",
      version: "0.1.0"
    },
    files: [
      {
        path: "index.html",
        encoding: "utf8",
        content: "<!doctype html><title>safe</title>"
      }
    ],
    ...overrides
  };
}

async function testRuntimePermissionService() {
  const root = makeTempRoot();
  try {
    const home = path.join(root, "Meodesk Home");
    const vault = path.join(root, "vault");
    const outside = path.join(root, "outside");
    ensureDirectory(home);
    ensureDirectory(vault);
    ensureDirectory(outside);
    const homeFile = path.join(home, "inside.txt");
    const vaultNote = path.join(vault, "note.md");
    const vaultText = path.join(vault, "secret.txt");
    const outsideNote = path.join(outside, "outside.md");
    fs.writeFileSync(homeFile, "inside");
    fs.writeFileSync(vaultNote, "# Note\nbody");
    fs.writeFileSync(vaultText, "not markdown");
    fs.writeFileSync(outsideNote, "# Outside");

    const shellCalls = [];
    const service = createRuntimePermissionService({
      meodeskHomePath: (...parts) => path.join(home, ...parts),
      openWindowsAppsFolderTarget: (target) => {
        shellCalls.push(["apps-folder", target]);
        return true;
      },
      readStorageJson: () => ({ value: "" }),
      scanObsidianVault: async (vaultPath) => ({ path: vaultPath, files: [] }),
      shell: {
        openExternal: (target) => {
          shellCalls.push(["external", target]);
          return true;
        },
        openPath: (target) => {
          shellCalls.push(["path", target]);
          return "";
        }
      }
    });

    await expectReject("empty external target", () => service.openExternalTarget(""), /required/);
    await expectReject("file protocol external target", () => service.openExternalTarget(`file:///${outsideNote.replace(/\\/g, "/")}`), /Blocked external protocol: file:/);
    assert.equal(service.openExternalTarget("https://example.com"), true);
    assert.deepEqual(shellCalls.at(-1), ["external", "https://example.com"]);

    assert.equal(service.resolveOpenPathTarget(homeFile), fs.realpathSync(homeFile));
    await expectReject("openPath outside trusted roots", () => service.resolveOpenPathTarget(outsideNote), /limited to Meodesk Home/);

    await service.scanTrustedObsidianVault(vault);
    assert.equal(service.resolveOpenPathTarget(vaultNote), fs.realpathSync(vaultNote));
    const note = service.readTrustedObsidianNote(vaultNote);
    assert.equal(note.raw, "# Note\nbody");
    await expectReject("obsidian rejects non-markdown", () => service.readTrustedObsidianNote(vaultText), /Only markdown/);
    await expectReject("obsidian rejects outside vault", () => service.readTrustedObsidianNote(outsideNote), /outside the selected Obsidian vault/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function testWorkshopPackageSafety() {
  const root = makeTempRoot();
  try {
    const home = path.join(root, "Meodesk Home");
    const outside = path.join(root, "outside-install");
    ensureDirectory(home);
    ensureDirectory(outside);
    const service = createWorkshopService({
      ensureDirectory,
      invalidateAgentInterfaceCache: () => {},
      meodeskHomePath: (...parts) => path.join(home, ...parts),
      showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
      writeFileIfMissing
    });

    const validPackagePath = path.join(root, "valid.meow");
    fs.writeFileSync(validPackagePath, `${JSON.stringify(makePackageObject(), null, 2)}\n`);
    const validInstall = await service.importWorkshopPackage({ packagePath: validPackagePath, testInstall: true });
    assert.equal(validInstall.ok, true);
    assert.ok(validInstall.project.path.startsWith(path.join(home, "install-tests")));

    await expectReject(
      "official import rejects external targetPath",
      () => service.importWorkshopPackage({ packagePath: validPackagePath, targetPath: outside }),
      /extensions/
    );
    await expectReject(
      "test install rejects external targetPath",
      () => service.importWorkshopPackage({ packagePath: validPackagePath, testInstall: true, targetPath: outside }),
      /install-tests/
    );

    const traversalPackagePath = path.join(root, "traversal.meow");
    fs.writeFileSync(traversalPackagePath, `${JSON.stringify(makePackageObject({
      files: [{ path: "../escape.txt", encoding: "utf8", content: "escape" }]
    }), null, 2)}\n`);
    await expectReject(
      "package files reject traversal paths",
      () => service.importWorkshopPackage({ packagePath: traversalPackagePath, testInstall: true }),
      /非法路径/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function testTerminalStartPolicy() {
  const spawned = [];
  const handler = createTerminalStartHandler({
    BrowserWindow: { fromWebContents: () => ({ id: "win" }) },
    loadConfig: () => ({
      tools: [{ id: "known-tool", name: "Known Tool", command: "node", args: ["--version"], cwd: "." }]
    }),
    normalizeTerminalSessionTool: (tool, override) => ({ ...tool, overrideSeen: Boolean(override) }),
    spawnTerminal: (...args) => spawned.push(args)
  });
  const event = { sender: {} };

  await expectReject("terminal rejects unknown tool", () => handler(event, { toolId: "missing", sessionId: "s1" }), /Unknown tool: missing/);
  await expectReject("terminal rejects missing session", () => handler(event, { toolId: "known-tool" }), /Missing terminal session id/);
  assert.equal(handler(event, { toolId: "known-tool", sessionId: "s1", sourceAdapter: true }), true);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0][1], "s1");
  assert.equal(spawned[0][3].sourceAdapter, true);
  assert.deepEqual(spawned[0][3].ownership, { sessionId: "s1" });
  assert.equal(handler(event, {
    toolId: "known-tool",
    sessionId: "runtime-key",
    ownership: {
      runtimeId: "runtime:workspace",
      sessionId: "session:workspace",
      surfaceId: "surface:workspace",
      conversationId: "conversation:workspace",
      agentId: "agent:claude",
      sourceId: "source:workspace",
      projectId: "project:local"
    }
  }), true);
  assert.deepEqual(spawned[1][3].ownership, {
    runtimeId: "runtime:workspace",
    sessionId: "session:workspace",
    surfaceId: "surface:workspace",
    conversationId: "conversation:workspace",
    agentId: "agent:claude",
    sourceId: "source:workspace",
    projectId: "project:local"
  });
}

async function testCommandResolverWindowsNpmShimFallback() {
  if (process.platform !== "win32") return;
  const root = makeTempRoot();
  try {
    const npmShimDir = path.join(root, "npm");
    ensureDirectory(npmShimDir);
    const claudeShim = path.join(npmShimDir, "claude.cmd");
    fs.writeFileSync(claudeShim, "@echo off\r\nnode --version\r\n");
    const resolver = createCommandResolver({
      appDir: root,
      readWindowsPathRegistryValues: () => [],
      windowsNpmShimDirs: () => [npmShimDir]
    });
    const resolved = withProcessEnv({
      PATH: "C:\\Windows\\system32",
      Path: undefined,
      PATHEXT: ".COM;.EXE;.BAT;.CMD"
    }, () => resolver.resolveCommandPath("claude", root));
    assert.equal(resolved, claudeShim);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function testCommandResolverPrefersWindowsNpmShimOverAppAlias() {
  if (process.platform !== "win32") return;
  const root = makeTempRoot();
  try {
    const windowsAppsDir = path.join(root, "Users", "me", "AppData", "Local", "Microsoft", "WindowsApps");
    const npmShimDir = path.join(root, "Users", "me", "AppData", "Roaming", "npm");
    ensureDirectory(windowsAppsDir);
    ensureDirectory(npmShimDir);
    const windowsAlias = path.join(windowsAppsDir, "claude.exe");
    const claudeShim = path.join(npmShimDir, "claude.cmd");
    fs.writeFileSync(windowsAlias, "");
    fs.writeFileSync(claudeShim, "@echo off\r\nnode --version\r\n");
    const resolver = createCommandResolver({
      appDir: root,
      readWindowsPathRegistryValues: () => [windowsAppsDir],
      windowsNpmShimDirs: () => [npmShimDir]
    });
    const resolved = withProcessEnv({
      PATH: windowsAppsDir,
      Path: undefined,
      PATHEXT: ".COM;.EXE;.BAT;.CMD"
    }, () => resolver.resolveCommandPath("claude", root));
    assert.equal(resolved, claudeShim);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function testCommandResolverBlocksWindowsAppAliasAgentCommand() {
  if (process.platform !== "win32") return;
  const root = makeTempRoot();
  try {
    const windowsAppsDir = path.join(root, "Users", "me", "AppData", "Local", "Microsoft", "WindowsApps");
    ensureDirectory(windowsAppsDir);
    const windowsAlias = path.join(windowsAppsDir, "claude.exe");
    fs.writeFileSync(windowsAlias, "");
    const resolver = createCommandResolver({
      appDir: root,
      readWindowsPathRegistryValues: () => [windowsAppsDir],
      windowsNpmShimDirs: () => []
    });
    const resolved = withProcessEnv({
      PATH: windowsAppsDir,
      Path: undefined,
      PATHEXT: ".COM;.EXE;.BAT;.CMD"
    }, () => resolver.resolveCommandPath("claude", root));
    assert.equal(resolved, windowsAlias);
    assert.match(
      resolver.packagedAgentResourceBlockReason("claude", resolved),
      /Windows 应用执行别名或桌面应用包/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function testTerminalRuntimeRejectsUnresolvedCommandBeforeSpawn() {
  let spawnCalled = false;
  const service = createTerminalRuntimeService({
    pty: {
      spawn: () => {
        spawnCalled = true;
        throw new Error("spawn should not be called");
      }
    },
    BrowserWindow: { fromWebContents: () => ({ id: "fallback-win" }) },
    resolveToolCwd: () => "C:\\work",
    prepareAgentRuntime: () => ({}),
    meodeskRuntimeEnv: () => ({}),
    withWorkshopRuntimeArgs: (_command, args) => args,
    withWslRuntimeArgs: (_command, args) => args,
    launchCommandSpec: (command, args) => ({ command, args, resolved: "" }),
    packagedAgentResourceBlockReason: () => "",
    normalizeTerminalSpawnDimension: (value, fallback) => Number(value) || fallback,
    sendTerminalEvent: () => {},
    recordTerminalSourceAdapterInput: () => {},
    startTerminalSourceAdapter: () => {},
    stopTerminalSourceAdapter: () => {},
    isQuitting: () => false
  });
  assert.throws(() => {
    service.spawnTerminal({ id: "win", isDestroyed: () => false }, "runtime-missing", {
      id: "claude",
      name: "Claude Code",
      command: "claude",
      args: []
    });
  }, /未在 PATH、系统环境变量或常见 CLI 安装目录中找到启动命令/);
  assert.equal(spawnCalled, false);
  assert.equal(service.runtimeDescriptors().length, 0);
}

async function testTerminalRuntimeOwnershipMetadata() {
  const sent = [];
  const sourceAdapterStarts = [];
  const sourceAdapterInputs = [];
  let dataHandler = null;
  let exitHandler = null;
  const shell = {
    onData: (handler) => {
      dataHandler = handler;
    },
    onExit: (handler) => {
      exitHandler = handler;
    },
    kill: () => {},
    write: () => {},
    resize: () => {}
  };
  const ownership = {
    runtimeId: "runtime:workspace",
    sessionId: "session:workspace",
    surfaceId: "surface:workspace",
    conversationId: "conversation:workspace",
    agentId: "agent:claude",
    sourceId: "source:workspace",
    projectId: "project:local"
  };
  const service = createTerminalRuntimeService({
    pty: {
      spawn: () => shell
    },
    BrowserWindow: { fromWebContents: () => ({ id: "fallback-win" }) },
    resolveToolCwd: () => "C:\\work",
    prepareAgentRuntime: () => ({}),
    meodeskRuntimeEnv: () => ({}),
    withWorkshopRuntimeArgs: (_command, args) => args,
    withWslRuntimeArgs: (_command, args) => args,
    launchCommandSpec: (command, args) => ({ command, args, resolved: command }),
    packagedAgentResourceBlockReason: () => "",
    normalizeTerminalSpawnDimension: (value, fallback) => Number(value) || fallback,
    sendTerminalEvent: (_win, channel, payload) => sent.push({ channel, payload }),
    recordTerminalSourceAdapterInput: (...args) => sourceAdapterInputs.push(args),
    startTerminalSourceAdapter: (...args) => sourceAdapterStarts.push(args),
    stopTerminalSourceAdapter: () => {},
    isQuitting: () => false
  });
  service.spawnTerminal({ id: "win", isDestroyed: () => false }, "runtime-key", {
    id: "known-tool",
    name: "Known Tool",
    command: "node",
    args: ["--version"]
  }, { sourceAdapter: true, ownership });

  assert.equal(sourceAdapterStarts.length, 1);
  assert.equal(sourceAdapterStarts[0][1], "runtime-key");
  assert.deepEqual(sourceAdapterStarts[0][5], ownership);
  assert.deepEqual(service.runtimeDescriptors()[0], {
    id: "runtime:workspace",
    runtimeKey: "runtime-key",
    sessionKey: "runtime-key",
    toolId: "known-tool",
    owner: "agent-runtime-manager",
    status: "running",
    attachStatus: "reattachable",
    cwd: "C:\\work",
    startedAt: service.runtimeDescriptors()[0].startedAt,
    ...ownership
  });

  dataHandler("hello");
  assert.equal(sent.at(-1).channel, "terminal:data");
  assert.equal(sent.at(-1).payload.id, "runtime-key");
  assert.equal(sent.at(-1).payload.runtimeId, "runtime:workspace");
  assert.equal(sent.at(-1).payload.sessionId, "session:workspace");
  assert.equal(sent.at(-1).payload.surfaceId, "surface:workspace");

  service.write("runtime-key", "仅回复1\r");
  assert.deepEqual(sourceAdapterInputs.at(-1), ["runtime-key", "仅回复1\r"]);

  exitHandler({ exitCode: 0 });
  assert.equal(sent.at(-1).channel, "terminal:exit");
  assert.equal(sent.at(-1).payload.id, "runtime-key");
  assert.equal(sent.at(-1).payload.runtimeId, "runtime:workspace");
  assert.equal(sent.at(-1).payload.sessionId, "session:workspace");
  assert.equal(service.runtimeDescriptors().length, 0);
}

async function testTerminalSourceAdapterInputBindingGuards() {
  const now = Date.now();
  const state = { inputBuffer: "", recentUserInputs: [] };
  terminalSourceAdapterTest.recordTerminalSourceAdapterInputState(state, "仅回", now);
  terminalSourceAdapterTest.recordTerminalSourceAdapterInputState(state, "复1", now + 1);
  assert.deepEqual(terminalSourceAdapterTest.sourceAdapterRecentInputNeedles(state), []);
  terminalSourceAdapterTest.recordTerminalSourceAdapterInputState(state, "\r", now + 2);
  assert.deepEqual(terminalSourceAdapterTest.sourceAdapterRecentInputNeedles(state), ["仅回复1"]);

  assert.equal(terminalSourceAdapterTest.sourceAdapterFileStartedAt({
    ctimeMs: now + 100,
    mtimeMs: now + 100
  }), 0);
  assert.equal(terminalSourceAdapterTest.sourceAdapterCandidateIsFresh({
    birthtimeMs: now - 60000,
    mtimeMs: now + 1000
  }, now), false);
  assert.equal(terminalSourceAdapterTest.sourceAdapterCandidateIsFresh({
    birthtimeMs: now + 100,
    mtimeMs: now + 1000
  }, now), true);
}

async function testTerminalSourceAdapterKeepsBoundClaudeFile() {
  const root = makeTempRoot();
  const sent = [];
  let service = null;
  try {
    const cwd = path.join(root, "workbench");
    const projectDir = path.join(root, ".claude", "projects", claudeProjectFolderNameForTest(cwd));
    ensureDirectory(projectDir);
    const startedAt = Date.now() - 1000;
    const workspaceFile = path.join(projectDir, "workspace.jsonl");
    const studioFile = path.join(projectDir, "studio.jsonl");
    const line = (timestampOffset, role, content) => `${JSON.stringify({
      timestamp: new Date(startedAt + timestampOffset).toISOString(),
      message: { role, content }
    })}\n`;
    fs.writeFileSync(workspaceFile, [
      line(100, "user", "workspace prompt"),
      line(200, "assistant", "workspace answer")
    ].join(""));
    fs.writeFileSync(studioFile, [
      line(-60000, "user", "workspace prompt"),
      line(110, "user", "studio prompt"),
      line(210, "assistant", "studio answer")
    ].join(""));

    service = createTerminalSourceAdapterService({
      homeDir: root,
      isQuitting: () => false,
      isRendererSmoke: () => false,
      sendTerminalEvent: (_win, _channel, payload) => sent.push(payload)
    });
    service.startTerminalSourceAdapter(
      { id: "win", isDestroyed: () => false },
      "runtime-workspace",
      { id: "claude", name: "Claude Code", command: "claude" },
      cwd,
      startedAt,
      { sessionId: "session-workspace", surfaceId: "surface-workspace", sourceId: "source-workspace" }
    );
    service.recordTerminalSourceAdapterInput("runtime-workspace", "workspace prompt\r");
    await wait(450);

    let eventText = sent.flatMap((payload) => payload.sourceEvents || []).map((event) => event.text || "").join("\n");
    assert.equal(eventText.includes("workspace answer"), true);
    assert.equal(eventText.includes("studio answer"), false);

    fs.appendFileSync(studioFile, line(1200, "assistant", "studio latest should not leak"));
    await wait(1050);
    eventText = sent.flatMap((payload) => payload.sourceEvents || []).map((event) => event.text || "").join("\n");
    assert.equal(eventText.includes("studio latest should not leak"), false);

    fs.appendFileSync(workspaceFile, line(1300, "assistant", "workspace followup"));
    await wait(1050);
    eventText = sent.flatMap((payload) => payload.sourceEvents || []).map((event) => event.text || "").join("\n");
    assert.equal(eventText.includes("workspace followup"), true);
  } finally {
    if (service) service.stopTerminalSourceAdapter("runtime-workspace");
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function testTerminalSourceAdapterWaitsForRuntimeInputBeforeClaudeBind() {
  const root = makeTempRoot();
  const sent = [];
  let service = null;
  try {
    const cwd = path.join(root, "workbench");
    const projectDir = path.join(root, ".claude", "projects", claudeProjectFolderNameForTest(cwd));
    ensureDirectory(projectDir);
    const startedAt = Date.now() - 1000;
    const latestFile = path.join(projectDir, "latest-other-surface.jsonl");
    const workspaceFile = path.join(projectDir, "workspace.jsonl");
    const line = (timestampOffset, role, content) => `${JSON.stringify({
      timestamp: new Date(startedAt + timestampOffset).toISOString(),
      message: { role, content }
    })}\n`;
    fs.writeFileSync(latestFile, [
      line(100, "user", "other prompt"),
      line(200, "assistant", "other surface answer")
    ].join(""));
    fs.writeFileSync(workspaceFile, [
      line(300, "user", "workspace prompt"),
      line(400, "assistant", "workspace answer")
    ].join(""));

    service = createTerminalSourceAdapterService({
      homeDir: root,
      claudePollMs: 80,
      isQuitting: () => false,
      isRendererSmoke: () => false,
      sendTerminalEvent: (_win, _channel, payload) => sent.push(payload)
    });
    service.startTerminalSourceAdapter(
      { id: "win", isDestroyed: () => false },
      "runtime-workspace",
      { id: "claude", name: "Claude Code", command: "claude" },
      cwd,
      startedAt,
      { sessionId: "session-workspace", surfaceId: "surface-workspace", sourceId: "source-workspace" }
    );
    await wait(220);
    assert.equal(sent.length, 0);

    service.recordTerminalSourceAdapterInput("runtime-workspace", "workspace prompt\r");
    await wait(220);
    const eventText = sent.flatMap((payload) => payload.sourceEvents || []).map((event) => event.text || "").join("\n");
    assert.equal(eventText.includes("workspace answer"), true);
    assert.equal(eventText.includes("other surface answer"), false);
  } finally {
    if (service) service.stopTerminalSourceAdapter("runtime-workspace");
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function testTerminalSourceAdapterUsesNearestInputTimestampForClaudeBind() {
  const root = makeTempRoot();
  const sent = [];
  let service = null;
  try {
    const cwd = path.join(root, "workbench");
    const projectDir = path.join(root, ".claude", "projects", claudeProjectFolderNameForTest(cwd));
    ensureDirectory(projectDir);
    const now = Date.now();
    const startedAt = now - 3000;
    const olderFile = path.join(projectDir, "older-same-prompt.jsonl");
    const currentFile = path.join(projectDir, "current-same-prompt.jsonl");
    const lineAt = (timestampMs, role, content) => `${JSON.stringify({
      timestamp: new Date(timestampMs).toISOString(),
      message: { role, content }
    })}\n`;
    fs.writeFileSync(olderFile, [
      lineAt(startedAt + 500, "user", "仅回复1"),
      lineAt(startedAt + 700, "assistant", "older surface answer")
    ].join(""));
    fs.writeFileSync(currentFile, [
      lineAt(now - 60, "user", "仅回复1"),
      lineAt(now + 40, "assistant", "current surface answer")
    ].join(""));

    service = createTerminalSourceAdapterService({
      homeDir: root,
      claudePollMs: 80,
      isQuitting: () => false,
      isRendererSmoke: () => false,
      sendTerminalEvent: (_win, _channel, payload) => sent.push(payload)
    });
    service.startTerminalSourceAdapter(
      { id: "win", isDestroyed: () => false },
      "runtime-workspace",
      { id: "claude", name: "Claude Code", command: "claude" },
      cwd,
      startedAt,
      { sessionId: "session-workspace", surfaceId: "surface-workspace", sourceId: "source-workspace" }
    );
    service.recordTerminalSourceAdapterInput("runtime-workspace", "仅回复1\r");
    await wait(300);

    const eventText = sent.flatMap((payload) => payload.sourceEvents || []).map((event) => event.text || "").join("\n");
    assert.equal(eventText.includes("current surface answer"), true);
    assert.equal(eventText.includes("older surface answer"), false);
  } finally {
    if (service) service.stopTerminalSourceAdapter("runtime-workspace");
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function testTerminalSourceAdapterKeepsBoundHermesFile() {
  const root = makeTempRoot();
  const sent = [];
  let service = null;
  try {
    const sessionDir = path.join(root, "hermes", "sessions");
    ensureDirectory(sessionDir);
    const startedAt = Date.now() - 1000;
    const workspaceFile = path.join(sessionDir, "workspace.json");
    const studioFile = path.join(sessionDir, "studio.json");
    const message = (timestampOffset, role, content) => ({
      role,
      content,
      timestamp: new Date(startedAt + timestampOffset).toISOString()
    });
    const writeSession = (filePath, messages) => {
      fs.writeFileSync(filePath, JSON.stringify({
        session_start: new Date(startedAt).toISOString(),
        messages
      }, null, 2));
    };
    const workspaceMessages = [
      message(100, "user", "workspace prompt"),
      message(200, "assistant", "workspace answer")
    ];
    const studioMessages = [
      message(-60000, "user", "workspace prompt"),
      message(110, "user", "studio prompt"),
      message(210, "assistant", "studio answer")
    ];
    writeSession(workspaceFile, workspaceMessages);
    writeSession(studioFile, studioMessages);

    service = createTerminalSourceAdapterService({
      hermesPollMs: 120,
      hermesSessionDirs: [sessionDir],
      isQuitting: () => false,
      isRendererSmoke: () => false,
      sendTerminalEvent: (_win, _channel, payload) => sent.push(payload)
    });
    service.startTerminalSourceAdapter(
      { id: "win", isDestroyed: () => false },
      "runtime-hermes-workspace",
      { id: "hermes", name: "Hermes Agent", command: "hermes" },
      root,
      startedAt,
      { sessionId: "session-hermes-workspace", surfaceId: "surface-workspace", sourceId: "source-hermes-workspace" }
    );
    service.recordTerminalSourceAdapterInput("runtime-hermes-workspace", "workspace prompt\r");
    await wait(350);

    let eventText = sent.flatMap((payload) => payload.sourceEvents || []).map((event) => event.text || "").join("\n");
    assert.equal(eventText.includes("workspace answer"), true);
    assert.equal(eventText.includes("studio answer"), false);

    studioMessages.push(message(1200, "assistant", "studio latest should not leak"));
    writeSession(studioFile, studioMessages);
    await wait(280);
    eventText = sent.flatMap((payload) => payload.sourceEvents || []).map((event) => event.text || "").join("\n");
    assert.equal(eventText.includes("studio latest should not leak"), false);

    workspaceMessages.push(message(1300, "assistant", "workspace hermes followup"));
    writeSession(workspaceFile, workspaceMessages);
    await wait(280);
    eventText = sent.flatMap((payload) => payload.sourceEvents || []).map((event) => event.text || "").join("\n");
    assert.equal(eventText.includes("workspace hermes followup"), true);
  } finally {
    if (service) service.stopTerminalSourceAdapter("runtime-hermes-workspace");
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function main() {
  await testRuntimePermissionService();
  await testWorkshopPackageSafety();
  await testTerminalStartPolicy();
  await testCommandResolverWindowsNpmShimFallback();
  await testCommandResolverPrefersWindowsNpmShimOverAppAlias();
  await testCommandResolverBlocksWindowsAppAliasAgentCommand();
  await testTerminalRuntimeRejectsUnresolvedCommandBeforeSpawn();
  await testTerminalRuntimeOwnershipMetadata();
  await testTerminalSourceAdapterInputBindingGuards();
  await testTerminalSourceAdapterKeepsBoundClaudeFile();
  await testTerminalSourceAdapterWaitsForRuntimeInputBeforeClaudeBind();
  await testTerminalSourceAdapterUsesNearestInputTimestampForClaudeBind();
  await testTerminalSourceAdapterKeepsBoundHermesFile();
  console.log(JSON.stringify({
    ok: true,
    checked: [
      "openExternal reject rules",
      "openPath trusted roots",
      "Obsidian vault read boundary",
      "Workshop package install path boundary",
      "terminal start unknown tool/session rejection",
      "Windows CLI npm shim command resolution fallback",
      "Windows CLI npm shim beats App Execution Alias",
      "Windows Agent App Execution Alias preflight block",
      "terminal runtime unresolved command preflight rejection",
      "terminal runtime ownership metadata",
      "terminal source adapter input binding guards",
      "terminal source adapter bound file isolation",
      "terminal source adapter waits for runtime input before Claude bind",
      "terminal source adapter nearest input timestamp Claude bind",
      "terminal source adapter Hermes bound file isolation"
    ]
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

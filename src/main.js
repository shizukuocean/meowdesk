const { installStdioBrokenPipeGuard } = require("./main/stdio-epipe-guard");

const stdioBrokenPipeGuard = installStdioBrokenPipeGuard();

const { app, BrowserWindow, clipboard, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const pty = require("node-pty");
const yaml = require("js-yaml");
const { createCommandResolver } = require("./main/command-resolver");
const { createMeodeskHomeService } = require("./main/meodesk-home-service");
const { createAgentRuntimeContextService } = require("./main/agent-runtime-context-service");
const {
  meodeskRuntimeEnv,
  shellQuote,
  withWorkshopRuntimeArgs,
  withWslRuntimeArgs
} = require("./main/agent-runtime-launch-service");
const { resolveRendererEntry } = require("./main/renderer-entry");
const {
  parseRendererSmokeSize,
  runRendererSmokeScenario,
  summarizeSmokeImage
} = require("./main/renderer-smoke-runner");
const { createTerminalRuntimeService } = require("./main/terminal-runtime-service");
const { createPetService } = require("./main/pet-service");
const { createConversationService } = require("./main/conversation-service");
const { scanObsidianVault } = require("./main/obsidian-service");
const { createWorkshopService } = require("./main/workshop-service");
const { createAgentInterfaceService } = require("./main/agent-interface-service");
const { createTerminalSourceAdapterService } = require("./main/terminal-source-adapter-service");
const { createRuntimePermissionService } = require("./main/runtime-permission-service");
const { createTerminalStartHandler } = require("./main/terminal-start-policy");

const AGENT_INTERFACE_CACHE_TTL_MS = 8000;
let agentInterfaceCache = new Map();
let isQuitting = false;
let mainWindow = null;
let terminalRuntime = null;
const isRendererSmoke = process.env.MEOWDESK_RENDERER_SMOKE === "1";
const showRendererSmokeWindow = /^(1|true|yes)$/i.test(process.env.MEOWDESK_RENDERER_SMOKE_SHOW || "");
if (isRendererSmoke) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
}
const commandResolver = createCommandResolver({ appDir: __dirname });
const {
  defaultTerminalTemplate,
  launchCommandSpec,
  packagedAgentResourceBlockReason,
  resolveToolCwd,
  testCommand
} = commandResolver;
const {
  deleteStorageJson,
  getConversationDirectory,
  getMeodeskHomeDirectory,
  meodeskHomePath,
  meodeskHomeVersion,
  meodeskRuntimeCachePath,
  readStorageJson,
  storageFileKeys,
  storageFilePathForKey,
  writeStorageJson
} = createMeodeskHomeService({
  app,
  ensureDirectory,
  writeGeneratedFile
});
const {
  getPetDirectory,
  runPetdexInstall,
  scanPets
} = createPetService({
  appDir: __dirname,
  ensureDirectory,
  fileUrl,
  meodeskHomePath
});
const {
  deleteConversationMirrorFile,
  scanImportedAgentConversations,
  writeConversationMirror
} = createConversationService({
  ensureDirectory,
  getConversationDirectory,
  getHomePath: () => app.getPath("home"),
  invalidateAgentInterfaceCache,
  notifyConversationsChanged,
  shellQuote
});
const {
  createWorkshopProject,
  exportWorkshopPackage,
  importWorkshopPackage,
  markWorkshopProjectReady,
  scanWorkshopExtensions,
  workshopRuntimeForType,
  workshopTargetForType
} = createWorkshopService({
  ensureDirectory,
  invalidateAgentInterfaceCache,
  meodeskHomePath,
  showOpenDialog: (options) => dialog.showOpenDialog(options),
  writeFileIfMissing
});
const {
  normalizeWorkshopRuntime,
  runtimeContextMarkdown,
  workshopSessionSkillMarkdown,
  workshopSystemPrompt,
  workshopTypeRulesMarkdown
} = createAgentRuntimeContextService({
  workshopRuntimeForType,
  workshopTargetForType
});
const {
  ensureAgentInterface
} = createAgentInterfaceService({
  cacheableAgentInterfaceInfo,
  getAgentInterfaceDirectory,
  getAgentSkillsDirectory,
  getCachedAgentInterfaceInfo,
  getConversationDirectory,
  loadConfig,
  meodeskHomePath,
  scanImportedAgentConversations,
  scanWorkshopExtensions,
  writeFileIfMissing,
  writeGeneratedFile
});
const {
  recordTerminalSourceAdapterInput,
  startTerminalSourceAdapter,
  stopTerminalSourceAdapter
} = createTerminalSourceAdapterService({
  isQuitting: () => isQuitting,
  isRendererSmoke: () => isRendererSmoke,
  sendTerminalEvent,
  shellQuote
});
const {
  openExternalTarget,
  openPathTarget,
  readTrustedObsidianNote,
  scanTrustedObsidianVault
} = createRuntimePermissionService({
  meodeskHomePath,
  openWindowsAppsFolderTarget,
  readStorageJson,
  scanObsidianVault,
  shell
});
const handleTerminalStart = createTerminalStartHandler({
  BrowserWindow,
  loadConfig,
  normalizeTerminalSessionTool,
  spawnTerminal
});

app.setName("Meowdesk");

if (process.env.MEOWDESK_USER_DATA_DIR) {
  const smokeUserDataPath = path.resolve(process.env.MEOWDESK_USER_DATA_DIR);
  ensureDirectory(smokeUserDataPath);
  app.setPath("userData", smokeUserDataPath);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock({
  userDataPath: app.getPath("userData"),
  rendererSmoke: isRendererSmoke
});

if (!hasSingleInstanceLock) {
  app.quit();
}

function loadConfig() {
  const config = loadBaseConfig();
  const userTools = loadUserTools();
  return {
    ...config,
    tools: mergeTools(config.tools || [], userTools)
  };
}

function loadBaseConfig() {
  const configPath = path.join(__dirname, "..", "config.yaml");
  const raw = fs.readFileSync(configPath, "utf8");
  return yaml.load(raw) || {};
}

function getUserToolsPath() {
  return meodeskHomePath("config", "tools.json");
}

function loadUserTools() {
  try {
    const filePath = getUserToolsPath();
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(parsed?.tools) ? parsed.tools : [];
  } catch {
    return [];
  }
}

function saveUserTools(tools) {
  const filePath = getUserToolsPath();
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify({ tools }, null, 2)}\n`, "utf8");
}

function mergeTools(baseTools, userTools) {
  const merged = [];
  const seen = new Set();
  for (const tool of [...baseTools, ...userTools]) {
    if (!tool?.id || seen.has(tool.id)) continue;
    seen.add(tool.id);
    merged.push(tool);
  }
  return merged;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getMeodeskStorageInfo() {
  const homePath = getMeodeskHomeDirectory();
  const agentInterfacePath = getAgentInterfaceDirectory();
  const directories = {
    home: homePath,
    config: path.join(homePath, "config"),
    data: path.join(homePath, "data"),
    board: path.join(homePath, "data", "board"),
    workspace: path.join(homePath, "workspace"),
    conversations: getConversationDirectory(),
    agentInterface: agentInterfacePath,
    inbox: path.join(agentInterfacePath, "inbox"),
    registered: path.join(agentInterfacePath, "registered"),
    context: path.join(agentInterfacePath, "context"),
    runtime: path.join(agentInterfacePath, "runtime"),
    proposals: path.join(agentInterfacePath, "proposals"),
    nodes: path.join(agentInterfacePath, "nodes"),
    skills: path.join(agentInterfacePath, "skills"),
    extensions: path.join(homePath, "extensions"),
    pets: getPetDirectory(),
    plugins: path.join(homePath, "plugins"),
    cache: path.join(homePath, "cache"),
    logs: path.join(homePath, "logs"),
    exports: path.join(homePath, "exports")
  };
  return {
    ok: true,
    version: meodeskHomeVersion,
    homePath,
    userDataPath: app.getPath("userData"),
    manifestPath: path.join(homePath, "meodesk-home.json"),
    readmePath: path.join(homePath, "README.md"),
    directories,
    storageFiles: Object.fromEntries(
      storageFileKeys().map((key) => [key, storageFilePathForKey(key)])
    )
  };
}

function getAgentInterfaceDirectory() {
  const rootPath = meodeskHomePath("agent-interface");
  ensureDirectory(rootPath);
  ensureDirectory(path.join(rootPath, "inbox"));
  ensureDirectory(path.join(rootPath, "registered"));
  ensureDirectory(path.join(rootPath, "context"));
  ensureDirectory(path.join(rootPath, "runtime"));
  ensureDirectory(path.join(rootPath, "proposals"));
  ensureDirectory(path.join(rootPath, "nodes"));
  ensureDirectory(path.join(rootPath, "skills"));
  return rootPath;
}

function getBundledAgentSkillDirectory() {
  return path.join(__dirname, "..", "assets", "agent-skills");
}

function agentInterfaceCacheKey(includeNativeHistory) {
  return includeNativeHistory ? "native" : "light";
}

function invalidateAgentInterfaceCache() {
  agentInterfaceCache = new Map();
}

function cacheableAgentInterfaceInfo(info, includeNativeHistory) {
  const historyMode = includeNativeHistory ? "native" : "light";
  const nextInfo = {
    ...info,
    historyMode
  };
  setCachedAgentInterfaceInfo(includeNativeHistory, nextInfo);
  return nextInfo;
}

function getCachedAgentInterfaceInfo(includeNativeHistory) {
  const entry = agentInterfaceCache.get(agentInterfaceCacheKey(includeNativeHistory));
  if (!entry) return null;
  if (Date.now() - entry.at > AGENT_INTERFACE_CACHE_TTL_MS) {
    agentInterfaceCache.delete(agentInterfaceCacheKey(includeNativeHistory));
    return null;
  }
  return entry.info;
}

function setCachedAgentInterfaceInfo(includeNativeHistory, info) {
  agentInterfaceCache.set(agentInterfaceCacheKey(includeNativeHistory), {
    at: Date.now(),
    info
  });
}

function copyDirectoryIfMissing(sourcePath, targetPath) {
  if (fs.existsSync(targetPath)) return;
  ensureDirectory(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function syncBundledAgentSkill(sourcePath, targetPath) {
  copyDirectoryIfMissing(sourcePath, targetPath);
  const sourceSkillPath = path.join(sourcePath, "SKILL.md");
  if (!fs.existsSync(sourceSkillPath)) return;
  ensureDirectory(targetPath);
  writeGeneratedFile(path.join(targetPath, "SKILL.md"), fs.readFileSync(sourceSkillPath, "utf8"));
}

function seedBundledAgentSkills(targetRoot) {
  const bundledRoot = getBundledAgentSkillDirectory();
  if (!fs.existsSync(bundledRoot)) return;
  const entries = fs.readdirSync(bundledRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sourcePath = path.join(bundledRoot, entry.name);
    if (!fs.existsSync(path.join(sourcePath, "SKILL.md"))) continue;
    syncBundledAgentSkill(sourcePath, path.join(targetRoot, entry.name));
  }
}

function getAgentSkillsDirectory(rootPath = getAgentInterfaceDirectory()) {
  const skillsPath = path.join(rootPath, "skills");
  ensureDirectory(skillsPath);
  seedBundledAgentSkills(skillsPath);
  return skillsPath;
}

function fileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/")}`;
}

function writeFileIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) return;
  fs.writeFileSync(filePath, content, "utf8");
}

function writeGeneratedFile(filePath, content) {
  try {
    if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === content) return;
  } catch {
    // Fall through and rewrite the generated contract file.
  }
  fs.writeFileSync(filePath, content, "utf8");
}

function slugifyAgentId(value) {
  return String(value || "agent")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "agent";
}

function uniqueToolId(baseId, tools) {
  const base = slugifyAgentId(baseId);
  const used = new Set((tools || []).map((tool) => tool.id));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function safeFilePart(value, fallback = "conversation") {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;
}


function parseTimestampMs(value) {
  if (!value) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value).trim();
  if (!text) return 0;
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

process.on("uncaughtException", (error) => {
  if (stdioBrokenPipeGuard.shouldIgnoreUncaughtException(error)) return;
  console.error("Uncaught exception in Meodesk main process:", error);
  throw error;
});

function normalizeToolPayload(payload) {
  const toolKind = runtimeToolKind(payload);
  const name = String(payload?.name || payload?.command || "Agent").trim();
  const command = String(payload?.command || "").trim();
  if (!command) throw new Error("Missing command.");
  const args = Array.isArray(payload?.args)
    ? payload.args.map((arg) => String(arg))
    : String(payload?.args || "").split(/\s+/).map((arg) => arg.trim()).filter(Boolean);
  return {
    id: slugifyAgentId(payload?.id || name || command),
    name,
    type: "cli",
    toolKind,
    command,
    args,
    cwd: String(payload?.cwd || ".").trim() || ".",
    env: payload?.env && typeof payload.env === "object" ? payload.env : {},
    auto_start: Boolean(payload?.auto_start || payload?.autoStart),
    icon: payload?.icon || iconForToolKind(toolKind, name) || undefined
  };
}

function normalizeTerminalSessionTool(baseTool, override = null) {
  if (!override || typeof override !== "object") return baseTool;
  const command = String(override.command || baseTool.command || "").trim();
  if (command && command !== String(baseTool.command || "").trim()) {
    throw new Error("Session tool override cannot change the configured command.");
  }
  const args = Array.isArray(override.args)
    ? override.args.map((arg) => String(arg))
    : (Array.isArray(baseTool.args) ? baseTool.args.map((arg) => String(arg)) : []);
  const env = override.env && typeof override.env === "object" ? override.env : {};
  return {
    ...baseTool,
    name: String(override.name || baseTool.name || baseTool.id || "Agent"),
    command: baseTool.command,
    args,
    cwd: String(override.cwd || baseTool.cwd || ".").trim() || ".",
    env: { ...(baseTool.env || {}), ...env },
    agentInputMode: String(override.agentInputMode || baseTool.agentInputMode || "").trim(),
    inputMode: String(override.inputMode || baseTool.inputMode || "").trim(),
    replaceExisting: Boolean(override.replaceExisting)
  };
}

function iconForToolKind(kind, name = "") {
  const normalized = `${kind || ""} ${name || ""}`.toLowerCase();
  if (normalized.includes("claude")) return "assets/tool-icons/claude.ico";
  if (normalized.includes("hermes")) return "assets/tool-icons/hermes.png";
  if (normalized.includes("codex")) return "assets/tool-icons/codex.png";
  if (normalized.includes("powershell") || normalized.includes("terminal") || normalized.includes("shell")) return "assets/tool-icons/powershell.svg";
  if (normalized.includes("browser")) return "assets/tool-icons/browser.svg";
  return undefined;
}

function addUserTool(payload) {
  const baseConfig = loadBaseConfig();
  const userTools = loadUserTools();
  const tool = normalizeToolPayload(payload);
  const baseTools = baseConfig.tools || [];
  if (baseTools.some((item) => item.id === tool.id)) {
    tool.id = uniqueToolId(tool.id, [...baseTools, ...userTools]);
  }
  const nextTools = [...userTools.filter((item) => item.id !== tool.id), tool];
  saveUserTools(nextTools);
  invalidateAgentInterfaceCache();
  return { tool, config: loadConfig(), userToolsPath: getUserToolsPath() };
}

function deleteUserTool(toolId) {
  const id = slugifyAgentId(toolId);
  if (!id) throw new Error("Missing tool id.");
  const baseTools = loadBaseConfig().tools || [];
  if (baseTools.some((tool) => tool.id === id)) {
    throw new Error("内置工作窗配置不能删除。");
  }
  const userTools = loadUserTools();
  const target = userTools.find((tool) => tool.id === id);
  if (!target) throw new Error("未找到可删除的工作窗配置。");
  saveUserTools(userTools.filter((tool) => tool.id !== id));
  invalidateAgentInterfaceCache();
  return { deletedTool: target, config: loadConfig(), userToolsPath: getUserToolsPath() };
}

function presetAgentTemplates() {
  const templates = [
    { id: "claude", name: "Claude Code", toolKind: "claude", command: "claude", args: [], cwd: "." },
    { id: "codex", name: "Codex", toolKind: "codex", command: "codex", args: [], cwd: "." },
    { id: "hermes", name: "Hermes", toolKind: "hermes", command: "hermes", args: [], cwd: "." },
    process.platform === "win32"
      ? { id: "hermes-wsl", name: "Hermes (WSL)", toolKind: "hermes", command: "wsl.exe", args: ["-e", "bash", "-lc", "hermes"], cwd: "." }
      : null,
    defaultTerminalTemplate(),
    { id: "custom", name: "自定义 Agent", toolKind: "other", command: "", args: [], cwd: "." }
  ];
  return templates.filter(Boolean);
}

function runtimeToolKind(tool) {
  const normalized = `${tool?.toolKind || ""} ${tool?.kind || ""} ${tool?.id || ""} ${tool?.name || ""} ${tool?.command || ""} ${Array.isArray(tool?.args) ? tool.args.join(" ") : ""}`.toLowerCase();
  if (normalized.includes("claude")) return "claude";
  if (normalized.includes("hermes")) return "hermes";
  if (normalized.includes("codex")) return "codex";
  if (normalized.includes("terminal") || normalized.includes("powershell") || /\bpwsh(?:\.exe)?\b/.test(normalized) || /\bcmd(?:\.exe)?\b/.test(normalized) || normalized.includes("shell")) return "terminal";
  return "other";
}

function prepareAgentRuntime(sessionId, tool, cwd, options = {}) {
  const interfaceDir = getAgentInterfaceDirectory();
  const skillsDir = getAgentSkillsDirectory(interfaceDir);
  const extensionsDir = meodeskHomePath("extensions");
  const agentId = slugifyAgentId(tool.id || tool.name || sessionId);
  const runtimeDir = path.join(interfaceDir, "runtime");
  const contextDir = path.join(interfaceDir, "context");
  const runtimeFile = path.join(runtimeDir, `${sessionId}.json`);
  const workshop = normalizeWorkshopRuntime(options.workshop);
  if (workshop.enabled) {
    workshop.systemPromptFile = meodeskRuntimeCachePath(`${sessionId}.workshop-system.md`);
    workshop.rulesFile = meodeskRuntimeCachePath(`${sessionId}.workshop-rules.${workshop.type}.md`);
    workshop.sessionSkillDir = meodeskRuntimeCachePath(`${sessionId}.meodesk-workshop-session`);
  }
  const contextFile = path.join(contextDir, `${agentId}.md`);
  const runtime = {
    protocolVersion: "1",
    meodesk: true,
    agentId,
    agentName: String(tool.name || tool.id || agentId),
    agentKind: runtimeToolKind(tool),
    paneId: sessionId,
    cwd,
    interfaceDir,
    inboxDir: path.join(interfaceDir, "inbox"),
    registeredDir: path.join(interfaceDir, "registered"),
    contextFile,
    runtimeFile,
    proposalsDir: path.join(interfaceDir, "proposals"),
    conversationsDir: getConversationDirectory(),
    extensionsDir,
    nodesDir: path.join(interfaceDir, "nodes"),
    skillsDir,
    bundledSkillsDir: getBundledAgentSkillDirectory(),
    schemas: {
      connectRequest: path.join(interfaceDir, "schema.json"),
      task: path.join(interfaceDir, "task.schema.json"),
      conversation: path.join(interfaceDir, "conversation.schema.json"),
      agentNodeCard: path.join(interfaceDir, "agent-node-card.schema.json"),
      featureProposal: path.join(interfaceDir, "feature-proposal.schema.json"),
      extensionManifest: path.join(interfaceDir, "extension-manifest.schema.json"),
      meowPackage: path.join(interfaceDir, "meow-package.schema.json"),
      meowPackageSpec: path.join(interfaceDir, "meow-package.md")
    },
    protocols: {
      task: "MEODESK_TASK",
      conversation: "MEODESK_CONVERSATION",
      pet: "MEODESK_PET"
    },
    capabilities: {
      taskProtocol: true,
      conversationUpload: true,
      petProtocol: true,
      connectRequest: true,
      featureProposal: true,
      extensionManifest: true,
      workshopExtensions: true,
      widgetsReserved: true
    },
    workshop,
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(contextFile, `${runtimeContextMarkdown(runtime)}\n`, "utf8");
  if (runtime.workshop.enabled && runtime.workshop.systemPromptFile) {
    fs.writeFileSync(runtime.workshop.systemPromptFile, `${workshopSystemPrompt(runtime)}\n`, "utf8");
  }
  if (runtime.workshop.enabled && runtime.workshop.rulesFile) {
    fs.writeFileSync(runtime.workshop.rulesFile, `${workshopTypeRulesMarkdown(runtime)}\n`, "utf8");
  }
  if (runtime.workshop.enabled && runtime.workshop.sessionSkillDir) {
    ensureDirectory(runtime.workshop.sessionSkillDir);
    fs.writeFileSync(path.join(runtime.workshop.sessionSkillDir, "SKILL.md"), `${workshopSessionSkillMarkdown(runtime)}\n`, "utf8");
  }
  fs.writeFileSync(runtimeFile, `${JSON.stringify(runtime, null, 2)}\n`, "utf8");
  return runtime;
}

function createWindow() {
  const smokeSize = isRendererSmoke ? parseRendererSmokeSize() : null;
  const win = new BrowserWindow({
    width: smokeSize?.width || 1280,
    height: smokeSize?.height || 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#111318",
    show: !isRendererSmoke || showRendererSmokeWindow,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      backgroundThrottling: false
    }
  });
  mainWindow = win;

  win.on("close", () => {
    killAllTerminals();
  });
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
  if (isRendererSmoke) {
    win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      console.error(`[renderer console:${level}] ${message} (${sourceId}:${line})`);
    });
  }

  const requestedRenderer = process.env.MEOWDESK_RENDERER || "next";
  let rendererEntry;
  try {
    rendererEntry = resolveRendererEntry({
      appDir: __dirname,
      requestedRenderer,
      allowLegacy: process.env.MEOWDESK_ALLOW_LEGACY_RENDERER === "1"
    });
  } catch (error) {
    const message = error?.message || String(error);
    if (isRendererSmoke) {
      console.error(`Renderer entry unavailable: ${message}`);
    } else {
      dialog.showErrorBox("Meowdesk renderer unavailable", message);
    }
    app.exit(1);
    return;
  }
  const { rendererKind, rendererPath } = rendererEntry;

  const loadPromise = win.loadFile(rendererPath);
  if (isRendererSmoke) {
    const timeoutMs = Number(process.env.MEOWDESK_RENDERER_SMOKE_TIMEOUT_MS) || 8000;
    const screenshotPath = process.env.MEOWDESK_RENDERER_SMOKE_SCREENSHOT
      ? path.resolve(process.env.MEOWDESK_RENDERER_SMOKE_SCREENSHOT)
      : "";
    const timeout = setTimeout(() => {
      console.error(`Renderer smoke timed out: ${rendererPath}`);
      app.exit(1);
    }, timeoutMs);
    loadPromise
      .then(async () => {
        await win.webContents.executeJavaScript(`
          document.documentElement.classList.add("meowdesk-renderer-smoke");
        `);
        const scenarioResult = await runRendererSmokeScenario(win, { defaultWorkspaceDirectory: commandResolver.defaultWorkspaceDirectory });
        if (process.env.MEOWDESK_RENDERER_SMOKE_SCENARIO === "r15-r2a-functions") {
          await new Promise((resolve) => setTimeout(resolve, 180));
          if (terminalSessionExists("blank-2")) {
            throw new Error("R2 workspace pane close removed the pane but did not kill the running terminal session.");
          }
          if (scenarioResult && typeof scenarioResult === "object") {
            scenarioResult.terminalKilledByPaneClose = true;
          }
        }
        let screenshotSummary = null;
        if (screenshotPath) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          await win.webContents.executeJavaScript(`
            new Promise((resolve) => {
              requestAnimationFrame(() => requestAnimationFrame(resolve));
            })
          `);
          ensureDirectory(path.dirname(screenshotPath));
          const image = await win.webContents.capturePage();
          screenshotSummary = summarizeSmokeImage(image);
          if (screenshotSummary.sampledUniqueColors < 2 || screenshotSummary.sampledNonDarkPixels < 1) {
            throw new Error(`Renderer smoke screenshot appears blank: ${JSON.stringify(screenshotSummary)}`);
          }
          fs.writeFileSync(screenshotPath, image.toPNG());
        }
        clearTimeout(timeout);
        console.log(JSON.stringify({ ok: true, requestedRenderer, rendererKind, rendererPath, screenshotPath, screenshotSummary, scenarioResult }));
        app.quit();
      })
      .catch((error) => {
        clearTimeout(timeout);
        console.error(`Renderer smoke failed: ${error.message || error}`);
        if (error?.stack && error.stack !== error.message) {
          console.error(error.stack);
        }
        app.exit(1);
      });
  }
}

function focusExistingWindow() {
  const win = mainWindow && !mainWindow.isDestroyed()
    ? mainWindow
    : BrowserWindow.getAllWindows().find((item) => !item.isDestroyed());
  if (!win) return false;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
  return true;
}

function sendTerminalEvent(win, channel, payload) {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  win.webContents.send(channel, payload);
}

function notifyConversationsChanged(payload = {}) {
  for (const win of BrowserWindow.getAllWindows()) {
    sendTerminalEvent(win, "conversations:changed", payload);
  }
}

function normalizeTerminalSpawnDimension(value, fallback, min, max) {
  const size = Math.round(Number(value) || 0);
  if (!Number.isFinite(size) || size < min) return fallback;
  return Math.max(min, Math.min(max, size));
}

function spawnTerminal(win, sessionId, tool, options = {}) {
  return terminalRuntime.spawnTerminal(win, sessionId, tool, options);
}

function killTerminalById(id) {
  return terminalRuntime.killTerminalById(id);
}

function killAllTerminals() {
  if (terminalRuntime) terminalRuntime.killAllTerminals();
}

function terminalSessionExists(id) {
  return terminalRuntime ? terminalRuntime.has(id) : false;
}

terminalRuntime = createTerminalRuntimeService({
  pty,
  BrowserWindow,
  resolveToolCwd,
  prepareAgentRuntime,
  meodeskRuntimeEnv,
  withWorkshopRuntimeArgs,
  withWslRuntimeArgs,
  launchCommandSpec,
  packagedAgentResourceBlockReason,
  normalizeTerminalSpawnDimension,
  sendTerminalEvent,
  recordTerminalSourceAdapterInput,
  startTerminalSourceAdapter,
  stopTerminalSourceAdapter,
  isQuitting: () => isQuitting
});

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return;
  createWindow();
});

app.on("second-instance", () => {
  focusExistingWindow();
});

app.on("before-quit", () => {
  isQuitting = true;
  killAllTerminals();
});

ipcMain.handle("config:get", () => loadConfig());

ipcMain.handle("storage:getInfo", () => getMeodeskStorageInfo());

ipcMain.handle("storage:read", (_event, key) => readStorageJson(key));

ipcMain.handle("storage:write", (_event, payload) => {
  const input = payload && typeof payload === "object" ? payload : {};
  return writeStorageJson(input.key, input.value);
});

ipcMain.handle("storage:delete", (_event, key) => deleteStorageJson(key));

ipcMain.handle("tools:getAgentPresets", () => presetAgentTemplates());

ipcMain.handle("tools:testCommand", (_event, payload) => {
  const tool = normalizeToolPayload(payload || {});
  return testCommand(tool.command, tool.args, resolveToolCwd(tool));
});

ipcMain.handle("tools:addUserTool", (_event, payload) => addUserTool(payload || {}));

ipcMain.handle("tools:deleteUserTool", (_event, toolId) => deleteUserTool(toolId));

ipcMain.handle("obsidian:pickVault", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: "选择 Obsidian vault",
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths.length) return null;
  const vaultPath = result.filePaths[0];
  return scanTrustedObsidianVault(vaultPath);
});

ipcMain.handle("obsidian:listFiles", (_event, vaultPath) => scanTrustedObsidianVault(vaultPath));

ipcMain.handle("obsidian:readFile", (_event, filePath) => readTrustedObsidianNote(filePath));

function openWindowsAppsFolderTarget(target) {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32") {
      reject(new Error("Windows AppsFolder targets are only supported on Windows."));
      return;
    }
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Start-Process -FilePath explorer.exe -ArgumentList @($env:MEOWDESK_APPSFOLDER_TARGET)"
      ],
      {
        windowsHide: true,
        env: {
          ...process.env,
          MEOWDESK_APPSFOLDER_TARGET: target
        }
      },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(String(stderr || error.message || "Windows app launch failed.").trim()));
          return;
        }
        resolve(true);
      }
    );
  });
}

ipcMain.handle("shell:openExternal", (_event, url) => openExternalTarget(url));

ipcMain.handle("shell:openPath", (_event, targetPath) => openPathTarget(targetPath));

ipcMain.handle("clipboard:writeText", (_event, text) => {
  clipboard.writeText(String(text || ""));
  return true;
});

ipcMain.handle("clipboard:readText", () => clipboard.readText());

ipcMain.handle("agentInterface:getInfo", (_event, payload) => ensureAgentInterface(payload || {}));

ipcMain.handle("workshop:createProject", (_event, payload) => createWorkshopProject(payload || {}));

ipcMain.handle("workshop:markProjectReady", (_event, payload) => markWorkshopProjectReady(payload || {}));

ipcMain.handle("workshop:exportMeowPackage", (_event, payload) => exportWorkshopPackage(payload || {}));

ipcMain.handle("workshop:importMeowPackage", (_event, payload) => importWorkshopPackage(payload || {}));

ipcMain.handle("conversations:mirror", (_event, payload) => writeConversationMirror(payload || {}));

ipcMain.handle("conversations:deleteMirror", (_event, payload) => deleteConversationMirrorFile(payload || {}));

ipcMain.handle("pets:list", () => scanPets());

ipcMain.handle("pets:install", async (_event, slug) => runPetdexInstall(slug));

ipcMain.handle("pets:delete", async (event, slug) => {
  const rootPath = getPetDirectory();
  const targetPath = path.resolve(rootPath, String(slug || ""));
  const relative = path.relative(rootPath, targetPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid pet path.");
  }

  const result = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
    type: "warning",
    buttons: ["删除", "取消"],
    defaultId: 1,
    cancelId: 1,
    title: "删除桌宠",
    message: `删除 ${slug}？`,
    detail: "这会删除本地宠物包文件夹。"
  });
  if (result.response !== 0) return scanPets();
  fs.rmSync(targetPath, { recursive: true, force: true });
  return scanPets();
});

ipcMain.handle("terminal:start", handleTerminalStart);

ipcMain.handle("agentRuntime:list", () => {
  return terminalRuntime.runtimeDescriptors();
});

ipcMain.handle("terminal:setSourceAdapter", (event, payload) => {
  return terminalRuntime.setSourceAdapter(event, payload);
});

ipcMain.on("terminal:write", (_event, { id, data }) => {
  terminalRuntime.write(id, data);
});

ipcMain.on("terminal:resize", (_event, { id, cols, rows }) => {
  terminalRuntime.resize(id, cols, rows);
});

ipcMain.on("terminal:kill", (_event, id) => {
  killTerminalById(id);
});

app.on("window-all-closed", () => {
  isQuitting = true;
  killAllTerminals();
  if (process.platform !== "darwin") app.quit();
});


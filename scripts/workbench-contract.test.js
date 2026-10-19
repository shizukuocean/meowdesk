const fs = require("fs");
const path = require("path");
const {
  extractIpcChannels,
  extractWorkbenchApi,
  readText
} = require("./lib/static-js-analysis");

const repoRoot = path.resolve(__dirname, "..");
const preloadPath = path.join(repoRoot, "src", "preload.js");
const mainPath = path.join(repoRoot, "src", "main.js");
const mainModulesDir = path.join(repoRoot, "src", "main");
const adapterPath = path.join(repoRoot, "src", "renderer-app", "src", "lib", "workbench-api.ts");
const identityPath = path.join(repoRoot, "src", "renderer-app", "src", "lib", "identity.ts");
const themeTokensPath = path.join(repoRoot, "src", "renderer-app", "src", "lib", "theme-tokens.ts");
const localeDictionaryPath = path.join(repoRoot, "src", "renderer-app", "src", "lib", "locale-dictionary.ts");
const devLedgerCorePath = path.join(repoRoot, "src", "renderer-app", "src", "features", "dev-ledger", "dev-ledger-core.ts");
const openSurfaceRegistryPath = path.join(repoRoot, "src", "renderer-app", "src", "features", "open-surface", "open-surface-registry.ts");
const runtimeSurfaceAttachmentsPath = path.join(repoRoot, "src", "renderer-app", "src", "features", "open-surface", "open-surface-runtime-attachments.ts");
const runtimeManagerPath = path.join(repoRoot, "src", "renderer-app", "src", "features", "agent-runtime", "agent-runtime-manager.ts");
const productShellModelPath = path.join(repoRoot, "src", "renderer-app", "src", "features", "product-shell", "product-shell-model.ts");
const productShellControlsPath = path.join(repoRoot, "src", "renderer-app", "src", "features", "product-shell", "product-shell-controls.tsx");
const conversationRecoveryPath = path.join(repoRoot, "src", "renderer-app", "src", "features", "conversations", "conversation-recovery-contract.ts");
const appSourcePath = path.join(repoRoot, "src", "renderer-app", "src", "app", "App.tsx");
const workspaceRoutePath = path.join(repoRoot, "src", "renderer-app", "src", "features", "workspace", "workspace-route.tsx");
const workspaceRightSidebarOwnerPath = path.join(repoRoot, "src", "renderer-app", "src", "features", "workspace", "workspace-right-sidebar-owner.tsx");
const studioRoutePath = path.join(repoRoot, "src", "renderer-app", "src", "features", "studio", "studio-route.tsx");
const workflowRoutePath = path.join(repoRoot, "src", "renderer-app", "src", "features", "workflow", "workflow-route.tsx");
const appCssPath = path.join(repoRoot, "src", "renderer-app", "src", "styles", "app.css");
const rendererRuntimeConsumerPaths = [
  workspaceRoutePath,
  studioRoutePath
];

const expectedMethods = [
  "addUserTool",
  "createWorkshopProject",
  "deleteConversationMirror",
  "deletePet",
  "deleteStorage",
  "deleteUserTool",
  "exportMeowPackage",
  "getAgentInterfaceInfo",
  "getAgentPresets",
  "getConfig",
  "getStorageInfo",
  "importMeowPackage",
  "installPet",
  "listAgentRuntimes",
  "killTerminal",
  "listObsidianFiles",
  "listPets",
  "markWorkshopProjectReady",
  "mirrorConversation",
  "onConversationsChanged",
  "onTerminalData",
  "onTerminalExit",
  "openExternal",
  "openPath",
  "pickObsidianVault",
  "readClipboardText",
  "readObsidianFile",
  "readStorage",
  "resizeTerminal",
  "setTerminalSourceAdapter",
  "startTerminal",
  "testToolCommand",
  "writeClipboardText",
  "writeStorage",
  "writeTerminal"
].sort();

const cleanupChannels = {
  onConversationsChanged: "conversations:changed",
  onTerminalData: "terminal:data",
  onTerminalExit: "terminal:exit"
};

const forbiddenDesktopHostMethods = [
  "attachDesktopWindow",
  "updateDesktopWindowBounds",
  "detachDesktopWindow"
];

const forbiddenDesktopHostChannels = [
  "desktopHost:attach",
  "desktopHost:updateBounds",
  "desktopHost:detach"
];

const forbiddenDesktopHostMainTokens = [
  "runDesktopHostPowerShell",
  "MEOWDESK_DESKTOP_HOST_PAYLOAD",
  "SetParent",
  "MoveWindow"
];

const requiredOwnershipContractTokens = [
  "runtimeId",
  "sessionId",
  "surfaceId",
  "conversationId",
  "agentId",
  "sourceId",
  "projectId",
  "runtimeKey",
  "attachStatus",
  "routeId",
  "OpenSurfaceDescriptor",
  "AgentRuntimeDescriptor"
];

const terminalRuntimeApiTokens = [
  "listAgentRuntimeDescriptors",
  "startTerminalSession",
  "writeTerminalSession",
  "resizeTerminalSession",
  "killTerminalSession",
  "setTerminalSourceAdapter",
  "onTerminalData",
  "onTerminalExit"
];

const requiredDevLedgerTokens = [
  "DevSession",
  "SpecCard",
  "AcceptanceItem",
  "ProblemRecord",
  "Artifact",
  "Evidence",
  "RetestRun",
  "LessonCandidate",
  "Actor",
  "DecisionRecord",
  "RiskAcceptance",
  "Link",
  "ProjectRecord",
  "SubprojectRecord",
  "CategoryRecord"
];

function uniqueSorted(items) {
  return [...new Set(items)].sort();
}

function diff(actual, expected) {
  return {
    missing: expected.filter((item) => !actual.includes(item)),
    extra: actual.filter((item) => !expected.includes(item))
  };
}

function assertNoDiff(label, actual, expected) {
  const result = diff(actual, expected);
  if (result.missing.length || result.extra.length) {
    throw new Error(`${label} mismatch: ${JSON.stringify(result)}`);
  }
}

function extractAdapterMethods(source) {
  const match = source.match(/export type WorkbenchApi = \{([\s\S]*?)\n\};/);
  if (!match) throw new Error("Could not find WorkbenchApi type block.");
  const methods = [];
  const pattern = /^\s*([A-Za-z_$][\w$]*)\s*:/gm;
  let item;
  while ((item = pattern.exec(match[1]))) methods.push(item[1]);
  return uniqueSorted(methods);
}

function extractRendererOnChannels(source) {
  const channels = [];
  const pattern = /\bipcRenderer\.on\s*\(\s*["']([^"']+)["']/g;
  let match;
  while ((match = pattern.exec(source))) channels.push(match[1]);
  return uniqueSorted(channels);
}

function extractWrappedWebContentsSendChannels(source) {
  const channels = [];
  const pattern = /\bsendTerminalEvent\s*\(\s*[^,]+,\s*["']([^"']+)["']/g;
  let match;
  while ((match = pattern.exec(source))) channels.push(match[1]);
  return uniqueSorted(channels);
}

function assertChannelContracts(preloadSource, mainSource) {
  const preloadChannels = extractIpcChannels(preloadSource);
  const mainChannels = extractIpcChannels(mainSource);
  const mainHandles = new Set(mainChannels.filter((item) => item.kind === "ipcMain.handle").map((item) => item.channel));
  const mainOn = new Set(mainChannels.filter((item) => item.kind === "ipcMain.on").map((item) => item.channel));
  const mainSends = new Set([
    ...mainChannels.filter((item) => item.kind === "webContents.send").map((item) => item.channel),
    ...extractWrappedWebContentsSendChannels(mainSource)
  ]);

  const missingHandlers = preloadChannels
    .filter((item) => item.kind === "ipcRenderer.invoke" && !mainHandles.has(item.channel))
    .map((item) => item.channel);
  const missingListeners = preloadChannels
    .filter((item) => item.kind === "ipcRenderer.send" && !mainOn.has(item.channel))
    .map((item) => item.channel);
  const missingEventSources = extractRendererOnChannels(preloadSource).filter((channel) => !mainSends.has(channel));

  if (missingHandlers.length || missingListeners.length || missingEventSources.length) {
    throw new Error(`IPC contract mismatch: ${JSON.stringify({
      missingHandlers: uniqueSorted(missingHandlers),
      missingListeners: uniqueSorted(missingListeners),
      missingEventSources: uniqueSorted(missingEventSources)
    })}`);
  }
}

function assertEventCleanup(preloadSource) {
  for (const [method, channel] of Object.entries(cleanupChannels)) {
    const methodIndex = preloadSource.indexOf(`${method}:`);
    if (methodIndex < 0) throw new Error(`Missing event method ${method}`);
    const returnIndex = preloadSource.indexOf(`return () => ipcRenderer.removeListener("${channel}", listener);`, methodIndex);
    if (returnIndex < 0) throw new Error(`${method} must return an unsubscribe function for ${channel}.`);
  }
}

function assertDangerousDesktopHostRouteRemoved({ preloadSource, mainSource, exposedMethods, adapterMethods }) {
  const leakedMethods = forbiddenDesktopHostMethods.filter((method) => exposedMethods.includes(method) || adapterMethods.includes(method));
  if (leakedMethods.length) {
    throw new Error(`Dangerous desktop host methods must stay removed: ${JSON.stringify(leakedMethods)}`);
  }

  const allChannels = extractIpcChannels(preloadSource + "\n" + mainSource).map((item) => item.channel);
  const leakedChannels = forbiddenDesktopHostChannels.filter((channel) => allChannels.includes(channel));
  if (leakedChannels.length) {
    throw new Error(`Dangerous desktop host IPC channels must stay removed: ${JSON.stringify(leakedChannels)}`);
  }

  const leakedMainTokens = forbiddenDesktopHostMainTokens.filter((token) => mainSource.includes(token));
  if (leakedMainTokens.length) {
    throw new Error(`Dangerous HWND desktop hosting helper tokens must stay removed: ${JSON.stringify(leakedMainTokens)}`);
  }
}

function assertOwnershipContractSpine() {
  const identitySource = readText(identityPath);
  const missingTokens = requiredOwnershipContractTokens.filter((token) => !identitySource.includes(token));
  if (missingTokens.length) {
    throw new Error(`Identity ownership contract is missing required tokens: ${JSON.stringify(missingTokens)}`);
  }

  const runtimeManagerSource = readText(runtimeManagerPath);
  const missingRuntimeManagerTokens = terminalRuntimeApiTokens.filter((token) => !runtimeManagerSource.includes(token));
  if (missingRuntimeManagerTokens.length) {
    throw new Error(`Agent Runtime Manager must wrap terminal runtime APIs: ${JSON.stringify(missingRuntimeManagerTokens)}`);
  }
  for (const token of ["listAgentRuntimes", "findAgentRuntime", "reattachAgentRuntime", "sourceAdapter !== true"]) {
    if (!runtimeManagerSource.includes(token)) {
      throw new Error(`Agent Runtime Manager registry contract missing ${token}.`);
    }
  }

  for (const consumerPath of rendererRuntimeConsumerPaths) {
    const source = readText(consumerPath);
    const directImports = terminalRuntimeApiTokens.filter((token) => {
      const importPattern = new RegExp(`import\\s*\\{[\\s\\S]*\\b${token}\\b[\\s\\S]*\\}\\s*from\\s*["']@/lib/workbench-api["']`);
      return importPattern.test(source);
    });
    if (directImports.length) {
      throw new Error(`${path.relative(repoRoot, consumerPath)} must use Agent Runtime Manager instead of direct terminal APIs: ${JSON.stringify(directImports)}`);
    }
  }
}

function assertPlanningContractsPresent() {
  const openSurfaceSource = readText(openSurfaceRegistryPath);
  for (const token of ["OpenSurfaceRegistrySnapshot", "bySurfaceId", "byRouteId", "detachedSurfaces", "normalizeRouteState"]) {
    if (!openSurfaceSource.includes(token)) throw new Error(`Open Surface registry contract missing ${token}.`);
  }

  const runtimeAttachmentSource = readText(runtimeSurfaceAttachmentsPath);
  for (const token of [
    "RuntimeSurfaceAttachmentSnapshot",
    "createRuntimeSurfaceAttachmentSnapshot",
    "defaultRuntimeSurfaceRouteRules",
    "runtime-surface-attachments",
    "runtime-reattach",
    "orphanRuntimes",
    "workspace-pane",
    "studio-agent"
  ]) {
    if (!runtimeAttachmentSource.includes(token)) throw new Error(`Runtime surface attachment contract missing ${token}.`);
  }

  const devLedgerSource = readText(devLedgerCorePath);
  const missingDevLedgerTokens = requiredDevLedgerTokens.filter((token) => !devLedgerSource.toLowerCase().includes(token.replace(/[A-Z]/g, (letter, index) => `${index ? "-" : ""}${letter.toLowerCase()}`)));
  if (missingDevLedgerTokens.length) {
    throw new Error(`Dev Ledger Core contract is missing required entities: ${JSON.stringify(missingDevLedgerTokens)}`);
  }
  for (const token of ["DEV_LEDGER_STORAGE_KEY", "normalizeDevLedgerRecord", "normalizeDevLedgerRecordStatus", "helperPage", "stage", "categoryId", "subprojectId", "devLedgerRecordsForScope", "devLedgerRecordsForCategory"]) {
    if (!devLedgerSource.includes(token)) throw new Error(`Dev Ledger Core boundary missing ${token}.`);
  }

  const themeSource = readText(themeTokensPath);
  for (const token of ["ThemeMode", "ThemePreset", "ThemeSemanticColorToken", "THEME_MODE_STORAGE_KEY", "normalizeThemePreset", "normalizeResolvedThemeMode", "accentColor", "density"]) {
    if (!themeSource.includes(token)) throw new Error(`Theme token contract missing ${token}.`);
  }

  const localeSource = readText(localeDictionaryPath);
  for (const token of ["LOCALE_STORAGE_KEY", "normalizeLocaleCode", "zh-CN", "en-US", "localeLabel"]) {
    if (!localeSource.includes(token)) throw new Error(`Locale dictionary contract missing ${token}.`);
  }

  const productShellModelSource = readText(productShellModelPath);
  for (const token of [
    "ProductShellProjection",
    "owner: \"product-shell\"",
    "sourceOwner: \"open-surface-registry\"",
    "createProductShellProjection",
    "productShellRouteKindForRouteId",
    "productShellTabPolicyForRouteId",
    "openTabs",
    "launchItems",
    "sidebarCoreItems",
    "sidebarPinnedItems",
    "meowBoxes",
    "runtimeSourceOwner",
    "runtimeSurfaceAttachments",
    "attachMode",
    "reattachableRuntimeCount",
    "primaryRuntimeKey"
  ]) {
    if (!productShellModelSource.includes(token)) throw new Error(`Product Shell projection contract missing ${token}.`);
  }

  const productShellControlsSource = readText(productShellControlsPath);
  for (const token of ["ProductShellSidebarControls", "data-product-shell", "data-meow-tabs", "data-meow-box", "data-meow-tab-attach-mode", "data-meow-tab-runtime-count", "onRouteChange"]) {
    if (!productShellControlsSource.includes(token)) throw new Error(`Product Shell consumer boundary missing ${token}.`);
  }
  for (const forbiddenToken of [
    "startAgentRuntime",
    "stopAgentRuntime",
    "reattachAgentRuntime",
    "listAgentRuntimes",
    "startTerminal",
    "killTerminal",
    "writeTerminal"
  ]) {
    if (productShellModelSource.includes(forbiddenToken)) {
      throw new Error(`Product Shell model must not own runtime lifecycle: found ${forbiddenToken}.`);
    }
    if (productShellControlsSource.includes(forbiddenToken)) {
      throw new Error(`Product Shell UI must not own runtime lifecycle: found ${forbiddenToken}.`);
    }
  }

  const conversationRecoverySource = readText(conversationRecoveryPath);
  for (const token of [
    "ConversationRecoveryDescriptor",
    "createConversationRecoveryDescriptor",
    "live-runtime",
    "cold-preview",
    "coldPreviewOnly",
    "workspace",
    "studio"
  ]) {
    if (!conversationRecoverySource.includes(token)) throw new Error(`Conversation recovery contract missing ${token}.`);
  }
}

function assertRightSidebarOwnerContract() {
  const appSource = readText(appSourcePath);
  const workspaceSource = readText(workspaceRoutePath);
  const workspaceRightSidebarOwnerSource = readText(workspaceRightSidebarOwnerPath);
  const studioSource = readText(studioRoutePath);
  const cssSource = readText(appCssPath);
  const productShellControlsSource = readText(productShellControlsPath);
  if (fs.existsSync(workflowRoutePath)) {
    throw new Error("Workflow route must stay archived outside the MVP main baseline.");
  }

  for (const token of [
    "workspaceRightSidebarCollapsed",
    "handleWorkspaceRightSidebarCollapsedChange",
    "meowdesk:workspace-sidebar-toggle",
    "meowdesk:right-sidebar-owner-toggle",
    "owner: \"workspace\" satisfies WorkspaceRightSidebarOwner",
    "rightSidebarCollapsed={workspaceRightSidebarCollapsed}",
    "inspectorOpen={!workspaceRightSidebarCollapsed}"
  ]) {
    if (!appSource.includes(token)) throw new Error(`App right-sidebar owner contract missing ${token}.`);
  }
  for (const forbiddenToken of ["WorkflowRoute", "workflowRightSidebarView", "setWorkflowInspectorCollapsed", "workflowLibraryCollapsed"]) {
    if (appSource.includes(forbiddenToken)) {
      throw new Error(`Workflow must not stay mounted in App MVP baseline: found ${forbiddenToken}.`);
    }
  }

  for (const token of [
    "data-workspace-right-sidebar-owner=\"true\"",
    "data-workspace-right-sidebar-page={page}",
    "data-workspace-right-sidebar-collapsed={collapsed ? \"true\" : \"false\"}",
    "data-meow-right-sidebar-owner=\"workspace\"",
    "data-meow-right-sidebar-family=\"workspace\"",
    "data-meow-right-sidebar-motion-owner=\"workspace\"",
    "--meow-right-sidebar-width"
  ]) {
    if (!workspaceRightSidebarOwnerSource.includes(token)) {
      throw new Error(`Shared workspace right-sidebar owner component missing ${token}.`);
    }
  }
  for (const [label, source] of [
    ["workspace route", workspaceSource],
    ["studio route", studioSource]
  ]) {
    if (!source.includes("WorkspaceRightSidebarOwner")) {
      throw new Error(`${label} must render the shared WorkspaceRightSidebarOwner.`);
    }
    if (source.includes("data-meow-right-sidebar-owner")) {
      throw new Error(`${label} must not stamp data-meow-right-sidebar-owner directly; use WorkspaceRightSidebarOwner.`);
    }
  }
  for (const token of [
    "data-meow-box-launch-draggable",
    "data-product-shell-sidebar-pinned-drop-active",
    "data-product-shell-drag-route",
    "dragRouteIdRef",
    "拖到这里固定到侧栏"
  ]) {
    if (!productShellControlsSource.includes(token)) throw new Error(`Meow Box drag contract missing ${token}.`);
  }

  for (const token of [
    ".meowdesk-panel-header",
    "height: 44px",
    "max-height: 44px",
    ".meowdesk-workspace-pane-head",
    "height: 36px",
    ".meowdesk-workspace-right-sidebar-owner",
    "[data-workspace-right-sidebar-page=\"studio\"]"
  ]) {
    if (!cssSource.includes(token)) throw new Error(`Header/right-sidebar visual contract missing ${token}.`);
  }
  const vsVisualSource = readText(path.join(repoRoot, "src", "renderer-app", "public", "vs", "vs-visual.css"));
  if (!vsVisualSource.includes("--vs-panel-header-height: 44px")) {
    throw new Error("VS visual panel header owner must use the shared compact 44px header height.");
  }
  if (vsVisualSource.includes("--vs-panel-header-height: 58px")) {
    throw new Error("VS visual panel header owner must not restore the old 58px header height.");
  }
}

function readMainProcessSources() {
  const sources = [readText(mainPath)];
  if (fs.existsSync(mainModulesDir)) {
    const moduleFiles = fs.readdirSync(mainModulesDir)
      .filter((name) => name.endsWith(".js"))
      .sort();
    for (const name of moduleFiles) {
      sources.push(readText(path.join(mainModulesDir, name)));
    }
  }
  return sources.join("\n\n");
}

function main() {
  const preloadSource = readText(preloadPath);
  const mainSource = readMainProcessSources();
  const adapterSource = readText(adapterPath);

  const exposedMethods = extractWorkbenchApi(preloadSource).exposed;
  const adapterMethods = extractAdapterMethods(adapterSource);

  assertNoDiff("preload window.workbench methods", exposedMethods, expectedMethods);
  assertNoDiff("renderer WorkbenchApi methods", adapterMethods, expectedMethods);
  assertChannelContracts(preloadSource, mainSource);
  assertEventCleanup(preloadSource);
  assertDangerousDesktopHostRouteRemoved({ preloadSource, mainSource, exposedMethods, adapterMethods });
  assertOwnershipContractSpine();
  assertPlanningContractsPresent();
  assertRightSidebarOwnerContract();

  console.log(JSON.stringify({
    ok: true,
    exposedMethods: exposedMethods.length,
    adapterMethods: adapterMethods.length,
    cleanupEvents: Object.keys(cleanupChannels).length,
    ownershipContract: true,
    planningContracts: true,
    rightSidebarOwnerContract: true
  }));
}

main();

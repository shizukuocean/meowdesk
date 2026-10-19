"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const MEODESK_HOME_DIR_NAME = "Meodesk Home";
const MEODESK_HOME_VERSION = 1;
const MEODESK_STORAGE_FILE_MAP = {
  layout: ["config", "workspace-layout.json"],
  theme: ["config", "theme.json"],
  themePreset: ["config", "theme-preset.json"],
  workspaceShell: ["workspace", "shell.json"],
  productShell: ["workspace", "product-shell.json"],
  workspaceLayout: ["workspace", "layout-state.json"],
  workspaceExtensions: ["workspace", "extensions.json"],
  studioState: ["data", "studio", "state.json"],
  studioPublish: ["data", "studio", "publish.json"],
  toolAutoStart: ["config", "tool-auto-start.json"],
  tasks: ["data", "board", "tasks.json"],
  taskBoardPrefs: ["config", "board-prefs.json"],
  taskDismissals: ["data", "board", "dismissed-task-imports.json"],
  profile: ["data", "profile.json"],
  conversations: ["data", "conversation-cache.json"],
  conversationDismissals: ["data", "dismissed-conversation-imports.json"],
  obsidianVault: ["config", "obsidian-vault.json"],
  activePets: ["config", "active-pets.json"],
  petBindings: ["config", "pet-bindings.json"],
  petBindingsInitialized: ["config", "pet-bindings-initialized.json"],
  petScales: ["config", "pet-scales.json"],
  petDirectionFixes: ["config", "pet-direction-fixes.json"],
  enabledExtensions: ["config", "enabled-extensions.json"]
};

function meodeskHomeReadme() {
  return [
    "# Meodesk Home",
    "",
    "这个目录是 Meowdesk 的本机数据根目录。目录名继续保留 `Meodesk Home`，用于兼容早期本地数据、旧协议和已生成的工坊作品。",
    "",
    "用户可见产品名采用 Meowdesk；`Meodesk Home`、`meodesk-home`、`MEODESK_*` 和 `meodesk.*` schema/protocol 暂作为兼容层保留，不要批量改名。",
    "",
    "## 文件树约定",
    "",
    "- `config/`：工具配置、外观偏好、工作区布局、看板偏好、Obsidian 入口等用户配置。",
    "- `data/`：看板任务、导入忽略记录、轻量本地数据缓存。",
    "- `workspace/`：后续用于命名工作区、布局快照和工作区级状态。",
    "- `conversations/`：Meodesk 镜像或导入的 Agent 对话记录。",
    "- `agent-interface/`：给 Agent 读写的 runtime、context、inbox、proposal、skill 和 schema。",
    "- `extensions/`：工坊生成的功能页、右侧栏组件等扩展对象作品目录。",
    "- `assets/pets/`：用户安装和启用的桌宠包。",
    "- `plugins/`：后续插件安装目录。",
    "- `cache/`：可重建缓存，例如 Petdex 临时 home。",
    "- `logs/`：后续本机诊断日志。",
    "",
    "## 产品规则",
    "",
    "1. 产品代码只应依赖 Meodesk Home、runtime 环境变量、schema 或用户显式选择的目录。",
    "2. 不要把用户名、盘符、私人 vault 或某台电脑的路径写进产品逻辑。",
    "3. Agent 不应猜测这里的绝对路径；应读取 `MEODESK_RUNTIME_FILE` 或环境变量。"
  ].join("\n");
}

function meodeskHomeManifest() {
  return {
    type: "meodesk-home",
    version: MEODESK_HOME_VERSION,
    directories: {
      config: "config",
      data: "data",
      workspace: "workspace",
      conversations: "conversations",
      agentInterface: "agent-interface",
      extensions: "extensions",
      pets: "assets/pets",
      plugins: "plugins",
      cache: "cache",
      logs: "logs",
      exports: "exports"
    }
  };
}

function createMeodeskHomeService({
  app,
  ensureDirectory,
  writeGeneratedFile
}) {
  if (!app || typeof app.getPath !== "function") throw new Error("createMeodeskHomeService requires Electron app.");
  if (typeof ensureDirectory !== "function") throw new Error("createMeodeskHomeService requires ensureDirectory.");
  if (typeof writeGeneratedFile !== "function") throw new Error("createMeodeskHomeService requires writeGeneratedFile.");

  function copyPathIfTargetMissing(sourcePath, targetPath) {
    try {
      if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) return false;
      ensureDirectory(path.dirname(targetPath));
      fs.cpSync(sourcePath, targetPath, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  function migrateLegacyMeodeskHome(rootPath) {
    const userDataPath = app.getPath("userData");
    copyPathIfTargetMissing(path.join(userDataPath, "tools.json"), path.join(rootPath, "config", "tools.json"));
    copyPathIfTargetMissing(path.join(userDataPath, "pets"), path.join(rootPath, "assets", "pets"));
    copyPathIfTargetMissing(path.join(userDataPath, "petdex-home"), path.join(rootPath, "cache", "petdex-home"));
    copyPathIfTargetMissing(path.join(userDataPath, "agent-interface"), path.join(rootPath, "agent-interface"));
    copyPathIfTargetMissing(path.join(rootPath, "agent-interface", "conversations"), path.join(rootPath, "conversations"));
  }

  function getMeodeskHomeDirectory() {
    const rootPath = path.join(app.getPath("userData"), MEODESK_HOME_DIR_NAME);
    ensureDirectory(rootPath);
    migrateLegacyMeodeskHome(rootPath);
    for (const relativePath of [
      ["config"],
      ["data"],
      ["data", "board"],
      ["workspace"],
      ["workspace", "layouts"],
      ["conversations"],
      ["agent-interface"],
      ["extensions"],
      ["assets"],
      ["assets", "pets"],
      ["plugins"],
      ["cache"],
      ["logs"],
      ["exports"],
      ["install-tests"]
    ]) {
      ensureDirectory(path.join(rootPath, ...relativePath));
    }
    writeGeneratedFile(path.join(rootPath, "README.md"), `${meodeskHomeReadme()}\n`);
    writeGeneratedFile(path.join(rootPath, "meodesk-home.json"), `${JSON.stringify(meodeskHomeManifest(), null, 2)}\n`);
    return rootPath;
  }

  function meodeskHomePath(...segments) {
    return path.join(getMeodeskHomeDirectory(), ...segments);
  }

  function meodeskRuntimeCachePath(...segments) {
    const rootPath = path.join(os.tmpdir(), "meodesk-runtime");
    ensureDirectory(rootPath);
    return path.join(rootPath, ...segments);
  }

  function getConversationDirectory() {
    const conversationsDir = meodeskHomePath("conversations");
    ensureDirectory(conversationsDir);
    return conversationsDir;
  }

  function storageFilePathForKey(key) {
    const segments = MEODESK_STORAGE_FILE_MAP[String(key || "")];
    if (!segments) throw new Error(`Unknown Meodesk storage key: ${key}`);
    return meodeskHomePath(...segments);
  }

  function readStorageJson(key) {
    const filePath = storageFilePathForKey(key);
    if (!fs.existsSync(filePath)) return { ok: true, exists: false, key, filePath, value: null };
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return { ok: true, exists: true, key, filePath, value };
  }

  function writeStorageJson(key, value) {
    const filePath = storageFilePathForKey(key);
    ensureDirectory(path.dirname(filePath));
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    return { ok: true, key, filePath };
  }

  function deleteStorageJson(key) {
    const filePath = storageFilePathForKey(key);
    if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
    return { ok: true, key, filePath };
  }

  return {
    getConversationDirectory,
    getMeodeskHomeDirectory,
    meodeskHomePath,
    meodeskHomeVersion: MEODESK_HOME_VERSION,
    meodeskRuntimeCachePath,
    readStorageJson,
    storageFileKeys: () => Object.keys(MEODESK_STORAGE_FILE_MAP),
    storageFilePathForKey,
    deleteStorageJson,
    writeStorageJson
  };
}

module.exports = {
  createMeodeskHomeService
};

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

function createCommandResolver({
  appDir,
  readWindowsPathRegistryValues,
  windowsNpmShimDirs
} = {}) {
  function defaultTerminalTemplate() {
    if (process.platform === "win32") {
      return { id: "terminal", name: "PowerShell", toolKind: "terminal", command: "powershell.exe", args: ["-NoLogo"], cwd: "." };
    }
    const shellCommand = process.env.SHELL || "bash";
    return { id: "terminal", name: "Shell", toolKind: "terminal", command: shellCommand, args: [], cwd: "." };
  }

  function defaultWorkspaceDirectory() {
    return path.join(appDir || path.join(__dirname, ".."), "..");
  }

  function resolveToolCwd(tool) {
    return tool?.cwd && tool.cwd !== "." ? tool.cwd : defaultWorkspaceDirectory();
  }

  function environmentValue(name) {
    if (process.env[name]) return process.env[name];
    const match = Object.keys(process.env).find((key) => key.toLowerCase() === name.toLowerCase());
    return match ? process.env[match] : "";
  }

  function expandWindowsEnvironmentTokens(value) {
    return String(value || "").replace(/%([^%]+)%/g, (_match, name) => environmentValue(name) || "");
  }

  function splitPathEntries(value) {
    return String(value || "")
      .split(path.delimiter)
      .map((item) => expandWindowsEnvironmentTokens(item).trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
  }

  function uniquePathEntries(values) {
    const seen = new Set();
    const entries = [];
    for (const value of values) {
      for (const entry of Array.isArray(value) ? value : splitPathEntries(value)) {
        const key = process.platform === "win32" ? entry.toLowerCase() : entry;
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push(entry);
      }
    }
    return entries;
  }

  let registryPathCache = null;

  function readWindowsRegistryPathValue(keyPath) {
    try {
      const output = execFileSync("reg.exe", ["query", keyPath, "/v", "Path"], {
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"]
      });
      const line = output
        .split(/\r?\n/)
        .find((item) => /^\s*Path\s+REG_\w+\s+/i.test(item));
      const match = line?.match(/^\s*Path\s+REG_\w+\s+(.+)$/i);
      return match ? match[1].trim() : "";
    } catch {
      return "";
    }
  }

  function defaultReadWindowsPathRegistryValues() {
    if (process.platform !== "win32") return [];
    if (!registryPathCache) {
      registryPathCache = [
        readWindowsRegistryPathValue("HKCU\\Environment"),
        readWindowsRegistryPathValue("HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment")
      ].filter(Boolean);
    }
    return registryPathCache;
  }

  function defaultWindowsNpmShimDirs() {
    if (process.platform !== "win32") return [];
    const appData = environmentValue("APPDATA") || path.join(os.homedir(), "AppData", "Roaming");
    return [path.join(appData, "npm")];
  }

  function windowsPathRegistryValues() {
    if (typeof readWindowsPathRegistryValues === "function") {
      return readWindowsPathRegistryValues();
    }
    return defaultReadWindowsPathRegistryValues();
  }

  function windowsNpmShimValues() {
    if (typeof windowsNpmShimDirs === "function") {
      return windowsNpmShimDirs();
    }
    return defaultWindowsNpmShimDirs();
  }

  function pathEnvValue() {
    if (process.platform !== "win32") return process.env.PATH || process.env.Path || "";
    return uniquePathEntries([
      process.env.PATH || "",
      process.env.Path || "",
      windowsPathRegistryValues(),
      windowsNpmShimValues()
    ]).join(path.delimiter);
  }

  function windowsPathExts() {
    return (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
      .split(";")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  function commandHasPathSeparator(command) {
    return /[\\/]/.test(String(command || ""));
  }

  function isExecutableFile(filePath) {
    try {
      return fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  }

  function knownAgentCommandName(command) {
    const commandName = path.basename(String(command || ""))
      .replace(/\.(exe|cmd|bat|com)$/i, "")
      .toLowerCase();
    return ["codex", "claude", "hermes"].includes(commandName) ? commandName : "";
  }

  function isWindowsAppExecutionAliasCandidate(command, filePath) {
    if (process.platform !== "win32") return false;
    if (!knownAgentCommandName(command)) return false;
    const normalizedPath = String(filePath || "").replace(/\//g, "\\").toLowerCase();
    return normalizedPath.includes("\\appdata\\local\\microsoft\\windowsapps\\")
      || normalizedPath.includes("\\program files\\windowsapps\\");
  }

  function resolveCommandPath(command, cwd = ".") {
    const value = String(command || "").trim();
    if (!value) return null;

    const hasPath = commandHasPathSeparator(value) || path.isAbsolute(value);
    const searchDirs = hasPath ? [""] : pathEnvValue().split(path.delimiter).filter(Boolean);
    const basePaths = hasPath
      ? [path.isAbsolute(value) ? value : path.resolve(cwd || ".", value)]
      : searchDirs.map((dirPath) => path.join(dirPath, value));

    if (process.platform !== "win32") {
      return basePaths.find(isExecutableFile) || null;
    }

    const hasExtension = Boolean(path.extname(value));
    const exts = hasExtension ? [""] : windowsPathExts();
    let windowsAppExecutionAlias = null;
    for (const basePath of basePaths) {
      for (const ext of exts) {
        const candidate = `${basePath}${ext}`;
        if (!isExecutableFile(candidate)) continue;
        if (isWindowsAppExecutionAliasCandidate(value, candidate)) {
          windowsAppExecutionAlias ||= candidate;
          continue;
        }
        return candidate;
      }
    }
    return windowsAppExecutionAlias;
  }

  function isWindowsCommandScript(filePath) {
    if (process.platform !== "win32") return false;
    const ext = path.extname(filePath || "").toLowerCase();
    return ext === ".cmd" || ext === ".bat";
  }

  function resolveWindowsCommandScriptTarget(filePath) {
    if (!isWindowsCommandScript(filePath)) return "";
    let raw = "";
    try {
      raw = fs.readFileSync(filePath, "utf8");
    } catch {
      return "";
    }
    const match = raw.match(/"%dp0%[\\/]([^"]+?\.exe)"\s+%[*0-9]?/i);
    if (!match) return "";
    const target = path.resolve(path.dirname(filePath), match[1]);
    return isExecutableFile(target) ? target : "";
  }

  function cmdQuote(value) {
    const text = String(value ?? "");
    if (!text) return '""';
    if (!/[ \t&()^|<>"]/u.test(text)) return text;
    return `"${text.replace(/"/g, '\\"')}"`;
  }

  function launchCommandSpec(command, args = [], cwd = ".") {
    const searchPath = pathEnvValue();
    const resolved = resolveCommandPath(command, cwd);
    if (!resolved) {
      return {
        command: String(command || ""),
        args,
        resolved: "",
        viaShell: false,
        pathEnv: searchPath
      };
    }

    if (isWindowsCommandScript(resolved)) {
      const scriptTarget = resolveWindowsCommandScriptTarget(resolved);
      if (scriptTarget) {
        return {
          command: scriptTarget,
          args,
          resolved: scriptTarget,
          viaShell: false,
          scriptShim: resolved,
          pathEnv: searchPath
        };
      }
      const commandLine = [cmdQuote(resolved), ...args.map(cmdQuote)].join(" ");
      return {
        command: "cmd.exe",
        args: ["/d", "/s", "/c", commandLine],
        resolved,
        viaShell: true,
        pathEnv: searchPath
      };
    }

    return {
      command: resolved,
      args,
      resolved,
      viaShell: false,
      pathEnv: searchPath
    };
  }

  function packagedAgentResourceBlockReason(command, resolvedPath) {
    if (process.platform !== "win32") return "";
    const commandName = knownAgentCommandName(command);
    const normalizedPath = String(resolvedPath || "").replace(/\//g, "\\").toLowerCase();
    if (!commandName) return "";
    if (!normalizedPath.includes("\\appdata\\local\\microsoft\\windowsapps\\") && !normalizedPath.includes("\\program files\\windowsapps\\")) return "";
    return `检测到 ${commandName} 指向 Windows 应用执行别名或桌面应用包，不等于可接入的 Agent CLI。请安装对应 CLI，或填写可从终端直接启动的 CLI 路径。`;
  }

  function testCommand(command, args = [], cwd = ".") {
    return new Promise((resolve) => {
      const value = String(command || "").trim();
      if (!value) {
        resolve({ ok: false, message: "请输入启动命令。" });
        return;
      }
      const launch = launchCommandSpec(value, args, cwd);
      if (!launch.resolved) {
        resolve({ ok: false, message: "未在 PATH 或指定路径找到命令。", output: value });
        return;
      }
      const blockedReason = packagedAgentResourceBlockReason(value, launch.resolved);
      if (blockedReason) {
        resolve({ ok: false, message: blockedReason, output: launch.resolved });
        return;
      }
      resolve({
        ok: true,
        message: "命令可运行。",
        output: launch.viaShell ? `${launch.resolved}\n通过 cmd.exe 启动脚本命令。` : launch.resolved
      });
    });
  }

  return {
    defaultTerminalTemplate,
    defaultWorkspaceDirectory,
    resolveToolCwd,
    resolveCommandPath,
    launchCommandSpec,
    packagedAgentResourceBlockReason,
    testCommand
  };
}

module.exports = {
  createCommandResolver
};

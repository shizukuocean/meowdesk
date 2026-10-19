const fs = require("fs");
const path = require("path");

const WINDOWS_APPS_FOLDER_TARGET_PATTERN = /^shell:AppsFolder\\[A-Za-z0-9._-]+![A-Za-z0-9._-]+$/;
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "obsidian:"]);

function createRuntimePermissionService({
  meodeskHomePath,
  openWindowsAppsFolderTarget,
  readStorageJson,
  scanObsidianVault,
  shell
}) {
  if (typeof meodeskHomePath !== "function") throw new Error("createRuntimePermissionService requires meodeskHomePath.");
  if (typeof readStorageJson !== "function") throw new Error("createRuntimePermissionService requires readStorageJson.");
  if (typeof scanObsidianVault !== "function") throw new Error("createRuntimePermissionService requires scanObsidianVault.");
  if (!shell || typeof shell.openExternal !== "function" || typeof shell.openPath !== "function") {
    throw new Error("createRuntimePermissionService requires Electron shell.");
  }
  const trustedObsidianVaultRoots = new Set();

  function resolveExistingLocalPath(targetPath) {
    const rawPath = String(targetPath || "").trim();
    if (!rawPath) throw new Error("Local path is required.");
    const resolved = path.resolve(rawPath);
    if (!fs.existsSync(resolved)) throw new Error(`Local path does not exist: ${resolved}`);
    return fs.realpathSync(resolved);
  }

  function isPathInsideRoot(rootPath, targetPath) {
    const relative = path.relative(rootPath, targetPath);
    return relative === "" || (relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  }

  function trustedMeodeskHomeRoot() {
    return fs.realpathSync(meodeskHomePath());
  }

  function registerTrustedObsidianVaultRoot(vaultPath) {
    const resolved = resolveExistingLocalPath(vaultPath);
    const stats = fs.statSync(resolved);
    if (!stats.isDirectory()) throw new Error("Obsidian vault path must be a directory.");
    trustedObsidianVaultRoots.add(resolved);
    return resolved;
  }

  function registerStoredObsidianVaultRoot() {
    try {
      const storedPath = readStorageJson("obsidianVault").value;
      if (storedPath) registerTrustedObsidianVaultRoot(storedPath);
    } catch {
      // Stored vault paths are user-controlled and may have moved between launches.
    }
  }

  function trustedObsidianVaultRootForPath(targetPath) {
    registerStoredObsidianVaultRoot();
    const resolved = resolveExistingLocalPath(targetPath);
    for (const root of trustedObsidianVaultRoots) {
      if (isPathInsideRoot(root, resolved)) return { root, resolved };
    }
    throw new Error("Path is outside the selected Obsidian vault.");
  }

  function scanTrustedObsidianVault(vaultPath) {
    return scanObsidianVault(registerTrustedObsidianVaultRoot(vaultPath));
  }

  function readTrustedObsidianNote(filePath) {
    const { resolved } = trustedObsidianVaultRootForPath(filePath);
    if (path.extname(resolved).toLowerCase() !== ".md") {
      throw new Error("Only markdown notes can be read from an Obsidian vault.");
    }
    const stats = fs.statSync(resolved);
    if (!stats.isFile()) throw new Error("Obsidian note path must be a file.");
    const raw = fs.readFileSync(resolved, "utf8");
    return {
      path: resolved,
      raw: raw.slice(0, 320000),
      truncated: raw.length > 320000,
      size: stats.size,
      modifiedAt: stats.mtimeMs
    };
  }

  function resolveOpenPathTarget(targetPath) {
    const resolved = resolveExistingLocalPath(targetPath);
    const allowedRoots = [trustedMeodeskHomeRoot()];
    registerStoredObsidianVaultRoot();
    for (const root of trustedObsidianVaultRoots) allowedRoots.push(root);
    if (allowedRoots.some((root) => isPathInsideRoot(root, resolved))) return resolved;
    throw new Error("openPath is limited to Meodesk Home and selected Obsidian vault paths.");
  }

  function openExternalTarget(url) {
    const target = String(url || "").trim();
    if (!target) {
      throw new Error("openExternal target is required.");
    }
    if (WINDOWS_APPS_FOLDER_TARGET_PATTERN.test(target)) {
      if (typeof openWindowsAppsFolderTarget !== "function") {
        throw new Error("Windows AppsFolder targets are unavailable.");
      }
      return openWindowsAppsFolderTarget(target);
    }
    const parsed = new URL(target);
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      throw new Error(`Blocked external protocol: ${parsed.protocol || "unknown"}`);
    }
    return shell.openExternal(target);
  }

  function openPathTarget(targetPath) {
    return shell.openPath(resolveOpenPathTarget(targetPath));
  }

  return {
    openExternalTarget,
    openPathTarget,
    readTrustedObsidianNote,
    registerTrustedObsidianVaultRoot,
    resolveOpenPathTarget,
    scanTrustedObsidianVault
  };
}

module.exports = {
  ALLOWED_EXTERNAL_PROTOCOLS,
  WINDOWS_APPS_FOLDER_TARGET_PATTERN,
  createRuntimePermissionService
};

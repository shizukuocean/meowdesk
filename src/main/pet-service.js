"use strict";

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const REMOVED_BUNDLED_PET_IDS = new Set(["boba", "mochi", "machi"]);

function createPetService({
  appDir,
  meodeskHomePath,
  ensureDirectory,
  fileUrl
}) {
  function findFirstExisting(basePath, names) {
    for (const name of names) {
      const target = path.join(basePath, name);
      if (fs.existsSync(target)) return target;
    }
    return null;
  }

  function normalizePetPackage(sourcePath, targetPath, slug) {
    const petJsonPath = findFirstExisting(sourcePath, ["pet.json", "petjson.json"]);
    if (!petJsonPath) return false;
    const spritesheetPath = findFirstExisting(sourcePath, [
      "spritesheet.webp",
      "spritesheet.png",
      "sprite.webp",
      "sprite.png"
    ]);
    if (!spritesheetPath) return false;

    ensureDirectory(targetPath);
    let meta = {};
    try {
      meta = JSON.parse(fs.readFileSync(petJsonPath, "utf8"));
    } catch {
      meta = {};
    }

    const spriteName = path.extname(spritesheetPath).toLowerCase() === ".png" ? "spritesheet.png" : "spritesheet.webp";
    fs.copyFileSync(spritesheetPath, path.join(targetPath, spriteName));
    fs.writeFileSync(
      path.join(targetPath, "pet.json"),
      JSON.stringify({
        id: meta.id || slug || path.basename(targetPath),
        displayName: meta.displayName || meta.name || slug || path.basename(targetPath),
        description: meta.description || "",
        spritesheetPath: spriteName,
        columns: Number(meta.columns) || 8,
        rows: Number(meta.rows) || 9
      }, null, 2),
      "utf8"
    );
    return true;
  }

  function cleanupLegacyPetDirectories(targetRoot) {
    for (const petId of REMOVED_BUNDLED_PET_IDS) {
      const targetPath = path.join(targetRoot, petId);
      try {
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        }
      } catch {
        // Legacy bundled pets should disappear quietly during startup.
      }
    }
  }

  function getBundledPetDirectory() {
    return path.join(appDir, "..", "assets", "pets");
  }

  function getPetdexHomeDirectory() {
    const petdexHome = meodeskHomePath("cache", "petdex-home");
    ensureDirectory(petdexHome);
    return petdexHome;
  }

  function getPetdexPetDirectory() {
    return path.join(getPetdexHomeDirectory(), ".codex", "pets");
  }

  function seedBundledPets(targetRoot) {
    const bundledRoot = getBundledPetDirectory();
    if (!fs.existsSync(bundledRoot)) return;
    const entries = fs.readdirSync(bundledRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (REMOVED_BUNDLED_PET_IDS.has(entry.name.toLowerCase())) continue;
      const targetPath = path.join(targetRoot, entry.name);
      if (fs.existsSync(path.join(targetPath, "pet.json"))) continue;
      normalizePetPackage(path.join(bundledRoot, entry.name), targetPath, entry.name);
    }
  }

  function getPetDirectory() {
    const petDir = meodeskHomePath("assets", "pets");
    ensureDirectory(petDir);
    cleanupLegacyPetDirectories(petDir);
    seedBundledPets(petDir);
    return petDir;
  }

  function scanPets() {
    const rootPath = getPetDirectory();
    let entries = [];
    try {
      entries = fs.readdirSync(rootPath, { withFileTypes: true });
    } catch {
      return { directory: rootPath, pets: [] };
    }

    const pets = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const petPath = path.join(rootPath, entry.name);
        const petJsonPath = findFirstExisting(petPath, ["pet.json", "petjson.json"]);
        if (!fs.existsSync(petJsonPath)) return null;
        let meta = {};
        try {
          meta = JSON.parse(fs.readFileSync(petJsonPath, "utf8"));
        } catch {
          return null;
        }
        const spritesheetPath = path.resolve(
          petPath,
          meta.spritesheetPath || meta.spritePath || "spritesheet.webp"
        );
        if (!fs.existsSync(spritesheetPath)) return null;
        return {
          id: meta.id || entry.name,
          slug: entry.name,
          displayName: meta.displayName || meta.name || entry.name,
          description: meta.description || "",
          directory: petPath,
          spritesheetPath,
          spritesheetUrl: fileUrl(spritesheetPath),
          columns: Number(meta.columns) || 8,
          rows: Number(meta.rows) || 9
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "zh-Hans-CN", { numeric: true }));

    return { directory: rootPath, pets };
  }

  function runPetdexInstall(slug) {
    return new Promise((resolve, reject) => {
      const normalizedSlug = String(slug || "").trim();
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,80}$/.test(normalizedSlug)) {
        reject(new Error("请输入 Petdex 页面上的英文名称或 slug。"));
        return;
      }

      ensureDirectory(getPetDirectory());
      const petdexPetDir = getPetdexPetDirectory();
      ensureDirectory(petdexPetDir);
      const petdexHome = getPetdexHomeDirectory();
      const runner = process.platform === "win32"
        ? { command: "cmd.exe", args: ["/d", "/s", "/c", "npx", "--yes", "petdex", "install", normalizedSlug] }
        : { command: "npx", args: ["--yes", "petdex", "install", normalizedSlug] };

      execFile(
        runner.command,
        runner.args,
        {
          cwd: getPetDirectory(),
          env: { ...process.env, HOME: petdexHome, USERPROFILE: petdexHome },
          windowsHide: true,
          timeout: 120000
        },
        (error, stdout, stderr) => {
          const output = `${stdout || ""}${stderr || ""}`.trim();
          let sourcePath = path.join(petdexPetDir, normalizedSlug);
          if (!fs.existsSync(sourcePath)) {
            try {
              const candidates = fs.readdirSync(petdexPetDir, { withFileTypes: true })
                .filter((entry) => entry.isDirectory() && entry.name.toLowerCase() === normalizedSlug.toLowerCase())
                .map((entry) => path.join(petdexPetDir, entry.name));
              sourcePath = candidates[0] || sourcePath;
            } catch {
              // Keep the default source path for the error message below.
            }
          }
          const targetPath = path.join(getPetDirectory(), normalizedSlug);
          if (!fs.existsSync(sourcePath)) {
            if (error) {
              reject(new Error(`${error.message}${output ? `\n${output}` : ""}`));
            } else {
              reject(new Error(`未找到安装结果：${sourcePath}${output ? `\n${output}` : ""}`));
            }
            return;
          }

          try {
            normalizePetPackage(sourcePath, targetPath, normalizedSlug);
            resolve({ output, pets: scanPets() });
          } catch (copyError) {
            reject(new Error(`${copyError.message || copyError}${output ? `\n${output}` : ""}`));
          }
        }
      );
    });
  }

  return {
    getPetDirectory,
    runPetdexInstall,
    scanPets
  };
}

module.exports = {
  createPetService
};

const fs = require("fs");
const path = require("path");

function rendererEntryPaths(appDir) {
  return {
    nextRendererPath: path.join(appDir, "..", "dist", "renderer-app", "index.html"),
    legacyRendererPath: path.join(appDir, "renderer", "index.html")
  };
}

function resolveRendererEntry({ appDir, requestedRenderer = "next", allowLegacy = false } = {}) {
  if (!appDir) throw new Error("Missing appDir for renderer entry resolution.");
  const { nextRendererPath, legacyRendererPath } = rendererEntryPaths(appDir);
  const rendererKind = requestedRenderer === "legacy" ? "legacy" : "next";

  if (rendererKind === "legacy") {
    if (!allowLegacy) {
      throw new Error("Legacy renderer is retired. Build/use the next renderer instead of MEOWDESK_RENDERER=legacy.");
    }
    if (!fs.existsSync(legacyRendererPath)) {
      throw new Error(`Legacy renderer entry is missing: ${legacyRendererPath}`);
    }
    return { rendererKind, rendererPath: legacyRendererPath, nextRendererPath, legacyRendererPath };
  }

  if (!fs.existsSync(nextRendererPath)) {
    throw new Error(`Next renderer build is missing: ${nextRendererPath}. Run npm run build:renderer first.`);
  }
  return { rendererKind: "next", rendererPath: nextRendererPath, nextRendererPath, legacyRendererPath };
}

module.exports = {
  rendererEntryPaths,
  resolveRendererEntry
};

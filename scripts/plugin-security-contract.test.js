const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function rgFiles(root, predicate = () => true) {
  const results = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if ([".git", "node_modules", "dist", "out", "tmp", ".cache", "coverage"].includes(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && predicate(fullPath)) {
        results.push(fullPath);
      }
    }
  }
  walk(root);
  return results;
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function assertNoWebviewSurface() {
  const mainSource = read("src/main.js");
  assert.match(mainSource, /webviewTag:\s*false/, "BrowserWindow must keep webviewTag disabled by default.");
  assert.doesNotMatch(mainSource, /webviewTag:\s*true/, "webviewTag:true must not return without a dedicated security review.");

  const sourceFiles = rgFiles(path.join(repoRoot, "src"), (filePath) => /\.(js|jsx|ts|tsx|html)$/.test(filePath));
  const webviewFindings = sourceFiles
    .map((filePath) => ({ file: relative(filePath), source: fs.readFileSync(filePath, "utf8") }))
    .filter(({ source }) => /<\s*webview\b/i.test(source));
  assert.deepEqual(webviewFindings, [], "Renderer must not mount Electron <webview> surfaces.");
}

function assertPreviewIframeSandbox() {
  const appSource = read("src/renderer-app/src/app/App.tsx");
  const studioSource = read("src/renderer-app/src/features/studio/studio-route.tsx");
  const workspaceSource = read("src/renderer-app/src/features/workspace/workspace-route.tsx");
  const iframeSources = [
    { file: "src/renderer-app/src/app/App.tsx", source: appSource },
    { file: "src/renderer-app/src/features/studio/studio-route.tsx", source: studioSource },
    { file: "src/renderer-app/src/features/workspace/workspace-route.tsx", source: workspaceSource }
  ];
  for (const { file, source } of iframeSources) {
    assert.doesNotMatch(source, /sandbox=["'][^"']*allow-same-origin/i, `${file} must not grant allow-same-origin to plugin iframes.`);
    assert.doesNotMatch(source, /sandbox=["'][^"']*allow-top-navigation/i, `${file} must not grant top navigation to plugin iframes.`);
    assert.doesNotMatch(source, /sandbox=["'][^"']*allow-downloads/i, `${file} must not grant downloads to plugin iframes.`);
    assert.doesNotMatch(source, /sandbox=["'][^"']*allow-modals/i, `${file} must not grant modals to plugin iframes.`);
  }

  assert.match(
    studioSource,
    /sandbox="allow-scripts allow-forms"/,
    "Studio preview iframe sandbox changed; review plugin preview permissions before changing it."
  );
  assert.match(studioSource, /data-r2a-sidebar-iframe-mount="contract-only"/, "Studio sidebar iframe host must remain contract-only.");
  assert.match(studioSource, /data-r2a-sidebar-iframe-message-bridge="disabled"/, "Studio sidebar iframe message bridge must remain disabled.");
  assert.match(studioSource, /data-r2a-sidebar-iframe-persistence="disabled"/, "Studio sidebar iframe persistence must remain disabled.");

  assert.match(workspaceSource, /data-r2-workspace-widget-frame-mode="iframe-host"/, "Workspace iframe widget host contract is missing.");
  assert.match(workspaceSource, /sandbox="allow-scripts allow-forms"/, "Workspace widget iframe sandbox changed; review host permissions before changing it.");
  assert.match(appSource, /data-r2-feature-page-iframe=\{page\.id\}/, "Feature-page iframe route guard is missing.");
  assert.match(appSource, /sandbox="allow-scripts allow-forms"/, "Feature-page iframe sandbox changed; review host permissions before changing it.");
}

function assertWorkshopPackageBoundaryTestsRemain() {
  const safetySource = read("scripts/runtime-safety-boundaries.test.js");
  assert.match(safetySource, /testWorkshopPackageSafety/, "Runtime safety test must keep .meow package safety coverage.");
  assert.match(safetySource, /official import rejects external targetPath/, ".meow official import must reject external targetPath.");
  assert.match(safetySource, /test install rejects external targetPath/, ".meow test install must reject external targetPath.");
  assert.match(safetySource, /package files reject traversal paths/, ".meow package files must reject traversal paths.");

  const workshopSource = read("src/main/workshop-service.js");
  assert.match(workshopSource, /normalizeMeowRelativePath/, "Workshop service must normalize .meow relative paths.");
  assert.match(workshopSource, /allowedInstallRoot/, "Workshop import must enforce allowed install roots.");
  assert.match(workshopSource, /MEOW_PACKAGE_MAX_FILE_BYTES/, "Workshop export/import contract must keep file-size guard constants.");
  assert.match(workshopSource, /MEOW_PACKAGE_MAX_TOTAL_BYTES/, "Workshop export/import contract must keep total-size guard constants.");
  assert.match(workshopSource, /MEOW_PACKAGE_SKIP_DIRECTORIES/, "Workshop export must keep skip-directory guard constants.");
}

function main() {
  assertNoWebviewSurface();
  assertPreviewIframeSandbox();
  assertWorkshopPackageBoundaryTestsRemain();
  console.log(JSON.stringify({
    ok: true,
    webviewTag: "disabled",
    webviewElements: 0,
    iframeSandbox: "restricted",
    meowPackageBoundary: "covered"
  }));
}

main();

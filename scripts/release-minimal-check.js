const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs", "analysis");
const packageJsonPath = path.join(root, "package.json");
const packageLockPath = path.join(root, "package-lock.json");
const rendererDistDir = path.join(root, "dist", "renderer-app");
const rendererAssetsDir = path.join(rendererDistDir, "assets");
const internalPackageDir = path.join(root, "out", "meowdesk-internal-unpacked");
const internalPackageManifestPath = path.join(internalPackageDir, "meowdesk-internal-package.json");
const packagedLaunchSmokeReportPath = path.join(outDir, "meodesk-packaged-launch-smoke.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function fileSizeKb(filePath) {
  return Math.round((fs.statSync(filePath).size / 1024) * 100) / 100;
}

function listRendererAssets() {
  if (!exists(rendererAssetsDir)) return [];
  return fs.readdirSync(rendererAssetsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const filePath = path.join(rendererAssetsDir, entry.name);
      return {
        name: entry.name,
        sizeKb: fileSizeKb(filePath)
      };
    })
    .sort((a, b) => b.sizeKb - a.sizeKb || a.name.localeCompare(b.name));
}

function hasScript(scripts, pattern) {
  return Object.entries(scripts).some(([name, command]) => pattern.test(`${name} ${command}`));
}

function dependencyRecord(packageJson, name) {
  const version = packageJson.dependencies?.[name] || packageJson.devDependencies?.[name] || "";
  return {
    name,
    version,
    declared: Boolean(version),
    installed: exists(path.join(root, "node_modules", name, "package.json"))
  };
}

function maybeReadJson(filePath) {
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function timestampMs(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function blocker(id, message, resolved = false) {
  return { id, message, resolved };
}

function main() {
  const packageJson = readJson(packageJsonPath);
  const scripts = packageJson.scripts || {};
  const rendererAssets = listRendererAssets();
  const mainJsAsset = rendererAssets.find((asset) => /^index-.*\.js$/.test(asset.name));
  const hasPackageScript = hasScript(scripts, /\b(package|pack|dist|make|builder|forge)\b/i);
  const hasPackagedSmokeScript = hasScript(scripts, /\b(packaged|release).*\b(smoke|launch)\b|\b(smoke|launch).*\b(packaged|release)\b/i);
  const hasVerifyRenderer = Boolean(scripts["verify:renderer"]);
  const hasAnalyzeDeps = Boolean(scripts["analyze:deps"]);
  const hasMaintenanceAudit = Boolean(scripts["audit:maintenance"]);
  const hasRuntimeSafety = Boolean(scripts["test:runtime-safety"]);
  const verifyRendererCommand = scripts["verify:renderer"] || "";
  const hasMainServiceSyntaxGate = /node --check src\\main\\agent-runtime-context-service\.js/.test(verifyRendererCommand);
  const hasMaintenanceAuditSyntaxGate = /node --check scripts\\maintenance-final-audit\.js/.test(verifyRendererCommand);
  const hasReleaseMinimalCheckSyntaxGate = /node --check scripts\\release-minimal-check\.js/.test(verifyRendererCommand);
  const internalPackageManifest = maybeReadJson(internalPackageManifestPath);
  const packagedLaunchSmokeReport = maybeReadJson(packagedLaunchSmokeReportPath);
  const internalPackageGeneratedAt = timestampMs(internalPackageManifest?.generatedAt);
  const packagedLaunchSmokeGeneratedAt = timestampMs(packagedLaunchSmokeReport?.generatedAt);
  const packagedLaunchSmokeFresh = Boolean(
    packagedLaunchSmokeReport?.ok &&
    internalPackageGeneratedAt &&
    packagedLaunchSmokeGeneratedAt >= internalPackageGeneratedAt &&
    packagedLaunchSmokeReport.appRoot === path.join(internalPackageDir, "resources", "app")
  );
  const nativeDependencies = [
    dependencyRecord(packageJson, "node-pty"),
    dependencyRecord(packageJson, "electron")
  ];
  const blockers = [
    blocker("package-script", "A package/installer script should be defined in package.json.", hasPackageScript),
    blocker("packaged-launch-smoke", "A packaged-app launch smoke or release launch script should be defined.", hasPackagedSmokeScript),
    blocker("package-lock", "package-lock.json should exist for reproducible local dependency installs.", exists(packageLockPath)),
    blocker("source-verify", "verify:renderer should remain the source checkpoint gate.", hasVerifyRenderer),
    blocker("main-service-syntax-gate", "verify:renderer should check current main service modules.", hasMainServiceSyntaxGate),
    blocker("dependency-analysis", "analyze:deps should remain available for dependency inventory.", hasAnalyzeDeps),
    blocker("maintenance-audit", "audit:maintenance should remain available for final readiness snapshots.", hasMaintenanceAudit),
    blocker("maintenance-audit-syntax-gate", "verify:renderer should syntax-check maintenance-final-audit.js.", hasMaintenanceAuditSyntaxGate),
    blocker("release-minimal-check-syntax-gate", "verify:renderer should syntax-check release-minimal-check.js.", hasReleaseMinimalCheckSyntaxGate),
    blocker("runtime-safety", "test:runtime-safety should cover permission rejection paths before packaging.", hasRuntimeSafety),
    blocker("renderer-dist", "dist/renderer-app should exist from a fresh renderer build before an internal test build.", exists(rendererDistDir)),
    blocker("renderer-main-chunk", "Renderer main JS should stay below the old 500 kB warning threshold.", Boolean(mainJsAsset && mainJsAsset.sizeKb < 500)),
    blocker("internal-unpacked-package", "Internal unpacked package output should exist before treating packaged launch smoke as current.", Boolean(internalPackageManifest)),
    blocker("packaged-launch-smoke-report", "Packaged launch smoke report should exist from the current internal package loop.", packagedLaunchSmokeFresh)
  ];
  const report = {
    generatedAt: new Date().toISOString(),
    package: {
      name: packageJson.name,
      version: packageJson.version,
      main: packageJson.main
    },
    scripts: {
      verifyRenderer: verifyRendererCommand,
      analyzeDeps: scripts["analyze:deps"] || "",
      maintenanceAudit: scripts["audit:maintenance"] || "",
      runtimeSafety: scripts["test:runtime-safety"] || "",
      hasPackageScript,
      hasPackagedSmokeScript,
      hasMaintenanceAudit,
      hasMaintenanceAuditSyntaxGate,
      hasReleaseMinimalCheckSyntaxGate,
      hasMainServiceSyntaxGate
    },
    nativeDependencies,
    renderer: {
      distExists: exists(rendererDistDir),
      mainJsAsset: mainJsAsset || null,
      largestAssets: rendererAssets.slice(0, 12)
    },
    internalPackage: {
      dir: internalPackageDir,
      manifestExists: Boolean(internalPackageManifest),
      manifest: internalPackageManifest
    },
    packagedLaunchSmoke: {
      reportExists: Boolean(packagedLaunchSmokeReport),
      ok: Boolean(packagedLaunchSmokeReport?.ok),
      freshForCurrentInternalPackage: packagedLaunchSmokeFresh,
      reportGeneratedAt: packagedLaunchSmokeReport?.generatedAt || "",
      internalPackageGeneratedAt: internalPackageManifest?.generatedAt || "",
      scenario: packagedLaunchSmokeReport?.scenario || "",
      userDataDir: packagedLaunchSmokeReport?.userDataDir || ""
    },
    blockers,
    readyForSourceCheckpoint: blockers
      .filter((item) => ["package-lock", "source-verify", "main-service-syntax-gate", "dependency-analysis", "maintenance-audit", "maintenance-audit-syntax-gate", "release-minimal-check-syntax-gate", "runtime-safety", "renderer-dist", "renderer-main-chunk"].includes(item.id))
      .every((item) => item.resolved),
    readyForInternalPackagedBuild: blockers.every((item) => item.resolved)
  };

  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "meodesk-release-minimal-check.json");
  const mdPath = path.join(outDir, "meodesk-release-minimal-check.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, [
    "# Meowdesk Release Minimal Check",
    "",
    `> Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- package: \`${report.package.name}@${report.package.version}\``,
    `- readyForSourceCheckpoint: ${report.readyForSourceCheckpoint}`,
    `- readyForInternalPackagedBuild: ${report.readyForInternalPackagedBuild}`,
    `- renderer main chunk: ${report.renderer.mainJsAsset ? `${report.renderer.mainJsAsset.name} (${report.renderer.mainJsAsset.sizeKb} kB)` : "missing"}`,
    `- internal package: ${report.internalPackage.manifestExists ? report.internalPackage.dir : "missing"}`,
    `- packaged launch smoke: ${report.packagedLaunchSmoke.freshForCurrentInternalPackage ? `${report.packagedLaunchSmoke.scenario} passed for current package` : "missing or stale"}`,
    "",
    "## Blockers",
    "",
    ...report.blockers.map((item) => `- ${item.resolved ? "[x]" : "[ ]"} ${item.id}: ${item.message}`),
    "",
    "## Native Dependencies",
    "",
    ...report.nativeDependencies.map((item) => `- \`${item.name}\`: declared=${item.declared} version=${item.version || "-"} installed=${item.installed}`),
    "",
    "## Largest Renderer Assets",
    "",
    ...report.renderer.largestAssets.map((item) => `- \`${item.name}\`: ${item.sizeKb} kB`),
    "",
    "## Internal Package",
    "",
    `- dir: \`${report.internalPackage.dir}\``,
    `- manifestExists: ${report.internalPackage.manifestExists}`,
    `- packagedLaunchSmoke: ${report.packagedLaunchSmoke.freshForCurrentInternalPackage ? "passed for current package" : "missing or stale"}`,
    `- packagedSmokeScenario: ${report.packagedLaunchSmoke.scenario || "-"}`,
    `- packagedSmokeReportGeneratedAt: ${report.packagedLaunchSmoke.reportGeneratedAt || "-"}`,
    `- internalPackageGeneratedAt: ${report.packagedLaunchSmoke.internalPackageGeneratedAt || "-"}`,
    "",
    "## Minimal Loop",
    "",
    "```text",
    "npm run verify:renderer",
    "npm run analyze:deps",
    "npm run audit:maintenance",
    "npm run package:internal",
    "npm run smoke:packaged-launch",
    "npm run release:minimal-check",
    "```",
    "",
    "This is a release-readiness inventory only. It does not package, launch, sign, or publish Meowdesk.",
    ""
  ].join("\n"), "utf8");
  console.log(JSON.stringify({
    ok: true,
    readyForSourceCheckpoint: report.readyForSourceCheckpoint,
    readyForInternalPackagedBuild: report.readyForInternalPackagedBuild,
    unresolvedBlockers: report.blockers.filter((item) => !item.resolved).map((item) => item.id),
    report: path.relative(root, mdPath)
  }));
}

main();

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs", "analysis");

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function maybeReadJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch {
    return null;
  }
}

function gitSourceState() {
  const options = { cwd: root, encoding: "utf8", windowsHide: true };
  const head = spawnSync("git", ["rev-parse", "HEAD"], options);
  const status = spawnSync("git", ["status", "--short", "--untracked-files=all"], options);
  const sourceChanges = status.status === 0
    ? String(status.stdout || "")
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((line) => !line.slice(3).replace(/\\/g, "/").startsWith("docs/analysis/"))
    : null;
  return {
    generatedFromHead: head.status === 0 ? String(head.stdout || "").trim() : "unknown",
    sourceTreeDirty: sourceChanges === null ? null : sourceChanges.length > 0
  };
}

function fileStats(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return { file: relativePath, exists: false, lines: 0, sizeKb: 0 };
  }
  const text = fs.readFileSync(absolutePath, "utf8");
  return {
    file: relativePath,
    exists: true,
    lines: text.split(/\r?\n/).length,
    sizeKb: Math.round((Buffer.byteLength(text, "utf8") / 1024) * 100) / 100
  };
}

function listFiles(relativeDir, pattern = /\.(js|mjs|ts|tsx|css|html)$/i) {
  const base = path.join(root, relativeDir);
  if (!fs.existsSync(base)) return [];
  const result = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", "dist", "out", "tmp"].includes(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (pattern.test(entry.name)) {
        result.push(path.relative(root, fullPath).replace(/\\/g, "/"));
      }
    }
  };
  walk(base);
  return result.sort();
}

function countCssSelectors(cssText) {
  return cssText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith("{") && !line.startsWith("@") && !line.startsWith("from ") && !line.startsWith("to "))
    .length;
}

function scanForbiddenTerms(files, terms) {
  const hits = [];
  for (const file of files) {
    const text = readText(file.replace(/\//g, path.sep));
    for (const term of terms) {
      if (text.includes(term)) hits.push({ file, term });
    }
  }
  return hits;
}

function requireScript(scripts, name) {
  return Boolean(scripts[name]);
}

function commandHas(command, text) {
  return String(command || "").includes(text);
}

function makeBlocker(id, resolved, message) {
  return { id, resolved, message };
}

function releaseReadinessBlocker(item) {
  return ["release-ready", "packaged-launch-smoke", "release-source-head"].includes(item.id);
}

function main() {
  const packageJson = maybeReadJson("package.json") || {};
  const scripts = packageJson.scripts || {};
  const releaseCheck = maybeReadJson("docs/analysis/meodesk-release-minimal-check.json");
  const devHelperCheck = maybeReadJson("docs/analysis/meodesk-dev-helper-acceptance.json");
  const packagedLaunchSmoke = maybeReadJson("docs/analysis/meodesk-packaged-launch-smoke.json");
  const devHelperUnresolved = typeof devHelperCheck?.unresolved === "number"
    ? devHelperCheck.unresolved
    : Array.isArray(devHelperCheck?.unresolvedIssues)
      ? devHelperCheck.unresolvedIssues.length
      : null;
  const devHelperPendingReview = typeof devHelperCheck?.pendingReview === "number"
    ? devHelperCheck.pendingReview
    : Array.isArray(devHelperCheck?.pendingReviewIssues)
      ? devHelperCheck.pendingReviewIssues.length
      : null;
  const devHelperPassed = typeof devHelperCheck?.passed === "number"
    ? devHelperCheck.passed
    : Array.isArray(devHelperCheck?.passedIssues)
      ? devHelperCheck.passedIssues.length
      : 0;
  const verifyRenderer = scripts["verify:renderer"] || "";
  const cssText = readText("src/renderer-app/src/styles/app.css");
  const sourceFiles = listFiles("src");
  const forbiddenSourceHits = scanForbiddenTerms(sourceFiles, [
    "getDisplayMedia",
    "SetParent"
  ]);
  const retiredRendererPaths = [
    "src/renderer/index.html",
    "src/renderer/renderer.js",
    "src/renderer/styles.css"
  ];
  const pressureFiles = [
    fileStats("src/main.js"),
    fileStats("src/main/renderer-smoke-runner.js"),
    fileStats("src/main/renderer-smoke-heavy-scenarios.js"),
    fileStats("src/renderer-app/src/features/readiness/readiness-routes.tsx"),
    fileStats("src/renderer-app/src/features/workspace/workspace-route.tsx"),
    fileStats("src/renderer-app/src/features/studio/studio-route.tsx"),
    fileStats("src/renderer-app/src/features/meow-viewer/meow-viewer-parser.ts"),
    fileStats("src/renderer-app/src/styles/app.css")
  ];
  const mainServiceFiles = fs.readdirSync(path.join(root, "src", "main"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => fileStats(path.join("src", "main", entry.name)))
    .sort((a, b) => b.lines - a.lines || b.sizeKb - a.sizeKb);
  const css = {
    file: "src/renderer-app/src/styles/app.css",
    lines: fileStats("src/renderer-app/src/styles/app.css").lines,
    selectors: countCssSelectors(cssText),
    containsForbiddenRuntimeTerms: ["getDisplayMedia", "SetParent", "legacy renderer"].filter((term) => cssText.includes(term)),
    bodyMinWidthRule: /body\s*\{[\s\S]*?min-width:\s*0\s*;/.test(cssText)
  };
  const workbenchContract = scripts["test:workbench-contract"] || "";
  const mvpBaselineCommands = [
    "npm run test:workbench-contract",
    "npm run test:runtime-safety",
    "npm run test:agent-lifecycle",
    "npm run test:product-shell-contract",
    "npm run test:runtime-ownership",
    "npm run test:vs-legacy-isolation"
  ];
  const gateCoverage = {
    verifyRendererExists: requireScript(scripts, "verify:renderer"),
    mvpBaselineInVerify: mvpBaselineCommands.every((command) => commandHas(verifyRenderer, command))
      && commandHas(workbenchContract, "npm run test:mvp-baseline"),
    runtimeSafetyInVerify: commandHas(verifyRenderer, "npm run test:runtime-safety"),
    smokeRegistryInVerify: commandHas(verifyRenderer, "npm run test:renderer-smoke-registry"),
    meowViewerFixtureCheckInVerify: commandHas(verifyRenderer, "npm run test:meow-viewer-parser:check"),
    runtimeContextServiceCheckInVerify: commandHas(verifyRenderer, "node --check src\\main\\agent-runtime-context-service.js"),
    maintenanceAuditCheckInVerify: commandHas(verifyRenderer, "node --check scripts\\maintenance-final-audit.js"),
    projectEvaluationCheckInVerify: commandHas(verifyRenderer, "node --check scripts\\project-evaluation-packet.js"),
    packageInternalExists: requireScript(scripts, "package:internal"),
    packagedLaunchSmokeExists: requireScript(scripts, "smoke:packaged-launch"),
    releaseMinimalCheckExists: requireScript(scripts, "release:minimal-check"),
    devHelperAcceptanceExists: requireScript(scripts, "dev-helper:acceptance-check"),
    projectEvaluationExists: requireScript(scripts, "audit:project"),
    workspaceHotspotsExists: exists("docs/architecture/workspace-route-hotspots.md"),
    studioHotspotsExists: exists("docs/architecture/studio-route-hotspots.md"),
    cssAdmissionExists: exists("docs/architecture/css-admission-policy.md"),
    analyzeDepsExists: requireScript(scripts, "analyze:deps")
  };
  const sourceState = gitSourceState();
  const packagedLaunchSmokeFresh = Boolean(releaseCheck?.packagedLaunchSmoke?.freshForCurrentInternalPackage);
  const releaseReportsFreshForHead = Boolean(
    releaseCheck?.generatedFromHead
      && packagedLaunchSmoke?.generatedFromHead
      && releaseCheck.generatedFromHead === sourceState.generatedFromHead
      && packagedLaunchSmoke.generatedFromHead === sourceState.generatedFromHead
  );
  const blockers = [
    makeBlocker("retired-renderer-files", retiredRendererPaths.every((file) => !exists(file)), "Retired legacy renderer files must stay absent."),
    makeBlocker("forbidden-runtime-source-terms", forbiddenSourceHits.length === 0, "Runtime source must not reintroduce getDisplayMedia or raw HWND SetParent."),
    makeBlocker("verify-mvp-baseline", gateCoverage.mvpBaselineInVerify, "verify:renderer must include the post-Workflow MVP baseline contract and its core gates."),
    makeBlocker("verify-runtime-safety", gateCoverage.runtimeSafetyInVerify, "verify:renderer must include runtime safety tests."),
    makeBlocker("verify-smoke-registry", gateCoverage.smokeRegistryInVerify, "verify:renderer must include smoke registry coverage."),
    makeBlocker("verify-runtime-context-service", gateCoverage.runtimeContextServiceCheckInVerify, "verify:renderer must syntax-check agent-runtime-context-service."),
    makeBlocker("verify-maintenance-audit", gateCoverage.maintenanceAuditCheckInVerify, "verify:renderer must syntax-check maintenance-final-audit."),
    makeBlocker("verify-project-evaluation", gateCoverage.projectEvaluationCheckInVerify && gateCoverage.projectEvaluationExists, "verify:renderer must syntax-check project-evaluation-packet and audit:project must exist."),
    makeBlocker("workspace-hotspots-policy", gateCoverage.workspaceHotspotsExists, "Workspace route pressure file must have hotspot admission guidance."),
    makeBlocker("studio-hotspots-policy", gateCoverage.studioHotspotsExists, "Studio route pressure file must have hotspot admission guidance."),
    makeBlocker("css-admission-policy", gateCoverage.cssAdmissionExists, "CSS growth must have an admission policy."),
    makeBlocker("release-ready", Boolean(releaseCheck?.readyForSourceCheckpoint && releaseCheck?.readyForInternalPackagedBuild), "release:minimal-check report must be green."),
    makeBlocker("packaged-launch-smoke", packagedLaunchSmokeFresh, "packaged launch smoke report must be fresh for the current internal package."),
    makeBlocker("release-source-head", releaseReportsFreshForHead, "Release and packaged-launch reports must explicitly match the current source HEAD."),
    makeBlocker("dev-helper-acceptance", Boolean(devHelperCheck?.ok && devHelperUnresolved === 0 && devHelperPendingReview === 0), "Dev Helper acceptance ledger must have no unresolved or pending review items."),
    makeBlocker("css-runtime-boundary", css.containsForbiddenRuntimeTerms.length === 0, "CSS must remain visual-only and not carry runtime/embedding terms.")
  ];
  const featureDevelopmentBlockers = blockers.filter((item) => !releaseReadinessBlocker(item));
  const releaseBlockers = blockers.filter(releaseReadinessBlocker);
  const report = {
    generatedAt: new Date().toISOString(),
    ...sourceState,
    package: {
      name: packageJson.name,
      version: packageJson.version
    },
    readyForFeatureDevelopment: featureDevelopmentBlockers.every((item) => item.resolved),
    readyForRelease: blockers.every((item) => item.resolved),
    blockers,
    featureDevelopmentBlockers,
    releaseBlockers,
    gateCoverage,
    pressureFiles,
    mainServiceFiles,
    css,
    retiredRendererPaths: retiredRendererPaths.map((file) => ({ file, exists: exists(file) })),
    forbiddenSourceHits,
    reports: {
      release: {
        readyForSourceCheckpoint: Boolean(releaseCheck?.readyForSourceCheckpoint),
        readyForInternalPackagedBuild: Boolean(releaseCheck?.readyForInternalPackagedBuild),
        generatedFromHead: releaseCheck?.generatedFromHead || "",
        freshForCurrentHead: releaseReportsFreshForHead,
        unresolvedBlockers: releaseCheck?.blockers?.filter((item) => !item.resolved).map((item) => item.id) || []
      },
      packagedLaunchSmoke: {
        ok: Boolean(packagedLaunchSmoke?.ok),
        generatedFromHead: packagedLaunchSmoke?.generatedFromHead || "",
        freshForCurrentInternalPackage: packagedLaunchSmokeFresh,
        scenario: packagedLaunchSmoke?.scenario || ""
      },
      devHelperAcceptance: {
        ok: Boolean(devHelperCheck?.ok),
        passed: devHelperPassed,
        unresolved: devHelperUnresolved,
        pendingReview: devHelperPendingReview
      }
    },
    remainingTrackedDebt: [
      "Large service modules should be split by domain only when a behavior change or focused refactor needs it.",
      "Workspace/Studio route files remain pressure files, but pure model/storage helpers now have dedicated owner modules and hotspot admission policies.",
      "Meow Viewer parser remains behavior-rich; future parser changes should be fixture-first.",
      "CSS remains a large visual leaf file with a feature admission policy; avoid UI restyling during maintenance-only goals.",
      "Residual pressure files are now tracked by audit:project for external review and feature admission."
    ]
  };

  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "meodesk-maintenance-final-audit.json");
  const mdPath = path.join(outDir, "meodesk-maintenance-final-audit.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, [
    "# Meowdesk Maintenance Final Audit",
    "",
    `> Generated: ${report.generatedAt}`,
    `> Generated from HEAD: ${report.generatedFromHead}`,
    `> Source tree dirty: ${report.sourceTreeDirty}`,
    "",
    "## Summary",
    "",
    `- readyForFeatureDevelopment: ${report.readyForFeatureDevelopment}`,
    `- unresolvedFeatureBlockers: ${report.featureDevelopmentBlockers.filter((item) => !item.resolved).map((item) => item.id).join(", ") || "none"}`,
    `- readyForRelease: ${report.readyForRelease}`,
    `- unresolvedReleaseBlockers: ${report.releaseBlockers.filter((item) => !item.resolved).map((item) => item.id).join(", ") || "none"}`,
    `- packagedLaunchSmoke: ${report.reports.packagedLaunchSmoke.freshForCurrentInternalPackage ? `${report.reports.packagedLaunchSmoke.scenario} passed for current package` : "missing or stale for current package"}`,
    `- devHelperAcceptance: passed=${report.reports.devHelperAcceptance.passed}, unresolved=${report.reports.devHelperAcceptance.unresolved}, pendingReview=${report.reports.devHelperAcceptance.pendingReview}`,
    "",
    "## Readiness Definition",
    "",
    "`readyForFeatureDevelopment: true` means feature-development readiness is green: P0/P1 blocking maintenance debt is resolved, verification and governance gates are present, and remaining pressure files are tracked.",
    "",
    "It does not mean every pressure file has been physically split to an ideal final size, and it does not mean public installer/signing/release work is complete.",
    "",
    "## Blockers",
    "",
    ...report.blockers.map((item) => `- ${item.resolved ? "[x]" : "[ ]"} ${item.id}: ${item.message}`),
    "",
    "## Gate Coverage",
    "",
    ...Object.entries(report.gateCoverage).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Pressure Files",
    "",
    ...report.pressureFiles.map((item) => `- \`${item.file}\`: exists=${item.exists}, lines=${item.lines}, size=${item.sizeKb} kB`),
    "",
    "## Main Services",
    "",
    ...report.mainServiceFiles.map((item) => `- \`${item.file}\`: lines=${item.lines}, size=${item.sizeKb} kB`),
    "",
    "## CSS Leaf Audit",
    "",
    `- file: \`${report.css.file}\``,
    `- lines: ${report.css.lines}`,
    `- selectors: ${report.css.selectors}`,
    `- bodyMinWidthRuleIsZero: ${report.css.bodyMinWidthRule}`,
    `- forbiddenRuntimeTerms: ${report.css.containsForbiddenRuntimeTerms.join(", ") || "none"}`,
    "",
    "## Remaining Tracked Debt",
    "",
    ...report.remainingTrackedDebt.map((item) => `- ${item}`),
    "",
    "This audit is a maintenance/readiness snapshot. It does not replace `npm run verify:renderer`.",
    ""
  ].join("\n"), "utf8");
  console.log(JSON.stringify({
    ok: true,
    readyForFeatureDevelopment: report.readyForFeatureDevelopment,
    readyForRelease: report.readyForRelease,
    unresolvedBlockers: report.featureDevelopmentBlockers.filter((item) => !item.resolved).map((item) => item.id),
    unresolvedReleaseBlockers: report.releaseBlockers.filter((item) => !item.resolved).map((item) => item.id),
    report: path.relative(root, mdPath)
  }));
}

main();

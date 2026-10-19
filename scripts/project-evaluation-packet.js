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
    file: relativePath.replace(/\\/g, "/"),
    exists: true,
    lines: text.split(/\r?\n/).length,
    sizeKb: Math.round((Buffer.byteLength(text, "utf8") / 1024) * 100) / 100
  };
}

function listFiles(relativeDir, pattern) {
  const base = path.join(root, relativeDir);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => fileStats(path.join(relativeDir, entry.name)))
    .sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file));
}

function makeCheck(id, resolved, message, evidence = "") {
  return { id, resolved: Boolean(resolved), message, evidence };
}

function scriptHas(scripts, scriptName, text) {
  return String(scripts?.[scriptName] || "").includes(text);
}

function unresolvedIds(checks) {
  return checks.filter((item) => !item.resolved).map((item) => item.id);
}

function buildClaudePrompt({ packageJson, checks, pressureFiles, mainServices }) {
  const unresolved = unresolvedIds(checks);
  const readinessPercent = unresolved.length === 0
    ? 100
    : Math.round(((checks.length - unresolved.length) / checks.length) * 100);
  const largestPressureFiles = pressureFiles
    .filter((item) => item.exists)
    .map((item) => `- ${item.file}: ${item.lines} lines, ${item.sizeKb} kB`)
    .join("\n");
  const largestServices = mainServices
    .slice(0, 8)
    .map((item) => `- ${item.file}: ${item.lines} lines, ${item.sizeKb} kB`)
    .join("\n");

  return [
    "# Claude Review Prompt: Meowdesk Post-Maintenance Evaluation",
    "",
    "你是 Meowdesk 的外部工程治理审查员。请基于当前代码事实做评估，不要只按文件行数下结论，也不要为了继续重构而重构。",
    "",
    "## 辩论设定",
    "",
    "这不是普通代码审查，而是一场 Claude 与 Codex 的工程治理小辩论。",
    "",
    "- 你这边负责做刁钻、尖锐、怀疑主义的外部提问方：主动寻找盲点、假绿、边界漏洞、过度乐观和后续开发成本。",
    "- Codex 那边负责结合 Meowdesk 的真实代码、验证链、历史约束和落地成本回应你：该接受的接受，该降级的降级，该反驳的反驳。",
    "- 你的目标不是赢，也不是迎合 Codex；你的目标是把最有价值的问题逼出来。",
    "- 但每个质疑都必须可验证。不要只说“这看起来很乱”；请给路径、证据、风险、急迫性和最小修复建议。",
    "- 请主动标注哪些问题适合进入辩论焦点，哪些只是普通 P2/P3 维护建议。",
    "",
    "## 工作区与限制",
    "",
    "```text",
    "工作区：<PROJECT_ROOT>",
    "主基线：<BASELINE_ROOT> 不要碰",
    `项目：${packageJson.name || "meowdesk"}@${packageJson.version || "unknown"}`,
    "不要 reset / hard reset",
    "不要 push / PR / commit，除非用户明确授权",
    "不要恢复 legacy renderer、desktop embedding、getDisplayMedia 投屏、裸 HWND SetParent",
    "不要把 Dev Helper 并入 Meowdesk；它是外部验收/ledger",
    "不要做 UI/CSS 重设计",
    "```",
    "",
    "## 代码与工程路径",
    "",
    "```text",
    "当前代码工作区：<PROJECT_ROOT>",
    "当前分支：claude/tech-debt-phase1",
    "主基线源码：<BASELINE_ROOT> （不要触碰）",
    "Brain2 项目入口：E:\\Brain2\\08 开发\\Meodesk\\README.md",
    "Brain2 项目进度：E:\\Brain2\\08 开发\\Meodesk\\进度\\进度索引.md",
    "最终维护审计：<PROJECT_ROOT>\\docs\\analysis\\meodesk-maintenance-final-audit.md",
    "项目评估包：<PROJECT_ROOT>\\docs\\analysis\\meodesk-project-evaluation-packet.md",
    "Claude 辩论 prompt：<PROJECT_ROOT>\\docs\\analysis\\meodesk-claude-evaluation-prompt.md",
    "最终 renderer 验证日志：<PROJECT_ROOT>\\tmp\\verify-final-last.log",
    "外部 Dev Helper / Problem Logger：<EXTERNAL_ACCEPTANCE_ROOT> （只作为外部验收账本，不并入 Meowdesk）",
    "```",
    "",
    "审查代码时优先看当前代码工作区，不要在主基线目录施工。Brain2 用来恢复上下文和约束，仓库报告与源码用来验证事实。",
    "",
    "## 共享大脑接入",
    "",
    "旧聊天框已经失效，不要依赖旧聊天记忆。请把 Brain2 和仓库报告当作当前事实源，先完成共享大脑接入，再开始评价。",
    "",
    "如果你在 Claude Code / Claude Desktop 侧执行，请先只读这些 Brain2 入口：",
    "",
    "```text",
    "E:\\Brain2\\NAV.md",
    "E:\\Brain2\\06 AI助理协同\\START_HERE.md",
    "E:\\Brain2\\06 AI助理协同\\规则\\大脑治理总则.md",
    "E:\\Brain2\\06 AI助理协同\\当前上下文.md",
    "E:\\Brain2\\06 AI助理协同\\收件箱.md",
    "E:\\Brain2\\08 开发\\Meodesk\\README.md",
    "E:\\Brain2\\08 开发\\Meodesk\\进度\\进度索引.md",
    "E:\\Brain2\\08 开发\\Meodesk\\进度\\2026-06-08-Meowdesk工程治理最终100与Claude评估辩论入口.md",
    "E:\\Brain2\\08 开发\\Meodesk\\进度\\2026-06-07-Meowdesk工程治理四期PhaseS-最终审计与开发准入收口.md",
    "E:\\Brain2\\08 开发\\Meodesk\\进度\\2026-07-10-Meowdesk-GPT-Codex更新后暂停与GPT56接手口径.md",
    "```",
    "",
    "接入要求：",
    "",
    "- 先复述你从 Brain2 读到的当前 Meowdesk 状态，再开始审查。",
    "- 不要把历史聊天中的判断当作证据；证据必须来自 Brain2、仓库文件、报告或你重新读取的代码。",
    "- 如果 Brain2 与仓库报告冲突，请指出冲突并以当前仓库报告为第一现场证据。",
    "- 在用户明确要求前，不要修改代码、不要提交、不要 push、不要启动/关闭用户真实 Meowdesk 实例。",
    "",
    "## 必读事实底稿",
    "",
    "请先读这些文件，再评价：",
    "",
    "```text",
    "docs/analysis/meodesk-project-evaluation-packet.md",
    "docs/analysis/meodesk-maintenance-final-audit.md",
    "docs/analysis/meodesk-release-minimal-check.md",
    "docs/analysis/meodesk-dev-helper-acceptance.md",
    "docs/analysis/meodesk-packaged-launch-smoke.md",
    "docs/architecture/current-runtime-boundaries.md",
    "docs/architecture/development-workflow.md",
    "docs/architecture/ownership-governance.md",
    "docs/architecture/feature-admission-checklist.md",
    "docs/architecture/runtime-safety-permissions.md",
    "docs/architecture/performance-bundle-governance.md",
    "docs/architecture/release-readiness.md",
    "```",
    "",
    "## 当前自检状态",
    "",
    `- evaluation checks unresolved: ${unresolved.length ? unresolved.join(", ") : "none"}`,
    "- maintenanceCompletionPercent=" + readinessPercent + "；只有 100 才表示当前 feature-development readiness checks 全绿。",
    "- 它不是 debt clearance 100%，也不代表所有压力文件已经机械拆到理想大小。",
    "- Workflow Beta 已归档到独立 branch/tag，不属于当前 MVP runtime；不要建议恢复旧 route、IPC、service 或 battery 协议。",
    "- maintenance-final-audit 当前目标是：阻塞债清零、非阻塞债被治理，不代表所有大文件已经机械拆完。",
    "- release 状态是 internal unpacked package / minimal release readiness，不是签名安装包或公开发布。",
    "- Claude/Codex 辩论后的 P1-lite 共识：checkpoint commit、Workspace/Studio hotspot policy、CSS admission policy。",
    "",
    "## 压力文件",
    "",
    largestPressureFiles || "- none",
    "",
    "## Main Service 热点",
    "",
    largestServices || "- none",
    "",
    "## 你的任务",
    "",
    "请输出一份工程评估，分成以下类别：",
    "",
    "1. P0 阻塞：现在不修就不应继续开发功能的问题。",
    "2. P1 急迫：短期应修，否则会显著增加后续功能成本或安全风险的问题。",
    "3. P2 值得：有价值，但可以等到触发相关功能/行为变更时处理的问题。",
    "4. 误报/过度治理：看起来脏，但当前已有约束、测试或治理，不建议继续拆的问题。",
    "",
    "每条意见都必须给出：",
    "",
    "- 代码或报告路径，尽量带行号",
    "- 具体风险，不要只写“文件太大”",
    "- 为什么急或不急",
    "- 建议的最小修复方式",
    "- 应该运行的验证命令",
    "",
    "额外要求：",
    "",
    "- 明确指出哪些建议你愿意撤回或降级。",
    "- 如果建议拆文件，请说明拆分后的 owner、契约、测试入口和回滚方式。",
    "- 如果建议安全/IPC/文件访问变更，请指出允许和拒绝规则。",
    "- 不要建议恢复被禁止的旧能力。",
    "- 不要把“公开发布缺口”和“继续本地功能开发缺口”混为一谈。",
    ""
  ].join("\n");
}

function main() {
  const packageJson = maybeReadJson("package.json") || {};
  const scripts = packageJson.scripts || {};
  const verifyRenderer = scripts["verify:renderer"] || "";
  const workbenchContract = scripts["test:workbench-contract"] || "";
  const mvpBaselineCommands = [
    "npm run test:workbench-contract",
    "npm run test:runtime-safety",
    "npm run test:agent-lifecycle",
    "npm run test:product-shell-contract",
    "npm run test:runtime-ownership",
    "npm run test:vs-legacy-isolation"
  ];
  const mvpBaselineCovered = mvpBaselineCommands.every((command) => verifyRenderer.includes(command))
    && workbenchContract.includes("npm run test:mvp-baseline");
  const finalAudit = maybeReadJson("docs/analysis/meodesk-maintenance-final-audit.json");
  const releaseCheck = maybeReadJson("docs/analysis/meodesk-release-minimal-check.json");
  const devHelper = maybeReadJson("docs/analysis/meodesk-dev-helper-acceptance.json");
  const packagedSmoke = maybeReadJson("docs/analysis/meodesk-packaged-launch-smoke.json");

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
  const mainServices = listFiles("src/main", /\.js$/);
  const smokeScenarioFiles = listFiles("src/main/renderer-smoke-scenarios", /\.js$/);
  const docs = [
    "docs/architecture/current-runtime-boundaries.md",
    "docs/architecture/development-workflow.md",
    "docs/architecture/engineering-governance-roadmap.md",
    "docs/architecture/ownership-governance.md",
    "docs/architecture/feature-admission-checklist.md",
    "docs/architecture/workspace-route-hotspots.md",
    "docs/architecture/studio-route-hotspots.md",
    "docs/architecture/css-admission-policy.md",
    "docs/architecture/runtime-safety-permissions.md",
    "docs/architecture/performance-bundle-governance.md",
    "docs/architecture/release-readiness.md"
  ];
  const checks = [
    makeCheck("maintenance-final-audit-green", finalAudit?.readyForFeatureDevelopment, "Final maintenance audit must be green.", "npm run audit:maintenance"),
    makeCheck("release-minimal-check-green", releaseCheck?.readyForSourceCheckpoint && releaseCheck?.readyForInternalPackagedBuild, "Minimal release/internal package inventory must be green.", "npm run release:minimal-check"),
    makeCheck("dev-helper-accepted", devHelper?.ok && Number(devHelper?.unresolved || 0) === 0 && Number(devHelper?.pendingReview || 0) === 0, "Dev Helper acceptance ledger must have no unresolved or pending review items.", "npm run dev-helper:acceptance-check"),
    makeCheck("packaged-launch-smoke-green", packagedSmoke?.ok, "Internal packaged launch smoke should be green.", "npm run smoke:packaged-launch"),
    makeCheck("verify-has-mvp-baseline", mvpBaselineCovered, "verify:renderer must include the post-Workflow MVP baseline contract and its core gates.", "npm run test:mvp-baseline"),
    makeCheck("verify-has-runtime-safety", scriptHas(scripts, "verify:renderer", "npm run test:runtime-safety"), "verify:renderer must include runtime safety coverage."),
    makeCheck("verify-has-smoke-registry", scriptHas(scripts, "verify:renderer", "npm run test:renderer-smoke-registry"), "verify:renderer must include renderer smoke registry coverage."),
    makeCheck("verify-has-parser-fixtures", scriptHas(scripts, "verify:renderer", "npm run test:meow-viewer-parser:check"), "verify:renderer must include parser fixture syntax coverage."),
    makeCheck("audit-project-script", Boolean(scripts["audit:project"]), "audit:project must generate the project evaluation packet."),
    makeCheck("audit-project-syntax-gate", scriptHas(scripts, "verify:renderer", "node --check scripts\\project-evaluation-packet.js"), "verify:renderer must syntax-check project-evaluation-packet.js."),
    makeCheck("feature-admission-doc", exists("docs/architecture/feature-admission-checklist.md"), "Future features need a written admission checklist."),
    makeCheck("workspace-hotspots-doc", exists("docs/architecture/workspace-route-hotspots.md"), "Workspace route pressure file needs hotspot admission guidance."),
    makeCheck("studio-hotspots-doc", exists("docs/architecture/studio-route-hotspots.md"), "Studio route pressure file needs hotspot admission guidance."),
    makeCheck("css-admission-doc", exists("docs/architecture/css-admission-policy.md"), "CSS growth needs an admission policy before new feature styling."),
    makeCheck("runtime-boundary-doc", exists("docs/architecture/runtime-safety-permissions.md"), "Runtime and permission boundaries need a written policy."),
    makeCheck("release-readiness-doc", exists("docs/architecture/release-readiness.md"), "Release limitations need a written policy."),
    makeCheck("all-architecture-docs-present", docs.every(exists), "The architecture handoff document set must be present.")
  ];
  const unresolved = unresolvedIds(checks);
  const maintenanceCompletionPercent = unresolved.length === 0
    ? 100
    : Math.round(((checks.length - unresolved.length) / checks.length) * 100);
  const residualDebtLedger = [
    {
      area: "Main process services",
      status: "governed-non-blocking",
      currentState: "src/main.js is a coordinator under the old pressure threshold; large service modules remain but have owner files.",
      nextTrigger: "Split only when a behavior change needs a smaller owner boundary or service-specific contract test.",
      guardrail: "New main-process behavior should enter src/main/* service modules, not src/main.js."
    },
    {
      area: "Workspace and Studio routes",
      status: "governed-non-blocking",
      currentState: "Route files remain large runtime surfaces; pure model/storage helpers have owner modules.",
      nextTrigger: "Extract hooks/components when touching pane lifecycle, Studio runtime, or workshop UI behavior.",
      guardrail: "Do not place new product behavior into readiness fixtures as a shortcut."
    },
    {
      area: "Meow Viewer parser",
      status: "governed-non-blocking",
      currentState: "Parser is still behavior-rich, but contract/profile concerns and parser fixtures are split out.",
      nextTrigger: "Any parser rule change must add or adjust fixtures first.",
      guardrail: "Do not add parser heuristics without fixture coverage."
    },
    {
      area: "Renderer smoke scenarios",
      status: "governed-non-blocking",
      currentState: "Central runner is dispatch-only; remaining debt is inside long scenario bodies and DOM helper repetition.",
      nextTrigger: "Extract scenario helpers when adding or changing smokes in the same domain.",
      guardrail: "Do not paste long executeJavaScript bodies back into renderer-smoke-runner.js."
    },
    {
      area: "CSS",
      status: "visual-leaf-non-blocking",
      currentState: "app.css is large but audited as a visual leaf with no runtime/embedding terms.",
      nextTrigger: "Segment styles only with a visible-surface smoke after a UI/layout change.",
      guardrail: "No CSS/UI redesign during maintenance-only work."
    },
    {
      area: "Release engineering",
      status: finalAudit?.readyForRelease ? "current-head-release-evidence-green" : "release-evidence-stale-for-current-head",
      currentState: finalAudit?.readyForRelease
        ? "Release and packaged-launch reports explicitly match the current source HEAD."
        : "Prior internal package evidence is historical; the current source HEAD is not release-verified.",
      nextTrigger: "Start installer/signing/migration diagnostics only when the user asks for release/beta distribution.",
      guardrail: "Do not block local feature development on public-release-only requirements."
    }
  ];
  const sourceState = gitSourceState();
  const report = {
    generatedAt: new Date().toISOString(),
    ...sourceState,
    package: {
      name: packageJson.name,
      version: packageJson.version
    },
    maintenanceCompletionPercent,
    featureDevelopmentReadinessPercent: maintenanceCompletionPercent,
    externalReviewReady: unresolved.length === 0,
    releaseReadyForCurrentHead: Boolean(finalAudit?.readyForRelease),
    unresolvedChecks: unresolved,
    readinessDefinition: {
      means: [
        "feature-development readiness checks are green",
        "P0/P1 blocking maintenance debt is resolved",
        "remaining pressure files are tracked and governed",
        "future work must still pass owner/test/rollback admission"
      ],
      doesNotMean: [
        "all pressure files have been physically split to an ideal final size",
        "public installer/signing/release work is complete",
        "new features can bypass feature-admission discipline"
      ]
    },
    p1LiteCloseout: [
      "checkpoint commit or named evidence package before new feature work",
      "Workspace/Studio hotspot policy for route pressure files",
      "CSS admission policy before broad feature styling"
    ],
    checks,
    reports: {
      maintenanceFinalAudit: {
        readyForFeatureDevelopment: Boolean(finalAudit?.readyForFeatureDevelopment),
        readyForRelease: Boolean(finalAudit?.readyForRelease),
        unresolvedBlockers: finalAudit?.blockers?.filter((item) => !item.resolved).map((item) => item.id) || []
      },
      releaseMinimalCheck: {
        readyForSourceCheckpoint: Boolean(releaseCheck?.readyForSourceCheckpoint),
        readyForInternalPackagedBuild: Boolean(releaseCheck?.readyForInternalPackagedBuild)
      },
      devHelperAcceptance: {
        ok: Boolean(devHelper?.ok),
        unresolved: Number(devHelper?.unresolved || 0),
        pendingReview: Number(devHelper?.pendingReview || 0)
      },
      packagedLaunchSmoke: {
        ok: Boolean(packagedSmoke?.ok),
        scenario: packagedSmoke?.scenario || ""
      }
    },
    pressureFiles,
    mainServices,
    smokeScenarioFiles,
    residualDebtLedger,
    architectureDocs: docs.map((file) => ({ file, exists: exists(file) })),
    claudePrompt: "docs/analysis/meodesk-claude-evaluation-prompt.md"
  };

  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "meodesk-project-evaluation-packet.json");
  const mdPath = path.join(outDir, "meodesk-project-evaluation-packet.md");
  const promptPath = path.join(outDir, "meodesk-claude-evaluation-prompt.md");
  const prompt = buildClaudePrompt({ packageJson, checks, pressureFiles, mainServices });

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(promptPath, prompt, "utf8");
  fs.writeFileSync(mdPath, [
    "# Meowdesk Project Evaluation Packet",
    "",
    `> Generated: ${report.generatedAt}`,
    `> Generated from HEAD: ${report.generatedFromHead}`,
    `> Source tree dirty: ${report.sourceTreeDirty}`,
    "",
    "## Summary",
    "",
    `- featureDevelopmentReadinessPercent: ${report.featureDevelopmentReadinessPercent}`,
    `- maintenanceCompletionPercent: ${report.maintenanceCompletionPercent}`,
    `- externalReviewReady: ${report.externalReviewReady}`,
    `- releaseReadyForCurrentHead: ${report.releaseReadyForCurrentHead}`,
    `- unresolvedChecks: ${report.unresolvedChecks.join(", ") || "none"}`,
    `- claudePrompt: \`${report.claudePrompt}\``,
    "",
    "## Readiness Definition",
    "",
    "When this report says `maintenanceCompletionPercent: 100`, it means feature-development readiness checks are green.",
    "",
    "It means:",
    "",
    ...report.readinessDefinition.means.map((item) => `- ${item}`),
    "",
    "It does not mean:",
    "",
    ...report.readinessDefinition.doesNotMean.map((item) => `- ${item}`),
    "",
    "## P1-Lite Closeout",
    "",
    ...report.p1LiteCloseout.map((item) => `- ${item}`),
    "",
    "## Checks",
    "",
    ...report.checks.map((item) => `- ${item.resolved ? "[x]" : "[ ]"} ${item.id}: ${item.message}${item.evidence ? ` (${item.evidence})` : ""}`),
    "",
    "## Pressure Files",
    "",
    ...report.pressureFiles.map((item) => `- \`${item.file}\`: exists=${item.exists}, lines=${item.lines}, size=${item.sizeKb} kB`),
    "",
    "## Main Services",
    "",
    ...report.mainServices.map((item) => `- \`${item.file}\`: lines=${item.lines}, size=${item.sizeKb} kB`),
    "",
    "## Renderer Smoke Scenario Files",
    "",
    ...report.smokeScenarioFiles.map((item) => `- \`${item.file}\`: lines=${item.lines}, size=${item.sizeKb} kB`),
    "",
    "## Residual Debt Ledger",
    "",
    ...report.residualDebtLedger.flatMap((item) => [
      `### ${item.area}`,
      "",
      `- status: ${item.status}`,
      `- currentState: ${item.currentState}`,
      `- nextTrigger: ${item.nextTrigger}`,
      `- guardrail: ${item.guardrail}`,
      ""
    ]),
    "## Architecture Documents",
    "",
    ...report.architectureDocs.map((item) => `- \`${item.file}\`: exists=${item.exists}`),
    "",
    "## External Review Use",
    "",
    "Use `docs/analysis/meodesk-claude-evaluation-prompt.md` when asking an external reviewer to evaluate the project.",
    "The expected review output is not a new feature plan; it should classify issues as blockers, urgent debt, worthwhile follow-up, or over-governance/false positive.",
    ""
  ].join("\n"), "utf8");

  console.log(JSON.stringify({
    ok: true,
    maintenanceCompletionPercent,
    externalReviewReady: report.externalReviewReady,
    unresolvedChecks: unresolved,
    report: path.relative(root, mdPath),
    prompt: path.relative(root, promptPath)
  }));
}

main();

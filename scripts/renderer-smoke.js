const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const renderer = process.argv[2] || "default";
const screenshotFlagIndex = process.argv.indexOf("--screenshot");
const screenshotPath = screenshotFlagIndex >= 0 ? process.argv[screenshotFlagIndex + 1] : "";
const scenarioFlagIndex = process.argv.indexOf("--scenario");
const scenario = scenarioFlagIndex >= 0 ? process.argv[scenarioFlagIndex + 1] : "";
const sizeFlagIndex = process.argv.indexOf("--size");
const size = sizeFlagIndex >= 0 ? process.argv[sizeFlagIndex + 1] : "";

if (!["default", "next"].includes(renderer)) {
  console.error("Usage: node scripts/renderer-smoke.js <default|next>");
  process.exit(2);
}

if (screenshotFlagIndex >= 0 && !screenshotPath) {
  console.error("Missing screenshot path after --screenshot");
  process.exit(2);
}

if (scenarioFlagIndex >= 0 && !scenario) {
  console.error("Missing scenario name after --scenario");
  process.exit(2);
}

if (sizeFlagIndex >= 0 && !/^\d+x\d+$/.test(size)) {
  console.error("Expected --size in WIDTHxHEIGHT format");
  process.exit(2);
}

const repoRoot = path.resolve(__dirname, "..");
const electronBin = require("electron");
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `meowdesk-renderer-smoke-${renderer}-`));
const smokeTimeoutMs = scenario === "top-surface-close-visual"
  ? "22000"
  : scenario === "data-ownership-home-backed"
  ? "30000"
  : scenario === "studio-agent-picker-visual"
  ? "30000"
  : scenario === "phase-six-route-reachability"
  ? "36000"
  : scenario === "workspace-studio-ownership-isolation"
  ? "26000"
  : scenario === "studio-runtime-boundary"
  ? "48000"
  : scenario === "r15-r2a-functions" || scenario === "right-sidebar-owner-acceptance" || scenario === "visual-recovery-seventh-batch" || scenario === "visual-recovery-eighth-batch" || scenario === "visual-recovery-ninth-batch" || scenario === "visual-recovery-tenth-batch" || scenario === "visual-recovery-eleventh-batch" || scenario === "visual-recovery-thirteenth-batch" || scenario === "visual-recovery-fourteenth-batch" || scenario === "visual-recovery-fifteenth-batch"
  ? "36000"
  : scenario === "workshop-create-project"
    ? "30000"
  : scenario === "workshop-project-detail"
    ? "20000"
  : ["workspace-output-renderer", "workspace-output-renderer-claude-startup", "workspace-output-renderer-claude-chat"].includes(scenario)
    ? "36000"
  : ["r1-functions", "r2-workspace-idle-visual", "visual-recovery-second-batch", "visual-recovery-third-batch", "visual-recovery-fourth-batch", "visual-recovery-fifth-batch", "visual-recovery-sixth-batch", "workspace-route-keepalive", "studio-meow-viewer-shared-core", "r3-product-surfaces", "agent-connect-mvp", "workspace-studio-ownership-isolation"].includes(scenario)
    ? "16000"
    : "10000";
const childEnv = {
  ...process.env,
  MEOWDESK_RENDERER_SMOKE: "1",
  MEOWDESK_RENDERER_SMOKE_TIMEOUT_MS: smokeTimeoutMs,
  MEOWDESK_RENDERER_SMOKE_SCENARIO: scenario,
  MEOWDESK_RENDERER_SMOKE_SCREENSHOT: screenshotPath ? path.resolve(repoRoot, screenshotPath) : "",
  MEOWDESK_RENDERER_SMOKE_SIZE: size,
  MEOWDESK_RENDERER_SMOKE_AGENT_COMMAND: process.execPath,
  MEOWDESK_USER_DATA_DIR: userDataDir
};

if (renderer === "default") {
  delete childEnv.MEOWDESK_RENDERER;
} else {
  childEnv.MEOWDESK_RENDERER = renderer;
}

if (["workshop-real-data", "workshop-mark-ready", "workshop-project-detail", "workshop-version-history", "workshop-export-meow", "studio-runtime-boundary", "lobby-plugin-tabs", "r1-functions", "r15-r2a-functions", "r2-workspace-idle-visual", "visual-recovery-second-batch", "visual-recovery-sixth-batch", "visual-recovery-fifteenth-batch", "data-ownership-home-backed"].includes(scenario)) {
  const extensionDir = path.join(userDataDir, "Meodesk Home", "extensions", "smoke-sidebar-widget");
  fs.mkdirSync(extensionDir, { recursive: true });
  fs.writeFileSync(path.join(extensionDir, "index.html"), "<!doctype html><title>Smoke sidebar widget</title>", "utf8");
  fs.writeFileSync(path.join(extensionDir, "MEODESK_PROJECT.md"), "# Smoke sidebar widget\n", "utf8");
  fs.writeFileSync(path.join(extensionDir, "meodesk-extension.manifest.json"), `${JSON.stringify({
    id: "smoke-sidebar-widget",
    name: "Smoke 真实右侧栏",
    type: "sidebar-widget",
    target: "workspace-sidebar",
    status: scenario === "lobby-plugin-tabs" || scenario === "r1-functions" || scenario === "r15-r2a-functions" || scenario === "r2-workspace-idle-visual" || scenario === "visual-recovery-second-batch" || scenario === "visual-recovery-sixth-batch" || scenario === "visual-recovery-fifteenth-batch" || scenario === "data-ownership-home-backed" ? "ready" : "draft",
    version: "0.1.0",
    summary: "来自 smoke 临时 Meodesk Home 的真实工坊作品",
    entry: "index.html",
    runtime: scenario === "lobby-plugin-tabs" || scenario === "r1-functions" || scenario === "r15-r2a-functions" || scenario === "r2-workspace-idle-visual" || scenario === "visual-recovery-second-batch" || scenario === "visual-recovery-sixth-batch" || scenario === "data-ownership-home-backed" ? "meodesk-sidebar-widget" : "html",
    sidebarWidget: {
      minHeight: 180,
      preferredHeight: 320,
      resizeMode: "vertical"
    }
  }, null, 2)}\n`, "utf8");
  if (scenario === "workshop-version-history") {
    const versionDir = path.join(extensionDir, "versions", "0.0.5");
    fs.mkdirSync(versionDir, { recursive: true });
    fs.writeFileSync(path.join(versionDir, "index.html"), "<!doctype html><title>Smoke sidebar widget 0.0.5</title>", "utf8");
    fs.writeFileSync(path.join(versionDir, "meodesk-extension.manifest.json"), `${JSON.stringify({
      id: "smoke-sidebar-widget",
      name: "Smoke 真实右侧栏",
      type: "sidebar-widget",
      status: "ready",
      version: "0.0.5",
      summary: "来自 smoke 临时 Meodesk Home 的旧版本快照",
      entry: "index.html",
      runtime: "html"
    }, null, 2)}\n`, "utf8");
  }
  if (scenario === "lobby-plugin-tabs" || scenario === "visual-recovery-sixth-batch") {
    for (const [id, name, type, target] of [
      ["smoke-feature-page", "Smoke 真实功能页", "feature-page", "main-nav"],
      ["smoke-skill-pack", "Smoke Skill 包", "skill", "agent-skill"]
    ]) {
      const extraDir = path.join(userDataDir, "Meodesk Home", "extensions", id);
      fs.mkdirSync(extraDir, { recursive: true });
      fs.writeFileSync(path.join(extraDir, "index.html"), `<!doctype html><title>${name}</title>`, "utf8");
      fs.writeFileSync(path.join(extraDir, "MEODESK_PROJECT.md"), `# ${name}\n`, "utf8");
      fs.writeFileSync(path.join(extraDir, "meodesk-extension.manifest.json"), `${JSON.stringify({
        id,
        name,
        type,
        target,
        status: "ready",
        version: "0.1.0",
        summary: `${name} 用于 Lobby 列表行对齐 smoke fixture。`,
        entry: "index.html",
        runtime: "html"
      }, null, 2)}\n`, "utf8");
    }
  }
  if (scenario === "studio-runtime-boundary") {
    const featureDir = path.join(userDataDir, "Meodesk Home", "extensions", "smoke-feature-page");
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(path.join(featureDir, "index.html"), "<!doctype html><title>Smoke feature page</title>", "utf8");
    fs.writeFileSync(path.join(featureDir, "MEODESK_PROJECT.md"), "# Smoke feature page\n", "utf8");
    fs.writeFileSync(path.join(featureDir, "meodesk-extension.manifest.json"), `${JSON.stringify({
      id: "smoke-feature-page",
      name: "Smoke 真实功能页",
      type: "feature-page",
      target: "main-nav",
      status: "draft",
      version: "0.1.0",
      summary: "来自 smoke 临时 Meodesk Home 的真实功能页作品",
      entry: "index.html",
      runtime: "html",
      page: {
        navLabel: "Smoke 功能页",
        route: "smoke-feature-page",
        icon: ""
      }
    }, null, 2)}\n`, "utf8");
  }
}

if (["r15-r2a-functions", "r2-workspace-idle-visual"].includes(scenario)) {
  const petDir = path.join(userDataDir, "Meodesk Home", "assets", "pets", "terminal");
  fs.mkdirSync(petDir, { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "assets", "workbench-icon-rounded.png"), path.join(petDir, "spritesheet.png"));
  fs.writeFileSync(path.join(petDir, "pet.json"), `${JSON.stringify({
    id: "terminal",
    displayName: "Smoke Terminal Pet",
    description: "Smoke pet fixture for the restored R2 workspace pet dock.",
    spritesheetPath: "spritesheet.png",
    columns: 1,
    rows: 1
  }, null, 2)}\n`, "utf8");
}

if (scenario === "r15-r2a-functions") {
  const tasksDir = path.join(userDataDir, "Meodesk Home", "data", "board");
  fs.mkdirSync(tasksDir, { recursive: true });
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  fs.writeFileSync(path.join(tasksDir, "tasks.json"), `${JSON.stringify([
    {
      id: "smoke-ai-inbox",
      title: "Smoke AI 待确认任务",
      status: "inbox",
      origin: "ai",
      source: "Smoke Agent",
      tag: "agent",
      tags: ["agent"],
      priority: "high",
      scheduledDate: todayKey,
      scheduledTime: "10:00",
      detail: "R1.5 AI task lane fixture.",
      createdAt: 1780160000000,
      updatedAt: 1780160000000
    },
    {
      id: "smoke-mine-doing",
      title: "Smoke 我的进行中任务",
      status: "doing",
      origin: "user",
      source: "我",
      tag: "personal",
      tags: ["personal"],
      priority: "medium",
      scheduledDate: todayKey,
      scheduledTime: "15:30",
      detail: "R1.5 mine lane fixture.",
      createdAt: 1780160100000,
      updatedAt: 1780160100000
    },
    {
      id: "smoke-blocked-studio",
      title: "Smoke 工坊阻塞任务",
      status: "blocked",
      origin: "user",
      source: "我",
      tag: "studio",
      tags: ["studio"],
      priority: "low",
      scheduledDate: todayKey,
      scheduledTime: "",
      createdAt: 1780160200000,
      updatedAt: 1780160200000
    }
  ], null, 2)}\n`, "utf8");
}

if (scenario === "r1-functions" || scenario === "lobby-signed-in-startup") {
  const profileDir = path.join(userDataDir, "Meodesk Home", "data");
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(path.join(profileDir, "profile.json"), `${JSON.stringify({
    id: 1,
    developerId: "1",
    displayName: "Seeded Avatar Developer",
    email: "seeded@example.test",
    title: "",
    bio: "Seeded profile fixture.",
    level: 3,
    avatarDataUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
    gender: "hidden",
    emailPublic: false,
    signedIn: true,
    ownedTitleIds: ["developer", "round-table-1"],
    wornTitleIds: ["developer"]
  }, null, 2)}\n`, "utf8");
}

if (scenario === "r3-product-surfaces") {
  const conversationsDir = path.join(userDataDir, "Meodesk Home", "conversations");
  fs.mkdirSync(conversationsDir, { recursive: true });
  fs.writeFileSync(path.join(conversationsDir, "conversation.smoke-agent.r3-local.json"), `${JSON.stringify({
    type: "meodesk-conversation",
    agentId: "smoke-agent",
    agentName: "Smoke Agent",
    conversationId: "r3-local",
    title: "R3 本地会话",
    status: "active",
    source: "smoke fixture",
    messages: [
      { id: "m1", role: "user", content: "请记录 R3 对话管理 smoke。", createdAt: 1780260000000 },
      { id: "m2", role: "assistant", content: "R3 对话正文已从本地 conversation JSON 读取。", createdAt: 1780260060000 }
    ],
    updatedAt: 1780260060000
  }, null, 2)}\n`, "utf8");

  const vaultDir = path.join(userDataDir, "Smoke Brain Vault");
  fs.mkdirSync(path.join(vaultDir, "Meowdesk"), { recursive: true });
  fs.writeFileSync(path.join(vaultDir, "当前上下文.md"), [
    "# 当前上下文",
    "",
    "这里是 R3 Obsidian smoke fixture。",
    "",
    "- 链接到 [[Meowdesk/R3 记录]]",
    "- #meowdesk #r3"
  ].join("\n"), "utf8");
  fs.writeFileSync(path.join(vaultDir, "Meowdesk", "R3 记录.md"), [
    "# R3 记录",
    "",
    "这篇笔记反向链接 [[当前上下文]]，用于验证本地 vault reader。",
    "",
    "> Obsidian reader should render markdown blocks."
  ].join("\n"), "utf8");
  const configDir = path.join(userDataDir, "Meodesk Home", "config");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, "obsidian-vault.json"), `${JSON.stringify(vaultDir, null, 2)}\n`, "utf8");
}

if (scenario === "workshop-invalid-manifest") {
  const extensionDir = path.join(userDataDir, "Meodesk Home", "extensions", "broken-sidebar-widget");
  fs.mkdirSync(extensionDir, { recursive: true });
  fs.writeFileSync(path.join(extensionDir, "MEODESK_PROJECT.md"), "# Broken sidebar widget\n", "utf8");
  fs.writeFileSync(path.join(extensionDir, "meodesk-extension.manifest.json"), "{ invalid manifest", "utf8");
}

if (scenario === "studio-terminal-boundary" || scenario === "studio-meow-viewer-shared-core" || scenario === "r15-r2a-functions" || scenario === "r2-workspace-idle-visual" || scenario === "visual-recovery-second-batch" || scenario === "visual-recovery-ninth-batch" || scenario === "visual-recovery-tenth-batch" || scenario === "visual-recovery-thirteenth-batch" || scenario === "workspace-route-keepalive" || scenario === "workspace-output-renderer" || scenario === "workspace-output-renderer-claude-startup" || scenario === "workspace-output-renderer-claude-chat" || scenario === "workspace-studio-ownership-isolation") {
  const isWorkspaceTerminalScenario = scenario === "r15-r2a-functions" || scenario === "r2-workspace-idle-visual" || scenario === "visual-recovery-second-batch" || scenario === "visual-recovery-tenth-batch" || scenario === "visual-recovery-thirteenth-batch" || scenario === "workspace-route-keepalive";
  const isOwnershipIsolationScenario = scenario === "workspace-studio-ownership-isolation";
  const isOutputRendererScenario = scenario === "workspace-output-renderer" || scenario === "workspace-output-renderer-claude-startup" || scenario === "workspace-output-renderer-claude-chat" || isOwnershipIsolationScenario;
  const isStudioViewerScenario = scenario === "studio-meow-viewer-shared-core" || isOwnershipIsolationScenario;
  const isClaudeStartupRendererScenario = scenario === "workspace-output-renderer-claude-startup";
  const isClaudeChatRendererScenario = scenario === "workspace-output-renderer-claude-chat";
  const studioViewerScript = [
    "const lines = [",
    "  '# Studio Viewer Smoke',",
    "  '',",
    "  '| Surface | Status |',",
    "  '| --- | --- |',",
    "  '| 工坊 | shared core |',",
    "  '',",
    "  '```diff',",
    "  '+ studio shared core',",
    "  '- studio private markdown',",
    "  '```',",
    "  '',",
    "  '等待输入。'",
    "];",
    "process.stdout.write(lines.join('\\n') + '\\n');",
    "const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout, terminal: true });",
    "rl.on('line', (line) => {",
    "  const text = String(line || '').trim();",
    "  if (!text) return;",
    "  process.stdout.write(['', '## Studio Echo', '收到：`' + text + '`', ''].join('\\n'));",
    "});",
    "setTimeout(() => process.exit(0), 60000);"
  ].join(" ");
  const outputRendererScript = isClaudeStartupRendererScenario || isClaudeChatRendererScenario ? [
    "const lines = [",
    "  '╭────ClaudeCodev2.1.162──────────────────────────────╮',",
    "  '| | Tipsforgetting |',",
    "  '| Welcomeback! | started |',",
    "  '| | Run/inittocreate... |',",
    "  '| █▀█ |──────────────────────────────|',",
    "  '| ▀▀▀ | What\\'snew |',",
    "  '| □ □ □ OTEL_RESOURCE_ATTR... |',",
    "  '| claudeagents rows... |',",
      "  '| T┬ Opus4.7(1Mcontext) · APIUsageBilling | /mcp`nowcollapses... |',",
    "  '| E:\\\\Meowdesk\\\\workbench-prototype-ui-rebuild | /release-notesform... |',",
    "  '╰────────────────────────────────────────────────────╯',",
    "  '',",
    "  '? for shortcuts · ← for agents                         Auto-updating...',",
    "  '◉ xhigh · /effort',",
    ...(isClaudeChatRendererScenario ? [
      "  '› 随便聊点什么，测试一下meowviewer吧：表格、diff',",
      "  '、代码块、markdown文本',",
      "  'Thought for 1s (ctrl+o to expand)',",
      "  '● 收到，先给你一个短回复。',",
      "  '› 你好',",
      "  'Thought for 2s (ctrl+o to expand)',",
      "  '⎿ The user just said \"你好\" which means \"Hello\" in Chinese. This is a simple greeting. Let me respond in Chinese as well.',",
      "  '* Finagling... (146 tokens thought for 2s)',",
      "  'esc to interrupt',",
      "  '● 你好！有什么可以帮你的？',",
      "  '* Sautéed for 2s',",
      "  '› 我在测试 Meow Viewer，你随意发挥写一个表格出来，我看看页面效果',",
      "  'Thought for 4s, read 1 file (ctrl+o to expand)',",
      "  '⎿ The user wants a markdown table to verify page rendering. The rendered page should hide this thought.',",
      "  '⎿ 用户想要一个更长的表格，来测试 Meow Viewer 的渲染能力。',",
      "  '的渲染能力。可以用一些真实的数据让表格看起来更有意义。',",
      "  '⎿ The user is asking me to test the MeowViewer feature. They said not to read code and just',",
      "  'output some random things like tables, diffs, markdown text, and code blocks. Let me just',",
      "  'code.\\\" So they just want me to produce output with various markdown formatting. Let me',",
      "  'generate some interesting demo content. Let me check what the project is about first since I should at least know the context.',",
      "  'Actually, let me look at the project name: \"workbench-prototype-ui-rebuild\". And \"meowviewer\" sounds like a viewer component.',",
      "  '* Bootstrapping... (12s · 946 tokens)',",
      "  'Reading 1 file... (ctrl+o to expand)',",
      "  'Read(src/main.js)',",
      "  '● 明白了，直接用原生 markdown 表格渲染：',",
      "  '```markdown',",
      "  '| Fence 模块 | 渲染结果 |',",
      "  '| --- | --- |',",
      "  '| Claude markdown fence | 原生表格 |',",
      "  '```',",
      "  '',",
      "  '| 项目 | 状态 | 优先级 | 负责人 | 截止日期 |',",
      "  '| 备注 |',",
      "  '| --- | --- | --- | --- | --- | --- |',",
      "  '| 用户认证模块重构 | 进行中 | 高 | 张三 | 2026-06-1 | 需配合后端 |',",
      "  '| 0 | API 改动 |',",
      "  '| 仪表盘数据缓存优化 | 已完成 | 中 | 李四 | 2026-06-2 | 使用 |',",
      "  '| 0 | ECharts 6 |',",
      "  '| 通知中心国际化 | 待开始 | 低 | 王五 | 2026-06-20 | 首批支持 zh/en/ja |',",
      "  '',",
      "  '渲染效果应该把表格变成页面表格，而不是继续显示管道文本。',",
      "  '',",
      "  '正文和标题交替',",
      "  '短段落。',",
      "  '',",
      "  '接近收尾',",
      "  '最后一段文字，标题下面紧接正文。',",
      "  '## 小结',",
      "  '结论：标题、正文、表格和工具状态需要有清楚层级。',",
      "  '',",
      "  '再来一个长表格，模拟技术债清单：',",
      "  '| 序号 | 文件路径 | 问题类型 | 代码行数 | 复杂度 | 优先级 | 预计工时 | 依赖项 | 状态 | 负责人 | 备注 |',",
      "  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',",
      "  '| 1 | src/renderer/ui/legacy-panel.js | 冗余 UI | 1523 | 高 | P1 | 8h | #1 | 待启动 | 待定 | 与新 UI 重复 |',",
      "  '| 2 | src/plugins/loader.ts | 插件系统 | 1432 | 极高 | P2 | 24h | #1 | 待重构 | 待定 | 设计需要重新整理 |',",
      "  '| 3 | src/workflow/executor.js | 硬编码逻辑 | 2341 | 高 | P2 | 16h | #1 | 待配置化 | 待定 | 运行路径很长时不能竖排 |',",
      "  '',",
      "  '终端盒线长表格：',",
      "  '┌────┬────────────────────────────────────┬────────────┬────────┬────────┬────────────┐',",
      "  '│ 序号 │ 文件路径                           │ 问题类型     │ 优先级 │ 状态   │ 备注       │',",
      "  '├────┼────────────────────────────────────┼────────────┼────────┼────────┼────────────┤',",
      "  '│ 1  │ src/renderer/main.js                │ 单文件过大   │ P0     │ 进行中 │ 核心重构项 │',",
      "  '│ 2  │ src/renderer/ui/legacy-panel.js     │ 冗余 UI      │ P1     │ 待启动 │ 与新 UI 重复 │',",
      "  '│ 3  │ src/workflow/executor.js            │ 硬编码逻辑   │ P2     │ 待配置 │ 运行路径长 │',",
      "  '└────┴────────────────────────────────────┴────────────┴────────┴────────┴────────────┘',",
      "  '',",
      "  '+ 正面：普通优点列表不能误判成 diff。',",
      "  '- 反面：普通风险列表也不能误判成 diff。',",
      "  'Update(renderer_test.md)',",
      "  '  Added 2 lines, removed 1 line',",
      "  '  3 -旧行',",
      "  '  3 +新行',",
      "  '  4 +新增行',",
      "  '',",
      "  '2. Diff - 一个虚构的 PR 改动',",
      "  'diff --git a/src/meowviewer/core.ts b/src/meowviewer/core.ts',",
      "  'index a1b2c3d..e4f5a6b 100644',",
      "  '--- a/src/meowviewer/core.ts',",
      "  '+++ b/src/meowviewer/core.ts',",
      "  '@@ -42,7 +42,7 @@ export class MeowViewer {',",
      "  '    async render(): Promise<void> {',",
      "  '-      const data = await this.fetchData();',",
      "  '+      const data = await this.fetchDataWithRetry(3); // 加 3 次重试',",
      "  '       this.parseData(data);',",
      "  '-      this.renderLegacy();',",
      "  '+      this.renderV2(); // 切换到新渲染引擎',",
      "  '       this.emit(\"rendered\");',",
      "  '    }',",
      "  '@@ -88,6 +88,10 @@ export class MeowViewer {',",
      "  '+   private async fetchDataWithRetry(retries: number): Promise<Data> {',",
      "  '+     // 实现略',",
      "  '+   }',",
      "  '',",
      "  '3. 代码块 - JavaScript 虚拟滚动',",
      "  'JavaScript:',",
      "  '// VirtualScroll 核心逻辑',",
      "  'class VirtualScroll {',",
      "  '  #items = new Map()',",
      "  '  #observer = null',",
      "  '  constructor({ container, itemHeight, buffer = 5 }) {',",
      "  '    this.container = container',",
      "  '    this.itemHeight = itemHeight',",
      "  '    this.buffer = buffer',",
      "  '    this.#initObserver()',",
      "  '  }',",
      "  '  *getVisibleItems(scrollTop, viewportHeight) {',",
      "  '    const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer)',",
      "  '    const end = Math.min(',",
      "  '      this.#items.size,',",
      "  '      Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.buffer',",
      "  '    )',",
      "  '    for (let i = start; i < end; i++) {',",
      "  '      yield this.#items.get(i)',",
      "  '    }',",
      "  '  }',",
      "  '}',",
      "  '',",
      "  '---',",
      "  '',",
      "  '4. 代码块 - TypeScript 泛型工具',",
      "  '// 深度可选类型',",
      "  'type DeepPartial<T> = {',",
      "  '  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];',",
      "  '};',",
      "  '',",
      "  '// 联合类型转交叉类型',",
      "  'type UnionToIntersection<U> =',",
      "  '  (U extends any ? (k: U) => void : never) extends (k: infer I) => void',",
      "  '    ? I',",
      "  '    : never;',",
      "  '',",
      "  'interface Config {',",
      "  '  viewer: { width: number; height: number };',",
      "  '  theme: { primary: string; secondary: string };',",
      "  '}',",
      "  '',",
      "  'type PartialConfig = DeepPartial<Config>;',",
      "  \"type NodeConfig =\",",
      "  \"  | { type: 'action'; handler: string; params: Record<string, any> }\",",
      "  \"  | { type: 'condition'; expression: string; trueBranch: string; falseBranch: string };\",",
      "  '// ✅所有字段都可选',",
      "  '',",
      "  'Rust:',",
      "  'tasks.iter().any(|t| t.id == *dep_id)',",
      "  '  .map_err(|_| SchedulerError::LockPoisoned)?;',",
      "  'return Err(SchedulerError::DependencyNotFound(*dep_id));',",
      "  '',",
      "  'SQL',",
      "  'SELECT module_name, status, priority',",
      "  'FROM project_tasks',",
      "  'WHERE status IN (\\'进行中\\', \\'待启动\\')',",
      "  'ORDER BY priority DESC;',",
      "  '',",
      "  '5. 引用块 + 列表 + 代码混合',",
      "  '> MeowViewer 设计原则',",
      "  '>',",
      "  '> 1. 零副作用渲染 - render 函数不应修改外部状态',",
      "  '> 2. 渐进增强 - 基础功能不依赖 JS，交互层逐步增加',",
      "  '> 3. 可测试 - 每个渲染路径都有对应的单元测试',",
      "  '>',",
      "  '> // 核心循环',",
      "  '> while (viewer.hasNext()) {',",
      "  '>   const frame = viewer.nextFrame();',",
      "  '>   await scheduler.render(frame);',",
      "  '> }',",
      "  '',",
      "  '6. 带 shell 输出的终端',",
      "  '$ npm run meowviewer:test',",
      "  '> meowviewer@1.0.0 test',",
      "  '> vitest run',",
      "  '✓ src/meowviewer/__tests__/core.test.ts (5 tests) 12ms',",
      "  'Test Files 3 passed (3)',",
      "  'Tests 16 passed (16)',",
      "  '✻ Cooked for 6s',"
    ] : []),
    "  '>'",
    "];",
    "process.stdout.write(lines.join('\\n') + '\\n');",
    "const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout, terminal: true });",
    "rl.on('line', (line) => {",
    "  const text = String(line || '').trim();",
    "  if (!text) return;",
    "  if (['1', '2', '3'].includes(text)) { process.stdout.write('\\nMEODESK_PERMISSION_CHOICE_RECEIVED:' + text + '\\n'); return; }",
    "  process.stdout.write(['› ' + text, 'Thought for 1s (ctrl+o to expand)', '⎿ Renderer smoke should hide this thought.', '● 交互发送验证：', '| 名称 | 结果 |', '| --- | --- |', '| Meow Viewer 输入 | 已发送 |', '', 'Write(test-table.md)', 'Create file test-table.md', '  1 | | 项目 | 状态 |', '  2 | | --- | --- |', '  3 | | 权限测试 | 待确认 |', 'Do you want to create test-table.md?', '❯ 1. Yes', '  2. Yes, allow all edits during this session', '  3. No, and tell Claude what to do differently', ''].join('\\n'));",
    "});",
    "setTimeout(() => process.exit(0), 60000);"
  ].join(" ") : [
    "const lines = [",
    "  'Welcome to Hermes Agent',",
    "  '✦ Welcome to Hermes Agent ✦',",
    "  'deepseek-v4-flash · Nous Research',",
    "  '/mnt/e/Meowdesk/workbench-prototype-ui-rebuild',",
    "  'Session: smoke-renderer-hermes',",
    "  'data-science: jupyter-live-kernel, dataframe-inspector',",
    "  'devops: feishu-bot-setup, deployment-helper',",
    "  'github: codebase-inspection, pull-request-review',",
    "  'mcp: native-mcp, registry-bridge',",
    "  'software-development: custom-business-system, codebase-refactor',",
    "  '✦ Tip: HERMES_CRON_MAX_PARALLEL can saturate your keys.',",
    "  '(ↄ˘) 绞尽脑汁...',",
    "  '$ deepseek-v4-flash │ 35.4K/1M │ 4% │ 24s │ 4s',",
    "  'msg=interrupt · /queue · /bg · /steer · Ctrl+C cancel',",
    "  '| $ deepseek-v4-flash | ctx -- | [\\\\\\\\\\\\\\\\\\\\\\\\] 0% | 59s | ⏱ 0s |',",
    "  '—↪ msg=interrupt · /queue · /bg · /steer · Ctrl+C cancel',",
    "  '─ Reasoning ─',",
    "  'OK, I\\'ve quickly scanned the current state and should hide this reasoning.',",
    "  'read /mnt/e/Meowdesk/workbench-prototype-ui-rebuild/src/main.js',",
    "  '─ Response ─',",
    "  '─ ✦ Hermes ─',",
    "  '# 页面输出',",
    "  '',",
    "  '这是 `Hermes` 的渲染测试，文件 `src/main.js`。',",
    "  '这里有 **加粗重点** 和 *斜体补充*，应该渲染出明确差异。',",
    "  '',",
    "  'Markdown: 今日任务清单',",
    "  '- [x] 跑每日',",
    "  '提',",
    "  '示',",
    "  '复',",
    "  '图',",
    "  '- [ ] 复盘输出',",
    "  '',",
    "  '## 阅读层级',",
    "  '### 三级提示',",
    "  '结论：Hermes 爱输出 Markdown，Meow Viewer 应该像工作笔记一样拉开层级。',",
    "  '',",
    "  '- 回复',",
    "  '- 代码',",
    "  '',",
    "  '```js',",
    "  'console.log(\"MEOWDESK_RENDERED\");',",
    "  '```',",
    "  '',",
    "  '```',",
    "  '// Unlabelled TypeScript fence should infer TS, not TEXT',",
    "  'interface SmokeViewerSession {',",
    "  '  viewerId: string;',",
    "  '  status: \\'running\\' | \\'done\\';',",
    "  '}',",
    "  'const smokeSession: SmokeViewerSession = { viewerId: \\'mv-smoke\\', status: \\'running\\' };',",
    "  '```',",
    "  '',",
    "  'Python 代码块',",
    "  'python',",
    "  'def calc_daily_report(nav, cost, debt, partners):',",
    "  '    \"\"\"每日收益分配计算\"\"\"',",
    "  '    profit = nav - cost',",
    "  '    if profit <= 0:',",
    "  '        return {\"signal\": \"🔴利润归零，需复盘\"}',",
    "  '    allocation = {',",
    "  '        \"郑总\": profit * 0.2,',",
    "  '        \"董总\": profit * 0.2,',",
    "  '        \"偿债\": min(profit * 0.1, debt),',",
    "  '        \"现金流\": profit * 0.5,',",
    "  '    }',",
    "  '    return allocation',",
    "  '',",
    "  'if __name__ == \"__main__\":',",
    "  '    # 017811 当前基线',",
    "  '    status = calc_daily_report(48925.14, 40656.19, 0, [])',",
    "  '    print(f\"017811 净利润: {48925.14 - 40656.19:.2f}\")',",
    "  '    print(f\"状态: {status}\")',",
    "  '    print(greet(\"Shizuku\", \"很棒\"))',",
    "  '    print(\"当前状态地图：\", status)',",
    "  '',",
    "  '─ Reasoning ─',",
    "  'The user asked for SQL output directly. This hidden reasoning must not render.',",
    "  '─ ← Hermes ─',",
    "  'sql',",
    "  'WITH monthly_revenue AS (',",
    "  '  SELECT strftime(\\'%Y-%m\\', order_time) AS month,',",
    "  '         SUM(amount) AS revenue,',",
    "  '         COUNT(DISTINCT user_id) AS paying_users',",
    "  '  FROM orders',",
    "  '  WHERE status = \\'paid\\'',",
    "  '  GROUP BY month',",
    "  ')',",
    "  'SELECT month, revenue, paying_users',",
    "  'FROM monthly_revenue',",
    "  'ORDER BY month DESC;',",
    "  '',",
    "  'SQL',",
    "  'WITH RECURSIVE',",
    "  'org_chain AS (',",
    "  'SELECT e.id, e.name, e.manager_id, e.department_id, 0 AS level',",
    "  'FROM employees e',",
    "  'WHERE e.manager_id IS NULL',",
    "  'UNION ALL',",
    "  'SELECT e.id, e.name, e.manager_id, e.department_id, oc.level + 1',",
    "  'FROM employees e',",
    "  'INNER JOIN org_chain oc ON e.manager_id = oc.id',",
    "  '-- MVSQLONECARD',",
    "  '),',",
    "  'dept_stats AS (',",
    "  'SELECT d.id AS dept_id, d.name AS dept_name,',",
    "  'COUNT(oc.id) AS total_members, AVG(oc.level) AS avg_depth',",
    "  'FROM departments d',",
    "  'LEFT JOIN org_chain oc ON oc.department_id = d.id',",
    "  'GROUP BY d.id, d.name',",
    "  ')',",
    "  'SELECT oc.name, oc.level, ds.dept_name, ds.total_members,',",
    "  'RANK() OVER (PARTITION BY oc.level ORDER BY ds.total_members DESC) AS rank_in_level',",
    "  'FROM org_chain oc',",
    "  'LEFT JOIN dept_stats ds ON ds.dept_id = oc.department_id',",
    "  'ORDER BY oc.level, rank_in_level;',",
    "  '',",
    "  '| 级别 | 价格 | 周期 |',",
    "  '| --- | ---: | --- |',",
    "  '| VIP1 | ¥2,980 | 6个月 |',",
    "  '| VIP2 | ¥5,680 | 12个月 |',",
    "  '| VIP3 | ¥8,880 | 18个月 |',",
    "  '',",
    "  'diff',",
    "  '--- a/src/app.py',",
    "  '+++ b/src/app.py',",
    "  '@@ -1,4 +1,4 @@',",
    "  ' def greet(name):',",
    "  '-    return f\"Hello, {name}\"',",
    "  '+    return f\"Hi there, {name}!\"',",
    "  '',",
    "  '样式片段',",
    "  'text-transform: uppercase;',",
    "  'letter-spacing: 0.5px;',",
    "  '}',",
    "  '',",
    "  '<!DOCTYPE html>',",
    "  '<html lang=\"zh-CN\">',",
    "  '<body>',",
    "  '<div id=\"root\">Hello Meow</div>',",
    "  '</body>',",
    "  '</html>',",
    "  '',",
    "  '| 项目 | Tokens | 成本（天） |',",
    "  '| 备注 |',",
    "  '| --- | --- | --- | --- |',",
    "  '| Hermes 主 | 280K | ¥14.00 | DeepSeek |',",
    "  '| 秘书微信 | 60K | ¥3.00 | 财务日报 |',",
    "  '',",
    "  '+#### Q2 细节层级',",
    "  '标题层级需要继续渲染。',",
    "  '',",
    "  '滚动占位 01：用于让 Meow Viewer 内容区出现可滚动高度。',",
    "  '滚动占位 02：用于让 Meow Viewer 内容区出现可滚动高度。',",
    "  '滚动占位 03：用于让 Meow Viewer 内容区出现可滚动高度。',",
    "  '滚动占位 04：用于让 Meow Viewer 内容区出现可滚动高度。',",
    "  '滚动占位 05：用于让 Meow Viewer 内容区出现可滚动高度。',",
    "  '滚动占位 06：用于让 Meow Viewer 内容区出现可滚动高度。',",
    "  '滚动占位 07：用于让 Meow Viewer 内容区出现可滚动高度。',",
    "  '滚动占位 08：用于让 Meow Viewer 内容区出现可滚动高度。',",
    "  '滚动占位 09：用于让 Meow Viewer 内容区出现可滚动高度。',",
    "  '滚动占位 10：用于让 Meow Viewer 内容区出现可滚动高度。',",
    "  '',",
    "  '$ 六、终端风格的目录树',",
    "  '',",
    "  'E:\\\\self-archive\\\\',",
    "  '├─ SKILL.md                         # 数字人核心 skill',",
    "  '├─ style_card_v0.md                 # 风格卡片主文档',",
    "  '├─ style_card_distillation/         # 蒸馏用子文档',",
    "  '│  ├─ teasing_distill.md            # 推拉场景蒸馏',",
    "  '│  ├─ intimate_distill.md           # 亲密场景蒸馏',",
    "  '│  └─ plain_chat_distill.md         # 日常聊天蒸馏',",
    "  '└─ references/',",
    "  '   ├─ 2026-05-26-训练7-前前女友场景.md',",
    "  '   └─ 周周宝贝_4945条-口癖统计报告.md',",
    "  '',",
    "  'MEOWDESK_RENDERED 尾部确认。',",
    "  '表格后这句话必须继续渲染。'",
    "];",
    "process.stdout.write(lines.join('\\n') + '\\n');",
    "setTimeout(() => process.stdout.write('\\n## 后续输出\\n这行到达时不应该强制置底。\\n'), 6500);",
    "const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout, terminal: true });",
    "rl.on('line', (line) => {",
    "  const text = String(line || '').trim();",
    "  if (!text) return;",
    "  process.stdout.write(['', '# 交互发送验证', '', '收到：`' + text + '`', '', '| 输入 | 状态 |', '| --- | --- |', '| Meow Viewer 输入 | 已发送 |', ''].join('\\n'));",
    "});",
    "setTimeout(() => process.exit(0), 60000);"
  ].join(" ");
  const configDir = path.join(userDataDir, "Meodesk Home", "config");
  fs.mkdirSync(configDir, { recursive: true });
  const smokeTools = [];
  if (isOutputRendererScenario) {
    smokeTools.push({
      id: "smoke-render-source",
      name: isClaudeStartupRendererScenario || isClaudeChatRendererScenario ? "Smoke Claude Code" : "Smoke Hermes CLI",
      toolKind: isClaudeStartupRendererScenario || isClaudeChatRendererScenario ? "claude" : "hermes",
      command: process.execPath,
      args: ["-e", outputRendererScript],
      cwd: "."
    });
  }
  if (isStudioViewerScenario) {
    smokeTools.push({
      id: "smoke-workshop-agent",
      name: "Smoke Studio Viewer Agent",
      toolKind: "claude",
      command: process.execPath,
      args: ["-e", studioViewerScript],
      cwd: "."
    });
  }
  if (!smokeTools.length) {
    smokeTools.push({
      id: "smoke-terminal",
      name: isWorkspaceTerminalScenario ? "Smoke Runtime Terminal" : "Smoke PowerShell",
      toolKind: "terminal",
      command: isWorkspaceTerminalScenario ? process.execPath : "powershell.exe",
      args: isWorkspaceTerminalScenario
        ? ["-e", "process.stdout.write('MEOWDESK_R2_TERMINAL_OK cols=' + (process.stdout.columns || 0) + ' rows=' + (process.stdout.rows || 0) + '\\n'); setTimeout(() => process.exit(0), 60000);"]
        : ["-NoLogo"],
      cwd: "."
    });
  }
  fs.writeFileSync(path.join(configDir, "tools.json"), `${JSON.stringify({
    tools: smokeTools
  }, null, 2)}\n`, "utf8");
}

if (scenario === "studio-runtime-boundary") {
  const configDir = path.join(userDataDir, "Meodesk Home", "config");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, "tools.json"), `${JSON.stringify({
    tools: [
      {
        id: "smoke-workshop-agent",
        name: "Smoke Workshop Agent",
        toolKind: "codex",
        command: process.execPath,
        args: ["-e", "const fs=require('fs'); const type=process.env.MEODESK_WORKSHOP_TYPE || 'NO_TYPE'; const rulesFile=process.env.MEODESK_WORKSHOP_RULES_FILE || ''; let rulesState='NO_RULES'; try { const text=fs.readFileSync(rulesFile, 'utf8'); rulesState=(text.includes('Artifact type: '+type) && text.includes('Manifest 最小示例')) ? 'RULES_OK' : 'RULES_BAD'; } catch (error) { rulesState='RULES_MISSING'; } process.stdout.write('MEOWDESK_STUDIO_AGENT_OK ' + type + ' ' + (process.env.MEODESK_WORKSHOP_PROJECT_PATH || 'NO_PROJECT') + ' ' + (process.env.MEODESK_WORKSHOP_SYSTEM_PROMPT_FILE || 'NO_PROMPT') + ' ' + (rulesFile || 'NO_RULES_FILE') + ' ' + rulesState + '\\n'); setTimeout(() => process.exit(0), 60000);"],
        cwd: "."
      }
    ]
  }, null, 2)}\n`, "utf8");
}

if (scenario === "studio-agent-picker-visual" || scenario === "studio-no-desktop-placeholder" || scenario === "visual-recovery-first-batch" || scenario === "visual-recovery-third-batch" || scenario === "visual-recovery-fifth-batch") {
  const configDir = path.join(userDataDir, "Meodesk Home", "config");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, "tools.json"), `${JSON.stringify({
    tools: [
      {
        id: "smoke-picker-agent",
        name: "Smoke Picker Agent",
        toolKind: "codex",
        command: process.execPath,
        args: ["-e", "process.stdout.write('MEOWDESK_PICKER_AGENT_OK\\n'); setTimeout(() => process.exit(0), 60000);"],
        cwd: "."
      }
    ]
  }, null, 2)}\n`, "utf8");
}

if (scenario === "workshop-import-meow") {
  const manifest = {
    id: "smoke-imported-widget",
    name: "Smoke 导入右侧栏",
    type: "sidebar-widget",
    status: "ready",
    version: "0.2.0",
    summary: "来自 smoke 固定 .meow 包的导入作品",
    target: "workspace-sidebar",
    entry: "index.html",
    runtime: "html"
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  const entryText = "<!doctype html><title>Smoke imported widget</title>";
  const packagePath = path.join(userDataDir, "smoke-imported-widget-v0.2.0.meow");
  fs.writeFileSync(packagePath, `${JSON.stringify({
    schema: "meodesk.meow.package.v0",
    kind: "meodesk-extension-package",
    packagedAt: new Date("2026-05-30T00:00:00.000Z").toISOString(),
    exportedAt: new Date("2026-05-30T00:00:00.000Z").toISOString(),
    package: {
      id: manifest.id,
      name: manifest.name,
      type: manifest.type,
      target: manifest.target,
      version: manifest.version,
      runtime: manifest.runtime,
      entry: manifest.entry,
      installMode: "unpack-to-extensions"
    },
    manifest,
    files: [
      {
        path: "index.html",
        encoding: "utf8",
        content: entryText,
        size: Buffer.byteLength(entryText),
        modifiedAt: 0
      },
      {
        path: "meodesk-extension.manifest.json",
        encoding: "utf8",
        content: manifestText,
        size: Buffer.byteLength(manifestText),
        modifiedAt: 0
      }
    ]
  }, null, 2)}\n`, "utf8");
  childEnv.MEOWDESK_RENDERER_SMOKE_IMPORT_PACKAGE = packagePath;
}

const child = spawn(electronBin, ["."], {
  cwd: repoRoot,
  env: childEnv,
  stdio: "inherit",
  windowsHide: true
});

child.on("close", (code) => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
  process.exit(code || 0);
});

child.on("error", (error) => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
  console.error(error.message || error);
  process.exit(1);
});

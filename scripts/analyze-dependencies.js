const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { analyzeProject } = require("./lib/static-js-analysis");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs", "analysis");
const report = analyzeProject(root, {
  include: /\.(js|mjs|cjs|jsx|ts|tsx|html|css|md|yaml|json)$/i,
  excludeDirs: ["node_modules", ".git", "dist", "out", "release", "docs", "tmp"]
});
const runtimeFunction = (item) => item.filePath.startsWith("src/")
  && !item.filePath.startsWith("src/main/renderer-smoke");
const appFunction = (item) => runtimeFunction(item);
const appTopIncoming = report.functions
  .filter(appFunction)
  .slice()
  .sort((a, b) => b.incoming - a.incoming || b.outgoing - a.outgoing || a.name.localeCompare(b.name))
  .slice(0, 24);
const appTopOutgoing = report.functions
  .filter(appFunction)
  .slice()
  .sort((a, b) => b.outgoing - a.outgoing || b.incoming - a.incoming || a.name.localeCompare(b.name))
  .slice(0, 24);
const smokeRunnerFiles = report.jsFiles
  .filter((item) => item.filePath.startsWith("src/main/renderer-smoke") || item.filePath === "scripts/renderer-smoke.js")
  .sort((a, b) => b.functionCount - a.functionCount || a.filePath.localeCompare(b.filePath));

fs.mkdirSync(outDir, { recursive: true });

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

const jsonPath = path.join(outDir, "meodesk-dependency-analysis.json");
const mdPath = path.join(outDir, "meodesk-dependency-analysis.md");
report.generatedAt = new Date().toISOString();
Object.assign(report, gitSourceState());
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

const topCoreFiles = [
  { file: "src/renderer-app/src/app/App.tsx", role: "next renderer shell" },
  { file: "src/renderer-app/src/features/workspace/workspace-route.tsx", role: "workspace runtime surface" },
  { file: "src/renderer-app/src/features/studio/studio-route.tsx", role: "studio surface" },
  { file: "src/renderer-app/src/features/readiness/readiness-routes.tsx", role: "default readiness fixture surface" },
  { file: "src/renderer-app/src/features/meow-viewer/meow-viewer-contract.ts", role: "shared Meow Viewer data contract" },
  { file: "src/renderer-app/src/features/meow-viewer/meow-viewer-conversation.tsx", role: "shared Meow Viewer renderer core" },
  { file: "src/renderer-app/src/features/meow-viewer/meow-viewer-parser.ts", role: "shared Meow Viewer parser core" },
  { file: "src/main/agent-runtime-context-service.js", role: "Agent runtime prompt/context owner" },
  { file: "src/main/agent-runtime-launch-service.js", role: "Agent runtime env and launch arg owner" },
  { file: "src/main/meodesk-home-service.js", role: "Meodesk Home and storage owner" },
  { file: "src/main.js", role: "main process coordinator" },
  { file: "src/preload.js", role: "bridge core" }
];
const leafFiles = [
  "src/renderer-app/index.html",
  "src/renderer-app/src/styles/app.css",
  "assets/agent-skills/meodesk-bridge/SKILL.md"
];

const fileLines = report.jsFiles
  .map((item) => `- \`${item.filePath}\`: deps=${item.dependencies.length}, functions=${item.functionCount}, ipc=${item.ipc.length}, workbench=${item.workbench.exposed.length}/${item.workbench.used.length}`)
  .slice(0, 200);

const incomingLines = appTopIncoming
  .map((item) => `- \`${item.name}\` @ \`${item.filePath}:${item.line}\`: incoming=${item.incoming}, outgoing=${item.outgoing}`);

const outgoingLines = appTopOutgoing
  .map((item) => `- \`${item.name}\` @ \`${item.filePath}:${item.line}\`: outgoing=${item.outgoing}, incoming=${item.incoming}`);
const smokeRunnerLines = smokeRunnerFiles
  .map((item) => `- \`${item.filePath}\`: deps=${item.dependencies.length}, functions=${item.functionCount}, workbench-used=${item.workbench.used.length}`);

const coreRelationships = [
  ["src/renderer-app/src/app/App.tsx", "App", "RouteShell -> WorkspaceRoute / StudioRoute / TaskCenterRoute", "next renderer 是唯一正常 UI 入口。"],
  ["src/renderer-app/src/features/workspace/workspace-route.tsx", "WorkspaceRoute", "WorkspaceTerminalRuntime -> terminal IPC -> Meow Viewer source snapshots", "工作区承载 CLI/TUI、Meow Viewer 和桌宠反馈。"],
  ["src/renderer-app/src/features/studio/studio-route.tsx", "AgentRuntimeStage", "StudioMeowViewerOverlay -> shared WorkspaceRenderedConversation", "工坊复用工作区 Viewer core，不再保留独立 markdown UI。"],
  ["src/renderer-app/src/features/meow-viewer/meow-viewer-contract.ts", "workspaceRendererProfileForPane", "Workspace/Studio source selection -> WorkspaceRendererProfile", "共享数据契约先于 parser 行为，调用方不再为了类型和 profile 判定依赖 parser。"],
  ["src/renderer-app/src/features/meow-viewer/meow-viewer-conversation.tsx", "WorkspaceRenderedConversation", "parsed blocks -> rendered message/tool/diff/table surfaces", "工作区和工坊共享同一套 Viewer 渲染核心。"],
  ["src/main/agent-runtime-context-service.js", "createAgentRuntimeContextService", "runtime object -> context markdown / workshop rules / session skill", "Agent runtime prompt/context 文本从 main coordinator 外迁。"],
  ["src/main/agent-runtime-launch-service.js", "withWslRuntimeArgs", "runtime env -> Claude/Hermes/WSL launch arguments", "Agent runtime 启动投影从 main coordinator 外迁。"],
  ["src/main/meodesk-home-service.js", "createMeodeskHomeService", "Meodesk Home migration/storage keys/runtime cache path", "主进程目录契约从 coordinator 外迁，src/main.js 只保留组合视图和 IPC wiring。"],
  ["src/main.js", "ipcMain.handle terminal:start", "startTerminal -> node-pty -> webContents.send terminal:data", "主进程 PTY 输出进入 renderer 的 terminal 数据流。"],
  ["src/preload.js", "contextBridge.exposeInMainWorld", "ipcRenderer.invoke/send", "renderer 只通过 workbench API 访问主进程能力。"]
];

const coreModuleLines = [
  ["Next renderer shell", "`App`、`useWorkbenchSummary`、RouteShell、TopNav 和 feature-page 路由。"],
  ["Workspace runtime", "`WorkspaceRoute`、`WorkspaceTerminalRuntime`、Meow Viewer source snapshot、窗格排序/隐藏/关闭生命周期。"],
  ["Studio runtime", "`AgentRuntimeStage`、工坊项目管理、工坊 Agent runtime、共享 Meow Viewer overlay。"],
  ["Meow Viewer shared core", "`meow-viewer-contract`、`meow-viewer-parser`、`meow-viewer-source`、`meow-viewer-conversation`、`meow-viewer-composer`。"],
  ["Main runtime/schema/ipc", "`meodesk-home-service`、`agent-runtime-context-service`、`agent-runtime-launch-service`、runtime JSON/file write coordination、terminal/pty、task/conversation/proposal IPC"],
  ["Preload bridge", "`window.workbench` API，是 renderer 和 main 的唯一稳定桥。"],
  ["Board/task ingestion", "`MEODESK_TASK` 解析、task normalize、看板保存和热同步。"]
];

const leafModuleLines = [
  ["UI shell", "`src/renderer-app/index.html`：Vite renderer DOM 容器与入口。"],
  ["Styles", "`src/renderer-app/src/styles/app.css`：视觉叶子模块，不能放业务规则。"],
  ["Bridge skill", "`assets/agent-skills/meodesk-bridge/SKILL.md`：Agent 侧协议说明资产。"],
  ["Generated reports", "`docs/analysis/*`：分析产物，不参与运行。"],
  ["Dev tooling", "`scripts/analyze-dependencies.js`、`scripts/maintenance-final-audit.js`、`scripts/mvp-baseline-contract.test.js`、`scripts/lib/static-js-analysis.js`、`scripts/meow-viewer-parser-fixtures/`：工程治理工具、当前 MVP baseline 与 fixture harness。"]
];

const md = `# Meodesk 静态依赖图与核心/叶子模块分析

> 生成时间：${report.generatedAt}
> 生成来源 HEAD：${report.generatedFromHead}
> 源码树有未提交修改：${report.sourceTreeDirty}
> 扫描范围：仓库源码与项目脚本，含 JS/TS/TSX/JSX（排除 node_modules / .git / dist / out / release / docs / tmp）

## 结论摘要

- legacy renderer 已退役；next renderer 是唯一正常 UI 入口。
- 核心文件仍偏集中：\`workspace-route.tsx\`、\`studio-route.tsx\`、\`readiness-routes.tsx\`、\`src/main.js\`。
- Renderer smoke 已从中心 runner 拆到 registry 和域场景模块；当前 test 侧压力在个别长 scenario body 与重复 DOM helper。
- Meow Viewer 已有共享 core/plugin 轮廓，并已抽出 contract 层；下一步可继续细分 source event adapter、parser fixtures 和 renderer block 组件。
- 叶子文件主要是 Vite 入口、样式、smoke fixture、bridge skill 和分析产物。
- Workflow Beta 已归档到当前 MVP 基线之外；后续分析不得把归档 route、service、battery 或 smoke 当成活动 owner。
- main 侧核心在 IPC 协调、runtime JSON/file write coordination、runtime prompt/context、Meodesk Home、terminal/pty 与文件目录契约。

## 文件级依赖概览

${fileLines.join("\n")}

## 核心文件

${topCoreFiles.map((item) => `- \`${item.file}\` (${item.role})`).join("\n")}

## 核心模块

${coreModuleLines.map(([name, detail]) => `- **${name}**：${detail}`).join("\n")}

## 叶子文件

${leafFiles.map((item) => `- \`${item}\``).join("\n")}

## 叶子模块

${leafModuleLines.map(([name, detail]) => `- **${name}**：${detail}`).join("\n")}

## 关键直接调用关系

${coreRelationships.map(([file, from, to, note]) => `- \`${file}\`：\`${from}\` -> \`${to}\`。${note}`).join("\n")}

## 高入度函数

${incomingLines.join("\n")}

## 高出度函数

${outgoingLines.join("\n")}

## Renderer Smoke 热点

${smokeRunnerLines.join("\n")}

## 备注

- 这里的函数级图是静态字符串级分析，适合做重构前的方向图和风险图，不适合代替真实运行时 trace。
- 高入度/高出度榜排除了 renderer smoke；smoke 是测试治理热点，单独列在上一节，避免重复局部 helper 名称污染产品运行核心排行。
- 后续如果要拆模块，优先从 workspace runtime、studio runtime、Meow Viewer core/plugin 和 main IPC registry 这些边界开始。
- \`scripts/mvp-baseline-contract.test.js\` 与分析脚本属于治理工具，不是产品运行核心。
`;

fs.writeFileSync(mdPath, md, "utf8");
console.log(`Wrote ${path.relative(root, jsonPath)}`);
console.log(`Wrote ${path.relative(root, mdPath)}`);
console.log(`Files scanned: ${report.files.length}`);
console.log(`Script files: ${report.jsFiles.length}`);
console.log(`Functions: ${report.functions.length}`);

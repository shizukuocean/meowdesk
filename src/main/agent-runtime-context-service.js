const path = require("path");

function defaultWorkshopTargetForType(type) {
  return type === "sidebar-widget" ? "workspace-sidebar" : "main-nav";
}

function defaultWorkshopRuntimeForType(type) {
  return type === "sidebar-widget" ? "meodesk-sidebar-widget" : "html";
}

function createAgentRuntimeContextService(options = {}) {
  const workshopTargetForType = typeof options.workshopTargetForType === "function"
    ? options.workshopTargetForType
    : defaultWorkshopTargetForType;
  const workshopRuntimeForType = typeof options.workshopRuntimeForType === "function"
    ? options.workshopRuntimeForType
    : defaultWorkshopRuntimeForType;

  function workshopRuntimeSection(runtime) {
    if (!runtime?.workshop?.enabled) return [];
    return [
      "",
      "## 工坊模式",
      "",
      "你正在 Meodesk 工坊中运行。Meodesk 只告诉你什么产物能在 Meodesk 里跑起来；开发、调试和迭代仍由你作为 Agent 完成。",
      `- 默认创建类型: ${runtime.workshop.label} (${runtime.workshop.type})`,
      `- 默认目标位置: ${runtime.workshop.target}`,
      "- Meodesk 不替你生成产品，也不把你的正常 Agent 能力收窄成固定脚本。",
      "- 工坊作品交付到 extensionsDir 下的独立作品目录。",
      "- `.meow` 是 Meodesk 作品的成品运行单元，开发源仍然保留在工程目录里。",
      "- 用户给出某个工坊工程路径时，直接读取该目录内的 MEODESK_PROJECT.md、manifest 和 versions 继续开发。",
      "- 用户给出 `.meow` 时，先安装或还原成 `extensions/<id>/` 目录，再按工程目录继续工作。",
      `- 当前类型规则文件: ${runtime.workshop.rulesFile || "(未生成)"}`,
      "- 开始创建或继续作品前，先读当前类型规则文件；它是本轮工坊类型的最小接入规则，不是创意模板。",
      "- 每个作品目录应包含 meodesk-extension.manifest.json。",
      "- 右侧栏组件的核心规则：manifest 声明 type=sidebar-widget、target=workspace-sidebar、entry 可加载，并且界面能适配右侧栏宽高。",
      "- 默认写入 `ui.theme=\"inherit\"`，插件应优先继承 Meodesk 主题变量和宿主外壳，而不是自带一整套网页皮肤。"
    ];
  }

  function runtimeContextMarkdown(runtime) {
    return [
      "# Meodesk Runtime Context",
      "",
      "你正在 Meodesk 工作台中运行。",
      "你仍然是完整能力 Agent；Meodesk 提供路径、协议和可观察运行环境，不替你思考，也不压缩你的正常能力。",
      "",
      "## 你的身份",
      "",
      `- agentId: ${runtime.agentId}`,
      `- agentName: ${runtime.agentName}`,
      `- agentKind: ${runtime.agentKind}`,
      `- paneId: ${runtime.paneId}`,
      "",
      "## 本地接口",
      "",
      `- interfaceDir: ${runtime.interfaceDir}`,
      `- inboxDir: ${runtime.inboxDir}`,
      `- registeredDir: ${runtime.registeredDir}`,
      `- proposalsDir: ${runtime.proposalsDir}`,
      `- conversationsDir: ${runtime.conversationsDir}`,
      `- extensionsDir: ${runtime.extensionsDir}`,
      `- nodesDir: ${runtime.nodesDir}`,
      `- skillsDir: ${runtime.skillsDir}`,
      `- bundledSkillsDir: ${runtime.bundledSkillsDir}`,
      `- runtimeFile: ${runtime.runtimeFile}`,
      `- taskSchema: ${runtime.schemas.task}`,
      `- conversationSchema: ${runtime.schemas.conversation}`,
      `- agentNodeCardSchema: ${runtime.schemas.agentNodeCard}`,
      `- featureProposalSchema: ${runtime.schemas.featureProposal}`,
      `- extensionManifestSchema: ${runtime.schemas.extensionManifest}`,
      `- meowPackageSchema: ${runtime.schemas.meowPackage}`,
      `- meowPackageSpec: ${runtime.schemas.meowPackageSpec}`,
      ...workshopRuntimeSection(runtime),
      "",
      "## 可用协议",
      "",
      "- MEODESK_TASK：在终端输出协议块，向 Meodesk 看板投递任务。",
      "- meodesk-task JSON：向 inboxDir 写入任务文件，Meodesk 会热同步到看板。",
      "- MEODESK_CONVERSATION：在终端输出协议块，向 MEODESK_CONVERSATIONS_DIR 投递对话记录。",
      "- meodesk-conversation JSON：向 MEODESK_CONVERSATIONS_DIR 写入对话记录，Meodesk 会按 Agent 分组显示。",
      "- MEODESK_PET：向 Meodesk 上报当前工作状态和桌宠反馈。",
      "- meodesk-extension manifest：工坊扩展对象必须写入 extensionsDir/<id>/meodesk-extension.manifest.json。",
      "- meow-package：`.meow` 是扩展对象的成品运行单元与安装包，规则见 MEODESK_MEOW_PACKAGE_SPEC 和 MEODESK_MEOW_PACKAGE_SCHEMA。",
      "- sidebar-widget 轻协议：告诉你什么产品能在右侧栏跑起来；它只描述入口、尺寸适配、宿主主题继承和可选状态保存，不限制作品内容形态。",
      "- connect-request：按 schema.json 在 inbox 目录提交接入申请。",
      "- feature-proposal：后续用于向 proposals 目录提交小组件或功能申请，需用户确认后才会安装。",
      "- meodesk-bridge skill：如果你的 Agent 支持 skill，可加载 skillsDir/meodesk-bridge。",
      `- meodesk-bridge path: ${path.join(runtime.skillsDir, "meodesk-bridge")}`,
      "",
      "## 工坊扩展模式",
      "",
      "- 当用户在工坊要求制作 Meodesk 功能页或工作区右侧栏组件时，按正常 Agent 能力理解需求、开发、调试和迭代；Meodesk 只提供规则与路径。",
      "- 不要直接修改 Meodesk 源码，除非用户明确要求修改 Meodesk 本体。",
      "- 在 extensionsDir 下创建一个作品目录，目录名使用稳定小写 id，例如 `extensions/my-tool/`。",
      "- 如果用户提供已有工程路径，优先在该目录内继续开发，不要另起一个同类作品目录，除非用户明确要求。",
      "- 工程目录可以包含 `MEODESK_PROJECT.md`；这是给 Agent 接回开发线的轻量说明。",
      "- 每个作品目录必须包含 `meodesk-extension.manifest.json`，并符合 extensionManifestSchema。",
      "- `.meow` 既是作品的成品包，也是可安装的运行单元；安装后仍应还原到同一套 `extensions/<id>/` 工程目录，不能替代工程目录作为开发源。",
      "- 如需保留历史版本，可把快照放入 `extensions/<id>/versions/<version>/`，每个版本目录也包含自己的 manifest 和 entry。",
      "- 首版支持 `type=feature-page` 与 `type=sidebar-widget`。功能页目标为 `main-nav`，右侧栏组件目标为 `workspace-sidebar`。",
      "- 右侧栏可运行条件：入口文件可被本地加载；manifest 声明 `type: \"sidebar-widget\"`、`target: \"workspace-sidebar\"`；布局能响应右侧栏宽高。",
      "- 右侧栏组件可以是工具、游戏、看板、计时器或任意自定义形态；规则只说明能否接入右侧栏，不限制玩法或 UI。",
      "- 右侧栏组件建议在 manifest 写 `runtime: \"meodesk-sidebar-widget\"`，并提供 `sidebarWidget.minHeight`、`sidebarWidget.preferredHeight`、`sidebarWidget.resizeMode`。",
      "- 右侧栏组件建议写 `ui.theme: \"inherit\"`、`ui.surface: \"host\"`、`ui.chrome: \"none\"` 或 `\"minimal\"`，让作品继承 Meodesk 的字体、颜色、圆角、边线和按钮感觉。",
      "- 右侧栏组件页面可监听宿主 `postMessage`：`meodesk:init`、`meodesk:theme`、`meodesk:resize`、`meodesk:state`；需要保存状态时向父窗口发送 `meodesk:state:set`。",
      "- 宿主会通过 theme tokens 提供 `--meodesk-bg`、`--meodesk-panel`、`--meodesk-text`、`--meodesk-muted`、`--meodesk-border`、`--meodesk-accent`、`--meodesk-radius`、`--meodesk-font` 等变量；插件应优先使用这些变量，并为独立预览保留 fallback。",
      "- 插件默认不要铺满强烈自定义背景，不要再包一层完整网页卡片；右侧栏由 Meodesk 提供外壳，插件内容应像内部组件一样贴合宿主。",
      "- 按用户需求生成必要文件、资源和说明；不要把作品收窄成固定模板。",
      "- 需要让 Meodesk 后续安装、发布或审核时，再向 proposalsDir 写入 feature-proposal，引用 manifestPath 和相关文件，等待用户确认。",
      "",
      "## 安全边界",
      "",
      "- 不要默认修改 Meodesk 源码。",
      "- 不要写入密钥、token、cookie。",
      "- 任何自定义功能、小组件或插件都应先提交申请，由用户确认。",
      "- 你可以读取本文件和 runtime JSON 来了解自己在 Meodesk 内部的运行上下文。"
    ].join("\n");
  }

  function normalizeWorkshopRuntime(workshop) {
    const input = workshop && typeof workshop === "object" ? workshop : {};
    const project = input.project && typeof input.project === "object" ? input.project : {};
    const text = (value, limit = 1000) => {
      const result = String(value || "").trim();
      return limit && result.length > limit ? result.slice(0, limit) : result;
    };
    const type = ["feature-page", "sidebar-widget"].includes(input.type) ? input.type : "feature-page";
    return {
      enabled: Boolean(input.enabled),
      type,
      label: String(input.label || (type === "sidebar-widget" ? "右侧栏组件" : "功能页")),
      target: String(input.target || (type === "sidebar-widget" ? "workspace-sidebar" : "main-nav")),
      projectId: text(input.projectId || project.id, 200),
      projectName: text(input.projectName || project.name, 300),
      projectPath: text(input.projectPath || project.path, 1200),
      manifestPath: text(input.manifestPath || project.manifestPath, 1200),
      entryPath: text(input.entryPath || project.entryPath, 1200),
      entry: text(input.entry || project.entry, 300),
      status: text(input.status || project.status, 120),
      version: text(input.version || project.version, 120),
      runtime: text(input.runtime || project.runtime, 200)
    };
  }

  function workshopRuntimeProjectLines(workshop, mapPath = (value) => value) {
    if (!workshop?.projectPath && !workshop?.projectId) return [];
    const line = (label, value, mapper = (item) => item) => {
      const text = String(value || "").trim();
      return text ? `- ${label}: ${mapper(text)}` : "";
    };
    return [
      "Selected workshop project:",
      line("projectId", workshop.projectId),
      line("projectName", workshop.projectName),
      line("projectPath", workshop.projectPath, mapPath),
      line("manifestPath", workshop.manifestPath, mapPath),
      line("entryPath", workshop.entryPath, mapPath),
      line("entry", workshop.entry),
      line("status", workshop.status),
      line("version", workshop.version),
      line("runtime", workshop.runtime)
    ].filter(Boolean);
  }

  function workshopTypeRulesMarkdown(runtime) {
    const workshop = runtime?.workshop || {};
    const type = workshop.type === "sidebar-widget" ? "sidebar-widget" : "feature-page";
    const label = workshop.label || (type === "sidebar-widget" ? "右侧栏组件" : "功能页");
    const target = workshop.target || workshopTargetForType(type);
    const runtimeKind = workshopRuntimeForType(type);
    const selectedProjectLines = workshopRuntimeProjectLines(workshop);
    const typeRules = type === "sidebar-widget" ? [
      "## 右侧栏组件规则",
      "",
      "- Manifest 必须声明 `type: \"sidebar-widget\"` 与 `target: \"workspace-sidebar\"`。",
      "- 建议声明 `runtime: \"meodesk-sidebar-widget\"`。",
      "- 入口文件必须能在本地 iframe 宿主中加载，不能依赖远端服务才能显示首屏。",
      "- 布局必须适配工作区右侧栏宽度和可拖拽高度；不要写固定大页面宽度。",
      "- 建议写 `sidebarWidget.minHeight`、`sidebarWidget.preferredHeight`、`sidebarWidget.maxHeight` 和 `sidebarWidget.resizeMode`。",
      "- 优先继承宿主主题：`ui.theme: \"inherit\"`、`ui.surface: \"host\"`、`ui.chrome: \"minimal\"` 或 `\"none\"`。",
      "- 可监听宿主 `postMessage`：`meodesk:init`、`meodesk:theme`、`meodesk:resize`、`meodesk:state`。",
      "- 需要保存轻量状态时，向父窗口发送 `meodesk:state:set`；不要默认写入 Meowdesk 源码或全局配置。",
      "- 右侧栏组件可以是工具、游戏、看板、计时器或任意用户需要的形态；这些规则只限定接入条件。"
    ] : [
      "## 功能页规则",
      "",
      "- Manifest 必须声明 `type: \"feature-page\"` 与 `target: \"main-nav\"`。",
      "- 建议声明 `runtime: \"html\"`。",
      "- 入口文件必须能在本地 iframe 宿主中加载，不能依赖远端服务才能显示首屏。",
      "- 页面应作为 Meowdesk 主工作区的一页使用，避免横向溢出和固定大宽度。",
      "- 建议写 `page.navLabel` 和稳定 `page.route`，供本机动态导航展示。",
      "- 优先继承宿主主题：`ui.theme: \"inherit\"`、`ui.surface: \"host\"`、`ui.chrome: \"minimal\"` 或 `\"host\"`。",
      "- 可监听宿主 `postMessage`：`meodesk:init` 与 `meodesk:theme`。",
      "- 功能页可以是完整工具页、编辑器、仪表盘、教程页或任意用户需要的工作区页面；这些规则只限定接入条件。"
    ];
    return [
      "# Meodesk Workshop Type Rules",
      "",
      "Rule pack id: meodesk.workshop.rules.v1",
      `Artifact type: ${type}`,
      `Artifact label: ${label}`,
      `Target: ${target}`,
      `Recommended runtime: ${runtimeKind}`,
      "",
      "## 读取顺序",
      "",
      "1. 如果 `MEODESK_WORKSHOP_PROJECT_PATH` 存在，先读取该目录内的 `MEODESK_PROJECT.md`。",
      "2. 再读取 `meodesk-extension.manifest.json`。",
      "3. 再检查 manifest.entry 对应入口文件。",
      "4. 最后按本规则文件补齐接入字段、预览兼容和宿主主题继承。",
      "",
      "## 共同原则",
      "",
      "- Meowdesk 只提供运行规则、路径、manifest/schema 和本地启用/发布测试链路，不替 Agent 创作。",
      "- Agent 应根据用户需求正常设计、编码、调试和迭代作品。",
      "- 不要默认修改 Meowdesk 应用源码。",
      "- 不要写入密钥、token、cookie 或需要联网才能完成的隐藏依赖。",
      "- 开发源目录固定为 `MEODESK_EXTENSIONS_DIR/<extension-id>/`。",
      "- 每个作品目录必须包含 `meodesk-extension.manifest.json`。",
      "- `.meow` 是成品运行包，不替代开发源目录。",
      "- 做出可用版本后，可以更新 manifest.status/version，或在 `versions/<version>/` 保存快照。",
      "",
      ...typeRules,
      "",
      "## Manifest 最小示例",
      "",
      "```json",
      JSON.stringify({
        schema: "meodesk.extension.manifest.v0",
        id: type === "sidebar-widget" ? "my-sidebar-widget" : "my-feature-page",
        type,
        name: type === "sidebar-widget" ? "我的右侧栏组件" : "我的功能页",
        version: "0.1.0",
        summary: "一句话说明作品用途。",
        target,
        entry: "index.html",
        runtime: runtimeKind,
        status: "draft",
        permissions: [],
        ui: {
          theme: "inherit",
          surface: "host",
          chrome: type === "sidebar-widget" ? "minimal" : "host",
          density: type === "sidebar-widget" ? "compact" : "auto",
          tokenProtocol: "meodesk.theme.v0"
        },
        ...(type === "sidebar-widget" ? {
          sidebarWidget: {
            title: "我的右侧栏组件",
            minHeight: 120,
            preferredHeight: 260,
            maxHeight: 960,
            resizeMode: "responsive",
            protocol: "meodesk.sidebar-widget.v0"
          }
        } : {
          page: {
            navLabel: "我的功能页",
            route: "my-feature-page",
            icon: ""
          }
        })
      }, null, 2),
      "```",
      "",
      ...selectedProjectLines
    ].join("\n");
  }

  function workshopSystemPrompt(runtime) {
    if (!runtime?.workshop?.enabled) return "";
    return [
      "Meodesk Workshop context:",
      "You are running inside Meodesk Workshop. You remain a full-capability agent; Meodesk only tells you what artifacts can run inside Meodesk, where to place them, and which manifest/runtime rules make them loadable.",
      "Meodesk does not develop the artifact for you and must not be treated as an automatic converter or product designer.",
      "Do not treat this as a restricted mode. Answer ordinary conversation normally, and only inspect files or schemas when the user's task actually needs them.",
      `Default artifact type: ${runtime.workshop.label} (${runtime.workshop.type}).`,
      `Default target: ${runtime.workshop.target}.`,
      `Runtime file: ${runtime.runtimeFile}`,
      `Context file: ${runtime.contextFile}`,
      `Extensions directory: ${runtime.extensionsDir}`,
      `Extension manifest schema: ${runtime.schemas.extensionManifest}`,
      `Meow package schema: ${runtime.schemas.meowPackage}`,
      `Meow package spec: ${runtime.schemas.meowPackageSpec}`,
      `Type-specific rules file: ${runtime.workshop.rulesFile || ""}`,
      `Proposals directory: ${runtime.proposalsDir}`,
      ...workshopRuntimeProjectLines(runtime.workshop),
      "Before creating or updating an artifact, read the type-specific rules file when you need exact Meodesk workshop requirements. It is the stable rule entry for the selected artifact type.",
      "When the user asks you to create a Meodesk workshop artifact, create and iterate the artifact yourself in an independent folder under the extensions directory and include meodesk-extension.manifest.json. If the user wants version history, keep version snapshots under extensions/<id>/versions/<version>/ with their own manifest and entry. Use proposals only when the artifact needs Meodesk installation or enablement review.",
      "If the user asks for a `.meow` artifact, build the current extension into an installable runtime package first, then keep the source engineering folder intact.",
      "If the user gives you an existing workshop project path, read MEODESK_PROJECT.md, meodesk-extension.manifest.json, and versions/ in that folder, then continue that project instead of creating a duplicate unless the user asks for a new project.",
      "If a selected workshop project is listed above, continue in that project folder first. Do not create a duplicate unless the user explicitly asks for a new artifact.",
      "For sidebar widgets, the rule is only about what can run in the right sidebar: declare type=sidebar-widget, target=workspace-sidebar, a loadable entry, and sizing hints in manifest.sidebarWidget; make the page responsive to the sidebar container. Also declare ui.theme=inherit and prefer Meodesk host theme tokens from meodesk:init/meodesk:theme over hard-coded app chrome. Do not restrict what the widget can be.",
      "This context must not reduce your normal reasoning, tool use, debugging, or collaboration abilities."
    ].join("\n");
  }

  function workshopSessionSkillMarkdown(runtime) {
    const type = runtime?.workshop?.type || "feature-page";
    const label = runtime?.workshop?.label || "功能页";
    const target = runtime?.workshop?.target || (type === "sidebar-widget" ? "workspace-sidebar" : "main-nav");
    return [
      "---",
      "name: meodesk-workshop-session",
      "description: Active Meodesk Workshop session context. Use when creating or iterating Meodesk feature pages, workspace right-sidebar widgets, or other Meodesk extension artifacts.",
      "---",
      "",
      "# Meodesk Workshop Session",
      "",
      "You are running inside Meodesk Workshop.",
      "",
      "Meodesk gives you the rules for artifacts that can run inside Meodesk. It does not think for you, does not create the artifact for you, and does not reduce your normal agent ability.",
      "",
      "## Current Context",
      "",
      `- Default artifact type: ${label} (${type})`,
      `- Default target: ${target}`,
      "- Runtime path source of truth: `MEODESK_RUNTIME_FILE`",
      "- Human-readable context: `MEODESK_CONTEXT_FILE`",
      "- Workshop system prompt file: `MEODESK_WORKSHOP_SYSTEM_PROMPT_FILE`",
      "- Type-specific rules file: `MEODESK_WORKSHOP_RULES_FILE`",
      "- Extension output directory: `MEODESK_EXTENSIONS_DIR`",
      "- Extension manifest schema: `MEODESK_EXTENSION_MANIFEST_SCHEMA`",
      "- Meow package schema: `MEODESK_MEOW_PACKAGE_SCHEMA`",
      "- Meow package spec: `MEODESK_MEOW_PACKAGE_SPEC`",
      "- Proposal directory: `MEODESK_PROPOSALS_DIR`",
      "- Selected project path: `MEODESK_WORKSHOP_PROJECT_PATH` when Meodesk has an active project selected",
      "- Selected project manifest: `MEODESK_WORKSHOP_MANIFEST_PATH`",
      "- Selected project entry: `MEODESK_WORKSHOP_ENTRY_PATH`",
      "",
      ...workshopRuntimeProjectLines(runtime.workshop).map((item) => item.replace(/^Selected workshop project:$/, "## Selected Project")),
      "",
      "## Operating Principle",
      "",
      "- Stay a full-capability agent. Use normal conversation, reasoning, tools, debugging, and iteration.",
      "- Do not read files or run commands just to answer greetings or simple questions.",
      "- If the user asks whether you are in Meodesk Workshop, you may answer from this session context.",
      "- Read `MEODESK_RUNTIME_FILE` or schema files only when exact paths, schema fields, or file creation are needed.",
      "- Read `MEODESK_WORKSHOP_RULES_FILE` before creating or updating a workshop artifact for the selected type.",
      "- Do not rewrite the user's request into a narrower Meodesk task. The user talks directly to you.",
      "",
      "## Extension Contract",
      "",
      "- For workshop creation tasks, use your normal agent ability to understand, implement, debug, and iterate the user's requested artifact.",
      "- Meodesk only supplies the rules and paths needed for that artifact to run in Meodesk.",
      "- Create an independent folder under `MEODESK_EXTENSIONS_DIR/<extension-id>/`.",
      "- If `MEODESK_WORKSHOP_PROJECT_PATH` is set, continue that selected project first instead of creating a duplicate.",
      "- If the user provides an existing workshop project path, read `MEODESK_PROJECT.md`, the manifest, and `versions/`, then continue that project in place.",
      "- If the user provides a `.meow` file, install or unpack it into an `extensions/<id>/` directory and continue from that folder.",
      "- Every extension folder must include `meodesk-extension.manifest.json`.",
      "- Optional version snapshots can live under `MEODESK_EXTENSIONS_DIR/<extension-id>/versions/<version>/`, each with its own manifest and entry.",
      "- Use `type: \"feature-page\"` with `target: \"main-nav\"` for feature pages.",
      "- Use `type: \"sidebar-widget\"` with `target: \"workspace-sidebar\"` for workspace right-sidebar widgets.",
      "- For right-sidebar widgets, the only core rule is that the product can run in the right sidebar: a loadable entry, correct manifest target, responsive layout, host theme inheritance, and optional lightweight state persistence.",
      "- Prefer `runtime: \"meodesk-sidebar-widget\"` and declare `sidebarWidget` sizing hints. Treat these as host-fit hints, not creative restrictions.",
      "- Prefer `ui.theme: \"inherit\"`, `ui.surface: \"host\"`, and `ui.chrome: \"none\"` or `\"minimal\"` so the artifact feels native inside Meodesk.",
      "- Sidebar widgets may listen for `meodesk:init`, `meodesk:theme`, and `meodesk:resize` postMessage events from the host; they may send `meodesk:state:set` to ask Meodesk to persist lightweight state.",
      "- The host theme payload provides CSS token names such as `--meodesk-bg`、`--meodesk-panel`、`--meodesk-text`、`--meodesk-muted`、`--meodesk-border`、`--meodesk-accent`、`--meodesk-radius`、`--meodesk-font`. Use these variables first, with fallback values for standalone preview.",
      "- Do not wrap sidebar widgets in a second full app shell by default. Let Meodesk provide the outer card/header; keep the widget surface transparent or host-toned unless the user explicitly asks for a strong custom skin.",
      "- Keep artifacts local and low-risk unless the user explicitly asks for deeper integration.",
      "- After creating or updating an artifact, write a proposal to `MEODESK_PROPOSALS_DIR` when Meodesk needs to install, enable, debug, or publish it.",
      "- Do not modify Meodesk application source by default. Source edits require an explicit user request.",
      "",
      "## Minimal Manifest Shape",
      "",
      "```json",
      "{",
      "  \"schema\": \"meodesk.extension.manifest.v0\",",
      "  \"id\": \"example-extension\",",
      "  \"type\": \"feature-page\",",
      "  \"name\": \"Example Extension\",",
      "  \"version\": \"0.1.0\",",
      "  \"summary\": \"Short user-facing purpose.\",",
      "  \"target\": \"main-nav\",",
      "  \"entry\": \"index.html\",",
      "  \"runtime\": \"html\",",
      "  \"status\": \"draft\",",
      "  \"permissions\": [],",
      "  \"ui\": {",
      "    \"theme\": \"inherit\",",
      "    \"surface\": \"host\",",
      "    \"chrome\": \"minimal\",",
      "    \"density\": \"auto\",",
      "    \"tokenProtocol\": \"meodesk.theme.v0\"",
      "  }",
      "}",
      "```"
    ].join("\n");
  }

  return {
    normalizeWorkshopRuntime,
    runtimeContextMarkdown,
    workshopRuntimeProjectLines,
    workshopRuntimeSection,
    workshopSessionSkillMarkdown,
    workshopSystemPrompt,
    workshopTypeRulesMarkdown
  };
}

module.exports = { createAgentRuntimeContextService };

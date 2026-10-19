const fs = require("fs");
const path = require("path");

const DEFAULT_MEOW_PACKAGE_SCHEMA_ID = "meodesk.meow.package.v0";

function requireDependency(options, name) {
  const dependency = options[name];
  if (typeof dependency !== "function") throw new Error("createAgentInterfaceService requires " + name + ".");
  return dependency;
}

function createAgentInterfaceService(options = {}) {
  const cacheableAgentInterfaceInfo = requireDependency(options, "cacheableAgentInterfaceInfo");
  const getAgentInterfaceDirectory = requireDependency(options, "getAgentInterfaceDirectory");
  const getAgentSkillsDirectory = requireDependency(options, "getAgentSkillsDirectory");
  const getCachedAgentInterfaceInfo = requireDependency(options, "getCachedAgentInterfaceInfo");
  const getConversationDirectory = requireDependency(options, "getConversationDirectory");
  const meodeskHomePath = requireDependency(options, "meodeskHomePath");
  const scanImportedAgentConversations = requireDependency(options, "scanImportedAgentConversations");
  const scanWorkshopExtensions = requireDependency(options, "scanWorkshopExtensions");
  const writeFileIfMissing = requireDependency(options, "writeFileIfMissing");
  const writeGeneratedFile = requireDependency(options, "writeGeneratedFile");
  const meowPackageSchemaId = String(options.meowPackageSchemaId || DEFAULT_MEOW_PACKAGE_SCHEMA_ID);

  function agentInterfacePrompt(rootPath) {
    const inboxPath = path.join(rootPath, "inbox");
    const conversationsPath = getConversationDirectory();
    const schemaPath = path.join(rootPath, "schema.json");
    return [
      "请把你自己作为一个 Meodesk 工作窗接入。",
      "",
      "你需要读取本地接口说明和 schema，然后在 inbox 目录写入一个 JSON 接入申请文件。",
      "",
      `接口目录：${rootPath}`,
      `申请目录：${inboxPath}`,
      `对话目录：${conversationsPath}`,
      `Schema：${schemaPath}`,
      "",
      "要求：",
      "1. 不要修改 Meodesk 源码。",
      "2. 只在 inbox 目录新增一个 connect-request.<你的工具名>.json。",
      "3. JSON 必须符合 schema.json。",
      "4. command、args、cwd 必须使用当前电脑上真实可运行的启动方式。",
      "5. toolKind 优先填写 claude、hermes、codex、terminal 或 other。",
      "6. 如果你是 Claude，toolKind 填 claude；如果你是 Hermes，toolKind 填 hermes。",
      "7. icon 不需要自己找；Meodesk 会按 toolKind 或 name 自动匹配默认图标。",
      "8. 如果你要上报对话记录，就向 conversations 目录写入 meodesk-conversation JSON。",
      "",
      "写完后告诉我申请文件名。"
    ].join("\n");
  }

  function ensureAgentInterface(options = {}) {
    const includeNativeHistory = Boolean(options.includeNativeHistory);
    const forceRefresh = Boolean(options.forceRefresh || options.refresh || options.noCache);
    if (!forceRefresh) {
      const cached = getCachedAgentInterfaceInfo(includeNativeHistory);
      if (cached) return cached;
    }
    const rootPath = getAgentInterfaceDirectory();
    const inboxPath = path.join(rootPath, "inbox");
    const registeredPath = path.join(rootPath, "registered");
    const conversationsPath = getConversationDirectory();
    const skillsPath = getAgentSkillsDirectory(rootPath);
    const imported = scanImportedAgentConversations({ includeNativeHistory });
    const extensionsPath = meodeskHomePath("extensions");
    const schema = {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      title: "Meodesk Agent Connect Request",
      type: "object",
      required: ["name", "toolKind", "command"],
      additionalProperties: false,
      properties: {
        name: { type: "string", minLength: 1 },
        toolKind: { type: "string", enum: ["claude", "hermes", "codex", "terminal", "other"] },
        command: { type: "string", minLength: 1 },
        args: { type: "array", items: { type: "string" }, default: [] },
        cwd: { type: "string", default: "." },
        env: { type: "object", additionalProperties: { type: "string" }, default: {} },
        autoStart: { type: "boolean", default: false },
        notes: { type: "string", default: "" }
      }
    };
    const featureProposalSchema = {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      title: "Meodesk Feature Proposal",
      type: "object",
      required: ["type", "name", "summary"],
      additionalProperties: false,
      properties: {
        type: { type: "string", enum: ["feature-proposal", "widget-proposal"] },
        name: { type: "string", minLength: 1 },
        summary: { type: "string", minLength: 1 },
        target: { type: "string", enum: ["workspace", "sidebar", "workspace-sidebar", "main-nav", "board", "lobby", "settings", "widget", "other"], default: "widget" },
        extensionId: { type: "string", default: "" },
        extensionType: { type: "string", enum: ["feature-page", "sidebar-widget", "other"], default: "other" },
        manifestPath: { type: "string", default: "" },
        files: { type: "array", items: { type: "string" }, default: [] },
        permissions: { type: "array", items: { type: "string" }, default: [] },
        risk: { type: "string", enum: ["low", "medium", "high"], default: "medium" },
        notes: { type: "string", default: "" }
      }
    };
    const extensionManifestSchema = {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      title: "Meodesk Extension Manifest",
      type: "object",
      required: ["schema", "id", "type", "name", "version", "target", "entry"],
      additionalProperties: false,
      properties: {
        schema: { type: "string", const: "meodesk.extension.manifest.v0" },
        id: { type: "string", pattern: "^[a-z0-9][a-z0-9_.-]{1,63}$" },
        type: { type: "string", enum: ["feature-page", "sidebar-widget"] },
        name: { type: "string", minLength: 1 },
        version: { type: "string", default: "0.1.0" },
        summary: { type: "string", default: "" },
        target: { type: "string", enum: ["main-nav", "workspace-sidebar"] },
        entry: { type: "string", minLength: 1 },
        runtime: { type: "string", enum: ["html", "meodesk-sidebar-widget"], default: "html" },
        status: { type: "string", enum: ["draft", "ready", "enabled", "disabled", "error"], default: "draft" },
        createdBy: { type: "string", default: "" },
        permissions: { type: "array", items: { type: "string" }, default: [] },
        files: { type: "array", items: { type: "string" }, default: [] },
        compatibility: {
          type: "object",
          additionalProperties: false,
          properties: {
            meodesk: { type: "string", default: ">=0.1.0" }
          },
          default: {}
        },
        versioning: {
          type: "object",
          additionalProperties: false,
          properties: {
            current: { type: "string", default: "" },
            channel: { type: "string", enum: ["dev", "stable", "archived"], default: "stable" },
            versionsDir: { type: "string", default: "versions" }
          },
          default: {}
        },
        ui: {
          type: "object",
          additionalProperties: false,
          properties: {
            theme: { type: "string", enum: ["inherit", "custom", "fixed"], default: "inherit" },
            surface: { type: "string", enum: ["host", "transparent", "panel", "custom"], default: "host" },
            chrome: { type: "string", enum: ["none", "minimal", "host", "custom"], default: "minimal" },
            density: { type: "string", enum: ["auto", "compact", "comfortable"], default: "auto" },
            tokenProtocol: { type: "string", enum: ["meodesk.theme.v0"], default: "meodesk.theme.v0" },
            notes: { type: "string", default: "" }
          },
          default: {}
        },
        page: {
          type: "object",
          additionalProperties: false,
          properties: {
            navLabel: { type: "string", default: "" },
            route: { type: "string", default: "" },
            icon: { type: "string", default: "" }
          },
          default: {}
        },
        sidebarWidget: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", default: "" },
            minWidth: { type: "number", minimum: 160, default: 240 },
            minHeight: { type: "number", minimum: 80, default: 120 },
            preferredHeight: { type: "number", minimum: 80, default: 240 },
            maxHeight: { type: "number", minimum: 120, default: 960 },
            resizeMode: { type: "string", enum: ["responsive", "fixed", "canvas"], default: "responsive" },
            protocol: { type: "string", enum: ["meodesk.sidebar-widget.v0"], default: "meodesk.sidebar-widget.v0" }
          },
          default: {}
        },
        debug: {
          type: "object",
          additionalProperties: false,
          properties: {
            notes: { type: "string", default: "" },
            previewPath: { type: "string", default: "" }
          },
          default: {}
        }
      }
    };
    const meowPackageSchema = {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      title: "Meodesk Meow Extension Package",
      type: "object",
      required: ["schema", "kind", "package", "manifest", "files"],
      additionalProperties: false,
      properties: {
        schema: { type: "string", const: meowPackageSchemaId },
        kind: { type: "string", const: "meodesk-extension-package" },
        packagedAt: { type: "string", default: "" },
        exportedAt: { type: "string", default: "" },
        package: {
          type: "object",
          required: ["id", "name", "type", "target", "version", "entry", "installMode"],
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            name: { type: "string", minLength: 1 },
            type: { type: "string", enum: ["feature-page", "sidebar-widget"] },
            target: { type: "string", enum: ["main-nav", "workspace-sidebar"] },
            version: { type: "string", default: "0.1.0" },
            runtime: { type: "string", default: "" },
            entry: { type: "string", minLength: 1 },
            sourcePath: { type: "string", default: "" },
            installMode: { type: "string", enum: ["unpack-to-extensions"], default: "unpack-to-extensions" }
          }
        },
        manifest: { type: "object", additionalProperties: true },
        files: {
          type: "array",
          items: {
            type: "object",
            required: ["path", "encoding", "content"],
            additionalProperties: false,
            properties: {
              path: { type: "string", minLength: 1 },
              encoding: { type: "string", enum: ["base64", "utf8"], default: "base64" },
              content: { type: "string" },
              size: { type: "number", minimum: 0, default: 0 },
              modifiedAt: { type: "number", minimum: 0, default: 0 }
            }
          },
          default: []
        }
      }
    };
    const conversationSchema = {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      title: "Meodesk Conversation Record",
      type: "object",
      required: ["type", "agent", "title"],
      additionalProperties: true,
      properties: {
        type: { type: "string", enum: ["meodesk-conversation", "conversation", "conversation-record"] },
        agent: { type: "string", minLength: 1 },
        agentId: { type: "string", default: "" },
        title: { type: "string", minLength: 1 },
        source: { type: "string", default: "" },
        paneId: { type: "string", default: "" },
        summary: { type: "string", default: "" },
        status: { type: "string", enum: ["active", "closed", "archived"], default: "active" },
        model: { type: "string", default: "" },
        toolKind: { type: "string", default: "" },
        projectPath: { type: "string", default: "" },
        cwd: { type: "string", default: "" },
        resumeCommand: { type: "string", default: "" },
        startedAt: { type: "string", default: "" },
        endedAt: { type: "string", default: "" },
        participants: { type: "array", items: { type: "string" }, default: [] },
        messages: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
            properties: {
              role: { type: "string", enum: ["user", "assistant", "system", "tool", "agent"], default: "assistant" },
              content: { type: "string", default: "" },
              at: { type: "string", default: "" },
              name: { type: "string", default: "" }
            }
          },
          default: []
        },
        tags: { type: "array", items: { type: "string" }, default: [] },
        tasks: { type: "array", items: { type: "string" }, default: [] },
        externalId: { type: "string", default: "" },
        conversationId: { type: "string", default: "" }
      }
    };
    const taskSchema = {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      title: "Meodesk Board Task",
      type: "object",
      required: ["type", "title"],
      additionalProperties: true,
      properties: {
        type: { type: "string", enum: ["meodesk-task", "task", "task-plan"] },
        title: { type: "string", minLength: 1 },
        status: { type: "string", enum: ["inbox", "todo", "doing", "blocked", "done"], default: "todo" },
        priority: { type: "string", enum: ["low", "medium", "high"], default: "medium" },
        source: { type: "string", default: "" },
        sourceToolId: { type: "string", default: "" },
        detail: { type: "string", default: "" },
        due: { type: "string", default: "" },
        tag: { type: "string", default: "unsorted" },
        tags: { type: "array", items: { type: "string" }, default: [] }
      }
    };
    writeGeneratedFile(
      path.join(rootPath, "README.md"),
      [
        "# Meodesk Agent Interface",
        "",
        "这个目录用于让外部 Agent 和 Meodesk 交换低风险、用户可见的工作台信息。",
        "",
        "## 工作台交换",
        "",
        "1. Agent 通过环境变量读取 `MEODESK_RUNTIME_FILE` 或 `MEODESK_CONTEXT_FILE`。",
        "2. Agent 按 schema 向 `MEODESK_INBOX_DIR` 或 `MEODESK_CONVERSATIONS_DIR` 写入 JSON 文件。",
        "3. Meodesk 会热同步任务到看板；接入申请和功能提案仍需要用户确认。",
        "4. Agent 不需要知道用户电脑上的固定路径，也不应该猜测路径。",
        "",
        "## Runtime Contract",
        "",
        "当 Meodesk 启动一个工作窗或 Agent 时，会注入一组标准环境变量：",
        "",
        "- `MEODESK=1`",
        "- `MEODESK_PROTOCOL_VERSION=1`",
        "- `MEODESK_AGENT_ID` / `MEODESK_AGENT_NAME` / `MEODESK_AGENT_KIND`",
        "- `MEODESK_PANE_ID`",
        "- `MEODESK_INTERFACE_DIR`",
        "- `MEODESK_CONTEXT_FILE`",
        "- `MEODESK_RUNTIME_FILE`",
        "- `MEODESK_INBOX_DIR`",
        "- `MEODESK_CONVERSATIONS_DIR`",
        "- `MEODESK_PROPOSALS_DIR`",
        "- `MEODESK_EXTENSIONS_DIR`",
        "- `MEODESK_SKILLS_DIR`",
        "- `MEODESK_BUNDLED_SKILLS_DIR`",
        "- `MEODESK_TASK_SCHEMA`",
        "- `MEODESK_CONVERSATION_SCHEMA`",
        "- `MEODESK_FEATURE_PROPOSAL_SCHEMA`",
        "- `MEODESK_EXTENSION_MANIFEST_SCHEMA`",
        "- `MEODESK_MEOW_PACKAGE_SCHEMA`",
        "- `MEODESK_MEOW_PACKAGE_SPEC`",
        "- `MEODESK_TASK_PROTOCOL=MEODESK_TASK`",
        "- `MEODESK_CONVERSATION_PROTOCOL=MEODESK_CONVERSATION`",
        "- `MEODESK_PET_PROTOCOL=MEODESK_PET`",
        "- `MEODESK_WORKSHOP_RULES_FILE`：工坊内当前制作类型的规则文件；创建或继续作品前读取它。",
        "",
        "Agent 可以读取 `MEODESK_CONTEXT_FILE` 或 `MEODESK_RUNTIME_FILE`，确认自己正在 Meodesk 内部运行。",
        "如果 Agent 支持 skill，可加载 `MEODESK_SKILLS_DIR/meodesk-bridge` 来自动使用 Meodesk 看板、对话、提案和工作台协议。",
        "",
        "## 工坊扩展对象",
        "",
        "工坊用于制作 Meodesk 内置生态对象。Agent 不应直接修改 Meodesk 源码，而应在 `MEODESK_EXTENSIONS_DIR/<id>/` 下生成作品文件。",
        "每个作品目录必须包含 `meodesk-extension.manifest.json`，内容符合 `extension-manifest.schema.json` / `MEODESK_EXTENSION_MANIFEST_SCHEMA`。",
        "`.meow` 是 Meodesk 作品的成品包与运行单元，开发源仍然保留在工程目录里，安装后会还原成 `extensions/<id>/` 目录。",
        "首版支持 `feature-page` 与 `sidebar-widget`：功能页目标为 `main-nav`；工作区右侧栏组件目标为 `workspace-sidebar`。",
        "作品 manifest 可声明 `ui.theme=inherit`、`ui.surface=host`、`ui.chrome=minimal/none`。这表示作品优先继承 Meodesk 宿主主题，不默认自带完整网页外壳。",
        "右侧栏宿主会向组件发送 `meodesk:init`、`meodesk:theme`、`meodesk:resize`，其中 theme tokens 包含 `--meodesk-bg`、`--meodesk-panel`、`--meodesk-text`、`--meodesk-muted`、`--meodesk-border`、`--meodesk-accent`、`--meodesk-radius`、`--meodesk-font` 等。",
        "完成作品后，再向 `MEODESK_PROPOSALS_DIR` 写入 `feature-proposal.schema.json` 兼容的提案，并在 `manifestPath` 中引用作品 manifest，等待用户确认安装、调试、发布或继续升级。",
        "",
        "## 看板任务",
        "",
        "向 inbox 写入 `task.<source>.<id>.json`，内容符合 `task.schema.json`：",
        "`tag` 是主分类，`tags` 是子标签。Agent 生成任务时应始终写入 `tag`。",
        "",
        "```json",
        "{",
        "  \"type\": \"meodesk-task\",",
        "  \"title\": \"整理明天的发布计划\",",
        "  \"status\": \"todo\",",
        "  \"priority\": \"medium\",",
        "  \"source\": \"Claude\",",
        "  \"detail\": \"补充发布时间、链接回填和复盘口径。\",",
        "  \"due\": \"2026-05-21\",",
        "  \"tag\": \"meodesk\",",
        "  \"tags\": [\"视频策划\"]",
        "}",
        "```",
        "",
        "Meodesk 会按文件路径和修改时间热同步任务。更新同一个文件会更新看板中的同一项，不需要重启 Meodesk 或重启 Agent。",
        "",
        "终端内也可以输出 `MEODESK_TASK ... END_MEODESK_TASK` 协议块投递任务。",
        "",
        "## 对话管理",
        "",
        "向 `MEODESK_CONVERSATIONS_DIR` 写入 `conversation.<agent>.<id>.json`，内容符合 `conversation.schema.json`：",
        "",
        "```json",
        "{",
        "  \"type\": \"meodesk-conversation\",",
        "  \"agent\": \"Claude\",",
        "  \"agentId\": \"claude-code\",",
        "  \"title\": \"Meodesk 对话管理\",",
        "  \"status\": \"active\",",
        "  \"projectPath\": \"C:/Projects/meodesk\",",
        "  \"resumeCommand\": \"claude --resume abc123\",",
        "  \"messages\": [",
        "    { \"role\": \"user\", \"content\": \"继续做\", \"at\": \"2026-05-20T15:30:00+08:00\" },",
        "    { \"role\": \"assistant\", \"content\": \"我会把对话同步到 Meodesk。\", \"at\": \"2026-05-20T15:31:00+08:00\" }",
        "  ]",
        "}",
        "```",
        "",
        "Meodesk 会按 Agent 分组显示对话记录，并按最近更新时间排序。更新同一个文件即可刷新同一会话。",
        "",
        "如果你在终端中输出对话协议块，也会被识别为同一类记录。",
        "",
        "## 自定义功能申请",
        "",
        "未来小组件和功能扩展会走 `proposals` 目录。Agent 可以按 `feature-proposal.schema.json` 生成申请，用户确认后再安装或启用。",
        "工坊作品应先写入 `MEODESK_EXTENSIONS_DIR`，再用 proposal 指向 `meodesk-extension.manifest.json`。",
        "",
        "## 图标匹配",
        "",
        "- `toolKind: claude` 默认匹配 Claude 图标。",
        "- `toolKind: hermes` 默认匹配 Hermes 图标。",
        "- 未识别工具先使用名称首字母。",
        "",
        "## 安全规则",
        "",
        "- 不要在 agent-interface 目录写入脚本或可执行文件。",
        "- 不要默认修改 Meodesk 源码；功能和小组件先走 proposal。",
        "- 不要把密钥、token、cookie 写入申请文件。",
        "- `command` 和 `cwd` 必须是用户本机真实可运行的方式。",
        "- 所有集成必须依赖 runtime/context 暴露的路径和能力，不要针对某一台电脑写死规则。"
      ].join("\n"),
    );
    writeGeneratedFile(path.join(rootPath, "schema.json"), `${JSON.stringify(schema, null, 2)}\n`);
    writeGeneratedFile(path.join(rootPath, "task.schema.json"), `${JSON.stringify(taskSchema, null, 2)}\n`);
    writeGeneratedFile(path.join(rootPath, "conversation.schema.json"), `${JSON.stringify(conversationSchema, null, 2)}\n`);
    writeGeneratedFile(path.join(rootPath, "feature-proposal.schema.json"), `${JSON.stringify(featureProposalSchema, null, 2)}\n`);
    writeGeneratedFile(path.join(rootPath, "extension-manifest.schema.json"), `${JSON.stringify(extensionManifestSchema, null, 2)}\n`);
    writeGeneratedFile(path.join(rootPath, "meow-package.schema.json"), `${JSON.stringify(meowPackageSchema, null, 2)}\n`);
    writeGeneratedFile(
      path.join(rootPath, "meow-package.md"),
      [
        "# Meodesk .meow Extension Package",
        "",
        "`.meow` 是 Meodesk 作品的成品包格式，也是运行单元，不是开发源目录本身。",
        "",
        "## 核心原则",
        "",
        "- 开发源继续放在 `MEODESK_EXTENSIONS_DIR/<id>/`。",
        "- `.meow` 安装后必须还原为一个普通扩展工程目录。",
        "- Meodesk 现有扫描、预览、启用、版本选择和发布逻辑继续读取工程目录与 manifest。",
        "- 包内必须带 `meodesk-extension.manifest.json` 和必要入口/资源文件。",
        "- 推荐 manifest 带 `ui.theme=inherit`、`ui.surface=host`、`ui.chrome=minimal/none`，让作品默认继承 Meodesk 宿主主题。",
        "- Agent 接到 `.meow` 相关任务时，先读 `MEODESK_MEOW_PACKAGE_SCHEMA` 和本文件。",
        "- 不要为了 `.meow` 改写 Meodesk 本体；它是产品的成品态，不是源代码替身。",
        "",
        "## 最小结构",
        "",
        "```txt",
        "package.meow",
        "  schema: meodesk.meow.package.v0",
        "  kind: meodesk-extension-package",
        "  packagedAt: ISO 时间戳",
        "  package: id/name/type/target/version/entry/installMode",
        "  manifest: meodesk-extension.manifest.json 内容",
        "  files: 工程文件列表",
        "```"
      ].join("\n"),
    );
    writeFileIfMissing(
      path.join(rootPath, "connect-request.example.json"),
      `${JSON.stringify({
        name: "Claude",
        toolKind: "claude",
        command: "claude",
        args: [],
        cwd: ".",
        env: {},
        autoStart: false,
        notes: "示例：请复制到 inbox 后按本机实际启动方式修改。"
      }, null, 2)}\n`
    );

    const requests = fs.readdirSync(inboxPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .map((entry) => {
        const filePath = path.join(inboxPath, entry.name);
        let parsed = null;
        let error = "";
        let stats = null;
        try {
          stats = fs.statSync(filePath);
          parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        } catch (parseError) {
          error = parseError.message || String(parseError);
        }
        return {
          fileName: entry.name,
          path: filePath,
          size: stats?.size || 0,
          modifiedAt: stats?.mtimeMs || 0,
          createdAt: stats?.birthtimeMs || 0,
          request: parsed,
          error
        };
      });

    const conversations = fs.readdirSync(conversationsPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .map((entry) => {
        const filePath = path.join(conversationsPath, entry.name);
        let parsed = null;
        let error = "";
        let stats = null;
        try {
          stats = fs.statSync(filePath);
          parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        } catch (parseError) {
          error = parseError.message || String(parseError);
        }
        return {
          fileName: entry.name,
          path: filePath,
          size: stats?.size || 0,
          modifiedAt: stats?.mtimeMs || 0,
          createdAt: stats?.birthtimeMs || 0,
          request: parsed,
          error
        };
      })
      .sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0));
    const workshopExtensions = scanWorkshopExtensions(extensionsPath);

    return cacheableAgentInterfaceInfo({
      directory: rootPath,
      inbox: inboxPath,
      registered: registeredPath,
      conversationsDir: conversationsPath,
      extensionsDir: extensionsPath,
      context: path.join(rootPath, "context"),
      runtime: path.join(rootPath, "runtime"),
      proposals: path.join(rootPath, "proposals"),
      skills: skillsPath,
      readme: path.join(rootPath, "README.md"),
      schema: path.join(rootPath, "schema.json"),
      taskSchema: path.join(rootPath, "task.schema.json"),
      conversationSchema: path.join(rootPath, "conversation.schema.json"),
      featureProposalSchema: path.join(rootPath, "feature-proposal.schema.json"),
      extensionManifestSchema: path.join(rootPath, "extension-manifest.schema.json"),
      meowPackageSchema: path.join(rootPath, "meow-package.schema.json"),
      meowPackageSpec: path.join(rootPath, "meow-package.md"),
      conversationProtocol: "MEODESK_CONVERSATION",
      prompt: agentInterfacePrompt(rootPath),
      requests,
      conversations: [...conversations, ...imported.conversations].sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0)),
      workshopExtensions,
      conversationSources: imported.sources,
      historyMode: imported.mode || (includeNativeHistory ? "native" : "light")
    }, includeNativeHistory);
  }



  return {
    ensureAgentInterface
  };
}

module.exports = { createAgentInterfaceService };

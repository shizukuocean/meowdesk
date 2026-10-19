import assert from "node:assert/strict";
import {
  workspaceRendererAsciiTable,
  workspaceRendererAsciiTableBlock,
  workspaceRendererCodeBlock,
  workspaceRendererLabelledCodeBlock,
  workspaceRendererLooseAsciiTable,
  workspaceRendererLineIsClaudeThinkingStatus,
  workspaceRendererParseSourceSnapshot,
  workspaceRendererParseTranscript,
  workspaceRendererPromptContinuationMatches,
  workspaceRendererRebuildFieldTableLines,
  workspaceRendererSourceEventsHaveSemanticAdapterOutput,
  workspaceRendererTable,
  workspaceRendererTreeBlock
} from "../src/renderer-app/src/features/meow-viewer/meow-viewer-parser.ts";
import { assertNoLeak, now, textOf } from "./meow-viewer-parser-fixtures/harness.mjs";
import { runSourceEventFixtures } from "./meow-viewer-parser-fixtures/source-event-fixtures.mjs";

{
  const userText = "随便聊点什么，测试一下meowviewer吧：表格、diff\n、代码块、markdown文本";
  const raw = [
    "╭────ClaudeCodev2.1.162──────────────────────────────╮",
    "| T┬ Opus4.7(1Mcontext) · APIUsageBilling |",
    "| E:\\Meowdesk\\workbench-prototype-ui-rebuild |",
    "╰────────────────────────────────────────────────────╯",
    "? for shortcuts · ← for agents",
    "› 随便聊点什么，测试一下meowviewer吧：表格、diff",
    "、代码块、markdown文本",
    "Thought for 2s (ctrl+o to expand)",
    "⎿ The user wants markdown examples. This hidden thought must not render.",
    "● 明白了，直接用原生 markdown 表格渲染：",
    "| 项目 | 状态 |",
    "| --- | --- |",
    "| 用户认证模块重构 | 进行中 |",
    "",
    "JavaScript:",
    "const value = 1;",
    "console.log(value);",
    "",
    "Update(renderer_test.md)",
    "  Added 2 lines, removed 1 line",
    "  3 -旧行",
    "  3 +新行",
    "",
    "Do you want to create renderer_test.md?",
    "❯ 1. Yes",
    "  2. Yes, allow all edits during this session",
    "  3. No, and tell Claude what to do differently"
  ].join("\n");
  const result = workspaceRendererParseTranscript({
    raw,
    profile: "claude",
    userTurns: [{ id: "u1", text: userText, source: "renderer", createdAt: now - 100 }],
    now
  });
  const rendered = textOf(result);
  assert.equal(result.segments.some((segment) => segment.kind === "user" && segment.text === userText), true);
  assert.equal(rendered.includes("用户认证模块重构"), true);
  assert.equal(rendered.includes("const value = 1"), true);
  assert.equal(result.events.some((event) => event.kind === "tool_call" && event.tone === "edit" && event.detail === "renderer_test.md"), true);
  assert.equal(result.segments.some((segment) => segment.text === "::meow-viewer-tool\tedit\t修改\trenderer_test.md"), true);
  assert.equal(result.segments.some((segment) => /^::meow-viewer-tool\tedit/.test(segment.text) && /旧行|新行/.test(segment.text)), false);
  assert.equal(result.permissionPrompt?.choices.length, 3);
  assertNoLeak(rendered, ["The user wants", "APIUsageBilling", "for shortcuts", "Do you want to create"]);
}

{
  const rawPermission = [
    "Write(C:\\Users\\demo\\Desktop\\meow-test.txt)",
    "Create file",
    "Do you want to create meow-test.txt?",
    "❯ 1. Yes",
    "  2. Yes, allow all edits during this session",
    "  3. No"
  ].join("\n");
  const result = workspaceRendererParseSourceSnapshot({
    profile: "claude",
    displayTranscript: "Claude 已整理上一段回复",
    rawTranscript: rawPermission,
    sourceEvents: [
      { kind: "assistant_message", text: "上一段语义回复已经完成", createdAt: now - 1000 },
      { kind: "terminal_raw", text: rawPermission, createdAt: now }
    ],
    userTurns: [],
    status: "running",
    updatedAt: now
  });
  assert.equal(result.permissionPrompt?.choices.length, 3);
  assert.equal(result.permissionPrompt?.detail.includes("meow-test.txt"), true);
}

{
  const rawPermission = [
    "PowerShell command",
    "curl.exe -s https://api.github.com/repos/torvalds/linux/commits?per_page=1",
    "This command requires approval",
    "Do you want to proceed?",
    "❯ 1. Yes",
    "  2. Yes, and don't ask again : curl.exe -s",
    "     for https://api.github.com/repos/torvalds/linux/commits?per_page=1",
    "  3. No",
    "Esc to cancel · Tab to amend · ctrl+e to explain"
  ].join("\n");
  const result = workspaceRendererParseSourceSnapshot({
    profile: "claude",
    displayTranscript: "",
    rawTranscript: rawPermission,
    sourceEvents: [{ kind: "terminal_raw", text: rawPermission, createdAt: now }],
    userTurns: [],
    status: "running",
    updatedAt: now
  });
  assert.equal(result.permissionPrompt?.choices.length, 3);
  assert.equal(result.permissionPrompt?.detail.includes("proceed"), true);
}

{
  const rawResolvedPermission = [
    "Do you want to proceed?",
    "❯ 1. Yes",
    "  2. Yes, and don't ask again",
    "  3. No",
    "Esc to cancel · Tab to amend",
    "● 权限提示没弹出来，因为 ls 是读取操作，默认允许。"
  ].join("\n");
  const result = workspaceRendererParseSourceSnapshot({
    profile: "claude",
    displayTranscript: "",
    rawTranscript: rawResolvedPermission,
    sourceEvents: [{ kind: "terminal_raw", text: rawResolvedPermission, createdAt: now }],
    userTurns: [],
    status: "running",
    updatedAt: now
  });
  assert.equal(result.permissionPrompt, null);
}

{
  const rawMenu = [
    "AskUserQuestion",
    "你 debug 的时候主要是什么流派？",
    "› 1. 静默派",
    "   一行行读代码，尽量不惊动现场。",
    "2. 暴力派",
    "   console.log 插满全场。",
    "3. 科学派",
    "   Git bisect + 二分法。",
    "4. 玄学派",
    "   先怀疑缓存问题。",
    "5. Type something.",
    "6. Chat about this",
    "Enter to select · ↑/↓ to navigate · Esc to cancel"
  ].join("\n");
  const result = workspaceRendererParseSourceSnapshot({
    profile: "claude",
    displayTranscript: rawMenu,
    rawTranscript: rawMenu,
    sourceEvents: [
      { kind: "tool_call", tone: "info", label: "AskUserQuestion", detail: "", createdAt: now - 10 },
      { kind: "terminal_raw", text: rawMenu, createdAt: now }
    ],
    userTurns: [],
    status: "running",
    updatedAt: now
  });
  assert.equal(result.permissionPrompt?.title, "选择回复");
  assert.equal(result.permissionPrompt?.detail.includes("debug"), true);
  assert.equal(result.permissionPrompt?.choices.length, 6);
  assert.equal(result.permissionPrompt?.choices[4].value, "5");
  assert.equal(result.permissionPrompt?.choices[4].label, "Type something");
  assert.equal(textOf(result).includes("AskUserQuestion"), false);

  const legacyResult = workspaceRendererParseTranscript({ raw: rawMenu, profile: "claude", now });
  const legacyRendered = textOf(legacyResult);
  assert.equal(legacyResult.permissionPrompt?.choices.length, 6);
  assertNoLeak(legacyRendered, ["AskUserQuestion", "静默派", "Enter to select", "debug 的时候"]);
}

{
  const rawWorkshopPermissionMenu = [
    "AskUserQuestion",
    "[ MeowViewer 权限 ]",
    "",
    "MeowViewer 请求以下权限:",
    "1. 读取项目 CSS/JS 资源",
    "2. 注入渲染环境",
    "3. 执行预览脚本",
    "",
    "是否授权?",
    "",
    "› 1. ✅Yes",
    "  2. ❌No",
    "  3. 📝输入补充",
    "",
    "Notes: press n to add notes",
    "",
    "Chat about this",
    "",
    "Enter to select · ↑/↓ to navigate · n to add notes · Esc to cancel"
  ].join("\n");
  const result = workspaceRendererParseSourceSnapshot({
    profile: "claude",
    displayTranscript: rawWorkshopPermissionMenu,
    rawTranscript: rawWorkshopPermissionMenu,
    sourceEvents: [
      { kind: "tool_call", tone: "info", label: "AskUserQuestion", detail: "", createdAt: now - 10 },
      { kind: "terminal_raw", text: rawWorkshopPermissionMenu, createdAt: now }
    ],
    userTurns: [],
    status: "running",
    updatedAt: now
  });
  assert.equal(result.permissionPrompt?.title, "权限询问");
  assert.equal(result.permissionPrompt?.detail.includes("是否授权"), true);
  assert.equal(result.permissionPrompt?.detail.includes("CSS/JS"), true);
  assert.equal(result.permissionPrompt?.choices.length, 3);
  assert.deepEqual(
    result.permissionPrompt?.choices.map((choice) => [choice.value, choice.label]),
    [["1", "✅Yes"], ["2", "❌No"], ["3", "📝输入补充"]]
  );
  assertNoLeak(textOf(result), ["AskUserQuestion", "Enter to select", "Chat about this", "✅Yes", "读取项目 CSS/JS 资源"]);
}

{
  const userText = "继续测试meowviewer，不用读代码，随意写点：表格（可以稍微长一点）、markdown文本、diff、多种代码块";
  const raw = [
    "› 继续测试meowviewer，不用读代码，随意写点：表格（可以稍微长一点）、markdown",
    "own文本、diff、多种代码块",
    "",
    "Thought for 1s (ctrl+o to expand)",
    "",
    "● 好的，直接写一个综合测试文档，覆盖表格、markdown",
    "文本、diff、多种代码块：",
    "",
    "· Warning… (4s · ↓ 211 tokens · thought for 2s)"
  ].join("\n");
  const result = workspaceRendererParseSourceSnapshot({
    profile: "claude",
    displayTranscript: raw,
    rawTranscript: "",
    sourceEvents: [],
    userTurns: [{ id: "u-first-turn", text: userText, source: "terminal", createdAt: now - 100 }],
    status: "running",
    updatedAt: now
  });
  const assistantText = result.segments
    .filter((segment) => segment.kind === "assistant")
    .map((segment) => segment.text)
    .join("\n\n");
  assert.equal(result.segments.some((segment) => segment.kind === "user" && segment.text === userText), true);
  assert.equal(assistantText.includes("好的，直接写一个综合测试文档"), true);
  assert.equal(assistantText.includes("own文本、diff、多种代码块"), false);
  assertNoLeak(assistantText, ["Thought for", "Warning", "thought for"]);
}

{
  const raw = [
    "Welcome to Hermes Agent",
    "deepseek-v4-flash · Nous Research",
    "$ deepseek-v4-flash │ 35.4K/1M │ 4% │ 24s │ 4s",
    "─ Reasoning ─",
    "OK, I've quickly scanned the current state and should hide this reasoning.",
    "read /mnt/e/Meowdesk/workbench-prototype-ui-rebuild/src/main.js",
    "─ Response ─",
    "─ ✦ Hermes ─",
    "# 页面输出",
    "这里有 **加粗重点** 和 *斜体补充*。",
    "| 项目 | Tokens | 成本 |",
    "| --- | --- | --- |",
    "| Hermes 主 | 280K | 14 |",
    "python",
    "def calc_daily_report(nav, cost):",
    "    return nav - cost"
  ].join("\n");
  const result = workspaceRendererParseTranscript({ raw, profile: "hermes", now });
  const rendered = textOf(result);
  assert.equal(rendered.includes("页面输出"), true);
  assert.equal(rendered.includes("Hermes 主"), true);
  assert.equal(rendered.includes("def calc_daily_report"), true);
  assert.equal(result.statusItems.some((item) => item.label === "模型" && item.value.includes("deepseek-v4-flash")), true);
  assertNoLeak(rendered, ["Welcome to Hermes Agent", "quickly scanned", "read /mnt"]);
}

{
  const prompt = "继续测试meowviewer，不用读代码，随意写点：表格（可以稍微长一点）、markdown文本、diff、多种代码块";
  const raw = [
    "─ ✦ Hermes ─",
    "# Meow Viewer 渲染测试文档",
    "+> 本文件用于验收 Meow Viewer 对多种 Markdown 元素的渲染效果。",
    "## 一、长表格（Markdown 原生）",
    "| 日期 | 基金代码 | 交易金额 | 备注 |",
    "| --- | --- | ---: | --- |",
    "| 06/06 | 017811 | +347.60 | 回正中 |",
    "## 二、Diff 代码块",
    "2.1 Git Diff",
    prompt,
    "```diff",
    "diff --git a/src/renderer.ts b/src/renderer.ts",
    "+export function parseTranscript(raw: string) {",
    "+  return raw.trim();",
    "```",
    "内容覆盖 19 种渲染场景，按类分组：",
    "| 类型 | 内容 |",
    "| --- | --- |",
    "| 代码块 | TypeScript、SQL、JSON |"
  ].join("\n");
  const result = workspaceRendererParseTranscript({ raw, profile: "hermes", userTurns: [], now });
  const userSegments = result.segments.filter((segment) => segment.kind === "user");
  const assistantText = result.segments.filter((segment) => segment.kind === "assistant").map((segment) => segment.text).join("\n");
  assert.equal(userSegments.length, 1);
  assert.equal(userSegments[0].text, prompt);
  assert.equal(assistantText.includes(prompt), false);
  assert.equal(assistantText.includes("Meow Viewer 渲染测试文档"), true);
  assert.equal(assistantText.includes("parseTranscript(raw: string)"), true);
  assert.equal(assistantText.includes("内容覆盖 19 种渲染场景"), true);
}

{
  const prompt = "输出长表格和更多代码块，继续测试 meowviewer";
  const raw = [
    "─ ✦ Hermes ─",
    `> ${prompt}`,
    "好的，下面是表格和代码块：",
    "| 项目 | 状态 |",
    "| --- | --- |",
    "| Meow Viewer | 验收中 |",
    "```ts",
    "const state = 'ready';",
    "```"
  ].join("\n");
  const result = workspaceRendererParseTranscript({ raw, profile: "hermes", userTurns: [], now });
  const rendered = textOf(result);
  assert.equal(result.segments.some((segment) => segment.kind === "user" && segment.text === prompt), true);
  assert.equal(rendered.includes("Meow Viewer | 验收中"), true);
  assert.equal(rendered.includes("const state = 'ready';"), true);
}

{
  const raw = [
    "─ ✦ Hermes ─",
    "> 注意：这是普通 Markdown 引用，不是用户 prompt echo。",
    "后续正文仍然应该属于 Hermes 回复。"
  ].join("\n");
  const result = workspaceRendererParseTranscript({ raw, profile: "hermes", userTurns: [], now });
  const rendered = textOf(result);
  assert.equal(result.segments.some((segment) => segment.kind === "user"), false);
  assert.equal(rendered.includes("> 注意：这是普通 Markdown 引用"), true);
  assert.equal(rendered.includes("后续正文仍然应该属于 Hermes 回复"), true);
}

{
  const raw = [
    "─ ✦ Hermes ─",
    "⚡ New message detected, interrupting...",
    "⚡ Sending 6 messages after interrupt: '1. 一个 fenced SQL 长代码块...'",
    "$ deepseek-v4-flash · 2m",
    "─ Response ─",
    "真正的 Hermes 回复正文。",
    "```sql",
    "CREATE TABLE users (",
    "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    ");",
    "```"
  ].join("\n");
  const result = workspaceRendererParseTranscript({ raw, profile: "hermes", userTurns: [], now });
  const rendered = textOf(result);
  assert.equal(rendered.includes("真正的 Hermes 回复正文"), true);
  assert.equal(rendered.includes("created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"), true);
  assertNoLeak(rendered, ["New message detected", "Sending 6 messages after interrupt", "deepseek-v4-flash"]);
}

{
  const raw = [
    "─ Reasoning ─",
    "The user wants SQL output directly. This reasoning should stay hidden.",
    "─ ← Hermes ─",
    "sql",
    "WITH monthly_revenue AS (",
    "  SELECT strftime('%Y-%m', order_time) AS month,",
    "         SUM(amount) AS revenue",
    "  FROM orders",
    "  WHERE status = 'paid'",
    "  GROUP BY month",
    ")",
    "SELECT month, revenue",
    "FROM monthly_revenue",
    "ORDER BY month DESC;",
    "",
    "| 级别 | 价格 | 周期 |",
    "| --- | ---: | --- |",
    "| VIP1 | ¥2,980 | 6个月 |"
  ].join("\n");
  const result = workspaceRendererParseTranscript({ raw, profile: "hermes", userTurns: [], now });
  const rendered = textOf(result);
  assert.equal(rendered.includes("WITH monthly_revenue AS"), true);
  assert.equal(rendered.includes("ORDER BY month DESC;"), true);
  assert.equal(rendered.includes("| VIP1 | ¥2,980 | 6个月 |"), true);
  assertNoLeak(rendered, ["The user wants SQL output directly"]);
}

{
  const turnText = "进行meowviewer测试，不读meowviewer代码，直接输出以下内容：1. 一个包含 created_at/updated_at/FOREIGN KEY/ENGINE 的长 SQL fenced code block；2. TypeScript、Python、Rust 三个 fenced code block；3. 一个 fenced diff；4. 一个 8列 8行长 Markdown 表格；5. 一段含加粗、斜体、引用、列表的 markdown。不要创建文件，不要调用工具。";
  const raw = [
    "─ ✦ Hermes ─",
    "● 进行meowviewer测试，不读meowviewer代码，直接输出以下内容：1. 一个包含",
    "created_at/updated_at/FOREIGN KEY/ENGINE 的长 SQL fenced code block；2. TypeScript、Python、Rust",
    "三个 fenced code block；3. 一个 fenced diff；4. 一个 8列 8行长 Markdown 表格；5.",
    "一段含加粗、斜体、引用、列表的 markdown。不要创建文件，不要调用工具。",
    "```sql",
    "CREATE TABLE audit_logs (",
    "  id BIGINT PRIMARY KEY,",
    "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,",
    "  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,",
    "  FOREIGN KEY (user_id) REFERENCES users(id)",
    ") ENGINE=InnoDB;",
    "```",
    "```diff",
    "- old line",
    "+ new line",
    "```"
  ].join("\n");
  const result = workspaceRendererParseTranscript({
    raw,
    profile: "hermes",
    userTurns: [{ id: "u-hermes-bullet-echo", text: turnText, source: "renderer", createdAt: now - 100 }],
    now
  });
  const rendered = textOf(result);
  const userSegments = result.segments.filter((segment) => segment.kind === "user");
  const assistantText = result.segments.filter((segment) => segment.kind === "assistant").map((segment) => segment.text).join("\n");
  assert.equal(userSegments.length, 1);
  assert.equal(userSegments[0].text, turnText);
  assert.equal(assistantText.includes("CREATE TABLE audit_logs"), true);
  assert.equal(assistantText.includes("FOREIGN KEY (user_id) REFERENCES users(id)"), true);
  assert.equal(assistantText.includes("+ new line"), true);
  assertNoLeak(assistantText, ["● 进行meowviewer测试", "三个 fenced code block", "不要创建文件"]);
  assert.equal(rendered.includes("created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"), true);
}

{
  const raw = [
    "● 我先创建一个测试文件。",
    "Create file",
    "  1 | # MeowViewer",
    "综合渲染测试",
    "这是一个用于测试 MeowViewer 各种渲染能力的文档。",
    "  4 |",
    "## 1. 表格测试",
    "### 技术栈对比表",
    "  7 | | 技术 | 版本 | 用途 | 优势 |",
    "  8 | | --- | --- | --- | --- |",
    "  9 | | React | 18.2.0 | UI 框架 | 虚拟 DOM |",
    "● 文件已创建，正文不应该显示文件预览。"
  ].join("\n");
  const result = workspaceRendererParseTranscript({
    raw,
    profile: "claude",
    userTurns: [],
    now
  });
  const rendered = textOf(result);
  assert.equal(rendered.includes("我先创建一个测试文件"), true);
  assert.equal(rendered.includes("文件已创建"), true);
  assert.equal(result.events.some((event) => event.kind === "tool_call" && event.label === "创建" && event.detail === "file"), true);
  assert.equal(result.events.some((event) => event.kind === "assistant_message" && event.text.includes("综合渲染测试")), false);
  assertNoLeak(rendered, ["# MeowViewer", "综合渲染测试", "技术栈对比表", "| React |"]);
}

{
  const raw = [
    "● 我来创建一个测试文件，包含多种格式来测试 meowviewer。",
    "• Write(meowviewer-test.md)",
    "  ⎿ User rejected write to meowviewer-test.md",
    "     1 # MeowViewer 综合渲染测试",
    "     2",
    "     3 这是一个用于测试 MeowViewer",
    "各种渲染能力的文档。",
    "     5 ## 1. 表格测试",
    "     7 ### 技术栈对比表",
    "     9 | 技术 | 版本 | 用途 |",
    "    10 | --- | --- | --- |",
    "     +289 lines",
    "● 写入被拒绝，正文只应该显示这个说明。"
  ].join("\n");
  const result = workspaceRendererParseTranscript({
    raw,
    profile: "claude",
    userTurns: [],
    now
  });
  const rendered = textOf(result);
  assert.equal(rendered.includes("我来创建一个测试文件"), true);
  assert.equal(rendered.includes("写入被拒绝"), true);
  assert.equal(result.events.some((event) => event.kind === "tool_call" && event.label === "写入" && event.detail === "meowviewer-test.md"), true);
  assert.equal(result.events.some((event) => event.kind === "assistant_message" && event.text.includes("MeowViewer 综合渲染测试")), false);
  assertNoLeak(rendered, ["Write(meowviewer-test.md)", "MeowViewer 综合渲染测试", "技术栈对比表", "| 技术 | 版本 | 用途 |", "+289 lines"]);
}

{
  const result = workspaceRendererParseSourceSnapshot({
    profile: "claude",
    rawTranscript: "RAW PTY SHOULD NOT WIN\n● raw fallback text\n✻ Cooked for 6s",
    displayTranscript: "● display transcript wins",
    userTurns: [],
    now
  });
  const rendered = textOf(result);
  assert.equal(result.sourceEvents.some((event) => event.kind === "terminal_display"), true);
  assert.equal(result.sourceEvents.some((event) => event.kind === "terminal_raw"), true);
  assert.equal(rendered.includes("display transcript wins"), true);
  assert.equal(result.statusItems.some((item) => item.label === "思考" && item.value === "约 6s"), true);
  assertNoLeak(rendered, ["RAW PTY SHOULD NOT WIN", "raw fallback text"]);
}

{
  const result = workspaceRendererParseSourceSnapshot({
    profile: "claude",
    rawTranscript: "● raw fallback survives when display is unavailable",
    userTurns: [],
    now
  });
  const rendered = textOf(result);
  assert.equal(result.sourceEvents.some((event) => event.kind === "terminal_display"), false);
  assert.equal(result.sourceEvents.some((event) => event.kind === "terminal_raw"), true);
  assert.equal(rendered.includes("raw fallback survives"), true);
}

{
  const result = workspaceRendererParseSourceSnapshot({
    profile: "claude",
    sourceEvents: [{ kind: "terminal_raw", text: "● source event raw wins" }],
    rawTranscript: "● raw transcript fallback should not duplicate",
    userTurns: [],
    now
  });
  const rendered = textOf(result);
  assert.equal(result.sourceEvents.filter((event) => event.kind === "terminal_raw").length, 1);
  assert.equal(rendered.includes("source event raw wins"), true);
  assertNoLeak(rendered, ["raw transcript fallback should not duplicate"]);
}

{
  const pollutedTerminal = [
    "● Write(schema.sql)",
    "  1 CREATE TABLE users (",
    "  2 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    "继续测试meowviewer，不用读代码，随意写点：表格、markdown文本、diff、多种代码块",
    "│ TASK-004 │ 断裂 │ 这是一段污染 terminal display │"
  ].join("\n");
  const cleanAssistant = [
    "下面是结构化事件提供的干净回复：",
    "```sql",
    "CREATE TABLE users (",
    "  id BIGINT PRIMARY KEY,",
    "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,",
    "  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    ");",
    "```",
    "",
    "| 任务 | 状态 |",
    "| --- | --- |",
    "| 事件协议 | 优先 |"
  ].join("\n");
  const result = workspaceRendererParseSourceSnapshot({
    profile: "claude",
    displayTranscript: pollutedTerminal,
    rawTranscript: "RAW POLLUTION SHOULD NOT RENDER",
    sourceEvents: [
      { kind: "user_message", text: "生成长 SQL 和表格", createdAt: now - 300 },
      { kind: "assistant_message", text: cleanAssistant, createdAt: now - 200 },
      { kind: "tool_call", tone: "write", label: "写入", detail: "schema.sql", createdAt: now - 100 },
      { kind: "tool_result", text: "tool result preview should stay hidden", createdAt: now }
    ],
    now
  });
  const rendered = textOf(result);
  assert.equal(result.events[0]?.kind, "user_message");
  assert.equal(result.events[1]?.kind, "assistant_message");
  assert.equal(result.events[2]?.kind, "tool_call");
  assert.equal(result.segments.some((segment) => segment.kind === "user" && segment.text === "生成长 SQL 和表格"), true);
  assert.equal(rendered.includes("结构化事件提供的干净回复"), true);
  assert.equal(rendered.includes("created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"), true);
  assert.equal(rendered.includes("| 事件协议 | 优先 |"), true);
  assert.equal(result.segments.some((segment) => segment.text === "::meow-viewer-tool\twrite\t写入\tschema.sql"), true);
  assertNoLeak(rendered, ["Write(schema.sql)", "RAW POLLUTION", "继续测试meowviewer", "TASK-004", "tool result preview"]);
}

{
  const result = workspaceRendererParseSourceSnapshot({
    profile: "hermes",
    displayTranscript: "$ deepseek-v4-flash │ 900K/1M │ 90% │ 18s │ 8s\n─ Reasoning ─\nraw thinking should not drive semantic mode",
    rawTranscript: "RAW HERMES STATUS SHOULD NOT BE PARSED",
    sourceEvents: [
      { kind: "status", label: "阶段", status: "Hermes 正在整理回复", summary: "thinking", source: "adapter", createdAt: now - 100 },
      { kind: "assistant_message", text: "语义事件正文稳定显示。", source: "adapter", createdAt: now }
    ],
    now
  });
  const rendered = textOf(result);
  assert.equal(rendered.includes("语义事件正文稳定显示"), true);
  assert.equal(result.statusItems.some((item) => item.label === "阶段" && item.value === "Hermes 正在整理回复"), true);
  assert.equal(result.statusItems.some((item) => item.label === "模型" || item.value.includes("deepseek-v4-flash")), false);
  assertNoLeak(rendered, ["raw thinking", "RAW HERMES STATUS"]);
}

{
  const sourceEvents = [
    { kind: "status", label: "阶段", status: "Hermes 正在整理回复", summary: "thinking", source: "adapter", createdAt: now - 100 },
    { kind: "terminal_raw", text: "Welcome to Hermes Agent\nInitializing agent...\n$ deepseek │ 90%", source: "terminal", createdAt: now }
  ];
  assert.equal(workspaceRendererSourceEventsHaveSemanticAdapterOutput(sourceEvents), false);
  const result = workspaceRendererParseSourceSnapshot({
    profile: "hermes",
    sourceEvents,
    rawTranscript: "Welcome to Hermes Agent\nInitializing agent...",
    status: "running",
    now
  });
  const rendered = textOf(result);
  assert.equal(result.segments.some((segment) => segment.kind === "user"), false);
  assert.equal(result.events.some((event) => event.kind === "assistant_message"), false);
  assert.equal(result.statusItems.some((item) => item.label === "阶段" && item.value === "Hermes 正在整理回复"), true);
  assertNoLeak(rendered, ["Welcome to Hermes Agent", "Initializing agent"]);
}

{
  const prompt = "仅回复1";
  const raw = [
    "Welcome to Hermes Agent",
    "─ ✦ Hermes ─",
    `> ${prompt}`,
    "1"
  ].join("\n");
  const result = workspaceRendererParseSourceSnapshot({
    profile: "hermes",
    sourceEvents: [
      { kind: "status", label: "阶段", status: "Hermes 正在整理回复", summary: "thinking", source: "adapter", createdAt: now - 100 },
      { kind: "terminal_raw", text: raw, source: "terminal", createdAt: now }
    ],
    userTurns: [{ id: "u-hermes-status-only-fallback", text: prompt, source: "renderer", createdAt: now - 80 }],
    status: "running",
    now
  });
  const assistantText = result.segments.filter((segment) => segment.kind === "assistant").map((segment) => segment.text).join("\n");
  assert.equal(result.events.some((event) => event.kind === "user_message" && event.text === prompt), true);
  assert.equal(assistantText, "1");
}

{
  const prompt = "只回复2";
  const raw = [
    "Claude Code v2.1.168",
    "Opus 4.8 (1M context) · API Usage Billing",
    "E:\\Meowdesk\\workbench-prototype-ui-rebuild",
    `› ${prompt}`,
    "",
    "Thought for 1s (ctrl+o to expand)",
    "",
    "● 2",
    "",
    "✻ Brewed for 1s",
    "",
    "────────────────",
    "›",
    "? for shortcuts · ← for agents"
  ].join("\n");
  const result = workspaceRendererParseSourceSnapshot({
    profile: "claude",
    sourceEvents: [{ kind: "terminal_raw", text: raw, source: "terminal", createdAt: now }],
    userTurns: [{ id: "u-claude-short-reply", text: prompt, source: "terminal", createdAt: now - 80 }],
    status: "running",
    now
  });
  const assistantText = result.segments.filter((segment) => segment.kind === "assistant").map((segment) => segment.text).join("\n");
  assert.equal(result.events.some((event) => event.kind === "user_message" && event.text === prompt), true);
  assert.equal(assistantText, "2");
}

{
  const result = workspaceRendererParseSourceSnapshot({
    profile: "claude",
    sourceEvents: [
      { kind: "user_submit", text: "只记录用户输入时仍要走终端 fallback", source: "renderer", createdAt: now - 100 },
      { kind: "terminal_display", text: "● fallback assistant survives" }
    ],
    now
  });
  const rendered = textOf(result);
  assert.equal(result.events.some((event) => event.kind === "user_message" && event.text === "只记录用户输入时仍要走终端 fallback"), true);
  assert.equal(rendered.includes("fallback assistant survives"), true);
}

{
  const raw = [
    JSON.stringify({ type: "user", message: { role: "user", content: "用结构化 JSONL 输出 SQL 和表格" } }),
    JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          {
            type: "text",
            text: [
              "这是 ClaudeAdapter 从 JSONL 得到的干净内容：",
              "```sql",
              "CREATE TABLE audit_logs (",
              "  id BIGINT PRIMARY KEY,",
              "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
              ");",
              "```",
              "",
              "| 字段 | 类型 |",
              "| --- | --- |",
              "| created_at | TIMESTAMP |"
            ].join("\n")
          }
        ]
      }
    }),
    JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", name: "Write", input: { file_path: "audit.sql" } }]
      }
    }),
    JSON.stringify({ type: "tool_result", content: "tool result should stay hidden" })
  ].join("\n");
  const result = workspaceRendererParseSourceSnapshot({
    profile: "claude",
    rawTranscript: raw,
    now
  });
  const rendered = textOf(result);
  assert.equal(result.events.some((event) => event.kind === "user_message" && event.text === "用结构化 JSONL 输出 SQL 和表格"), true);
  assert.equal(result.events.some((event) => event.kind === "tool_call" && event.label === "Write" && event.detail === "audit.sql"), true);
  assert.equal(rendered.includes("ClaudeAdapter 从 JSONL 得到的干净内容"), true);
  assert.equal(rendered.includes("created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"), true);
  assert.equal(rendered.includes("| created_at | TIMESTAMP |"), true);
  assertNoLeak(rendered, ["tool result should stay hidden", "{\"type\":\"assistant\""]);
}

{
  const raw = [
    JSON.stringify({ kind: "user_message", content: "Hermes 结构化输出 markdown 和 diff" }),
    JSON.stringify({
      kind: "assistant_message",
      content: [
        { type: "text", text: "HermesAdapter 干净事件：" },
        { type: "text", text: "```diff\n- old line\n+ new line\n```" },
        { type: "text", text: "| 类型 | 状态 |\n| --- | --- |\n| Hermes | structured |" }
      ]
    }),
    JSON.stringify({ kind: "tool_call", name: "Read", input: { path: "README.md" } }),
    JSON.stringify({ kind: "tool_result", content: "Hermes tool result should stay hidden" })
  ].join("\n");
  const result = workspaceRendererParseSourceSnapshot({
    profile: "hermes",
    rawTranscript: raw,
    now
  });
  const rendered = textOf(result);
  assert.equal(result.events.some((event) => event.kind === "user_message" && event.text === "Hermes 结构化输出 markdown 和 diff"), true);
  assert.equal(result.events.some((event) => event.kind === "tool_call" && event.label === "Read" && event.detail === "README.md"), true);
  assert.equal(rendered.includes("HermesAdapter 干净事件"), true);
  assert.equal(rendered.includes("+ new line"), true);
  assert.equal(rendered.includes("| Hermes | structured |"), true);
  assertNoLeak(rendered, ["Hermes tool result should stay hidden", "{\"kind\":\"assistant_message\""]);
}

{
  const lines = [
    "# 备份当前版本",
    "if [ -n \"$PROJECT_DIR\" ]; then",
    "",
    "echo \"备份当前版本到 $BACKUP_DIR\"",
    "cp -r \"$PROJECT_DIR\" \"$BACKUP_DIR\"",
    "",
    "拉取最新代码",
    "cd \"$PROJECT_DIR\" || exit 1",
    "git fetch origin",
    "git checkout main",
    "git pull origin main",
    "",
    "安装依赖",
    "npm install --production"
  ];
  const backupBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(backupBlock?.lang, "shell");
  assert.deepEqual(backupBlock?.lines, lines.slice(0, 5));
  const fetchBlock = workspaceRendererCodeBlock(lines, 7);
  assert.equal(fetchBlock?.lang, "shell");
  assert.deepEqual(fetchBlock?.lines, lines.slice(7, 11));
  const installBlock = workspaceRendererCodeBlock(lines, 13);
  assert.equal(installBlock?.lang, "shell");
  assert.deepEqual(installBlock?.lines, lines.slice(13, 14));
}

{
  const lines = [
    "case \"${NODE_ENV:-development}\" in",
    "  production)",
    "    npm run test",
    "    ;;",
    "  *)",
    "    echo \"Unknown environment\"",
    "    exit 1",
    "    ;;",
    "esac",
    "sleep 5",
    "exit 0"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(codeBlock?.lang, "shell");
  assert.deepEqual(codeBlock?.lines, lines);
}

{
  const lines = [
    "# 页面输出",
    "这里有 **加粗重点** 和 *斜体补充*。"
  ];
  assert.equal(workspaceRendererCodeBlock(lines, 0), null);
}

{
  const lines = [
    "python",
    "def calc_daily_report(nav, cost):",
    "    return nav - cost"
  ];
  assert.equal(workspaceRendererCodeBlock(lines, 0), null);
  const codeBlock = workspaceRendererCodeBlock(lines, 1);
  assert.equal(codeBlock?.lang, "python");
  assert.deepEqual(codeBlock?.lines, lines.slice(1));
}

{
  const lines = [
    "return {",
    "  steps: sorted,",
    "  maxRetries: 3,",
    "  timeout: 30000",
    "};",
    "await executor.execute('workflow 123');"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(codeBlock?.lang, "js");
  assert.deepEqual(codeBlock?.lines, lines);
}

{
  const lines = [
    "const visit = (nodeId) => {",
    "  const node = workflow.nodes.get(nodeId);",
    "  node.dependencies.forEach((depId) => visit(depId));",
    "  sorted.push(node);",
    "};"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(codeBlock?.lang, "js");
  assert.deepEqual(codeBlock?.lines, lines);
}

{
  const lines = [
    "scala",
    "val result = workflow.execute(scala.concurrent.ExecutionContext.global).unsafeRunSync()",
    "result.foreach {",
    "  case (id, NodeSuccess(_, data, duration)) =>",
    "    println(s\"✔ $id: completed in ${duration}ms\")",
    "}"
  ];
  assert.equal(workspaceRendererCodeBlock(lines, 0), null);
  const codeBlock = workspaceRendererCodeBlock(lines, 1);
  assert.equal(codeBlock?.lang, "scala");
  assert.deepEqual(codeBlock?.lines, lines.slice(1));
}

{
  const lines = [
    "val save = IO.delay {",
    "  val data = ctx.inputs.headOption",
    "  println(s\"Saving: $data\")",
    "  \"saved\"",
    "  s\"Transformed: $data\"",
    "}"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(codeBlock?.lang, "scala");
  assert.deepEqual(codeBlock?.lines, lines);
}

{
  const lines = [
    "transform: translateY(-2px);",
    "box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);",
    "}",
    "",
    "{",
    "  \"workflow\": {",
    "    \"id\": \"wf-20260606-001\"",
    "  }",
    "}"
  ];
  const cssBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(cssBlock?.lang, "css");
  assert.deepEqual(cssBlock?.lines, lines.slice(0, 3));
  const jsonBlock = workspaceRendererCodeBlock(lines, 4);
  assert.equal(jsonBlock?.lang, "json");
  assert.deepEqual(jsonBlock?.lines, lines.slice(4));
}

{
  const lines = [
    "interface WorkflowNode {",
    "  id: string;",
    "}",
    "",
    "class WorkflowExecutor:",
    "    def __init__(self, nodes):",
    "        self.nodes = nodes"
  ];
  const tsBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(tsBlock?.lang, "ts");
  assert.deepEqual(tsBlock?.lines, lines.slice(0, 3));
  const pythonBlock = workspaceRendererCodeBlock(lines, 4);
  assert.equal(pythonBlock?.lang, "python");
  assert.deepEqual(pythonBlock?.lines, lines.slice(4));
}

{
  const lines = [
    "interface WorkflowNode {",
    "  id: string;",
    "}",
    "class WorkflowExecutor:",
    "    def __init__(self, nodes):",
    "        self.nodes = nodes"
  ];
  const tsBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(tsBlock?.lang, "ts");
  assert.deepEqual(tsBlock?.lines, lines.slice(0, 3));
  const pythonBlock = workspaceRendererCodeBlock(lines, 3);
  assert.equal(pythonBlock?.lang, "python");
  assert.deepEqual(pythonBlock?.lines, lines.slice(3));
}

{
  const lines = [
    "E:\\Meowdesk\\workbench-prototype-ui-rebuild\\src\\",
    "├─ renderer-app/",
    "│  └─ readiness/",
    "│     └─ meow-viewer-parser.ts",
    "| 模块 | 状态 |",
    "| --- | --- |",
    "| parser | stable |"
  ];
  const treeBlock = workspaceRendererTreeBlock(lines, 0);
  assert.deepEqual(treeBlock?.lines, lines.slice(0, 4));
  assert.equal(treeBlock?.next, 4);
}

{
  const lines = [
    "from dataclasses import dataclass",
    "from typing import List, Optional, Dict, Any",
    "from enum import Enum",
    "",
    "class TaskStatus(Enum):",
    "    PENDING = \"pending\"",
    "    IN_PROGRESS = \"in_progress\"",
    "    COMPLETED = \"completed\"",
    "    FAILED = \"failed\"",
    "",
    "@dataclass",
    "class Task:",
    "    id: str",
    "    name: str",
    "    status: TaskStatus",
    "    priority: int",
    "    tags: List[str]",
    "    metadata: Dict[str, Any]",
    "",
    "    def is_active(self) -> bool:",
    "        return self.status == TaskStatus.IN_PROGRESS"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(codeBlock?.lang, "python");
  assert.deepEqual(codeBlock?.lines, lines);
}

{
  const lines = [
    "Python",
    "@dataclass",
    "class MeowViewerBugVerification:",
    "    bug_id: str = \"MEOW-VIEWER-001\"",
    "    title: str = \"代码块解析失败\"",
    "    root_cause: str = \"装饰器起始行被拆出代码块\"",
    "",
    "    def is_active(self) -> bool:",
    "        return True"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 1);
  assert.equal(codeBlock?.lang, "python");
  assert.deepEqual(codeBlock?.lines, lines.slice(1));
}

{
  const lines = [
    "python",
    "class ConversationMemory:",
    "    def __init__(self,",
    "                 max_history: int = 100):",
    "        self.messages:",
    "        List[AgentMessage] = []",
    "        self.max_history = max_history",
    "",
    "    async def",
    "    add_message(self, role:",
    "                str, content: str) ->",
    "                None:",
    "        message = AgentMessage(",
    "            role=role,",
    "            content=content",
    "        )",
    "        self.messages.append(message)"
  ];
  assert.equal(workspaceRendererCodeBlock(lines, 0), null);
  const codeBlock = workspaceRendererCodeBlock(lines, 1);
  assert.equal(codeBlock?.lang, "python");
  assert.deepEqual(codeBlock?.lines, lines.slice(1));
}

{
  assert.equal(workspaceRendererLineIsClaudeThinkingStatus("✻ Cooked for 29s"), true);
  assert.equal(workspaceRendererLineIsClaudeThinkingStatus("✽ Brewed for 12s"), true);
  const raw = [
    "● 下面是 Python 记忆模块和 diff：",
    "```python",
    "class ConversationMemory:",
    "    def __init__(self,",
    "                 max_history: int = 100):",
    "        self.messages:",
    "        List[AgentMessage] = []",
    "        self.max_history = max_history",
    "",
    "    async def",
    "    add_message(self, role:",
    "                str, content: str) ->",
    "                None:",
    "        message = AgentMessage(",
    "            role=role,",
    "            content=content",
    "        )",
    "```",
    "```diff",
    "--- a/src/app.py",
    "+++ b/src/app.py",
    "@@ -1 +1 @@",
    "-old",
    "+new",
    "```",
    "✻ Cooked for 29s"
  ].join("\n");
  const result = workspaceRendererParseTranscript({ raw, profile: "claude", now });
  const rendered = textOf(result);
  assert.equal(rendered.includes("self.messages:"), true);
  assert.equal(rendered.includes("List[AgentMessage] = []"), true);
  assert.equal(rendered.includes("                None:"), true);
  assert.equal(rendered.includes("+new"), true);
  assert.equal(result.statusItems.some((item) => item.label === "思考" && item.value === "约 29s"), true);
  assert.equal(result.segments.some((segment) => segment.kind === "thinking"), false);
  assertNoLeak(rendered, ["Cooked for", "✻ Cooked"]);
}

{
  const lines = [
    "CREATE TABLE users (",
    "    id BIGINT PRIMARY KEY AUTO_INCREMENT,",
    "    username VARCHAR(50) NOT NULL UNIQUE,",
    "    email VARCHAR(100) NOT NULL UNIQUE,",
    "    password_hash VARCHAR(255) NOT NULL,",
    "    role ENUM('admin', 'developer', 'viewer') DEFAULT 'viewer',",
    "    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',",
    "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,",
    "    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,",
    "    last_login_at TIMESTAMP NULL,",
    "    INDEX idx_email (email),",
    "    INDEX idx_role_status (role, status)",
    "    FOREIGN KEY (project_id) REFERENCES projects(id) ON",
    "    DELETE CASCADE ON UPDATE CASCADE,",
    "    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE",
    "    SET NULL ON UPDATE CASCADE",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(codeBlock?.lang, "sql");
  assert.deepEqual(codeBlock?.lines, lines);
  const result = workspaceRendererParseTranscript({
    raw: ["SQL", ...lines].join("\n"),
    profile: "claude",
    userTurns: [],
    now
  });
  const rendered = textOf(result);
  assert.equal(rendered.includes("created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"), true);
  assert.equal(rendered.includes("updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"), true);
  assertNoLeak(rendered, ["::meow-viewer-tool", "创建\tat TIMESTAMP", "修改\tat TIMESTAMP"]);
}

{
  const lines = [
    "sql",
    "SELECT id, tag, source, status, created_at",
    "FROM meodesk_tasks",
    "WHERE status = 'pending'",
    "ORDER BY created_at DESC",
    "LIMIT 5;",
    "",
    "| id | tag | source | status | created_at |",
    "| --- | --- | --- | --- | --- |",
    "| 42 | yingmu | codex | pending | 2026-06-06 |"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 1);
  assert.equal(codeBlock?.lang, "sql");
  assert.deepEqual(codeBlock?.lines, lines.slice(1, 6));
  assert.equal(codeBlock?.next, 6);
  const table = workspaceRendererTable(lines, 7);
  assert.equal(table?.headers[0], "id");
  assert.equal(table?.rows[0][1], "yingmu");
}

{
  const lines = [
    "WITH RECURSIVE employee_tree AS (",
    "  SELECT id, name, manager_id, department_id, 1 AS depth",
    "  FROM employees",
    "  WHERE manager_id IS NULL",
    "  UNION ALL",
    "  SELECT e.id, e.name, e.manager_id, e.department_id, et.depth + 1",
    "  FROM employees e",
    "  JOIN employee_tree et ON e.manager_id = et.id",
    "),",
    "",
    "salary_stats AS (",
    "  SELECT department_id, AVG(salary) AS avg_salary,",
    "         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS median_salary",
    "  FROM employees",
    "  GROUP BY department_id",
    ")",
    "",
    "SELECT et.name, et.depth, ss.avg_salary, ss.median_salary,",
    "       RANK() OVER (PARTITION BY et.depth ORDER BY ss.avg_salary DESC) AS salary_rank",
    "FROM employee_tree et",
    "LEFT JOIN salary_stats ss ON ss.department_id = et.department_id",
    "ORDER BY et.depth, salary_rank;"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(codeBlock?.lang, "sql");
  assert.deepEqual(codeBlock?.lines, lines);
  assert.equal(codeBlock?.next, lines.length);
}

{
  const lines = [
    "WITH RECURSIVE",
    "org_chain AS (",
    "  SELECT e.id, e.name, e.manager_id, e.department_id, 0 AS level",
    "  FROM employees e",
    "  WHERE e.manager_id IS NULL",
    "  UNION ALL",
    "  SELECT e.id, e.name, e.manager_id, e.department_id, oc.level + 1",
    "  FROM employees e",
    "  JOIN org_chain oc ON oc.id = e.manager_id",
    "),",
    "",
    "dept_stats AS (",
    "  SELECT d.id AS dept_id, d.name AS dept_name,",
    "         COUNT(oc.id) AS total_members, AVG(oc.level) AS avg_depth",
    "  FROM departments d",
    "  LEFT JOIN org_chain oc ON oc.department_id = d.id",
    "  GROUP BY d.id, d.name",
    ")",
    "",
    "SELECT oc.name, oc.level, ds.dept_name, ds.total_members,",
    "       RANK() OVER (PARTITION BY oc.level ORDER BY ds.total_members DESC) AS rank_in_level",
    "FROM org_chain oc",
    "LEFT JOIN dept_stats ds ON ds.dept_id = oc.department_id",
    "ORDER BY oc.level, rank_in_level;"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(codeBlock?.lang, "sql");
  assert.deepEqual(codeBlock?.lines, lines);
  assert.equal(codeBlock?.next, lines.length);
}

{
  const lines = [
    "WITH RECURSIVE",
    "org_chain AS (",
    "SELECT e.id, e.name, e.manager_id, e.department_id, 0 AS level",
    "FROM employees e",
    "WHERE e.manager_id IS NULL",
    "UNION ALL",
    "SELECT e.id, e.name, e.manager_id, e.department_id, oc.level + 1",
    "FROM employees e",
    "INNER JOIN org_chain oc ON e.manager_id = oc.id",
    "-- MVSQLONECARD",
    "),",
    "dept_stats AS (",
    "SELECT d.id AS dept_id, d.name AS dept_name,",
    "COUNT(oc.id) AS total_members, AVG(oc.level) AS avg_depth",
    "FROM departments d",
    "LEFT JOIN org_chain oc ON oc.department_id = d.id",
    "GROUP BY d.id, d.name",
    ")",
    "SELECT oc.name, oc.level, ds.dept_name, ds.total_members,",
    "RANK() OVER (PARTITION BY oc.level ORDER BY ds.total_members DESC) AS rank_in_level",
    "FROM org_chain oc",
    "LEFT JOIN dept_stats ds ON ds.dept_id = oc.department_id",
    "ORDER BY oc.level, rank_in_level;"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(codeBlock?.lang, "sql");
  assert.deepEqual(codeBlock?.lines, lines);
  assert.equal(codeBlock?.next, lines.length);
}

{
  const lines = [
    "WITH RECURSIVE",
    "org_chain AS",
    "(",
    "SELECT",
    "e.id,",
    "e.name,",
    "e.manager_id,",
    "e.department_id,",
    "0 AS level",
    "FROM employees e",
    "WHERE e.manager_id IS NULL",
    "UNION ALL",
    "SELECT",
    "e.id,",
    "e.name,",
    "e.manager_id,",
    "e.department_id,",
    "oc.level + 1",
    "FROM employees e",
    "INNER JOIN org_chain oc ON e.manager_id = oc.id",
    "-- MVSQLTWOCHECK",
    "dept_stats AS",
    "(",
    "SELECT",
    "d.id AS dept_id, d.name AS dept_name,",
    "COUNT(oc.id) AS total_members, AVG(oc.level) AS avg_depth",
    "FROM departments d",
    "LEFT JOIN org_chain oc ON oc.department_id = d.id",
    "GROUP BY d.id, d.name",
    "SELECT oc.name, oc.level, ds.dept_name, ds.total_members,",
    "RANK() OVER (PARTITION BY oc.level ORDER BY ds.total_members DESC) AS rank_in_level",
    "FROM org_chain oc",
    "LEFT JOIN dept_stats ds ON ds.dept_id = oc.department_id",
    "ORDER BY oc.level, rank_in_level;"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(codeBlock?.lang, "sql");
  assert.deepEqual(codeBlock?.lines, lines);
  assert.equal(codeBlock?.next, lines.length);
}

{
  const lines = [
    "with open(path, \"r\", encoding=\"utf-8\") as handle:",
    "    payload = handle.read()",
    "return payload"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(codeBlock?.lang, "python");
  assert.deepEqual(codeBlock?.lines, lines);
}

{
  const lines = [
    "终端盒线长表格：",
    "┌────┬────────────────────────────────────┬────────────┬────────┬────────┬────────────┐",
    "│ 序号 │ 文件路径                           │ 问题类型     │ 优先级 │ 状态   │ 备注       │",
    "├────┼────────────────────────────────────┼────────────┼────────┼────────┼────────────┤",
    "│ 1  │ src/renderer/main.js                │ 单文件过大   │ P0     │ 进行中 │ 核心重构项 │",
    "│ 2  │ src/renderer/ui/legacy-panel.js     │ 冗余 UI      │ P1     │ 待启动 │ 与新 UI 重复 │",
    "│ 3  │ src/workflow/executor.js            │ 硬编码逻辑   │ P2     │ 待配置 │ 运行路径长 │",
    "└────┴────────────────────────────────────┴────────────┴────────┴────────┴────────────┘"
  ];
  const nativeTable = workspaceRendererAsciiTable(lines, 1);
  assert.equal(nativeTable?.headers[0], "序号");
  assert.equal(nativeTable?.headers[1], "文件路径");
  assert.equal(nativeTable?.rows.length, 3);
  assert.equal(nativeTable?.rows[1][1], "src/renderer/ui/legacy-panel.js");
  assert.equal(nativeTable?.rows[2][5], "运行路径长");
  const tableBlock = workspaceRendererAsciiTableBlock(lines, 1);
  assert.deepEqual(tableBlock?.lines, lines.slice(1));
  assert.equal(tableBlock?.next, lines.length);
  const parsed = workspaceRendererParseTranscript({ raw: lines.join("\n"), profile: "claude", userTurns: [], now });
  const rendered = textOf(parsed);
  assert.equal(rendered.includes("src/renderer/main.js"), true);
  assert.equal(rendered.includes("核心重构项"), true);
}

{
  const lines = [
    "├──────────┼────────────────────────────┼──────────────────────────────────────────────────────────────┼──────────┼────────┼──────────────┼────────────────────────────┤",
    "│ TASK-004 │ 前端组件库升级 │ 从 Ant Design 3.x 升级到 5.x，处理 breaking",
    "changes, 更新所有页面组件 │ 进行中 │ P2 │ 赵六 │ 已完成",
    "60%,遇到表中竖排兼容性问题 │",
    "├──────────┼────────────────────────────┼──────────────────────────────────────────────────────────────┼──────────┼────────┼──────────────┼────────────────────────────┤"
  ];
  const table = workspaceRendererLooseAsciiTable(lines, 0);
  assert.deepEqual(table?.headers, ["任务ID", "任务名称", "描述", "状态", "优先级", "负责人", "备注"]);
  assert.equal(table?.rows.length, 1);
  assert.equal(table?.rows[0][0], "TASK-004");
  assert.equal(table?.rows[0][1], "前端组件库升级");
  assert.equal(table?.rows[0][2], "从 Ant Design 3.x 升级到 5.x，处理 breaking changes, 更新所有页面组件");
  assert.equal(table?.rows[0][3], "进行中");
  assert.equal(table?.rows[0][4], "P2");
  assert.equal(table?.rows[0][5], "赵六");
  assert.equal(table?.rows[0][6], "已完成 60%,遇到表中竖排兼容性问题");
}

{
  const lines = [
    "├──────────┼────────────────────────────┼──────────────────────────────────────────────────────────────┼──────────┼────────┼──────────────┼────────────────────────────┤",
    "│ T-1002 │ 实现实时消息推送系统 │ 基于 WebSocket 构建实时消息推送功能，支持任务状态变更、评论通知、@提及等场",
    "景 │ 进行中 │ P1 │ 李四 │ 技术方案选择：Socket.io vs 原生 WebSocket，倾向前者。需要与 Redis 配合做消息队列，预计 2 周 │",
    "│ T-1003 │ 性能基准测试 │ 对 API 延迟和吞吐进行压测，生成报告并定位瓶颈 │ 进行中 │ P1 │ 王五 │ 团队正在进行性能基准测试 │",
    "├──────────┼────────────────────────────┼──────────────────────────────────────────────────────────────┼──────────┼────────┼──────────────┼────────────────────────────┤"
  ];
  const table = workspaceRendererLooseAsciiTable(lines, 0);
  assert.deepEqual(table?.headers, ["任务ID", "任务名称", "描述", "状态", "优先级", "负责人", "备注"]);
  assert.equal(table?.rows.length, 2);
  assert.equal(table?.rows[0].length, 7);
  assert.equal(table?.rows[0][0], "T-1002");
  assert.equal(table?.rows[0][2], "基于 WebSocket 构建实时消息推送功能，支持任务状态变更、评论通知、@提及等场景");
  assert.equal(table?.rows[0][6], "技术方案选择：Socket.io vs 原生 WebSocket，倾向前者。需要与 Redis 配合做消息队列，预计 2 周");
  assert.equal(table?.rows[1][0], "T-1003");
  assert.equal(table?.rows[1][6], "团队正在进行性能基准测试");
}

{
  const lines = [
    "| 任务 | 任务名 |            |      | 优 | 开始日 | 预计完 | 实际 | 负 |      |",
    "| ID   | 称     | 描述       | 状态 | 先 | 期     | 成     | 耗时 | 责 | 备注 |",
    "|      |        |            |      | 级 |        |        |      | 人 |      |",
    "|------|--------|------------|------|----|--------|--------|------|----|------|",
    "| MEOW | 拆分   | 将 9727 行代 | 进行 | P0 | 2026-0 | 2026-0 | 3天  | Cla | 第一优 |",
    "| -001 | main.js | 码按模块拆分 | 中   |    | 6-05   | 6-15   |      | ude | 先级   |",
    "|------|--------|------------|------|----|--------|--------|------|----|------|",
    "| MEOW | 重构 Wo | 解耦业务逻辑 | 待启 | P0 | 2026-0 | 2026-0 | -    | 待 | 依赖 ME |",
    "| -002 | rkflow | 和渲染逻辑   | 动   |    | 6-16   | 6-30   |      | 分 | OW-001 |",
    "|      | 引擎   |            |      |    |        |        |      | 配 |        |"
  ];
  const table = workspaceRendererAsciiTable(lines, 0);
  assert.equal(table?.headers.length, 10);
  assert.equal(table?.headers[0], "任务ID");
  assert.equal(table?.headers[1], "任务名称");
  assert.equal(table?.headers[4], "优先级");
  assert.equal(table?.headers[8], "负责人");
  assert.equal(table?.rows.length, 2);
  assert.equal(table?.rows[0][0], "MEOW-001");
  assert.equal(table?.rows[0][1], "拆分 main.js");
  assert.equal(table?.rows[0][2], "将 9727 行代码按模块拆分");
  assert.equal(table?.rows[1][1], "重构 Workflow 引擎");
  assert.equal(table?.rows[1][9], "依赖 MEOW-001");
}

{
  const lines = [
    "┌────┬────────────────────────┬────────────┬────────┬────────┬────────────┐",
    "│ 序号 │ 文件路径                 │ 问题类型     │ 优先级 │ 状态   │ 备注       │",
    "├────┼────────────────────────┼────────────┼────────┼────────┼────────────┤",
    "│ 1  │ src/renderer/main.js    │",
    "单文件过大   │ P0     │ 进行中 │ 核心重构项 │",
    "│ 2  │ src/renderer/ui/legacy-panel.js │ 冗余 UI │ P1 │ 待启动 │ 与新 UI 重复 │",
    "│ 3  │ src/workflow/executor.js │",
    "硬编码逻辑   │ P2     │ 待配置 │ 运行路径长 │",
    "└────┴────────────────────────┴────────────┴────────┴────────┴────────────┘"
  ];
  const table = workspaceRendererAsciiTable(lines, 0);
  assert.equal(table?.headers.length, 6);
  assert.equal(table?.rows.length, 3);
  assert.equal(table?.rows[0][1], "src/renderer/main.js");
  assert.equal(table?.rows[0][2], "单文件过大");
  assert.equal(table?.rows[0][5], "核心重构项");
  assert.equal(table?.rows[2][2], "硬编码逻辑");
  assert.equal(table?.rows[2][5], "运行路径长");
}

{
  const lines = [
    "├──────────┼────────────────────────┼────────────────────────────────────────┼──────────┼──────────┼──────────┼────────────────────────────┤",
    "│ MV-011 │ 代码更新 │ 支持 nested bold/italic in meow viewer │ 待提交 │ 中 │ Claude │ 依赖 MV-010,预计 2 分钟 │",
    "├──────────┼────────────────────────┼────────────────────────────────────────┼──────────┼──────────┼──────────┼────────────────────────────┤",
    "│ MV-012 │ 文档更新 │",
    "更新技术债记录,标记此 bug",
    "|为已解决,更新修复耗时数据|待完成|",
    "|低|Claude|依赖",
    "MV-011,预计 5 分钟 |",
    "总计: 12 个任务 | 已完成: 1 | 待执行: 11 |"
  ];
  assert.equal(workspaceRendererAsciiTable(lines, 0), null);
  const table = workspaceRendererLooseAsciiTable(lines, 0);
  assert.deepEqual(table?.headers, ["任务ID", "任务名称", "描述", "状态", "优先级", "负责人", "备注"]);
  assert.equal(table?.rows.length, 2);
  assert.equal(table?.rows[0][0], "MV-011");
  assert.equal(table?.rows[0][2], "支持 nested bold/italic in meow viewer");
  assert.equal(table?.rows[1][0], "MV-012");
  assert.equal(table?.rows[1][2], "更新技术债记录,标记此 bug 为已解决,更新修复耗时数据");
  assert.equal(table?.rows[1][3], "待完成");
  assert.equal(table?.rows[1][6], "依赖 MV-011,预计 5 分钟");
  assert.equal(table?.next, 8);
}

{
  const lines = [
    "├──────────┼────────────────────────┼────────────────────────────────────────┼──────────┼──────────┼──────────┼────────────────────────────┤",
    "│ MV-011 │ 代码更新 │ 支持 nested bold/italic in meow viewer │ 待提交 │ 中 │ Claude │ 依赖 MV-010 │",
    "MeowViewer 设计原则",
    "阅读层应该像笔记一样稳定。"
  ];
  const table = workspaceRendererLooseAsciiTable(lines, 0);
  assert.equal(table?.rows.length, 1);
  assert.equal(table?.rows[0][0], "MV-011");
  assert.equal(table?.next, 2);
}

{
  const lines = [
    "// 深度可选类型",
    "type DeepPartial<T> = {",
    "  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];",
    "};",
    "",
    "// 联合类型转交叉类型",
    "type UnionToIntersection<U> =",
    "  (U extends any ? (k: U) => void : never) extends (k: infer I) => void",
    "    ? I",
    "    : never;",
    "",
    "interface Config {",
    "  viewer: { width: number; height: number };",
    "  theme: { primary: string; secondary: string };",
    "}",
    "",
    "type PartialConfig = DeepPartial<Config>;",
    "type NodeConfig =",
    "  | { type: 'action'; handler: string; params: Record<string, any> }",
    "  | { type: 'condition'; expression: string; trueBranch: string; falseBranch: string };",
    "// ✅所有字段都可选"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(codeBlock?.lang, "ts");
  assert.deepEqual(codeBlock?.lines, lines);
}

{
  const lines = [
    "tasks.iter().any(|t| t.id == *dep_id)",
    "  .map_err(|_| SchedulerError::LockPoisoned)?;",
    "return Err(SchedulerError::DependencyNotFound(*dep_id));"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(codeBlock?.lang, "rust");
  assert.deepEqual(codeBlock?.lines, lines);
}

{
  const lines = [
    "class WorkflowEngine<T>(private val nodes: List<Node<T>>) {",
    "    suspend fun execute(): Map<String, T> {",
    "        return nodes.associate { node -> node.id to node.handler() }",
    "    }",
    "}",
    "class WorkFlow[A](nodes: List[Node[A]]) {",
    "  def execute: IO[Map[String, A]] = {",
    "    nodes.traverse { node => node.handler.map(result => node.id -> result) }",
    "  }",
    "}"
  ];
  const kotlinBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(kotlinBlock?.lang, "kotlin");
  assert.deepEqual(kotlinBlock?.lines, lines.slice(0, 5));
  const scalaBlock = workspaceRendererCodeBlock(lines, 5);
  assert.equal(scalaBlock?.lang, "scala");
  assert.deepEqual(scalaBlock?.lines, lines.slice(5));
}

{
  const lines = [
    "case class ToolNode(name: String, args: Map[String, Any])",
    "  extends NodeType",
    "case class ConditionNode(predicate: Any => Boolean)",
    "",
    "case class Node[A](",
    "  id: String,",
    "  nodeType: NodeType,",
    "  dependencies: List[String] = Nil,",
    "  handler: Context => IO[A]",
    ")",
    "case class Context(",
    "  nodeId: String,",
    "  inputs: List[Any],",
    "  metadata: Map[String, Any] = Map.empty",
    ")"
  ];
  const codeBlock = workspaceRendererCodeBlock(lines, 0);
  assert.equal(codeBlock?.lang, "scala");
  assert.deepEqual(codeBlock?.lines, lines);
}

{
  const lines = [
    "模块: Workflow Executor",
    "状态: ✅ Stable 负责人: Claude 优先级: P0",
    "风险: 🟢 Low",
    "输入: Context, Node[] 输出: ExecutionResult<T> 验证方式: Unit Test + Integration 回归标记: v1.2.3 备注: 核心执行引擎 refactored 模块: LLM Node Handler 状态: 🔄 Refactoring 负责人: Alice Wang 优先级: P0",
    "风险: 🟡 Medium",
    "输入: prompt: String, model: String 输出: LLMResponse 验证方式: Mock API + E2E 回归标记: v2.0.0-beta 备注: Temperature 参数待优化"
  ];
  const rebuilt = workspaceRendererRebuildFieldTableLines(lines);
  assert.equal(rebuilt[0], "| 模块 | 状态 | 负责人 | 优先级 | 风险 | 输入 | 输出 | 验证方式 | 回归标记 | 备注 |");
  const table = workspaceRendererTable(rebuilt, 0);
  assert.equal(table?.headers.length, 10);
  assert.equal(table?.rows.length, 2);
  assert.equal(table?.rows[0][0], "Workflow Executor");
  assert.equal(table?.rows[1][0], "LLM Node Handler");
  assert.equal(table?.rows[1][5], "prompt: String, model: String");
}

{
  const turn = {
    id: "u-code-labels",
    text: "第4轮meowviewer质检：不读代码，只输出 6 个代码块，分别是 ```ts```、```python```、```sql```、```html```、```css```、```json```，每个 6 到 12 行。不要解释，不要列表。",
    source: "renderer",
    createdAt: now
  };
  assert.equal(workspaceRendererPromptContinuationMatches("第4轮meowviewer质检：不读代码，只输出 6 个代码块，分别是 ``", "python", turn), true);
  assert.equal(workspaceRendererPromptContinuationMatches("第4轮meowviewer质检：不读代码，只输出 6 个代码块，分别是 ``", "json", turn), true);
  assert.equal(workspaceRendererPromptContinuationMatches("第4轮meowviewer质检：不读代码，只输出 6 个代码块，分别是 ``", "interface WorkflowNode {", turn), false);
}

{
  const lines = [
    "#!/usr/bin/env bash",
    "SRC_DIR=\"./cats\"",
    "OUT_DIR=\"./out/thumbs\"",
    "mkdir -p \"$OUT_DIR\"",
    "for img in \"$SRC_DIR\"/*.jpg; do",
    "  name=$(basename \"$img\" .jpg)",
    "  convert \"$img\" -resize 320x320^ -quality 82 \"$OUT_DIR/${name}.webp\"",
    "done",
    "cat <<EOF",
    "Meow Viewer — Thumbnail pipeline complete.",
    "Source: $SRC_DIR → Output: $OUT_DIR",
    "EOF",
    "",
    "## 下一段"
  ];
  const labelled = workspaceRendererLabelledCodeBlock(lines, 0, "bash");
  assert.equal(labelled?.lang, "bash");
  assert.deepEqual(labelled?.lines, lines.slice(0, 12));
  assert.equal(labelled?.next, 12);
}

{
  assert.equal(workspaceRendererCodeBlock(["1) Markdown 列表和引用"], 0), null);
  assert.equal(workspaceRendererCodeBlock(["4)"], 0), null);
}

runSourceEventFixtures();

console.log("meow-viewer-parser fixtures passed");

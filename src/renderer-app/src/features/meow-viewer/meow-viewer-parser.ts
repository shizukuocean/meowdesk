import type {
  WorkspaceRenderedSegment,
  WorkspaceRenderedSegmentKind,
  WorkspaceRendererEvent,
  WorkspaceRendererEventKind,
  WorkspaceRendererParseInput,
  WorkspaceRendererParseResult,
  WorkspaceRendererPermissionPrompt,
  WorkspaceRendererProfile,
  WorkspaceRendererSourceEvent,
  WorkspaceRendererSourceSnapshot,
  WorkspaceRendererStatusItem,
  WorkspaceRendererStatusTone,
  WorkspaceRendererToolTone,
  WorkspaceTerminalUserTurn
} from "./meow-viewer-contract";

export type {
  WorkspaceRenderedSegment,
  WorkspaceRenderedSegmentKind,
  WorkspaceRendererEvent,
  WorkspaceRendererEventKind,
  WorkspaceRendererPaneLike,
  WorkspaceRendererParseInput,
  WorkspaceRendererParseResult,
  WorkspaceRendererPermissionPrompt,
  WorkspaceRendererProfile,
  WorkspaceRendererSourceEvent,
  WorkspaceRendererSourceEventKind,
  WorkspaceRendererSourceSnapshot,
  WorkspaceRendererStatusItem,
  WorkspaceRendererStatusTone,
  WorkspaceRendererToolTone,
  WorkspaceTerminalSubmitSource,
  WorkspaceTerminalUserTurn
} from "./meow-viewer-contract";

export function workspaceRendererStripTerminalControls(text: string) {
  return String(text || "")
    .replace(/\u001b\][^\u0007]*(\u0007|\u001b\\)/g, "")
    .replace(/\u001b\[\d+;1[Hf]/g, "\n")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\^\[\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[¬]+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/([\u3400-\u9fff])[ \t]+([\u3400-\u9fff])/g, "$1$2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n");
}

export function workspaceRendererCleanDisplayText(text: string) {
  const source = String(text || "");
  const tableLike = /^\s*\|/.test(source) && source.split("|").length >= 3;
  const cleaned = source
    .replace(/\uFFFD/g, "")
    .replace(/[■□▪▫▁▂▃▄▅▆▇█▀▔¬]+/g, " ")
    .replace(/[╭╮╰╯┌┐└┘├┤┬┴┼╞╡╪]/g, " ")
    .replace(/\s+([，。！？；：、,.!?;:])/g, "$1")
    .replace(/([（([])\s+/g, "$1")
    .replace(/\s+([）)\]])/g, "$1")
    .replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/g, "$1$2")
    .replace(/[ \t]{2,}/g, " ");
  return (tableLike ? cleaned : cleaned.replace(/^[\s│┃|+`_\-—>›❯]+/, "")).trim();
}

export function workspaceRendererCleanTableCellText(text: string) {
  return String(text || "")
    .replace(/\uFFFD/g, "")
    .replace(/[■□▪▫▁▂▃▄▅▆▇█▀▔¬]+/g, " ")
    .replace(/[╭╮╰╯┌┐└┘├┤┬┴┼╞╡╪]/g, " ")
    .replace(/\s+([，。！？；：、,.!?;:])/g, "$1")
    .replace(/([（([])\s+/g, "$1")
    .replace(/\s+([）)\]])/g, "$1")
    .replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/g, "$1$2")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function workspaceRendererLinePreservesMarkdownSyntax(line: string) {
  const text = line.trim();
  return Boolean(
    workspaceRendererToolStatusFromMarker(text) ||
    workspaceRendererLineIsMarkdownHr(text) ||
    /^```/.test(text) ||
    workspaceRendererHeadingLevel(text) ||
    /^\s*[-*]\s+\[[ xX]\]\s+/.test(line) ||
    /^\s*(?:[-*]|(?:\d+|[A-Za-z])\.)\s+/.test(line) ||
    /^>\s?/.test(text)
  );
}

export function workspaceRendererMarkdownContentLine(line: string) {
  return String(line || "")
    .replace(/\uFFFD/g, "")
    .replace(/[■□▪▫▁▂▃▄▅▆▇█▀▔]+/g, " ")
    .trimEnd();
}

export function workspaceRendererStripLineFrame(line: string) {
  return String(line || "")
    .replace(/\uFFFD/g, "")
    .replace(/[■□▪▫▁▂▃▄▅▆▇█▀▔]+/g, " ")
    .trim()
    .replace(/^[│┃|]\s?/, "")
    .replace(/\s?[│┃|]$/, "")
    .trim();
}

export function workspaceRendererNormalizeUserText(text: string) {
  return workspaceRendererCleanDisplayText(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function workspaceRendererComparableUserText(text: string) {
  return workspaceRendererNormalizeUserText(text)
    .replace(/\s+/g, " ")
    .trim();
}

export function workspaceRendererUserTextMatches(left: string, right: string) {
  const a = workspaceRendererComparableUserText(left);
  const b = workspaceRendererComparableUserText(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function workspaceRendererLineIsDisplayNoise(line: string, profile: WorkspaceRendererProfile) {
  const text = line.trim();
  if (!text) return false;
  const plain = workspaceRendererPlainLine(text);
  if (/^(?:MEODESK_|END_MEODESK_)/i.test(text)) return true;
  if (/^(?:workflow|node|inputPort|portContract|actualUserInput|contextJson|mode|cwd|model|session)\s*[:：]/i.test(text)) return true;
  if (profile === "hermes") {
    if (/^```/.test(text)) return false;
    if (/^\d{1,3}$/.test(plain)) return false;
    if (workspaceRendererLineLooksLikeChrome(text)) return true;
    if (/^Initializing agent/i.test(text)) return true;
    if (/New message detected,\s*interrupting/i.test(plain)) return true;
    if (/Sending\s+\d+\s+messages after interrupt/i.test(plain)) return true;
    if (/^msg\s*=/.test(text)) return true;
    if (/msg\s*=\s*interrupt|\/queue\b|\/bg\b|\/steer\b|ctrl\+c\s+cancel/i.test(plain)) return true;
    if (/^provider:\s*\w+/i.test(text)) return true;
    if (/^(?:✦\s*)?Tip:\s*/i.test(text)) return true;
    if (/saturate your keys\.?$/i.test(plain)) return true;
    if (/^(?:code execution|cronjob|delegation|file|image_gen|kanban|memory|messaging|session_search|skills|terminal|todo|tts|vision|web)\b/i.test(text) && text.includes(",")) return true;
    if (/^(?:data-science|devops|email|gaming|general|github|mcp|media|mlops|note-taking|productivity|red-teaming|research|self-archive|smart-home|social-media|software-development)\s*:/i.test(plain)) return true;
    if (/Welcome to Hermes Agent/i.test(text)) return true;
    if (/Hermes Agent\s+-\s+AI Agent Framework/i.test(text)) return true;
    if (/Hermes Agent v?\d/i.test(text)) return true;
    if (/\d+\s+tools\s+·\s+\d+\s+skills/i.test(text)) return true;
    if (/\d+\s+tools\s+.*toolsets:/i.test(text)) return true;
    if (/\/help for commands/i.test(text)) return true;
    if (/^[|│┃\s]*\$\s+\S+.*(?:\d+%|\d+s|\d+\/\d+[KMG]?|\d+\/1M|ctx)/i.test(text)) return true;
    if (/\bdeepseek[-\w]*\b/i.test(plain) && /(?:ctx|\d+\/\d+[KMG]?|\d+\/1M|\d+%|\d+s)/i.test(plain)) return true;
    if (/^\$\s+\S+.*│.*(?:\d+%|\d+s)/.test(text)) return true;
    if (/^\$\s+\S+.*(?:\d+%|\d+s)/.test(text)) return true;
    if (/^\$\s+\S+\s*(?:[|│┃·]\s*[^|│┃·]+){1,}$/i.test(text)) return true;
    if (/^[─━\-\s]*(?:Reasoning|Response|Thinking)[─━\-\s]*$/i.test(text)) return false;
    if (/browser[_-]cdp|browser_dialog|tool list/i.test(text)) return true;
    if (/^\([^)]{0,18}聊吧[？?]\)$/.test(text)) return true;
    if (/^(?:Reasoning|OK,\s+so\s+the\s+current\s+state\s+is:)/i.test(text)) return false;
    if (/\bread\s+\/(?:mnt|[A-Za-z]:)/i.test(text)) return true;
  }
  if (profile === "claude") {
    if (/正在启动\.\.\.$/.test(text)) return true;
    if (/^\? for shortcuts$/i.test(text)) return true;
    if (/(?:\? for shortcuts|← for agents|Auto-updating|\/effort|Claude Code)/i.test(text)) return true;
    if (/^[A-Za-z]:[\\/]/.test(workspaceRendererPlainLine(text))) return true;
    if (/^[■□▪▫▁▂▃▄▅▆▇█▀▔\s]+[A-Za-z]:[\\/]/.test(text)) return true;
    if (workspaceRendererLineIsClaudeThinkingStatus(text)) return true;
    if (workspaceRendererLineIsClaudeThinkingResidue(text)) return true;
  }
  return false;
}

export function workspaceRendererPlainLine(line: string) {
  return line
    .replace(/[╭╮╰╯┌┐└┘├┤┬┴┼│┃─━═╞╡╪+|`_[\]■□▁▂▃▄▅▆▇█▀▔¬]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function workspaceRendererClaudeActivityPlainLine(line: string) {
  return workspaceRendererPlainLine(line)
    .replace(/^[*✻✽✶✷✸✹✺✼✾✿❉❊❋✱✲✳✴✵✦✧●•]\s*/, "")
    .trim();
}

export function workspaceRendererCompactLine(line: string) {
  return workspaceRendererPlainLine(line)
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, "");
}

export function workspaceRendererClaudeThoughtLineText(line: string) {
  return workspaceRendererPlainLine(line)
    .replace(/^[⎿└┗┖╰╭╮╯╲╱\\|┃│\s]+/, "")
    .replace(/^\*\s*/, "")
    .trim();
}

export function workspaceRendererLineIsOverlayResidue(line: string, profile: WorkspaceRendererProfile = "other") {
  const text = String(line || "").trim();
  const plain = workspaceRendererPlainLine(text);
  if (!plain) return false;
  if (profile === "claude") {
    if (/^[▁▂▃▄▅▆▇█▀▔▌▐■□▪▫\s]{1,18}$/.test(text)) return true;
    if (/^[▁▂▃▄▅▆▇█▀▔▌▐■□▪▫\s]+[A-Za-z]:[\\/]/.test(text)) return true;
    if (/^[▁▂▃▄▅▆▇█▀▔▌▐■□▪▫\s]*[T┬┴┼─━═│┃|]{1,6}[▁▂▃▄▅▆▇█▀▔▌▐■□▪▫\s]*$/.test(text)) return true;
  }
  if (profile === "hermes") {
    if (/^[\u3400-\u9fff]$/.test(plain)) return true;
    if (/^[A-Za-z]$/.test(plain) && text.length <= 3) return true;
    if (/^[\u3400-\u9fff]{1,2}$/.test(plain) && /[│┃╎╏]/.test(text)) return true;
  }
  return false;
}

export function workspaceRendererLineIsClaudeRawThoughtContent(line: string) {
  const plain = workspaceRendererClaudeThoughtLineText(line);
  if (!plain) return false;
  if (/^(?:The user|User)\b/i.test(plain) && /\b(?:wants?|asked|said|means|testing|render|table|code|respond)\b/i.test(plain)) return true;
  if (/^The user is asking\b/i.test(plain)) return true;
  if (/^(?:I need|I should|I will|I'll|I'm going|I am going|Let me|We need)\b/i.test(plain) && /\b(?:check|respond|render|test|write|look|figure|need|should)\b/i.test(plain)) return true;
  if (/^(?:用户|这个用户|他们|她|他|Shizuku|对方)/.test(plain) && /(?:想|要|希望|让我|要求|测试|看看|渲染|表格|代码|输出|修|隐藏|展示)/.test(plain)) return true;
  if (/(?:用户|他们|她|他|Shizuku|对方).{0,18}(?:想|要|希望|让我|要求|测试|看看|渲染|表格|代码|输出)/.test(plain)) return true;
  return false;
}

export function workspaceRendererLineIsClaudeRawThoughtContinuation(line: string) {
  const plain = workspaceRendererClaudeThoughtLineText(line);
  if (!plain) return false;
  if (workspaceRendererLineIsClaudeRawThoughtContent(line)) return true;
  if (/^(?:output|generate|check|look|find|serve|actually|wait|re-reading|should|need|think)\b/i.test(plain)) return true;
  if (/\b(?:the user|they said|they want|don't need to read|don't read code|just output|random things|markdown text|code blocks|the project|context|meowviewer)\b/i.test(plain)) return true;
  if (/^(?:可以|应该|需要|先|然后|这里|这次|直接|不用|不要|要么|或者|看看|测试|输出|生成|修复|隐藏|展示)/.test(plain) && /(?:渲染|表格|代码|输出|思考|Meow\s*Viewer|meowviewer|用户|截图|问题|结果|能力)/i.test(plain)) return true;
  if (/(?:渲染能力|真实的数据|表格看起来|代码块|思考过程|用户想|用户要|让我|输出一些)/i.test(plain)) return true;
  return false;
}

export function workspaceRendererLineLooksLikeChrome(line: string) {
  const text = line.trim();
  if (!text) return true;
  const plain = workspaceRendererPlainLine(text);
  if (!plain) return true;
  if (plain.length <= 2) return true;
  if (!/[A-Za-z0-9\u3400-\u9fff]/.test(plain)) return true;
  return false;
}

export function workspaceRendererLineIsSeparator(line: string) {
  const text = line.trim();
  if (!text) return true;
  if (workspaceRendererLineIsMarkdownHr(text)) return false;
  if (!/[A-Za-z0-9\u3400-\u9fff]/.test(workspaceRendererPlainLine(text))) {
    return /^[\s╭╮╰╯┌┐└┘├┤┬┴┼│┃─━═╞╡╪+|`_\-—>›❯¬]+$/.test(text);
  }
  return /^[-─━═_—\s]{8,}$/.test(text);
}

export function workspaceRendererLineIsMarkdownHr(line: string) {
  return /^\s{0,3}(?:-{3}|\*{3}|_{3})\s*$/.test(String(line || ""));
}

export function workspaceRendererTableCells(line: string) {
  return line.trim().replace(/^[|│┃]/, "").replace(/[|│┃]$/, "").split(/[|│┃]/).map((cell) => cell.trim());
}

export function workspaceRendererLineIsTableBorder(line: string) {
  const text = line.trim();
  if (!text) return false;
  if (!/[|│┃╭╮╰╯┌┐└┘├┤┬┴┼─━═╞╡╪+\-]/.test(text)) return false;
  return !/[A-Za-z0-9\u3400-\u9fff]/.test(text.replace(/[|│┃╭╮╰╯┌┐└┘├┤┬┴┼─━═╞╡╪+\-\s]/g, ""));
}

export function workspaceRendererLineIsMarkdownTableSeparator(line: string) {
  const cells = workspaceRendererTableCells(line);
  if (cells.length < 2) return false;
  return cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s+/g, "")));
}

export function workspaceRendererLineIsAsciiTableLine(line: string) {
  const text = String(line || "").trimEnd();
  if (!text.trim()) return false;
  const verticalCellCount = text.split(/[│┃]/).length;
  if (workspaceRendererLineLooksLikeTreeEntry(line) && verticalCellCount < 3 && !/[┬┴┼┤┐┘╡╪]/.test(text)) return false;
  if (/[┌┬┐└┴┘├┼┤╭╮╰╯╞╡╪─━═]/.test(text)) return true;
  return /[│┃]/.test(text) && text.split(/[│┃]/).length >= 3;
}

function workspaceRendererLineHasAsciiTableCells(line: string) {
  const text = String(line || "").trimEnd();
  return /[│┃]/.test(text) && text.split(/[│┃]/).length >= 3;
}

export function workspaceRendererAsciiTableBorderBelongsToBlock(lines: string[], index: number) {
  const line = lines[index] || "";
  if (!workspaceRendererLineIsTableBorder(line) || !workspaceRendererLineIsAsciiTableLine(line)) return false;
  const previous = lines[index - 1] || "";
  const next = lines[index + 1] || "";
  return workspaceRendererLineHasAsciiTableCells(previous) || workspaceRendererLineHasAsciiTableCells(next);
}

export function workspaceRendererLineIsCodePipeExpression(line: string) {
  const text = String(line || "").trim();
  if (!text.includes("|")) return false;
  if (workspaceRendererLineIsMarkdownTableSeparator(text)) return false;
  if (/\|\|/.test(text)) return true;
  const content = workspaceRendererStripLineFrame(text);
  if (!content || !content.includes("|")) return false;
  if (/\b(?:map_err|map|filter|any|iter|ok_or|and_then)\s*\([^)]*\|/.test(content)) return true;
  if (/\|[_A-Za-z][^|]{0,80}\|/.test(content) && /(?:=>|->|::|[()[\];=<>])/.test(content)) return true;
  const tableCells = workspaceRendererTableCells(text);
  if (tableCells.length >= 3 && tableCells.filter(Boolean).length >= 2) return false;
  if (/\b(?:type|interface|enum|return|const|let|var|if|for|while|match|impl|fn|use)\b/.test(content)) return true;
  if (/\b(?:map_err|map|filter|any|iter|ok_or|and_then)\s*\(/.test(content)) return true;
  if (/(?:=>|->|::|\|\||&&|\?;|[{}()[\];=<>])/.test(content)) return true;
  return false;
}

export function workspaceRendererNormalizeTableLine(line: string) {
  const text = line.trim().replace(/[│┃]/g, "|");
  if (!text.includes("|")) return "";
  if (workspaceRendererLineIsAsciiTableLine(line)) return "";
  if (workspaceRendererLineIsCodePipeExpression(text)) return "";
  if (workspaceRendererLineIsMarkdownTableSeparator(text)) {
    return `| ${workspaceRendererTableCells(text).map((cell) => cell || "---").join(" | ")} |`;
  }
  if (workspaceRendererLineIsTableBorder(text)) return "";
  const cells = workspaceRendererTableCells(text)
    .map((cell) => workspaceRendererCleanDisplayText(cell));
  if (cells.length < 2 || !cells.some(Boolean)) return "";
  return `| ${cells.join(" | ")} |`;
}

export function workspaceRendererLineIsMarkdownTableRow(line: string) {
  return Boolean(workspaceRendererNormalizeTableLine(line));
}

export function workspaceRendererLineIsClaudeStartupNoise(line: string) {
  const text = line.trim();
  const plain = workspaceRendererPlainLine(text);
  const compact = workspaceRendererCompactLine(text);
  if (!plain) return true;
  if (workspaceRendererLineIsOverlayResidue(text, "claude")) return true;
  if (workspaceRendererLineLooksLikeChrome(text)) return true;
  if (/Claude Code\s+v?\d/i.test(plain) || compact.includes("claudecodev")) return true;
  if (/^Welcome back!?$/i.test(plain) || compact.includes("welcomeback")) return true;
  if (/Tips for getting started/i.test(plain) || compact.includes("tipsforgettingstarted") || compact.includes("tipsforgetting")) return true;
  if (/^Run \/init to create/i.test(plain) || compact.includes("runinittocreate")) return true;
  if (/^What's new$/i.test(plain) || compact.includes("whatsnew")) return true;
  if (/OTEL_RESOURCE_ATTR|claude agents|\/mcp|\/release-notes/i.test(plain)) return true;
  if (compact.includes("otelresourceattr") || compact.includes("claudeagents") || compact.includes("mcpnowcollapses") || compact.includes("releasenotes")) return true;
  if (/^Opus\s+\d/i.test(plain) || (compact.includes("opus") && compact.includes("context"))) return true;
  if (/^API Usage Billing$/i.test(plain) || compact.includes("apiusagebilling")) return true;
  if (/^[A-Za-z]:[\\/].*/.test(plain)) return true;
  if (/[A-Za-z]:[\\/]/.test(plain) && compact.includes("meowdesk")) return true;
  if (/(?:\? for shortcuts|for agents|Auto-updating|\/effort|xhigh)/i.test(plain)) return true;
  if (compact.includes("forshortcuts") || compact.includes("foragents") || compact.includes("autoupdating") || compact.includes("effort") || compact.includes("xhigh")) return true;
  if (/^[>›❯]\s*$/.test(plain)) return true;
  return false;
}

export function workspaceRendererLineIsClaudeRuntimeNoise(line: string) {
  const text = line.trim();
  const plain = workspaceRendererPlainLine(text);
  const compact = workspaceRendererCompactLine(text);
  if (!plain) return true;
  if (workspaceRendererLineIsOverlayResidue(text, "claude")) return true;
  if (workspaceRendererLineIsSeparator(text)) return true;
  if (/^[>›❯]\s*$/.test(text)) return true;
  if (/^(?:esc\s+to\s+interrupt|press\s+esc\s+to\s+interrupt)$/i.test(plain)) return true;
  if (/^Bootstrapping\b/i.test(plain)) return true;
  if (/^Reading\s+\d+\s+files?\b/i.test(plain)) return true;
  if (/^reading\d+files?/.test(compact)) return true;
  if (/(?:\? for shortcuts|for agents|Auto-updating|\/effort|xhigh)/i.test(plain)) return true;
  if (/(?:accept edits|esc to interrupt|shift\+tab to cycle)/i.test(plain)) return true;
  if (compact.includes("forshortcuts") || compact.includes("foragents") || compact.includes("autoupdating") || compact.includes("effort")) return true;
  if (/^[A-Za-z]:[\\/][^\n]+$/.test(plain)) return true;
  if (/^[■□▪▫\s]+[A-Za-z]:[\\/]/.test(text)) return true;
  if (/^(?:Reading|Read|Searching|Searched|Edited|Opened|Loaded)\b.*(?:file|files|pattern|patterns)/i.test(plain)) return true;
  if (/^(?:Bash|Glob|Grep|Read|Edit|Write|LS)\b/i.test(plain) && /\b(?:file|command|pattern|path)\b/i.test(plain)) return true;
  return false;
}

export function workspaceRendererLineIsClaudeTransientToolStatus(line: string) {
  const plain = workspaceRendererPlainLine(line);
  const compact = workspaceRendererCompactLine(line);
  if (/^Reading\s+\d+\s+files?\b/i.test(plain)) return true;
  if (/^reading\d+files?/.test(compact)) return true;
  if (compact.startsWith("reading") && compact.includes("ctrlo") && compact.includes("expand")) return true;
  return false;
}

function workspaceRendererClaudeToolPlainLine(line: string) {
  return workspaceRendererStripLineFrame(line)
    .replace(/^[●•]\s*/, "")
    .trim();
}

export function workspaceRendererLineIsClaudeToolBlockStart(line: string) {
  const plain = workspaceRendererClaudeToolPlainLine(line);
  if (/^(?:Read|Write|Edit|MultiEdit|Update|Create|Delete|Bash|Grep|Glob|LS)\s*\([^)]*\)$/i.test(plain)) return true;
  if (/^(?:Create|Update|Edit|Delete|Read|Write)\s+file\b/.test(plain)) return true;
  if (/^(?:Wrote|Modified|Edited|Created|Updated|Deleted)\s+.+/i.test(plain)) return true;
  if (/^(?:Read|Write|Edit|MultiEdit|Update|Create|Delete|Bash|Grep|Glob|LS)\s+.+/.test(plain) && !/^Reading\b/.test(plain)) return true;
  return false;
}

export function workspaceRendererClaudeToolBlockIsDiffPreview(line: string) {
  const plain = workspaceRendererClaudeToolPlainLine(line);
  return /^(?:Edit|MultiEdit|Update)\s*\([^)]*\)$/i.test(plain);
}

export function workspaceRendererToolMarker(tone: WorkspaceRendererToolTone, label: string, detail: string) {
  const safeLabel = workspaceRendererCleanDisplayText(label).replace(/[\t\n]/g, " ").trim();
  const safeDetail = workspaceRendererCleanDisplayText(detail).replace(/[\t\n]/g, " ").trim();
  return `::meow-viewer-tool\t${tone}\t${safeLabel || "状态"}\t${safeDetail}`;
}

export function workspaceRendererToolStatusFromMarker(line: string): { tone: WorkspaceRendererToolTone; label: string; detail: string } | null {
  const match = line.trim().match(/^::meow-viewer-tool\t(read|write|edit|run|info)\t([^\t]*)\t(.*)$/);
  if (!match) return null;
  return {
    tone: match[1] as WorkspaceRendererToolTone,
    label: match[2].trim() || "状态",
    detail: match[3].trim()
  };
}

export function workspaceRendererClaudeToolStatus(line: string) {
  const text = line.trim();
  const plain = workspaceRendererClaudeToolPlainLine(line);
  const rawCall = text.match(/^(Read|Write|Edit|MultiEdit|Update|Create|Delete|Bash|Grep|Glob|LS)\s*\(([^)]*)\)$/i);
  const rawFileAction = text.match(/^(Create|Update|Edit|Delete|Read|Write)\s+file\s+(.+)$/i);
  const rawLooseAction = text.match(/^(Read|Write|Edit|MultiEdit|Update|Create|Delete|Bash|Grep|Glob|LS)\s+(.+)$/i);
  const rawPastAction = text.match(/^(Wrote|Modified|Edited|Created|Updated|Deleted)\s+(.+)$/i);
  const call = rawCall || plain.match(/^(Read|Write|Edit|MultiEdit|Update|Create|Delete|Bash|Grep|Glob|LS)\s*\(([^)]*)\)$/i);
  const fileAction = rawFileAction || plain.match(/^(Create|Update|Edit|Delete|Read|Write)\s+file\s+(.+)$/i);
  const looseAction = rawLooseAction || plain.match(/^(Read|Write|Edit|MultiEdit|Update|Create|Delete|Bash|Grep|Glob|LS)\s+(.+)$/i);
  const pastAction = rawPastAction || plain.match(/^(Wrote|Modified|Edited|Created|Updated|Deleted)\s+(.+)$/i);
  const action = (call?.[1] || fileAction?.[1] || looseAction?.[1] || pastAction?.[1] || "").toLowerCase();
  const target = (call?.[2] || fileAction?.[2] || looseAction?.[2] || pastAction?.[2] || "").trim();
  if (!action) return null;
  if (action === "read" || action === "grep" || action === "glob" || action === "ls") {
    return { tone: "read" as const, label: action === "read" ? "读取" : "检索", detail: target };
  }
  if (action === "write" || action === "create" || action === "wrote" || action === "created") {
    return { tone: "write" as const, label: action === "create" || action === "created" ? "创建" : "写入", detail: target };
  }
  if (action === "edit" || action === "multiedit" || action === "update" || action === "delete" || action === "modified" || action === "edited" || action === "updated" || action === "deleted") {
    return { tone: "edit" as const, label: action === "delete" || action === "deleted" ? "删除" : "修改", detail: target };
  }
  if (action === "bash") return { tone: "run" as const, label: "执行", detail: target };
  return { tone: "info" as const, label: "状态", detail: target };
}

export function workspaceRendererClaudePreviewDiffLine(line: string) {
  const text = line.trim();
  if (!text) return "";
  if (/^(?:Added|Removed|Updated|No output|\.\.\s+\+\d+\s+line)\b/i.test(workspaceRendererPlainLine(text))) return "";
  const numbered = text.match(/^\s*\d+\s+([+-].+)$/);
  if (numbered?.[1]) return numbered[1].trim();
  const hunk = text.match(/(@@\s.*)$/);
  if (hunk?.[1]) return hunk[1].trim();
  if (workspaceRendererLineIsDiffLike(text)) return text;
  return "";
}

export function workspaceRendererLineIsClaudePermissionQuestion(line: string) {
  const plain = workspaceRendererPlainLine(line);
  return /^Do you want to\b/i.test(plain) || /是否(?:允许|授权|创建|修改|写入|删除)/.test(plain);
}

export function workspaceRendererLineIsClaudePermissionOption(line: string) {
  const plain = workspaceRendererPlainLine(line);
  if (/^(?:[›>▸❯]\s*)?[123]\.?\s*(?:Yes|No|Allow|是|否|允许|拒绝)\b/i.test(plain)) return true;
  if (/^(?:[›>▸❯]\s*)?(?:Yes|No)\b/i.test(plain)) return true;
  if (/^[123]$/.test(plain)) return true;
  return false;
}

export function workspaceRendererLineIsClaudePermissionFooter(line: string) {
  const plain = workspaceRendererPlainLine(line);
  return /^(?:Esc to cancel|Tab to amend)\b/i.test(plain) || /\bEsc to cancel\b/i.test(plain);
}

function workspaceRendererClaudeInteractiveMenuOption(line: string): { value: string; label: string } | null {
  const plain = workspaceRendererPlainLine(line);
  const match = plain.match(/^(?:[›>▸❯]\s*)?(\d{1,2})[.)]\s+(.+)$/);
  if (!match?.[1]) return null;
  const label = workspaceRendererCleanDisplayText(match[2] || "")
    .replace(/\s+/g, " ")
    .replace(/[.。]\s*$/, "")
    .trim();
  return {
    value: match[1],
    label: label || `选项 ${match[1]}`
  };
}

export function workspaceRendererLineIsClaudeInteractiveMenuOption(line: string) {
  return Boolean(workspaceRendererClaudeInteractiveMenuOption(line));
}

export function workspaceRendererLineIsClaudeInteractiveMenuFooter(line: string) {
  const plain = workspaceRendererPlainLine(line);
  return /\bEnter to select\b/i.test(plain) && (/\b(?:navigate|Esc to cancel|cancel)\b/i.test(plain) || /[↑↓]/.test(line));
}

function workspaceRendererLineIsClaudeInteractiveMenuAddon(line: string) {
  const plain = workspaceRendererPlainLine(line);
  return /^Notes?:\s*press\b/i.test(plain) || /^Chat about this\.?$/i.test(plain);
}

function workspaceRendererLineIsClaudeInteractiveMenuContinuation(line: string) {
  const text = String(line || "");
  const plain = workspaceRendererPlainLine(text);
  if (!plain || workspaceRendererLineIsSeparator(text)) return true;
  if (
    workspaceRendererLineIsClaudeInteractiveMenuOption(text)
    || workspaceRendererLineIsClaudeInteractiveMenuFooter(text)
    || workspaceRendererLineIsClaudeInteractiveMenuAddon(text)
    || workspaceRendererLineIsClaudeInteractiveQuestionTool(text)
    || workspaceRendererLineIsClaudePermissionQuestion(text)
  ) return false;
  return /^\s{2,}\S/.test(text);
}

export function workspaceRendererLineIsClaudeInteractiveQuestionTool(line: string) {
  return /AskUserQuestion|ask[_-]?user[_-]?question/i.test(workspaceRendererPlainLine(line));
}

type WorkspaceRendererClaudeInteractiveMenuPrompt = {
  startIndex: number;
  questionIndex: number;
  firstOptionIndex: number;
  footerIndex: number;
  detail: string;
  choices: WorkspaceRendererPermissionPrompt["choices"];
};

function workspaceRendererTrailingLinesHaveContent(lines: string[], startIndex: number) {
  return lines.slice(startIndex).some((line) => {
    const text = String(line || "");
    return !workspaceRendererLineIsSeparator(text) && !/^[›>▸]?\s*$/.test(text);
  });
}

function workspaceRendererInteractiveMenuDetail(lines: string[], startIndex: number, questionIndex: number) {
  const question = workspaceRendererCleanDisplayText(lines[questionIndex] || "");
  const contextLines = lines
    .slice(startIndex, questionIndex)
    .map((line) => {
      if (workspaceRendererLineIsClaudeInteractiveQuestionTool(line)) return "";
      const option = workspaceRendererClaudeInteractiveMenuOption(line);
      return option?.label || workspaceRendererCleanDisplayText(line);
    })
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const context = contextLines.join(" ").replace(/\s+/g, " ").trim();
  const questionDetail = /AskUserQuestion/i.test(question) ? "" : question;
  return [questionDetail, context].filter(Boolean).join(" ").slice(0, 420) || "Claude 正在等待选择。";
}

function workspaceRendererFindClaudeInteractiveMenuPrompt(
  lines: string[],
  options: { containsIndex?: number; requireActive?: boolean } = {}
): WorkspaceRendererClaudeInteractiveMenuPrompt | null {
  for (let footerIndex = lines.length - 1; footerIndex >= 0; footerIndex -= 1) {
    if (!workspaceRendererLineIsClaudeInteractiveMenuFooter(lines[footerIndex])) continue;
    const trailingHasContent = workspaceRendererTrailingLinesHaveContent(lines, footerIndex + 1);
    if (options.requireActive && trailingHasContent) return null;

    const searchStart = Math.max(0, footerIndex - 44);
    let optionBlockEnd = footerIndex - 1;
    while (optionBlockEnd >= searchStart) {
      const line = lines[optionBlockEnd] || "";
      if (workspaceRendererLineIsSeparator(line) || !workspaceRendererCleanDisplayText(line) || workspaceRendererLineIsClaudeInteractiveMenuAddon(line)) {
        optionBlockEnd -= 1;
        continue;
      }
      break;
    }
    if (optionBlockEnd <= searchStart) continue;

    let lastOptionIndex = -1;
    for (let index = optionBlockEnd; index >= searchStart; index -= 1) {
      if (workspaceRendererLineIsClaudeInteractiveMenuOption(lines[index])) {
        lastOptionIndex = index;
        break;
      }
      if (!workspaceRendererLineIsClaudeInteractiveMenuContinuation(lines[index])) break;
    }
    if (lastOptionIndex <= searchStart) continue;

    let firstOptionIndex = lastOptionIndex;
    for (let index = lastOptionIndex - 1; index >= searchStart; index -= 1) {
      const line = lines[index] || "";
      if (workspaceRendererLineIsClaudeInteractiveMenuOption(line)) {
        firstOptionIndex = index;
        continue;
      }
      if (workspaceRendererLineIsClaudeInteractiveMenuContinuation(line)) continue;
      break;
    }

    let questionIndex = firstOptionIndex - 1;
    while (
      questionIndex >= searchStart
      && (workspaceRendererLineIsSeparator(lines[questionIndex]) || !workspaceRendererCleanDisplayText(lines[questionIndex]))
    ) {
      questionIndex -= 1;
    }
    if (questionIndex < searchStart) continue;

    const choices: WorkspaceRendererPermissionPrompt["choices"] = [];
    let valid = true;
    for (let index = firstOptionIndex; index <= optionBlockEnd; index += 1) {
      const option = workspaceRendererClaudeInteractiveMenuOption(lines[index]);
      if (option) {
        choices.push({
          label: option.label,
          value: option.value,
          tone: choices.length === 0 ? "primary" : "outline"
        });
        continue;
      }
      if (workspaceRendererLineIsClaudeInteractiveMenuContinuation(lines[index])) continue;
      valid = false;
      break;
    }
    if (!valid || choices.length < 2) continue;

    let startIndex = questionIndex;
    for (let index = questionIndex - 1; index >= searchStart; index -= 1) {
      const line = lines[index] || "";
      const clean = workspaceRendererCleanDisplayText(line);
      if (!clean || workspaceRendererLineIsSeparator(line)) {
        startIndex = index;
        continue;
      }
      if (
        workspaceRendererLineIsClaudeInteractiveQuestionTool(line)
        || workspaceRendererLineIsClaudeInteractiveMenuOption(line)
        || /权限|授权|请求|permission|approval/i.test(clean)
        || /[:：]$/.test(clean)
        || /^\[.+\]$/.test(clean)
      ) {
        startIndex = index;
        continue;
      }
      break;
    }

    if (
      options.containsIndex !== undefined
      && (options.containsIndex < startIndex || options.containsIndex > questionIndex)
    ) {
      continue;
    }

    return {
      startIndex,
      questionIndex,
      firstOptionIndex,
      footerIndex,
      detail: workspaceRendererInteractiveMenuDetail(lines, startIndex, questionIndex),
      choices
    };
  }
  return null;
}

export function workspaceRendererLineStartsClaudeInteractiveMenu(lines: string[], index: number) {
  const prompt = workspaceRendererFindClaudeInteractiveMenuPrompt(lines, { containsIndex: index });
  return Boolean(prompt && index >= prompt.startIndex && index <= prompt.questionIndex);
}

export function workspaceRendererLineIsClaudePermissionOptionContinuation(line: string) {
  const plain = workspaceRendererPlainLine(line);
  if (!plain) return true;
  if (
    workspaceRendererLineIsClaudePermissionOption(plain)
    || workspaceRendererLineIsClaudePermissionFooter(plain)
    || workspaceRendererLineIsClaudeInteractiveMenuOption(plain)
    || workspaceRendererLineIsClaudeInteractiveMenuFooter(plain)
    || workspaceRendererLineIsClaudeInteractiveMenuAddon(plain)
  ) return false;
  if (workspaceRendererLineIsClaudePermissionQuestion(plain)) return false;
  if (/^(?:Thought|Thinking)\b/i.test(plain)) return false;
  if (/^(?:PowerShell|Bash|Shell|Command)\s+(?:command|result)\b/i.test(plain)) return false;
  if (/^(?:User rejected|Request interrupted|Tool use|MEODESK_)/i.test(plain)) return false;
  if (/^[●•]\s+/.test(line.trim())) return false;
  return true;
}

export function workspaceRendererLineIsClaudeToolPreviewLine(line: string) {
  const text = line.trim();
  const plain = workspaceRendererPlainLine(text);
  if (!plain) return true;
  if (workspaceRendererLineIsSeparator(text)) return true;
  if (/^\d+\s/.test(plain)) return true;
  if (/^[+\-]\s/.test(plain)) return true;
  if (workspaceRendererLineIsMarkdownTableRow(text)) return true;
  return false;
}

export function workspaceRendererLineIsClaudeThinking(line: string) {
  if (workspaceRendererLineIsClaudeThinkingStatus(line)) return true;
  const text = line.trim();
  if (/^[⎿└]\s+/.test(text)) return true;
  return false;
}

export function workspaceRendererLineIsClaudeThinkingStatus(line: string) {
  const plain = workspaceRendererClaudeActivityPlainLine(line.trim());
  if (!plain) return false;
  if (/^(?:Thinking|Thought) for \d/i.test(plain)) return true;
  if (/\bctrl\+o to expand\b/i.test(plain)) return true;
  if (/tokens?.*(?:thought|thinking)/i.test(plain)) return true;
  if (/^(?:Finagling|Cooked|Churned|Forming|Saut[ée]ed|Sautéed|Sauteed|Baked|Brewed)\b/i.test(plain)) return true;
  if (/^Bootstrapping\b/i.test(plain)) return true;
  return false;
}

export function workspaceRendererLineIsClaudeThinkingResidue(line: string) {
  const plain = workspaceRendererPlainLine(line);
  if (!/thinking/i.test(plain)) return false;
  const withoutThinking = plain.replace(/thinking/ig, "").replace(/[0-9a-f:().,+\-\s]/gi, "");
  return withoutThinking.length <= 2 || /^[a-z]{0,14}$/i.test(withoutThinking);
}

export function workspaceRendererClaudeThinkingSummary(plain: string) {
  const normalized = workspaceRendererClaudeActivityPlainLine(plain);
  const seconds = normalized.match(/\b(?:Thinking|Thought|Cooked|Churned|Forming|Saut[ée]ed|Sautéed|Sauteed|Baked|Brewed)\s+for\s+(\d+)\s*s/i);
  if (seconds) return `约 ${seconds[1]}s`;
  if (/Finagling|Forming/i.test(normalized)) return "进行中";
  return "已折叠";
}

export function workspaceRendererPushStatus(
  items: WorkspaceRendererStatusItem[],
  label: string,
  value: string,
  tone: WorkspaceRendererStatusTone = "info"
) {
  const cleanLabel = workspaceRendererCleanDisplayText(label).replace(/\s+/g, " ").trim();
  const cleanValue = workspaceRendererCleanDisplayText(value).replace(/\s+/g, " ").trim();
  if (!cleanLabel || !cleanValue) return;
  const existingIndex = items.findIndex((item) => item.label === cleanLabel);
  const nextItem = { label: cleanLabel, value: cleanValue, tone };
  if (existingIndex >= 0) {
    items[existingIndex] = nextItem;
    return;
  }
  items.push(nextItem);
}

export function workspaceRendererSplitStatusParts(line: string) {
  return String(line || "")
    .replace(/[│┃]/g, "|")
    .split(/[|·]/g)
    .map((part) => workspaceRendererCleanDisplayText(part))
    .filter(Boolean);
}

export function workspaceRendererExtractStatus(raw: string, profile: WorkspaceRendererProfile): WorkspaceRendererStatusItem[] {
  const lines = workspaceRendererStripTerminalControls(raw)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const items: WorkspaceRendererStatusItem[] = [];

  for (const line of lines) {
    const plain = workspaceRendererPlainLine(line);
    if (!plain) continue;

    if (profile === "hermes") {
      if (/^Initializing agent/i.test(plain)) {
        workspaceRendererPushStatus(items, "阶段", "初始化", "info");
        continue;
      }
      if (/绞尽脑汁|thinking|working/i.test(plain) && /[()（）]/.test(line)) {
        workspaceRendererPushStatus(items, "思考", /绞尽脑汁/.test(plain) ? "绞尽脑汁" : "进行中", "thinking");
        continue;
      }
      if (/^[─━\-\s]*Reasoning[─━\-\s]*$/i.test(line) || /^Reasoning$/i.test(plain)) {
        workspaceRendererPushStatus(items, "阶段", "思考中", "thinking");
        continue;
      }
      const statusMatch = line.replace(/[│┃]/g, "|").match(/^\$\s*(.+)$/);
      if (statusMatch?.[1]) {
        const parts = workspaceRendererSplitStatusParts(statusMatch[1]);
        const hasContextPart = parts.some((part) => /\b(?:ctx|context)\b/i.test(part) || /\d+(?:\.\d+)?[KMG]?\/\d+[KMG]?/i.test(part));
        if (parts.length < 2 || !hasContextPart) continue;
        if (parts[0]) workspaceRendererPushStatus(items, "模型", parts[0], "model");
        if (parts[1]) workspaceRendererPushStatus(items, "上下文", parts[1], "context");
        if (parts[2] && /%$/.test(parts[2])) workspaceRendererPushStatus(items, "占用", parts[2], "context");
        if (parts[3] && /\d/.test(parts[3])) workspaceRendererPushStatus(items, "耗时", parts[3], "info");
        if (parts[4] && /\d/.test(parts[4])) workspaceRendererPushStatus(items, "思考", parts[4], "thinking");
        continue;
      }
    }

    if (profile === "claude") {
      if (workspaceRendererLineIsClaudeThinkingStatus(line)) {
        workspaceRendererPushStatus(items, "思考", workspaceRendererClaudeThinkingSummary(plain), "thinking");
        continue;
      }
      const effort = plain.match(/\b(xhigh|high|medium|low)\b.*\/effort/i);
      if (effort?.[1]) {
        workspaceRendererPushStatus(items, "强度", effort[1], "info");
        continue;
      }
      const modelMatch = plain.match(/\b(?:Opus|Sonnet|Haiku)\s+[0-9][^|]*/i);
      if (modelMatch?.[0]) {
        const modelLabel = modelMatch[0]
          .replace(/API\s*Usage\s*Billing.*$/i, "API Usage Billing")
          .replace(/\s+/g, " ")
          .trim();
        workspaceRendererPushStatus(items, "模型", modelLabel, "model");
      }
    }
  }

  return items.slice(0, 6);
}

export function workspaceRendererCleanClaudeOutputLines(lines: string[]) {
  let startupBudget = 0;
  const output: string[] = [];

  for (const line of lines) {
    const text = line.trim();
    const plain = workspaceRendererPlainLine(text);
    const compact = workspaceRendererCompactLine(text);
    const isStartupMarker = /Claude Code\s+v?\d/i.test(plain) || compact.includes("claudecodev") || /^Welcome back!?$/i.test(plain) || compact.includes("welcomeback");
    if (isStartupMarker) {
      startupBudget = 90;
      continue;
    }
    if (startupBudget > 0 && workspaceRendererLineIsClaudeStartupNoise(line)) {
      startupBudget -= 1;
      continue;
    }
    if (workspaceRendererLineIsDisplayNoise(line, "claude")) continue;
    startupBudget = 0;
    output.push(line);
  }

  return output;
}

export function workspaceRendererClaudeStartupSegment(raw: string): WorkspaceRenderedSegment | null {
  const lines = workspaceRendererStripTerminalControls(raw)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let version = "";
  let model = "";
  let cwd = "";

  for (const line of lines) {
    const plain = workspaceRendererPlainLine(line);
    const compact = workspaceRendererCompactLine(line);
    if (!version) {
      const versionMatch = plain.match(/Claude\s*Code\s*v?\s*([0-9][\w.-]*)/i) || compact.match(/claudecodev?([0-9][0-9.]*)/i);
      if (versionMatch?.[1]) version = versionMatch[1];
    }
    if (!model && (/Opus|Sonnet|Haiku/i.test(plain) || /\bcontext\b/i.test(plain) || compact.includes("context"))) {
      const modelText = plain.match(/(?:Opus|Sonnet|Haiku)[^|]*/i)?.[0] || plain;
      model = modelText
        .replace(/API\s*Usage\s*Billing.*$/i, "")
        .replace(/APIUsageBilling.*$/i, "")
        .replace(/\/mcp.*$/i, "")
        .replace(/^.*?(?=(?:Opus|Sonnet|Haiku))/i, "")
        .replace(/[·|.\s]+$/g, "")
        .trim();
    }
    if (!cwd) {
      const cwdMatch = plain.match(/[A-Za-z]:[\\/][^\s|]+(?:[\\/][^\s|]+)*/);
      if (cwdMatch?.[0]) cwd = cwdMatch[0];
    }
  }

  if (!version && !model && !cwd) return null;
  const parts = [
    "Claude Code 已启动",
    version ? `版本 ${version}` : "",
    model ? `模型 ${model}` : "",
    cwd ? `目录 ${cwd}` : ""
  ].filter(Boolean);
  return { kind: "startup", text: parts.join("\n"), summary: "Claude Code" };
}

export function workspaceRendererSegmentIsClaudeStartupResidue(segment: WorkspaceRenderedSegment) {
  if (segment.kind !== "assistant") return false;
  const lines = segment.text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return true;
  return lines.every((line) => {
    const readable = workspaceRendererCleanDisplayText(line);
    if (/^\d{1,3}$/.test(readable)) return false;
    return workspaceRendererLineIsClaudeStartupNoise(line) || workspaceRendererLineIsOverlayResidue(line, "claude");
  });
}

export function workspaceRendererHermesLineIsStartupMarker(line: string) {
  const text = line.trim();
  const plain = workspaceRendererPlainLine(text);
  if (/Welcome to Hermes Agent/i.test(plain)) return true;
  if (/Hermes Agent\s+-\s+AI Agent Framework/i.test(plain)) return true;
  if (/^\s*deepseek[-\w]*\b/i.test(plain) && /Nous Research|Session|\/mnt\//i.test(plain)) return true;
  return false;
}

export function workspaceRendererHermesLineMayStartContent(line: string) {
  const text = line.trim();
  if (!text) return false;
  if (/^[›>▸]\s+\S/.test(text)) return true;
  if (workspaceRendererLineIsHermesAssistantMarker(text)) return true;
  if (workspaceRendererNormalizeTableLine(text)) return true;
  if (/^```/.test(text) || workspaceRendererHeadingLevel(text) || /^>\s?/.test(text)) return true;
  if (/^\s*(?:[-*]|\d+\.)\s+/.test(text)) return true;
  if (workspaceRendererCallout(text)) return true;
  if (/[\u3400-\u9fff]/.test(text) && /[。！？；：?]$/.test(text) && !workspaceRendererLineIsDisplayNoise(text, "hermes")) return true;
  return false;
}

export function workspaceRendererCleanHermesOutputLines(lines: string[]) {
  let startupBudget = 0;
  const output: string[] = [];

  for (const line of lines) {
    const text = line.trim();
    if (workspaceRendererLineIsOverlayResidue(text, "hermes")) continue;
    if (workspaceRendererHermesLineIsStartupMarker(text)) {
      startupBudget = 140;
      continue;
    }
    if (startupBudget > 0) {
      if (workspaceRendererLineIsHermesReasoning(text) || workspaceRendererLineIsHermesResponseMarker(text)) {
        startupBudget = 0;
      } else {
        if (!text || workspaceRendererLineIsDisplayNoise(text, "hermes") || workspaceRendererLineIsTableBorder(text) || workspaceRendererLineIsSeparator(text)) {
          startupBudget -= 1;
          continue;
        }
        if (!workspaceRendererHermesLineMayStartContent(text)) {
          startupBudget -= 1;
          continue;
        }
        startupBudget = 0;
      }
    }
    if (workspaceRendererLineIsDisplayNoise(line, "hermes")) continue;
    output.push(line);
  }

  return output;
}

export function workspaceRendererPushSegment(segments: WorkspaceRenderedSegment[], kind: WorkspaceRenderedSegmentKind, text: string, summary?: string) {
  const value = text.trim();
  if (!value) return;
  const last = segments[segments.length - 1];
  if (kind === "user" && last?.kind === "user" && workspaceRendererUserTextMatches(last.text, value)) {
    return;
  }
  if (kind === "thinking" && last?.kind === "thinking") {
    last.text = value;
    last.summary = summary || last.summary;
    return;
  }
  if (kind !== "user" && kind !== "assistant" && last && last.kind === kind && last.summary === summary) {
    last.text = `${last.text}\n${value}`.trim();
    return;
  }
  segments.push({ kind, text: value, summary });
}

export function workspaceRendererPushUnmatchedUserTurn(segments: WorkspaceRenderedSegment[], turn: WorkspaceTerminalUserTurn, now = Date.now()) {
  const value = turn.text.trim();
  if (!value) return;
  const stillPending = turn.source === "renderer" && now - turn.createdAt < 2500;
  if (stillPending) {
    workspaceRendererPushSegment(segments, "user", value);
    return;
  }
  if (turn.source === "renderer") {
    workspaceRendererPushSegment(segments, "user", value);
    return;
  }
  if (!segments.some((segment) => segment.kind === "assistant")) {
    workspaceRendererPushSegment(segments, "user", value);
    return;
  }
  const last = segments[segments.length - 1];
  if (last?.kind === "user" && workspaceRendererUserTextMatches(last.text, value)) return;
  workspaceRendererPushSegment(segments, "user", value);
}

export function workspaceRendererFindMatchingUserTurn(
  turns: WorkspaceTerminalUserTurn[],
  startIndex: number,
  text: string
) {
  for (let index = Math.max(0, startIndex); index < turns.length; index += 1) {
    const turn = turns[index];
    if (turn?.text && workspaceRendererUserTextMatches(text, turn.text)) {
      return { turn, index };
    }
  }
  return null;
}

export function workspaceRendererPromptContinuationMatches(promptText: string, nextLine: string, turn?: WorkspaceTerminalUserTurn) {
  const nextText = workspaceRendererNormalizeUserText(nextLine);
  if (!nextText) return false;
  if (/^(?:Thought|Thinking|Read|Write|Edit|Update|Create|Delete|Bash|Grep|Glob|LS)\b/i.test(workspaceRendererPlainLine(nextLine))) return false;
  if (turn?.text) {
    const turnComparable = workspaceRendererComparableUserText(turn.text);
    const promptComparable = workspaceRendererComparableUserText(promptText);
    const nextComparable = workspaceRendererComparableUserText(nextText);
    if (!turnComparable || !nextComparable) return false;
    if (promptComparable.length >= turnComparable.length && workspaceRendererUserTextMatches(promptText, turn.text)) return false;
    const joinedCompact = workspaceRendererComparableUserText(`${promptText}${nextText}`);
    const joinedLine = workspaceRendererComparableUserText(`${promptText}\n${nextText}`);
    if (joinedCompact && (turnComparable === joinedCompact || turnComparable.startsWith(joinedCompact))) return true;
    if (joinedLine && (turnComparable === joinedLine || turnComparable.startsWith(joinedLine))) return true;
    if (nextComparable && nextComparable.length <= 80 && turnComparable.includes(nextComparable)) return true;
    return false;
  }
  if (workspaceRendererLinePreservesMarkdownSyntax(nextLine) || workspaceRendererNormalizeTableLine(nextLine)) return false;
  if (workspaceRendererLineIsSeparator(nextLine) || workspaceRendererLineIsTableBorder(nextLine)) return false;
  if (/^[●•]\s*/.test(nextLine.trim())) return false;
  if (/^[，。、；：,.!?！？]/.test(nextText)) return true;
  if (promptText.length >= 18 && nextText.length <= 72 && /^[a-z0-9_`"'（(\u3400-\u9fff]/.test(nextText)) return true;
  return false;
}

export function workspaceRendererLineIsShellOutput(line: string) {
  const text = String(line || "").trim();
  if (!text) return false;
  if (/^\$\s+\S+/.test(text)) return true;
  if (/^>\s+(?:npm|pnpm|yarn|node|vite|vitest|tsc|eslint)\b/i.test(text)) return true;
  if (/^>\s+[@\w./-]+@[\w.-]+\s+\w[\w:-]*/.test(text)) return true;
  if (/^[✓✔]\s+\S+/.test(text)) return true;
  if (/^(?:Test Files|Tests|Duration)\b/i.test(text)) return true;
  return false;
}

export function workspaceRendererConsumePromptContinuation(
  lines: string[],
  lineIndex: number,
  promptText: string,
  turn?: WorkspaceTerminalUserTurn
) {
  let index = lineIndex;
  let merged = promptText;
  while (index + 1 < lines.length) {
    const next = lines[index + 1]?.trim() || "";
    if (!workspaceRendererPromptContinuationMatches(merged, next, turn)) break;
    merged = /^[，。、；：,.!?！？]/.test(workspaceRendererNormalizeUserText(next))
      ? `${merged}${workspaceRendererNormalizeUserText(next)}`
      : `${merged}\n${workspaceRendererNormalizeUserText(next)}`;
    index += 1;
  }
  return { text: turn?.text || merged, nextIndex: index };
}

export function workspaceRendererAppendAssistantLine(assistantLines: string[], line: string) {
  if (workspaceRendererLineIsAsciiTableLine(line)) {
    assistantLines.push(workspaceRendererMarkdownContentLine(line));
    return;
  }
  const normalizedTableLine = workspaceRendererNormalizeTableLine(line);
  if (normalizedTableLine) {
    assistantLines.push(normalizedTableLine);
    return;
  }
  const text = line.trim();
  const framedContent = workspaceRendererStripLineFrame(line);
  if (workspaceRendererLineIsMarkdownHr(text) || workspaceRendererLineIsMarkdownHr(framedContent)) {
    assistantLines.push("---");
    return;
  }
  if ((workspaceRendererLineIsTableBorder(text) || workspaceRendererLineIsSeparator(text)) && workspaceRendererLineLooksLikeCode(framedContent)) {
    assistantLines.push(framedContent);
    return;
  }
  if (workspaceRendererLineIsTableBorder(text) || workspaceRendererLineIsSeparator(text)) return;
  if (workspaceRendererLineLooksLikeTreeRoot(line) || workspaceRendererLineLooksLikeTreeEntry(line)) {
    assistantLines.push(workspaceRendererMarkdownContentLine(line).trim());
    return;
  }
  if (workspaceRendererLineLooksLikeCode(line)) {
    assistantLines.push(workspaceRendererMarkdownContentLine(line));
    return;
  }
  if (workspaceRendererLineIsDiffLike(text) || workspaceRendererLineIsDiffHunk(text)) {
    assistantLines.push(workspaceRendererMarkdownContentLine(line).trim());
    return;
  }
  if (workspaceRendererLinePreservesMarkdownSyntax(line)) {
    const markdownLine = workspaceRendererMarkdownContentLine(line).trim();
    if (markdownLine) assistantLines.push(markdownLine);
    return;
  }
  if (workspaceRendererLineIsShellOutput(line)) {
    assistantLines.push(workspaceRendererMarkdownContentLine(line).trim());
    return;
  }
  const readableLine = workspaceRendererCleanDisplayText(line);
  if (readableLine) assistantLines.push(readableLine);
}

export function workspaceRendererJoinCellPart(left: string, right: string) {
  const a = left.trim();
  const b = right.trim();
  if (!a) return b;
  if (!b) return a;
  const last = a[a.length - 1] || "";
  const first = b[0] || "";
  if (/[\u3400-\u9fff]/.test(last) && /[\u3400-\u9fff]/.test(first)) return `${a}${b}`;
  if (/[\u3400-\u9fff]$/.test(a) && /^[A-Z]{1,6}\b/.test(b)) return `${a}${b}`;
  if (/[\d-]$/.test(a) && /^[\d-]/.test(b)) return `${a}${b}`;
  if (/^[-–—]/.test(b)) return `${a}${b}`;
  if (/[A-Za-z]$/.test(a) && /^[A-Za-z]/.test(b)) return `${a}${b}`;
  return `${a} ${b}`.replace(/\s+([，。！？；：、,.!?;:])/g, "$1");
}

export function workspaceRendererMergeTableCells(base: string[], extra: string[]) {
  const width = Math.max(base.length, extra.length);
  const next = Array.from({ length: width }, (_, index) => base[index] || "");
  for (let index = 0; index < width; index += 1) {
    const value = extra[index] || "";
    if (!value) continue;
    next[index] = workspaceRendererJoinCellPart(next[index] || "", value);
  }
  return next;
}

export function workspaceRendererNormalizeTableCells(cells: string[], width: number) {
  const next = cells.slice(0, width);
  while (next.length < width) next.push("");
  return next;
}

export function workspaceRendererRightAlignTableCells(cells: string[], width: number) {
  const next = Array.from({ length: width }, () => "");
  const offset = Math.max(0, width - cells.length);
  cells.slice(0, width).forEach((cell, index) => {
    next[Math.min(width - 1, offset + index)] = cell;
  });
  return next;
}

export function workspaceRendererTableContinuationRow(cells: string[], width: number, previous?: string[]) {
  if (!previous?.length || !cells.length) return false;
  if (cells.length < width) return true;
  const normalized = workspaceRendererNormalizeTableCells(cells, width);
  const nonEmpty = normalized.filter(Boolean);
  if (!nonEmpty.length) return true;
  if (!normalized[0] && nonEmpty.length <= Math.max(2, Math.ceil(width / 2))) return true;
  if (normalized[0] && normalized[0].length <= 2 && nonEmpty.length < width) return true;
  if (nonEmpty.length === 1 && normalized.findIndex(Boolean) > 0) return true;
  return false;
}

export function workspaceRendererCellsLookLikeWrappedHeader(cells: string[], width: number) {
  const normalized = workspaceRendererNormalizeTableCells(cells, width);
  const nonEmpty = normalized.filter(Boolean);
  return Boolean(nonEmpty.length && nonEmpty.length <= Math.max(2, Math.ceil(width / 2)) && !normalized[0]);
}

const workspaceRendererFieldTableHeaders = [
  "模块",
  "状态",
  "负责人",
  "优先级",
  "风险",
  "输入",
  "输出",
  "验证方式",
  "回归标记",
  "备注"
] as const;

type WorkspaceRendererFieldTableHeader = (typeof workspaceRendererFieldTableHeaders)[number];

const workspaceRendererFieldTableHeaderPattern = /(^|\s)(模块|状态|负责人|优先级|风险|输入|输出|验证方式|回归标记|备注)[:：]\s*/g;

export function workspaceRendererEscapeTableCell(value: string) {
  return String(value || "")
    .replace(/\s*[*✻✽✶✷✸✹✺✼✾✿❉❊❋✱✲✳✴✵✦✧●•]?\s*(?:Baked|Brewed|Cooked|Churned|Sautéed|Sauteed)\s+for\s+\d+s\s*$/i, "")
    .replace(/\|/g, "\\|")
    .trim();
}

export function workspaceRendererFieldTableParts(line: string) {
  const text = workspaceRendererCleanDisplayText(line);
  const matches = Array.from(text.matchAll(workspaceRendererFieldTableHeaderPattern));
  if (!matches.length) return [];
  return matches.map((match, index) => {
    const next = matches[index + 1];
    const valueStart = (match.index || 0) + match[0].length;
    const valueEnd = next?.index ?? text.length;
    return {
      label: match[2] as WorkspaceRendererFieldTableHeader,
      value: workspaceRendererEscapeTableCell(text.slice(valueStart, valueEnd))
    };
  });
}

export function workspaceRendererRebuildFieldTableLines(lines: string[]) {
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const rows: Array<Partial<Record<WorkspaceRendererFieldTableHeader, string>>> = [];
    const labels = new Set<WorkspaceRendererFieldTableHeader>();
    let current: Partial<Record<WorkspaceRendererFieldTableHeader, string>> | null = null;
    let scan = index;

    while (scan < lines.length) {
      const line = lines[scan] || "";
      if (!line.trim()) break;
      if (workspaceRendererLineIsMarkdownHr(line) || workspaceRendererLineIsTableBorder(line) || workspaceRendererLineIsSeparator(line)) {
        if (current || rows.length) {
          scan += 1;
          continue;
        }
        break;
      }
      if (workspaceRendererNormalizeTableLine(line) || workspaceRendererHeadingLevel(line)) break;
      const parts = workspaceRendererFieldTableParts(line);
      if (!parts.length) break;

      for (const part of parts) {
        if (part.label === "模块" && current && Object.keys(current).length >= 3) {
          rows.push(current);
          current = {};
        }
        if (!current) current = {};
        labels.add(part.label);
        current[part.label] = workspaceRendererJoinCellPart(current[part.label] || "", part.value);
      }
      scan += 1;
    }

    if (current && Object.keys(current).length >= 3) rows.push(current);

    const headers = workspaceRendererFieldTableHeaders.filter((header) => labels.has(header));
    const shouldRebuild = rows.length >= 1
      && headers.length >= 6
      && labels.has("模块")
      && rows.every((row) => Boolean(row["模块"]));

    if (!shouldRebuild) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    output.push(`| ${headers.join(" | ")} |`);
    output.push(`| ${headers.map(() => "---").join(" | ")} |`);
    rows.forEach((row) => {
      output.push(`| ${headers.map((header) => row[header] || "").join(" | ")} |`);
    });
    index = scan;
  }

  return output;
}

export function workspaceRendererRebuildMarkdownTableLines(lines: string[]) {
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const headerLine = workspaceRendererNormalizeTableLine(lines[index] || "");
    if (!headerLine) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    let scan = index + 1;
    const headerCells = workspaceRendererCells(headerLine);
    const headerContinuations: string[][] = [];

    while (scan < lines.length) {
      const nextLine = lines[scan] || "";
      if (!nextLine.trim() || workspaceRendererLineIsTableBorder(nextLine)) break;
      const normalized = workspaceRendererNormalizeTableLine(nextLine);
      if (!normalized || workspaceRendererLineIsMarkdownTableSeparator(normalized)) break;
      headerContinuations.push(workspaceRendererCells(normalized));
      scan += 1;
    }

    const sepNormalized = workspaceRendererNormalizeTableLine(lines[scan] || "");
    const hasSeparator = Boolean(sepNormalized && workspaceRendererLineIsMarkdownTableSeparator(sepNormalized));
    if (hasSeparator) scan += 1;
    while (scan < lines.length) {
      const borderLine = lines[scan] || "";
      const normalizedBorder = workspaceRendererNormalizeTableLine(borderLine);
      if (normalizedBorder && workspaceRendererLineIsMarkdownTableSeparator(normalizedBorder)) {
        scan += 1;
        continue;
      }
      if (!workspaceRendererLineIsTableBorder(borderLine)) break;
      scan += 1;
    }
    if (!hasSeparator) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const separatorWidth = workspaceRendererCells(sepNormalized).length;
    let width = Math.max(headerCells.length, separatorWidth);
    headerContinuations.forEach((cells) => {
      width = Math.max(width, cells.length);
    });

    let rebuiltHeaders = workspaceRendererNormalizeTableCells(headerCells, width);
    headerContinuations.forEach((cells) => {
      const aligned = cells.length < width ? workspaceRendererRightAlignTableCells(cells, width) : workspaceRendererNormalizeTableCells(cells, width);
      rebuiltHeaders = workspaceRendererMergeTableCells(rebuiltHeaders, aligned);
    });

    const rowStart = scan;

    const rows: string[][] = [];
    let previousRow: string[] | undefined;
    let rowIndex = rowStart;
    while (rowIndex < lines.length) {
      const nextLine = lines[rowIndex] || "";
      if (!nextLine.trim()) break;
      if (workspaceRendererLineIsTableBorder(nextLine)) {
        rowIndex += 1;
        continue;
      }
      const normalized = workspaceRendererNormalizeTableLine(nextLine);
      if (!normalized || workspaceRendererLineIsMarkdownTableSeparator(normalized)) break;
      const rawCells = workspaceRendererCells(normalized);
      const cells = rawCells.length < width
        ? workspaceRendererRightAlignTableCells(rawCells, width)
        : workspaceRendererNormalizeTableCells(rawCells, width);
      if (workspaceRendererTableContinuationRow(rawCells, width, previousRow)) {
        const merged = workspaceRendererMergeTableCells(previousRow || [], cells);
        if (previousRow) rows[rows.length - 1] = workspaceRendererNormalizeTableCells(merged, width);
        previousRow = rows[rows.length - 1];
      } else {
        rows.push(cells);
        previousRow = rows[rows.length - 1];
      }
      rowIndex += 1;
    }

    if (!rows.length) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const normalizedHeaders = workspaceRendererNormalizeTableCells(rebuiltHeaders, width);
    output.push(`| ${normalizedHeaders.join(" | ")} |`);
    output.push(`| ${Array.from({ length: width }, () => "---").join(" | ")} |`);
    rows.forEach((row) => output.push(`| ${workspaceRendererNormalizeTableCells(row, width).join(" | ")} |`));
    index = rowIndex;
  }

  return output;
}

export function workspaceRendererLineIsDiffHunk(line: string) {
  return /^@@\s/.test(line.trim());
}

export function workspaceRendererLineIsDiffHeader(line: string) {
  const text = line.trim();
  return /^diff --git\s+/i.test(text) || /^index\s+[0-9a-f]+\.\.[0-9a-f]+/i.test(text);
}

export function workspaceRendererLineIsDiffLike(line: string) {
  const text = line.trim();
  if (!text) return false;
  if (workspaceRendererLineIsDiffHeader(text)) return true;
  if (/^(?:\+\+\+|---)\s/.test(text)) return true;
  if (/^[+-](?![+-])/.test(text) && !/^[+-]\s+\[[ xX]\]/.test(text)) return true;
  return false;
}

export function workspaceRendererAppendRecentPendingUserTurns(
  segments: WorkspaceRenderedSegment[],
  trackedUserTurns: WorkspaceTerminalUserTurn[],
  startIndex: number,
  now = Date.now()
) {
  for (let index = startIndex; index < trackedUserTurns.length; index += 1) {
    const turn = trackedUserTurns[index];
    if (turn.source === "renderer" && now - turn.createdAt < 2500) {
      workspaceRendererPushSegment(segments, "user", turn.text);
    }
  }
}

export function workspaceRendererCleanOutput(raw: string, profile: WorkspaceRendererProfile) {
  const clean = workspaceRendererStripTerminalControls(raw);
  const lines = clean
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""));
  const filteredLines = profile === "claude"
    ? workspaceRendererCleanClaudeOutputLines(lines)
    : profile === "hermes"
      ? workspaceRendererCleanHermesOutputLines(lines)
    : lines.filter((line) => !workspaceRendererLineIsDisplayNoise(line, profile));
  return filteredLines
    .join("\n")
    .trim();
}

export function workspaceRendererClaudeLineConfirmsSubmittedPrompt(line: string) {
  const text = line.trim();
  const plain = workspaceRendererPlainLine(text);
  if (!plain) return false;
  if (/^[›>▸]\s+/.test(text)) return false;
  const isMarkdownTableRow = workspaceRendererLineIsMarkdownTableRow(text);
  if (!isMarkdownTableRow && (workspaceRendererLineIsClaudeStartupNoise(text) || workspaceRendererLineIsClaudeRuntimeNoise(text))) return false;
  if (workspaceRendererLineIsClaudeThinkingResidue(text)) return false;
  if (workspaceRendererLineIsClaudeThinking(text)) return true;
  if (/^[●•]\s*(.+)$/.test(text)) return true;
  if (isMarkdownTableRow) return true;
  const readableLine = workspaceRendererCleanDisplayText(text);
  return Boolean(readableLine && !workspaceRendererLineIsSeparator(readableLine));
}

export function workspaceRendererClaudeSegments(
  raw: string,
  options: { userTurns?: WorkspaceTerminalUserTurn[]; now?: number } = {}
): WorkspaceRenderedSegment[] {
  const clean = workspaceRendererStripTerminalControls(raw);
  const startupSegment = workspaceRendererClaudeStartupSegment(raw);
  const lines = workspaceRendererCleanClaudeOutputLines(clean.split("\n").map((line) => line.replace(/\s+$/g, "")));
  const segments: WorkspaceRenderedSegment[] = [];
  let assistantLines: string[] = [];
  const trackedUserTurns = options.userTurns || [];
  const now = options.now ?? Date.now();
  let trackedUserTurnIndex = 0;
  let inCodeFence = false;
  let inToolPreview = false;
  let inDiffPreview = false;
  let inPermissionPrompt = false;
  let inPermissionPromptFooterSeen = false;
  let inRawThought = false;

  const flushAssistant = () => {
    const text = assistantLines
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .join("\n")
      .trim();
    assistantLines = [];
    if (text) workspaceRendererPushSegment(segments, "assistant", text);
  };

  const pushUserTurn = (
    promptText: string,
    matchedTurn?: { turn: WorkspaceTerminalUserTurn; index: number } | null
  ) => {
    const match = matchedTurn || workspaceRendererFindMatchingUserTurn(trackedUserTurns, trackedUserTurnIndex, promptText);
    if (match) {
      workspaceRendererPushSegment(segments, "user", match.turn.text);
      trackedUserTurnIndex = Math.max(trackedUserTurnIndex, match.index + 1);
      return;
    }
    workspaceRendererPushSegment(segments, "user", promptText);
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const text = line.trim();
    if (workspaceRendererLineIsClaudeTransientToolStatus(text)) continue;
    if (workspaceRendererLineIsClaudeInteractiveQuestionTool(text) && workspaceRendererLineStartsClaudeInteractiveMenu(lines, lineIndex + 1)) continue;
    if (inRawThought) {
      const rawThoughtBoundary = (
        workspaceRendererLineIsClaudeToolBlockStart(text) ||
        workspaceRendererLineIsClaudePermissionQuestion(text) ||
        workspaceRendererLineStartsClaudeInteractiveMenu(lines, lineIndex) ||
        workspaceRendererLineIsClaudeThinkingStatus(text) ||
        workspaceRendererLinePreservesMarkdownSyntax(text) ||
        workspaceRendererNormalizeTableLine(text) ||
        /^[›>▸●•]\s*/.test(text) ||
        /^```/.test(text)
      );
      if (!rawThoughtBoundary) {
        continue;
      }
      inRawThought = false;
      lineIndex -= 1;
      continue;
    }
    if (inDiffPreview) {
      if (/^(?:Added|Removed|Updated|No output|\.\.\s+\+\d+\s+line)\b/i.test(workspaceRendererPlainLine(text))) {
        continue;
      }
      const diffLine = workspaceRendererClaudePreviewDiffLine(line);
      if (diffLine) {
        assistantLines.push(diffLine);
        continue;
      }
      if (!text || workspaceRendererLineIsTableBorder(text) || workspaceRendererLineIsSeparator(text)) {
        continue;
      }
      assistantLines.push("```");
      inDiffPreview = false;
      if (workspaceRendererLineIsClaudeThinking(text) || /^[›▸❯]/.test(text) || /^[●•]/.test(text) || workspaceRendererLinePreservesMarkdownSyntax(text) || workspaceRendererLineIsClaudePermissionQuestion(text) || workspaceRendererLineStartsClaudeInteractiveMenu(lines, lineIndex) || workspaceRendererLineIsClaudeToolBlockStart(text)) {
        lineIndex -= 1;
        continue;
      }
    }
    if (workspaceRendererLineIsClaudePermissionQuestion(text) || workspaceRendererLineStartsClaudeInteractiveMenu(lines, lineIndex)) {
      inToolPreview = false;
      inPermissionPrompt = true;
      inPermissionPromptFooterSeen = false;
      continue;
    }
    if (inPermissionPrompt) {
      if (
        !text
        || workspaceRendererLineIsClaudePermissionOption(text)
        || workspaceRendererLineIsClaudePermissionQuestion(text)
        || workspaceRendererLineIsClaudeInteractiveMenuOption(text)
        || workspaceRendererLineIsClaudeInteractiveMenuAddon(text)
      ) continue;
      if (workspaceRendererLineIsClaudePermissionFooter(text) || workspaceRendererLineIsClaudeInteractiveMenuFooter(text)) {
        inPermissionPromptFooterSeen = true;
        continue;
      }
      if (!inPermissionPromptFooterSeen && workspaceRendererLineIsClaudePermissionOptionContinuation(text)) continue;
      inPermissionPrompt = false;
      inPermissionPromptFooterSeen = false;
    }
    if (workspaceRendererLineIsClaudeToolBlockStart(text)) {
      const toolStatus = workspaceRendererClaudeToolStatus(text);
      if (toolStatus) {
        assistantLines.push(workspaceRendererToolMarker(toolStatus.tone, toolStatus.label, toolStatus.detail));
      }
      if (workspaceRendererClaudeToolBlockIsDiffPreview(text)) {
        assistantLines.push("```meowdiff");
        inDiffPreview = true;
        inToolPreview = false;
        continue;
      }
      inToolPreview = true;
      continue;
    }
    if (inToolPreview) {
      if (!text || workspaceRendererLineIsClaudeToolPreviewLine(text)) continue;
      if (/^[●•]\s*/.test(text) || /^[›▸❯]\s*/.test(text)) {
        inToolPreview = false;
      } else if (workspaceRendererLineIsClaudeToolBlockStart(text) || workspaceRendererLineIsClaudePermissionQuestion(text) || workspaceRendererLineStartsClaudeInteractiveMenu(lines, lineIndex)) {
        inToolPreview = false;
        lineIndex -= 1;
        continue;
      } else {
        continue;
      }
    }
    if (inCodeFence) {
      assistantLines.push(workspaceRendererMarkdownContentLine(line));
      if (/^```\s*$/.test(text)) inCodeFence = false;
      continue;
    }
    if (/^```/.test(text)) {
      assistantLines.push(text);
      inCodeFence = true;
      continue;
    }
    const plain = workspaceRendererPlainLine(text);
    const isAsciiTableBorderInBlock = workspaceRendererAsciiTableBorderBelongsToBlock(lines, lineIndex);
    if (!plain && !isAsciiTableBorderInBlock) continue;
    if (workspaceRendererLineIsClaudePermissionOption(text) || workspaceRendererLineIsClaudePermissionQuestion(text)) continue;
    const isMarkdownTableRow = workspaceRendererLineIsMarkdownTableRow(text);
    const isTableBorder = workspaceRendererLineIsTableBorder(text);
    const framedContent = workspaceRendererStripLineFrame(line);
    const isFramedMarkdownHr = workspaceRendererLineIsMarkdownHr(text) || workspaceRendererLineIsMarkdownHr(framedContent);
    const isFramedCodeLine = Boolean(framedContent && workspaceRendererLineLooksLikeCode(framedContent));
    if (!isAsciiTableBorderInBlock && !isMarkdownTableRow && !isFramedMarkdownHr && !isFramedCodeLine && (workspaceRendererLineIsClaudeStartupNoise(text) || workspaceRendererLineIsClaudeRuntimeNoise(text))) continue;
    if (isTableBorder && !isAsciiTableBorderInBlock && !workspaceRendererLineIsMarkdownTableSeparator(text) && !isFramedCodeLine && !isFramedMarkdownHr) continue;
    if (workspaceRendererLineIsClaudeThinkingResidue(text)) continue;
    if (workspaceRendererLineIsClaudeRawThoughtContent(text)) {
      inRawThought = true;
      continue;
    }

    const userMatch = text.match(/^[›▸❯]\s*(.+)$/);
    if (userMatch?.[1]?.trim()) {
      const promptText = workspaceRendererNormalizeUserText(userMatch[1]);
      const initialConsumed = workspaceRendererConsumePromptContinuation(lines, lineIndex, promptText);
      const matchedPromptTurn = workspaceRendererFindMatchingUserTurn(trackedUserTurns, trackedUserTurnIndex, initialConsumed.text)
        || workspaceRendererFindMatchingUserTurn(trackedUserTurns, trackedUserTurnIndex, promptText);
      const consumed = matchedPromptTurn
        ? workspaceRendererConsumePromptContinuation(lines, lineIndex, promptText, matchedPromptTurn.turn)
        : initialConsumed;
      if (lines.slice(consumed.nextIndex + 1).some(workspaceRendererClaudeLineConfirmsSubmittedPrompt)) {
        flushAssistant();
        pushUserTurn(consumed.text, matchedPromptTurn);
        lineIndex = consumed.nextIndex;
      }
      continue;
    }

    const matchedTrackedTurn = workspaceRendererFindMatchingUserTurn(trackedUserTurns, trackedUserTurnIndex, text);
    if (matchedTrackedTurn) {
      flushAssistant();
      workspaceRendererPushSegment(segments, "user", matchedTrackedTurn.turn.text);
      trackedUserTurnIndex = Math.max(trackedUserTurnIndex, matchedTrackedTurn.index + 1);
      continue;
    }

    const assistantMatch = text.match(/^[●•]\s*(.+)$/);
    if (assistantMatch?.[1]?.trim()) {
      const value = workspaceRendererCleanDisplayText(assistantMatch[1]);
      if (value) assistantLines.push(value);
      continue;
    }

    if (workspaceRendererLineIsClaudeThinkingStatus(text)) {
      flushAssistant();
      workspaceRendererPushSegment(segments, "thinking", "Agent 正在整理回复。", workspaceRendererClaudeThinkingSummary(plain));
      continue;
    }
    if (workspaceRendererLineIsClaudeThinking(text)) continue;

    const beforeLength = assistantLines.length;
    workspaceRendererAppendAssistantLine(assistantLines, line);
    if (assistantLines.length > beforeLength && workspaceRendererLineIsClaudeThinkingResidue(assistantLines[assistantLines.length - 1])) {
      assistantLines.pop();
    }
  }

  if (inDiffPreview) {
    assistantLines.push("```");
  }
  flushAssistant();

  for (let index = trackedUserTurnIndex; index < trackedUserTurns.length; index += 1) {
    const turn = trackedUserTurns[index];
    if (turn?.text.trim()) workspaceRendererPushUnmatchedUserTurn(segments, turn, now);
  }

  const filteredSegments = segments.filter((segment) => {
    if (startupSegment && workspaceRendererSegmentIsClaudeStartupResidue(segment)) return false;
    const compact = workspaceRendererCompactLine(segment.text);
    if (compact.includes("claudecodev") || compact.includes("apiusagebilling") || compact.includes("forshortcuts")) return false;
    if (!segment.text.trim()) return false;
    return true;
  });
  return filteredSegments.length ? filteredSegments : (startupSegment ? [startupSegment] : []);
}

export function workspaceRendererLineIsHermesReasoning(line: string) {
  const text = workspaceRendererPlainLine(line);
  if (/^(?:Reasoning|OK,\s+so\s+the\s+current\s+state\s+is:)/i.test(text)) return true;
  if (/^The user wants\b/i.test(text)) return true;
  return false;
}

export function workspaceRendererLineIsHermesResponseMarker(line: string) {
  const text = workspaceRendererPlainLine(line);
  return /^Response$/i.test(text) || /^[─━\-\s]*Response[─━\-\s]*$/i.test(String(line || "").trim());
}

export function workspaceRendererLineIsHermesAssistantMarker(line: string) {
  const text = line.trim();
  const plain = workspaceRendererPlainLine(text);
  return /^[\s\-─—]*[✦*←↔↳→]\s*Hermes\b/i.test(text)
    || /^[✦*←↔↳→]\s*Hermes\b/i.test(plain)
    || (/^Hermes$/i.test(plain) && /[─━═—-]/.test(text));
}

export function workspaceRendererHermesLineLooksLikeAssistantOutput(line: string) {
  const text = line.trim();
  if (!text) return false;
  if (workspaceRendererLineIsHermesAssistantMarker(text)) return true;
  if (workspaceRendererNormalizeTableLine(text)) return true;
  if (workspaceRendererLineLooksLikeCode(text)) return true;
  if (/^```/.test(text) || workspaceRendererHeadingLevel(text) || /^>\s?/.test(text)) return true;
  if (/^\s*(?:[-*]|\d+\.)\s+/.test(text)) return true;
  if (/^(?:好|好的|明白|收到|这里|以下|可以|如果|看看|随便|另外)[，,：:\s]/.test(text)) return true;
  if (/[\u3400-\u9fff]/.test(text) && /[。！？；：?]$/.test(text)) return true;
  return false;
}

export function workspaceRendererHermesLineConfirmsSubmittedPrompt(line: string) {
  const text = line.trim();
  if (!text) return false;
  if (/^[›>▸]\s+/.test(text)) return false;
  if (workspaceRendererLineIsDisplayNoise(text, "hermes")) return false;
  if (workspaceRendererLineIsHermesReasoning(text)) return false;
  if (workspaceRendererLineIsTableBorder(text) || workspaceRendererLineIsSeparator(text)) return false;
  return Boolean(workspaceRendererNormalizeTableLine(line) || workspaceRendererCleanDisplayText(line));
}

export function workspaceRendererHermesMarkedPrompt(text: string) {
  const strongMatch = text.match(/^[›▸❯]\s*(.+)$/);
  if (strongMatch?.[1]?.trim()) {
    return { text: workspaceRendererNormalizeUserText(strongMatch[1]), isStrong: true };
  }
  const bulletMatch = text.match(/^[●•]\s*(.+)$/);
  if (bulletMatch?.[1]?.trim()) {
    return { text: workspaceRendererNormalizeUserText(bulletMatch[1]), isStrong: false, marker: "bullet" };
  }
  const chevronMatch = text.match(/^>\s*(.+)$/);
  if (chevronMatch?.[1]?.trim()) {
    return { text: workspaceRendererNormalizeUserText(chevronMatch[1]), isStrong: false };
  }
  return null;
}

export function workspaceRendererHermesLineLooksLikeDirectUserPrompt(line: string) {
  const source = String(line || "").trim();
  if (/^\+\s*>/.test(source)) return false;
  const text = workspaceRendererNormalizeUserText(line);
  if (!text || text.length < 4 || text.length > 360) return false;
  if (workspaceRendererNormalizeTableLine(text)) return false;
  if (workspaceRendererLinePreservesMarkdownSyntax(text)) return false;
  if (workspaceRendererLineIsShellOutput(text)) return false;
  if (workspaceRendererLineIsDiffLike(text) || workspaceRendererLineIsDiffHunk(text)) return false;
  if (workspaceRendererLineLooksLikeCode(text)) return false;
  if (workspaceRendererLineIsHermesAssistantMarker(text)) return false;
  if (workspaceRendererLineIsHermesResponseMarker(text) || workspaceRendererLineIsHermesReasoning(text)) return false;
  if (/^(?:好|好的|这里|以下|下面|可以看到|内容覆盖|本文件|创建于|总结|说明|注意|例如)(?:[，,：:\s]|$)/.test(text)) return false;

  const asksAgent = /(?:请|帮我|给我|帮忙|麻烦|辛苦|能不能|可否|需要你|我要|我想|你(?:可以|能|来|直接|先|再|帮|看看|读|查|修|改|处理|解决|实现|测试|验收|输出|写|生成|列出|总结|解释|运行|打开|关闭))/;
  const command = /(?:继续|直接|开始|输出|写|生成|列出|总结|解释|测试|验收|检查|看看|读|查|修|改|处理|解决|实现|优化|重构|跑|运行|打开|关闭|收起|展开|添加|删除|更新|回填|接一下|开\s*goal|goal\b|不要|不用|别|随意)/i;
  const target = /(?:meow\s*viewer|meowviewer|meowdesk|Hermes|Claude|agent|代码|代码块|表格|markdown|diff|问题|窗口|屏幕|截图|回复|消息|渲染|测试|验收|任务|文件|日志|页面|UI|parser|parseTranscript)/i;
  const punctuation = /[：:，,。！？?；;]/.test(text);
  return Boolean(target && (asksAgent.test(text) || command.test(text)) || punctuation && text.length <= 220 && (asksAgent.test(text) || command.test(text)));
}

export function workspaceRendererConsumeHermesPromptContinuation(
  lines: string[],
  lineIndex: number,
  promptText: string,
  turn?: WorkspaceTerminalUserTurn
) {
  let index = lineIndex;
  let merged = promptText;
  while (index + 1 < lines.length) {
    const next = lines[index + 1]?.trim() || "";
    if (!workspaceRendererPromptContinuationMatches(merged, next, turn)) break;
    if (!turn && workspaceRendererHermesLineLooksLikeAssistantOutput(next)) break;
    merged = /^[，。、；：,.!?！？]/.test(workspaceRendererNormalizeUserText(next))
      ? `${merged}${workspaceRendererNormalizeUserText(next)}`
      : `${merged}\n${workspaceRendererNormalizeUserText(next)}`;
    index += 1;
  }
  return { text: turn?.text || merged, nextIndex: index };
}

export function workspaceRendererHermesActivitySummary(raw: string) {
  if (/绞尽脑汁/.test(raw)) return "绞尽脑汁";
  const lines = workspaceRendererStripTerminalControls(raw).split("\n").map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const plain = workspaceRendererPlainLine(lines[index]);
    if (/绞尽脑汁/.test(plain)) return "绞尽脑汁";
    if (/\b(?:thinking|working)\b/i.test(plain) && /[()（）]/.test(lines[index])) return "进行中";
    if (/^Initializing agent/i.test(plain)) return "初始化";
  }
  return "进行中";
}

export function workspaceRendererHermesSegments(
  raw: string,
  options: { userTurns?: WorkspaceTerminalUserTurn[]; now?: number } = {}
): WorkspaceRenderedSegment[] {
  const clean = workspaceRendererStripTerminalControls(raw);
  const lines = workspaceRendererCleanHermesOutputLines(clean.split("\n").map((line) => line.replace(/\s+$/g, "")));
  const segments: WorkspaceRenderedSegment[] = [];
  let assistantLines: string[] = [];
  const trackedUserTurns = options.userTurns || [];
  const now = options.now ?? Date.now();
  let trackedUserTurnIndex = 0;
  let inReasoning = false;
  let inCodeFence = false;
  let emittedActivity = false;
  const hasHermesActivity = /Initializing agent|Reasoning|OK,\s+so\s+the\s+current\s+state\s+is:|绞尽脑汁|\$\s+\S+.*(?:\d+%|\d+s)/i.test(clean);

  const flushAssistant = () => {
    const text = assistantLines.join("\n").trim();
    assistantLines = [];
    if (text) workspaceRendererPushSegment(segments, "assistant", text);
  };

  const pushHermesActivity = (summary = workspaceRendererHermesActivitySummary(clean)) => {
    if (emittedActivity) return;
    flushAssistant();
    workspaceRendererPushSegment(segments, "thinking", "Hermes 正在整理回复。", summary);
    emittedActivity = true;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const text = line.trim();
    if (workspaceRendererLineIsHermesAssistantMarker(text)) {
      inReasoning = false;
      continue;
    }
    if (workspaceRendererLineIsHermesResponseMarker(text)) {
      inReasoning = false;
      continue;
    }
    if (workspaceRendererLineIsHermesReasoning(text)) {
      pushHermesActivity();
      inReasoning = true;
      continue;
    }
    if (workspaceRendererLineIsDisplayNoise(text, "hermes")) continue;
    if (inReasoning) {
      if (workspaceRendererLineIsDisplayNoise(text, "hermes")) continue;
      if (workspaceRendererHermesLineLooksLikeAssistantOutput(text)) {
        inReasoning = false;
      } else {
        continue;
      }
    }
    if (inCodeFence) {
      assistantLines.push(workspaceRendererMarkdownContentLine(line));
      if (/^```\s*$/.test(text)) inCodeFence = false;
      continue;
    }
    if (/^```/.test(text)) {
      assistantLines.push(text);
      inCodeFence = true;
      continue;
    }
    if (!text) continue;

    const matchedTrackedTurn = workspaceRendererFindMatchingUserTurn(trackedUserTurns, trackedUserTurnIndex, text);
    if (matchedTrackedTurn) {
      flushAssistant();
      workspaceRendererPushSegment(segments, "user", matchedTrackedTurn.turn.text);
      trackedUserTurnIndex = Math.max(trackedUserTurnIndex, matchedTrackedTurn.index + 1);
      continue;
    }

    const markedPrompt = workspaceRendererHermesMarkedPrompt(text);
    if (markedPrompt?.text) {
      const promptText = markedPrompt.text;
      const initialConsumed = workspaceRendererConsumeHermesPromptContinuation(lines, lineIndex, promptText);
      const matchedPromptTurn = workspaceRendererFindMatchingUserTurn(trackedUserTurns, trackedUserTurnIndex, initialConsumed.text)
        || workspaceRendererFindMatchingUserTurn(trackedUserTurns, trackedUserTurnIndex, promptText);
      const consumed = matchedPromptTurn
        ? workspaceRendererConsumeHermesPromptContinuation(lines, lineIndex, promptText, matchedPromptTurn.turn)
        : initialConsumed;
      const canTreatAsPrompt = markedPrompt.isStrong
        || Boolean(matchedPromptTurn)
        || (markedPrompt.marker !== "bullet" && workspaceRendererHermesLineLooksLikeDirectUserPrompt(consumed.text));
      if (canTreatAsPrompt && lines.slice(consumed.nextIndex + 1).some(workspaceRendererHermesLineConfirmsSubmittedPrompt)) {
        flushAssistant();
        workspaceRendererPushSegment(segments, "user", matchedPromptTurn?.turn.text || consumed.text);
        if (matchedPromptTurn) trackedUserTurnIndex = Math.max(trackedUserTurnIndex, matchedPromptTurn.index + 1);
        lineIndex = consumed.nextIndex;
        continue;
      }
      if (markedPrompt.isStrong) continue;
    }

    if (assistantLines.length && workspaceRendererHermesLineLooksLikeDirectUserPrompt(text)) {
      const initialConsumed = workspaceRendererConsumeHermesPromptContinuation(lines, lineIndex, text);
      if (lines.slice(initialConsumed.nextIndex + 1).some(workspaceRendererHermesLineConfirmsSubmittedPrompt)) {
        flushAssistant();
        workspaceRendererPushSegment(segments, "user", initialConsumed.text);
        lineIndex = initialConsumed.nextIndex;
        continue;
      }
    }

    workspaceRendererAppendAssistantLine(assistantLines, line);
  }

  flushAssistant();

  if (hasHermesActivity && !emittedActivity && trackedUserTurns.length && !segments.some((segment) => segment.kind === "assistant")) {
    workspaceRendererPushSegment(segments, "thinking", "Hermes 正在启动或等待回复。", workspaceRendererHermesActivitySummary(clean));
  }

  for (let index = trackedUserTurnIndex; index < trackedUserTurns.length; index += 1) {
    const turn = trackedUserTurns[index];
    if (turn?.text.trim()) workspaceRendererPushUnmatchedUserTurn(segments, turn, now);
  }
  return segments;
}

export function workspaceRendererBuildLegacySegments(
  raw: string,
  profile: WorkspaceRendererProfile,
  options: { userTurns?: WorkspaceTerminalUserTurn[]; now?: number } = {}
): WorkspaceRenderedSegment[] {
  if (profile === "claude") return workspaceRendererClaudeSegments(raw, options);
  if (profile === "hermes") return workspaceRendererHermesSegments(raw, options);
  const renderedOutput = workspaceRendererCleanOutput(raw, profile);
  const trackedUserSegments = (options.userTurns || []).map((turn) => ({ kind: "user" as const, text: turn.text }));
  return [
    ...trackedUserSegments,
    ...(renderedOutput ? [{ kind: "markdown" as const, text: renderedOutput }] : [])
  ];
}

function workspaceRendererEventKindFromSegmentKind(kind: WorkspaceRenderedSegmentKind): WorkspaceRendererEventKind {
  if (kind === "user") return "user_message";
  if (kind === "assistant") return "assistant_message";
  if (kind === "markdown") return "markdown_document";
  return kind;
}

function workspaceRendererSegmentKindFromEventKind(kind: WorkspaceRendererEventKind): WorkspaceRenderedSegmentKind {
  if (kind === "user_message") return "user";
  if (kind === "assistant_message" || kind === "tool_call" || kind === "tool_preview" || kind === "tool_result") return "assistant";
  if (kind === "markdown_document") return "markdown";
  return kind;
}

export function workspaceRendererSourceEventIsSemantic(event: WorkspaceRendererSourceEvent) {
  return event.kind === "status"
    || event.kind === "user_message"
    || event.kind === "assistant_message"
    || event.kind === "markdown_document"
    || event.kind === "thinking"
    || event.kind === "startup"
    || event.kind === "tool_call"
    || event.kind === "tool_result";
}

export function workspaceRendererSourceEventsHaveSemanticAdapterOutput(sourceEvents: WorkspaceRendererSourceEvent[]) {
  return sourceEvents.some((event) => (
    event.kind === "assistant_message"
    || event.kind === "markdown_document"
    || event.kind === "tool_call"
    || event.kind === "tool_result"
  ));
}

export function workspaceRendererEventsFromSemanticSourceEvents(sourceEvents: WorkspaceRendererSourceEvent[]) {
  if (!workspaceRendererSourceEventsHaveSemanticAdapterOutput(sourceEvents)) return [];
  const explicitUserMessages = sourceEvents.filter((event) => event.kind === "user_message" && event.text);
  const candidates = sourceEvents
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => workspaceRendererSourceEventIsSemantic(event) || event.kind === "user_submit");
  const allCandidatesHaveTime = candidates.length > 0 && candidates.every(({ event }) => typeof event.createdAt === "number" && Number.isFinite(event.createdAt));
  const ordered = allCandidatesHaveTime
    ? [...candidates].sort((left, right) => (left.event.createdAt || 0) - (right.event.createdAt || 0) || left.index - right.index)
    : candidates;
  const events: WorkspaceRendererEvent[] = [];

  for (const { event } of ordered) {
    if (event.kind === "user_submit") {
      if (explicitUserMessages.some((message) => workspaceRendererUserTextMatches(message.text || "", event.text || ""))) continue;
      const text = workspaceRendererNormalizeUserText(event.text || "");
      if (text) events.push({ kind: "user_message", text });
      continue;
    }
    const text = String(event.text || "").trim();
    if (event.kind === "tool_call") {
      events.push({
        kind: "tool_call",
        text: text || workspaceRendererToolMarker(event.tone || "info", event.label || "状态", event.detail || ""),
        tone: event.tone || "info",
        label: event.label || "状态",
        detail: event.detail || ""
      });
      continue;
    }
    if (event.kind === "tool_result") {
      if (text) events.push({ kind: "tool_result", text, summary: event.summary });
      continue;
    }
    if (event.kind === "status") continue;
    if (!text) continue;
    if (
      event.kind !== "user_message"
      && event.kind !== "assistant_message"
      && event.kind !== "markdown_document"
      && event.kind !== "thinking"
      && event.kind !== "startup"
    ) {
      continue;
    }
    const nextEvent = {
      kind: event.kind,
      text,
      summary: event.summary
    };
    if (event.kind === "assistant_message") {
      let lastAssistantIndex = -1;
      let lastUserIndex = -1;
      for (let index = events.length - 1; index >= 0; index -= 1) {
        if (lastAssistantIndex < 0 && events[index].kind === "assistant_message") lastAssistantIndex = index;
        if (lastUserIndex < 0 && events[index].kind === "user_message") lastUserIndex = index;
        if (lastAssistantIndex >= 0 && lastUserIndex >= 0) break;
      }
      if (lastAssistantIndex >= 0 && lastAssistantIndex > lastUserIndex) {
        const previousText = events[lastAssistantIndex].text;
        if (previousText === text) continue;
        if ((text.includes(previousText) || previousText.includes(text)) && Math.min(previousText.length, text.length) > 80) {
          events[lastAssistantIndex] = text.length >= previousText.length ? nextEvent : events[lastAssistantIndex];
          continue;
        }
      }
    }
    events.push(nextEvent);
  }

  return events;
}

export function workspaceRendererEventsFromSegments(segments: WorkspaceRenderedSegment[]): WorkspaceRendererEvent[] {
  const events: WorkspaceRendererEvent[] = [];
  const flushMessage = (kind: WorkspaceRenderedSegmentKind, lines: string[], summary?: string) => {
    const text = lines.join("\n").trim();
    if (!text) return;
    events.push({ kind: workspaceRendererEventKindFromSegmentKind(kind), text, summary });
  };

  for (const segment of segments) {
    if (segment.kind !== "assistant") {
      events.push({
        kind: workspaceRendererEventKindFromSegmentKind(segment.kind),
        text: segment.text,
        summary: segment.summary
      });
      continue;
    }

    const assistantLines: string[] = [];
    for (const line of segment.text.split("\n")) {
      const toolStatus = workspaceRendererToolStatusFromMarker(line);
      if (toolStatus) {
        flushMessage("assistant", assistantLines, segment.summary);
        assistantLines.length = 0;
        events.push({
          kind: "tool_call",
          text: line,
          tone: toolStatus.tone,
          label: toolStatus.label,
          detail: toolStatus.detail
        });
        continue;
      }
      assistantLines.push(line);
    }
    flushMessage("assistant", assistantLines, segment.summary);
  }

  return events;
}

export function workspaceRendererSegmentsFromEvents(events: WorkspaceRendererEvent[]): WorkspaceRenderedSegment[] {
  const segments: WorkspaceRenderedSegment[] = [];
  let assistantLines: string[] = [];

  const flushAssistant = () => {
    const text = assistantLines.join("\n").trim();
    assistantLines = [];
    if (text) workspaceRendererPushSegment(segments, "assistant", text);
  };

  for (const event of events) {
    if (event.kind === "tool_call") {
      flushAssistant();
      workspaceRendererPushSegment(segments, "assistant", workspaceRendererToolMarker(
        event.tone || "info",
        event.label || "状态",
        event.detail || ""
      ));
      continue;
    }
    if (event.kind === "tool_preview" || event.kind === "tool_result") continue;
    if (event.kind === "assistant_message") {
      assistantLines.push(event.text);
      continue;
    }
    flushAssistant();
    workspaceRendererPushSegment(
      segments,
      workspaceRendererSegmentKindFromEventKind(event.kind),
      event.text,
      event.summary
    );
  }

  flushAssistant();
  return segments;
}

export function workspaceRendererBuildEvents(
  raw: string,
  profile: WorkspaceRendererProfile,
  options: { userTurns?: WorkspaceTerminalUserTurn[]; now?: number } = {}
): WorkspaceRendererEvent[] {
  return workspaceRendererEventsFromSegments(workspaceRendererBuildLegacySegments(raw, profile, options));
}

function workspaceRendererStructuredJsonText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => workspaceRendererStructuredJsonText(item))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  if (typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const type = String(record.type || record.kind || "").toLowerCase();
  if (type === "text" && typeof record.text === "string") return record.text;
  if (typeof record.text === "string") return record.text;
  if (typeof record.content === "string") return record.content;
  if (Array.isArray(record.content)) return workspaceRendererStructuredJsonText(record.content);
  if (record.message) return workspaceRendererStructuredJsonText((record.message as Record<string, unknown>).content || record.message);
  if (record.delta) return workspaceRendererStructuredJsonText(record.delta);
  if (typeof record.result === "string") return record.result;
  if (typeof record.output === "string") return record.output;
  return "";
}

function workspaceRendererStructuredJsonToolDetail(value: Record<string, unknown>) {
  const input = (value.input && typeof value.input === "object" ? value.input : {}) as Record<string, unknown>;
  const pathValue = input.file_path || input.path || input.filename || input.file || value.file_path || value.path;
  const detail = typeof pathValue === "string" ? pathValue : "";
  const name = String(value.name || value.tool_name || value.tool || value.type || "tool").trim();
  return {
    label: workspaceRendererCleanDisplayText(name) || "工具",
    detail: workspaceRendererCleanDisplayText(detail) || ""
  };
}

function workspaceRendererStructuredJsonToolEvents(value: unknown): WorkspaceRendererEvent[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => workspaceRendererStructuredJsonToolEvents(item));
  if (typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const type = String(record.type || record.kind || "").toLowerCase();
  const events: WorkspaceRendererEvent[] = [];
  if (/tool_(?:use|call)|function_call/.test(type)) {
    const tool = workspaceRendererStructuredJsonToolDetail(record);
    events.push({
      kind: "tool_call",
      text: workspaceRendererToolMarker("info", tool.label, tool.detail),
      tone: "info",
      label: tool.label,
      detail: tool.detail
    });
  }
  if (Array.isArray(record.content)) events.push(...workspaceRendererStructuredJsonToolEvents(record.content));
  if (record.message) events.push(...workspaceRendererStructuredJsonToolEvents((record.message as Record<string, unknown>).content || record.message));
  return events;
}

export function workspaceRendererEventsFromStructuredJsonLines(raw: string): WorkspaceRendererEvent[] {
  const events: WorkspaceRendererEvent[] = [];
  const lines = workspaceRendererStripTerminalControls(raw).split("\n");
  for (const line of lines) {
    const text = line.trim();
    if (!/^\{.*\}$/.test(text)) continue;
    let record: Record<string, unknown>;
    try {
      record = JSON.parse(text) as Record<string, unknown>;
    } catch {
      continue;
    }
    const type = String(record.type || record.kind || "").toLowerCase();
    const role = String(record.role || (record.message as Record<string, unknown> | undefined)?.role || "").toLowerCase();
    const toolEvents = workspaceRendererStructuredJsonToolEvents(record);
    if (toolEvents.length) {
      events.push(...toolEvents);
      continue;
    }
    if (/tool_result|function_result/.test(type)) {
      const resultText = workspaceRendererStructuredJsonText(record.content || record.result || record);
      if (resultText) events.push({ kind: "tool_result", text: resultText });
      continue;
    }
    if (role === "user" || type === "user" || type === "user_message") {
      const messageText = workspaceRendererNormalizeUserText(workspaceRendererStructuredJsonText(record.content || record.message || record));
      if (messageText) events.push({ kind: "user_message", text: messageText });
      continue;
    }
    if (role === "assistant" || /assistant|message_delta|content_block_delta/.test(type)) {
      const messageText = workspaceRendererStructuredJsonText(record.content || record.message || record.delta || record);
      if (messageText) events.push({ kind: "assistant_message", text: messageText });
      continue;
    }
    if (/status|thinking|reasoning/.test(type)) {
      const statusText = workspaceRendererStructuredJsonText(record.content || record.message || record.text || record);
      if (statusText) events.push({ kind: "thinking", text: statusText, summary: record.status ? String(record.status) : undefined });
      continue;
    }
    if (type === "result" && !events.some((event) => event.kind === "assistant_message")) {
      const resultText = workspaceRendererStructuredJsonText(record.result || record.output || record.content);
      if (resultText) events.push({ kind: "assistant_message", text: resultText });
    }
  }
  return events;
}

export function workspaceRendererClaudeAdapterEvents(
  raw: string,
  options: { userTurns?: WorkspaceTerminalUserTurn[]; now?: number } = {}
): WorkspaceRendererEvent[] {
  const structuredEvents = workspaceRendererEventsFromStructuredJsonLines(raw);
  if (structuredEvents.length) return structuredEvents;
  return workspaceRendererBuildEvents(raw, "claude", options);
}

export function workspaceRendererHermesAdapterEvents(
  raw: string,
  options: { userTurns?: WorkspaceTerminalUserTurn[]; now?: number } = {}
): WorkspaceRendererEvent[] {
  const structuredEvents = workspaceRendererEventsFromStructuredJsonLines(raw);
  if (structuredEvents.length) return structuredEvents;
  return workspaceRendererBuildEvents(raw, "hermes", options);
}

export function workspaceRendererAdapterEvents(
  raw: string,
  profile: WorkspaceRendererProfile,
  options: { userTurns?: WorkspaceTerminalUserTurn[]; now?: number } = {}
): WorkspaceRendererEvent[] {
  if (profile === "claude") return workspaceRendererClaudeAdapterEvents(raw, options);
  if (profile === "hermes") return workspaceRendererHermesAdapterEvents(raw, options);
  const structuredEvents = workspaceRendererEventsFromStructuredJsonLines(raw);
  if (structuredEvents.length) return structuredEvents;
  return workspaceRendererBuildEvents(raw, profile, options);
}

export function workspaceRendererBuildSegments(
  raw: string,
  profile: WorkspaceRendererProfile,
  options: { userTurns?: WorkspaceTerminalUserTurn[]; now?: number } = {}
): WorkspaceRenderedSegment[] {
  return workspaceRendererSegmentsFromEvents(workspaceRendererBuildEvents(raw, profile, options));
}

export function workspaceRendererSourceEventsFromSnapshot(input: WorkspaceRendererSourceSnapshot): WorkspaceRendererSourceEvent[] {
  const sourceEvents: WorkspaceRendererSourceEvent[] = [...(input.sourceEvents || [])];
  const displayTranscript = String(input.displayTranscript || "");
  const rawTranscript = String(input.rawTranscript || "");
  const hasRawSourceEvents = sourceEvents.some((event) => event.kind === "terminal_raw" && event.text);
  if (displayTranscript) sourceEvents.push({ kind: "terminal_display", text: displayTranscript });
  if (!hasRawSourceEvents && rawTranscript && rawTranscript !== displayTranscript) sourceEvents.push({ kind: "terminal_raw", text: rawTranscript });
  if (input.status) sourceEvents.push({ kind: "terminal_status", status: input.status });
  for (const turn of input.userTurns || []) {
    sourceEvents.push({
      kind: "user_submit",
      text: turn.text,
      source: turn.source,
      createdAt: turn.createdAt
    });
  }
  return sourceEvents;
}

export function workspaceRendererStatusItemsFromSourceEvents(
  sourceEvents: WorkspaceRendererSourceEvent[],
  profile: WorkspaceRendererProfile
): WorkspaceRendererStatusItem[] {
  const items: WorkspaceRendererStatusItem[] = [];
  for (const event of sourceEvents) {
    if (event.kind !== "status") continue;
    const label = event.label || (profile === "hermes" ? "Hermes" : profile === "claude" ? "Claude" : "状态");
    const value = event.status || event.text || event.detail || event.summary || "";
    const summary = String(event.summary || "").toLowerCase();
    const tone: WorkspaceRendererStatusTone = summary === "model" || summary === "context" || summary === "thinking"
      ? summary
      : /思考|thinking|working|整理|运行|running/i.test(value)
        ? "thinking"
        : "info";
    workspaceRendererPushStatus(items, label, value, tone);
  }
  return items;
}

export function workspaceRendererTranscriptFromSourceEvents(sourceEvents: WorkspaceRendererSourceEvent[]) {
  const displayEvent = [...sourceEvents].reverse().find((event) => event.kind === "terminal_display" && event.text);
  if (displayEvent?.text) return displayEvent.text;
  return sourceEvents
    .filter((event) => event.kind === "terminal_raw" && event.text)
    .map((event) => event.text || "")
    .join("");
}

export function workspaceRendererRawTranscriptFromSourceEvents(sourceEvents: WorkspaceRendererSourceEvent[]) {
  const raw = sourceEvents
    .filter((event) => event.kind === "terminal_raw" && event.text)
    .map((event) => event.text || "")
    .join("");
  if (raw) return raw;
  return [...sourceEvents].reverse().find((event) => event.kind === "terminal_display" && event.text)?.text || "";
}

export function workspaceRendererUserTurnsFromSourceEvents(sourceEvents: WorkspaceRendererSourceEvent[]): WorkspaceTerminalUserTurn[] {
  return sourceEvents
    .filter((event) => event.kind === "user_submit" && event.text)
    .map((event, index) => ({
      id: `source-turn-${index + 1}-${event.createdAt || 0}`,
      text: String(event.text || ""),
      source: event.source === "renderer" ? "renderer" : "terminal",
      createdAt: event.createdAt || Date.now()
    }));
}

export function workspaceRendererParseSourceEvents(input: {
  profile: WorkspaceRendererProfile;
  sourceEvents: WorkspaceRendererSourceEvent[];
  now?: number;
}): WorkspaceRendererParseResult {
  const hasSemanticOutput = workspaceRendererSourceEventsHaveSemanticAdapterOutput(input.sourceEvents);
  const semanticEvents = workspaceRendererEventsFromSemanticSourceEvents(input.sourceEvents);
  const transcriptForStatus = workspaceRendererTranscriptFromSourceEvents(input.sourceEvents);
  const rawTranscriptForStatus = workspaceRendererRawTranscriptFromSourceEvents(input.sourceEvents);
  const raw = hasSemanticOutput ? "" : transcriptForStatus;
  const rawForStatus = [rawTranscriptForStatus, transcriptForStatus].filter(Boolean).join("\n");
  const userTurns = workspaceRendererUserTurnsFromSourceEvents(input.sourceEvents);
  let events = hasSemanticOutput ? semanticEvents : workspaceRendererAdapterEvents(raw, input.profile, {
    userTurns,
    now: input.now
  });
  const statusItems = hasSemanticOutput ? [] : workspaceRendererExtractStatus(rawForStatus || raw, input.profile);
  for (const item of workspaceRendererStatusItemsFromSourceEvents(input.sourceEvents, input.profile)) {
    workspaceRendererPushStatus(statusItems, item.label, item.value, item.tone);
  }
  const permissionPrompt = input.profile === "claude"
    ? workspaceRendererDetectPermissionPrompt(rawTranscriptForStatus, input.profile)
      || workspaceRendererDetectPermissionPrompt(transcriptForStatus, input.profile)
    : null;
  if (permissionPrompt && hasSemanticOutput) {
    events = events.filter((event) => {
      if (event.kind !== "tool_call") return true;
      return !/AskUserQuestion|ask[_-]?user[_-]?question/i.test(`${event.label || ""} ${event.detail || ""} ${event.text || ""}`);
    });
  }
  return {
    sourceEvents: input.sourceEvents,
    events,
    segments: workspaceRendererSegmentsFromEvents(events),
    statusItems,
    permissionPrompt
  };
}

export function workspaceRendererParseSourceSnapshot(input: WorkspaceRendererSourceSnapshot): WorkspaceRendererParseResult {
  return workspaceRendererParseSourceEvents({
    profile: input.profile,
    sourceEvents: workspaceRendererSourceEventsFromSnapshot(input),
    now: input.now
  });
}

function workspaceRendererDetectClaudeInteractiveMenuPrompt(lines: string[]): WorkspaceRendererPermissionPrompt | null {
  const prompt = workspaceRendererFindClaudeInteractiveMenuPrompt(lines, { requireActive: true });
  if (!prompt) return null;
  return {
    title: /权限|授权|permission|approval/i.test(prompt.detail) ? "权限询问" : "选择回复",
    detail: prompt.detail,
    choices: prompt.choices
  };
}

export function workspaceRendererDetectPermissionPrompt(raw: string, profile: WorkspaceRendererProfile): WorkspaceRendererPermissionPrompt | null {
  if (profile !== "claude") return null;
  const lines = workspaceRendererStripTerminalControls(raw)
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .filter((line) => line.trim());
  let questionIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (workspaceRendererLineIsClaudePermissionQuestion(lines[index])) {
      questionIndex = index;
      break;
    }
  }
  if (questionIndex < 0) return workspaceRendererDetectClaudeInteractiveMenuPrompt(lines);

  const afterQuestion = lines.slice(questionIndex + 1);
  const hasChoices = afterQuestion.some(workspaceRendererLineIsClaudePermissionOption);
  if (!hasChoices) return workspaceRendererDetectClaudeInteractiveMenuPrompt(lines);
  let sawChoice = false;
  let sawFooter = false;
  for (const line of afterQuestion) {
    if (workspaceRendererLineIsClaudePermissionOption(line)) {
      sawChoice = true;
      continue;
    }
    if (workspaceRendererLineIsClaudePermissionFooter(line)) {
      sawFooter = true;
      continue;
    }
    if (workspaceRendererLineIsSeparator(line) || /^[›>▸]?\s*$/.test(line)) continue;
    if (sawChoice && !sawFooter && workspaceRendererLineIsClaudePermissionOptionContinuation(line)) continue;
    return workspaceRendererDetectClaudeInteractiveMenuPrompt(lines);
  }

  const question = workspaceRendererCleanDisplayText(lines[questionIndex]);
  const action = question.replace(/^Do you want to\s*/i, "").replace(/[？?]\s*$/, "").trim();
  return {
    title: "权限询问",
    detail: action ? `Claude 请求：${action}` : question || "Claude 请求执行需要确认的操作。",
    choices: [
      { label: "允许一次", value: "1", tone: "primary" },
      { label: "本次会话允许", value: "2", tone: "outline" },
      { label: "拒绝", value: "3", tone: "outline" }
    ]
  };
}

export function workspaceRendererParseTranscript(input: WorkspaceRendererParseInput): WorkspaceRendererParseResult {
  const raw = String(input.raw || "");
  return workspaceRendererParseSourceSnapshot({
    profile: input.profile,
    displayTranscript: raw,
    userTurns: input.userTurns || [],
    now: input.now
  });
}

export function workspaceRendererHeadingLevel(line: string) {
  const match = line.trim().match(/^(?:\+\s*)?(#{1,6})\s+(.+)$/);
  return match ? { level: Math.min(match[1].length, 6), text: match[2].trim() } : null;
}

export function workspaceRendererLineLooksLikeShellCommand(line: string) {
  const text = String(line || "").trim();
  if (!text) return false;
  if (/^(?:python|py|javascript|js|typescript|ts|tsx|jsx|json|css|html|bash|shell|sh|yaml|yml|sql|rust|rs|java|go|golang|php|ruby|rb|swift|kotlin|kt|scala|dart|c|cpp|c\+\+|csharp|c#|cs|r|perl|powershell|ps1)\s*:?\s*$/i.test(text)) return false;
  if (/^\d+[.)](?:\s+|$)/.test(text)) return false;
  if (/^(?:if\s+\[.+\]\s*;\s*then|elif\s+\[.+\]|else|fi|for\s+.+;\s*do|while\s+.+;\s*do|do|done|case\s+.+\s+in|esac|;;|\*\)|[A-Za-z0-9_.-]+\))(?:\s|$)/.test(text)) return true;
  if (/^(?:cd|echo|cp|mv|rm|mkdir|touch|cat|grep|rg|find|git|npm|pnpm|yarn|node|npx|python|python3|pip|pip3|docker|kubectl|curl|wget|tar|zip|unzip|chmod|chown|export|set|exit|sleep|trap|source)(?:\s|$|[;&|<>])/.test(text)) return true;
  if (/^[A-Z_][A-Z0-9_]*=.+/.test(text)) return true;
  return false;
}

export function workspaceRendererLineLooksLikeShellComment(line: string) {
  return /^#\s+\S/.test(String(line || "").trim());
}

export function workspaceRendererLineStartsShellCommentBlock(lines: string[], start: number) {
  if (!workspaceRendererLineLooksLikeShellComment(lines[start] || "")) return false;
  const lookahead = lines.slice(start + 1, start + 5).filter((line) => line.trim());
  return lookahead.some(workspaceRendererLineLooksLikeShellCommand);
}

function workspaceRendererLineLooksLikeSqlStart(line: string) {
  const text = String(line || "").trim();
  if (!text) return false;
  if (/^from\s+\S+\s+import\b/i.test(text)) return false;
  if (/^with(?:\s+recursive)?\s*$/i.test(text)) return true;
  if (/^(?:union(?:\s+(?:all|distinct))?|intersect(?:\s+(?:all|distinct))?|except(?:\s+(?:all|distinct))?)\s*$/i.test(text)) return true;
  if (/^(?:union(?:\s+all)?|intersect|except)\s+select\b/i.test(text)) return true;
  if (/^(?:select|from|where|join|left\s+join|right\s+join|inner\s+join|outer\s+join|full\s+join|cross\s+join|group\s+by|order\s+by|having|limit|offset|insert\s+into|update|delete\s+from|create\s+table|alter\s+table|drop\s+table|merge\s+into)\b/i.test(text)) return true;
  if (/^values\s*\(/i.test(text)) return true;
  return /^with\s+(?:recursive\s+)?[A-Za-z_][\w$]*(?:\s*,|\s+as\s*\()/i.test(text);
}

function workspaceRendererTextLooksLikeSql(text: string) {
  return text.split(/\n/).some(workspaceRendererLineLooksLikeSqlStart);
}

function workspaceRendererLineLooksLikeSqlContinuation(line: string) {
  const text = String(line || "").trim();
  if (!text || workspaceRendererNormalizeTableLine(line)) return false;
  if (workspaceRendererLineLooksLikeSqlStart(line)) return true;
  if (/^\s*--\s*\S/.test(line)) return true;
  if (/^\s*[A-Za-z_][\w$]*\s+AS\s*(?:\()?$/i.test(line)) return true;
  if (/\bAS\s+[A-Za-z_][\w$]*/i.test(line) && /(?:[A-Za-z_][\w$]*\.|\d|,|\(|\))/.test(line)) return true;
  if (/^\s*(?:\d+(?:\.\d+)?|[A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)?)(?:\s*[+\-*/]\s*(?:\d+(?:\.\d+)?|[A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)?))+\s*,?\s*$/.test(line)) return true;
  if (/^\s*\)\s*(?:,|;)?\s*$/.test(line)) return true;
  if (/^\s*(?:AND|OR|ON|USING|WHEN|THEN|ELSE|END)\b.*[,;]?\s*$/i.test(line)) return true;
  if (/^\s*(?:OVER|PARTITION\s+BY)\b.*[,;]?\s*$/i.test(line)) return true;
  if (/^\s*(?:ROW_NUMBER|RANK|DENSE_RANK|NTILE|LAG|LEAD|FIRST_VALUE|LAST_VALUE|PERCENTILE_CONT|PERCENTILE_DISC|COUNT|SUM|AVG|MIN|MAX|COALESCE|NULLIF)\s*\(.*[,;]?\s*$/i.test(line)) return true;
  if (/^\s{2,}\S.*\b(?:AS|OVER|WITHIN\s+GROUP|PARTITION\s+BY|ORDER\s+BY|FILTER\s*\(|CASE|WHEN|THEN|ELSE|END|JOIN|ON)\b.*[,;]?\s*$/i.test(line)) return true;
  return /^\s{2,}\S.*[,;]\s*$/.test(line);
}

export function workspaceRendererLineLooksLikeCode(line: string) {
  const text = String(line || "").trim();
  if (!text) return false;
  if (workspaceRendererLineIsAsciiTableLine(line)) return false;
  if (/^\s{2,}#/.test(line)) return true;
  if (workspaceRendererHeadingLevel(text) || workspaceRendererCallout(text) || workspaceRendererNormalizeTableLine(text)) return false;
  if (workspaceRendererLineLooksLikeShellCommand(line)) return true;
  if (workspaceRendererLineIsShellOutput(line)) return true;
  if (/^\s*(?:[-*]|(?:\d+|[A-Za-z])\.)\s+/.test(line) || (/^>\s?/.test(line) && !workspaceRendererLineIsShellOutput(line))) return false;
  if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) return true;
  if (/^(?:<!doctype\s+html>?|<\/?[A-Za-z][^>]*>|[{}[\]},;])$/i.test(text)) return true;
  if (/^<\/?[A-Za-z][^>]*>$/.test(text)) return true;
  if (/^(?:this\.#?[A-Za-z_]\w*|#\w+|[A-Za-z_]\w*(?:\.[#A-Za-z_]\w*|\[[^\]]+\])+)\s*(?:=|\.|\(|,|$)/.test(text)) return true;
  if (/^["'][^"']+["']\s*:\s*/.test(text)) return true;
  if (/^\s*["']{3}/.test(line)) return true;
  if (/^(?:elif|else|except|finally)\b.*:\s*$/i.test(text)) return true;
  if (workspaceRendererLineLooksLikeSqlStart(line)) return true;
  if (/^(?:extends|with)\s+[A-Za-z_]\w*(?:\[[^\]]+\])?/.test(text)) return true;
  if (/^(?:case\s+class|case\s+object|sealed\s+(?:trait|class)|trait|object)\b/.test(text)) return true;
  if (/^[A-Za-z_]\w*(?:\.[#A-Za-z_]\w*|\[[^\]]+\])+\s*(?:=|\.|\(|,|$)/.test(text)) return true;
  if (/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\s*\(.+\)\s*;?$/.test(text)) return true;
  if (/^[A-Za-z_]\w*\s*=\s*.+/.test(text) && /(?:[{}()[\];=]|\b(?:True|False|None|null|new)\b|["'])/.test(text)) return true;
  if (/^[\w-]+\s*:\s*[^;{}]+;?$/.test(text) && /(?:;|px|rem|em|rgb|hsl|#[0-9a-f]{3,8}|var\(|uppercase|lowercase|center|flex|grid|block|inline|none)/i.test(text)) return true;
  if (/^(?:import|export|const|let|var|function|class|return|if|for|while|switch|type|interface|enum|async|await|def|from|use|#[a-z]|@media)\b/i.test(text)) return true;
  if (/^[\w.#:[\]="' >+~-]+\s*\{$/.test(text)) return true;
  if (!/[\u3400-\u9fff]/.test(text) && /[{}()[\];=<>]/.test(text) && text.length <= 220) return true;
  return false;
}

export function workspaceRendererInferCodeLanguage(lines: string[]) {
  const text = lines.join("\n");
  if (lines.some(workspaceRendererLineLooksLikeShellCommand) || /(?:^|\n)\s*(?:\$|>)\s+\S/.test(text) || /(?:^|\n)\s*(?:Test Files|Tests|Duration)\b/i.test(text)) return "shell";
  if (/<!doctype\s+html|<\/?(?:html|head|body|div|section|script|style|meta|link)\b/i.test(text)) return "html";
  if (/<\?php|\b(?:echo|namespace|use)\s+[\w\\]+;|\$[A-Za-z_]\w*\s*=/.test(text)) return "php";
  if (/(?:^|\n)\s*(?:package\s+[\w.]+;|public\s+class|private\s+(?:final\s+)?[\w<>[\]]+\s+\w+|import\s+java\.)/i.test(text)) return "java";
  if (/(?:^|\n)\s*(?:fun|val|var|data\s+class|sealed\s+class|object)\b|println\(/.test(text) && /(?:List<|MutableList|String|Int|Boolean|Unit|\?:|\bwhen\s*\()/.test(text)) return "kotlin";
  if (/(?:^|\n)\s*class\s+\w+(?:<[^>]+>)?\s*\([^)]*\b(?:val|var)\b/.test(text) && /List<|String|Int|Boolean|Unit/.test(text)) return "kotlin";
  if (/(?:^|\n)\s*(?:(?:val|var|case\s+class|object|trait)\b|class\s+\w+\[[^\]]+\]|import\s+scala\.)|scala\.concurrent|unsafeRunSync\(|println\(s?"/.test(text)) return "scala";
  if (workspaceRendererTextLooksLikeSql(text)) return "sql";
  if (
    /(?:^|\n)\s*(?:from\s+\S+\s+import\b|import\s+\S+|@(?:dataclass|staticmethod|classmethod|property)\b|async\s+def\b|def\s+\w+\([^)]*\)(?:\s*->\s*[^:]+)?:|class\s+\w+(?:\([^)]*\))?:|if\s+__name__|elif\b|except\b|with\s+.+:\s*$)/i.test(text)
    || /\bself\./.test(text)
    || /:\s*\n\s{2,}\S/.test(text)
  ) return "python";
  if (/(?:^|\n)\s*(?:func|struct|class|enum|let|var)\s+\w+|import\s+Foundation\b|\bprint\(/.test(text) && /(?:String|Int|Double|Bool|\[\w+\]|->|\bin\b)/.test(text)) return "swift";
  if (/(?:^|\n)\s*(?:def|class|module|require|puts)\b|do\s*\|[^|]+\||\bend\s*$/m.test(text) && !/(?:^|\n)\s*def\s+\w+\([^)]*\):/m.test(text)) return "ruby";
  if (/^\s*[{[]/.test(text) || /"[\w.-]+"\s*:\s*/.test(text)) return "json";
  if (/(?:^|\n)\s*\|\s*\{\s*type\s*:/i.test(text) || /\b(?:trueBranch|falseBranch|failFast|concurrency|Record<|Promise<)\b/.test(text)) return "ts";
  if (/\b(?:SchedulerError::|Result<|Vec<|Ok\(|Err\(|\.await\b|map_err\s*\(\|)\b/.test(text)) return "rust";
  if (/\b(?:interface|type|keyof|extends|infer|Record<|Promise<|DeepPartial|UnionToIntersection)\b/.test(text)) return "ts";
  if (/\b(?:fn|impl|let\s+mut|match|Ok\(|Err\(|Result<|Vec<)\b/.test(text) || /::|\bmap_err\s*\(\|/.test(text)) return "rust";
  if (/(?:^|\n)\s*[\w-]+\s*:\s*[^;{}]+;/m.test(text) || /@media|#[\w-]+\s*\{|\.([\w-]+)\s*\{/m.test(text)) return "css";
  if (/\b(?:import|export|const|let|var|function|class|return|async|await|new\s+Map|this\.|#\w+|=>)\b/.test(text) || /[{;}]\s*$/.test(text)) return "js";
  if (/(?:^|\n)\s*(?:async\s+def|def|from\s+\S+\s+import|import\s+\S+|elif|except|with\s+.+:\s*$)/i.test(text) || /\bself\./.test(text) || /:\s*\n\s{2,}\S/.test(text)) return "python";
  return "text";
}

export function workspaceRendererLineLooksLikeCodeContinuation(line: string, previousLines: string[]) {
  const text = String(line || "").trim();
  if (!text) return false;
  if (workspaceRendererLineLooksLikeCode(line)) return true;
  if (!previousLines.length) return false;
  const previousLang = workspaceRendererInferCodeLanguage(previousLines);
  if (previousLang === "sql") {
    if (workspaceRendererNormalizeTableLine(line)) return false;
    if (workspaceRendererLineLooksLikeSqlContinuation(line)) return true;
    if (/^\s*[A-Za-z_][\w$]*\s+(?:BIGINT|INT|INTEGER|SMALLINT|TINYINT|VARCHAR|CHAR|TEXT|LONGTEXT|TIMESTAMP|DATETIME|DATE|TIME|BOOLEAN|BOOL|ENUM|DECIMAL|NUMERIC|FLOAT|DOUBLE|JSON|UUID|SERIAL)\b.*[,;]?\s*$/i.test(line)) return true;
    if (/^\s*(?:PRIMARY\s+KEY|FOREIGN\s+KEY|INDEX|KEY|UNIQUE|CONSTRAINT|CHECK|REFERENCES|ON\s+DELETE|ON\s+UPDATE)\b.*[,;]?\s*$/i.test(line)) return true;
    if (/^\s*(?:DELETE|UPDATE|CASCADE|RESTRICT|SET\s+NULL|SET\s+DEFAULT|NO\s+ACTION)\b.*(?:CASCADE|RESTRICT|NULL|ACTION|DEFAULT).*[;,]?\s*$/i.test(line)) return true;
    if (/^\s*\)\s*(?:ENGINE=|DEFAULT\s+CHARSET|CHARSET|COLLATE|;|,).*/i.test(line)) return true;
  }
  if (previousLang === "python") {
    const previousText = previousLines.join("\n");
    if (/^\s*@[A-Za-z_][\w.]*(?:\([^)]*\))?\s*$/.test(line)) return true;
    if (/^\s*[A-Za-z_]\w*\s*:\s*[^#=]+(?:=\s*.+)?$/.test(line)) return true;
    if (/^\s*(?:self\.)?[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\s*:\s*$/.test(line)) return true;
    if (/^\s*(?:[A-Za-z_]\w*,\s*)?[A-Za-z_]\w*\s*:\s*[\w.[\], |]+(?:\)\s*->)?\s*$/.test(line)) return true;
    if (/^\s*(?:None|Any|bool|str|int|float|bytes|list|dict|tuple|set|Optional|List|Dict|Sequence|Mapping|Callable)(?:\[[^\]]+\])?\s*:\s*$/.test(line) && /\b(?:def|async\s+def)\b|->\s*$/.test(previousText)) return true;
  }
  if (previousLang === "html") {
    if (workspaceRendererNormalizeTableLine(line)) return false;
    if (/^<\/?[A-Za-z][\s\S]*>?$/i.test(text)) return true;
    if (/<\/?[A-Za-z][^>]*>/i.test(text)) return true;
    if (/^[.#]?[\w-]+\s*\{/.test(text)) return true;
    if (/^[\w-]+\s*:\s*[^;{}]+;?$/.test(text)) return true;
    if (/^[{}]\s*$/.test(text)) return true;
  }
  if (workspaceRendererLineLooksLikeShellComment(line) && previousLines.some(workspaceRendererLineLooksLikeShellCommand)) return true;
  if (/^\s*[?:]\s*[A-Za-z_$][\w$.[\]<>]*(?:[,;])?$/.test(line) && previousLines.some((previousLine) => /\b(?:type|extends|infer|keyof|UnionToIntersection|DeepPartial)\b|=>\s*\w*$/.test(previousLine))) return true;
  if (/^(?:\||\.)\s*(?:\{|\w|\[|map_err|filter|any|then|catch)/.test(text)) return true;
  if (/^[})\]],;]+$/.test(text)) return true;
  if (/^\s*(?:success|duration|output|error|handler|params|expression|trueBranch|falseBranch|concurrency|failFast|collapsed|tags|metadata|children|config|viewer|theme)\s*:\s*.+[,;]?$/.test(line)) return true;
  if (/^\s*[A-Za-z_$][\w$-]*\s*:\s*.+[,;]?$/.test(line)) {
    const previousText = previousLines.join("\n");
    const previousHasObjectContext = /(?:^|\n)\s*(?:return|const|let|var|this\.[\w$]+|[\w$]+)\s*(?:=\s*)?\{/.test(previousText)
      || previousLines.some((previousLine) => /[{,]\s*$/.test(previousLine.trim()))
      || previousLines.some((previousLine) => /\(\s*$/.test(previousLine.trim()))
      || previousLines.some((previousLine) => /^\s*[A-Za-z_$][\w$-]*\s*:\s*.+[,;]?$/.test(previousLine));
    if (previousHasObjectContext) return true;
  }
  if (/^\s*(?:extends|with)\s+[A-Za-z_]\w*(?:\[[^\]]+\])?/.test(line)) {
    if (previousLines.some((previousLine) => workspaceRendererLineLooksLikeCode(previousLine))) return true;
  }
  if (/^\s*(?:[A-Za-z]+)?(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)\s*[,;]?$/.test(line)) {
    if (previousLines.some((previousLine) => workspaceRendererLineLooksLikeCode(previousLine) || /[{([,]\s*$/.test(previousLine.trim()))) return true;
  }
  if (/^\s*(?:return|yield|throw)\b.+[,;]?$/.test(line)) return true;
  return false;
}

export function workspaceRendererLineLooksLikePythonDecorator(line: string) {
  return /^\s*@[A-Za-z_][\w.]*(?:\([^)]*\))?\s*$/.test(String(line || ""));
}

export function workspaceRendererLineStartsPythonDecoratorBlock(lines: string[], start: number) {
  if (!workspaceRendererLineLooksLikePythonDecorator(lines[start] || "")) return false;
  for (let index = start + 1; index < Math.min(lines.length, start + 5); index += 1) {
    const text = String(lines[index] || "").trim();
    if (!text) continue;
    if (workspaceRendererLineLooksLikePythonDecorator(text)) continue;
    return /^(?:async\s+def|def|class)\s+[A-Za-z_]\w*/.test(text);
  }
  return false;
}

export function workspaceRendererShouldBridgeCodeBlank(previousLines: string[], nextLine: string) {
  const previous = [...previousLines].reverse().find((line) => line.trim())?.trim() || "";
  const next = String(nextLine || "").trim();
  if (!previous || !next) return false;
  const previousLang = workspaceRendererInferCodeLanguage(previousLines);
  const nextLang = workspaceRendererInferCodeLanguage([nextLine]);
  if (previousLang === "sql" && workspaceRendererLineLooksLikeSqlContinuation(nextLine)) return true;
  if (previousLang !== "text" && nextLang !== "text" && previousLang !== nextLang) return false;
  if (/^[})\]];?$/.test(previous) && /^[{[]\s*$/.test(next) && previousLang !== "json") return false;
  if (previous === "}" && /^["'][\w.-]+["']\s*:/.test(next) && previousLang !== "json") return false;
  return true;
}

export function workspaceRendererLineStartsNewCodeBlock(line: string, previousLines: string[]) {
  if (!previousLines.length) return false;
  const previous = [...previousLines].reverse().find((candidate) => candidate.trim())?.trim() || "";
  const next = String(line || "").trim();
  if (!previous || !next) return false;
  const previousLang = workspaceRendererInferCodeLanguage(previousLines);
  const nextLang = workspaceRendererInferCodeLanguage([line]);
  if (previousLang === "text" || nextLang === "text" || previousLang === nextLang) return false;
  const previousLooksClosed = /^[})\]];?$/.test(previous)
    || /;\s*$/.test(previous)
    || /^<\/[A-Za-z][^>]*>$/.test(previous);
  const nextLooksLikeBlockStart = /^(?:class|def|select|with|insert\s+into|update|delete\s+from|create\s+table|<\/?[A-Za-z]|[.#]?[\w-]+\s*\{|[{[]\s*$)/i.test(next);
  return previousLooksClosed && nextLooksLikeBlockStart;
}

export function workspaceRendererCodeBlock(lines: string[], start: number) {
  const startsShellCommentBlock = workspaceRendererLineStartsShellCommentBlock(lines, start);
  const startsPythonDecoratorBlock = workspaceRendererLineStartsPythonDecoratorBlock(lines, start);
  if (!startsShellCommentBlock && !startsPythonDecoratorBlock && !workspaceRendererLineLooksLikeCode(lines[start] || "")) return null;
  const codeLines: string[] = [];
  let index = start;
  let codeLikeCount = 0;
  let blankBudget = 2;

  while (index < lines.length) {
    const line = lines[index] || "";
    const trimmed = line.trim();
    if (!trimmed) {
      const lookahead = lines.slice(index + 1, index + 4);
      const nextCodeOffset = lookahead.findIndex((candidate) => candidate.trim() && workspaceRendererLineLooksLikeCodeContinuation(candidate, codeLines));
      const canBridgeBlank = nextCodeOffset >= 0 && lookahead.slice(0, nextCodeOffset).every((candidate) => !candidate.trim());
      if (codeLines.length && blankBudget > 0 && canBridgeBlank && workspaceRendererShouldBridgeCodeBlank(codeLines, lookahead[nextCodeOffset] || "")) {
        codeLines.push("");
        blankBudget -= 1;
        index += 1;
        continue;
      }
      break;
    }
    if (workspaceRendererLineStartsNewCodeBlock(line, codeLines)) break;
    const startsDecoratorLine = startsPythonDecoratorBlock && !codeLines.length && workspaceRendererLineLooksLikePythonDecorator(line);
    if (!startsDecoratorLine && !workspaceRendererLineLooksLikeCodeContinuation(line, codeLines) && !(startsShellCommentBlock && workspaceRendererLineLooksLikeShellComment(line))) break;
    codeLines.push(line);
    codeLikeCount += 1;
    blankBudget = 2;
    index += 1;
  }

  const lang = workspaceRendererInferCodeLanguage(codeLines);
  if (codeLikeCount < 2 && lang !== "shell") return null;
  return {
    lang,
    lines: codeLines,
    next: index
  };
}

export function workspaceRendererLabelledCodeBlock(lines: string[], start: number, lang: string) {
  const normalizedLang = String(lang || "text").toLowerCase();
  if (start >= lines.length) return null;
  const codeLines: string[] = [];
  let index = start;
  let blankBudget = 4;

  while (index < lines.length) {
    const line = lines[index] || "";
    const trimmed = line.trim();
    if (!trimmed) {
      const lookahead = lines.slice(index + 1, index + 6);
      const nextCodeOffset = lookahead.findIndex((candidate) => candidate.trim() && workspaceRendererLineLooksLikeCodeContinuation(candidate, codeLines));
      const canBridgeBlank = nextCodeOffset >= 0 && lookahead.slice(0, nextCodeOffset).every((candidate) => !candidate.trim());
      if (codeLines.length && blankBudget > 0 && canBridgeBlank && workspaceRendererShouldBridgeCodeBlank(codeLines, lookahead[nextCodeOffset] || "")) {
        codeLines.push("");
        blankBudget -= 1;
        index += 1;
        continue;
      }
      break;
    }
    if (codeLines.length && /^```/.test(trimmed)) break;
    if (codeLines.length && /^(python|py|javascript|js|typescript|ts|tsx|jsx|json|css|html|bash|shell|sh|yaml|yml|sql|rust|rs|java|go|golang|php|ruby|rb|swift|kotlin|kt|scala|dart|c|cpp|c\+\+|csharp|c#|cs|r|perl|powershell|ps1|diff|patch|meowdiff)\s*:?\s*$/i.test(trimmed)) break;
    codeLines.push(line);
    blankBudget = 4;
    index += 1;
  }

  if (!codeLines.some((line) => line.trim())) return null;
  return {
    lang: normalizedLang || workspaceRendererInferCodeLanguage(codeLines),
    lines: codeLines,
    next: index
  };
}

export function workspaceRendererLineLooksLikeTreeRoot(line: string) {
  const text = String(line || "").trim();
  return /^[A-Za-z]:[\\/][^<>:"|?*]*[\\/]?$/.test(text) || /^\/[\w .~/-]+\/?$/.test(text);
}

export function workspaceRendererLineLooksLikeTreeEntry(line: string) {
  const text = String(line || "").trimEnd();
  if (!text.trim()) return false;
  return /^[│┃| ]*(?:├|└|╰|╭|[+`|\\-]{1,4})[─━═\-\s]+/.test(text)
    || /^[│┃| ]{1,}[A-Za-z0-9_.\-\u3400-\u9fff].*(?:#|\/\/|目录|文件|skill|文档)/i.test(text);
}

export function workspaceRendererTreeBlock(lines: string[], start: number) {
  if (!workspaceRendererLineLooksLikeTreeRoot(lines[start] || "")) return null;
  const treeLines: string[] = [lines[start].trimEnd()];
  let index = start + 1;
  let entryCount = 0;
  while (index < lines.length) {
    const line = lines[index] || "";
    if (!line.trim()) break;
    if (workspaceRendererNormalizeTableLine(line) || workspaceRendererLineIsTableBorder(line)) break;
    if (!workspaceRendererLineLooksLikeTreeEntry(line)) break;
    treeLines.push(line.trimEnd());
    entryCount += 1;
    index += 1;
  }
  if (entryCount < 2) return null;
  return { lines: treeLines, next: index };
}

export function workspaceRendererAsciiTableBlock(lines: string[], start: number) {
  if (!workspaceRendererLineIsAsciiTableLine(lines[start] || "")) return null;
  const tableLines: string[] = [];
  let index = start;
  let tableLineCount = 0;
  while (index < lines.length) {
    const line = lines[index] || "";
    if (!line.trim()) break;
    if (!workspaceRendererLineIsAsciiTableLine(line)) break;
    tableLines.push(line.trimEnd());
    tableLineCount += 1;
    index += 1;
  }
  if (tableLineCount < 2) return null;
  return { lines: tableLines, next: index };
}

function workspaceRendererAsciiTableDataCells(line: string) {
  const text = String(line || "").trimEnd();
  if (!text.trim()) return null;
  if (!/[|│┃]/.test(text)) return null;
  if (workspaceRendererLineIsTableBorder(text)) return null;
  if (workspaceRendererLineIsCodePipeExpression(text)) return null;
  const cells = workspaceRendererTableCells(text)
    .map((cell) => workspaceRendererCleanTableCellText(cell));
  if (cells.length < 2 || !cells.some(Boolean)) return null;
  if (cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s+/g, "")))) return null;
  return cells;
}

function workspaceRendererAsciiTableLineBelongsToBlock(lines: string[], index: number) {
  const line = lines[index] || "";
  if (workspaceRendererAsciiTableDataCells(line)) return true;
  if (workspaceRendererLineIsTableBorder(line) || workspaceRendererLineIsAsciiTableLine(line)) {
    const previous = lines[index - 1] || "";
    const next = lines[index + 1] || "";
    return Boolean(workspaceRendererAsciiTableDataCells(previous) || workspaceRendererAsciiTableDataCells(next));
  }
  return false;
}

function workspaceRendererMergeAsciiTableGroup(group: string[][], width: number) {
  let merged = workspaceRendererNormalizeTableCells(group[0] || [], width);
  for (const cells of group.slice(1)) {
    const aligned = cells.length < width
      ? workspaceRendererRightAlignTableCells(cells, width)
      : workspaceRendererNormalizeTableCells(cells, width);
    merged = workspaceRendererMergeTableCells(merged, aligned);
  }
  return workspaceRendererNormalizeTableCells(merged, width);
}

function workspaceRendererAsciiTableCellsStartNewBodyRow(cells: string[], currentGroup: string[][], width: number) {
  if (!currentGroup.length) return false;
  const normalized = workspaceRendererNormalizeTableCells(cells, width);
  const first = normalized[0]?.trim() || "";
  if (!first) return false;
  if (/^[-–—]/.test(first)) return false;
  if (cells.length < width) {
    const currentMerged = workspaceRendererMergeAsciiTableGroup(currentGroup, width);
    const currentLooksComplete = Boolean(currentMerged[0] && currentMerged[1] && currentMerged.filter(Boolean).length >= Math.max(3, Math.ceil(width / 2)));
    const firstLooksLikeRowKey = /^\d+$/.test(first) || /^[A-Z]{2,}[-\d]*$/i.test(first);
    return currentLooksComplete && firstLooksLikeRowKey;
  }
  const nonEmptyCount = normalized.filter(Boolean).length;
  return nonEmptyCount >= Math.max(2, Math.ceil(width / 2));
}

function workspaceRendererSplitAsciiTableBodyGroup(group: string[][], width: number) {
  const rows: string[][][] = [];
  let currentGroup: string[][] = [];
  for (const cells of group) {
    if (workspaceRendererAsciiTableCellsStartNewBodyRow(cells, currentGroup, width)) {
      rows.push(currentGroup);
      currentGroup = [];
    }
    currentGroup.push(cells);
  }
  if (currentGroup.length) rows.push(currentGroup);
  return rows;
}

function workspaceRendererAsciiTableRowLooksLikeHeader(row: string[]) {
  const cells = row.map((cell) => String(cell || "").trim()).filter(Boolean);
  if (cells.length < 2) return false;
  const first = cells[0] || "";
  if (/^(?:\d+|[A-Z][A-Z0-9]*[- ]?\d+|MV-\d+|MEOW-\d+)$/i.test(first)) return false;
  if (cells.some((cell) => /(?:序号|任务|文件|路径|问题|类型|状态|优先|负责人|备注|描述|名称|日期|耗时|name|task|file|path|status|priority|owner|note|description)/i.test(cell))) return true;
  return cells.every((cell) => cell.length <= 24 && !/[\\/]|^\d/.test(cell));
}

function workspaceRendererLooseAsciiTableStopLine(line: string) {
  const text = workspaceRendererCleanTableCellText(String(line || "").replace(/[|│┃]/g, " ")).trim();
  if (!text) return true;
  return /^(?:总计|预计总耗时|关键路径|Worked for|\*?\s*Worked for|\?\s+for shortcuts|[#>]|```)/i.test(text);
}

function workspaceRendererLooseAsciiTableRowKey(cell: string) {
  return /^(?:\d+|[A-Z][A-Z0-9]*[- ]?\d+|MV-\d+|MEOW-\d+)$/i.test(String(cell || "").trim());
}

function workspaceRendererLooseAsciiTableLineLooksLikeSection(line: string) {
  const text = workspaceRendererCleanTableCellText(String(line || "").replace(/[|│┃]/g, " ")).trim();
  if (!text || text.length > 36) return false;
  if (workspaceRendererLooseAsciiTableRowKey(text)) return false;
  if (!/[\u3400-\u9fffA-Za-z]/.test(text)) return false;
  return !/[，。！？；：、,.!?;:()[\]{}]/.test(text);
}

function workspaceRendererLineHasTerminalTableGlyph(line: string) {
  return /[│┃┌┬┐└┴┘├┼┤╭╮╰╯╞╡╪─━═]/.test(String(line || ""));
}

function workspaceRendererAppendLooseAsciiTableCells(row: string[], cells: string[]) {
  const next = [...row];
  for (const cell of cells.map((value) => workspaceRendererCleanTableCellText(value)).filter(Boolean)) {
    next.push(cell);
  }
  return next;
}

function workspaceRendererJoinLooseAsciiTablePart(left: string, right: string) {
  const a = left.trim();
  const b = right.trim();
  if (!a) return b;
  if (!b) return a;
  if (/[A-Za-z]$/.test(a) && /^[A-Za-z]/.test(b) && /[\u3400-\u9fff，。！？；：、,.!?;:]/.test(b)) {
    return `${a} ${b}`.replace(/\s+([，。！？；：、,.!?;:])/g, "$1");
  }
  return workspaceRendererJoinCellPart(a, b);
}

function workspaceRendererInferLooseAsciiTableHeaders(rows: string[][], width: number) {
  const firstCells = rows.flatMap((row) => row.slice(0, 2)).join(" ");
  const allCells = rows.flat().join(" ");
  if (/(?:MV-\d+|MEOW-\d+|\bP[0-3]\b|任务|Claude|Hermes)/i.test(`${firstCells} ${allCells}`)) {
    return ["任务ID", "任务名称", "描述", "状态", "优先级", "负责人", "备注"].slice(0, width);
  }
  if (/[\\/][\w .-]+\.(?:tsx?|jsx?|json|md|css|html|js)\b/i.test(allCells)) {
    return ["序号", "文件路径", "问题类型", "优先级", "状态", "备注"].slice(0, width);
  }
  return Array.from({ length: width }, (_, index) => `列 ${index + 1}`);
}

function workspaceRendererLooseAsciiTableExpectedWidthForRow(row: string[]) {
  const first = row[0] || "";
  const second = row[1] || "";
  if (/^(?:TASK|T|MV|MEOW)[- ]?\d+/i.test(first)) return 7;
  if (/[\\/][\w .-]+\.(?:tsx?|jsx?|json|md|css|html|js)\b/i.test(second)) return 6;
  return 0;
}

function workspaceRendererLooseAsciiTableTargetWidth(rows: string[][], fallback: number) {
  const rowWidth = rows.map(workspaceRendererLooseAsciiTableExpectedWidthForRow).find(Boolean);
  return rowWidth || fallback;
}

export function workspaceRendererLooseAsciiTable(lines: string[], start: number) {
  if (!workspaceRendererAsciiTableLineBelongsToBlock(lines, start)) return null;
  if (!lines.slice(start, Math.min(lines.length, start + 8)).some(workspaceRendererLineHasTerminalTableGlyph)) return null;
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let index = start;
  let sawBorder = false;
  let sawDataCells = false;

  while (index < lines.length) {
    const line = lines[index] || "";
    if (!line.trim()) break;
    if (workspaceRendererLooseAsciiTableStopLine(line)) break;
    const cells = workspaceRendererAsciiTableDataCells(line);
    if (cells) {
      sawDataCells = true;
      const first = cells[0]?.trim() || "";
      if (currentRow.length && workspaceRendererLooseAsciiTableRowKey(first)) {
        rows.push(currentRow);
        currentRow = [];
      }
      const expectedWidth = workspaceRendererLooseAsciiTableExpectedWidthForRow(currentRow);
      if (currentRow.length && expectedWidth && currentRow.length >= expectedWidth && !workspaceRendererLooseAsciiTableRowKey(first)) {
        const continuation = cells.map((cell) => workspaceRendererCleanTableCellText(cell)).filter(Boolean).join(" ");
        currentRow[expectedWidth - 1] = workspaceRendererJoinLooseAsciiTablePart(currentRow[expectedWidth - 1] || "", continuation);
      } else if (currentRow.length && workspaceRendererLooseAsciiTableRowKey(currentRow[0] || "") && currentRow.length === 3 && cells.length >= 2 && !workspaceRendererLooseAsciiTableRowKey(first)) {
        currentRow[2] = workspaceRendererJoinLooseAsciiTablePart(currentRow[2] || "", workspaceRendererCleanTableCellText(cells[0] || ""));
        currentRow = workspaceRendererAppendLooseAsciiTableCells(currentRow, cells.slice(1));
      } else {
        currentRow = currentRow.length
          ? workspaceRendererAppendLooseAsciiTableCells(currentRow, cells)
          : cells.map((cell) => workspaceRendererCleanTableCellText(cell));
      }
      index += 1;
      continue;
    }
    if (workspaceRendererLineIsTableBorder(line) || workspaceRendererLineIsAsciiTableLine(line)) {
      sawBorder = true;
      index += 1;
      continue;
    }
    if (!currentRow.length || workspaceRendererLineLooksLikeCode(line) || workspaceRendererShouldStartDiffBlock(lines, index)) break;
    const continuation = workspaceRendererCleanTableCellText(String(line || "").replace(/[|│┃]/g, " "));
    if (!continuation) break;
    if (currentRow.length >= 4 && workspaceRendererLooseAsciiTableLineLooksLikeSection(line)) break;
    if (workspaceRendererLooseAsciiTableRowKey(currentRow[0] || "") && currentRow.length <= 2) {
      currentRow.push(continuation);
    } else {
      const previous = currentRow[currentRow.length - 1] || "";
      currentRow[currentRow.length - 1] = /^[A-Z]{2,}[- ]?\d+/i.test(continuation) && /[\u3400-\u9fff]$/.test(previous.trim())
        ? `${previous.trim()} ${continuation}`.trim()
        : workspaceRendererJoinLooseAsciiTablePart(previous, continuation);
    }
    index += 1;
  }

  if (currentRow.length) rows.push(currentRow);
  const normalizedRows = rows
    .map((row) => row.map((cell) => workspaceRendererCleanTableCellText(cell)).filter(Boolean))
    .filter((row) => row.length >= 2);
  const rawWidth = normalizedRows.reduce((max, row) => Math.max(max, row.length), 0);
  const width = workspaceRendererLooseAsciiTableTargetWidth(normalizedRows, rawWidth);
  if (!sawBorder || !sawDataCells || !width || !normalizedRows.length) return null;

  const firstRow = workspaceRendererNormalizeTableCells(normalizedRows[0], width);
  const firstRowIsHeader = normalizedRows.length > 1 && workspaceRendererAsciiTableRowLooksLikeHeader(firstRow);
  const bodyRows = firstRowIsHeader
    ? normalizedRows.slice(1).map((row) => workspaceRendererNormalizeTableCells(row, width))
    : normalizedRows.map((row) => workspaceRendererNormalizeTableCells(row, width));
  if (!bodyRows.length) return null;

  return {
    headers: firstRowIsHeader ? firstRow : workspaceRendererInferLooseAsciiTableHeaders(bodyRows, width),
    rows: bodyRows,
    next: index
  };
}

export function workspaceRendererAsciiTable(lines: string[], start: number) {
  const firstLine = lines[start] || "";
  const nextLine = lines[start + 1] || "";
  const firstCells = workspaceRendererAsciiTableDataCells(firstLine);
  const nextNormalized = workspaceRendererNormalizeTableLine(nextLine);
  if (firstCells && nextNormalized && workspaceRendererLineIsMarkdownTableSeparator(nextNormalized)) return null;
  if (!workspaceRendererAsciiTableLineBelongsToBlock(lines, start)) return null;

  const groups: string[][][] = [];
  let currentGroup: string[][] = [];
  let index = start;
  let sawBorder = false;

  while (index < lines.length) {
    const line = lines[index] || "";
    if (!line.trim()) break;
    const cells = workspaceRendererAsciiTableDataCells(line);
    if (cells) {
      currentGroup.push(cells);
      index += 1;
      continue;
    }
    if (workspaceRendererLineIsTableBorder(line) || workspaceRendererLineIsAsciiTableLine(line)) {
      if (!workspaceRendererAsciiTableLineBelongsToBlock(lines, index)) break;
      if (currentGroup.length) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      sawBorder = true;
      index += 1;
      continue;
    }
    break;
  }
  if (currentGroup.length) groups.push(currentGroup);

  const width = groups.reduce((max, group) => Math.max(max, ...group.map((cells) => cells.length)), 0);
  if (!sawBorder || width < 2 || groups.length < 2) return null;

  const headerGroup = groups[0];
  const bodyGroups = groups.slice(1).flatMap((group) => workspaceRendererSplitAsciiTableBodyGroup(group, width));
  const rows = [headerGroup, ...bodyGroups]
    .map((group) => workspaceRendererMergeAsciiTableGroup(group, width))
    .filter((row) => row.some(Boolean));
  if (rows.length < 2) return null;
  if (!workspaceRendererAsciiTableRowLooksLikeHeader(rows[0])) return null;

  return {
    headers: rows[0],
    rows: rows.slice(1),
    next: index
  };
}

export function workspaceRendererImplicitHeading(lines: string[], index: number) {
  const line = lines[index] || "";
  const text = line.trim();
  if (!text || workspaceRendererHeadingLevel(text) || workspaceRendererCallout(text)) return null;
  if (workspaceRendererNormalizeTableLine(text) || workspaceRendererLineLooksLikeCode(text)) return null;
  if (/^\s*(?:[-*]|(?:\d+|[A-Za-z])\.)\s+/.test(line) || /^>\s?/.test(line) || workspaceRendererShouldStartDiffBlock(lines, index)) return null;
  if (text.length > 32 || /[。！？；,.!?;:]$/.test(text)) return null;
  if (/^(?:MEOWDESK_|END_MEODESK_|[>›❯]|[*]\s+\w+\s+for\b)/i.test(text)) return null;
  const previous = lines[index - 1]?.trim() || "";
  const next = lines[index + 1]?.trim() || "";
  const previousAllowsHeading = !previous || workspaceRendererHeadingLevel(previous) || /[。！？；：:.)）]$/.test(previous) || workspaceRendererLineLooksLikeCode(previous);
  if (!previousAllowsHeading) return null;
  if (!next || workspaceRendererHeadingLevel(next) || workspaceRendererNormalizeTableLine(next)) return null;
  if (!/[\u3400-\u9fffA-Za-z]/.test(text)) return null;
  return { level: 3, text };
}

export function workspaceRendererTable(lines: string[], start: number) {
  const headerLine = workspaceRendererNormalizeTableLine(lines[start] || "");
  if (!headerLine) return null;
  let index = start + 1;
  let hasSeparator = false;
  const rows: string[] = [];

  while (index < lines.length && workspaceRendererLineIsTableBorder(lines[index])) {
    const maybeSeparator = workspaceRendererNormalizeTableLine(lines[index] || "");
    if (maybeSeparator && workspaceRendererLineIsMarkdownTableSeparator(maybeSeparator)) break;
    index += 1;
  }

  const maybeSeparator = workspaceRendererNormalizeTableLine(lines[index] || "");
  if (maybeSeparator && workspaceRendererLineIsMarkdownTableSeparator(maybeSeparator)) {
    hasSeparator = true;
    index += 1;
  }

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) break;
    if (workspaceRendererLineIsTableBorder(line)) {
      index += 1;
      continue;
    }
    const normalizedLine = workspaceRendererNormalizeTableLine(line);
    if (!normalizedLine || workspaceRendererLineIsMarkdownTableSeparator(normalizedLine)) break;
    rows.push(normalizedLine);
    index += 1;
  }

  if (!hasSeparator && rows.length < 1) return null;
  return {
    headers: workspaceRendererCells(headerLine),
    rows: rows.map(workspaceRendererCells),
    next: index
  };
}

export function workspaceRendererCells(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

export function workspaceRendererNormalizeMarkdownTables(text: string) {
  return String(text || "")
    .replace(/(\|\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|)\s*(?=\|)/g, "$1\n");
}

export function workspaceRendererShouldStartDiffBlock(lines: string[], start: number) {
  const current = lines[start]?.trim() || "";
  if (workspaceRendererLineIsDiffHeader(current) || workspaceRendererLineIsDiffHunk(current)) return true;
  if (!workspaceRendererLineIsDiffLike(current)) return false;
  const windowLines = lines.slice(start, start + 5).map((line) => line.trim()).filter(Boolean);
  const plusCount = windowLines.filter((line) => /^\+/.test(line)).length;
  const minusCount = windowLines.filter((line) => /^-/.test(line)).length;
  const hasFileMarker = windowLines.some((line) => /^(?:\+\+\+|---)\s/.test(line));
  const hasHunk = windowLines.some(workspaceRendererLineIsDiffHunk);
  const codeSignalCount = windowLines.filter((line) => (
    /^(?:\+\+\+|---)\s/.test(line) ||
    /^[-+]\s*(?:import|export|const|let|var|function|class|return|if|for|while|switch|type|interface|enum|<\/?\w|#include|def|async|await)\b/i.test(line) ||
    /^[-+].*[{}()[\];=<>]/.test(line)
  )).length;
  const shortProseCount = windowLines.filter((line) => {
    if (!workspaceRendererLineIsDiffLike(line)) return false;
    const body = line.replace(/^[+-]\s*/, "").trim();
    return Boolean(body && body.length <= 28 && /^[\u3400-\u9fffA-Za-z0-9\s，。！？；：、,.!?;:]+$/.test(body));
  }).length;
  const diffLineCount = plusCount + minusCount;
  if (hasFileMarker || hasHunk) return true;
  return plusCount > 0 && minusCount > 0 && diffLineCount >= 2 && (codeSignalCount > 0 || shortProseCount < diffLineCount);
}

export function workspaceRendererLineContinuesDiffBlock(line: string, sawStructuredDiff: boolean) {
  const text = line.trim();
  if (!text) return false;
  if (workspaceRendererLineIsDiffHeader(text) || workspaceRendererLineIsDiffHunk(text) || workspaceRendererLineIsDiffLike(text)) return true;
  if (!sawStructuredDiff) return false;
  if (workspaceRendererHeadingLevel(text) || workspaceRendererCallout(text) || workspaceRendererNormalizeTableLine(text)) return false;
  if (/^\s*(?:[-*]|(?:\d+|[A-Za-z])\.)\s+/.test(line)) return false;
  if (/^>\s?/.test(line)) return false;
  return workspaceRendererLineLooksLikeCode(line) || /^[{}()[\]},;]\s*$/.test(text);
}

export function workspaceRendererCallout(line: string) {
  const match = line.trim().match(/^(结论|建议|重点|下一步|注意|风险|判断|原因|结果|Summary|Conclusion|Note|Warning)[:：]\s*(.+)$/i);
  if (!match) return null;
  return {
    label: match[1],
    text: match[2].trim()
  };
}

export function workspaceRendererDiffLineTone(line: string) {
  const text = line.trim();
  if (workspaceRendererLineIsDiffHunk(text)) return "hunk";
  if (/^\+/.test(text)) return "add";
  if (/^-/.test(text)) return "remove";
  return "context";
}

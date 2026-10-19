const fs = require("fs");
const os = require("os");
const path = require("path");

const TERMINAL_SOURCE_ADAPTER_POLL_MS = 900;
const TERMINAL_HERMES_SOURCE_ADAPTER_POLL_MS = 2500;
const TERMINAL_HERMES_SESSION_DIR_CACHE_MS = 30000;
const TERMINAL_SOURCE_ADAPTER_FILE_GRACE_MS = 12000;
const TERMINAL_SOURCE_ADAPTER_BIND_DELAY_MS = 1600;
const TERMINAL_SOURCE_ADAPTER_TEXT_LIMIT = 160000;
const TERMINAL_SOURCE_ADAPTER_INPUT_LIMIT = 4000;
const TERMINAL_SOURCE_ADAPTER_RECENT_INPUT_TTL_MS = 5 * 60 * 1000;

function cleanImportedConversationText(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007]*(\u0007|\u001b\\)/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function parseTimestampMs(value) {
  if (!value) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value).trim();
  if (!text) return 0;
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseGenericSessionTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 100000000000 ? value : value * 1000;
  }
  return parseTimestampMs(value);
}

function normalizeTerminalSourceAdapterInputText(value) {
  return cleanImportedConversationText(value)
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceAdapterFileStartedAt(stats) {
  const birthtimeMs = Number(stats?.birthtimeMs) || 0;
  return Number.isFinite(birthtimeMs) && birthtimeMs > 1000000000000 ? birthtimeMs : 0;
}

function sourceAdapterCandidateIsFresh(stats, startedAt) {
  const mtimeMs = Number(stats?.mtimeMs) || 0;
  if (mtimeMs < startedAt - TERMINAL_SOURCE_ADAPTER_FILE_GRACE_MS) return false;
  const bornAt = sourceAdapterFileStartedAt(stats);
  if (!bornAt) return true;
  return bornAt >= startedAt - TERMINAL_SOURCE_ADAPTER_FILE_GRACE_MS;
}

function sourceAdapterRecentInputNeedles(state) {
  const now = Date.now();
  return (state?.recentUserInputs || [])
    .filter((entry) => entry?.text && now - (entry.createdAt || 0) <= TERMINAL_SOURCE_ADAPTER_RECENT_INPUT_TTL_MS)
    .map((entry) => normalizeTerminalSourceAdapterInputText(entry.text))
    .filter((text, index, values) => text.length >= 2 && values.indexOf(text) === index)
    .slice(-5);
}

function sourceAdapterRecentInputs(state) {
  const now = Date.now();
  return (state?.recentUserInputs || [])
    .filter((entry) => entry?.text && now - (entry.createdAt || 0) <= TERMINAL_SOURCE_ADAPTER_RECENT_INPUT_TTL_MS)
    .map((entry) => ({
      text: normalizeTerminalSourceAdapterInputText(entry.text),
      createdAt: Number(entry.createdAt) || 0
    }))
    .filter((entry) => entry.text.length >= 2)
    .slice(-8);
}

function recordTerminalSourceAdapterInputState(state, data, now = Date.now()) {
  if (!state) return;
  const text = String(data || "");
  if (!text) return;
  let buffer = String(state.inputBuffer || "");
  const pushInput = () => {
    const normalized = normalizeTerminalSourceAdapterInputText(buffer);
    buffer = "";
    if (!normalized || normalized.length < 2) return;
    const inputs = Array.isArray(state.recentUserInputs) ? state.recentUserInputs : [];
    const last = inputs[inputs.length - 1];
    if (last?.text === normalized && now - (last.createdAt || 0) < 900) {
      state.recentUserInputs = inputs;
      return;
    }
    state.recentUserInputs = [...inputs, { text: normalized, createdAt: now }]
      .filter((entry) => now - (entry.createdAt || 0) <= TERMINAL_SOURCE_ADAPTER_RECENT_INPUT_TTL_MS)
      .slice(-12);
  };
  for (const char of Array.from(text)) {
    if (char === "\r" || char === "\n") {
      pushInput();
      continue;
    }
    if (char === "\u007f" || char === "\b") {
      buffer = buffer.slice(0, -1);
      continue;
    }
    if (char >= " ") buffer += char;
    if (buffer.length > TERMINAL_SOURCE_ADAPTER_INPUT_LIMIT) {
      buffer = buffer.slice(-TERMINAL_SOURCE_ADAPTER_INPUT_LIMIT);
    }
  }
  state.inputBuffer = buffer;
}

function decodeProcessOutput(buffer) {
  if (!buffer) return "";
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (!bytes.length) return "";
  const sample = bytes.subarray(0, Math.min(bytes.length, 400));
  let nullBytes = 0;
  for (const byte of sample) {
    if (byte === 0) nullBytes += 1;
  }
  if (nullBytes > sample.length / 5) return bytes.toString("utf16le").replace(/\u0000/g, "");
  return bytes.toString("utf8").replace(/\u0000/g, "");
}

function runWslCommand(args, timeout = 4500) {
  if (process.platform !== "win32") return "";
  try {
    const result = require("child_process").spawnSync("wsl.exe", args, {
      encoding: "buffer",
      input: Buffer.alloc(0),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout,
      maxBuffer: 12 * 1024 * 1024
    });
    if (result.error || result.status !== 0) return "";
    return decodeProcessOutput(result.stdout);
  } catch {
    return "";
  }
}

function listWslDistributions() {
  const output = runWslCommand(["-l", "-q"], 4000);
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("适用于 Linux") && !line.startsWith("Copyright"));
}

function runWslImportCommand(distro, script, timeout = 4500) {
  const args = distro
    ? ["-d", distro, "-e", "bash", "-lc", script]
    : ["-e", "bash", "-lc", script];
  return runWslCommand(args, timeout);
}

function createTerminalSourceAdapterService(options = {}) {
  const isQuitting = typeof options.isQuitting === "function" ? options.isQuitting : () => Boolean(options.isQuitting);
  const isRendererSmoke = typeof options.isRendererSmoke === "function" ? options.isRendererSmoke : () => Boolean(options.isRendererSmoke);
  const sendTerminalEvent = typeof options.sendTerminalEvent === "function" ? options.sendTerminalEvent : () => {};
  const shellQuote = typeof options.shellQuote === "function" ? options.shellQuote : (value) => "'" + String(value ?? "").replace(/'/g, "'\"'\"'") + "'";
  const homeDir = typeof options.homeDir === "string" && options.homeDir ? options.homeDir : os.homedir();
  const claudePollMs = Number(options.claudePollMs) > 0 ? Number(options.claudePollMs) : TERMINAL_SOURCE_ADAPTER_POLL_MS;
  const hermesPollMs = Number(options.hermesPollMs) > 0 ? Number(options.hermesPollMs) : TERMINAL_HERMES_SOURCE_ADAPTER_POLL_MS;
  const hermesSessionDirsOverride = Array.isArray(options.hermesSessionDirs)
    ? options.hermesSessionDirs.filter((dir) => typeof dir === "string" && dir)
    : null;
  const terminalSourceAdapters = new Map();

  function terminalSourceAdapterProfile(tool) {
    const text = `${tool?.toolKind || ""} ${tool?.id || ""} ${tool?.name || ""} ${tool?.command || ""} ${Array.isArray(tool?.args) ? tool.args.join(" ") : ""}`.toLowerCase();
    if (text.includes("claude")) return "claude";
    if (text.includes("hermes")) return "hermes";
    return "";
  }

  function clampSourceAdapterText(value) {
    const text = cleanImportedConversationText(value || "");
    return text.length > TERMINAL_SOURCE_ADAPTER_TEXT_LIMIT
      ? `${text.slice(0, TERMINAL_SOURCE_ADAPTER_TEXT_LIMIT - 14)}\n...[已截断]`
      : text;
  }

  function sourceAdapterContentText(content) {
    if (content == null) return "";
    if (typeof content === "string") return clampSourceAdapterText(content);
    if (Array.isArray(content)) {
      return clampSourceAdapterText(content
        .map((part) => {
          if (typeof part === "string") return part;
          if (!part || typeof part !== "object") return "";
          const type = String(part.type || part.kind || "").toLowerCase();
          if (type === "thinking" || type === "reasoning" || type === "tool_use" || type === "tool_call" || type === "tool_result") return "";
          if (type === "text" || type === "input_text" || type === "output_text" || typeof part.text === "string") {
            return part.text || part.content || "";
          }
          if (Array.isArray(part.content)) return sourceAdapterContentText(part.content);
          if (typeof part.content === "string") return part.content;
          return "";
        })
        .filter(Boolean)
        .join("\n\n"));
    }
    if (typeof content === "object") {
      const type = String(content.type || content.kind || "").toLowerCase();
      if (type === "thinking" || type === "reasoning" || type === "tool_use" || type === "tool_call" || type === "tool_result") return "";
      if (typeof content.text === "string") return clampSourceAdapterText(content.text);
      if (typeof content.content === "string") return clampSourceAdapterText(content.content);
      if (Array.isArray(content.content)) return sourceAdapterContentText(content.content);
      if (content.message) return sourceAdapterContentText(content.message.content || content.message);
    }
    return "";
  }

  function sourceAdapterThinkingText(content) {
    if (!content) return "";
    if (Array.isArray(content)) {
      return clampSourceAdapterText(content
        .map((part) => {
          if (!part || typeof part !== "object") return "";
          const type = String(part.type || part.kind || "").toLowerCase();
          if (type === "thinking" || type === "reasoning") return part.thinking || part.text || part.content || "";
          return sourceAdapterThinkingText(part.content);
        })
        .filter(Boolean)
        .join("\n\n"));
    }
    if (typeof content === "object") {
      const type = String(content.type || content.kind || "").toLowerCase();
      if (type === "thinking" || type === "reasoning") return clampSourceAdapterText(content.thinking || content.text || content.content || "");
      if (content.reasoning || content.reasoning_content) return clampSourceAdapterText(content.reasoning || content.reasoning_content);
      if (Array.isArray(content.content)) return sourceAdapterThinkingText(content.content);
    }
    return "";
  }

  function cleanSourceAdapterAssistantText(text, profile) {
    let next = String(text || "").trim();
    if (profile === "hermes") {
      next = next
        .split(/\r?\n/)
        .filter((line) => !/^◆\s*Model\s*:/i.test(line.trim()))
        .join("\n")
        .trim();
    }
    return next;
  }

  function sourceAdapterToolTone(name) {
    const text = String(name || "").toLowerCase();
    if (/write|create/.test(text)) return "write";
    if (/edit|update|patch|multi/.test(text)) return "edit";
    if (/read|glob|grep|ls|list/.test(text)) return "read";
    if (/bash|shell|run|exec|command/.test(text)) return "run";
    return "info";
  }

  function sourceAdapterToolDetail(record) {
    const input = record?.input && typeof record.input === "object" ? record.input : {};
    const detail = input.file_path || input.path || input.filename || input.file || input.command || record.file_path || record.path || "";
    const name = String(record?.name || record?.tool_name || record?.tool || record?.type || record?.kind || "tool").trim();
    return {
      label: name || "工具",
      detail: String(detail || "").slice(0, 1000),
      tone: sourceAdapterToolTone(name || detail)
    };
  }

  function sourceAdapterToolEvents(content, createdAt) {
    if (!content) return [];
    if (Array.isArray(content)) return content.flatMap((part) => sourceAdapterToolEvents(part, createdAt));
    if (typeof content !== "object") return [];
    const type = String(content.type || content.kind || "").toLowerCase();
    const events = [];
    if (/tool_(?:use|call)|function_call/.test(type)) {
      const tool = sourceAdapterToolDetail(content);
      events.push({
        kind: "tool_call",
        tone: tool.tone,
        label: tool.label,
        detail: tool.detail,
        source: "adapter",
        createdAt
      });
    }
    if (/tool_result|function_result/.test(type)) {
      const text = sourceAdapterContentText(content.content || content.result || content.output || content.text || "");
      if (text) events.push({ kind: "tool_result", text, source: "adapter", createdAt });
    }
    if (Array.isArray(content.content)) events.push(...sourceAdapterToolEvents(content.content, createdAt));
    if (content.message) events.push(...sourceAdapterToolEvents(content.message.content || content.message, createdAt));
    return events;
  }

  function sourceAdapterEventsFromRoleMessage(role, content, rawMessage, createdAt, profile) {
    const events = [];
    const toolEvents = sourceAdapterToolEvents(content, createdAt);
    if (role === "assistant") {
      const thinking = sourceAdapterThinkingText(content) || sourceAdapterThinkingText(rawMessage);
      if (thinking) {
        events.push({
          kind: "status",
          label: "阶段",
          status: profile === "hermes" ? "Hermes 正在整理回复" : "Claude 正在整理回复",
          text: profile === "hermes" ? "Hermes 正在整理回复。" : "Claude 正在整理回复。",
          summary: "thinking",
          source: "adapter",
          createdAt: createdAt - 1
        });
      }
      events.push(...toolEvents);
      const text = cleanSourceAdapterAssistantText(
        sourceAdapterContentText(content || rawMessage?.content || rawMessage?.text || rawMessage?.message || rawMessage?.response || rawMessage?.output || ""),
        profile
      );
      if (text) events.push({ kind: "assistant_message", text, source: "adapter", createdAt });
      return events;
    }
    if (role === "user") {
      const text = sourceAdapterContentText(content);
      if (text) events.push({ kind: "user_message", text, source: "adapter", createdAt });
      else events.push(...toolEvents);
      return events;
    }
    if (role === "tool") {
      const text = sourceAdapterContentText(content || rawMessage?.content || "");
      if (text) events.push({ kind: "tool_result", text, source: "adapter", createdAt });
    }
    return events;
  }

  function sourceAdapterEventTextSignature(text) {
    const value = String(text || "");
    if (value.length <= 480) return value;
    return `${value.length}:${value.slice(0, 240)}:${value.slice(-160)}`;
  }

  function sourceAdapterEventKey(event) {
    if (!event || !event.kind) return "";
    return [
      event.kind,
      event.source || "",
      Number.isFinite(event.createdAt) ? String(event.createdAt) : "",
      event.status || "",
      event.label || "",
      event.detail || "",
      event.summary || "",
      event.tone || "",
      sourceAdapterEventTextSignature(event.text)
    ].join("\u0001");
  }

  function filterNewSourceAdapterEvents(state, events) {
    if (!Array.isArray(events) || !events.length) return [];
    if (!(state.sentEventKeys instanceof Set)) state.sentEventKeys = new Set();
    const nextEvents = [];
    for (const event of events) {
      const key = sourceAdapterEventKey(event);
      if (key && state.sentEventKeys.has(key)) continue;
      if (key) state.sentEventKeys.add(key);
      nextEvents.push(event);
    }
    if (state.sentEventKeys.size > 1000) {
      state.sentEventKeys = new Set([...state.sentEventKeys].slice(-500));
    }
    return nextEvents;
  }

  function sourceAdapterEventsFromClaudeJsonLine(line, minTimestamp) {
    const trimmed = String(line || "").trim();
    if (!trimmed || !trimmed.startsWith("{")) return [];
    let record;
    try {
      record = JSON.parse(trimmed);
    } catch {
      return [];
    }
    const createdAt = parseTimestampMs(record.timestamp) || Date.now();
    if (createdAt < minTimestamp) return [];
    const message = record.message && typeof record.message === "object" ? record.message : null;
    if (!message) return [];
    const role = String(message.role || record.type || "").toLowerCase();
    if (role !== "user" && role !== "assistant" && role !== "tool") return [];
    return sourceAdapterEventsFromRoleMessage(role, message.content, message, createdAt, "claude");
  }

  function sourceAdapterEventsFromHermesMessage(message, index, baseTimestamp) {
    if (!message || typeof message !== "object") return [];
    const role = String(message.role || message.sender || message.type || message.author || "").toLowerCase();
    if (role !== "user" && role !== "assistant" && role !== "tool") return [];
    const createdAt = parseGenericSessionTimestamp(message.timestamp || message.created_at || message.createdAt || message.time || message.at) || (baseTimestamp + index);
    const content = message.content || message.text || message.message || message.response || message.output || "";
    const events = sourceAdapterEventsFromRoleMessage(role, content, message, createdAt, "hermes");
    if (role === "assistant" && message.tool_calls) {
      events.push(...sourceAdapterToolEvents(message.tool_calls, createdAt));
    }
    return events;
  }

  function sendTerminalSourceAdapterEvents(win, sessionId, tool, sourceEvents, ownership = {}) {
    const events = (sourceEvents || [])
      .filter((event) => event && event.kind)
      .map((event) => ({ ...ownership, ...event }));
    if (!events.length) return;
    sendTerminalEvent(win, "terminal:data", {
      ...ownership,
      id: sessionId,
      toolId: tool.id,
      data: "",
      sourceEvents: events
    });
  }

  function claudeProjectFolderNameForCwd(cwd) {
    return path.resolve(cwd || ".")
      .replace(/[:\\/]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function readLocalFileTail(filePath, limit = TERMINAL_SOURCE_ADAPTER_TEXT_LIMIT) {
    const stats = fs.statSync(filePath);
    const length = Math.min(stats.size, limit);
    if (!length) return "";
    const start = Math.max(0, stats.size - length);
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(filePath, "r");
    try {
      fs.readSync(fd, buffer, 0, length, start);
    } finally {
      fs.closeSync(fd);
    }
    return buffer.toString("utf8");
  }

  function sourceAdapterCandidateRecentInputMatch(candidate, state, readText) {
    const inputs = sourceAdapterRecentInputs(state);
    if (!inputs.length) return null;
    let text = "";
    try {
      text = String(readText(candidate.filePath) || "");
    } catch {
      return null;
    }
    const minTimestamp = state.startedAt - TERMINAL_SOURCE_ADAPTER_FILE_GRACE_MS;
    const messageMatches = (role, content, timestamp) => {
      if (String(role || "").toLowerCase() !== "user") return false;
      const createdAt = parseGenericSessionTimestamp(timestamp);
      if (createdAt && createdAt < minTimestamp) return false;
      const normalized = normalizeTerminalSourceAdapterInputText(sourceAdapterContentText(content));
      if (!normalized) return false;
      const input = inputs.find((entry) => normalized.includes(entry.text));
      if (!input) return false;
      const deltaMs = createdAt && input.createdAt ? Math.abs(createdAt - input.createdAt) : Number.MAX_SAFE_INTEGER;
      return { input, createdAt, deltaMs };
    };
    let bestMatch = null;
    const acceptMatch = (match) => {
      if (!match) return;
      if (!bestMatch || match.deltaMs < bestMatch.deltaMs || (match.deltaMs === bestMatch.deltaMs && match.createdAt > bestMatch.createdAt)) {
        bestMatch = match;
      }
    };
    try {
      const parsed = JSON.parse(text);
      const messages = Array.isArray(parsed?.messages)
        ? parsed.messages
        : Array.isArray(parsed?.conversation)
          ? parsed.conversation
          : Array.isArray(parsed?.turns)
            ? parsed.turns
            : [];
      if (messages.length) {
        for (const message of messages) {
          acceptMatch(messageMatches(
          message.role || message.sender || message.type || message.author,
          message.content || message.text || message.message || "",
          message.timestamp || message.created_at || message.createdAt || message.time || message.at
          ));
        }
        return bestMatch;
      }
    } catch {
      // Claude JSONL is handled line by line below.
    }
    let sawStructuredLine = false;
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) continue;
      try {
        const record = JSON.parse(trimmed);
        sawStructuredLine = true;
        const message = record.message && typeof record.message === "object" ? record.message : record;
        acceptMatch(messageMatches(
          message.role || record.type,
          message.content || record.content || message.text || message.message || "",
          record.timestamp || message.timestamp || record.created_at || record.createdAt
        ));
      } catch {
        // Ignore partial JSONL lines while the agent is writing.
      }
    }
    if (bestMatch) return bestMatch;
    if (sawStructuredLine) return null;
    const normalizedText = normalizeTerminalSourceAdapterInputText(text);
    const input = inputs.find((entry) => normalizedText.includes(entry.text));
    return input ? { input, createdAt: 0, deltaMs: Number.MAX_SAFE_INTEGER } : null;
  }

  function sourceAdapterCandidateStartedAt(candidate) {
    const stats = candidate?.stats || candidate;
    return sourceAdapterFileStartedAt(stats);
  }

  function selectSourceAdapterCandidate(candidates, state, readText) {
    const viable = (candidates || []).filter((candidate) => candidate?.filePath);
    if (!viable.length) return null;
    const scored = viable.map((candidate) => ({
      candidate,
      inputMatch: sourceAdapterCandidateRecentInputMatch(candidate, state, readText),
      startedAt: sourceAdapterCandidateStartedAt(candidate),
      mtimeMs: Number(candidate?.mtimeMs || candidate?.stats?.mtimeMs) || 0
    }));
    const matched = scored.filter((item) => item.inputMatch);
    if (matched.length) {
      matched.sort((a, b) => {
        const aDelta = Number(a.inputMatch?.deltaMs) || Number.MAX_SAFE_INTEGER;
        const bDelta = Number(b.inputMatch?.deltaMs) || Number.MAX_SAFE_INTEGER;
        return aDelta - bDelta
          || (Number(b.inputMatch?.createdAt) || 0) - (Number(a.inputMatch?.createdAt) || 0)
          || b.mtimeMs - a.mtimeMs
          || b.startedAt - a.startedAt;
      });
      return matched[0].candidate;
    }
    return null;
  }

  function boundLocalSourceAdapterCandidate(state) {
    if (!state.filePath || /^\\\\/.test(String(state.filePath || "")) === false && state.profile === "hermes") return null;
    try {
      const stats = fs.statSync(state.filePath);
      if (Number(state.offset) > 0 && stats.size < Number(state.offset)) return null;
      return { filePath: state.filePath, stats, mtimeMs: stats.mtimeMs, size: stats.size };
    } catch {
      return null;
    }
  }

  function bindSourceAdapterFile(state, candidate) {
    if (!candidate?.filePath || state.filePath === candidate.filePath) return;
    state.filePath = candidate.filePath;
    state.boundAt = Date.now();
    state.offset = 0;
    state.buffer = "";
    state.sentMessageCount = 0;
    state.lastSize = 0;
    state.lastMtimeMs = 0;
    state.sentEventKeys = new Set();
  }

  function findLatestClaudeJsonl(cwd, startedAt, state) {
    const projectsRoot = path.join(homeDir, ".claude", "projects");
    const preferredDir = path.join(projectsRoot, claudeProjectFolderNameForCwd(cwd));
    const dirs = [];
    if (fs.existsSync(preferredDir)) dirs.push(preferredDir);
    if (!dirs.length && fs.existsSync(projectsRoot)) {
      for (const entry of fs.readdirSync(projectsRoot, { withFileTypes: true })) {
        if (entry.isDirectory()) dirs.push(path.join(projectsRoot, entry.name));
      }
    }
    const candidates = [];
    for (const dir of dirs.slice(0, 80)) {
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".jsonl")) continue;
        const filePath = path.join(dir, entry.name);
        try {
          const stats = fs.statSync(filePath);
          if (sourceAdapterCandidateIsFresh(stats, startedAt)) {
            candidates.push({ filePath, stats });
          }
        } catch {
          // Ignore files being rotated while Claude writes.
        }
      }
    }
    return selectSourceAdapterCandidate(candidates, state, readLocalFileTail);
  }

  function readFileChunkFromOffset(filePath, offset) {
    const stats = fs.statSync(filePath);
    const start = Math.max(0, Math.min(Number(offset) || 0, stats.size));
    const length = Math.max(0, stats.size - start);
    if (!length) return { text: "", offset: stats.size, stats };
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(filePath, "r");
    try {
      fs.readSync(fd, buffer, 0, length, start);
    } finally {
      fs.closeSync(fd);
    }
    return { text: buffer.toString("utf8"), offset: stats.size, stats };
  }

  function pollClaudeSourceAdapter(state) {
    const bound = boundLocalSourceAdapterCandidate(state);
    if (!bound && state.filePath) {
      state.filePath = "";
      state.offset = 0;
      state.buffer = "";
    }
    const candidate = bound || findLatestClaudeJsonl(state.cwd, state.startedAt, state);
    if (!candidate) return [];
    bindSourceAdapterFile(state, candidate);
    const chunk = readFileChunkFromOffset(candidate.filePath, state.offset || 0);
    state.offset = chunk.offset;
    if (!chunk.text) return [];
    const text = `${state.buffer || ""}${chunk.text}`;
    const lines = text.split(/\r?\n/);
    state.buffer = lines.pop() || "";
    return lines.flatMap((line) => sourceAdapterEventsFromClaudeJsonLine(line, state.startedAt - TERMINAL_SOURCE_ADAPTER_FILE_GRACE_MS));
  }

  function wslDistroForTool(tool) {
    const args = Array.isArray(tool?.args) ? tool.args.map((arg) => String(arg)) : [];
    const distroFlagIndex = args.findIndex((arg) => arg === "-d" || arg === "--distribution");
    if (distroFlagIndex >= 0 && args[distroFlagIndex + 1]) return args[distroFlagIndex + 1];
    return "";
  }

  function wslDistroNamesForSourceAdapter(distro) {
    const names = [];
    const add = (value) => {
      const name = String(value || "").replace(/\u0000/g, "").trim();
      if (name && !names.includes(name)) names.push(name);
    };
    add(distro);
    for (const name of listWslDistributions()) add(name);
    return names;
  }

  function hermesSessionDirectoriesFromWslUnc(distro) {
    if (hermesSessionDirsOverride) return hermesSessionDirsOverride;
    if (process.platform !== "win32") return [];
    const dirs = [];
    for (const distroName of wslDistroNamesForSourceAdapter(distro)) {
      for (const prefix of ["\\\\wsl.localhost\\", "\\\\wsl$\\"]) {
        const root = `${prefix}${distroName}`;
        const rootSessionDir = path.join(root, "root", ".hermes", "sessions");
        if (fs.existsSync(rootSessionDir)) dirs.push(rootSessionDir);
        const homeRoot = path.join(root, "home");
        let homeEntries = [];
        try {
          homeEntries = fs.readdirSync(homeRoot, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const entry of homeEntries) {
          if (!entry.isDirectory()) continue;
          const sessionDir = path.join(homeRoot, entry.name, ".hermes", "sessions");
          if (fs.existsSync(sessionDir)) dirs.push(sessionDir);
        }
      }
    }
    return [...new Set(dirs)];
  }

  function hermesSessionDirectoriesForSourceAdapterState(state) {
    const now = Date.now();
    const cachedDirs = Array.isArray(state.hermesSessionDirs) ? state.hermesSessionDirs : null;
    const cacheTtl = cachedDirs?.length ? TERMINAL_HERMES_SESSION_DIR_CACHE_MS : Math.min(3000, TERMINAL_HERMES_SESSION_DIR_CACHE_MS);
    if (cachedDirs && now - (state.hermesSessionDirsAt || 0) < cacheTtl) return cachedDirs;
    const dirs = hermesSessionDirectoriesFromWslUnc(state.distro);
    state.hermesSessionDirs = dirs;
    state.hermesSessionDirsAt = now;
    return dirs;
  }

  function latestHermesSessionMetaFromWslUnc(distro, startedAt, sessionDirs, state) {
    const candidatesByName = new Map();
    for (const dir of sessionDirs || hermesSessionDirectoriesFromWslUnc(distro)) {
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;
        const filePath = path.join(dir, entry.name);
        try {
          const stats = fs.statSync(filePath);
          if (sourceAdapterCandidateIsFresh(stats, startedAt)) {
            const candidate = { filePath, stats, mtimeMs: stats.mtimeMs, size: stats.size };
            const existing = candidatesByName.get(entry.name);
            if (!existing || candidate.mtimeMs > existing.mtimeMs || (candidate.mtimeMs === existing.mtimeMs && candidate.filePath.includes("\\\\wsl.localhost\\"))) {
              candidatesByName.set(entry.name, candidate);
            }
          }
        } catch {
          // Ignore session files being rotated while Hermes writes.
        }
      }
    }
    return selectSourceAdapterCandidate([...candidatesByName.values()], state, readLocalFileTail);
  }

  function boundHermesSessionMeta(state) {
    if (!state.filePath) return null;
    if (fs.existsSync(state.filePath)) {
      try {
        const stats = fs.statSync(state.filePath);
        if (Number(state.lastSize) > 0 && stats.size < Number(state.lastSize)) return null;
        return { filePath: state.filePath, stats, mtimeMs: stats.mtimeMs, size: stats.size };
      } catch {
        return null;
      }
    }
    const script = `if [ -f ${shellQuote(state.filePath)} ]; then stat -c '%Y\\t%s\\t%n' ${shellQuote(state.filePath)}; fi`;
    const line = runWslImportCommand(state.distro, script, 3500).split(/\r?\n/).find(Boolean);
    if (!line) return null;
    const [mtimeText, sizeText, ...pathParts] = line.split("\t");
    const mtimeMs = Math.round((Number(mtimeText) || 0) * 1000);
    const size = Number(sizeText) || 0;
    if (Number(state.lastSize) > 0 && size < Number(state.lastSize)) return null;
    return { filePath: pathParts.join("\t") || state.filePath, mtimeMs, size };
  }

  function latestHermesSessionMeta(distro, startedAt, state) {
    const bound = boundHermesSessionMeta(state || {});
    if (bound) return bound;
    if (state?.filePath) {
      state.filePath = "";
      state.sentMessageCount = 0;
      state.lastSize = 0;
      state.lastMtimeMs = 0;
    }
    const uncCandidate = latestHermesSessionMetaFromWslUnc(
      distro,
      startedAt,
      state ? hermesSessionDirectoriesForSourceAdapterState(state) : undefined,
      state
    );
    if (uncCandidate) return uncCandidate;
    const script = [
      "if [ -d \"$HOME/.hermes/sessions\" ]; then",
      "  find \"$HOME/.hermes/sessions\" -maxdepth 1 -type f -name '*.json' -printf '%T@\\t%s\\t%p\\n' 2>/dev/null | sort -nr | head -n 1;",
      "fi"
    ].join(" ");
    const line = runWslImportCommand(distro, script, 4500).split(/\r?\n/).find(Boolean);
    if (!line) return null;
    const [mtimeText, sizeText, ...pathParts] = line.split("\t");
    const filePath = pathParts.join("\t");
    const mtimeMs = Math.round((Number(mtimeText) || 0) * 1000);
    if (!filePath || mtimeMs < startedAt - TERMINAL_SOURCE_ADAPTER_FILE_GRACE_MS) return null;
    const needles = sourceAdapterRecentInputNeedles(state);
    if (!needles.length) return null;
    const raw = runWslImportCommand(distro, `tail -c ${TERMINAL_SOURCE_ADAPTER_TEXT_LIMIT} ${shellQuote(filePath)}`, 4500);
    const normalized = normalizeTerminalSourceAdapterInputText(raw);
    if (!needles.some((needle) => normalized.includes(needle))) return null;
    return { filePath, mtimeMs, size: Number(sizeText) || 0 };
  }

  function readHermesSessionJson(distro, filePath) {
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch {
        return null;
      }
    }
    const raw = runWslImportCommand(distro, `cat ${shellQuote(filePath)}`, 7000);
    if (!raw || raw.includes("Windows Subsystem for Linux")) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function pollHermesSourceAdapter(state) {
    const meta = latestHermesSessionMeta(state.distro, state.startedAt, state);
    if (!meta) return [];
    bindSourceAdapterFile(state, meta);
    if (state.lastSize === meta.size && state.lastMtimeMs === meta.mtimeMs) return [];
    const parsed = readHermesSessionJson(state.distro, meta.filePath);
    if (!parsed) return [];
    const messages = Array.isArray(parsed?.messages)
      ? parsed.messages
      : Array.isArray(parsed?.conversation)
        ? parsed.conversation
        : Array.isArray(parsed?.turns)
          ? parsed.turns
          : [];
    if (!messages.length) return [];
    state.lastSize = meta.size;
    state.lastMtimeMs = meta.mtimeMs;
    if (messages.length <= state.sentMessageCount) return [];
    const baseTimestamp = parseGenericSessionTimestamp(parsed?.session_start || parsed?.started_at || parsed?.created_at) || Date.now();
    const events = messages
      .slice(state.sentMessageCount)
      .flatMap((message, index) => sourceAdapterEventsFromHermesMessage(message, state.sentMessageCount + index, baseTimestamp));
    state.sentMessageCount = messages.length;
    return events;
  }

  function startTerminalSourceAdapter(win, sessionId, tool, cwd, startedAt = Date.now(), ownership = {}) {
    if (isRendererSmoke()) return;
    if (terminalSourceAdapters.has(sessionId)) return;
    const profile = terminalSourceAdapterProfile(tool);
    if (profile !== "claude" && profile !== "hermes") return;
    const state = {
      profile,
      cwd,
      distro: profile === "hermes" ? wslDistroForTool(tool) : "",
      startedAt,
      filePath: "",
      offset: 0,
      buffer: "",
      sentMessageCount: 0,
      sentEventKeys: new Set(),
      lastSize: 0,
      lastMtimeMs: 0,
      inputBuffer: "",
      recentUserInputs: [],
      hermesSessionDirs: null,
      hermesSessionDirsAt: 0,
      polling: false,
      timer: null
    };
    const poll = () => {
      if (state.polling || isQuitting()) return;
      state.polling = true;
      try {
        const events = profile === "claude"
          ? pollClaudeSourceAdapter(state)
          : pollHermesSourceAdapter(state);
        sendTerminalSourceAdapterEvents(win, sessionId, tool, filterNewSourceAdapterEvents(state, events), ownership);
      } catch {
        // Native agent logs are an opportunistic semantic source; terminal fallback remains available.
      } finally {
        state.polling = false;
      }
    };
    state.timer = setInterval(poll, profile === "hermes" ? hermesPollMs : claudePollMs);
    terminalSourceAdapters.set(sessionId, state);
    setTimeout(poll, 250);
  }

  function stopTerminalSourceAdapter(id) {
    const adapter = terminalSourceAdapters.get(id);
    if (!adapter) return;
    terminalSourceAdapters.delete(id);
    if (adapter.timer) clearInterval(adapter.timer);
  }

  function recordTerminalSourceAdapterInput(id, data) {
    const adapter = terminalSourceAdapters.get(id);
    if (!adapter) return;
    recordTerminalSourceAdapterInputState(adapter, data);
  }



  return {
    recordTerminalSourceAdapterInput,
    startTerminalSourceAdapter,
    stopTerminalSourceAdapter
  };
}

module.exports = {
  createTerminalSourceAdapterService,
  __test: {
    normalizeTerminalSourceAdapterInputText,
    recordTerminalSourceAdapterInputState,
    sourceAdapterCandidateIsFresh,
    sourceAdapterFileStartedAt,
    sourceAdapterRecentInputNeedles
  }
};

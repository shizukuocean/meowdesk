const fs = require("fs");
const path = require("path");

const CONVERSATION_IMPORT_SCAN_INTERVAL_MS = 6000;
const MAX_IMPORTED_CONVERSATIONS = 500;
const MAX_IMPORTED_WSL_CONVERSATIONS = 80;
const MAX_IMPORTED_HERMES_DB_CONVERSATIONS = 500;
const MAX_IMPORTED_HERMES_DB_MESSAGES = 24;
const MAX_IMPORTED_CONVERSATION_MESSAGES = 160;
const MAX_IMPORTED_CONVERSATION_BYTES = 8 * 1024 * 1024;
const HERMES_WSL_SESSION_ROOTS = [
  "$HOME/.hermes/sessions"
];

function defaultShellQuote(value) {
  const quoted = String(value ?? "").replace(/'/g, "'\"'\"'");
  return "'" + quoted + "'";
}

function createConversationService(options = {}) {
  const {
    ensureDirectory,
    getConversationDirectory,
    getHomePath = () => "",
    invalidateAgentInterfaceCache = () => {},
    notifyConversationsChanged = () => {},
    shellQuote = defaultShellQuote
  } = options;
  if (typeof ensureDirectory !== "function") throw new Error("createConversationService requires ensureDirectory.");
  if (typeof getConversationDirectory !== "function") throw new Error("createConversationService requires getConversationDirectory.");

  const conversationMirrors = new Map();
  const conversationImportCache = new Map();
  let conversationImportSnapshot = { at: 0, conversations: [], sources: [], mode: "light" };

  function safeFilePart(value, fallback = "conversation") {
    return String(value || fallback)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || fallback;
  }

  function canonicalConversationAgent(agent, agentId = "", toolKind = "") {
    const rawAgent = String(agent || "").trim();
    const normalized = `${toolKind || ""} ${agentId || ""} ${rawAgent}`.toLowerCase();
    if (normalized.includes("claude")) {
      return { id: "claude", name: "Claude Code", toolKind: "claude" };
    }
    if (normalized.includes("hermes")) {
      return { id: "hermes", name: "Hermes", toolKind: "hermes" };
    }
    if (normalized.includes("codex")) {
      return { id: "codex", name: "Codex", toolKind: "codex" };
    }
    if (normalized.includes("terminal") || normalized.includes("powershell") || normalized.includes("shell")) {
      return { id: "terminal", name: rawAgent || "Terminal", toolKind: "terminal" };
    }
    return {
      id: safeFilePart(agentId || rawAgent, "agent"),
      name: rawAgent || agentId || "Agent",
      toolKind: String(toolKind || "").trim()
    };
  }

  function timestampLabel(value = Date.now()) {
    const date = new Date(Number(value) || Date.now());
    const pad = (part) => String(part).padStart(2, "0");
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join("-") + " " + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join(":");
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

  function isoTimestamp(value) {
    const timestamp = parseTimestampMs(value);
    if (!timestamp) return "";
    try {
      return new Date(timestamp).toISOString();
    } catch {
      return "";
    }
  }

  function normalizeMirrorMessage(message) {
    if (!message || typeof message !== "object") return null;
    const role = String(message.role || "").trim().toLowerCase();
    if (!["user", "assistant", "system", "tool", "agent"].includes(role)) return null;
    const content = String(message.content || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!content) return null;
    return {
      role,
      content: content.slice(0, 24000),
      at: String(message.at || timestampLabel()).trim(),
      name: String(message.name || "").trim()
    };
  }

  function normalizeMirrorPayload(payload) {
    const input = payload && typeof payload === "object" ? payload : {};
    const paneId = safeFilePart(input.paneId || input.sessionId || "pane", "pane");
    const inputToolKind = String(input.toolKind || input.agentKind || "").trim();
    const canonicalAgent = canonicalConversationAgent(input.agent || input.agentName || input.name || "Agent", input.agentId, inputToolKind);
    const agent = canonicalAgent.name.slice(0, 120) || "Agent";
    const agentId = canonicalAgent.id;
    const conversationId = safeFilePart(input.conversationId || `${agentId}-${paneId}`, "conversation");
    const existing = conversationMirrors.get(conversationId);
    const createdAt = existing?.createdAt || Number(input.createdAt) || Date.now();
    const messages = Array.isArray(input.messages) ? input.messages.map(normalizeMirrorMessage).filter(Boolean) : [];
    const title = String(input.title || existing?.title || `${agent} 工作窗对话`).trim().slice(0, 160) || `${agent} 工作窗对话`;
    return {
      type: "meodesk-conversation",
      agent,
      agentId,
      conversationId,
      title,
      status: String(input.status || "active").trim() || "active",
      summary: String(input.summary || "").trim().slice(0, 2000),
      source: "Meodesk 工作窗镜像",
      toolKind: canonicalAgent.toolKind || inputToolKind,
      paneId: String(input.paneId || input.sessionId || "").trim(),
      projectPath: String(input.projectPath || input.cwd || "").trim(),
      cwd: String(input.cwd || "").trim(),
      resumeCommand: String(input.resumeCommand || "").trim(),
      startedAt: String(input.startedAt || existing?.startedAt || timestampLabel(createdAt)).trim(),
      endedAt: String(input.endedAt || "").trim(),
      participants: [agent, "user"],
      messages,
      tags: ["meodesk", "local-mirror"],
      externalId: conversationId,
      createdAt,
      updatedAt: Number(input.updatedAt) || Date.now()
    };
  }

  function writeConversationMirror(payload) {
    const record = normalizeMirrorPayload(payload);
    if (!record.messages.length && record.status !== "closed") {
      return { ok: false, skipped: true, conversationId: record.conversationId };
    }
    const conversationsPath = getConversationDirectory();
    ensureDirectory(conversationsPath);
    const fileName = `conversation.${safeFilePart(record.agentId, "agent")}.${safeFilePart(record.conversationId, "conversation")}.json`;
    const filePath = path.join(conversationsPath, fileName);
    fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    conversationMirrors.set(record.conversationId, record);
    invalidateAgentInterfaceCache();
    notifyConversationsChanged({ conversationId: record.conversationId, fileName });
    return { ok: true, conversationId: record.conversationId, fileName, filePath, updatedAt: record.updatedAt };
  }


  function cleanImportedConversationText(value) {
    return String(value ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
      .replace(/\u001b\][^\u0007]*(\u0007|\u001b\\)/g, "")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();
  }

  function importedContentToText(content) {
    if (content == null) return "";
    if (typeof content === "string") return cleanImportedConversationText(content);
    if (!Array.isArray(content)) return cleanImportedConversationText(content.text || content.content || "");
    return cleanImportedConversationText(content.map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const type = String(part.type || "").toLowerCase();
      if (type === "text") return part.text || part.content || "";
      if (type === "input_text" || type === "output_text") return part.text || "";
      if (type === "thinking" || type === "tool_use" || type === "tool_result") return "";
      if (typeof part.text === "string") return part.text;
      return "";
    }).filter(Boolean).join("\n\n"));
  }

  function truncateImportedText(value, limit = 24000) {
    const text = cleanImportedConversationText(value);
    if (text.length <= limit) return text;
    return `${text.slice(0, limit - 14)}\n...[已截断]`;
  }

  function readTextForConversationImport(filePath, stats) {
    if (!stats || stats.size <= MAX_IMPORTED_CONVERSATION_BYTES) {
      return fs.readFileSync(filePath, "utf8");
    }

    const headSize = Math.min(512 * 1024, stats.size);
    const tailSize = Math.max(0, MAX_IMPORTED_CONVERSATION_BYTES - headSize);
    const head = Buffer.alloc(headSize);
    const tail = Buffer.alloc(tailSize);
    const fd = fs.openSync(filePath, "r");
    try {
      fs.readSync(fd, head, 0, headSize, 0);
      if (tailSize > 0) fs.readSync(fd, tail, 0, tailSize, stats.size - tailSize);
    } finally {
      fs.closeSync(fd);
    }
    return `${head.toString("utf8")}\n${tail.toString("utf8")}`;
  }

  function shortConversationTitle(value, fallback) {
    return cleanImportedConversationText(value || fallback || "对话记录")
      .replace(/\s+/g, " ")
      .slice(0, 120) || fallback || "对话记录";
  }

  function normalizeImportedConversationMessage(role, content, at, name = "") {
    const normalizedRole = ["user", "assistant", "system", "tool", "agent"].includes(role) ? role : "assistant";
    const text = truncateImportedText(content);
    if (!text) return null;
    return {
      role: normalizedRole,
      content: text,
      at: isoTimestamp(at) || String(at || "").trim(),
      name: String(name || "").trim()
    };
  }

  function parseClaudeJsonlConversation(raw, meta) {
    const messages = [];
    let title = "";
    let sessionId = meta.sessionId || path.basename(meta.fileName || "", ".jsonl");
    let projectPath = "";
    let model = "";
    let version = "";
    let startedAt = 0;
    let updatedAt = meta.modifiedAt || 0;

    for (const line of String(raw || "").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("{")) continue;
      let event;
      try {
        event = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (!event || typeof event !== "object") continue;
      if (event.sessionId) sessionId = String(event.sessionId);
      if (event.cwd && !projectPath) projectPath = String(event.cwd);
      if (event.version && !version) version = String(event.version);
      if (event.timestamp) {
        const at = parseTimestampMs(event.timestamp);
        if (at) {
          startedAt = startedAt ? Math.min(startedAt, at) : at;
          updatedAt = Math.max(updatedAt || 0, at);
        }
      }
      if (event.type === "ai-title" && event.aiTitle) {
        title = shortConversationTitle(event.aiTitle, title);
        continue;
      }
      if (!event.message || typeof event.message !== "object") continue;
      const role = String(event.message.role || event.type || "").toLowerCase();
      if (role !== "user" && role !== "assistant") continue;
      const text = importedContentToText(event.message.content);
      if (!text) continue;
      if (event.message.model && !model) model = String(event.message.model);
      const message = normalizeImportedConversationMessage(role, text, event.timestamp, role);
      if (message) messages.push(message);
    }

    if (!messages.length && !title) return null;
    const firstUserMessage = messages.find((message) => message.role === "user")?.content || "";
    const totalMessages = messages.length;
    const visibleMessages = messages.slice(-MAX_IMPORTED_CONVERSATION_MESSAGES);
    const provider = meta.provider || "claude-code";
    const canonicalAgent = canonicalConversationAgent(meta.agent || "Claude Code", meta.agentId || provider, meta.toolKind || "claude");
    const agent = canonicalAgent.name;
    const agentId = canonicalAgent.id;
    const conversationId = `${agentId}-${safeFilePart(sessionId || meta.fileName, "session")}`;
    return {
      type: "meodesk-conversation",
      agent,
      agentId,
      conversationId,
      title: title || shortConversationTitle(firstUserMessage, `${agent} ${sessionId}`),
      status: "closed",
      summary: totalMessages > visibleMessages.length
        ? `已显示最近 ${visibleMessages.length} 条，共 ${totalMessages} 条消息。`
        : "",
      source: meta.source || `${agent} 原生历史`,
      toolKind: canonicalAgent.toolKind || meta.toolKind || "claude",
      model,
      version,
      projectPath,
      cwd: projectPath,
      resumeCommand: meta.resumeCommand || `claude --resume ${sessionId}`,
      startedAt: isoTimestamp(startedAt),
      endedAt: isoTimestamp(updatedAt),
      participants: [agent, "user"],
      messages: visibleMessages,
      messageCount: totalMessages,
      tags: meta.tags || ["local-agent-history"],
      externalId: sessionId,
      createdAt: startedAt || meta.createdAt || meta.modifiedAt || Date.now(),
      updatedAt: updatedAt || meta.modifiedAt || Date.now(),
      importProvider: provider,
      importSourceId: meta.sourceId || provider
    };
  }

  function parseGenericSessionTimestamp(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value > 100000000000 ? value : value * 1000;
    }
    return parseTimestampMs(value);
  }

  function hermesMessageContent(message) {
    if (!message || typeof message !== "object") return "";
    return importedContentToText(
      message.content
      || message.text
      || message.message
      || message.response
      || message.output
      || message.reasoning
      || ""
    );
  }

  function collectHermesMessages(value, output = []) {
    if (Array.isArray(value)) {
      for (const item of value) collectHermesMessages(item, output);
      return output;
    }
    if (!value || typeof value !== "object") return output;
    const role = String(value.role || value.sender || value.type || value.author || "").toLowerCase();
    const content = hermesMessageContent(value);
    if (content && ["user", "assistant", "system", "tool"].includes(role)) {
      const message = normalizeImportedConversationMessage(
        role,
        content,
        value.timestamp || value.created_at || value.createdAt || value.time || value.at,
        value.name || value.author || role
      );
      if (message) output.push(message);
    }
    for (const key of ["messages", "conversation", "turns", "items", "entries", "transcript"]) {
      if (Array.isArray(value[key])) collectHermesMessages(value[key], output);
    }
    return output;
  }

  function collectHermesMetadata(value, meta = {}) {
    if (Array.isArray(value)) {
      for (const item of value) collectHermesMetadata(item, meta);
      return meta;
    }
    if (!value || typeof value !== "object") return meta;

    if (!meta.sessionId && value.session_id) meta.sessionId = String(value.session_id);
    if (!meta.sessionId && value.sessionId) meta.sessionId = String(value.sessionId);
    if (!meta.sessionId && value.id && typeof value.id === "string" && value.id.length > 6) meta.sessionId = String(value.id);
    if (!meta.title && (value.title || value.name || value.summary)) meta.title = String(value.title || value.name || value.summary);
    if (!meta.model && (value.model || value.model_name)) meta.model = String(value.model || value.model_name);
    if (!meta.version && value.version) meta.version = String(value.version);
    if (!meta.projectPath && (value.cwd || value.projectPath || value.workspace)) meta.projectPath = String(value.cwd || value.projectPath || value.workspace);
    if (!meta.status && value.status) meta.status = String(value.status);
    if (!meta.startedAt && (value.started_at || value.startedAt || value.created_at || value.createdAt)) meta.startedAt = value.started_at || value.startedAt || value.created_at || value.createdAt;
    if (!meta.updatedAt && (value.ended_at || value.endedAt || value.updated_at || value.updatedAt || value.last_message_at || value.lastMessageAt)) {
      meta.updatedAt = value.ended_at || value.endedAt || value.updated_at || value.updatedAt || value.last_message_at || value.lastMessageAt;
    }

    for (const key of ["messages", "conversation", "turns", "items", "entries", "transcript"]) {
      if (Array.isArray(value[key])) collectHermesMetadata(value[key], meta);
    }
    return meta;
  }

  function parseHermesSessionConversation(raw, meta) {
    const text = String(raw || "").trim();
    if (!text) return null;
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMessages = [];
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("{")) continue;
        try {
          collectHermesMessages(JSON.parse(trimmed), jsonMessages);
        } catch {
          // Skip malformed JSONL lines in partially written session dumps.
        }
      }
      if (!jsonMessages.length) return null;
      parsed = { messages: jsonMessages };
    }

    const metadata = collectHermesMetadata(parsed, {});
    const messages = collectHermesMessages(parsed);
    if (!messages.length) return null;
    const totalMessages = messages.length;
    const visibleMessages = messages.slice(-MAX_IMPORTED_CONVERSATION_MESSAGES);
    const sessionId = String(
      metadata.sessionId
      || parsed.conversation_id
      || parsed.conversationId
      || path.basename(meta.fileName || "", path.extname(meta.fileName || ""))
    ).trim();
    const startedAt = parseGenericSessionTimestamp(metadata.startedAt || meta.createdAt);
    const updatedAt = parseGenericSessionTimestamp(metadata.updatedAt || meta.modifiedAt);
    const firstUserMessage = visibleMessages.find((message) => message.role === "user")?.content || visibleMessages[0]?.content || "";
    const canonicalAgent = canonicalConversationAgent("Hermes", "hermes", "hermes");
    return {
      type: "meodesk-conversation",
      agent: canonicalAgent.name,
      agentId: canonicalAgent.id,
      conversationId: `${canonicalAgent.id}-${safeFilePart(sessionId || meta.fileName, "session")}`,
      title: shortConversationTitle(metadata.title || firstUserMessage, `Hermes ${sessionId}`),
      status: metadata.status ? String(metadata.status).trim().toLowerCase() : "closed",
      summary: totalMessages > visibleMessages.length
        ? `已显示最近 ${visibleMessages.length} 条，共 ${totalMessages} 条消息。`
        : "",
      source: meta.source || "Hermes WSL 会话文件",
      toolKind: canonicalAgent.toolKind,
      model: String(metadata.model || "").trim(),
      version: String(metadata.version || "").trim(),
      projectPath: String(metadata.projectPath || "").trim(),
      cwd: String(metadata.projectPath || "").trim(),
      resumeCommand: meta.resumeCommand || (sessionId ? `hermes --resume ${sessionId}` : "hermes"),
      startedAt: isoTimestamp(startedAt),
      endedAt: isoTimestamp(updatedAt),
      participants: ["Hermes", "user"],
      messages: visibleMessages,
      messageCount: totalMessages,
      tags: ["hermes", "wsl", "local-agent-history"],
      externalId: sessionId,
      createdAt: startedAt || meta.createdAt || meta.modifiedAt || Date.now(),
      updatedAt: updatedAt || meta.modifiedAt || Date.now(),
      importProvider: meta.provider || "hermes-wsl-sessions",
      importSourceId: meta.sourceId || "hermes-wsl-sessions"
    };
  }

  function parseHermesDbConversation(session, messages, meta) {
    if (!session || typeof session !== "object") return null;
    const sessionId = String(session.id || session.session_id || session.sessionId || "").trim();
    if (!sessionId) return null;
    const normalizedMessages = (Array.isArray(messages) ? messages : [])
      .map((message) => normalizeImportedConversationMessage(
        String(message.role || "assistant").toLowerCase(),
        hermesMessageContent(message) || message.content || message.reasoning || message.tool_calls || "",
        message.timestamp || message.created_at || message.createdAt || session.ended_at || session.started_at,
        message.role || ""
      ))
      .filter(Boolean);
    const totalMessages = Number(session.message_count || session.messageCount || normalizedMessages.length) || normalizedMessages.length;
    const visibleMessages = normalizedMessages.slice(-MAX_IMPORTED_CONVERSATION_MESSAGES);
    const firstUserMessage = visibleMessages.find((message) => message.role === "user")?.content || visibleMessages[0]?.content || "";
    const startedAt = parseGenericSessionTimestamp(session.started_at || session.startedAt || session.created_at || session.createdAt);
    const updatedAt = parseGenericSessionTimestamp(session.ended_at || session.endedAt || session.updated_at || session.updatedAt || session.last_message_at);
    const canonicalAgent = canonicalConversationAgent("Hermes", "hermes", "hermes");
    return {
      type: "meodesk-conversation",
      agent: canonicalAgent.name,
      agentId: canonicalAgent.id,
      conversationId: `${canonicalAgent.id}-${safeFilePart(sessionId, "session")}`,
      title: shortConversationTitle(session.title || firstUserMessage, `Hermes ${sessionId}`),
      status: String(session.status || "closed").trim().toLowerCase(),
      summary: totalMessages > visibleMessages.length
        ? `已显示最近 ${visibleMessages.length} 条，共 ${totalMessages} 条消息。`
        : "",
      source: meta.source || "Hermes WSL state.db",
      toolKind: canonicalAgent.toolKind,
      model: String(session.model || session.model_name || "").trim(),
      projectPath: String(session.cwd || session.projectPath || session.workspace || "").trim(),
      cwd: String(session.cwd || session.projectPath || session.workspace || "").trim(),
      resumeCommand: meta.resumeCommand || `wsl.exe -d ${meta.distro} -e bash -lc ${shellQuote(`hermes --resume ${sessionId}`)}`,
      startedAt: isoTimestamp(startedAt),
      endedAt: isoTimestamp(updatedAt),
      participants: ["Hermes", "user"],
      messages: visibleMessages,
      messageCount: totalMessages,
      tags: ["hermes", "wsl", "sqlite", "local-agent-history"],
      externalId: sessionId,
      createdAt: startedAt || updatedAt || Date.now(),
      updatedAt: updatedAt || startedAt || Date.now(),
      importProvider: meta.provider || "hermes-wsl-state-db",
      importSourceId: meta.sourceId || `hermes-wsl-state-db:${meta.distro}`
    };
  }

  function conversationImportItem(record, meta) {
    return {
      fileName: meta.fileName,
      path: meta.displayPath || meta.filePath,
      size: meta.size || 0,
      modifiedAt: record.updatedAt || meta.modifiedAt || 0,
      createdAt: record.createdAt || meta.createdAt || 0,
      request: record,
      error: "",
      provider: meta.provider || record.importProvider || ""
    };
  }

  function cachedConversationImport(cacheKey, builder) {
    const cached = conversationImportCache.get(cacheKey);
    if (cached) return cached;
    const built = builder();
    if (built) conversationImportCache.set(cacheKey, built);
    return built;
  }

  function scanClaudeCodeConversationFiles(projectsPath, meta = {}) {
    if (!fs.existsSync(projectsPath)) return [];
    const candidates = [];
    let projectEntries = [];
    try {
      projectEntries = fs.readdirSync(projectsPath, { withFileTypes: true });
    } catch {
      return [];
    }
    for (const projectEntry of projectEntries) {
      if (!projectEntry.isDirectory()) continue;
      const projectPath = path.join(projectsPath, projectEntry.name);
      let files = [];
      try {
        files = fs.readdirSync(projectPath, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const fileEntry of files) {
        if (!fileEntry.isFile() || !fileEntry.name.toLowerCase().endsWith(".jsonl")) continue;
        const filePath = path.join(projectPath, fileEntry.name);
        try {
          const stats = fs.statSync(filePath);
          candidates.push({ filePath, projectFolder: projectEntry.name, fileName: fileEntry.name, stats });
        } catch {
          // Ignore files that disappear during scanning.
        }
      }
    }
    candidates.sort((a, b) => (b.stats.mtimeMs || 0) - (a.stats.mtimeMs || 0));
    return candidates.slice(0, meta.limit || MAX_IMPORTED_CONVERSATIONS).map((candidate) => {
      const cacheKey = `${meta.provider || "claude-code"}:${candidate.filePath}:${candidate.stats.mtimeMs}:${candidate.stats.size}`;
      return cachedConversationImport(cacheKey, () => {
        const raw = readTextForConversationImport(candidate.filePath, candidate.stats);
        const record = parseClaudeJsonlConversation(raw, {
          provider: meta.provider || "claude-code",
          agent: meta.agent || "Claude Code",
          agentId: meta.agentId || "claude-code",
          source: meta.source || "Claude Code 原生历史",
          toolKind: meta.toolKind || "claude",
          tags: meta.tags || ["claude-code", "local-agent-history"],
          fileName: candidate.fileName,
          filePath: candidate.filePath,
          sessionId: path.basename(candidate.fileName, ".jsonl"),
          size: candidate.stats.size,
          modifiedAt: candidate.stats.mtimeMs,
          createdAt: candidate.stats.birthtimeMs
        });
        return record ? conversationImportItem(record, {
          provider: meta.provider || "claude-code",
          fileName: candidate.fileName,
          filePath: candidate.filePath,
          size: candidate.stats.size,
          modifiedAt: candidate.stats.mtimeMs,
          createdAt: candidate.stats.birthtimeMs
        }) : null;
      });
    }).filter(Boolean);
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

  function runWslJsonCommand(distro, script, timeout = 7000) {
    const raw = runWslImportCommand(distro, script, timeout).trim();
    if (!raw || raw.includes("Windows Subsystem for Linux")) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function detectWslSqliteCommand(distro) {
    const script = [
      "if command -v sqlite3 >/dev/null 2>&1; then command -v sqlite3;",
      "elif [ -x \"$HOME/.local/bin/sqlite3\" ]; then printf '%s\\n' \"$HOME/.local/bin/sqlite3\";",
      "else printf ''; fi"
    ].join(" ");
    return runWslImportCommand(distro, script, 3000).split(/\r?\n/)[0]?.trim() || "";
  }

  function sqliteQuote(value) {
    return `'${String(value ?? "").replace(/'/g, "''")}'`;
  }

  function wslSqliteJsonScript(sqliteCommand, dbPath, sql) {
    const quotedSqlite = shellQuote(sqliteCommand);
    const quotedDb = String(dbPath || "").includes("$HOME")
      ? `"${String(dbPath).replace(/"/g, '\\"')}"`
      : shellQuote(dbPath);
    const quotedSql = shellQuote(sql);
    return [
      `if ${quotedSqlite} ${quotedDb} -json ${quotedSql} 2>/dev/null; then`,
      "  :;",
      "else",
      `  ${quotedSqlite} -json ${quotedDb} ${quotedSql};`,
      "fi"
    ].join(" ");
  }

  function scanWslClaudeStyleConversationFiles() {
    const distros = safeListWslDistributions();
    if (!distros.length) return [];

    const listScript = [
      "for root in \"$HOME/.claude/projects\"; do",
      "  if [ -d \"$root\" ]; then",
      "    find \"$root\" -maxdepth 2 -type f -name '*.jsonl' -printf '%T@\\t%s\\t%p\\n' 2>/dev/null;",
      "  fi;",
      "done | sort -nr | head -n 80"
    ].join(" ");

    const results = [];
    for (const distro of distros) {
      let listed = [];
      try {
        listed = runWslImportCommand(distro, listScript, 5000)
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && line.includes("\t"));
      } catch {
        listed = [];
      }
      if (!listed.length) continue;

      for (const line of listed.slice(0, MAX_IMPORTED_WSL_CONVERSATIONS)) {
        const [mtimeText, sizeText, ...pathParts] = line.split("\t");
        const filePath = pathParts.join("\t");
        if (!filePath) continue;
        const modifiedAt = Math.round((Number(mtimeText) || 0) * 1000);
        const size = Number(sizeText) || 0;
        const provider = "claude-code-wsl";
        const cacheKey = `${distro}:${provider}:${filePath}:${modifiedAt}:${size}`;
        let record = null;
        try {
          record = cachedConversationImport(cacheKey, () => {
            const raw = runWslImportCommand(distro, `cat ${shellQuote(filePath)}`, 5000);
            if (!raw || raw.includes("Windows Subsystem for Linux")) return null;
            return parseClaudeJsonlConversation(raw, {
              provider,
              agent: "Claude Code",
              agentId: "claude-code-wsl",
              source: "Claude Code WSL 历史",
              toolKind: "claude",
              tags: ["claude-code", "wsl", "local-agent-history"],
              fileName: path.posix.basename(filePath),
              filePath,
              sessionId: path.posix.basename(filePath, ".jsonl"),
              size,
              modifiedAt,
              createdAt: modifiedAt,
              resumeCommand: `claude --resume ${path.posix.basename(filePath, ".jsonl")}`
            });
          });
        } catch {
          record = null;
        }
        if (!record) continue;
        results.push(conversationImportItem(record, {
          provider,
          fileName: path.posix.basename(filePath),
          filePath,
          displayPath: `${distro}: ${filePath}`,
          size,
          modifiedAt,
          createdAt: modifiedAt
        }));
      }
    }

    return results;
  }

  function safeListWslDistributions() {
    try {
      return listWslDistributions();
    } catch {
      return [];
    }
  }

  function scanWslHermesSessionFiles(distros = safeListWslDistributions()) {
    if (!distros.length) return { conversations: [], sources: [], stateDbFound: false };

    const listRoots = HERMES_WSL_SESSION_ROOTS.map((root) => `"${root}"`).join(" ");
    const listScript = [
      `for root in ${listRoots}; do`,
      "  if [ -d \"$root\" ]; then",
      "    find \"$root\" -maxdepth 2 -type f \\( -name '*.json' -o -name '*.jsonl' \\) -printf '%T@\\t%s\\t%p\\n' 2>/dev/null;",
      "  fi;",
      "done | sort -nr | head -n 160"
    ].join(" ");

    const conversations = [];
    const sources = [];
    let stateDbFound = false;

    for (const distro of distros) {
      const stateDbPath = "$HOME/.hermes/state.db";
      let stateDbStatus = "";
      try {
        stateDbStatus = runWslImportCommand(distro, `test -f ${stateDbPath} && printf found || true`, 3000).trim();
      } catch {
        stateDbStatus = "";
      }
      if (stateDbStatus === "found") stateDbFound = true;

      let listed = [];
      try {
        listed = runWslImportCommand(distro, listScript, 5000)
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && line.includes("\t"));
      } catch {
        listed = [];
      }

      sources.push({
        id: `hermes-wsl-sessions:${distro}`,
        name: `Hermes WSL 会话文件 (${distro})`,
        provider: "hermes-wsl-sessions",
        agentId: "hermes",
        toolKind: "hermes",
        path: `${distro}: ~/.hermes/sessions`,
        status: listed.length ? "ready" : "missing",
        count: listed.length,
        detail: stateDbStatus === "found"
          ? "已发现 ~/.hermes/state.db；当前先读取 sessions 会话文件，SQLite 完整索引已预留。"
          : "未发现 sessions 会话文件或 Hermes 数据目录。"
      });

      for (const line of listed.slice(0, MAX_IMPORTED_WSL_CONVERSATIONS)) {
        const [mtimeText, sizeText, ...pathParts] = line.split("\t");
        const filePath = pathParts.join("\t");
        if (!filePath) continue;
        const modifiedAt = Math.round((Number(mtimeText) || 0) * 1000);
        const size = Number(sizeText) || 0;
        const provider = "hermes-wsl-sessions";
        const cacheKey = `${distro}:${provider}:${filePath}:${modifiedAt}:${size}`;
        let record = null;
        try {
          record = cachedConversationImport(cacheKey, () => {
            const raw = runWslImportCommand(distro, `cat ${shellQuote(filePath)}`, 6000);
            if (!raw || raw.includes("Windows Subsystem for Linux")) return null;
            const sessionId = path.posix.basename(filePath, path.posix.extname(filePath));
            return parseHermesSessionConversation(raw, {
              provider,
              sourceId: `hermes-wsl-sessions:${distro}`,
              source: "Hermes WSL 会话文件",
              fileName: path.posix.basename(filePath),
              filePath,
              size,
              modifiedAt,
              createdAt: modifiedAt,
              resumeCommand: `wsl.exe -d ${distro} -e bash -lc ${shellQuote(`hermes --resume ${sessionId}`)}`
            });
          });
        } catch {
          record = null;
        }
        if (!record) continue;
        conversations.push(conversationImportItem(record, {
          provider,
          fileName: path.posix.basename(filePath),
          filePath,
          displayPath: `${distro}: ${filePath}`,
          size,
          modifiedAt,
          createdAt: modifiedAt
        }));
      }
    }

    return { conversations, sources, stateDbFound };
  }

  function pickSqlColumn(columns, candidates) {
    const set = new Set((columns || []).map((column) => String(column || "").toLowerCase()));
    return candidates.find((candidate) => set.has(String(candidate).toLowerCase())) || "";
  }

  function sqlColumnList(columns, preferred) {
    const available = new Set((columns || []).map((column) => String(column || "").toLowerCase()));
    const selected = preferred.filter((column) => available.has(String(column).toLowerCase()));
    return selected.length ? selected.map((column) => `"${column}"`).join(", ") : "*";
  }

  function scanWslHermesStateDb(distros = safeListWslDistributions()) {
    if (!distros.length) return { conversations: [], sources: [] };

    const conversations = [];
    const sources = [];
    const stateDbPath = "$HOME/.hermes/state.db";
    const expandedStateDbPath = "$HOME/.hermes/state.db";

    for (const distro of distros) {
      let dbStatus = "";
      try {
        dbStatus = runWslImportCommand(distro, `test -f ${stateDbPath} && printf found || true`, 3000).trim();
      } catch {
        dbStatus = "";
      }

      if (dbStatus !== "found") {
        sources.push({
          id: `hermes-wsl-state-db:${distro}`,
          name: `Hermes WSL state.db (${distro})`,
          provider: "hermes-wsl-state-db",
          agentId: "hermes",
          toolKind: "hermes",
          path: `${distro}: ~/.hermes/state.db`,
          status: "missing",
          count: 0,
          detail: "未发现 Hermes SQLite 主库。"
        });
        continue;
      }

      const sqliteCommand = detectWslSqliteCommand(distro);
      if (!sqliteCommand) {
        sources.push({
          id: `hermes-wsl-state-db:${distro}`,
          name: `Hermes WSL state.db (${distro})`,
          provider: "hermes-wsl-state-db",
          agentId: "hermes",
          toolKind: "hermes",
          path: `${distro}: ~/.hermes/state.db`,
          status: "unavailable",
          count: 0,
          detail: "已发现 state.db，但该 WSL 环境未发现 sqlite3，暂不能读取会话索引。"
        });
        continue;
      }

      const sessionsColumnsPayload = runWslJsonCommand(
        distro,
        wslSqliteJsonScript(sqliteCommand, expandedStateDbPath, "PRAGMA table_info(sessions);"),
        5000
      );
      const messagesColumnsPayload = runWslJsonCommand(
        distro,
        wslSqliteJsonScript(sqliteCommand, expandedStateDbPath, "PRAGMA table_info(messages);"),
        5000
      );
      const sessionColumns = Array.isArray(sessionsColumnsPayload)
        ? sessionsColumnsPayload.map((column) => column.name).filter(Boolean)
        : [];
      const messageColumns = Array.isArray(messagesColumnsPayload)
        ? messagesColumnsPayload.map((column) => column.name).filter(Boolean)
        : [];
      const sessionIdColumn = pickSqlColumn(sessionColumns, ["id", "session_id", "sessionId"]);
      const messageSessionColumn = pickSqlColumn(messageColumns, ["session_id", "sessionId", "conversation_id", "conversationId"]);
      if (!sessionIdColumn || !messageSessionColumn) {
        sources.push({
          id: `hermes-wsl-state-db:${distro}`,
          name: `Hermes WSL state.db (${distro})`,
          provider: "hermes-wsl-state-db",
          agentId: "hermes",
          toolKind: "hermes",
          path: `${distro}: ~/.hermes/state.db`,
          status: "unavailable",
          count: 0,
          detail: "已发现 state.db，但表结构与当前导入器不匹配。"
        });
        continue;
      }

      const sessionOrderColumn = pickSqlColumn(sessionColumns, ["ended_at", "updated_at", "last_message_at", "started_at", "created_at", sessionIdColumn]);
      const sessionSelect = sqlColumnList(sessionColumns, [
        sessionIdColumn,
        "source",
        "model",
        "model_name",
        "started_at",
        "ended_at",
        "updated_at",
        "created_at",
        "last_message_at",
        "message_count",
        "title",
        "cwd",
        "workspace",
        "status"
      ]);
      const sessionsSql = `SELECT ${sessionSelect} FROM sessions ORDER BY "${sessionOrderColumn}" DESC LIMIT ${MAX_IMPORTED_HERMES_DB_CONVERSATIONS};`;
      const sessions = runWslJsonCommand(
        distro,
        wslSqliteJsonScript(sqliteCommand, expandedStateDbPath, sessionsSql),
        7000
      );
      if (!Array.isArray(sessions) || !sessions.length) {
        sources.push({
          id: `hermes-wsl-state-db:${distro}`,
          name: `Hermes WSL state.db (${distro})`,
          provider: "hermes-wsl-state-db",
          agentId: "hermes",
          toolKind: "hermes",
          path: `${distro}: ~/.hermes/state.db`,
          status: "ready",
          count: 0,
          detail: "已连接 state.db，但未读取到会话。"
        });
        continue;
      }

      const messageOrderColumn = pickSqlColumn(messageColumns, ["timestamp", "created_at", "createdAt", "id", "rowid"]) || "timestamp";
      const messageSelect = sqlColumnList(messageColumns, [
        messageSessionColumn,
        "role",
        "content",
        "timestamp",
        "created_at",
        "createdAt",
        "tool_calls",
        "reasoning"
      ]);
      const sessionIds = sessions
        .map((session) => String(session[sessionIdColumn] || session.id || session.session_id || session.sessionId || "").trim())
        .filter(Boolean);
      const idList = sessionIds.map(sqliteQuote).join(", ");
      const messagesSql = [
        `SELECT ${messageSelect} FROM (`,
        `SELECT ${messageSelect}, ROW_NUMBER() OVER (PARTITION BY "${messageSessionColumn}" ORDER BY "${messageOrderColumn}" DESC) AS rn`,
        `FROM messages WHERE "${messageSessionColumn}" IN (${idList})`,
        `) WHERE rn <= ${MAX_IMPORTED_HERMES_DB_MESSAGES}`,
        `ORDER BY "${messageSessionColumn}", "${messageOrderColumn}" ASC;`
      ].join(" ");
      const rawMessages = idList
        ? runWslJsonCommand(distro, wslSqliteJsonScript(sqliteCommand, expandedStateDbPath, messagesSql), 10000)
        : [];
      const groupedMessages = new Map();
      if (Array.isArray(rawMessages)) {
        for (const message of rawMessages) {
          const id = String(message[messageSessionColumn] || "").trim();
          if (!id) continue;
          const list = groupedMessages.get(id) || [];
          list.push(message);
          groupedMessages.set(id, list);
        }
      }

      sources.push({
        id: `hermes-wsl-state-db:${distro}`,
        name: `Hermes WSL state.db (${distro})`,
        provider: "hermes-wsl-state-db",
        agentId: "hermes",
        toolKind: "hermes",
        path: `${distro}: ~/.hermes/state.db`,
        status: "ready",
        count: sessions.length,
        detail: `已从 SQLite 主库读取最近 ${sessions.length} 条会话索引。`
      });

      for (const session of sessions) {
        const sessionId = String(session[sessionIdColumn] || session.id || session.session_id || session.sessionId || "").trim();
        const record = parseHermesDbConversation(session, (groupedMessages.get(sessionId) || []).slice().reverse(), {
          provider: "hermes-wsl-state-db",
          sourceId: `hermes-wsl-state-db:${distro}`,
          source: "Hermes WSL state.db",
          distro
        });
        if (!record) continue;
        conversations.push(conversationImportItem(record, {
          provider: "hermes-wsl-state-db",
          fileName: "state.db",
          filePath: `${distro}: ~/.hermes/state.db#${sessionId}`,
          displayPath: `${distro}: ~/.hermes/state.db#${sessionId}`,
          size: 0,
          modifiedAt: record.updatedAt,
          createdAt: record.createdAt
        }));
      }
    }

    return { conversations, sources };
  }

  function deleteConversationMirrorFile(payload) {
    const input = payload && typeof payload === "object" ? payload : {};
    const filePath = String(input.path || "").trim();
    if (!filePath) return { deletedFile: false, reason: "missing-path" };
    const conversationsDir = path.resolve(getConversationDirectory());
    const resolved = path.resolve(filePath);
    const relative = path.relative(conversationsDir, resolved);
    const insideConversationsDir = relative && !relative.startsWith("..") && !path.isAbsolute(relative);
    if (!insideConversationsDir) {
      return { deletedFile: false, reason: "outside-managed-directory" };
    }
    try {
      if (fs.existsSync(resolved)) {
        fs.rmSync(resolved, { force: true });
        return { deletedFile: true, filePath: resolved };
      }
    } catch (error) {
      return { deletedFile: false, filePath: resolved, reason: error.message || String(error) };
    }
    return { deletedFile: false, filePath: resolved, reason: "not-found" };
  }

  function nativeHistorySourceStubs(homePath) {
    const claudeProjectsPath = path.join(homePath, ".claude", "projects");
    return [
      {
        id: "claude-code",
        name: "Claude Code",
        provider: "claude-code",
        agentId: "claude",
        toolKind: "claude",
        path: claudeProjectsPath,
        status: fs.existsSync(claudeProjectsPath) ? "manual" : "missing",
        count: 0,
        detail: fs.existsSync(claudeProjectsPath)
          ? "已发现本机 Claude Code 历史。为避免启动卡顿，原生历史导入改为手动扫描。"
          : "未发现 ~/.claude/projects。"
      },
      {
        id: "claude-code-wsl",
        name: "Claude Code WSL",
        provider: "claude-code-wsl",
        agentId: "claude",
        toolKind: "claude",
        path: "~/.claude/projects",
        status: "manual",
        count: 0,
        detail: "WSL 历史需要手动扫描，Meodesk 启动时不会自动调用 WSL。"
      },
      {
        id: "hermes-wsl-sessions",
        name: "Hermes WSL 会话文件",
        provider: "hermes-wsl-sessions",
        agentId: "hermes",
        toolKind: "hermes",
        path: "~/.hermes/sessions",
        status: "manual",
        count: 0,
        detail: "Hermes 原生历史位于 WSL 或 SQLite 时需要手动导入，避免跨环境扫描拖慢启动。"
      },
      {
        id: "hermes-wsl-state-db",
        name: "Hermes WSL state.db",
        provider: "hermes-wsl-state-db",
        agentId: "hermes",
        toolKind: "hermes",
        path: "~/.hermes/state.db",
        status: "manual",
        count: 0,
        detail: "SQLite 完整历史索引已预留，后续应通过明确授权的导入流程读取。"
      }
    ];
  }

  function scanImportedAgentConversations(options = {}) {
    try {
      const includeNativeHistory = Boolean(options.includeNativeHistory);
      const snapshotMode = includeNativeHistory ? "native" : "light";
      const now = Date.now();
      if (conversationImportSnapshot.mode === snapshotMode && now - conversationImportSnapshot.at < CONVERSATION_IMPORT_SCAN_INTERVAL_MS) {
        return conversationImportSnapshot;
      }

      const sources = [];
      const conversations = [];
      const homePath = getHomePath();
      if (!includeNativeHistory) {
        conversationImportSnapshot = {
          at: now,
          conversations,
          sources: nativeHistorySourceStubs(homePath),
          mode: snapshotMode
        };
        return conversationImportSnapshot;
      }

      const claudeProjectsPath = path.join(homePath, ".claude", "projects");
      const claudeConversations = scanClaudeCodeConversationFiles(claudeProjectsPath);
      sources.push({
        id: "claude-code",
        name: "Claude Code",
        provider: "claude-code",
        agentId: "claude",
        toolKind: "claude",
        path: claudeProjectsPath,
        status: fs.existsSync(claudeProjectsPath) ? "ready" : "missing",
        count: claudeConversations.length,
        detail: fs.existsSync(claudeProjectsPath)
          ? "自动读取 Claude Code 的本地 JSONL 历史。"
          : "未发现 ~/.claude/projects。"
      });
      conversations.push(...claudeConversations);

      const distros = safeListWslDistributions();
      const wslConversations = scanWslClaudeStyleConversationFiles();
      sources.push({
        id: "claude-code-wsl",
        name: "Claude Code WSL",
        provider: "claude-code-wsl",
        agentId: "claude",
        toolKind: "claude",
        path: "~/.claude/projects",
        status: wslConversations.length ? "ready" : (distros.length ? "missing" : "unavailable"),
        count: wslConversations.length,
        detail: distros.length
          ? "扫描 WSL 发行版内的 Claude Code 历史。"
          : "当前系统未发现可用 WSL 发行版。"
      });
      conversations.push(...wslConversations);

      const hermesDb = scanWslHermesStateDb(distros);
      sources.push(...hermesDb.sources);
      conversations.push(...hermesDb.conversations);

      const hermesWsl = scanWslHermesSessionFiles(distros);
      sources.push(...hermesWsl.sources);
      conversations.push(...hermesWsl.conversations);

      const deduped = [];
      const seen = new Set();
      for (const item of conversations.sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0))) {
        const id = item.request?.conversationId || item.path || item.fileName;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        deduped.push(item);
        if (deduped.length >= MAX_IMPORTED_CONVERSATIONS) break;
      }

      conversationImportSnapshot = { at: now, conversations: deduped, sources, mode: snapshotMode };
      return conversationImportSnapshot;
    } catch (error) {
      conversationImportSnapshot = {
        at: Date.now(),
        conversations: [],
        sources: nativeHistorySourceStubs(getHomePath()).map((source) => ({
          ...source,
          status: source.status === "missing" ? "missing" : "unavailable",
          detail: source.detail || "历史导入暂不可用。"
        })),
        mode: Boolean(options.includeNativeHistory) ? "native" : "light",
        error: error.message || String(error)
      };
      return conversationImportSnapshot;
    }
  }



  return {
    deleteConversationMirrorFile,
    scanImportedAgentConversations,
    writeConversationMirror
  };
}

module.exports = { createConversationService };
